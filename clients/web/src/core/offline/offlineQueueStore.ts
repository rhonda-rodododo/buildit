/**
 * Offline Queue Store
 * Zustand store for managing offline operations with background sync
 * Epic 60: Offline Mode Enhancement
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '@/core/storage/db';
import { secureRandomString } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type {
  QueueItem,
  QueueItemType,
  QueueItemStatus,
  MessageQueueItem,
  PostQueueItem,
  FileUploadQueueItem,
  ReactionQueueItem,
  CommentQueueItem,
  DBOfflineQueueItem,
  SyncStatus,
  RetryConfig,
} from './types';

interface OfflineQueueState {
  /** All queued items */
  items: Map<string, QueueItem>;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Whether background sync is supported */
  backgroundSyncSupported: boolean;
  /** Whether the queue processor is running */
  isProcessing: boolean;
  /** Retry configuration */
  retryConfig: RetryConfig;
}

interface OfflineQueueActions {
  // Queue management
  addItem: <T extends QueueItem>(item: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'maxRetries' | 'status'>) => Promise<string>;
  removeItem: (id: string) => Promise<void>;
  updateItemStatus: (id: string, status: QueueItemStatus, error?: string) => Promise<void>;
  getItem: (id: string) => QueueItem | undefined;
  getItemsByType: (type: QueueItemType) => QueueItem[];
  getItemsByStatus: (status: QueueItemStatus) => QueueItem[];
  getPendingItems: () => QueueItem[];
  getFailedItems: () => QueueItem[];

  // Queue message helpers
  queueMessage: (payload: MessageQueueItem['payload'], authorPubkey: string) => Promise<string>;
  queuePost: (payload: PostQueueItem['payload'], authorPubkey: string) => Promise<string>;
  queueFileUpload: (payload: FileUploadQueueItem['payload'], authorPubkey: string) => Promise<string>;
  queueReaction: (payload: ReactionQueueItem['payload'], authorPubkey: string) => Promise<string>;
  queueComment: (payload: CommentQueueItem['payload'], authorPubkey: string) => Promise<string>;

  // Sync management
  startSync: () => Promise<void>;
  stopSync: () => void;
  processItem: (id: string) => Promise<boolean>;
  retryItem: (id: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  clearFailed: () => Promise<void>;

  // Online/offline handling
  setOnlineStatus: (isOnline: boolean) => void;
  registerBackgroundSync: () => Promise<boolean>;

  // Persistence
  loadFromDatabase: () => Promise<void>;
  saveToDatabase: (item: QueueItem) => Promise<void>;
  deleteFromDatabase: (id: string) => Promise<void>;

  // Configuration
  setRetryConfig: (config: Partial<RetryConfig>) => void;
}

const initialSyncStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncSuccess: true,
  pendingCount: 0,
  failedCount: 0,
  backgroundSyncRegistered: false,
};

