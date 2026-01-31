/**
 * Search Coordinator Service
 * Main orchestrator for search operations across all engines
 */

import type { ModuleType } from '@/types/modules';
import type {
  SearchScope,
  SearchDocument,
  SearchResult,
  SearchResults,
  SearchOptions,
  ParsedQuery,
  FacetFilters,
  IndexStats,
  ModuleSearchProvider,
  FormattedSearchResult,
} from '../types';
import { parseQuery, isEmptyQuery } from './queryParser';
import { getMiniSearchEngine } from './miniSearchEngine';
import { getTFIDFEngine } from './tfidfEngine';
import { getFacetEngine } from './facetEngine';
import { getIndexSyncManager } from './indexSyncManager';
import { dal } from '@/core/storage/dal';
import type { DBSearchDocument } from '../schema';

// ============================================================================
// Types
// ============================================================================

interface SearchCoordinatorOptions {
  /** Default search options */
  defaultOptions?: SearchOptions;
  /** Enable semantic search by default */
  enableSemantic?: boolean;
  /** Result cache TTL in ms */
  cacheTtlMs?: number;
}

interface CacheEntry {
  results: SearchResults;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: SearchOptions = {
  limit: 50,
  offset: 0,
  fuzzy: true,
  fuzzyThreshold: 0.2,
  prefix: true,
  highlight: true,
  semantic: false,
  boost: {
    title: 2,
    content: 1,
    tags: 1.5,
  },
};

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// ============================================================================
// Search Coordinator Class
// ============================================================================

export class SearchCoordinator {
  private options: SearchCoordinatorOptions;
  private resultCache: Map<string, CacheEntry> = new Map();

  constructor(options: SearchCoordinatorOptions = {}) {
    this.options = {
      defaultOptions: { ...DEFAULT_OPTIONS, ...options.defaultOptions },
      enableSemantic: options.enableSemantic ?? false,
      cacheTtlMs: options.cacheTtlMs ?? DEFAULT_CACHE_TTL,
    };
  }

  /**
   * Perform a search
   */
  async search(
    query: string,
    scope: SearchScope,
    filters?: FacetFilters,
    options?: SearchOptions
  ): Promise<SearchResults> {
    const startTime = performance.now();

    // Merge options
    const searchOptions = {
      ...this.options.defaultOptions,
      ...options,
      semantic: options?.semantic ?? this.options.enableSemantic,
    };

    // Parse the query
    const parsedQuery = parseQuery(query, scope);

    // Check cache
    const cacheKey = this.getCacheKey(parsedQuery, filters, searchOptions);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        searchTimeMs: performance.now() - startTime,
      };
    }

    // Resolve group IDs for the scope
    const groupIds = await this.resolveGroupIds(scope);

    let results: SearchResult[];

    if (isEmptyQuery(parsedQuery)) {
      // Empty query - return recent items
      results = await this.getRecentItems(groupIds, searchOptions.limit || 50);
    } else {
      // Perform the search
      results = await this.executeSearch(parsedQuery, groupIds, searchOptions);
    }

    // Apply facet filters
    const facetEngine = getFacetEngine();
    if (filters && Object.keys(filters).length > 0) {
      results = facetEngine.applyFiltersToResults(results, filters);
    }

    // Compute facet counts
    const facetCounts = facetEngine.computeFacetCountsFromResults(results);

    // Apply pagination
    const offset = searchOptions.offset || 0;
    const limit = searchOptions.limit || 50;
    const paginatedResults = results.slice(offset, offset + limit);

    const searchResults: SearchResults = {
      results: paginatedResults,
      totalCount: results.length,
      facetCounts,
      searchTimeMs: performance.now() - startTime,
      query: parsedQuery,
    };

    // Cache the results
    this.addToCache(cacheKey, searchResults);

