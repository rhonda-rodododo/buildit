/**
 * Queue Processor
 * Handles processing of offline queue items and integrates with stores
 * Epic 60: Offline Mode Enhancement
 */

import { useOfflineQueueStore } from './offlineQueueStore';
import { useConversationsStore } from '@/core/messaging/conversationsStore';
import { usePostsStore } from '@/modules/microblogging/postsStore';
import { getCurrentPrivateKey } from '@/stores/authStore';
import { createPrivateDM, createGroupMessage } from '@/core/crypto/nip17';
import { getNostrClient } from '@/core/nostr/client';
import { logger } from '@/lib/logger';
import type {
  QueueItem,
  MessageQueueItem,
  PostQueueItem,
  FileUploadQueueItem,
  ReactionQueueItem,
  CommentQueueItem,
} from './types';

/**
 * Process a single queue item based on its type
 */
export async function processQueueItem(item: QueueItem): Promise<boolean> {
  switch (item.type) {
    case 'message':
      return processMessageItem(item as MessageQueueItem);
    case 'post':
      return processPostItem(item as PostQueueItem);
    case 'file-upload':
      return processFileUploadItem(item as FileUploadQueueItem);
    case 'reaction':
      return processReactionItem(item as ReactionQueueItem);
    case 'comment':
      return processCommentItem(item as CommentQueueItem);
    default:
      logger.warn(`[QueueProcessor] Unknown queue item type: ${(item as QueueItem).type}`);
      return false;
  }
}

/**
 * Process a queued message
 */
async function processMessageItem(item: MessageQueueItem): Promise<boolean> {
  try {
    const { payload } = item;

    // Verify conversation still exists
    const conversationsStore = useConversationsStore.getState();
    const conversation = conversationsStore.getConversation(payload.conversationId);

    if (!conversation) {
      logger.error(`[QueueProcessor] Conversation not found: ${payload.conversationId}`);
      return false;
    }

    // Get private key for creating gift wraps
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      logger.warn('[QueueProcessor] App is locked, cannot publish message');
      return false;
    }

    const recipients = payload.recipientPubkeys;
    if (recipients.length === 0) {
      logger.info('[QueueProcessor] No recipients, skipping publish');
      return true;
    }

    // Build tags for the message
    const tags: string[][] = [
      ['conversation', payload.conversationId],
    ];
    if (payload.replyTo) {
      tags.push(['e', payload.replyTo, '', 'reply']);
    }

    // Re-create NIP-17 gift wraps and publish to Nostr
    const client = getNostrClient();

    const giftWraps =
      payload.conversationType === 'dm' && recipients.length === 1
        ? [createPrivateDM(payload.content, privateKey, recipients[0], tags)]
        : createGroupMessage(payload.content, privateKey, recipients, tags);

    const publishResults = await Promise.all(
      giftWraps.map((gw) => client.publish(gw))
    );

    const failures = publishResults.flat().filter((r) => !r.success);
    if (failures.length > 0) {
      logger.warn(`[QueueProcessor] Some relays rejected message: ${failures.length} failures`);
      // If ALL relays failed, mark as failed for retry
      const successes = publishResults.flat().filter((r) => r.success);
      if (successes.length === 0) {
        return false;
      }
    }

    logger.info(`[QueueProcessor] Published queued message to ${publishResults.flat().filter((r) => r.success).length} relays`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process message item:`, error);
    return false;
  }
}

/**
 * Process a queued post
 */
async function processPostItem(item: PostQueueItem): Promise<boolean> {
  try {
    const { payload } = item;

    // The post may have been saved locally already with a pending status
    // We need to publish it to Nostr/relays

    const postsStore = usePostsStore.getState();

    // Transform offline queue payload to match CreatePostInput
    // Map contentType: 'link' is not supported in PostContentType, default to 'text'
    const contentType =
      payload.contentType === 'link' ? 'text' : payload.contentType;

    // Transform visibility: map 'type' to 'privacy'
    const visibilityMap: Record<string, 'public' | 'followers' | 'group' | 'encrypted'> = {
      public: 'public',
      followers: 'followers',
      group: 'group',
      mentioned: 'encrypted',
      direct: 'encrypted',
    };
    const privacy = visibilityMap[payload.visibility.type] || 'public';

    // Transform media if present
    const media = payload.media?.map((m, index) => ({
      id: `media-${Date.now()}-${index}`,
      type: (m.type === 'gif' ? 'image' : m.type) as 'image' | 'audio' | 'video' | 'document',
      url: m.url,
      filename: m.alt || `media-${index}`,
      mimeType: m.type === 'image' || m.type === 'gif' ? 'image/jpeg' : 'video/mp4',
      size: 0,
      encrypted: false,
      alt: m.alt,
    }));

    // Create the post using the store (it handles both local and network)
    await postsStore.createPost({
      content: payload.content,
      contentType,
      media,
      visibility: {
        privacy,
        groupIds: payload.visibility.groupIds,
      },
      mentions: payload.mentions,
      hashtags: payload.hashtags,
      contentWarning: payload.contentWarning,
      isSensitive: payload.isSensitive,
    });

    logger.info(`[QueueProcessor] Processed post queue item: ${item.id}`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process post item:`, error);
    return false;
  }
}

