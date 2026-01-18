/**
 * Offline Queue Types
 * Types for managing offline operations (messages, posts, file uploads)
 * Epic 60: Offline Mode Enhancement
 */

/**
 * Types of items that can be queued for offline processing
 */
export type QueueItemType = 'message' | 'post' | 'file-upload' | 'reaction' | 'comment';

/**
 * Status of a queued item
 */
export type QueueItemStatus = 'pending' | 'syncing' | 'completed' | 'failed';

/**
 * Base interface for all queue items
 */
export interface BaseQueueItem {
  id: string;
  type: QueueItemType;
  status: QueueItemStatus;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  lastError?: string;
  /** User who created this item */
  authorPubkey: string;
}

/**
 * Queue item for messages (DMs and group messages)
 */
export interface MessageQueueItem extends BaseQueueItem {
  type: 'message';
  payload: {
    conversationId: string;
    content: string;
    replyTo?: string;
    recipientPubkeys: string[];
    conversationType: 'dm' | 'group-chat' | 'multi-party';
  };
}

/**
 * Queue item for posts (microblogging)
 */
export interface PostQueueItem extends BaseQueueItem {
  type: 'post';
  payload: {
    content: string;
    contentType: 'text' | 'image' | 'video' | 'link' | 'poll';
    media?: Array<{
      type: 'image' | 'video' | 'gif';
      url: string;
      alt?: string;
    }>;
    visibility: {
      type: 'public' | 'followers' | 'group' | 'mentioned' | 'direct';
      groupIds?: string[];
    };
    mentions?: string[];
    hashtags?: string[];
    contentWarning?: string;
    isSensitive?: boolean;
  };
}

/**
 * Queue item for file uploads
 */
export interface FileUploadQueueItem extends BaseQueueItem {
  type: 'file-upload';
  payload: {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    groupId: string;
    folderId?: string;
    /** Base64 encoded file data for small files, or blob URL for large files */
    fileData?: string;
    /** Progress percentage (0-100) */
    uploadProgress: number;
    /** Chunk information for resumable uploads */
    chunks?: {
      total: number;
      uploaded: number;
      chunkSize: number;
    };
  };
}

/**
 * Queue item for reactions (likes, emojis)
 */
export interface ReactionQueueItem extends BaseQueueItem {
  type: 'reaction';
  payload: {
    targetId: string; // post or message ID
    targetType: 'post' | 'message';
    reactionType: string; // emoji or 'like'
    action: 'add' | 'remove';
  };
}

/**
 * Queue item for comments
 */
export interface CommentQueueItem extends BaseQueueItem {
  type: 'comment';
  payload: {
    postId: string;
    content: string;
    parentCommentId?: string;
  };
}

/**
 * Union type for all queue items
 */
export type QueueItem =
  | MessageQueueItem
  | PostQueueItem
  | FileUploadQueueItem
  | ReactionQueueItem
  | CommentQueueItem;

/**
 * Database schema for offline queue
 */
export interface DBOfflineQueueItem {
  id: string;
  type: QueueItemType;
  status: QueueItemStatus;
  payload: string; // JSON stringified payload
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  lastError?: string;
  authorPubkey: string;
}

/**
 * Sync status for the overall offline queue
 */
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: number;
  lastSyncSuccess: boolean;
  pendingCount: number;
  failedCount: number;
  /** Background Sync API registration status */
  backgroundSyncRegistered: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier (exponential factor) */
  backoffMultiplier: number;
  /** Add randomness to prevent thundering herd (0-1) */
  jitter: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2,
  jitter: 0.1,
};

/**
 * Calculate next retry delay with exponential backoff
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const { initialDelay, maxDelay, backoffMultiplier, jitter } = config;

  // Exponential backoff: delay = initialDelay * (multiplier ^ retryCount)
  const baseDelay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, retryCount),
    maxDelay
  );

  // Add jitter to prevent thundering herd
  const jitterAmount = baseDelay * jitter * Math.random();

  return Math.floor(baseDelay + jitterAmount);
}

/**
 * Cache management types
 */
export interface CacheUsage {
  totalBytes: number;
  maxBytes: number;
  percentUsed: number;
  itemCount: number;
  oldestItemAge: number; // in milliseconds
}

export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSizeBytes: number;
  /** Maximum age for cached items in days */
  maxAgeDays: number;
  /** Target percentage to reduce to when evicting (0-1) */
  evictionTarget: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  maxAgeDays: 30, // 30 days
  evictionTarget: 0.7, // Reduce to 70% when evicting
};

/**
 * Data pruning configuration
 */
export interface PruneConfig {
  /** Keep messages from last N days */
  messagesAgeDays: number;
  /** Keep posts from last N days */
  postsAgeDays: number;
  /** Keep files metadata from last N days */
  filesAgeDays: number;
  /** Keep cached data from last N days */
  cacheAgeDays: number;
}

export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
  messagesAgeDays: 90, // 3 months
  postsAgeDays: 90, // 3 months
  filesAgeDays: 180, // 6 months
  cacheAgeDays: 30, // 1 month
};

/**
 * Cache metadata for LRU eviction
 */
export interface DBCacheMetadata {
  key: string; // Unique cache key (URL, resource ID, etc.)
  type: 'asset' | 'api' | 'image' | 'document' | 'other';
  size: number; // Size in bytes
  lastAccessedAt: number; // Timestamp of last access
  createdAt: number; // Timestamp when cached
  etag?: string; // For cache validation
  contentType?: string; // MIME type
}
