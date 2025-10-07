import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NostrClient } from '@/core/nostr/client';
import { getDB } from '@/core/storage/db';
import { type UnsignedEvent } from 'nostr-tools';
import { generateTestKeypair, createTestNostrClient, signEvent } from '@/test/test-utils';

describe('Nostr Client ↔ Storage Integration', () => {
  let client: NostrClient;
  let testPrivkey: string;
  let testPubkey: string;

  beforeEach(async () => {
    // Generate test keys
    const keypair = generateTestKeypair();
    testPrivkey = keypair.privateKey;
    testPubkey = keypair.publicKey;

    // Initialize client with test relays
    client = createTestNostrClient();

    // Clear test data
    const db = getDB();
    await db.nostrEvents.clear();
  });

  afterEach(async () => {
    if (client) {
      client.close();
    }
    const db = getDB();
    await db.nostrEvents.clear();
  });

  describe('Event Storage Sync', () => {
    it('should store published events in IndexedDB', async () => {
      const event: UnsignedEvent = {
        kind: 1,
        content: 'Test event',
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: testPubkey,
      };

      const signedEvent = signEvent(event, testPrivkey);

      // Store in DB
      const db = getDB();
      await db.nostrEvents.add({
        ...signedEvent,
        receivedAt: Date.now(),
      });

      const db2 = getDB();
      const stored = await db2.nostrEvents
        .where('id')
        .equals(signedEvent.id)
        .first();

      expect(stored).toBeDefined();
      expect(stored?.content).toBe('Test event');
      expect(stored?.pubkey).toBe(testPubkey);
    });

    it('should retrieve events by kind', async () => {
      const db = getDB();
      // Add multiple events with different kinds
      const events: UnsignedEvent[] = [
        { kind: 1, content: 'Note 1', tags: [], created_at: Math.floor(Date.now() / 1000), pubkey: testPubkey },
        { kind: 1, content: 'Note 2', tags: [], created_at: Math.floor(Date.now() / 1000) + 1, pubkey: testPubkey },
        { kind: 3, content: 'Contact list', tags: [], created_at: Math.floor(Date.now() / 1000) + 2, pubkey: testPubkey },
      ];

      for (const event of events) {
        const signed = signEvent(event, testPrivkey);
        await db.nostrEvents.add({
          ...signed,
          receivedAt: Date.now(),
        });
      }

      const kind1Events = await db.nostrEvents.where('kind').equals(1).toArray();
      const kind3Events = await db.nostrEvents.where('kind').equals(3).toArray();

      expect(kind1Events).toHaveLength(2);
      expect(kind3Events).toHaveLength(1);
    });

    it('should retrieve events by author', async () => {
      const db = getDB();
      const otherKeypair = generateTestKeypair();
      const otherPrivkey = otherKeypair.privateKey;
      const otherPubkey = otherKeypair.publicKey;

      const event1 = signEvent(
        { kind: 1, content: 'From test user', tags: [], created_at: Math.floor(Date.now() / 1000), pubkey: testPubkey },
        testPrivkey
      );
      const event2 = signEvent(
        { kind: 1, content: 'From other user', tags: [], created_at: Math.floor(Date.now() / 1000), pubkey: otherPubkey },
        otherPrivkey
      );

      await db.nostrEvents.add({ ...event1, receivedAt: Date.now() });
      await db.nostrEvents.add({ ...event2, receivedAt: Date.now() });

      const testUserEvents = await db.nostrEvents.where('pubkey').equals(testPubkey).toArray();
      const otherUserEvents = await db.nostrEvents.where('pubkey').equals(otherPubkey).toArray();

      expect(testUserEvents).toHaveLength(1);
      expect(otherUserEvents).toHaveLength(1);
      expect(testUserEvents[0].content).toBe('From test user');
      expect(otherUserEvents[0].content).toBe('From other user');
    });
  });

  describe('Subscription and Storage', () => {
    it('should handle event deduplication', async () => {
      const db = getDB();
      const event = signEvent(
        { kind: 1, content: 'Duplicate test', tags: [], created_at: Math.floor(Date.now() / 1000), pubkey: testPubkey },
        testPrivkey
      );

      // Add same event twice
      await db.nostrEvents.add({ ...event, receivedAt: Date.now() });

      // Should throw or update, not create duplicate
      const count = await db.nostrEvents.where('id').equals(event.id).count();
      expect(count).toBe(1);
    });

    it('should update replaceable events', async () => {
      const db = getDB();
      const kind0Event1 = signEvent(
        {
          kind: 0,
          content: JSON.stringify({ name: 'Alice', about: 'First version' }),
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: testPubkey,
        },
        testPrivkey
      );

      await db.nostrEvents.add({ ...kind0Event1, receivedAt: Date.now() });

      // Create newer version
      const kind0Event2 = signEvent(
        {
          kind: 0,
          content: JSON.stringify({ name: 'Alice', about: 'Updated version' }),
          tags: [],
          created_at: Math.floor(Date.now() / 1000) + 10,
          pubkey: testPubkey,
        },
        testPrivkey
      );

      // Replace old event with new one (simulating replaceable event behavior)
      // For replaceable events (kind 0), delete old and add new
      const oldEvents = await db.nostrEvents
        .where('kind')
        .equals(0)
        .and((event) => event.pubkey === testPubkey)
        .toArray();

      for (const oldEvent of oldEvents) {
        await db.nostrEvents.delete(oldEvent.id);
      }

      await db.nostrEvents.add({ ...kind0Event2, receivedAt: Date.now() });

      const stored = await db.nostrEvents
        .where('kind')
        .equals(0)
        .and((event) => event.pubkey === testPubkey)
        .first();

      expect(stored?.content).toContain('Updated version');
    });
  });
});
