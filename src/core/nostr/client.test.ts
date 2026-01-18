/**
 * NostrClient Tests
 * Tests for the Nostr client wrapper
 *
 * Note: These tests focus on the client API and state management.
 * WebSocket operations are tested at the integration level.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NostrClient, resetNostrClient } from './client';

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
