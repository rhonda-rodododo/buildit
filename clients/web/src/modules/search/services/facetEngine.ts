/**
 * Facet Engine Service
 * Provides faceted filtering and aggregation for search results
 */

import type { ModuleType } from '@/types/modules';
import type {
  SearchDocument,
  FacetCounts,
  FacetFilters,
  FacetDefinition,
  SearchResult,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface DateBucket {
  start: number;
  end: number;
  label: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard facet definitions available across all modules
 */
const STANDARD_FACETS: FacetDefinition[] = [
  {
    key: 'moduleType',
    label: 'Content Type',
    type: 'keyword',
    multiSelect: true,
  },
  {
    key: 'groupId',
    label: 'Group',
    type: 'keyword',
    multiSelect: true,
  },
  {
    key: 'authorPubkey',
    label: 'Author',
    type: 'keyword',
    multiSelect: true,
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'keyword',
    multiSelect: true,
  },
  {
    key: 'createdAt',
    label: 'Date',
    type: 'date',
    multiSelect: false,
  },
];

// ============================================================================
// Facet Engine Class
// ============================================================================

export class FacetEngine {
  private customFacets: Map<ModuleType, FacetDefinition[]> = new Map();

  /**
   * Register custom facets for a module
   */
  registerFacets(moduleType: ModuleType, facets: FacetDefinition[]): void {
    this.customFacets.set(moduleType, facets);
  }

  /**
   * Get all available facets for given module types
   */
  getAvailableFacets(moduleTypes?: ModuleType[]): FacetDefinition[] {
    const facets = [...STANDARD_FACETS];

    if (moduleTypes) {
      for (const moduleType of moduleTypes) {
        const custom = this.customFacets.get(moduleType);
        if (custom) {
          facets.push(...custom);
        }
      }
    } else {
      // Include all custom facets
      for (const custom of this.customFacets.values()) {
        facets.push(...custom);
      }
    }

    // Deduplicate by key
    const seen = new Set<string>();
    return facets.filter((f) => {
      if (seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
  }

  /**
   * Apply facet filters to documents
   */
  applyFilters(documents: SearchDocument[], filters: FacetFilters): SearchDocument[] {
    if (!filters || Object.keys(filters).length === 0) {
      return documents;
    }

    return documents.filter((doc) => {
      // Module type filter
      if (filters.moduleTypes && filters.moduleTypes.length > 0) {
        if (!filters.moduleTypes.includes(doc.moduleType)) {
          return false;
        }
      }

      // Group filter
      if (filters.groupIds && filters.groupIds.length > 0) {
        if (!filters.groupIds.includes(doc.groupId)) {
          return false;
        }
      }

      // Tag filter (any matching tag)
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((tag) =>
          doc.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Author filter
      if (filters.authors && filters.authors.length > 0) {
        if (!doc.authorPubkey || !filters.authors.includes(doc.authorPubkey)) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const docDate = doc.createdAt;
        if (docDate < filters.dateRange.start || docDate > filters.dateRange.end) {
          return false;
        }
      }

      // Custom facet filters
      if (filters.custom) {
        for (const [key, values] of Object.entries(filters.custom)) {
          if (!values || values.length === 0) continue;

          const docValue = doc.facets[key];
          if (docValue === undefined) {
            return false;
          }

          // Handle different value types
          if (Array.isArray(docValue)) {
            const hasMatch = values.some((v) =>
              (docValue as string[]).includes(String(v))
            );
            if (!hasMatch) return false;
          } else {
            if (!values.includes(docValue)) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }

  /**
   * Apply filters to search results
   */
  applyFiltersToResults(results: SearchResult[], filters: FacetFilters): SearchResult[] {
    const filteredDocs = this.applyFilters(
      results.map((r) => r.document),
      filters
    );
    const filteredIds = new Set(filteredDocs.map((d) => d.id));
    return results.filter((r) => filteredIds.has(r.document.id));
  }

  /**
   * Compute facet counts for documents
   */
  computeFacetCounts(documents: SearchDocument[]): FacetCounts {
    const counts: FacetCounts = {
      moduleType: {} as Record<ModuleType, number>,
      groups: {},
      tags: {},
      dates: {},
      authors: {},
      custom: {},
    };

    for (const doc of documents) {
      // Module type
      counts.moduleType[doc.moduleType] =
        (counts.moduleType[doc.moduleType] || 0) + 1;

      // Group
      counts.groups[doc.groupId] = (counts.groups[doc.groupId] || 0) + 1;

      // Tags
      for (const tag of doc.tags) {
        counts.tags[tag] = (counts.tags[tag] || 0) + 1;
      }

      // Date (bucket by day)
      const dateKey = this.getDateBucketKey(doc.createdAt);
      counts.dates[dateKey] = (counts.dates[dateKey] || 0) + 1;

      // Author
      if (doc.authorPubkey) {
        counts.authors[doc.authorPubkey] =
          (counts.authors[doc.authorPubkey] || 0) + 1;
      }

      // Custom facets
      for (const [key, value] of Object.entries(doc.facets)) {
        if (!counts.custom[key]) {
          counts.custom[key] = {};
        }

        if (Array.isArray(value)) {
          for (const v of value) {
            const strVal = String(v);
            counts.custom[key][strVal] = (counts.custom[key][strVal] || 0) + 1;
          }
        } else if (value !== null && value !== undefined) {
          const strVal = String(value);
          counts.custom[key][strVal] = (counts.custom[key][strVal] || 0) + 1;
        }
      }
    }

    return counts;
  }

  /**
   * Compute facet counts from search results
   */
  computeFacetCountsFromResults(results: SearchResult[]): FacetCounts {
    return this.computeFacetCounts(results.map((r) => r.document));
  }

  /**
   * Get date buckets for histogram
   */
  getDateBuckets(
    documents: SearchDocument[],
    bucketSize: 'day' | 'week' | 'month' = 'day'
  ): DateBucket[] {
    if (documents.length === 0) return [];

    // Find date range
    let minDate = Infinity;
    let maxDate = -Infinity;

    for (const doc of documents) {
      if (doc.createdAt < minDate) minDate = doc.createdAt;
      if (doc.createdAt > maxDate) maxDate = doc.createdAt;
    }

    const buckets: DateBucket[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;
    let interval: number;

    switch (bucketSize) {
      case 'week':
        interval = 7 * msPerDay;
        break;
      case 'month':
        interval = 30 * msPerDay;
        break;
      default:
        interval = msPerDay;
    }

    let currentStart = this.startOfDay(new Date(minDate)).getTime();
    const end = this.startOfDay(new Date(maxDate)).getTime() + msPerDay;

    while (currentStart < end) {
      const bucketEnd = currentStart + interval;
      buckets.push({
        start: currentStart,
        end: bucketEnd,
        label: this.formatDateBucket(new Date(currentStart), bucketSize),
      });
      currentStart = bucketEnd;
    }

    return buckets;
  }

  /**
   * Merge facet counts from multiple sources
   */
  mergeFacetCounts(counts: FacetCounts[]): FacetCounts {
    const merged: FacetCounts = {
      moduleType: {} as Record<ModuleType, number>,
      groups: {},
      tags: {},
      dates: {},
      authors: {},
      custom: {},
    };

    for (const c of counts) {
      // Merge module types
      for (const [key, value] of Object.entries(c.moduleType)) {
        const moduleKey = key as ModuleType;
        merged.moduleType[moduleKey] = (merged.moduleType[moduleKey] || 0) + value;
      }

      // Merge groups
      for (const [key, value] of Object.entries(c.groups)) {
        merged.groups[key] = (merged.groups[key] || 0) + value;
      }

      // Merge tags
      for (const [key, value] of Object.entries(c.tags)) {
        merged.tags[key] = (merged.tags[key] || 0) + value;
      }

      // Merge dates
      for (const [key, value] of Object.entries(c.dates)) {
        merged.dates[key] = (merged.dates[key] || 0) + value;
      }

      // Merge authors
      for (const [key, value] of Object.entries(c.authors)) {
        merged.authors[key] = (merged.authors[key] || 0) + value;
      }

      // Merge custom
      for (const [facetKey, facetValues] of Object.entries(c.custom)) {
        if (!merged.custom[facetKey]) {
          merged.custom[facetKey] = {};
        }
        for (const [valueKey, count] of Object.entries(facetValues)) {
          merged.custom[facetKey][valueKey] =
            (merged.custom[facetKey][valueKey] || 0) + count;
        }
      }
    }

    return merged;
  }

  /**
   * Sort facet values by count
   */
  sortFacetValues(
    values: Record<string, number>,
    order: 'asc' | 'desc' = 'desc',
    limit?: number
  ): Array<{ value: string; count: number }> {
    const sorted = Object.entries(values)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => (order === 'desc' ? b.count - a.count : a.count - b.count));

    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getDateBucketKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDateBucket(
    date: Date,
    bucketSize: 'day' | 'week' | 'month'
  ): string {
    switch (bucketSize) {
      case 'month':
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
      case 'week':
        return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      default:
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: FacetEngine | null = null;

/**
 * Get the singleton FacetEngine instance
 */
export function getFacetEngine(): FacetEngine {
  if (!instance) {
    instance = new FacetEngine();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetFacetEngine(): void {
  instance = null;
}
