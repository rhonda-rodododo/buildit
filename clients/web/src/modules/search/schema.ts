/**
 * Search Module Database Schema
 * Tables for search indexing, tags, and search history
 */

import type { TableSchema } from '@/types/modules';
import type { ModuleType } from '@/types/modules';
import type { SearchScope, FacetFilters, FacetValue, SparseVector } from './types';

// ============================================================================
// Database Types
// ============================================================================

/**
 * Search index document stored in DB
 * Content fields are encrypted at rest
 */
export interface DBSearchDocument {
  /** Unique ID (format: moduleType:entityId) */
  id: string;

  /** Source module type */
  moduleType: ModuleType;

  /** Original entity ID */
  entityId: string;

  /** Group this belongs to */
  groupId: string;

  /** Searchable title (encrypted) */
  title: string;

  /** Searchable content (encrypted) */
  content: string;

  /** Tags array (encrypted as JSON string) */
  tags: string;

  /** Short excerpt (encrypted) */
  excerpt: string;

  /** Author pubkey (not encrypted - used for filtering) */
  authorPubkey?: string;

  /** Module-specific facets (encrypted as JSON) */
  facets: string;

  /** TF-IDF vector (encrypted as JSON) */
  vector?: string;

  /** Creation timestamp of source entity */
  createdAt: number;

  /** Update timestamp of source entity */
  updatedAt: number;

  /** When this was indexed */
  indexedAt: number;
}

/**
 * User-defined tag
 */
export interface DBTag {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  color?: string;
  parentTagId?: string;
  usageCount: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
}

/**
 * Entity-tag relationship
 */
export interface DBEntityTag {
  id: string;
  entityType: ModuleType;
  entityId: string;
  tagId: string;
  groupId: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Saved search query
 */
export interface DBSavedSearch {
  id: string;
  userPubkey: string;
  name: string;
  query: string;
  /** Serialized SearchScope JSON */
  scope: string;
  /** Serialized FacetFilters JSON */
  filters: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

/**
 * Recent search entry
 */
export interface DBRecentSearch {
  id: string;
  userPubkey: string;
  query: string;
  /** Serialized SearchScope JSON */
  scope: string;
  timestamp: number;
  resultCount: number;
}

/**
 * Search index metadata/stats
 */
export interface DBSearchIndexMeta {
  id: string;
  key: string;
  value: string;
  updatedAt: number;
}

// ============================================================================
// Schema Definition
// ============================================================================

export const searchSchema: TableSchema[] = [
  {
    name: 'searchIndex',
    // Primary key is id, indexes for filtering and querying
    // Note: title, content, excerpt, facets, vector, tags are encrypted
    schema: 'id, moduleType, entityId, groupId, authorPubkey, createdAt, updatedAt, indexedAt',
    indexes: [
      'id',
      'moduleType',
      'entityId',
      'groupId',
      'authorPubkey',
      'createdAt',
      'updatedAt',
      'indexedAt',
      '[groupId+moduleType]',      // Filter by group and module
      '[groupId+authorPubkey]',    // Filter by group and author
    ],
  },
  {
    name: 'tags',
    schema: 'id, groupId, slug, parentTagId, createdAt, updatedAt',
    indexes: [
      'id',
      'groupId',
      'slug',
      'parentTagId',
      'createdAt',
      'updatedAt',
      '[groupId+slug]',            // Unique slug per group
    ],
  },
  {
    name: 'entityTags',
    schema: 'id, [entityType+entityId], tagId, groupId, createdAt',
    indexes: [
      'id',
      '[entityType+entityId]',     // Find tags for an entity
      'tagId',                      // Find entities with a tag
      'groupId',
      'createdAt',
      '[groupId+tagId]',           // Tags usage within group
    ],
  },
  {
    name: 'savedSearches',
    schema: 'id, userPubkey, name, createdAt, lastUsedAt, useCount',
    indexes: [
      'id',
      'userPubkey',
      'name',
      'createdAt',
      'lastUsedAt',
      'useCount',
      '[userPubkey+name]',         // User's saved searches
    ],
  },
  {
    name: 'recentSearches',
    schema: 'id, userPubkey, timestamp',
    indexes: [
      'id',
      'userPubkey',
      'timestamp',
      '[userPubkey+timestamp]',    // User's recent searches by time
    ],
  },
  {
    name: 'searchIndexMeta',
    schema: 'id, key, updatedAt',
    indexes: [
      'id',
      'key',
      'updatedAt',
    ],
  },
];

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize a SearchScope to JSON string
 */
export function serializeScope(scope: SearchScope): string {
  return JSON.stringify(scope);
}

/**
 * Deserialize a SearchScope from JSON string
 */
export function deserializeScope(json: string): SearchScope {
  return JSON.parse(json) as SearchScope;
}

/**
 * Serialize FacetFilters to JSON string
 */
export function serializeFilters(filters: FacetFilters): string {
  return JSON.stringify(filters);
}

/**
 * Deserialize FacetFilters from JSON string
 */
export function deserializeFilters(json: string): FacetFilters {
  return JSON.parse(json) as FacetFilters;
}

/**
 * Serialize facets record to JSON string
 */
export function serializeFacets(facets: Record<string, FacetValue>): string {
  return JSON.stringify(facets);
}

/**
 * Deserialize facets record from JSON string
 */
export function deserializeFacets(json: string): Record<string, FacetValue> {
  return JSON.parse(json) as Record<string, FacetValue>;
}

/**
 * Serialize sparse vector to JSON string
 */
export function serializeVector(vector: SparseVector): string {
  return JSON.stringify(vector);
}

/**
 * Deserialize sparse vector from JSON string
 */
export function deserializeVector(json: string): SparseVector {
  return JSON.parse(json) as SparseVector;
}

/**
 * Serialize tags array to JSON string
 */
export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

/**
 * Deserialize tags array from JSON string
 */
export function deserializeTags(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}
