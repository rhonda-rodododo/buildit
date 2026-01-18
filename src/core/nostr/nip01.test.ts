/**
 * NIP-01 Tests
 * Tests for basic Nostr event creation and verification
 */
import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import type { Event as NostrEvent, Filter } from 'nostr-tools';
import {
  generateEventId,
  createEvent,
  createEventFromTemplate,
  verifyEventSignature,
  derivePublicKey,
  createTextNote,
  createMetadataEvent,
  createDeletionEvent,
  getReferencedEventIds,
  getReferencedPubkeys,
  eventMatchesFilter,
} from './nip01';

describe('nip01.ts', () => {
  // Generate test keys
  const testPrivateKey = generateSecretKey();
  const testPublicKey = getPublicKey(testPrivateKey);
  // Hex private key for createEvent
  const hexPrivateKey = Array.from(testPrivateKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  describe('generateEventId', () => {
    it('should generate a unique UUID', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      // UUID format check
      expect(id1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('createEvent', () => {
    it('should create a signed Nostr event', () => {
      const event = createEvent(1, 'Hello World', [], hexPrivateKey);

      expect(event).toBeDefined();
      expect(event.kind).toBe(1);
      expect(event.content).toBe('Hello World');
      expect(event.tags).toEqual([]);
      expect(event.pubkey).toBe(testPublicKey);
      expect(event.id).toBeDefined();
      expect(event.sig).toBeDefined();
      expect(event.created_at).toBeGreaterThan(0);
    });

    it('should include tags in the event', () => {
      const tags = [
        ['p', 'pubkey123'],
        ['e', 'eventid456'],
      ];
      const event = createEvent(1, 'Test', tags, hexPrivateKey);

      expect(event.tags).toEqual(tags);
    });

    it('should create verifiable events', () => {
      const event = createEvent(1, 'Verifiable content', [], hexPrivateKey);

      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('createEventFromTemplate', () => {
    it('should create event from template with Uint8Array key', () => {
      const template = {
        kind: 1,
        content: 'From template',
        tags: [] as string[][],
        created_at: Math.floor(Date.now() / 1000),
      };

      const event = createEventFromTemplate(template, testPrivateKey);

      expect(event.kind).toBe(1);
      expect(event.content).toBe('From template');
      expect(event.pubkey).toBe(testPublicKey);
      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('verifyEventSignature', () => {
    it('should return true for valid event', () => {
      const event = createEvent(1, 'Test', [], hexPrivateKey);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should verify events created with different content', () => {
      const event1 = createEvent(1, 'Content 1', [], hexPrivateKey);
      const event2 = createEvent(1, 'Content 2', [], hexPrivateKey);

      // Both should be valid
      expect(verifyEventSignature(event1)).toBe(true);
      expect(verifyEventSignature(event2)).toBe(true);

      // They should have different IDs
      expect(event1.id).not.toBe(event2.id);
    });

    it('should verify events with tags', () => {
      const event = createEvent(
        1,
        'Tagged content',
        [
          ['p', 'pubkey123'],
          ['e', 'eventid456'],
        ],
        hexPrivateKey
      );

      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('derivePublicKey', () => {
    it('should derive public key from private key', () => {
      const pubkey = derivePublicKey(testPrivateKey);

      expect(pubkey).toBe(testPublicKey);
      expect(pubkey).toHaveLength(64); // 32 bytes as hex
    });

    it('should produce consistent results', () => {
      const pubkey1 = derivePublicKey(testPrivateKey);
      const pubkey2 = derivePublicKey(testPrivateKey);

      expect(pubkey1).toBe(pubkey2);
    });
  });

  describe('createTextNote', () => {
    it('should create a kind 1 text note', () => {
      const event = createTextNote('Hello Nostr!', testPrivateKey);

      expect(event.kind).toBe(1);
      expect(event.content).toBe('Hello Nostr!');
      expect(event.tags).toEqual([]);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should include optional tags', () => {
      const tags = [
        ['p', 'mentioned-pubkey'],
        ['t', 'nostr'],
      ];
      const event = createTextNote('Tagged post #nostr', testPrivateKey, tags);

      expect(event.tags).toEqual(tags);
    });
  });

  describe('createMetadataEvent', () => {
    it('should create a kind 0 metadata event', () => {
      const metadata = {
        name: 'Test User',
        about: 'A test account',
        picture: 'https://example.com/avatar.png',
      };

      const event = createMetadataEvent(metadata, testPrivateKey);

      expect(event.kind).toBe(0);
      expect(JSON.parse(event.content)).toEqual(metadata);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should include nip05 verification', () => {
      const metadata = {
        name: 'Test User',
        nip05: 'test@example.com',
      };

      const event = createMetadataEvent(metadata, testPrivateKey);
      const parsed = JSON.parse(event.content);

      expect(parsed.nip05).toBe('test@example.com');
    });

    it('should handle custom fields', () => {
      const metadata = {
        name: 'Custom User',
        lud16: 'user@walletofsatoshi.com',
        website: 'https://example.com',
      };

      const event = createMetadataEvent(metadata, testPrivateKey);
      const parsed = JSON.parse(event.content);

      expect(parsed.lud16).toBe('user@walletofsatoshi.com');
      expect(parsed.website).toBe('https://example.com');
    });
  });

  describe('createDeletionEvent', () => {
    it('should create a kind 5 deletion event', () => {
      const eventIds = ['event1', 'event2', 'event3'];

      const event = createDeletionEvent(eventIds, testPrivateKey);

      expect(event.kind).toBe(5);
      expect(event.tags).toHaveLength(3);
      expect(event.tags).toEqual([
        ['e', 'event1'],
        ['e', 'event2'],
        ['e', 'event3'],
      ]);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should include deletion reason', () => {
      const eventIds = ['event1'];
      const reason = 'Posted by mistake';

      const event = createDeletionEvent(eventIds, testPrivateKey, reason);

      expect(event.content).toBe(reason);
    });

    it('should have empty content when no reason provided', () => {
      const eventIds = ['event1'];
      const event = createDeletionEvent(eventIds, testPrivateKey);

      expect(event.content).toBe('');
    });
  });

  describe('getReferencedEventIds', () => {
    it('should extract event IDs from e-tags', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ['e', 'event1'],
          ['p', 'pubkey1'],
          ['e', 'event2'],
          ['t', 'hashtag'],
        ],
        content: 'Test',
        sig: 'sig',
      };

      const eventIds = getReferencedEventIds(event);

      expect(eventIds).toEqual(['event1', 'event2']);
    });

    it('should return empty array when no e-tags', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['p', 'pubkey1']],
        content: 'Test',
        sig: 'sig',
      };

      const eventIds = getReferencedEventIds(event);

      expect(eventIds).toEqual([]);
    });
  });

  describe('getReferencedPubkeys', () => {
    it('should extract pubkeys from p-tags', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ['p', 'pubkey1'],
          ['e', 'event1'],
          ['p', 'pubkey2'],
        ],
        content: 'Test',
        sig: 'sig',
      };

      const pubkeys = getReferencedPubkeys(event);

      expect(pubkeys).toEqual(['pubkey1', 'pubkey2']);
    });

    it('should return empty array when no p-tags', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', 'event1']],
        content: 'Test',
        sig: 'sig',
      };

      const pubkeys = getReferencedPubkeys(event);

      expect(pubkeys).toEqual([]);
    });
  });

  describe('eventMatchesFilter', () => {
    const createMockEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
      id: 'event-123',
      pubkey: 'pubkey-abc',
      created_at: 1700000000,
      kind: 1,
      tags: [],
      content: 'Test content',
      sig: 'sig',
      ...overrides,
    });

    it('should match event by kind', () => {
      const event = createMockEvent({ kind: 1 });
      const filters: Filter[] = [{ kinds: [1, 4] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should not match event with wrong kind', () => {
      const event = createMockEvent({ kind: 3 });
      const filters: Filter[] = [{ kinds: [1, 4] }];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });

    it('should match event by author', () => {
      const event = createMockEvent({ pubkey: 'author123' });
      const filters: Filter[] = [{ authors: ['author123', 'author456'] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should not match event with wrong author', () => {
      const event = createMockEvent({ pubkey: 'author789' });
      const filters: Filter[] = [{ authors: ['author123'] }];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });

    it('should match event by ID', () => {
      const event = createMockEvent({ id: 'specific-id' });
      const filters: Filter[] = [{ ids: ['specific-id'] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should match event by since timestamp', () => {
      const event = createMockEvent({ created_at: 1700000100 });
      const filters: Filter[] = [{ since: 1700000000 }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should not match event before since timestamp', () => {
      const event = createMockEvent({ created_at: 1699999900 });
      const filters: Filter[] = [{ since: 1700000000 }];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });

    it('should match event by until timestamp', () => {
      const event = createMockEvent({ created_at: 1700000000 });
      const filters: Filter[] = [{ until: 1700000100 }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should not match event after until timestamp', () => {
      const event = createMockEvent({ created_at: 1700000200 });
      const filters: Filter[] = [{ until: 1700000100 }];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });

    it('should match event by e-tag', () => {
      const event = createMockEvent({
        tags: [['e', 'referenced-event']],
      });
      const filters: Filter[] = [{ '#e': ['referenced-event'] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should not match event without matching e-tag', () => {
      const event = createMockEvent({
        tags: [['e', 'other-event']],
      });
      const filters: Filter[] = [{ '#e': ['referenced-event'] }];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });

    it('should match event by p-tag', () => {
      const event = createMockEvent({
        tags: [['p', 'mentioned-pubkey']],
      });
      const filters: Filter[] = [{ '#p': ['mentioned-pubkey'] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should match multiple filters with OR logic', () => {
      const event = createMockEvent({ kind: 3 });
      const filters: Filter[] = [{ kinds: [1] }, { kinds: [3] }];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should match when no filter constraints specified', () => {
      const event = createMockEvent();
      const filters: Filter[] = [{}];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should combine multiple constraints with AND logic', () => {
      const event = createMockEvent({
        kind: 1,
        pubkey: 'author123',
        created_at: 1700000100,
      });
      const filters: Filter[] = [
        {
          kinds: [1],
          authors: ['author123'],
          since: 1700000000,
        },
      ];

      expect(eventMatchesFilter(event, filters)).toBe(true);
    });

    it('should fail when one AND constraint fails', () => {
      const event = createMockEvent({
        kind: 1,
        pubkey: 'wrong-author',
      });
      const filters: Filter[] = [
        {
          kinds: [1],
          authors: ['author123'],
        },
      ];

      expect(eventMatchesFilter(event, filters)).toBe(false);
    });
  });
});
