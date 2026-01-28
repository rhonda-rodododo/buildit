/**
 * MiniSearch Engine Service
 * Full-text search powered by MiniSearch library
 */

import MiniSearch, { type SearchResult as MiniSearchResult, type Options as MiniSearchOptions } from 'minisearch';
import type { SearchDocument, SearchResult, SearchOptions } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface MiniSearchDocument {
  id: string;
  moduleType: string;
  entityId: string;
  groupId: string;
  title: string;
  content: string;
  tags: string;  // Space-separated for search
  excerpt: string;
  authorPubkey?: string;
  createdAt: number;
  updatedAt: number;
}

interface HighlightOptions {
  preTag: string;
  postTag: string;
  maxLength: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: MiniSearchOptions<MiniSearchDocument> = {
  fields: ['title', 'content', 'tags'],
  storeFields: ['id', 'moduleType', 'entityId', 'groupId', 'excerpt', 'authorPubkey', 'createdAt', 'updatedAt'],
  searchOptions: {
    boost: { title: 2, content: 1, tags: 1.5 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  },
  tokenize: (text: string) => {
    // Custom tokenizer that handles organizing-specific patterns
    return text
      .toLowerCase()
      .split(/[\s\-_.,;:!?()[\]{}'"#@]+/)
      .filter((token) => token.length > 1);
  },
};

const DEFAULT_HIGHLIGHT_OPTIONS: HighlightOptions = {
  preTag: '<mark>',
  postTag: '</mark>',
  maxLength: 200,
};

// ============================================================================
// MiniSearch Engine Class
// ============================================================================

export class MiniSearchEngine {
  private index: MiniSearch<MiniSearchDocument>;
  private documentCount: number = 0;

  constructor(options?: Partial<MiniSearchOptions<MiniSearchDocument>>) {
    this.index = new MiniSearch<MiniSearchDocument>({
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  /**
   * Get the number of documents in the index
   */
  get count(): number {
    return this.documentCount;
  }

  /**
   * Index a single document
   */
  addDocument(doc: SearchDocument): void {
    const miniDoc = this.toMiniSearchDocument(doc);

    // Remove existing document if present
    if (this.index.has(doc.id)) {
      this.index.discard(doc.id);
    }

    this.index.add(miniDoc);
    this.documentCount++;
  }

  /**
   * Index multiple documents
   */
  addDocuments(docs: SearchDocument[]): void {
    const miniDocs = docs.map((doc) => this.toMiniSearchDocument(doc));

    // Remove existing documents
    for (const doc of miniDocs) {
      if (this.index.has(doc.id)) {
        this.index.discard(doc.id);
        this.documentCount--;
      }
    }

    this.index.addAll(miniDocs);
    this.documentCount += miniDocs.length;
  }

  /**
   * Remove a document from the index
   */
  removeDocument(id: string): boolean {
    if (this.index.has(id)) {
      this.index.discard(id);
      this.documentCount--;
      return true;
    }
    return false;
  }

  /**
   * Update a document in the index
   */
  updateDocument(doc: SearchDocument): void {
    this.removeDocument(doc.id);
    this.addDocument(doc);
  }

  /**
   * Check if a document exists in the index
   */
  hasDocument(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * Search the index
   */
  search(
    query: string,
    options: SearchOptions = {},
    groupIds?: string[]
  ): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchOptions: Parameters<typeof this.index.search>[1] = {
      prefix: options.prefix ?? true,
      fuzzy: options.fuzzy !== false ? (options.fuzzyThreshold ?? 0.2) : false,
      boost: options.boost ?? { title: 2, content: 1, tags: 1.5 },
      combineWith: 'AND',
    };

    // Add group filter if specified
    if (groupIds && groupIds.length > 0) {
      searchOptions.filter = (result) => {
        const groupId = result.groupId as string;
        return groupIds.includes(groupId);
      };
    }

    let results: MiniSearchResult[];

    try {
      results = this.index.search(query, searchOptions);
    } catch (error) {
      logger.error('MiniSearch search error:', error);
      return [];
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const paginatedResults = results.slice(offset, offset + limit);

    // Convert to SearchResult format
    return paginatedResults.map((result) => this.toSearchResult(result, options));
  }

  /**
   * Get autocomplete suggestions
   */
  suggest(query: string, limit: number = 5): string[] {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const results = this.index.autoSuggest(query, {
      prefix: true,
      fuzzy: 0.2,
    });

    return results.slice(0, limit).map((r) => r.suggestion);
  }

  /**
   * Clear all documents from the index
   */
  clear(): void {
    this.index.removeAll();
    this.documentCount = 0;
  }

  /**
   * Export the index to JSON for persistence
   */
  exportIndex(): string {
    return JSON.stringify(this.index.toJSON());
  }

  /**
   * Import index from JSON
   */
  importIndex(json: string): void {
    try {
      const data = JSON.parse(json);
      this.index = MiniSearch.loadJSON(json, DEFAULT_OPTIONS);
      // Count documents after import
      this.documentCount = 0;
      // MiniSearch doesn't expose document count directly, so we estimate
      // by searching for empty string which returns all docs
      const allDocs = this.index.search('*', { prefix: true });
      this.documentCount = allDocs.length || Object.keys(data.documentIds || {}).length || 0;
    } catch (error) {
      logger.error('Failed to import MiniSearch index:', error);
      throw new Error('Failed to import search index');
    }
  }

  /**
   * Get index statistics
   */
  getStats(): {
    documentCount: number;
    termCount: number;
  } {
    return {
      documentCount: this.documentCount,
      termCount: this.index.termCount,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Convert SearchDocument to MiniSearch format
   */
  private toMiniSearchDocument(doc: SearchDocument): MiniSearchDocument {
    return {
      id: doc.id,
      moduleType: doc.moduleType,
      entityId: doc.entityId,
      groupId: doc.groupId,
      title: doc.title || '',
      content: doc.content || '',
      tags: doc.tags.join(' '),  // Space-separated for searching
      excerpt: doc.excerpt || '',
      authorPubkey: doc.authorPubkey,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Convert MiniSearch result to SearchResult format
   */
  private toSearchResult(
    result: MiniSearchResult,
    options: SearchOptions
  ): SearchResult {
    const document: SearchDocument = {
      id: result.id,
      moduleType: result.moduleType as SearchDocument['moduleType'],
      entityId: result.entityId as string,
      groupId: result.groupId as string,
      title: '',  // Will be populated from DB
      content: '',  // Will be populated from DB
      tags: [],
      excerpt: result.excerpt as string || '',
      authorPubkey: result.authorPubkey as string | undefined,
      createdAt: result.createdAt as number || 0,
      updatedAt: result.updatedAt as number || 0,
      facets: {},
      indexedAt: 0,
    };

    // Build highlighted excerpt if requested
    let highlightedExcerpt: string | undefined;
    if (options.highlight && document.excerpt) {
      highlightedExcerpt = this.highlightText(
        document.excerpt,
        result.terms,
        DEFAULT_HIGHLIGHT_OPTIONS
      );
    }

    return {
      document,
      score: result.score,
      matchedTerms: result.terms,
      matchedFields: Object.keys(result.match),
      highlightedExcerpt,
    };
  }

  /**
   * Highlight matched terms in text
   */
  private highlightText(
    text: string,
    terms: string[],
    options: HighlightOptions
  ): string {
    if (!text || terms.length === 0) {
      return text;
    }

    // Truncate if too long
    let truncated = text;
    if (text.length > options.maxLength) {
      // Try to find a relevant section containing matched terms
      const lowerText = text.toLowerCase();
      let startPos = 0;

      for (const term of terms) {
        const pos = lowerText.indexOf(term.toLowerCase());
        if (pos !== -1) {
          startPos = Math.max(0, pos - 50);
          break;
        }
      }

      truncated = (startPos > 0 ? '...' : '') +
        text.slice(startPos, startPos + options.maxLength) +
        (startPos + options.maxLength < text.length ? '...' : '');
    }

    // Highlight each term
    let highlighted = truncated;
    for (const term of terms) {
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
      highlighted = highlighted.replace(
        regex,
        `${options.preTag}$1${options.postTag}`
      );
    }

    return highlighted;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: MiniSearchEngine | null = null;

/**
 * Get the singleton MiniSearch engine instance
 */
export function getMiniSearchEngine(): MiniSearchEngine {
  if (!instance) {
    instance = new MiniSearchEngine();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMiniSearchEngine(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}
