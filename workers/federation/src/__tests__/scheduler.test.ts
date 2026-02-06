/**
 * SchedulerBridge tests
 *
 * These tests verify the scheduling functionality works correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchedulerBridge } from '../scheduler/SchedulerBridge';
import type { Env, NostrEvent } from '../types';

// Mock implementations for testing
const createMockEnv = (): Env => {
  const mockDB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    }),
  };

  return {
    FEDERATION_DB: mockDB as any,
    FEDERATION_KV: {} as any,
    FEDERATION_QUEUE: {
      send: async () => {},
    } as any,
    FEDERATION_BRIDGE: {} as any,
    SCHEDULER_BRIDGE: {} as any,
    ENVIRONMENT: 'test',
    FEDERATION_DOMAIN: 'test.localhost',
    RELAY_URL: 'ws://localhost:8787',
  };
};

const createMockState = (): DurableObjectState => {
  return {
    storage: {
      setAlarm: async () => {},
      deleteAlarm: async () => {},
    },
  } as any;
};

const createMockEvent = (pubkey: string): NostrEvent => ({
  id: 'test-event-id',
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Test scheduled post',
  sig: 'test-signature',
});

describe('SchedulerBridge', () => {
  let scheduler: SchedulerBridge;
  let env: Env;
  let state: DurableObjectState;

  beforeEach(() => {
    env = createMockEnv();
    state = createMockState();
    scheduler = new SchedulerBridge(state, env);
  });

  it('should reject scheduling with invalid pubkey', async () => {
    const request = new Request('https://test/schedule', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-id',
        nostrEvent: createMockEvent('invalid-pubkey'),
        scheduledAt: Date.now() + 60000,
      }),
    });

    const response = await scheduler.fetch(request);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('Invalid pubkey');
  });

  it('should reject scheduling in the past', async () => {
    const validPubkey = '0'.repeat(64);
    const request = new Request('https://test/schedule', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-id',
        nostrEvent: createMockEvent(validPubkey),
        scheduledAt: Date.now() - 60000, // Past time
      }),
    });

    const response = await scheduler.fetch(request);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('must be in the future');
  });

  it('should reject unsigned events', async () => {
    const validPubkey = '0'.repeat(64);
    const event = createMockEvent(validPubkey);
    delete (event as any).sig;

    const request = new Request('https://test/schedule', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-id',
        nostrEvent: event,
        scheduledAt: Date.now() + 60000,
      }),
    });

    const response = await scheduler.fetch(request);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('pre-signed');
  });

  it('should return 404 for unknown routes', async () => {
    const request = new Request('https://test/unknown', {
      method: 'GET',
    });

    const response = await scheduler.fetch(request);
    expect(response.status).toBe(404);
  });

  it('should validate pubkey format in status endpoint', async () => {
    const request = new Request('https://test/schedule/status?pubkey=invalid', {
      method: 'GET',
    });

    const response = await scheduler.fetch(request);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('Invalid pubkey');
  });
});
