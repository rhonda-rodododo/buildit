/**
 * Index Sync Manager Service
 * Manages incremental indexing and synchronization of search documents
 */

import type { SearchDocument, ModuleSearchProvider, IndexStats } from '../types';
import type { ModuleType } from '@/types/modules';
import type { DBSearchDocument } from '../schema';
import {
  serializeFacets,
  deserializeFacets,
  serializeVector,
  deserializeVector,
  serializeTags,
  deserializeTags,
} from '../schema';
import { dal } from '@/core/storage/dal';
import { getMiniSearchEngine } from './miniSearchEngine';
import { getTFIDFEngine } from './tfidfEngine';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface IndexQueueItem {
  type: 'add' | 'update' | 'remove';
  moduleType: ModuleType;
  entityId: string;
  groupId: string;
  entity?: unknown;
}

interface SyncProgress {
  total: number;
  processed: number;
  moduleType: ModuleType | null;
  status: 'idle' | 'indexing' | 'complete' | 'error';
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 50;
const IDLE_CALLBACK_TIMEOUT = 2000; // ms
const META_KEY_LAST_FULL_REINDEX = 'lastFullReindex';
const META_KEY_LAST_INCREMENTAL = 'lastIncrementalUpdate';
const META_KEY_INDEX_VERSION = 'indexVersion';
const CURRENT_INDEX_VERSION = '1';

// ============================================================================
// Index Sync Manager Class
// ============================================================================

export class IndexSyncManager {
  private providers = new Map<ModuleType, ModuleSearchProvider>();
  private indexQueue: IndexQueueItem[] = [];
  private isProcessing = false;
  private progress: SyncProgress = {
    total: 0,
    processed: 0,
    moduleType: null,
    status: 'idle',
  };
  private progressListeners: Set<(progress: SyncProgress) => void> = new Set();

  /**
   * Register a search provider for a module
   */
  registerProvider(provider: ModuleSearchProvider): void {
    this.providers.set(provider.moduleType, provider);
    logger.info('Registered search provider for:', provider.moduleType);
  }

  /**
   * Get a registered provider
   */
  getProvider(moduleType: ModuleType): ModuleSearchProvider | undefined {
    return this.providers.get(moduleType);
  }

