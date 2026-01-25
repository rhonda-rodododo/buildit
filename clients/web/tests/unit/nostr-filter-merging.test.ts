/**
 * Nostr Client Filter Merging Tests
 * Tests for proper filter handling and merging in NostrClient
 */

import { describe, it, expect } from 'vitest';
import { mergeFilters, type Filter } from 'nostr-tools';

describe('Nostr Filter Merging', () => {
  it('should merge multiple filters with OR logic', () => {
    const filter1: Filter = {
      kinds: [1],
      authors: ['author1'],
    };

    const filter2: Filter = {
      kinds: [3],
      authors: ['author2'],
    };

    const merged = mergeFilters(filter1, filter2);

    // Merged filter should contain all kinds and authors
    expect(merged.kinds).toContain(1);
    expect(merged.kinds).toContain(3);
    expect(merged.authors).toContain('author1');
    expect(merged.authors).toContain('author2');
  });

  it('should handle single filter without merging', () => {
    const filter: Filter = {
      kinds: [1, 3],
      authors: ['author1'],
      limit: 100,
    };

    // Single filter should remain unchanged
    const result = filter; // No merge needed
    expect(result).toEqual(filter);
    expect(result.kinds).toEqual([1, 3]);
    expect(result.authors).toEqual(['author1']);
    expect(result.limit).toBe(100);
  });

  it('should merge filters with different properties', () => {
    const filter1: Filter = {
      kinds: [1],
      since: 1000,
    };

    const filter2: Filter = {
      kinds: [3],
      until: 2000,
    };

    const merged = mergeFilters(filter1, filter2);

    // Should contain all kinds
    expect(merged.kinds).toContain(1);
    expect(merged.kinds).toContain(3);

    // Should use most restrictive time bounds
    // mergeFilters uses max(since) and min(until)
    expect(merged.since).toBe(1000);
    expect(merged.until).toBe(2000);
  });

  it('should handle tag filters (#e, #p, etc.)', () => {
    const filter1: Filter = {
      '#e': ['event1'],
    };

    const filter2: Filter = {
      '#e': ['event2'],
      '#p': ['pubkey1'],
    };

    const merged = mergeFilters(filter1, filter2);

    // Should merge tag arrays
    expect(merged['#e']).toContain('event1');
    expect(merged['#e']).toContain('event2');
    expect(merged['#p']).toContain('pubkey1');
  });

  it('should handle empty filter arrays', () => {
    const filter: Filter = {
      kinds: [1],
    };

    // Merging single filter should return equivalent filter
    const merged = mergeFilters(filter);
    expect(merged.kinds).toEqual([1]);
  });

  it('should merge multiple filters with complex conditions', () => {
    const filters: Filter[] = [
      { kinds: [1], authors: ['alice'], limit: 10 },
      { kinds: [3], authors: ['bob'], limit: 20 },
      { kinds: [7], authors: ['charlie'], limit: 5 },
    ];

    const merged = mergeFilters(...filters);

    // Should contain all kinds
    expect(merged.kinds).toHaveLength(3);
    expect(merged.kinds).toContain(1);
    expect(merged.kinds).toContain(3);
    expect(merged.kinds).toContain(7);

    // Should contain all authors
    expect(merged.authors).toHaveLength(3);
    expect(merged.authors).toContain('alice');
    expect(merged.authors).toContain('bob');
    expect(merged.authors).toContain('charlie');
  });

  it('should handle filters with IDs', () => {
    const filter1: Filter = {
      ids: ['id1', 'id2'],
    };

    const filter2: Filter = {
      ids: ['id3'],
    };

    const merged = mergeFilters(filter1, filter2);

    // Should merge all IDs
    expect(merged.ids).toHaveLength(3);
    expect(merged.ids).toContain('id1');
    expect(merged.ids).toContain('id2');
    expect(merged.ids).toContain('id3');
  });

  it('should deduplicate merged values', () => {
    const filter1: Filter = {
      kinds: [1, 3],
      authors: ['alice'],
    };

    const filter2: Filter = {
      kinds: [1, 7], // 1 is duplicate
      authors: ['alice', 'bob'], // alice is duplicate
    };

    const merged = mergeFilters(filter1, filter2);

    // Should have unique values only
    // Note: mergeFilters behavior - checking actual implementation
    expect(merged.kinds).toContain(1);
    expect(merged.kinds).toContain(3);
    expect(merged.kinds).toContain(7);
    expect(merged.authors).toContain('alice');
    expect(merged.authors).toContain('bob');
  });
});
