import { describe, it, expect } from 'vitest';
import { fuzzySearch, fuzzyMatch } from '../fuzzySearch';

describe('fuzzySearch', () => {
  const testItems = [
    { id: '1', name: 'Alice Johnson', searchTerms: ['Alice Johnson', 'Alice', 'Johnson'] },
    { id: '2', name: 'Bob Smith', searchTerms: ['Bob Smith', 'Bob', 'Smith'] },
    { id: '3', name: 'Charlie Brown', searchTerms: ['Charlie Brown', 'Charlie', 'Brown'] },
    { id: '4', name: 'David Miller', searchTerms: ['David Miller', 'David', 'Miller'] },
    { id: '5', name: 'Alice Cooper', searchTerms: ['Alice Cooper', 'Alice', 'Cooper'] },
  ];

  describe('fuzzySearch', () => {
    it('should find exact matches', () => {
      const results = fuzzySearch('Alice', testItems);
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Alice Johnson');
      expect(results[1].name).toBe('Alice Cooper');
    });

    it('should find case-insensitive matches', () => {
      const results = fuzzySearch('alice', testItems);
      expect(results).toHaveLength(2);
      expect(results[0].name).toContain('Alice');
    });

    it('should find starts-with matches', () => {
      const results = fuzzySearch('Bob', testItems);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bob Smith');
    });

    it('should find contains matches', () => {
      const results = fuzzySearch('Brown', testItems);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Charlie Brown');
    });

    it('should find fuzzy matches', () => {
      const results = fuzzySearch('Alic', testItems);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Alice');
    });

    it('should filter by threshold', () => {
      const results = fuzzySearch('xyz', testItems, 0.5);
      expect(results).toHaveLength(0);
    });

    it('should sort results by score', () => {
      const results = fuzzySearch('ali', testItems, 0.1);
      // Exact start match should score higher than fuzzy match
      expect(results[0].name).toContain('Alice');
    });

    it('should return all items for empty query', () => {
      const results = fuzzySearch('', testItems);
      expect(results).toHaveLength(5);
    });

    it('should return empty array for no matches', () => {
      const results = fuzzySearch('zzzzz', testItems);
      expect(results).toHaveLength(0);
    });
  });

  describe('fuzzyMatch', () => {
    it('should give high score for exact match', () => {
      const score = fuzzyMatch('alice', 'Alice');
      expect(score).toBeGreaterThan(0.9);
    });

    it('should give high score for starts-with match', () => {
      const score = fuzzyMatch('ali', 'Alice');
      expect(score).toBeGreaterThan(0.8);
    });

    it('should give moderate score for contains match', () => {
      const score = fuzzyMatch('lic', 'Alice');
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(0.9);
    });

    it('should give low score for fuzzy match', () => {
      const score = fuzzyMatch('aie', 'Alice');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.7);
    });

    it('should return 0 for no match', () => {
      const score = fuzzyMatch('xyz', 'Alice');
      expect(score).toBe(0);
    });

    it('should be case-insensitive', () => {
      const score1 = fuzzyMatch('alice', 'Alice');
      const score2 = fuzzyMatch('ALICE', 'alice');
      expect(score1).toBe(score2);
    });

    it('should handle empty query', () => {
      const score = fuzzyMatch('', 'Alice');
      expect(score).toBe(0);
    });

    it('should handle empty target', () => {
      const score = fuzzyMatch('alice', '');
      expect(score).toBe(0);
    });

    it('should prioritize position of match', () => {
      const score1 = fuzzyMatch('ali', 'Alice Johnson');
      const score2 = fuzzyMatch('ali', 'John Alice');
      // Match at start should score higher
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const items = [
        { id: '1', name: 'alice@example.com', searchTerms: ['alice@example.com', 'alice'] },
      ];
      const results = fuzzySearch('alice', items);
      expect(results).toHaveLength(1);
    });

    it('should handle numbers', () => {
      const items = [
        { id: '1', name: 'user123', searchTerms: ['user123', '123'] },
      ];
      const results = fuzzySearch('123', items);
      expect(results).toHaveLength(1);
    });

    it('should handle whitespace', () => {
      const items = [
        { id: '1', name: 'Alice   Johnson', searchTerms: ['Alice Johnson'] },
      ];
      const results = fuzzySearch('alice johnson', items);
      expect(results).toHaveLength(1);
    });
  });
});