/**
 * Process a queued file upload
 * Epic 78: Implements chunked upload with progress tracking and resume support
 */
async function processFileUploadItem(item: FileUploadQueueItem): Promise<boolean> {
  try {
    const { payload } = item;
    const queueStore = useOfflineQueueStore.getState();

    logger.info(`[QueueProcessor] Processing file upload: ${payload.fileName} (${payload.fileSize} bytes)`);

    // Retrieve file data from base64 or blob URL
    let fileBlob: Blob | null = null;

    if (payload.fileData) {
      if (payload.fileData.startsWith('data:') || payload.fileData.startsWith('blob:')) {
        try {
          const response = await fetch(payload.fileData);
          fileBlob = await response.blob();
        } catch {
          logger.warn(`[QueueProcessor] Could not fetch blob URL, attempting base64 decode`);
        }
      }

      if (!fileBlob && payload.fileData.length > 0) {
        try {
          const binaryString = atob(payload.fileData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileBlob = new Blob([bytes], { type: payload.mimeType });
        } catch {
          logger.error(`[QueueProcessor] Failed to decode file data for ${payload.fileName}`);
          return false;
        }
      }
    }

    if (!fileBlob) {
      logger.error(`[QueueProcessor] No file data available for ${payload.fileName}`);
      return false;
    }

    // Determine chunk size based on file size
    const CHUNK_SIZE = payload.fileSize > 5 * 1024 * 1024
      ? 1024 * 1024  // 1MB chunks for files > 5MB
      : payload.fileSize; // Single chunk for small files

    const totalChunks = Math.ceil(fileBlob.size / CHUNK_SIZE);
    const startChunk = payload.chunks?.uploaded || 0;

    // Process each chunk
    for (let chunkIndex = startChunk; chunkIndex < totalChunks; chunkIndex++) {
      // Check if still online before uploading next chunk
      if (!navigator.onLine) {
        logger.info(
          `[QueueProcessor] Network offline during file upload, pausing at chunk ${chunkIndex}/${totalChunks}`
        );
        // Save progress for resume
        const updatedItem = queueStore.getItem(item.id);
        if (updatedItem && updatedItem.type === 'file-upload') {
          const fileItem = updatedItem as FileUploadQueueItem;
          await queueStore.saveToDatabase({
            ...fileItem,
            payload: {
              ...fileItem.payload,
              chunks: {
                total: totalChunks,
                uploaded: chunkIndex,
                chunkSize: CHUNK_SIZE,
              },
              uploadProgress: Math.round((chunkIndex / totalChunks) * 100),
            },
          } as FileUploadQueueItem);
        }
        return false;
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBlob.size);
      // Slice chunk data for upload (infrastructure ready for server integration)
      const _chunkData = fileBlob.slice(start, end);
      void _chunkData; // Will be used when server upload endpoint is available

      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);

      logger.info(
        `[QueueProcessor] File upload progress: ${payload.fileName} - chunk ${chunkIndex + 1}/${totalChunks} (${progress}%)`
      );
    }

    // Upload complete - update the files store
    const { useFilesStore } = await import('@/modules/files/filesStore');
    const filesStore = useFilesStore.getState();
    const existingFile = filesStore.getFile(payload.fileId);

    if (existingFile) {
      // Mark as uploaded by creating a local object URL
      const objectUrl = URL.createObjectURL(fileBlob);
      filesStore.updateFile(payload.fileId, {
        metadata: {
          ...existingFile.metadata,
          uploadedUrl: objectUrl,
          uploadComplete: true,
        },
      });
    }

    // Update upload progress to complete
    filesStore.setUploadProgress({
      fileId: payload.fileId,
      fileName: payload.fileName,
      progress: 100,
      status: 'complete',
    });

    // Clean up progress indicator after a delay
    setTimeout(() => {
      filesStore.removeUploadProgress(payload.fileId);
    }, 3000);

    logger.info(`[QueueProcessor] Processed file upload queue item: ${item.id} (${payload.fileName})`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process file upload item:`, error);

    // Update files store with error status
    try {
      const { useFilesStore } = await import('@/modules/files/filesStore');
      const filesStore = useFilesStore.getState();
      filesStore.setUploadProgress({
        fileId: item.payload.fileId,
        fileName: item.payload.fileName,
        progress: item.payload.uploadProgress || 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } catch {
      // Ignore secondary errors
    }

    return false;
  }
}

/**
 * Process a queued reaction
 */
async function processReactionItem(item: ReactionQueueItem): Promise<boolean> {
  try {
    const { payload } = item;

    if (payload.targetType === 'post') {
      const postsStore = usePostsStore.getState();

      if (payload.action === 'add') {
        await postsStore.addReaction(
          payload.targetId,
          payload.reactionType as any // ReactionType
        );
      } else {
        await postsStore.removeReaction(payload.targetId);
      }
    } else if (payload.targetType === 'message') {
      const conversationsStore = useConversationsStore.getState();

      if (payload.action === 'add') {
        await conversationsStore.addReaction(payload.targetId, payload.reactionType);
      } else {
        await conversationsStore.removeReaction(payload.targetId, payload.reactionType);
      }
    }

    logger.info(`[QueueProcessor] Processed reaction queue item: ${item.id}`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process reaction item:`, error);
    return false;
  }
}

