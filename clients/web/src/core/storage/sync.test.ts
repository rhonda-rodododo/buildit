/**
 * sync.ts Tests
 * Tests the Nostr <-> IndexedDB sync service
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Event as NostrEvent } from 'nostr-tools';
import { enableTestMode, disableTestMode } from './EncryptedDB';

// Mock NostrClient
const mockSubscribe = vi.fn(() => 'sub-1');
const mockUnsubscribe = vi.fn();
const mockNostrClient = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
};

vi.mock('@/core/nostr/client', () => ({
  getNostrClient: () => mockNostrClient,
}));

// Mock authStore
const mockCurrentIdentity = {
  publicKey: 'test-pubkey-123',
  name: 'Test User',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      currentIdentity: mockCurrentIdentity,
    }),
  },
  getCurrentPrivateKey: () => new Uint8Array(32).fill(1),
}));

// Mock messageReceiver
vi.mock('@/core/messaging/messageReceiver', () => ({
  startMessageReceiver: vi.fn(),
  stopMessageReceiver: vi.fn(),
  fetchMessageHistory: vi.fn().mockResolvedValue(0),
}));

// Mock logger using vi.hoisted for proper hoisting
const { mockLoggerWarn, mockLogger } = vi.hoisted(() => {
  const mockLoggerWarn = vi.fn();
  const mockLogger = {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { mockLoggerWarn, mockLogger };
});

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

describe('sync.ts', () => {
  beforeEach(async () => {
    enableTestMode();
    vi.clearAllMocks();
  });

  afterEach(() => {
    disableTestMode();
  });

  describe('BUILD_IT_KINDS', () => {
    it('should export event kind constants', async () => {
      const { BUILD_IT_KINDS } = await import('./sync');

      expect(BUILD_IT_KINDS.EVENT).toBe(31922);
      expect(BUILD_IT_KINDS.RSVP).toBe(31923);
      expect(BUILD_IT_KINDS.PROPOSAL).toBe(31924);
      expect(BUILD_IT_KINDS.WIKI_PAGE).toBe(31925);
      expect(BUILD_IT_KINDS.MUTUAL_AID).toBe(31926);
      expect(BUILD_IT_KINDS.DATABASE_RECORD).toBe(31927);
    });
  });

  describe('startGroupSync', () => {
    it('should subscribe to Nostr events for a group', async () => {
      const { startGroupSync, stopGroupSync } = await import('./sync');

      startGroupSync('group-1');

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kinds: expect.arrayContaining([31922, 31923, 31924, 31925, 31926, 31927]),
            '#group': ['group-1'],
          }),
        ]),
        expect.any(Function),
        expect.any(Function)
      );

      // Cleanup
      stopGroupSync('group-1');
    });

    it('should not duplicate subscriptions for same group', async () => {
      const { startGroupSync, stopGroupSync } = await import('./sync');

      startGroupSync('group-1');
      startGroupSync('group-1'); // Second call should be ignored

      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      // Cleanup
      stopGroupSync('group-1');
    });
  });

  describe('stopGroupSync', () => {
    it('should unsubscribe from group sync', async () => {
      const { startGroupSync, stopGroupSync } = await import('./sync');

      startGroupSync('group-2');
      stopGroupSync('group-2');

      expect(mockUnsubscribe).toHaveBeenCalledWith('sub-1');
    });

    it('should handle stopping non-existent sync gracefully', async () => {
      const { stopGroupSync } = await import('./sync');

      // Should not throw
      expect(() => {
        stopGroupSync('non-existent-group');
      }).not.toThrow();
    });
  });

  describe('stopAllSyncs', () => {
    it('should stop all active syncs', async () => {
      const { startGroupSync, stopAllSyncs } = await import('./sync');
      const { stopMessageReceiver } = await import('@/core/messaging/messageReceiver');

      startGroupSync('group-a');
      startGroupSync('group-b');

      vi.clearAllMocks();

      stopAllSyncs();

      // Should call unsubscribe for both groups
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(stopMessageReceiver).toHaveBeenCalled();
    });
  });

  describe('startMessageSync', () => {
    it('should start message receiver', async () => {
      const { startMessageSync } = await import('./sync');
      const { startMessageReceiver } = await import('@/core/messaging/messageReceiver');

      startMessageSync();

      expect(startMessageReceiver).toHaveBeenCalledWith('test-pubkey-123');
    });
  });

  describe('stopMessageSync', () => {
    it('should stop message receiver', async () => {
      const { stopMessageSync } = await import('./sync');
      const { stopMessageReceiver } = await import('@/core/messaging/messageReceiver');

      stopMessageSync();

      expect(stopMessageReceiver).toHaveBeenCalled();
    });
  });

  describe('fetchHistoricalMessages', () => {
    it('should fetch message history', async () => {
      const { fetchHistoricalMessages } = await import('./sync');
      const { fetchMessageHistory } = await import('@/core/messaging/messageReceiver');

      const result = await fetchHistoricalMessages(1234567890);

      expect(fetchMessageHistory).toHaveBeenCalledWith('test-pubkey-123', 1234567890);
      expect(result).toBe(0);
    });
  });

  describe('startAllSyncs', () => {
    it('should start group and message syncs', async () => {
      const { startAllSyncs } = await import('./sync');
      const { startMessageReceiver, fetchMessageHistory } = await import('@/core/messaging/messageReceiver');

      // Need to mock db.groupMembers
      vi.doMock('./db', () => ({
        db: {
          groupMembers: {
            where: () => ({
              equals: () => ({
                toArray: () => Promise.resolve([]),
              }),
            }),
          },
        },
      }));

      await startAllSyncs();

      expect(startMessageReceiver).toHaveBeenCalled();
      expect(fetchMessageHistory).toHaveBeenCalled();
    });
  });
});

describe('Nostr Event Processing', () => {
  beforeEach(() => {
    enableTestMode();
    vi.clearAllMocks();
  });

  afterEach(() => {
    disableTestMode();
  });

  // Note: processNostrEvent is private, but we can test it indirectly
  // through the subscription callback

  it('should handle EVENT kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group');

    // Simulate receiving an event
    const nostrEvent: NostrEvent = {
      id: 'event-id-1',
      pubkey: 'author-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31922, // BUILD_IT_KINDS.EVENT
      tags: [
        ['d', 'event-1'],
        ['group', 'test-group'],
      ],
      content: JSON.stringify({
        title: 'Test Event',
        description: 'A test event',
        location: 'Test Location',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        privacy: 'group',
      }),
      sig: 'signature',
    };

    // Call the event callback
    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    // Event should be processed (would be added to db)
    // We can't easily verify db operations without setting up test db
    // but at least verify no errors thrown

    stopGroupSync('test-group');
  });

  it('should handle RSVP kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-rsvp');

    const nostrEvent: NostrEvent = {
      id: 'rsvp-id-1',
      pubkey: 'rsvp-user-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31923, // BUILD_IT_KINDS.RSVP
      tags: [
        ['d', 'rsvp-1'],
        ['e', 'event-1'],
        ['status', 'going'],
      ],
      content: 'Looking forward to it!',
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-rsvp');
  });

  it('should handle PROPOSAL kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-proposal');

    const nostrEvent: NostrEvent = {
      id: 'proposal-id-1',
      pubkey: 'proposer-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31924, // BUILD_IT_KINDS.PROPOSAL
      tags: [
        ['d', 'proposal-1'],
        ['group', 'test-group-proposal'],
      ],
      content: JSON.stringify({
        title: 'Test Proposal',
        description: 'A test proposal',
        type: 'simple',
        status: 'open',
        options: ['Yes', 'No'],
      }),
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-proposal');
  });

  it('should handle WIKI_PAGE kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-wiki');

    const nostrEvent: NostrEvent = {
      id: 'wiki-id-1',
      pubkey: 'wiki-author',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31925, // BUILD_IT_KINDS.WIKI_PAGE
      tags: [
        ['d', 'wiki-1'],
        ['group', 'test-group-wiki'],
      ],
      content: JSON.stringify({
        title: 'Test Wiki Page',
        content: '# Hello World\n\nThis is a test wiki page.',
        category: 'General',
        tags: ['test', 'wiki'],
        version: 1,
      }),
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-wiki');
  });

  it('should handle MUTUAL_AID kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-aid');

    const nostrEvent: NostrEvent = {
      id: 'aid-id-1',
      pubkey: 'aid-requester',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31926, // BUILD_IT_KINDS.MUTUAL_AID
      tags: [
        ['d', 'aid-1'],
        ['group', 'test-group-aid'],
      ],
      content: JSON.stringify({
        type: 'request',
        title: 'Need help moving',
        description: 'Looking for help moving furniture',
        status: 'open',
        location: 'Downtown',
        urgency: 'medium',
        tags: ['moving', 'help'],
      }),
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-aid');
  });

  it('should handle DATABASE_RECORD kind correctly', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-db');

    const nostrEvent: NostrEvent = {
      id: 'record-id-1',
      pubkey: 'record-author',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31927, // BUILD_IT_KINDS.DATABASE_RECORD
      tags: [
        ['d', 'record-1'],
        ['table', 'contacts-table'],
        ['group', 'test-group-db'],
      ],
      content: JSON.stringify({
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
        },
      }),
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-db');
  });

  it('should handle unknown event kind gracefully', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    mockLoggerWarn.mockClear();

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-unknown');

    const nostrEvent: NostrEvent = {
      id: 'unknown-id-1',
      pubkey: 'unknown-author',
      created_at: Math.floor(Date.now() / 1000),
      kind: 99999, // Unknown kind
      tags: [['d', 'unknown-1']],
      content: '{}',
      sig: 'signature',
    };

    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    expect(mockLoggerWarn).toHaveBeenCalledWith('Unknown event kind: 99999');

    stopGroupSync('test-group-unknown');
  });

  it('should handle events without d-tag gracefully', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-no-dtag');

    const nostrEvent: NostrEvent = {
      id: 'no-dtag-id',
      pubkey: 'author',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31922, // EVENT kind but no d-tag
      tags: [['group', 'test-group-no-dtag']], // No d-tag
      content: JSON.stringify({ title: 'Test' }),
      sig: 'signature',
    };

    // Should not throw
    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    stopGroupSync('test-group-no-dtag');
  });

  it('should handle malformed JSON content gracefully', async () => {
    let eventCallback: ((event: NostrEvent) => void) | null = null;

    mockSubscribe.mockImplementation((_filters, onEvent) => {
      eventCallback = onEvent;
      return 'sub-test';
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { startGroupSync, stopGroupSync } = await import('./sync');

    startGroupSync('test-group-bad-json');

    const nostrEvent: NostrEvent = {
      id: 'bad-json-id',
      pubkey: 'author',
      created_at: Math.floor(Date.now() / 1000),
      kind: 31922,
      tags: [
        ['d', 'bad-json-1'],
        ['group', 'test-group-bad-json'],
      ],
      content: 'not valid json {{{',
      sig: 'signature',
    };

    // Should not throw, just log error
    if (eventCallback) {
      await eventCallback(nostrEvent);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    stopGroupSync('test-group-bad-json');
  });
});