  /**
   * Get all registered providers
   */
  getProviders(): ModuleSearchProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get current sync progress
   */
  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(listener: (progress: SyncProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /**
   * Queue an entity for indexing
   */
  queueIndex(
    moduleType: ModuleType,
    entityId: string,
    groupId: string,
    entity: unknown
  ): void {
    this.indexQueue.push({
      type: 'add',
      moduleType,
      entityId,
      groupId,
      entity,
    });
    this.scheduleProcessing();
  }

  /**
   * Queue an entity for update
   */
  queueUpdate(
    moduleType: ModuleType,
    entityId: string,
    groupId: string,
    entity: unknown
  ): void {
    this.indexQueue.push({
      type: 'update',
      moduleType,
      entityId,
      groupId,
      entity,
    });
    this.scheduleProcessing();
  }

  /**
   * Queue an entity for removal
   */
  queueRemove(moduleType: ModuleType, entityId: string, groupId: string): void {
    this.indexQueue.push({
      type: 'remove',
      moduleType,
      entityId,
      groupId,
    });
    this.scheduleProcessing();
  }

  /**
   * Schedule queue processing during idle time
   */
  private scheduleProcessing(): void {
    if (this.isProcessing) return;

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(
        () => this.processQueue(),
        { timeout: IDLE_CALLBACK_TIMEOUT }
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Process the index queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.indexQueue.length === 0) return;

    this.isProcessing = true;
    this.updateProgress({ status: 'indexing' });

    try {
      // Process in batches
      while (this.indexQueue.length > 0) {
        const batch = this.indexQueue.splice(0, BATCH_SIZE);

        for (const item of batch) {
          try {
            await this.processItem(item);
          } catch (error) {
            logger.error('Error processing index item:', error, item);
          }
        }

        // Yield to the main thread between batches
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Update last incremental timestamp
      await this.setMeta(META_KEY_LAST_INCREMENTAL, Date.now().toString());

      this.updateProgress({ status: 'complete' });
    } catch (error) {
      logger.error('Error processing index queue:', error);
      this.updateProgress({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: IndexQueueItem): Promise<void> {
    const provider = this.providers.get(item.moduleType);
    if (!provider && item.type !== 'remove') {
      logger.warn('No provider for module type:', item.moduleType);
      return;
    }

    const docId = `${item.moduleType}:${item.entityId}`;

    switch (item.type) {
      case 'add':
      case 'update': {
        if (!provider || !item.entity) break;

        const searchDoc = provider.indexEntity(item.entity, item.groupId);
        if (!searchDoc) break;

        // Build TF-IDF vector
        const tfidf = getTFIDFEngine();
        const vector = tfidf.addDocument(searchDoc);
        searchDoc.vector = vector;

        // Save to DB
        await this.saveDocument(searchDoc);

        // Update in-memory index
        const miniSearch = getMiniSearchEngine();
        miniSearch.updateDocument(searchDoc);
        break;
      }

      case 'remove': {
        // Load document to get vector for removal
        const existingDoc = await this.loadDocument(docId);
        if (existingDoc?.vector) {
          const tfidf = getTFIDFEngine();
          tfidf.removeDocument(existingDoc.vector);
        }

        // Remove from DB
        await this.removeDocument(docId);

        // Remove from in-memory index
        const miniSearch = getMiniSearchEngine();
        miniSearch.removeDocument(docId);
        break;
      }
    }
  }

  /**
   * Perform a full reindex of all content
   */
  async fullReindex(groupIds?: string[]): Promise<void> {
    this.updateProgress({
      status: 'indexing',
      total: 0,
      processed: 0,
      moduleType: null,
    });

    try {
      const miniSearch = getMiniSearchEngine();
      const tfidf = getTFIDFEngine();

      // Clear existing indexes if doing full reindex
      if (!groupIds) {
        miniSearch.clear();
        tfidf.clear();
        await this.clearAllDocuments();
      }

      let totalDocs = 0;
      let processedDocs = 0;

      // Index each module
      for (const provider of this.providers.values()) {
        this.updateProgress({ moduleType: provider.moduleType });

        // Get groups to index
        const groups = groupIds || (await this.getAccessibleGroups());

        for (const groupId of groups) {
          const entities = await provider.getIndexableEntities(groupId);

          for (const entity of entities) {
            totalDocs++;
            this.updateProgress({ total: totalDocs });

            const searchDoc = provider.indexEntity(entity, groupId);
            if (searchDoc) {
              // Build TF-IDF vector
              const vector = tfidf.addDocument(searchDoc);
              searchDoc.vector = vector;

              // Save to DB
              await this.saveDocument(searchDoc);

              // Add to in-memory index
              miniSearch.addDocument(searchDoc);
            }

            processedDocs++;
            this.updateProgress({ processed: processedDocs });

            // Yield periodically
            if (processedDocs % BATCH_SIZE === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }
      }

      // Update metadata
      await this.setMeta(META_KEY_LAST_FULL_REINDEX, Date.now().toString());
      await this.setMeta(META_KEY_INDEX_VERSION, CURRENT_INDEX_VERSION);

      this.updateProgress({ status: 'complete' });
      logger.info(`Full reindex complete: ${processedDocs} documents indexed`);
    } catch (error) {
      logger.error('Full reindex failed:', error);
      this.updateProgress({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Load indexes from DB into memory
   */
  async loadIndexes(groupIds?: string[]): Promise<void> {
    this.updateProgress({ status: 'indexing', moduleType: null });

    try {
      const miniSearch = getMiniSearchEngine();
      const tfidf = getTFIDFEngine();

      // Check index version
      const version = await this.getMeta(META_KEY_INDEX_VERSION);
      if (version !== CURRENT_INDEX_VERSION) {
        logger.info('Index version mismatch, triggering full reindex');
        await this.fullReindex(groupIds);
        return;
      }

      // Load documents from DB
      const documents = await this.loadAllDocuments(groupIds);

      // Populate in-memory indexes
      for (const doc of documents) {
        miniSearch.addDocument(doc);
        // Rebuild TF-IDF document stats from loaded documents
        // This ensures semantic search works correctly after reload
        tfidf.addDocument(doc);
      }

      this.updateProgress({ status: 'complete', processed: documents.length });
      logger.info(`Loaded ${documents.length} documents into search index`);
    } catch (error) {
      logger.error('Failed to load indexes:', error);
      this.updateProgress({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const miniSearch = getMiniSearchEngine();
    const tfidf = getTFIDFEngine();

    const docs = await this.loadAllDocuments();

    const byModuleType: Record<ModuleType, number> = {} as Record<ModuleType, number>;
    const byGroup: Record<string, number> = {};

    for (const doc of docs) {
      byModuleType[doc.moduleType] = (byModuleType[doc.moduleType] || 0) + 1;
      byGroup[doc.groupId] = (byGroup[doc.groupId] || 0) + 1;
    }

    const lastFullReindex = await this.getMeta(META_KEY_LAST_FULL_REINDEX);
    const lastIncremental = await this.getMeta(META_KEY_LAST_INCREMENTAL);

    return {
      totalDocuments: miniSearch.count,
      byModuleType,
      byGroup,
      uniqueTerms: tfidf.vocabularySize,
      sizeBytes: 0, // Would need to estimate from stored data
      lastFullReindex: lastFullReindex ? parseInt(lastFullReindex, 10) : undefined,
      lastIncrementalUpdate: lastIncremental ? parseInt(lastIncremental, 10) : undefined,
    };
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  /**
   * Save a search document to the database
   */
  private async saveDocument(doc: SearchDocument): Promise<void> {
    const dbDoc: DBSearchDocument = {
      id: doc.id,
      moduleType: doc.moduleType,
      entityId: doc.entityId,
      groupId: doc.groupId,
      title: doc.title,
      content: doc.content,
      tags: serializeTags(doc.tags),
      excerpt: doc.excerpt,
      authorPubkey: doc.authorPubkey,
      facets: serializeFacets(doc.facets),
      vector: doc.vector ? serializeVector(doc.vector) : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      indexedAt: Date.now(),
    };

    await dal.put('searchIndex', dbDoc);
  }

  /**
   * Load a search document from the database
   */
  private async loadDocument(id: string): Promise<SearchDocument | null> {
    const dbDoc = await dal.get<DBSearchDocument>('searchIndex', id);
    if (!dbDoc) return null;

    return this.dbDocToSearchDoc(dbDoc);
  }

  /**
   * Load all search documents from the database
   */
  private async loadAllDocuments(groupIds?: string[]): Promise<SearchDocument[]> {
    let dbDocs: DBSearchDocument[];

    if (groupIds && groupIds.length > 0) {
      dbDocs = await dal.queryCustom<DBSearchDocument>({
        sql: `SELECT * FROM search_index WHERE group_id IN (${groupIds.map(() => '?').join(',')})`,
        params: groupIds,
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { table: (name: string) => { where: (key: string) => { anyOf: (ids: string[]) => { toArray: () => Promise<DBSearchDocument[]> } } } };
          return dexieDb.table('searchIndex').where('groupId').anyOf(groupIds).toArray();
        },
      });
    } else {
      dbDocs = await dal.getAll<DBSearchDocument>('searchIndex');
    }

    return dbDocs.map((d) => this.dbDocToSearchDoc(d));
  }

  /**
   * Remove a document from the database
   */
  private async removeDocument(id: string): Promise<void> {
    await dal.delete('searchIndex', id);
  }

  /**
   * Clear all documents from the database
   */
  private async clearAllDocuments(): Promise<void> {
    await dal.clearTable('searchIndex');
  }

  /**
   * Convert DB document to SearchDocument
   */
  private dbDocToSearchDoc(dbDoc: DBSearchDocument): SearchDocument {
    return {
      id: dbDoc.id,
      moduleType: dbDoc.moduleType,
      entityId: dbDoc.entityId,
      groupId: dbDoc.groupId,
      title: dbDoc.title,
      content: dbDoc.content,
      tags: deserializeTags(dbDoc.tags),
      excerpt: dbDoc.excerpt,
      authorPubkey: dbDoc.authorPubkey,
      facets: deserializeFacets(dbDoc.facets),
      vector: dbDoc.vector ? deserializeVector(dbDoc.vector) : undefined,
      createdAt: dbDoc.createdAt,
      updatedAt: dbDoc.updatedAt,
      indexedAt: dbDoc.indexedAt,
    };
  }

  /**
   * Get/set metadata
   */
  private async getMeta(key: string): Promise<string | null> {
    const results = await dal.query<{ id: string; key: string; value: string }>('searchIndexMeta', {
      whereClause: { key },
      limit: 1,
    });
    return results.length > 0 ? results[0].value : null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    const results = await dal.query<{ id: string; key: string; value: string }>('searchIndexMeta', {
      whereClause: { key },
      limit: 1,
    });

    if (results.length > 0) {
      await dal.update('searchIndexMeta', results[0].id, {
        value,
        updatedAt: Date.now(),
      });
    } else {
      await dal.add('searchIndexMeta', {
        id: `meta-${key}`,
        key,
        value,
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Get accessible groups for the current user
   */
  private async getAccessibleGroups(): Promise<string[]> {
    const groups = await dal.getAll<{ id: string }>('groups');
    return groups.map((g) => g.id);
  }

  /**
   * Update and notify progress
   */
  private updateProgress(update: Partial<SyncProgress>): void {
    this.progress = { ...this.progress, ...update };
    for (const listener of this.progressListeners) {
      listener(this.progress);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: IndexSyncManager | null = null;

/**
 * Get the singleton IndexSyncManager instance
 */
export function getIndexSyncManager(): IndexSyncManager {
  if (!instance) {
    instance = new IndexSyncManager();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetIndexSyncManager(): void {
  instance = null;
}
