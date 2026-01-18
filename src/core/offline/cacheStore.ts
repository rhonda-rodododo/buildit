/**
 * Cache Management Store
 * Zustand store for managing cache with LRU eviction and size limits
 * Epic 60: Offline Mode Enhancement
 */

import { create } from 'zustand';
import { db } from '@/core/storage/db';
import { logger } from '@/lib/logger';
import type {
  CacheUsage,
  CacheConfig,
  PruneConfig,
  DBCacheMetadata,
} from './types';

interface CacheState {
  /** Current cache usage statistics */
  usage: CacheUsage;
  /** Cache configuration */
  config: CacheConfig;
  /** Prune configuration */
  pruneConfig: PruneConfig;
  /** Whether cache operations are in progress */
  isProcessing: boolean;
  /** Last prune timestamp */
  lastPruneAt?: number;
}

interface CacheActions {
  // Cache metadata operations
  trackCacheEntry: (
    key: string,
    type: DBCacheMetadata['type'],
    size: number,
    contentType?: string,
    etag?: string
  ) => Promise<void>;
  updateCacheAccess: (key: string) => Promise<void>;
  removeCacheEntry: (key: string) => Promise<void>;
  getCacheEntry: (key: string) => Promise<DBCacheMetadata | undefined>;

  // Cache management
  calculateUsage: () => Promise<CacheUsage>;
  evictLRU: (targetBytes?: number) => Promise<number>;
  evictByAge: (maxAgeDays?: number) => Promise<number>;
  clearCache: () => Promise<void>;
  clearCacheByType: (type: DBCacheMetadata['type']) => Promise<void>;

  // Data pruning
  pruneOldData: () => Promise<{
    messages: number;
    posts: number;
    files: number;
    cache: number;
  }>;

  // Configuration
  setConfig: (config: Partial<CacheConfig>) => void;
  setPruneConfig: (config: Partial<PruneConfig>) => void;

  // Export
  exportOfflineData: () => Promise<Blob>;

  // Load from database
  loadUsage: () => Promise<void>;
}

const defaultUsage: CacheUsage = {
  totalBytes: 0,
  maxBytes: 100 * 1024 * 1024, // 100MB
  percentUsed: 0,
  itemCount: 0,
  oldestItemAge: 0,
};

const defaultConfig: CacheConfig = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  maxAgeDays: 30,
  evictionTarget: 0.7,
};

const defaultPruneConfig: PruneConfig = {
  messagesAgeDays: 90,
  postsAgeDays: 90,
  filesAgeDays: 180,
  cacheAgeDays: 30,
};

