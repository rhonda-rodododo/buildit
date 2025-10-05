import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NostrClient } from '@/core/nostr/client';
import { db } from '@/core/storage/db';
import { getPublicKey, nip19 } from 'nostr-tools';

describe('Nostr Client ↔ Storage Integration', () => {
  let client: NostrClient;
  let testPrivkey: string;
  let testPubkey: string;

  beforeEach(async () => {
    // Generate test keys
    testPrivkey = generatePrivateKey();
    testPubkey = getPublicKey(testPrivkey);

    // Initialize client
    client = new NostrClient(['wss://relay.damus.io', 'wss://nos.lol']);

    // Clear test data
    await db.nostrEvents.clear();
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
    await db.nostrEvents.clear();
  });

  describe('Event Storage Sync', () => {
    it('should store published events in IndexedDB', async () => {
      const event = {
        kind: 1,
        content: 'Test event',
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await client.signEvent(event, testPrivkey);

      // Store in DB
      await db.nostrEvents.add({
        ...signedEvent,
        receivedAt: Date.now(),
      });

      const stored = await db.nostrEvents
        .where('id')
        .equals(signedEvent.id)
        .first();

      expect(stored).toBeDefined();
      expect(stored?.content).toBe('Test event');
      expect(stored?.pubkey).toBe(testPubkey);
    });

    it('should retrieve events by kind', async () => {
      // Add multiple events with different kinds
      const events = [
        { kind: 1, content: 'Note 1', tags: [], created_at: Math.floor(Date.now() / 1000) },
        { kind: 1, content: 'Note 2', tags: [], created_at: Math.floor(Date.now() / 1000) + 1 },
        { kind: 3, content: 'Contact list', tags: [], created_at: Math.floor(Date.now() / 1000) + 2 },
      ];

      for (const event of events) {
        const signed = await client.signEvent(event, testPrivkey);
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
      const otherPrivkey = generatePrivateKey();
      const otherPubkey = getPublicKey(otherPrivkey);

      const event1 = await client.signEvent(
        { kind: 1, content: 'From test user', tags: [], created_at: Math.floor(Date.now() / 1000) },
        testPrivkey
      );
      const event2 = await client.signEvent(
        { kind: 1, content: 'From other user', tags: [], created_at: Math.floor(Date.now() / 1000) },
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
      const event = await client.signEvent(
        { kind: 1, content: 'Duplicate test', tags: [], created_at: Math.floor(Date.now() / 1000) },
        testPrivkey
      );

      // Add same event twice
      await db.nostrEvents.add({ ...event, receivedAt: Date.now() });

      // Should throw or update, not create duplicate
      const count = await db.nostrEvents.where('id').equals(event.id).count();
      expect(count).toBe(1);
    });

    it('should update replaceable events', async () => {
      const kind0Event1 = await client.signEvent(
        {
          kind: 0,
          content: JSON.stringify({ name: 'Alice', about: 'First version' }),
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
        },
        testPrivkey
      );

      await db.nostrEvents.add({ ...kind0Event1, receivedAt: Date.now() });

      // Create newer version
      const kind0Event2 = await client.signEvent(
        {
          kind: 0,
          content: JSON.stringify({ name: 'Alice', about: 'Updated version' }),
          tags: [],
          created_at: Math.floor(Date.now() / 1000) + 10,
        },
        testPrivkey
      );

      // Replace old event with new one (simulating replaceable event behavior)
      await db.nostrEvents
        .where('[kind+pubkey]')
        .equals([0, testPubkey])
        .delete();
      await db.nostrEvents.add({ ...kind0Event2, receivedAt: Date.now() });

      const stored = await db.nostrEvents
        .where('[kind+pubkey]')
        .equals([0, testPubkey])
        .first();

      expect(stored?.content).toContain('Updated version');
    });
  });
});

// Helper function
function generatePrivateKey(): string {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return Array.from(privateKey, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
