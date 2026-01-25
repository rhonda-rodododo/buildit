/**
 * Offline Module - Epic 60: Offline Mode Enhancement
 * Exports all offline-related functionality
 */

// Types
export type {
  QueueItemType,
  QueueItemStatus,
  BaseQueueItem,
  MessageQueueItem,
  PostQueueItem,
  FileUploadQueueItem,
  ReactionQueueItem,
  CommentQueueItem,
  QueueItem,
  DBOfflineQueueItem,
  SyncStatus,
  RetryConfig,
  CacheUsage,
  CacheConfig,
  PruneConfig,
  DBCacheMetadata,
} from './types';

// Constants
export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_PRUNE_CONFIG,
  calculateRetryDelay,
} from './types';

// Stores
export { useOfflineQueueStore } from './offlineQueueStore';
export { useCacheStore, getCacheUsage, evictCacheLRU } from './cacheStore';

// Queue processor
export {
  startQueueProcessor,
  processAllPendingItems,
  processQueueItem,
  queueOfflineMessage,
  queueOfflinePost,
  queueOfflineFileUpload,
} from './queueProcessor';