export const useCacheStore = create<CacheState & CacheActions>()((set, get) => ({
  // Initial state
  usage: defaultUsage,
  config: defaultConfig,
  pruneConfig: defaultPruneConfig,
  isProcessing: false,
  lastPruneAt: undefined,

  // Track a new cache entry
  trackCacheEntry: async (
    key: string,
    type: DBCacheMetadata['type'],
    size: number,
    contentType?: string,
    etag?: string
  ): Promise<void> => {
    try {
      const now = Date.now();
      const entry: DBCacheMetadata = {
        key,
        type,
        size,
        lastAccessedAt: now,
        createdAt: now,
        contentType,
        etag,
      };

      await db.cacheMetadata.put(entry);

      // Check if we need to evict
      const { config } = get();
      const usage = await get().calculateUsage();

      if (usage.totalBytes > config.maxSizeBytes) {
        const targetBytes = Math.floor(config.maxSizeBytes * config.evictionTarget);
        await get().evictLRU(targetBytes);
      }
    } catch (error) {
      logger.error('[CacheStore] Failed to track cache entry:', error);
    }
  },

  // Update last access time for a cache entry
  updateCacheAccess: async (key: string): Promise<void> => {
    try {
      await db.cacheMetadata.update(key, { lastAccessedAt: Date.now() });
    } catch (error) {
      // Entry may not exist, that's ok
      logger.debug('[CacheStore] Failed to update cache access:', error);
    }
  },

  // Remove a cache entry
  removeCacheEntry: async (key: string): Promise<void> => {
    try {
      await db.cacheMetadata.delete(key);
    } catch (error) {
      logger.error('[CacheStore] Failed to remove cache entry:', error);
    }
  },

  // Get a cache entry
  getCacheEntry: async (key: string): Promise<DBCacheMetadata | undefined> => {
    try {
      return await db.cacheMetadata.get(key);
    } catch (error) {
      logger.error('[CacheStore] Failed to get cache entry:', error);
      return undefined;
    }
  },

  // Calculate current cache usage
  calculateUsage: async (): Promise<CacheUsage> => {
    try {
      const entries = await db.cacheMetadata.toArray();
      const now = Date.now();

      let totalBytes = 0;
      let oldestTimestamp = now;

      for (const entry of entries) {
        totalBytes += entry.size;
        if (entry.lastAccessedAt < oldestTimestamp) {
          oldestTimestamp = entry.lastAccessedAt;
        }
      }

      const { config } = get();
      const usage: CacheUsage = {
        totalBytes,
        maxBytes: config.maxSizeBytes,
        percentUsed: totalBytes / config.maxSizeBytes,
        itemCount: entries.length,
        oldestItemAge: now - oldestTimestamp,
      };

      set({ usage });
      return usage;
    } catch (error) {
      logger.error('[CacheStore] Failed to calculate usage:', error);
      return get().usage;
    }
  },

  // Evict least recently used items
  evictLRU: async (targetBytes?: number): Promise<number> => {
    set({ isProcessing: true });

    try {
      const { config, usage } = get();
      const target = targetBytes ?? Math.floor(config.maxSizeBytes * config.evictionTarget);

      if (usage.totalBytes <= target) {
        set({ isProcessing: false });
        return 0;
      }

      // Get entries sorted by last access time (oldest first)
      const entries = await db.cacheMetadata.orderBy('lastAccessedAt').toArray();

      let evictedBytes = 0;
      let evictedCount = 0;
      const toDelete: string[] = [];

      for (const entry of entries) {
        if (usage.totalBytes - evictedBytes <= target) {
          break;
        }

        toDelete.push(entry.key);
        evictedBytes += entry.size;
        evictedCount++;
      }

      // Delete evicted entries
      if (toDelete.length > 0) {
        await db.cacheMetadata.bulkDelete(toDelete);

        // Also clear from browser cache if possible
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            for (const key of toDelete) {
              await cache.delete(key).catch(() => {});
            }
          }
        }
      }

      logger.info(`[CacheStore] Evicted ${evictedCount} items (${evictedBytes} bytes)`);

      // Recalculate usage
      await get().calculateUsage();

      set({ isProcessing: false });
      return evictedCount;
    } catch (error) {
      logger.error('[CacheStore] Failed to evict LRU:', error);
      set({ isProcessing: false });
      return 0;
    }
  },

  // Evict entries older than maxAge
  evictByAge: async (maxAgeDays?: number): Promise<number> => {
    set({ isProcessing: true });

    try {
      const { config } = get();
      const maxAge = maxAgeDays ?? config.maxAgeDays;
      const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000;

      const oldEntries = await db.cacheMetadata
        .where('lastAccessedAt')
        .below(cutoff)
        .toArray();

      if (oldEntries.length === 0) {
        set({ isProcessing: false });
        return 0;
      }

      const toDelete = oldEntries.map((e) => e.key);
      await db.cacheMetadata.bulkDelete(toDelete);

      // Also clear from browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          for (const key of toDelete) {
            await cache.delete(key).catch(() => {});
          }
        }
      }

      const evictedBytes = oldEntries.reduce((sum, e) => sum + e.size, 0);
      logger.info(`[CacheStore] Evicted ${oldEntries.length} old items (${evictedBytes} bytes)`);

      // Recalculate usage
      await get().calculateUsage();

      set({ isProcessing: false });
      return oldEntries.length;
    } catch (error) {
      logger.error('[CacheStore] Failed to evict by age:', error);
      set({ isProcessing: false });
      return 0;
    }
  },

  // Clear all cache
  clearCache: async (): Promise<void> => {
    set({ isProcessing: true });

    try {
      await db.cacheMetadata.clear();

      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          // Only clear app-specific caches, not service worker precache
          if (!cacheName.includes('workbox-precache')) {
            await caches.delete(cacheName);
          }
        }
      }

      logger.info('[CacheStore] Cleared all cache');

      set({
        usage: { ...defaultUsage, maxBytes: get().config.maxSizeBytes },
        isProcessing: false,
      });
    } catch (error) {
      logger.error('[CacheStore] Failed to clear cache:', error);
      set({ isProcessing: false });
    }
  },

  // Clear cache by type
  clearCacheByType: async (type: DBCacheMetadata['type']): Promise<void> => {
    set({ isProcessing: true });

    try {
      const entries = await db.cacheMetadata.where('type').equals(type).toArray();
      const keys = entries.map((e) => e.key);

      await db.cacheMetadata.bulkDelete(keys);

      // Clear from browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          for (const key of keys) {
            await cache.delete(key).catch(() => {});
          }
        }
      }

      logger.info(`[CacheStore] Cleared ${entries.length} ${type} cache entries`);

      await get().calculateUsage();
      set({ isProcessing: false });
    } catch (error) {
      logger.error('[CacheStore] Failed to clear cache by type:', error);
      set({ isProcessing: false });
    }
  },

  // Prune old data from all stores
  pruneOldData: async (): Promise<{
    messages: number;
    posts: number;
    files: number;
    cache: number;
  }> => {
    set({ isProcessing: true });

    const { pruneConfig } = get();
    const now = Date.now();

    const results = {
      messages: 0,
      posts: 0,
      files: 0,
      cache: 0,
    };

    try {
      // Prune old messages
      const messageCutoff = now - pruneConfig.messagesAgeDays * 24 * 60 * 60 * 1000;
      try {
        const oldMessages = await db.conversationMessages
          .where('timestamp')
          .below(messageCutoff)
          .toArray();
        if (oldMessages.length > 0) {
          await db.conversationMessages.bulkDelete(oldMessages.map((m) => m.id));
          results.messages = oldMessages.length;
        }
      } catch (e) {
        logger.warn('[CacheStore] Could not prune messages:', e);
      }

      // Prune old posts
      const postsCutoff = now - pruneConfig.postsAgeDays * 24 * 60 * 60 * 1000;
      try {
        const oldPosts = await db.posts?.where('createdAt').below(postsCutoff).toArray();
        if (oldPosts && oldPosts.length > 0) {
          await db.posts.bulkDelete(oldPosts.map((p: { id: string }) => p.id));
          results.posts = oldPosts.length;
        }
      } catch (e) {
        logger.warn('[CacheStore] Could not prune posts:', e);
      }

      // Prune cache entries
      results.cache = await get().evictByAge(pruneConfig.cacheAgeDays);

      set({ lastPruneAt: now, isProcessing: false });

      logger.info('[CacheStore] Prune completed:', results);
      return results;
    } catch (error) {
      logger.error('[CacheStore] Failed to prune old data:', error);
      set({ isProcessing: false });
      return results;
    }
  },

  // Set cache configuration
  setConfig: (config: Partial<CacheConfig>): void => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  // Set prune configuration
  setPruneConfig: (config: Partial<PruneConfig>): void => {
    set((state) => ({
      pruneConfig: { ...state.pruneConfig, ...config },
    }));
  },

  // Export all offline data as JSON blob
  exportOfflineData: async (): Promise<Blob> => {
    try {
      const data: Record<string, unknown[]> = {};

      // Export conversations
      data.conversations = await db.conversations.toArray();
      data.conversationMessages = await db.conversationMessages.toArray();

      // Export posts if table exists
      if (db.posts) {
        data.posts = await db.posts.toArray();
      }

      // Export groups
      data.groups = await db.groups.toArray();
      data.groupMembers = await db.groupMembers.toArray();

      // Export friends
      data.friends = await db.friends.toArray();

      // Export offline queue
      data.offlineQueue = await db.offlineQueue.toArray();

      // Add metadata
      const exportData = {
        version: 1,
        exportedAt: Date.now(),
        data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      logger.info('[CacheStore] Exported offline data');
      return blob;
    } catch (error) {
      logger.error('[CacheStore] Failed to export offline data:', error);
      throw error;
    }
  },

  // Load usage from database
  loadUsage: async (): Promise<void> => {
    await get().calculateUsage();
  },
}));

// Export functions for service worker use
export async function getCacheUsage(): Promise<CacheUsage> {
  return useCacheStore.getState().calculateUsage();
}

export async function evictCacheLRU(targetBytes?: number): Promise<number> {
  return useCacheStore.getState().evictLRU(targetBytes);
}
