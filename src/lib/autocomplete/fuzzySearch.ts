/**
 * Simple fuzzy matching algorithm
 * Returns a score between 0 and 1, where 1 is a perfect match
 */
export function fuzzyMatch(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;

  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  // Exact match
  if (haystackLower === needleLower) return 1;

  // Starts with
  if (haystackLower.startsWith(needleLower)) return 0.9;

  // Contains
  if (haystackLower.includes(needleLower)) return 0.7;

  // Fuzzy match - all characters in order
  let needleIdx = 0;
  let haystackIdx = 0;
  let matches = 0;

  while (needleIdx < needleLower.length && haystackIdx < haystackLower.length) {
    if (needleLower[needleIdx] === haystackLower[haystackIdx]) {
      matches++;
      needleIdx++;
    }
    haystackIdx++;
  }

  if (needleIdx === needleLower.length) {
    return (matches / haystackLower.length) * 0.5;
  }

  return 0;
}

export interface SearchableItem {
  id: string;
  searchTerms: string[];
}

export function fuzzySearch<T extends SearchableItem>(
  query: string,
  items: T[],
  threshold: number = 0.3
): T[] {
  if (!query) return items;

  const results = items
    .map((item) => {
      const maxScore = Math.max(
        ...item.searchTerms.map((term) => fuzzyMatch(query, term))
      );
      return { item, score: maxScore };
    })
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);

  return results;
}