    return searchResults;
  }

  /**
   * Execute the actual search across engines
   */
  private async executeSearch(
    query: ParsedQuery,
    groupIds: string[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const miniSearch = getMiniSearchEngine();

    // Build the search query
    let searchQuery = '';

    // Add phrase matches
    if (query.phrases.length > 0) {
      searchQuery += query.phrases.map((p) => `"${p}"`).join(' ');
    }

    // Add expanded keywords
    if (query.expandedTerms.length > 0) {
      if (searchQuery) searchQuery += ' ';
      searchQuery += query.expandedTerms.join(' ');
    } else if (query.keywords.length > 0) {
      if (searchQuery) searchQuery += ' ';
      searchQuery += query.keywords.join(' ');
    }

    // Fall back to raw query
    if (!searchQuery) {
      searchQuery = query.raw;
    }

    // Perform MiniSearch query
    let results = miniSearch.search(searchQuery, options, groupIds);

    // Apply semantic ranking if enabled and we have results
    if (options.semantic && results.length > 0) {
      results = await this.applySemanticRanking(query, results, options);
    }

    // Apply query filters
    results = this.applyQueryFilters(results, query);

    return results;
  }

  /**
   * Apply semantic TF-IDF ranking
   */
  private async applySemanticRanking(
    query: ParsedQuery,
    results: SearchResult[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const tfidf = getTFIDFEngine();

    // Build query vector from the raw query
    const queryVector = tfidf.buildQueryVector(query.raw);

    // Load document vectors
    const documentVectors: Array<{ id: string; vector: Record<number, number> }> = [];

    for (const result of results) {
      // Get the full document with vector
      const doc = await this.loadDocumentWithVector(result.document.id);
      if (doc?.vector) {
        documentVectors.push({ id: doc.id, vector: doc.vector });
      }
    }

    if (documentVectors.length === 0) {
      return results;
    }

    // Find similar documents
    const similarities = tfidf.findSimilar(
      queryVector,
      documentVectors,
      results.length,
      0
    );

    // Create a map of similarity scores
    const simMap = new Map(similarities.map((s) => [s.id, s.similarity]));

    // Re-rank results by combining MiniSearch score with TF-IDF similarity
    // Semantic weight is configurable (default 0.3 = 30% TF-IDF, 70% full-text)
    const semanticWeight = options.semanticWeight ?? 0.3;
    const fullTextWeight = 1 - semanticWeight;

    const reranked = results.map((result) => {
      const similarity = simMap.get(result.document.id) || 0;
      const combinedScore = result.score * fullTextWeight + similarity * result.score * semanticWeight;
      return { ...result, score: combinedScore };
    });

    // Sort by combined score
    reranked.sort((a, b) => b.score - a.score);

    return reranked;
  }

  /**
   * Apply query filters extracted from the query syntax
   */
  private applyQueryFilters(
    results: SearchResult[],
    query: ParsedQuery
  ): SearchResult[] {
    if (query.filters.length === 0) {
      return results;
    }

    return results.filter((result) => {
      const doc = result.document;

      for (const filter of query.filters) {
        switch (filter.field) {
          case 'author':
            if (doc.authorPubkey !== filter.value) {
              return false;
            }
            break;

          case 'tag':
            if (!doc.tags.includes(filter.value as string)) {
              return false;
            }
            break;

          case 'moduleType':
            if (doc.moduleType !== filter.value) {
              return false;
            }
            break;

          case 'groupId':
            if (doc.groupId !== filter.value) {
              return false;
            }
            break;

          case 'date':
            const docDate = doc.createdAt;
            const filterDate = filter.value as number;

            switch (filter.operator) {
              case 'eq':
                // Same day
                if (!this.isSameDay(docDate, filterDate)) return false;
                break;
              case 'lt':
                if (docDate >= filterDate) return false;
                break;
              case 'gt':
                if (docDate <= filterDate) return false;
                break;
              case 'lte':
                if (docDate > filterDate) return false;
                break;
              case 'gte':
                if (docDate < filterDate) return false;
                break;
            }
            break;

          case 'status':
            const statusValue = doc.facets.status;
            if (statusValue !== filter.value) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }

  /**
   * Get recent items when query is empty
   */
  private async getRecentItems(
    groupIds: string[],
    limit: number
  ): Promise<SearchResult[]> {
    const docs = await dal.queryCustom<DBSearchDocument>({
      sql: `SELECT * FROM search_index WHERE group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY updated_at DESC LIMIT ?`,
      params: [...groupIds, limit],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { anyOf: (ids: string[]) => { reverse: () => { sortBy: (key: string) => Promise<DBSearchDocument[]> } } } } };
        return dexieDb.table('searchIndex').where('groupId').anyOf(groupIds).reverse().sortBy('updatedAt');
      },
    });

    const limited = docs.slice(0, limit);

    return limited.map((doc) => ({
      document: {
        id: doc.id,
        moduleType: doc.moduleType,
        entityId: doc.entityId,
        groupId: doc.groupId,
        title: doc.title,
        content: doc.content,
        tags: JSON.parse(doc.tags || '[]'),
        excerpt: doc.excerpt,
        authorPubkey: doc.authorPubkey,
        facets: JSON.parse(doc.facets || '{}'),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        indexedAt: doc.indexedAt,
      },
      score: 1,
      matchedTerms: [],
      matchedFields: [],
    }));
  }

  /**
   * Resolve group IDs for a search scope
   */
  private async resolveGroupIds(scope: SearchScope): Promise<string[]> {
    switch (scope.type) {
      case 'global': {
        // All accessible groups
        const allGroups = await dal.getAll<{ id: string }>('groups');
        return allGroups.map((g) => g.id);
      }

      case 'group':
        return [scope.groupId];

      case 'module': {
        // All groups but filter results by module type
        const groupsForModule = await dal.getAll<{ id: string }>('groups');
        return groupsForModule.map((g) => g.id);
      }

      case 'module-in-group':
        return [scope.groupId];

      default:
        return [];
    }
  }

  /**
   * Load a document with its vector
   */
  private async loadDocumentWithVector(id: string): Promise<SearchDocument | null> {
    const doc = await dal.get<DBSearchDocument>('searchIndex', id);
    if (!doc) return null;

    return {
      id: doc.id,
      moduleType: doc.moduleType,
      entityId: doc.entityId,
      groupId: doc.groupId,
      title: doc.title,
      content: doc.content,
      tags: JSON.parse(doc.tags || '[]'),
      excerpt: doc.excerpt,
      authorPubkey: doc.authorPubkey,
      facets: JSON.parse(doc.facets || '{}'),
      vector: doc.vector ? JSON.parse(doc.vector) : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      indexedAt: doc.indexedAt,
    };
  }

  /**
   * Format a search result for UI display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const syncManager = getIndexSyncManager();
    const provider = syncManager.getProvider(result.document.moduleType);

    if (provider) {
      return provider.formatResult(result);
    }

    // Default formatting
    return {
      title: result.document.title || result.document.id,
      subtitle: result.document.moduleType,
      icon: 'file',
      path: `/search/${result.document.moduleType}/${result.document.entityId}`,
      preview: result.highlightedExcerpt || result.document.excerpt,
      timestamp: result.document.updatedAt,
    };
  }

  /**
   * Get autocomplete suggestions
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    const miniSearch = getMiniSearchEngine();
    return miniSearch.suggest(query, limit);
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const syncManager = getIndexSyncManager();
    return syncManager.getStats();
  }

  /**
   * Trigger a full reindex
   */
  async reindex(groupIds?: string[]): Promise<void> {
    const syncManager = getIndexSyncManager();
    await syncManager.fullReindex(groupIds);
    this.clearCache();
  }

  /**
   * Load indexes from storage
   */
  async loadIndexes(groupIds?: string[]): Promise<void> {
    const syncManager = getIndexSyncManager();
    await syncManager.loadIndexes(groupIds);
  }

  /**
   * Register a search provider
   */
  registerProvider(provider: ModuleSearchProvider): void {
    const syncManager = getIndexSyncManager();
    syncManager.registerProvider(provider);

    // Also register facets
    const facetEngine = getFacetEngine();
    facetEngine.registerFacets(provider.moduleType, provider.getFacetDefinitions());
  }

  /**
   * Invalidate cache for a specific entity
   * Removes all cache entries that might contain this entity
   */
  invalidateCache(moduleType: ModuleType, entityId: string): void {
    const documentId = `${moduleType}:${entityId}`;

    // Remove cache entries that contain this document
    for (const [key, entry] of this.resultCache.entries()) {
      const containsDocument = entry.results.results.some(
        (result) => result.document.id === documentId
      );
      if (containsDocument) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * Clear the result cache
   */
  clearCache(): void {
    this.resultCache.clear();
  }

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  private getCacheKey(
    query: ParsedQuery,
    filters: FacetFilters | undefined,
    options: SearchOptions
  ): string {
    return JSON.stringify({
      raw: query.raw,
      scope: query.scope,
      filters,
      options: {
        limit: options.limit,
        offset: options.offset,
        semantic: options.semantic,
      },
    });
  }

  private getFromCache(key: string): SearchResults | null {
    const entry = this.resultCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > (this.options.cacheTtlMs || DEFAULT_CACHE_TTL)) {
      this.resultCache.delete(key);
      return null;
    }

    return entry.results;
  }

  private addToCache(key: string, results: SearchResults): void {
    // Enforce max cache size
    if (this.resultCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = this.resultCache.keys().next().value;
      if (oldestKey) {
        this.resultCache.delete(oldestKey);
      }
    }

    this.resultCache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Utility Helpers
  // ============================================================================

  private isSameDay(ts1: number, ts2: number): boolean {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SearchCoordinator | null = null;

/**
 * Get the singleton SearchCoordinator instance
 */
export function getSearchCoordinator(
  options?: SearchCoordinatorOptions
): SearchCoordinator {
  if (!instance) {
    instance = new SearchCoordinator(options);
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSearchCoordinator(): void {
  instance = null;
}
