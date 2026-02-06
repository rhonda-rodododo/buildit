/**
 * Event filter tests — privacy enforcement
 *
 * These tests are CRITICAL: they verify that encrypted, private,
 * and group-only content is NEVER federated.
 */

import { describe, it, expect } from 'vitest';
import { shouldFederateEvent } from '../bridge/eventFilter';
import type { NostrEvent } from '../types';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344',
    pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Hello world',
    sig: 'deadbeef',
    ...overrides,
  };
}

describe('shouldFederateEvent', () => {
  // ========== ALLOWED ==========

  it('allows public kind:1 (short note)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 1 }))).toBe(true);
  });

  it('allows public kind:30023 (long-form article)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 30023 }))).toBe(true);
  });

  it('allows kind:0 (profile metadata)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 0 }))).toBe(true);
  });

  it('allows kind:5 (deletion) with targets', () => {
    expect(
      shouldFederateEvent(
        makeEvent({
          kind: 5,
          tags: [['e', 'someeventid']],
        }),
      ),
    ).toBe(true);
  });

  it('allows kind:1 with explicit public visibility tag', () => {
    expect(
      shouldFederateEvent(
        makeEvent({ tags: [['visibility', 'public']] }),
      ),
    ).toBe(true);
  });

  // ========== BLOCKED: Private event kinds ==========

  it('NEVER federates kind:4 (encrypted DM)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 4 }))).toBe(false);
  });

  it('NEVER federates kind:13 (NIP-17 seal)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 13 }))).toBe(false);
  });

  it('NEVER federates kind:14 (NIP-17 DM rumor)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 14 }))).toBe(false);
  });

  it('NEVER federates kind:1059 (NIP-17 gift wrap)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 1059 }))).toBe(false);
  });

  // ========== BLOCKED: Group events ==========

  it('NEVER federates kind:24242 (device transfer)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 24242 }))).toBe(false);
  });

  // ========== BLOCKED: Privacy markers ==========

  it('blocks events with non-public visibility tag', () => {
    expect(
      shouldFederateEvent(
        makeEvent({ tags: [['visibility', 'private']] }),
      ),
    ).toBe(false);
  });

  it('blocks events with group visibility tag', () => {
    expect(
      shouldFederateEvent(
        makeEvent({ tags: [['visibility', 'group']] }),
      ),
    ).toBe(false);
  });

  it('blocks events with group-scoped p tag', () => {
    expect(
      shouldFederateEvent(
        makeEvent({
          tags: [['p', 'somepubkey', 'relay', 'group']],
        }),
      ),
    ).toBe(false);
  });

  it('blocks events with NIP-04 encrypted content', () => {
    expect(
      shouldFederateEvent(
        makeEvent({ content: '?iv=abc123...' }),
      ),
    ).toBe(false);
  });

  it('blocks expired events', () => {
    expect(
      shouldFederateEvent(
        makeEvent({
          tags: [['expiration', String(Math.floor(Date.now() / 1000) - 3600)]],
        }),
      ),
    ).toBe(false);
  });

  // ========== BLOCKED: Unsupported kinds ==========

  it('blocks unsupported kind:3 (contact list)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 3 }))).toBe(false);
  });

  it('blocks unsupported kind:7 (reaction)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 7 }))).toBe(false);
  });

  it('blocks unsupported kind:40001 (module event)', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 40001 }))).toBe(false);
  });

  // ========== EDGE CASES ==========

  it('blocks kind:5 (deletion) without targets', () => {
    expect(shouldFederateEvent(makeEvent({ kind: 5, tags: [] }))).toBe(false);
  });

  it('allows events with future expiration', () => {
    expect(
      shouldFederateEvent(
        makeEvent({
          tags: [['expiration', String(Math.floor(Date.now() / 1000) + 3600)]],
        }),
      ),
    ).toBe(true);
  });
});
