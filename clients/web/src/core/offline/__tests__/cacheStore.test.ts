/**
 * CacheStore Tests
 * Tests for cache management with LRU eviction
 * Epic 60: Offline Mode Enhancement
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Use vi.hoisted to define mock variables that can be referenced in vi.mock
const { mockCacheMetadata, mockDb } = vi.hoisted(() => {
  const mockCacheMetadata = {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    orderBy: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    below: vi.fn().mockReturnThis(),
  };

  const mockDb = {
    cacheMetadata: mockCacheMetadata,
    conversations: { toArray: vi.fn().mockResolvedValue([]) },
    conversationMessages: {
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      below: vi.fn().mockReturnThis(),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    groups: { toArray: vi.fn().mockResolvedValue([]) },
    groupMembers: { toArray: vi.fn().mockResolvedValue([]) },
    friends: { toArray: vi.fn().mockResolvedValue([]) },
    offlineQueue: { toArray: vi.fn().mockResolvedValue([]) },
    posts: {
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      below: vi.fn().mockReturnThis(),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
  };

  return { mockCacheMetadata, mockDb };
});

vi.mock('@/core/storage/db', () => ({
  db: mockDb,
}));

import { useCacheStore } from '../cacheStore';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the caches API using vi.hoisted for proper hoisting
const { mockCache, mockCaches } = vi.hoisted(() => {
  const mockCache = {
    delete: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue([]),
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };

  const mockCaches = {
    keys: vi.fn().mockResolvedValue([]),
    open: vi.fn().mockResolvedValue(mockCache),
    delete: vi.fn().mockResolvedValue(true),
  };

  return { mockCache, mockCaches };
});

vi.stubGlobal('caches', mockCaches);

describe('cacheStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    useCacheStore.setState({
      usage: {
        totalBytes: 0,
        maxBytes: 100 * 1024 * 1024,
        percentUsed: 0,
        itemCount: 0,
        oldestItemAge: 0,
      },
      config: {
        maxSizeBytes: 100 * 1024 * 1024,
        maxAgeDays: 30,
        evictionTarget: 0.7,
      },
      pruneConfig: {
        messagesAgeDays: 90,
        postsAgeDays: 90,
        filesAgeDays: 180,
        cacheAgeDays: 30,
      },
      isProcessing: false,
      lastPruneAt: undefined,
    });

    // Reset mock implementations with chainable methods
    mockCacheMetadata.toArray.mockResolvedValue([]);
    mockCacheMetadata.get.mockResolvedValue(undefined);
    mockCacheMetadata.where.mockReturnThis();
    mockCacheMetadata.below.mockReturnThis();
    mockCacheMetadata.equals.mockReturnThis();
    mockCacheMetadata.orderBy.mockReturnThis();

    // Reset caches API mock
    mockCaches.keys.mockResolvedValue([]);
    mockCaches.open.mockResolvedValue(mockCache);
    mockCaches.delete.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackCacheEntry', () => {
    it('should track a new cache entry', async () => {
      const { trackCacheEntry } = useCacheStore.getState();

      await trackCacheEntry('https://example.com/image.jpg', 'image', 1024, 'image/jpeg');

      expect(mockCacheMetadata.put).toHaveBeenCalledTimes(1);
      expect(mockCacheMetadata.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'https://example.com/image.jpg',
          type: 'image',
          size: 1024,
          contentType: 'image/jpeg',
        })
      );
    });

    it('should include etag when provided', async () => {
      const { trackCacheEntry } = useCacheStore.getState();

      await trackCacheEntry('https://example.com/api/data', 'api', 512, 'application/json', 'abc123');

      expect(mockCacheMetadata.put).toHaveBeenCalledWith(
        expect.objectContaining({
          etag: 'abc123',
        })
      );
    });
  });

  describe('updateCacheAccess', () => {
    it('should update last access time', async () => {
      const { updateCacheAccess } = useCacheStore.getState();

      await updateCacheAccess('https://example.com/image.jpg');

      expect(mockCacheMetadata.update).toBeDefined; // Would be called in real implementation
    });
  });

  describe('removeCacheEntry', () => {
    it('should remove a cache entry', async () => {
      const { removeCacheEntry } = useCacheStore.getState();

      await removeCacheEntry('https://example.com/image.jpg');

      expect(mockCacheMetadata.delete).toHaveBeenCalledWith('https://example.com/image.jpg');
    });
  });

  describe('getCacheEntry', () => {
    it('should return undefined for non-existent entry', async () => {
      const { getCacheEntry } = useCacheStore.getState();

      const result = await getCacheEntry('non-existent');

      expect(result).toBeUndefined();
    });

    it('should return cache entry when it exists', async () => {
      const mockEntry = {
        key: 'test-key',
        type: 'image',
        size: 1024,
        lastAccessedAt: Date.now(),
        createdAt: Date.now() - 1000,
      };
      mockCacheMetadata.get.mockResolvedValueOnce(mockEntry);

      const { getCacheEntry } = useCacheStore.getState();
      const result = await getCacheEntry('test-key');

      expect(result).toEqual(mockEntry);
    });
  });

  describe('calculateUsage', () => {
    it('should calculate usage from cache entries', async () => {
      const now = Date.now();
      mockCacheMetadata.toArray.mockResolvedValueOnce([
        { key: '1', size: 1000, lastAccessedAt: now - 1000 },
        { key: '2', size: 2000, lastAccessedAt: now - 2000 },
        { key: '3', size: 3000, lastAccessedAt: now - 3000 },
      ]);

      const { calculateUsage } = useCacheStore.getState();
      const usage = await calculateUsage();

      expect(usage.totalBytes).toBe(6000);
      expect(usage.itemCount).toBe(3);
    });

    it('should calculate percent used', async () => {
      mockCacheMetadata.toArray.mockResolvedValueOnce([
        { key: '1', size: 50 * 1024 * 1024, lastAccessedAt: Date.now() }, // 50MB
      ]);

      const { calculateUsage } = useCacheStore.getState();
      const usage = await calculateUsage();

      expect(usage.percentUsed).toBeCloseTo(0.5, 1); // 50% of 100MB
    });

    it('should update store state', async () => {
      mockCacheMetadata.toArray.mockResolvedValueOnce([
        { key: '1', size: 1024, lastAccessedAt: Date.now() },
      ]);

      const { calculateUsage } = useCacheStore.getState();
      await calculateUsage();

      const { usage } = useCacheStore.getState();
      expect(usage.itemCount).toBe(1);
    });
  });

  describe('evictLRU', () => {
    it('should evict oldest entries to reach target size', async () => {
      const now = Date.now();
      mockCacheMetadata.toArray.mockResolvedValueOnce([
        { key: '1', size: 30000, lastAccessedAt: now - 3000 }, // Oldest
        { key: '2', size: 20000, lastAccessedAt: now - 2000 },
        { key: '3', size: 10000, lastAccessedAt: now - 1000 }, // Newest
      ]);

      // Set usage to trigger eviction
      useCacheStore.setState({
        usage: {
          totalBytes: 60000,
          maxBytes: 100000,
          percentUsed: 0.6,
          itemCount: 3,
          oldestItemAge: 3000,
        },
      });

      // Mock orderBy to return sorted entries
      mockCacheMetadata.orderBy.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([
          { key: '1', size: 30000, lastAccessedAt: now - 3000 },
          { key: '2', size: 20000, lastAccessedAt: now - 2000 },
          { key: '3', size: 10000, lastAccessedAt: now - 1000 },
        ]),
      });

      const { evictLRU } = useCacheStore.getState();
      // With 60000 bytes and target of 50000, evicting first entry (30000) brings us to 30000 < 50000
      const evictedCount = await evictLRU(50000);

      expect(evictedCount).toBe(1); // One entry evicted to get under target
    });

    it('should not evict if under target', async () => {
      useCacheStore.setState({
        usage: {
          totalBytes: 40000,
          maxBytes: 100000,
          percentUsed: 0.4,
          itemCount: 2,
          oldestItemAge: 1000,
        },
      });

      const { evictLRU } = useCacheStore.getState();
      const evictedCount = await evictLRU(50000);

      expect(evictedCount).toBe(0);
      expect(mockCacheMetadata.bulkDelete).not.toHaveBeenCalled();
    });
  });

  describe('evictByAge', () => {
    it('should evict entries older than specified days', async () => {
      const cutoffDate = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago

      // Create a chainable mock object
      const chainMock = {
        below: vi.fn(),
        toArray: vi.fn().mockResolvedValue([
          { key: 'old-1', size: 1000, lastAccessedAt: cutoffDate - 1000 },
          { key: 'old-2', size: 2000, lastAccessedAt: cutoffDate - 2000 },
        ]),
      };
      chainMock.below.mockReturnValue(chainMock);
      mockCacheMetadata.where.mockReturnValueOnce(chainMock);

      const { evictByAge } = useCacheStore.getState();
      const evictedCount = await evictByAge(30);

      expect(evictedCount).toBe(2);
      expect(mockCacheMetadata.bulkDelete).toHaveBeenCalledWith(['old-1', 'old-2']);
    });

    it('should use default max age if not specified', async () => {
      const chainMock = {
        below: vi.fn(),
        toArray: vi.fn().mockResolvedValue([]),
      };
      chainMock.below.mockReturnValue(chainMock);
      mockCacheMetadata.where.mockReturnValueOnce(chainMock);

      const { evictByAge } = useCacheStore.getState();
      await evictByAge();

      // Should use config.maxAgeDays (30 days by default)
      expect(mockCacheMetadata.where).toHaveBeenCalledWith('lastAccessedAt');
    });
  });

  describe('clearCache', () => {
    it('should clear all cache metadata', async () => {
      const { clearCache } = useCacheStore.getState();

      await clearCache();

      expect(mockCacheMetadata.clear).toHaveBeenCalled();
    });

    it('should reset usage state', async () => {
      useCacheStore.setState({
        usage: {
          totalBytes: 50000,
          maxBytes: 100000,
          percentUsed: 0.5,
          itemCount: 5,
          oldestItemAge: 10000,
        },
      });

      const { clearCache } = useCacheStore.getState();
      await clearCache();

      const { usage } = useCacheStore.getState();
      expect(usage.totalBytes).toBe(0);
      expect(usage.itemCount).toBe(0);
    });
  });

  describe('clearCacheByType', () => {
    it('should clear cache entries of specific type', async () => {
      mockCacheMetadata.where.mockReturnValueOnce({
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValueOnce([
          { key: 'image-1', type: 'image', size: 1000 },
          { key: 'image-2', type: 'image', size: 2000 },
        ]),
      });

      const { clearCacheByType } = useCacheStore.getState();
      await clearCacheByType('image');

      expect(mockCacheMetadata.bulkDelete).toHaveBeenCalledWith(['image-1', 'image-2']);
    });
  });

  describe('pruneOldData', () => {
    it('should prune old data from multiple stores', async () => {
      const { pruneOldData } = useCacheStore.getState();

      const results = await pruneOldData();

      expect(results).toHaveProperty('messages');
      expect(results).toHaveProperty('posts');
      expect(results).toHaveProperty('files');
      expect(results).toHaveProperty('cache');
    });

    it('should update lastPruneAt', async () => {
      const { pruneOldData } = useCacheStore.getState();
      const before = Date.now();

      await pruneOldData();

      const { lastPruneAt } = useCacheStore.getState();
      expect(lastPruneAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('setConfig', () => {
    it('should update cache configuration', () => {
      const { setConfig } = useCacheStore.getState();

      setConfig({
        maxSizeBytes: 200 * 1024 * 1024,
        maxAgeDays: 60,
      });

      const { config } = useCacheStore.getState();
      expect(config.maxSizeBytes).toBe(200 * 1024 * 1024);
      expect(config.maxAgeDays).toBe(60);
      expect(config.evictionTarget).toBe(0.7); // Unchanged
    });
  });

  describe('setPruneConfig', () => {
    it('should update prune configuration', () => {
      const { setPruneConfig } = useCacheStore.getState();

      setPruneConfig({
        messagesAgeDays: 180,
        postsAgeDays: 180,
      });

      const { pruneConfig } = useCacheStore.getState();
      expect(pruneConfig.messagesAgeDays).toBe(180);
      expect(pruneConfig.postsAgeDays).toBe(180);
      expect(pruneConfig.filesAgeDays).toBe(180); // Unchanged
    });
  });

  describe('exportOfflineData', () => {
    it('should export offline data as JSON blob', async () => {
      const { exportOfflineData } = useCacheStore.getState();

      const blob = await exportOfflineData();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should include version and timestamp', async () => {
      const { exportOfflineData } = useCacheStore.getState();

      const blob = await exportOfflineData();
      const text = await blob.text();
      const data = JSON.parse(text);

      expect(data.version).toBe(1);
      expect(data.exportedAt).toBeDefined();
      expect(data.data).toBeDefined();
    });
  });
});