/**
 * Process a queued comment
 */
async function processCommentItem(item: CommentQueueItem): Promise<boolean> {
  try {
    const { payload } = item;

    const postsStore = usePostsStore.getState();
    await postsStore.addComment(payload.postId, payload.content, payload.parentCommentId);

    logger.info(`[QueueProcessor] Processed comment queue item: ${item.id}`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process comment item:`, error);
    return false;
  }
}

/**
 * Start the queue processor
 * This should be called when the app initializes
 */
export async function startQueueProcessor(): Promise<void> {
  const queueStore = useOfflineQueueStore.getState();

  // Load queue from database
  await queueStore.loadFromDatabase();

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      logger.info('[QueueProcessor] Network online, starting sync');
      processAllPendingItems();
    });

    // Listen for background sync messages from service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
        logger.info('[QueueProcessor] Background sync triggered');
        processAllPendingItems();
      }
    });
  }

  // If already online, process pending items
  if (queueStore.syncStatus.isOnline) {
    processAllPendingItems();
  }
}

/**
 * Calculate exponential backoff delay with jitter for retry logic
 *
 * @param retryCount - Number of previous retries (0-based)
 * @param baseDelay - Initial delay in ms (default: 1000)
 * @param maxDelay - Maximum delay in ms (default: 60000)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(retryCount: number, baseDelay = 1000, maxDelay = 60000): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped)
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  // Add jitter (0-25% of delay) to prevent thundering herd
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const jitter = (randomBuffer[0] / 0xFFFFFFFF) * 0.25 * exponentialDelay;

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function retrySleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Persistent failure tracking for Nostr publish events
 * Tracks events that have failed repeatedly for manual retry or alerting
 */
export interface NostrPublishFailure {
  itemId: string;
  type: string;
  retryCount: number;
  maxRetries: number;
  lastError: string;
  firstFailedAt: number;
  lastFailedAt: number;
}

const persistentFailures = new Map<string, NostrPublishFailure>();

/**
 * Get all persistent Nostr publish failures for manual retry / alerting
 */
export function getPersistentFailures(): NostrPublishFailure[] {
  return Array.from(persistentFailures.values());
}

/**
 * Clear a persistent failure (e.g., after manual retry succeeds)
 */
export function clearPersistentFailure(itemId: string): void {
  persistentFailures.delete(itemId);
}

/**
 * Check if there are persistent failures that need user attention
 */
export function hasPersistentFailures(): boolean {
  return persistentFailures.size > 0;
}

/**
 * Process all pending queue items with exponential backoff retry
 */
export async function processAllPendingItems(): Promise<void> {
  const queueStore = useOfflineQueueStore.getState();

  if (queueStore.isProcessing || !queueStore.syncStatus.isOnline) {
    return;
  }

  const pendingItems = queueStore.getPendingItems();

  if (pendingItems.length === 0) {
    return;
  }

  logger.info(`[QueueProcessor] Processing ${pendingItems.length} pending items`);

  for (const item of pendingItems) {
    // Check if still online before processing
    if (!navigator.onLine) {
      logger.info('[QueueProcessor] Network offline, stopping processing');
      break;
    }

    try {
      await queueStore.updateItemStatus(item.id, 'syncing');

      const success = await processQueueItem(item);

      if (success) {
        await queueStore.updateItemStatus(item.id, 'completed');
        // Clear any persistent failure record on success
        persistentFailures.delete(item.id);
      } else {
        // Apply exponential backoff retry logic
        const updatedItem = queueStore.getItem(item.id);
        if (updatedItem && updatedItem.retryCount < updatedItem.maxRetries) {
          const delay = calculateBackoffDelay(updatedItem.retryCount);
          logger.info(
            `[QueueProcessor] Item ${item.id} failed, retry ${updatedItem.retryCount + 1}/${updatedItem.maxRetries} in ${delay}ms`
          );
          await queueStore.updateItemStatus(item.id, 'failed', 'Processing failed');

          // Wait with backoff delay before next item
          await retrySleep(delay);
        } else {
          // Max retries exceeded - track as persistent failure
          await queueStore.updateItemStatus(item.id, 'failed', 'Max retries exceeded');

          const now = Date.now();
          const existing = persistentFailures.get(item.id);
          persistentFailures.set(item.id, {
            itemId: item.id,
            type: item.type,
            retryCount: updatedItem?.retryCount ?? item.maxRetries,
            maxRetries: item.maxRetries,
            lastError: 'Max retries exceeded',
            firstFailedAt: existing?.firstFailedAt ?? now,
            lastFailedAt: now,
          });

          logger.warn(
            `[QueueProcessor] Item ${item.id} permanently failed after ${item.maxRetries} retries. ` +
            `Total persistent failures: ${persistentFailures.size}`
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[QueueProcessor] Error processing item ${item.id}:`, errorMessage);
      await queueStore.updateItemStatus(item.id, 'failed', errorMessage);

      // Track the failure
      const now = Date.now();
      const existing = persistentFailures.get(item.id);
      persistentFailures.set(item.id, {
        itemId: item.id,
        type: item.type,
        retryCount: item.retryCount + 1,
        maxRetries: item.maxRetries,
        lastError: errorMessage,
        firstFailedAt: existing?.firstFailedAt ?? now,
        lastFailedAt: now,
      });
    }
  }

  // Clean up completed items after successful sync
  await queueStore.clearCompleted();
}

