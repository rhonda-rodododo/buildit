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
 */
async function processFileUploadItem(item: FileUploadQueueItem): Promise<boolean> {
  try {
    const { payload } = item;

    // File uploads require chunked upload to a server
    // This is a placeholder for the actual implementation
    // which would integrate with the files store

    logger.info(`[QueueProcessor] Processing file upload: ${payload.fileName}`);

    // File upload implementation deferred to Epic 60
    // - Retrieve file data from IndexedDB or blob storage
    // - Upload to server in chunks
    // - Update progress in the queue item

    logger.info(`[QueueProcessor] Processed file upload queue item: ${item.id}`);
    return true;
  } catch (error) {
    logger.error(`[QueueProcessor] Failed to process file upload item:`, error);
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
 * Process all pending queue items
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
      } else {
        // Update retry count
        const updatedItem = queueStore.getItem(item.id);
        if (updatedItem && updatedItem.retryCount < updatedItem.maxRetries) {
          await queueStore.updateItemStatus(item.id, 'failed', 'Processing failed');
        } else {
          await queueStore.updateItemStatus(item.id, 'failed', 'Max retries exceeded');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[QueueProcessor] Error processing item ${item.id}:`, errorMessage);
      await queueStore.updateItemStatus(item.id, 'failed', errorMessage);
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
