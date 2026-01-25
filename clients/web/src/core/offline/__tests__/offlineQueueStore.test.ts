/**
 * OfflineQueueStore Tests
 * Tests for offline queue management and sync functionality
 * Epic 60: Offline Mode Enhancement
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useOfflineQueueStore } from '../offlineQueueStore';
import type { RetryConfig } from '../types';

// Mock the db module
vi.mock('@/core/storage/db', () => ({
  db: {
    offlineQueue: {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('offlineQueueStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state with isOnline: false to test queue operations
    // without triggering auto-sync. Tests that need online behavior
    // should explicitly set isOnline: true.
    useOfflineQueueStore.setState({
      items: new Map(),
      syncStatus: {
        isOnline: false,
        isSyncing: false,
        lastSyncSuccess: true,
        pendingCount: 0,
        failedCount: 0,
        backgroundSyncRegistered: false,
      },
      backgroundSyncSupported: false,
      isProcessing: false,
      retryConfig: {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: 0.1,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queueMessage', () => {
    it('should queue a message', async () => {
      const { queueMessage } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Hello, world!',
          recipientPubkeys: ['pubkey1', 'pubkey2'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      expect(id).toBeDefined();
      expect(id).toContain('queue-');

      const { items, syncStatus } = useOfflineQueueStore.getState();
      expect(items.size).toBe(1);
      expect(items.get(id)).toBeDefined();
      expect(items.get(id)?.type).toBe('message');
      expect(items.get(id)?.status).toBe('pending');
      expect(syncStatus.pendingCount).toBe(1);
    });

    it('should set correct payload for message', async () => {
      const { queueMessage } = useOfflineQueueStore.getState();

      const payload = {
        conversationId: 'conv-123',
        content: 'Test message',
        replyTo: 'msg-456',
        recipientPubkeys: ['pubkey1'],
        conversationType: 'group-chat' as const,
      };

      const id = await queueMessage(payload, 'author-pubkey');

      const { items } = useOfflineQueueStore.getState();
      const item = items.get(id);
      expect(item?.payload).toEqual(payload);
      expect(item?.authorPubkey).toBe('author-pubkey');
    });
  });

  describe('queuePost', () => {
    it('should queue a post', async () => {
      const { queuePost } = useOfflineQueueStore.getState();

      const id = await queuePost(
        {
          content: 'This is a test post',
          contentType: 'text',
          visibility: { type: 'public' },
        },
        'author-pubkey'
      );

      expect(id).toBeDefined();

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.type).toBe('post');
      expect(items.get(id)?.status).toBe('pending');
    });

    it('should handle post with media and options', async () => {
      const { queuePost } = useOfflineQueueStore.getState();

      const id = await queuePost(
        {
          content: 'Post with media',
          contentType: 'image',
          visibility: { type: 'followers' },
          media: [{ type: 'image', url: 'https://example.com/image.jpg', alt: 'Test image' }],
          mentions: ['user1', 'user2'],
          hashtags: ['test', 'vitest'],
          contentWarning: 'NSFW',
          isSensitive: true,
        },
        'author-pubkey'
      );

      const { items } = useOfflineQueueStore.getState();
      const item = items.get(id);
      expect(item?.payload.media).toHaveLength(1);
      expect(item?.payload.mentions).toEqual(['user1', 'user2']);
      expect(item?.payload.hashtags).toEqual(['test', 'vitest']);
      expect(item?.payload.isSensitive).toBe(true);
    });
  });

  describe('queueFileUpload', () => {
    it('should queue a file upload', async () => {
      const { queueFileUpload } = useOfflineQueueStore.getState();

      const id = await queueFileUpload(
        {
          fileId: 'file-123',
          fileName: 'document.pdf',
          fileSize: 1024 * 1024,
          mimeType: 'application/pdf',
          groupId: 'group-456',
          uploadProgress: 0,
        },
        'author-pubkey'
      );

      expect(id).toBeDefined();

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.type).toBe('file-upload');
      expect(items.get(id)?.payload.fileName).toBe('document.pdf');
      expect(items.get(id)?.payload.uploadProgress).toBe(0);
    });
  });

  describe('queueReaction', () => {
    it('should queue a reaction', async () => {
      const { queueReaction } = useOfflineQueueStore.getState();

      const id = await queueReaction(
        {
          targetId: 'post-123',
          targetType: 'post',
          reactionType: 'like',
          action: 'add',
        },
        'author-pubkey'
      );

      expect(id).toBeDefined();

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.type).toBe('reaction');
      expect(items.get(id)?.payload.action).toBe('add');
    });
  });

  describe('queueComment', () => {
    it('should queue a comment', async () => {
      const { queueComment } = useOfflineQueueStore.getState();

      const id = await queueComment(
        {
          postId: 'post-123',
          content: 'Great post!',
        },
        'author-pubkey'
      );

      expect(id).toBeDefined();

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.type).toBe('comment');
    });

    it('should handle reply comments', async () => {
      const { queueComment } = useOfflineQueueStore.getState();

      const id = await queueComment(
        {
          postId: 'post-123',
          content: 'Reply to comment',
          parentCommentId: 'comment-456',
        },
        'author-pubkey'
      );

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.payload.parentCommentId).toBe('comment-456');
    });
  });

  describe('removeItem', () => {
    it('should remove an item from the queue', async () => {
      const { queueMessage, removeItem } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await removeItem(id);

      const { items, syncStatus } = useOfflineQueueStore.getState();
      expect(items.has(id)).toBe(false);
      expect(syncStatus.pendingCount).toBe(0);
    });

    it('should update pending count correctly', async () => {
      const { queueMessage, removeItem } = useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      const id2 = await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(2);

      await removeItem(id1);
      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(1);

      await removeItem(id2);
      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(0);
    });
  });

  describe('updateItemStatus', () => {
    it('should update item status', async () => {
      const { queueMessage, updateItemStatus } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id, 'syncing');

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.status).toBe('syncing');
    });

    it('should update pending and failed counts correctly', async () => {
      const { queueMessage, updateItemStatus } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(1);
      expect(useOfflineQueueStore.getState().syncStatus.failedCount).toBe(0);

      await updateItemStatus(id, 'failed', 'Network error');

      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(0);
      expect(useOfflineQueueStore.getState().syncStatus.failedCount).toBe(1);

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.lastError).toBe('Network error');
    });

    it('should mark item as completed', async () => {
      const { queueMessage, updateItemStatus } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id, 'completed');

      const { items, syncStatus } = useOfflineQueueStore.getState();
      expect(items.get(id)?.status).toBe('completed');
      expect(syncStatus.pendingCount).toBe(0);
    });
  });

  describe('getItemsByType', () => {
    it('should filter items by type', async () => {
      const { queueMessage, queuePost, queueReaction, getItemsByType } =
        useOfflineQueueStore.getState();

      await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await queuePost(
        {
          content: 'Test post',
          contentType: 'text',
          visibility: { type: 'public' },
        },
        'author-pubkey'
      );

      await queueReaction(
        {
          targetId: 'post-123',
          targetType: 'post',
          reactionType: 'like',
          action: 'add',
        },
        'author-pubkey'
      );

      const messages = getItemsByType('message');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('message');

      const posts = getItemsByType('post');
      expect(posts).toHaveLength(1);

      const reactions = getItemsByType('reaction');
      expect(reactions).toHaveLength(1);
    });
  });

  describe('getItemsByStatus', () => {
    it('should filter items by status', async () => {
      const { queueMessage, updateItemStatus, getItemsByStatus } =
        useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id1, 'failed');

      const pending = getItemsByStatus('pending');
      const failed = getItemsByStatus('failed');

      expect(pending).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });

  describe('retryItem', () => {
    it('should reset failed item to pending', async () => {
      const { queueMessage, updateItemStatus, retryItem } =
        useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id, 'failed', 'Network error');

      await retryItem(id);

      const { items, syncStatus } = useOfflineQueueStore.getState();
      expect(items.get(id)?.status).toBe('pending');
      expect(syncStatus.pendingCount).toBe(1);
      expect(syncStatus.failedCount).toBe(0);
    });

    it('should not retry non-failed items', async () => {
      const { queueMessage, retryItem } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      // Item is pending, not failed
      await retryItem(id);

      const { items } = useOfflineQueueStore.getState();
      expect(items.get(id)?.status).toBe('pending');
    });
  });

  describe('retryAllFailed', () => {
    it('should retry all failed items', async () => {
      const { queueMessage, updateItemStatus, retryAllFailed, getFailedItems } =
        useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      const id2 = await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id1, 'failed');
      await updateItemStatus(id2, 'failed');

      expect(getFailedItems()).toHaveLength(2);

      await retryAllFailed();

      expect(getFailedItems()).toHaveLength(0);
      expect(useOfflineQueueStore.getState().syncStatus.pendingCount).toBe(2);
    });
  });

  describe('clearCompleted', () => {
    it('should clear all completed items', async () => {
      const { queueMessage, updateItemStatus, clearCompleted } =
        useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      const id2 = await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id1, 'completed');

      await clearCompleted();

      const { items } = useOfflineQueueStore.getState();
      expect(items.has(id1)).toBe(false);
      expect(items.has(id2)).toBe(true);
    });
  });

  describe('clearFailed', () => {
    it('should clear all failed items', async () => {
      const { queueMessage, updateItemStatus, clearFailed, getFailedItems } =
        useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id1, 'failed');

      await clearFailed();

      expect(getFailedItems()).toHaveLength(0);
      expect(useOfflineQueueStore.getState().items.size).toBe(1);
    });
  });

  describe('setOnlineStatus', () => {
    it('should update online status', () => {
      const { setOnlineStatus } = useOfflineQueueStore.getState();

      setOnlineStatus(false);
      expect(useOfflineQueueStore.getState().syncStatus.isOnline).toBe(false);

      setOnlineStatus(true);
      expect(useOfflineQueueStore.getState().syncStatus.isOnline).toBe(true);
    });
  });

  describe('setRetryConfig', () => {
    it('should update retry configuration', () => {
      const { setRetryConfig } = useOfflineQueueStore.getState();

      setRetryConfig({
        maxRetries: 10,
        initialDelay: 2000,
      });

      const { retryConfig } = useOfflineQueueStore.getState();
      expect(retryConfig.maxRetries).toBe(10);
      expect(retryConfig.initialDelay).toBe(2000);
      // Other values should remain unchanged
      expect(retryConfig.maxDelay).toBe(60000);
      expect(retryConfig.backoffMultiplier).toBe(2);
    });
  });

  describe('getPendingItems and getFailedItems', () => {
    it('should return correct items', async () => {
      const { queueMessage, updateItemStatus, getPendingItems, getFailedItems } =
        useOfflineQueueStore.getState();

      const id1 = await queueMessage(
        {
          conversationId: 'conv-1',
          content: 'Test 1',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      const id2 = await queueMessage(
        {
          conversationId: 'conv-2',
          content: 'Test 2',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );
      await queueMessage(
        {
          conversationId: 'conv-3',
          content: 'Test 3',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      await updateItemStatus(id1, 'failed');
      await updateItemStatus(id2, 'completed');

      const pending = getPendingItems();
      const failed = getFailedItems();

      expect(pending).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });

  describe('queue item properties', () => {
    it('should set correct retry count and max retries', async () => {
      const { queueMessage } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      const { items } = useOfflineQueueStore.getState();
      const item = items.get(id);
      expect(item?.retryCount).toBe(0);
      expect(item?.maxRetries).toBe(5); // Default from retryConfig
    });

    it('should set timestamps correctly', async () => {
      const before = Date.now();
      const { queueMessage } = useOfflineQueueStore.getState();

      const id = await queueMessage(
        {
          conversationId: 'conv-123',
          content: 'Test',
          recipientPubkeys: ['pubkey1'],
          conversationType: 'dm',
        },
        'author-pubkey'
      );

      const after = Date.now();
      const { items } = useOfflineQueueStore.getState();
      const item = items.get(id);

      expect(item?.createdAt).toBeGreaterThanOrEqual(before);
      expect(item?.createdAt).toBeLessThanOrEqual(after);
      expect(item?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(item?.updatedAt).toBeLessThanOrEqual(after);
    });
  });
});