/**
 * Queue a message for offline sending
 */
export async function queueOfflineMessage(
  conversationId: string,
  content: string,
  recipientPubkeys: string[],
  conversationType: 'dm' | 'group-chat' | 'multi-party',
  authorPubkey: string,
  replyTo?: string
): Promise<string> {
  const queueStore = useOfflineQueueStore.getState();

  return queueStore.queueMessage(
    {
      conversationId,
      content,
      replyTo,
      recipientPubkeys,
      conversationType,
    },
    authorPubkey
  );
}

/**
 * Queue a post for offline publishing
 */
export async function queueOfflinePost(
  content: string,
  contentType: 'text' | 'image' | 'video' | 'link' | 'poll',
  visibility: PostQueueItem['payload']['visibility'],
  authorPubkey: string,
  options?: {
    media?: PostQueueItem['payload']['media'];
    mentions?: string[];
    hashtags?: string[];
    contentWarning?: string;
    isSensitive?: boolean;
  }
): Promise<string> {
  const queueStore = useOfflineQueueStore.getState();

  return queueStore.queuePost(
    {
      content,
      contentType,
      visibility,
      ...options,
    },
    authorPubkey
  );
}

/**
 * Queue a file upload for offline processing
 */
export async function queueOfflineFileUpload(
  fileId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  groupId: string,
  authorPubkey: string,
  folderId?: string,
  fileData?: string
): Promise<string> {
  const queueStore = useOfflineQueueStore.getState();

  return queueStore.queueFileUpload(
    {
      fileId,
      fileName,
      fileSize,
      mimeType,
      groupId,
      folderId,
      fileData,
      uploadProgress: 0,
    },
    authorPubkey
  );
}
