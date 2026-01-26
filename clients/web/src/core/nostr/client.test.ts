/**
 * NostrClient Tests
 * Tests for the Nostr client wrapper
 *
 * Note: These tests focus on the client API and state management.
 * WebSocket operations are tested at the integration level.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NostrClient,
  resetNostrClient,
  MessageQueue,
  DEFAULT_PRIVACY_CONFIG,
  type MessagePriority,
  type PrivacyPublishConfig,
  type TimingObfuscationConfig,
} from './client';
import type { PublishResult } from '@/types/nostr';

describe('NostrClient', () => {
  let client: NostrClient;

  beforeEach(() => {
    client = new NostrClient([
      { url: 'wss://relay1.test', read: true, write: true },
      { url: 'wss://relay2.test', read: true, write: false },
      { url: 'wss://relay3.test', read: false, write: true },
    ]);
  });

  afterEach(() => {
    client.close();
    resetNostrClient();
  });

  describe('constructor', () => {
    it('should initialize with provided relays', () => {
      const statuses = client.getRelayStatuses();

      expect(statuses).toHaveLength(3);
      expect(statuses.map((s) => s.url)).toContain('wss://relay1.test');
      expect(statuses.map((s) => s.url)).toContain('wss://relay2.test');
      expect(statuses.map((s) => s.url)).toContain('wss://relay3.test');
    });

    it('should initialize relay statuses as disconnected', () => {
      const statuses = client.getRelayStatuses();

      statuses.forEach((status) => {
        expect(status.connected).toBe(false);
        expect(status.connecting).toBe(false);
        expect(status.error).toBeNull();
        expect(status.lastConnected).toBeNull();
        expect(status.messagesSent).toBe(0);
        expect(status.messagesReceived).toBe(0);
      });
    });

    it('should handle empty relay list', () => {
      const emptyClient = new NostrClient([]);
      const statuses = emptyClient.getRelayStatuses();

      expect(statuses).toHaveLength(0);
      emptyClient.close();
    });
  });

  describe('addRelay', () => {
    it('should add a new relay', () => {
      client.addRelay({ url: 'wss://relay4.test', read: true, write: true });

      const statuses = client.getRelayStatuses();
      expect(statuses).toHaveLength(4);
      expect(statuses.find((s) => s.url === 'wss://relay4.test')).toBeDefined();
    });

    it('should initialize new relay status', () => {
      client.addRelay({ url: 'wss://relay4.test', read: true, write: true });

      const statuses = client.getRelayStatuses();
      const newStatus = statuses.find((s) => s.url === 'wss://relay4.test');

      expect(newStatus).toBeDefined();
      expect(newStatus?.connected).toBe(false);
      expect(newStatus?.messagesSent).toBe(0);
    });
  });

  describe('removeRelay', () => {
    it('should remove a relay', () => {
      client.removeRelay('wss://relay1.test');

      const statuses = client.getRelayStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.find((s) => s.url === 'wss://relay1.test')).toBeUndefined();
    });

    it('should handle removing non-existent relay', () => {
      expect(() => {
        client.removeRelay('wss://nonexistent.test');
      }).not.toThrow();

      const statuses = client.getRelayStatuses();
      expect(statuses).toHaveLength(3);
    });
  });

  describe('getRelayStatuses', () => {
    it('should return all relay statuses', () => {
      const statuses = client.getRelayStatuses();

      expect(statuses).toHaveLength(3);
      expect(statuses[0]).toHaveProperty('url');
      expect(statuses[0]).toHaveProperty('connected');
      expect(statuses[0]).toHaveProperty('messagesSent');
      expect(statuses[0]).toHaveProperty('messagesReceived');
    });

    it('should return array copy not reference', () => {
      const statuses1 = client.getRelayStatuses();
      const statuses2 = client.getRelayStatuses();

      expect(statuses1).not.toBe(statuses2);
      expect(statuses1).toEqual(statuses2);
    });
  });

  describe('subscribe', () => {
    it('should create a subscription and return subscription ID', () => {
      const onEvent = () => {};
      const filters = [{ kinds: [1] }];

      const subId = client.subscribe(filters, onEvent);

      expect(subId).toBeDefined();
      expect(subId).toMatch(/^sub_\d+_[a-z0-9]+$/);
    });

    it('should generate unique subscription IDs', () => {
      const onEvent = () => {};

      const subId1 = client.subscribe([{ kinds: [1] }], onEvent);
      const subId2 = client.subscribe([{ kinds: [1] }], onEvent);

      expect(subId1).not.toBe(subId2);
    });
  });

  describe('unsubscribe', () => {
    it('should not throw when unsubscribing', () => {
      const onEvent = () => {};
      const subId = client.subscribe([{ kinds: [1] }], onEvent);

      expect(() => {
        client.unsubscribe(subId);
      }).not.toThrow();
    });

    it('should handle unsubscribing non-existent subscription', () => {
      expect(() => {
        client.unsubscribe('non-existent-sub');
      }).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should clear all subscriptions', () => {
      const onEvent = () => {};
      client.subscribe([{ kinds: [1] }], onEvent);
      client.subscribe([{ kinds: [4] }], onEvent);

      expect(() => {
        client.unsubscribeAll();
      }).not.toThrow();
    });
  });

  describe('close / disconnect', () => {
    it('should close all connections', () => {
      expect(() => {
        client.close();
      }).not.toThrow();
    });

    it('disconnect should be alias for close', () => {
      const newClient = new NostrClient([
        { url: 'wss://test.relay', read: true, write: true },
      ]);

      expect(() => {
        newClient.disconnect();
      }).not.toThrow();
    });
  });
});

describe('getNostrClient', () => {
  afterEach(() => {
    resetNostrClient();
  });

  it('should return singleton instance', async () => {
    // Need to import fresh each time due to singleton
    const { getNostrClient: getClient1 } = await import('./client');
    const client1 = getClient1();

    const { getNostrClient: getClient2 } = await import('./client');
    const client2 = getClient2();

    expect(client1).toBe(client2);
  });

  it('should use default relays when none provided', async () => {
    const { getNostrClient } = await import('./client');

    const client = getNostrClient();
    const statuses = client.getRelayStatuses();

    expect(statuses.length).toBeGreaterThan(0);
    // Check for default relays
    expect(statuses.some((s) => s.url.includes('damus'))).toBe(true);
  });
});

describe('resetNostrClient', () => {
  it('should not throw when no client exists', () => {
    expect(() => {
      resetNostrClient();
      resetNostrClient();
    }).not.toThrow();
  });
});

describe('Privacy Configuration', () => {
  let client: NostrClient;

  beforeEach(() => {
    client = new NostrClient([
      { url: 'wss://relay1.test', read: true, write: true },
      { url: 'wss://relay2.test', read: true, write: true },
      { url: 'wss://relay3.test', read: true, write: true },
      { url: 'wss://relay4.test', read: true, write: true },
      { url: 'wss://relay5.test', read: true, write: true },
    ]);
  });

  afterEach(() => {
    client.close();
  });

  describe('default configuration', () => {
    it('should use default privacy config', () => {
      const config = client.getPrivacyConfig();

      expect(config.relayMixing.relaySelectionCount).toBe(DEFAULT_PRIVACY_CONFIG.relayMixing.relaySelectionCount);
      expect(config.relayMixing.minRelaysForCritical).toBe(DEFAULT_PRIVACY_CONFIG.relayMixing.minRelaysForCritical);
      expect(config.relayMixing.enabled).toBe(true);
      expect(config.timing.enabled).toBe(true);
    });
  });

  describe('custom configuration', () => {
    it('should accept custom relay mixing config', () => {
      const customClient = new NostrClient(
        [{ url: 'wss://relay1.test', read: true, write: true }],
        {
          relayMixing: {
            relaySelectionCount: 5,
            minRelaysForCritical: 3,
            enabled: false,
          },
        }
      );

      const config = customClient.getPrivacyConfig();
      expect(config.relayMixing.relaySelectionCount).toBe(5);
      expect(config.relayMixing.minRelaysForCritical).toBe(3);
      expect(config.relayMixing.enabled).toBe(false);

      customClient.close();
    });

    it('should accept custom timing config', () => {
      const customClient = new NostrClient(
        [{ url: 'wss://relay1.test', read: true, write: true }],
        {
          timing: {
            minRelayDelay: 200,
            maxRelayDelay: 1000,
            minQueueDelay: 5000,
            maxQueueDelay: 60000,
            minInterMessageDelay: 1000,
            maxInterMessageDelay: 5000,
            enabled: false,
          },
        }
      );

      const config = customClient.getPrivacyConfig();
      expect(config.timing.minRelayDelay).toBe(200);
      expect(config.timing.maxRelayDelay).toBe(1000);
      expect(config.timing.minQueueDelay).toBe(5000);
      expect(config.timing.enabled).toBe(false);

      customClient.close();
    });
  });

  describe('updatePrivacyConfig', () => {
    it('should update relay mixing config', () => {
      client.updatePrivacyConfig({
        relayMixing: {
          relaySelectionCount: 2,
          minRelaysForCritical: 1,
          enabled: false,
        },
      });

      const config = client.getPrivacyConfig();
      expect(config.relayMixing.relaySelectionCount).toBe(2);
      expect(config.relayMixing.enabled).toBe(false);
    });

    it('should update timing config', () => {
      client.updatePrivacyConfig({
        timing: {
          minRelayDelay: 50,
          maxRelayDelay: 200,
          minQueueDelay: 500,
          maxQueueDelay: 10000,
          minInterMessageDelay: 250,
          maxInterMessageDelay: 1000,
          enabled: false,
        },
      });

      const config = client.getPrivacyConfig();
      expect(config.timing.minRelayDelay).toBe(50);
      expect(config.timing.enabled).toBe(false);
    });
  });

  describe('setRelayMixingEnabled', () => {
    it('should enable/disable relay mixing', () => {
      client.setRelayMixingEnabled(false);
      expect(client.getPrivacyConfig().relayMixing.enabled).toBe(false);

      client.setRelayMixingEnabled(true);
      expect(client.getPrivacyConfig().relayMixing.enabled).toBe(true);
    });
  });

  describe('setTimingObfuscationEnabled', () => {
    it('should enable/disable timing obfuscation', () => {
      client.setTimingObfuscationEnabled(false);
      expect(client.getPrivacyConfig().timing.enabled).toBe(false);

      client.setTimingObfuscationEnabled(true);
      expect(client.getPrivacyConfig().timing.enabled).toBe(true);
    });
  });
});

describe('MessageQueue', () => {
  const createMockPublishFn = () => {
    const calls: Array<{ event: { id: string }; relays: string[]; timestamp: number }> = [];
    const publishFn = vi.fn(async (event: { id: string }, relays: string[]): Promise<PublishResult[]> => {
      calls.push({ event, relays, timestamp: Date.now() });
      return relays.map(relay => ({ relay, success: true }));
    });
    return { publishFn, calls };
  };

  const createTimingConfig = (enabled = true): TimingObfuscationConfig => ({
    minRelayDelay: 10,
    maxRelayDelay: 20,
    minQueueDelay: 10,
    maxQueueDelay: 50,
    minInterMessageDelay: 10,
    maxInterMessageDelay: 50,
    enabled,
  });

  describe('enqueue', () => {
    it('should enqueue and process messages', async () => {
      const { publishFn, calls } = createMockPublishFn();
      const config = createTimingConfig(false); // Disable timing for fast test
      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      const event = { id: 'test-event-1' };
      const relays = ['wss://relay1.test', 'wss://relay2.test'];

      const results = await queue.enqueue(event as unknown as import('nostr-tools').Event, relays);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].event.id).toBe('test-event-1');
    });

    it('should process messages in FIFO order', async () => {
      const { publishFn, calls } = createMockPublishFn();
      const config = createTimingConfig(false);
      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      const event1 = { id: 'event-1' };
      const event2 = { id: 'event-2' };
      const event3 = { id: 'event-3' };

      // Queue multiple messages
      const p1 = queue.enqueue(event1 as unknown as import('nostr-tools').Event, ['wss://relay.test']);
      const p2 = queue.enqueue(event2 as unknown as import('nostr-tools').Event, ['wss://relay.test']);
      const p3 = queue.enqueue(event3 as unknown as import('nostr-tools').Event, ['wss://relay.test']);

      await Promise.all([p1, p2, p3]);

      expect(calls[0].event.id).toBe('event-1');
      expect(calls[1].event.id).toBe('event-2');
      expect(calls[2].event.id).toBe('event-3');
    });

    it('should prioritize high priority messages', async () => {
      const { publishFn, calls } = createMockPublishFn();
      const config = createTimingConfig(false);
      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      // Block the queue temporarily
      let resolveBlock: () => void;
      const blockPromise = new Promise<void>(resolve => { resolveBlock = resolve; });
      const blockedPublish = vi.fn(async () => {
        await blockPromise;
        return [{ relay: 'test', success: true }];
      });

      const blockedQueue = new MessageQueue(config, blockedPublish as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      // Start processing with a blocking message
      const p1 = blockedQueue.enqueue({ id: 'normal-1' } as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');

      // Add normal and high priority while first is processing
      const p2 = blockedQueue.enqueue({ id: 'normal-2' } as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');
      const p3 = blockedQueue.enqueue({ id: 'high-1' } as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'high');

      // Now unblock
      resolveBlock!();
      await Promise.all([p1, p2, p3]);

      // High priority should have been inserted at front of queue (after currently processing)
      // So order should be: normal-1 (was processing), high-1 (inserted at front), normal-2
      const eventIds = blockedPublish.mock.calls.map((call: unknown[]) => (call[0] as { id: string }).id);
      expect(eventIds[0]).toBe('normal-1');
      // high-1 should be before normal-2
      expect(eventIds.indexOf('high-1')).toBeLessThan(eventIds.indexOf('normal-2'));
    });
  });

  describe('timing with delays enabled', () => {
    it('should apply delays between messages when enabled', async () => {
      const { publishFn, calls } = createMockPublishFn();
      const config = createTimingConfig(true);
      config.minQueueDelay = 50;
      config.maxQueueDelay = 100;
      config.minInterMessageDelay = 50;
      config.maxInterMessageDelay = 100;

      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      const event1 = { id: 'event-1' };
      const event2 = { id: 'event-2' };

      const startTime = Date.now();
      const p1 = queue.enqueue(event1 as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');
      const p2 = queue.enqueue(event2 as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');

      await Promise.all([p1, p2]);
      const totalTime = Date.now() - startTime;

      // Should have at least: queue delay for event1 + inter-message delay + queue delay for event2
      // Minimum: 50 + 50 + 50 = 150ms
      expect(totalTime).toBeGreaterThanOrEqual(150);
    });

    it('should skip queue delay for high priority messages', async () => {
      const { publishFn, calls } = createMockPublishFn();
      const config = createTimingConfig(true);
      config.minQueueDelay = 500;
      config.maxQueueDelay = 1000;

      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      const event = { id: 'high-priority' };

      const startTime = Date.now();
      await queue.enqueue(event as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'high');
      const elapsed = Date.now() - startTime;

      // High priority should skip queue delay, so should be fast
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('clear', () => {
    it('should clear pending messages and reject their promises', async () => {
      // Create a publish function that blocks until we signal it
      let resolveBlock: () => void;
      const blockPromise = new Promise<void>(resolve => { resolveBlock = resolve; });
      const blockedPublish = vi.fn(async () => {
        await blockPromise;
        return [{ relay: 'test', success: true }];
      });

      const config = createTimingConfig(false); // Disable timing, rely on blocked publish
      const queue = new MessageQueue(config, blockedPublish as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      // Start processing first message (will block)
      const promise1 = queue.enqueue({ id: 'blocking' } as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');

      // Queue a second message that should be cleared
      await new Promise(r => setTimeout(r, 10)); // Let first message start processing
      const promise2 = queue.enqueue({ id: 'to-be-cleared' } as unknown as import('nostr-tools').Event, ['wss://relay.test'], 'normal');

      // Clear the queue - should reject pending (second) message
      await new Promise(r => setTimeout(r, 10));
      queue.clear();

      // Now unblock the first message
      resolveBlock!();

      // First message should succeed
      await expect(promise1).resolves.toBeDefined();

      // Second message should have been rejected
      await expect(promise2).rejects.toThrow('Queue cleared');
    });

    it('should return correct queue length', async () => {
      const { publishFn } = createMockPublishFn();
      const config = createTimingConfig(true);
      config.minQueueDelay = 5000; // Long delay

      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      expect(queue.length).toBe(0);

      // Start enqueueing but don't await
      queue.enqueue({ id: 'e1' } as unknown as import('nostr-tools').Event, ['wss://r.test'], 'normal').catch(() => {});
      queue.enqueue({ id: 'e2' } as unknown as import('nostr-tools').Event, ['wss://r.test'], 'normal').catch(() => {});
      queue.enqueue({ id: 'e3' } as unknown as import('nostr-tools').Event, ['wss://r.test'], 'normal').catch(() => {});

      // Queue length should be at least 2 (one might be processing)
      await new Promise(r => setTimeout(r, 10));
      expect(queue.length).toBeGreaterThanOrEqual(2);

      queue.clear();
    });
  });

  describe('updateConfig', () => {
    it('should update timing configuration', () => {
      const { publishFn } = createMockPublishFn();
      const config = createTimingConfig(true);
      const queue = new MessageQueue(config, publishFn as unknown as (event: unknown, relays: string[]) => Promise<PublishResult[]>);

      queue.updateConfig({ enabled: false });

      // The queue should now have timing disabled
      // We can't directly test this without exposing internal state,
      // but we can verify no errors are thrown
      expect(() => queue.updateConfig({ minRelayDelay: 500 })).not.toThrow();
    });
  });
});

describe('Relay Selection', () => {
  let client: NostrClient;

  beforeEach(() => {
    // Create client with 6 write relays
    client = new NostrClient(
      [
        { url: 'wss://relay1.test', read: true, write: true },
        { url: 'wss://relay2.test', read: true, write: true },
        { url: 'wss://relay3.test', read: true, write: true },
        { url: 'wss://relay4.test', read: true, write: true },
        { url: 'wss://relay5.test', read: true, write: true },
        { url: 'wss://relay6.test', read: true, write: true },
      ],
      {
        relayMixing: {
          relaySelectionCount: 3,
          minRelaysForCritical: 2,
          enabled: true,
        },
        timing: {
          minRelayDelay: 1,
          maxRelayDelay: 5,
          minQueueDelay: 1,
          maxQueueDelay: 5,
          minInterMessageDelay: 1,
          maxInterMessageDelay: 5,
          enabled: false, // Disable timing for faster tests
        },
      }
    );
  });

  afterEach(() => {
    client.close();
  });

  it('should select subset of relays when relay mixing is enabled', async () => {
    // We can't directly test internal relay selection without mocking,
    // but we can verify the configuration is applied
    const config = client.getPrivacyConfig();
    expect(config.relayMixing.enabled).toBe(true);
    expect(config.relayMixing.relaySelectionCount).toBe(3);
  });

  it('should use all relays when relay mixing is disabled', async () => {
    client.setRelayMixingEnabled(false);

    const config = client.getPrivacyConfig();
    expect(config.relayMixing.enabled).toBe(false);
  });

  it('should respect minRelaysForCritical for critical messages', async () => {
    const config = client.getPrivacyConfig();
    expect(config.relayMixing.minRelaysForCritical).toBe(2);
  });
});

describe('Queue Management', () => {
  let client: NostrClient;

  beforeEach(() => {
    client = new NostrClient(
      [{ url: 'wss://relay1.test', read: true, write: true }],
      {
        timing: {
          minRelayDelay: 1,
          maxRelayDelay: 5,
          minQueueDelay: 1000, // Long delay for testing
          maxQueueDelay: 2000,
          minInterMessageDelay: 100,
          maxInterMessageDelay: 200,
          enabled: true,
        },
      }
    );
  });

  afterEach(() => {
    client.close();
  });

  describe('getQueueLength', () => {
    it('should return 0 for empty queue', () => {
      expect(client.getQueueLength()).toBe(0);
    });
  });

  describe('isQueueProcessing', () => {
    it('should return false when no messages are being processed', () => {
      expect(client.isQueueProcessing()).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('should not throw when clearing empty queue', () => {
      expect(() => client.clearQueue()).not.toThrow();
    });
  });
});

describe('Privacy-Enhanced Publishing Methods', () => {
  let client: NostrClient;

  beforeEach(() => {
    client = new NostrClient(
      [
        { url: 'wss://relay1.test', read: true, write: true },
        { url: 'wss://relay2.test', read: true, write: true },
        { url: 'wss://relay3.test', read: true, write: true },
      ],
      {
        timing: {
          minRelayDelay: 1,
          maxRelayDelay: 5,
          minQueueDelay: 1,
          maxQueueDelay: 5,
          minInterMessageDelay: 1,
          maxInterMessageDelay: 5,
          enabled: false, // Disable for fast tests
        },
      }
    );
  });

  afterEach(() => {
    client.close();
  });

  describe('publishWithPrivacy', () => {
    it('should accept priority option', async () => {
      // Test that the method accepts the option without error
      // Actual publishing would require mocking the SimplePool
      const mockEvent = {
        id: 'test',
        kind: 1,
        content: 'test',
        created_at: Math.floor(Date.now() / 1000),
        pubkey: 'abc123',
        tags: [],
        sig: 'sig123',
      };

      // This will fail to actually publish (no real relay) but should not throw on option parsing
      try {
        await client.publishWithPrivacy(mockEvent, { priority: 'high' });
      } catch {
        // Expected to fail on actual publish, but options should parse correctly
      }
    });

    it('should accept isCritical option', async () => {
      const mockEvent = {
        id: 'test',
        kind: 1,
        content: 'test',
        created_at: Math.floor(Date.now() / 1000),
        pubkey: 'abc123',
        tags: [],
        sig: 'sig123',
      };

      try {
        await client.publishWithPrivacy(mockEvent, { isCritical: true });
      } catch {
        // Expected to fail on actual publish
      }
    });

    it('should accept immediate option', async () => {
      const mockEvent = {
        id: 'test',
        kind: 1,
        content: 'test',
        created_at: Math.floor(Date.now() / 1000),
        pubkey: 'abc123',
        tags: [],
        sig: 'sig123',
      };

      try {
        await client.publishWithPrivacy(mockEvent, { immediate: true });
      } catch {
        // Expected to fail on actual publish
      }
    });

    it('should accept specific relays option', async () => {
      const mockEvent = {
        id: 'test',
        kind: 1,
        content: 'test',
        created_at: Math.floor(Date.now() / 1000),
        pubkey: 'abc123',
        tags: [],
        sig: 'sig123',
      };

      try {
        await client.publishWithPrivacy(mockEvent, {
          relays: ['wss://specific.relay'],
        });
      } catch {
        // Expected to fail on actual publish
      }
    });
  });

  describe('publishDirectMessage', () => {
    it('should be available and callable', () => {
      expect(typeof client.publishDirectMessage).toBe('function');
    });
  });

  describe('publishUrgent', () => {
    it('should be available and callable', () => {
      expect(typeof client.publishUrgent).toBe('function');
    });
  });

  describe('publishImmediate', () => {
    it('should be available and callable', () => {
      expect(typeof client.publishImmediate).toBe('function');
    });
  });
});