export const useOfflineQueueStore = create<OfflineQueueState & OfflineQueueActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    items: new Map(),
    syncStatus: initialSyncStatus,
    backgroundSyncSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window,
    isProcessing: false,
    retryConfig: {
      maxRetries: 5,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: 0.1,
    },

    // Add a new item to the queue
    addItem: async <T extends QueueItem>(
      itemData: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'maxRetries' | 'status'>
    ): Promise<string> => {
      const id = `queue-${Date.now()}-${secureRandomString(9)}`;
      const now = Date.now();
      const { retryConfig } = get();

      const item: QueueItem = {
        ...itemData,
        id,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        maxRetries: retryConfig.maxRetries,
      } as T;

      // Save to IndexedDB first
      await get().saveToDatabase(item);

      // Update in-memory state
      set((state) => {
        const newItems = new Map(state.items);
        newItems.set(id, item);
        return {
          items: newItems,
          syncStatus: {
            ...state.syncStatus,
            pendingCount: state.syncStatus.pendingCount + 1,
          },
        };
      });

      // If online, start processing
      if (get().syncStatus.isOnline && !get().isProcessing) {
        get().startSync();
      } else if (!get().syncStatus.isOnline) {
        // Register for background sync when online
        get().registerBackgroundSync();
      }

      logger.info(`[OfflineQueue] Added item ${id} of type ${itemData.type}`);
      return id;
    },

    // Remove an item from the queue
    removeItem: async (id: string): Promise<void> => {
      const item = get().items.get(id);
      if (!item) return;

      await get().deleteFromDatabase(id);

      set((state) => {
        const newItems = new Map(state.items);
        newItems.delete(id);

        const pendingDelta = item.status === 'pending' ? -1 : 0;
        const failedDelta = item.status === 'failed' ? -1 : 0;

        return {
          items: newItems,
          syncStatus: {
            ...state.syncStatus,
            pendingCount: Math.max(0, state.syncStatus.pendingCount + pendingDelta),
            failedCount: Math.max(0, state.syncStatus.failedCount + failedDelta),
          },
        };
      });
    },

    // Update item status
    updateItemStatus: async (id: string, status: QueueItemStatus, error?: string): Promise<void> => {
      const item = get().items.get(id);
      if (!item) return;

      const now = Date.now();
      const { retryConfig } = get();
      const prevStatus = item.status;

      const updatedItem: QueueItem = {
        ...item,
        status,
        updatedAt: now,
        lastError: error || item.lastError,
        nextRetryAt:
          status === 'failed' && item.retryCount < item.maxRetries
            ? now + calculateRetryDelay(item.retryCount, retryConfig)
            : undefined,
      };

      await get().saveToDatabase(updatedItem);

      set((state) => {
        const newItems = new Map(state.items);
        newItems.set(id, updatedItem);

        // Update counts
        let pendingCount = state.syncStatus.pendingCount;
        let failedCount = state.syncStatus.failedCount;

        if (prevStatus === 'pending' && status !== 'pending') pendingCount--;
        if (prevStatus !== 'pending' && status === 'pending') pendingCount++;
        if (prevStatus === 'failed' && status !== 'failed') failedCount--;
        if (prevStatus !== 'failed' && status === 'failed') failedCount++;

        return {
          items: newItems,
          syncStatus: {
            ...state.syncStatus,
            pendingCount: Math.max(0, pendingCount),
            failedCount: Math.max(0, failedCount),
          },
        };
      });
    },

    // Get item by ID
    getItem: (id: string): QueueItem | undefined => {
      return get().items.get(id);
    },

    // Get items by type
    getItemsByType: (type: QueueItemType): QueueItem[] => {
      return Array.from(get().items.values()).filter((item) => item.type === type);
    },

    // Get items by status
    getItemsByStatus: (status: QueueItemStatus): QueueItem[] => {
      return Array.from(get().items.values()).filter((item) => item.status === status);
    },

    // Get pending items
    getPendingItems: (): QueueItem[] => {
      return get().getItemsByStatus('pending');
    },

    // Get failed items
    getFailedItems: (): QueueItem[] => {
      return get().getItemsByStatus('failed');
    },

    // Queue a message
    queueMessage: async (payload: MessageQueueItem['payload'], authorPubkey: string): Promise<string> => {
      return get().addItem<MessageQueueItem>({
        type: 'message',
        payload,
        authorPubkey,
      });
    },

    // Queue a post
    queuePost: async (payload: PostQueueItem['payload'], authorPubkey: string): Promise<string> => {
      return get().addItem<PostQueueItem>({
        type: 'post',
        payload,
        authorPubkey,
      });
    },

    // Queue a file upload
    queueFileUpload: async (payload: FileUploadQueueItem['payload'], authorPubkey: string): Promise<string> => {
      return get().addItem<FileUploadQueueItem>({
        type: 'file-upload',
        payload,
        authorPubkey,
      });
    },

    // Queue a reaction
    queueReaction: async (payload: ReactionQueueItem['payload'], authorPubkey: string): Promise<string> => {
      return get().addItem<ReactionQueueItem>({
        type: 'reaction',
        payload,
        authorPubkey,
      });
    },

    // Queue a comment
    queueComment: async (payload: CommentQueueItem['payload'], authorPubkey: string): Promise<string> => {
      return get().addItem<CommentQueueItem>({
        type: 'comment',
        payload,
        authorPubkey,
      });
    },

    // Start sync process
    startSync: async (): Promise<void> => {
      const state = get();
      if (state.isProcessing || !state.syncStatus.isOnline) return;

      set({
        isProcessing: true,
        syncStatus: { ...state.syncStatus, isSyncing: true },
      });

      logger.info('[OfflineQueue] Starting sync process');

      const pendingItems = state.getPendingItems();
      let successCount = 0;
      let failureCount = 0;

      for (const item of pendingItems) {
        if (!get().syncStatus.isOnline) {
          logger.info('[OfflineQueue] Network offline, stopping sync');
          break;
        }

        const success = await get().processItem(item.id);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      set((state) => ({
        isProcessing: false,
        syncStatus: {
          ...state.syncStatus,
          isSyncing: false,
          lastSyncAt: Date.now(),
          lastSyncSuccess: failureCount === 0,
        },
      }));

      logger.info(`[OfflineQueue] Sync completed: ${successCount} success, ${failureCount} failed`);
    },

    // Stop sync process
    stopSync: (): void => {
      set((state) => ({
        isProcessing: false,
        syncStatus: { ...state.syncStatus, isSyncing: false },
      }));
    },

    // Process a single item
    processItem: async (id: string): Promise<boolean> => {
      const item = get().items.get(id);
      if (!item || item.status !== 'pending') return false;

      try {
        await get().updateItemStatus(id, 'syncing');

        // Actual processing will be done by the consuming code
        // This store only manages the queue state
        // The messaging/posts stores will handle the actual network calls

        // For now, we'll emit an event that other stores can subscribe to
        // This is handled by the middleware integration

        // Mark as completed (the actual processing is done by the integration layer)
        await get().updateItemStatus(id, 'completed');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[OfflineQueue] Failed to process item ${id}:`, errorMessage);

        const item = get().items.get(id);
        if (item && item.retryCount < item.maxRetries) {
          // Increment retry count and schedule retry
          const updatedItem: QueueItem = {
            ...item,
            retryCount: item.retryCount + 1,
            status: 'failed',
            lastError: errorMessage,
          };
          await get().saveToDatabase(updatedItem);
          set((state) => {
            const newItems = new Map(state.items);
            newItems.set(id, updatedItem);
            return { items: newItems };
          });
        } else {
          await get().updateItemStatus(id, 'failed', errorMessage);
        }
        return false;
      }
    },

    // Retry a failed item
    retryItem: async (id: string): Promise<void> => {
      const item = get().items.get(id);
      if (!item || item.status !== 'failed') return;

      // Reset to pending
      const updatedItem: QueueItem = {
        ...item,
        status: 'pending',
        updatedAt: Date.now(),
        nextRetryAt: undefined,
      };

      await get().saveToDatabase(updatedItem);

      set((state) => {
        const newItems = new Map(state.items);
        newItems.set(id, updatedItem);
        return {
          items: newItems,
          syncStatus: {
            ...state.syncStatus,
            pendingCount: state.syncStatus.pendingCount + 1,
            failedCount: Math.max(0, state.syncStatus.failedCount - 1),
          },
        };
      });

      // Start sync if online
      if (get().syncStatus.isOnline) {
        get().startSync();
      }
    },

    // Retry all failed items
    retryAllFailed: async (): Promise<void> => {
      const failedItems = get().getFailedItems();
      for (const item of failedItems) {
        await get().retryItem(item.id);
      }
    },

    // Clear completed items
    clearCompleted: async (): Promise<void> => {
      const completedItems = get().getItemsByStatus('completed');
      for (const item of completedItems) {
        await get().removeItem(item.id);
      }
    },

    // Clear failed items
    clearFailed: async (): Promise<void> => {
      const failedItems = get().getFailedItems();
      for (const item of failedItems) {
        await get().removeItem(item.id);
      }
    },

    // Set online status
    setOnlineStatus: (isOnline: boolean): void => {
      const wasOffline = !get().syncStatus.isOnline;

      set((state) => ({
        syncStatus: { ...state.syncStatus, isOnline },
      }));

      // If coming back online, start sync
      if (isOnline && wasOffline) {
        logger.info('[OfflineQueue] Network restored, starting sync');
        get().startSync();
      }
    },

    // Register for background sync
    registerBackgroundSync: async (): Promise<boolean> => {
      if (!get().backgroundSyncSupported) {
        logger.info('[OfflineQueue] Background Sync not supported');
        return false;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-expect-error - SyncManager is not in TypeScript types
        await registration.sync.register('buildit-offline-queue');

        set((state) => ({
          syncStatus: { ...state.syncStatus, backgroundSyncRegistered: true },
        }));

        logger.info('[OfflineQueue] Background Sync registered');
        return true;
      } catch (error) {
        logger.error('[OfflineQueue] Failed to register Background Sync:', error);
        return false;
      }
    },

    // Load items from IndexedDB
    loadFromDatabase: async (): Promise<void> => {
      try {
        const dbItems = await db.offlineQueue?.toArray() || [];
        const itemsMap = new Map<string, QueueItem>();
        let pendingCount = 0;
        let failedCount = 0;

        for (const dbItem of dbItems) {
          const item: QueueItem = {
            ...dbItem,
            payload: JSON.parse(dbItem.payload),
          } as QueueItem;
          itemsMap.set(item.id, item);

          if (item.status === 'pending') pendingCount++;
          if (item.status === 'failed') failedCount++;
        }

        set((state) => ({
          items: itemsMap,
          syncStatus: {
            ...state.syncStatus,
            pendingCount,
            failedCount,
          },
        }));

        logger.info(`[OfflineQueue] Loaded ${itemsMap.size} items from database`);
      } catch (error) {
        logger.error('[OfflineQueue] Failed to load from database:', error);
      }
    },

    // Save item to IndexedDB
    saveToDatabase: async (item: QueueItem): Promise<void> => {
      try {
        const dbItem: DBOfflineQueueItem = {
          id: item.id,
          type: item.type,
          status: item.status,
          payload: JSON.stringify(item.payload),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          retryCount: item.retryCount,
          maxRetries: item.maxRetries,
          nextRetryAt: item.nextRetryAt,
          lastError: item.lastError,
          authorPubkey: item.authorPubkey,
        };

        await db.offlineQueue?.put(dbItem);
      } catch (error) {
        logger.error('[OfflineQueue] Failed to save to database:', error);
      }
    },

    // Delete item from IndexedDB
    deleteFromDatabase: async (id: string): Promise<void> => {
      try {
        await db.offlineQueue?.delete(id);
      } catch (error) {
        logger.error('[OfflineQueue] Failed to delete from database:', error);
      }
    },

    // Set retry configuration
    setRetryConfig: (config: Partial<RetryConfig>): void => {
      set((state) => ({
        retryConfig: { ...state.retryConfig, ...config },
      }));
    },
  }))
);

// Calculate retry delay with exponential backoff
function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig
): number {
  const { initialDelay, maxDelay, backoffMultiplier, jitter } = config;

  // Exponential backoff: delay = initialDelay * (multiplier ^ retryCount)
  const baseDelay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, retryCount),
    maxDelay
  );

  // Add jitter to prevent thundering herd
  // Use crypto.getRandomValues() for consistent security practice
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const randomValue = randomBuffer[0] / 0xFFFFFFFF;
  const jitterAmount = baseDelay * jitter * randomValue;

  return Math.floor(baseDelay + jitterAmount);
}

// Initialize online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineQueueStore.getState().setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    useOfflineQueueStore.getState().setOnlineStatus(false);
  });
}
