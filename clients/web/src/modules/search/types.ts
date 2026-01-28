/**
 * Search Module Types
 * E2EE-respecting client-side search with semantic capabilities
 *
 * NOTE: These types are designed to align with the protocol schema at:
 * protocol/schemas/modules/search/v1.json
 *
 * After schema changes, run `bun run codegen` to verify compatibility.
 * The generated types should be structurally compatible with these definitions.
 *
 * @version 1.0.0 - aligned with protocol schema v1
 */

import type { ModuleType } from '@/types/modules';

/** Schema version for search module types */
export const SEARCH_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Search Scope
// ============================================================================

/**
 * Defines the scope of a search query
 */
export type SearchScope =
  | { type: 'global' }                                    // All accessible groups
  | { type: 'group'; groupId: string }                   // Single group
  | { type: 'module'; moduleType: ModuleType }           // One module, all groups
  | { type: 'module-in-group'; moduleType: ModuleType; groupId: string };

/**
 * Scope presets for quick selection
 */
export type SearchScopePreset = 'global' | 'current-group' | 'current-module';

// ============================================================================
// Search Documents & Results
// ============================================================================

/**
 * A document indexed for search
 * This is the internal representation stored in the search index
 */
export interface SearchDocument {
  /** Unique document ID (format: moduleType:entityId) */
  id: string;

  /** Source module type */
  moduleType: ModuleType;

  /** Original entity ID in the source module */
  entityId: string;

  /** Group this document belongs to */
  groupId: string;

  /** Searchable title/name */
  title: string;

  /** Searchable content body */
  content: string;

  /** Tags associated with this document */
  tags: string[];

  /** Short excerpt for display */
  excerpt: string;

  /** When the source entity was created */
  createdAt: number;

  /** When the source entity was last updated */
  updatedAt: number;

  /** Author/creator pubkey */
  authorPubkey?: string;

  /** Module-specific facets for filtering */
  facets: Record<string, FacetValue>;

  /** TF-IDF vector for semantic search (sparse representation) */
  vector?: SparseVector;

  /** When this document was indexed */
  indexedAt: number;
}

/**
 * Facet value types
 */
export type FacetValue =
  | string
  | number
  | boolean
  | string[]
  | { min: number; max: number };

/**
 * Sparse vector representation for TF-IDF
 * Maps term index to weight
 */
export type SparseVector = Record<number, number>;

/**
 * A search result with relevance scoring
 */
export interface SearchResult {
  /** The matching document */
  document: SearchDocument;

  /** Relevance score (higher is better) */
  score: number;

  /** Matched terms for highlighting */
  matchedTerms: string[];

  /** Matched field names */
  matchedFields: string[];

  /** Highlighted excerpt with match markers */
  highlightedExcerpt?: string;
}

/**
 * Aggregated search results
 */
export interface SearchResults {
  /** Matching results */
  results: SearchResult[];

  /** Total count (may exceed results.length for pagination) */
  totalCount: number;

  /** Facet counts for filtering */
  facetCounts: FacetCounts;

  /** Search execution time in ms */
  searchTimeMs: number;

  /** Query that produced these results */
  query: ParsedQuery;
}

// ============================================================================
// Query Parsing
// ============================================================================

/**
 * Parsed and normalized search query
 */
export interface ParsedQuery {
  /** Original raw query string */
  raw: string;

  /** Extracted keywords (stemmed) */
  keywords: string[];

  /** Exact phrase matches (quoted) */
  phrases: string[];

  /** Expanded synonyms */
  expandedTerms: string[];

  /** Detected filters from query syntax */
  filters: QueryFilter[];

  /** Detected intent (if any) */
  intent?: QueryIntent;

  /** Active scope */
  scope: SearchScope;
}

/**
 * Filter extracted from query
 */
export interface QueryFilter {
  /** Filter field (e.g., 'author', 'date', 'tag') */
  field: string;

  /** Filter operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'range';

  /** Filter value */
  value: FacetValue;
}

/**
 * Detected query intent for semantic handling
 */
export interface QueryIntent {
  /** Intent type */
  type: 'temporal' | 'author' | 'status' | 'location' | 'category';

  /** Parsed parameters */
  params: Record<string, unknown>;
}

// ============================================================================
// Faceted Search
// ============================================================================

/**
 * Facet definition for a module
 */
export interface FacetDefinition {
  /** Facet key */
  key: string;

  /** Display label */
  label: string;

  /** Facet type */
  type: 'keyword' | 'range' | 'date' | 'boolean' | 'hierarchy';

  /** For hierarchical facets, the parent facet key */
  parentKey?: string;

  /** Whether multiple values can be selected */
  multiSelect: boolean;
}

/**
 * Aggregated facet counts
 */
export interface FacetCounts {
  /** Module type distribution */
  moduleType: Record<ModuleType, number>;

  /** Group distribution */
  groups: Record<string, number>;

  /** Tag distribution */
  tags: Record<string, number>;

  /** Date histogram (by day) */
  dates: Record<string, number>;

  /** Author distribution */
  authors: Record<string, number>;

  /** Module-specific facets */
  custom: Record<string, Record<string, number>>;
}

/**
 * Active facet filters
 */
export interface FacetFilters {
  moduleTypes?: ModuleType[];
  groupIds?: string[];
  tags?: string[];
  dateRange?: { start: number; end: number };
  authors?: string[];
  custom?: Record<string, FacetValue[]>;
}

// ============================================================================
// Tags
// ============================================================================

/**
 * User-defined tag
 */
export interface Tag {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  color?: string;
  /** Parent tag ID for hierarchical tags */
  parentTagId?: string;
  /** Number of entities using this tag */
  usageCount: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
}

/**
 * Tag hierarchy with children
 */
export interface TagWithChildren extends Tag {
  children: TagWithChildren[];
}

/**
 * Entity-tag association
 */
export interface EntityTag {
  id: string;
  entityType: ModuleType;
  entityId: string;
  tagId: string;
  groupId: string;
  createdAt: number;
  createdBy: string;
}

// ============================================================================
// Saved & Recent Searches
// ============================================================================

/**
 * Saved search query
 */
export interface SavedSearch {
  id: string;
  userPubkey: string;
  name: string;
  query: string;
  scope: SearchScope;
  filters: FacetFilters;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

/**
 * Recent search entry
 */
export interface RecentSearch {
  id: string;
  userPubkey: string;
  query: string;
  scope: SearchScope;
  timestamp: number;
  resultCount: number;
}

// ============================================================================
// Module Search Provider
// ============================================================================

/**
 * Interface for modules to provide searchable content
 */
export interface ModuleSearchProvider {
  /** Module type this provider handles */
  moduleType: ModuleType;

  /**
   * Index an entity from this module
   * Called when entities are created/updated
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null;

  /**
   * Build facet definitions for this module
   */
  getFacetDefinitions(): FacetDefinition[];

  /**
   * Format a search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult;

  /**
   * Enhance query with module-specific understanding
   */
  enhanceQuery?(query: ParsedQuery): ParsedQuery;

  /**
   * Get entities for reindexing
   */
  getIndexableEntities(groupId: string): Promise<unknown[]>;
}

/**
 * Formatted search result for UI display
 */
export interface FormattedSearchResult {
  /** Display title */
  title: string;

  /** Subtitle/metadata line */
  subtitle?: string;

  /** Icon name from lucide-react */
  icon: string;

  /** Navigation path */
  path: string;

  /** Preview content */
  preview?: string;

  /** Timestamp for display */
  timestamp?: number;

  /** Badge labels */
  badges?: Array<{ label: string; variant?: 'default' | 'secondary' | 'outline' }>;
}

// ============================================================================
// Search Engine State
// ============================================================================

/**
 * Search engine status
 */
export type SearchEngineStatus = 'idle' | 'indexing' | 'searching' | 'error';

/**
 * Index statistics
 */
export interface IndexStats {
  /** Total documents indexed */
  totalDocuments: number;

  /** Documents by module type */
  byModuleType: Record<ModuleType, number>;

  /** Documents by group */
  byGroup: Record<string, number>;

  /** Total unique terms */
  uniqueTerms: number;

  /** Index size estimate in bytes */
  sizeBytes: number;

  /** Last full reindex time */
  lastFullReindex?: number;

  /** Last incremental update time */
  lastIncrementalUpdate?: number;
}

/**
 * Search options for fine-tuning
 */
export interface SearchOptions {
  /** Maximum results to return */
  limit?: number;

  /** Results to skip (pagination) */
  offset?: number;

  /** Enable fuzzy matching */
  fuzzy?: boolean;

  /** Fuzzy match threshold (0-1) */
  fuzzyThreshold?: number;

  /** Enable prefix matching */
  prefix?: boolean;

  /** Field boost weights */
  boost?: Record<string, number>;

  /** Enable semantic/TF-IDF search */
  semantic?: boolean;

  /** Semantic search weight (0-1), default 0.3 */
  semanticWeight?: number;

  /** Highlight matched terms */
  highlight?: boolean;
}

// ============================================================================
// TF-IDF / Semantic Search
// ============================================================================

/**
 * Term frequency data for a document
 */
export interface TermFrequency {
  term: string;
  count: number;
  frequency: number;
}

/**
 * Document statistics for IDF calculation
 */
export interface DocumentStats {
  /** Total number of documents */
  totalDocuments: number;

  /** Number of documents containing each term */
  documentFrequency: Record<string, number>;

  /** Average document length */
  avgDocLength: number;
}

/**
 * Concept expansion mappings for organizing contexts
 */
export interface ConceptExpansion {
  /** Primary term */
  term: string;

  /** Related/synonym terms */
  synonyms: string[];

  /** Broader concept */
  broader?: string;

  /** Narrower concepts */
  narrower?: string[];
}
