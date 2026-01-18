/**
 * Store Initializer
 * Manages loading data from Dexie into Zustand stores after unlock
 * and clearing stores on lock.
 *
 * This implements the "Dexie as sole source of truth" pattern:
 * - All state is loaded from Dexie after unlock
 * - Zustand stores are memory-only reactive cache
 * - On lock, all stores are cleared from memory
 */

import { secureKeyManager, type SecureKeyManagerEvent } from '@/core/crypto/SecureKeyManager';
import { getDB } from './db';
import { clearLocalEncryptionKey } from './EncryptedDB';

// Import stores for initialization
import { useAuthStore } from '@/stores/authStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { useContactsStore } from '@/stores/contactsStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTorStore } from '@/modules/security/tor/torStore';
import { useFriendsStore } from '@/modules/friends/friendsStore';
import { useConversationsStore } from '@/core/messaging/conversationsStore';

// Module stores
import { useEventsStore } from '@/modules/events/eventsStore';
import { useMutualAidStore } from '@/modules/mutual-aid/mutualAidStore';
import { useFormsStore } from '@/modules/forms/formsStore';
import { usePublicStore } from '@/modules/public/publicStore';
import { useFundraisingStore } from '@/modules/fundraising/fundraisingStore';
import { usePostsStore } from '@/modules/microblogging/postsStore';

import { logger } from '@/lib/logger';
/**
 * Store Initializer Service
 * Manages the lifecycle of Zustand stores based on app lock/unlock state
 */
class StoreInitializerService {
  private static instance: StoreInitializerService;
  private unsubscribe: (() => void) | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): StoreInitializerService {
    if (!StoreInitializerService.instance) {
      StoreInitializerService.instance = new StoreInitializerService();
    }
    return StoreInitializerService.instance;
  }

  /**
   * Initialize the store initializer
   * Subscribes to SecureKeyManager events
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.warn('StoreInitializer already initialized');
      return;
    }

    logger.info('🔧 Initializing StoreInitializer...');

    // Subscribe to SecureKeyManager events
    this.unsubscribe = secureKeyManager.addEventListener(
      this.handleSecurityEvent.bind(this)
    );

    this.isInitialized = true;
    logger.info('✅ StoreInitializer ready');
  }

  /**
   * Handle security events from SecureKeyManager
   */
  private handleSecurityEvent(event: SecureKeyManagerEvent): void {
    switch (event.type) {
      case 'unlocked':
        logger.info('🔓 App unlocked - loading stores from Dexie...');
        this.loadAllStores(event.publicKey).catch((error) => {
          console.error('Failed to load stores:', error);
        });
        break;

      case 'locked':
        logger.info('🔒 App locked - clearing all stores...');
        this.clearAllStores();
        break;

      case 'lock-timeout-warning':
        logger.info(`⏰ Lock timeout warning: ${event.secondsRemaining}s remaining`);
        break;
    }
  }

  /**
   * Load all stores from Dexie
   * Called after successful unlock
   */
  private async loadAllStores(userPubkey: string): Promise<void> {
    const db = getDB();

    try {
      // Load core data in parallel
      await Promise.all([
        this.loadGroupsStore(db, userPubkey),
        this.loadFriendsStore(db, userPubkey),
        this.loadConversationsStore(db, userPubkey),
        this.loadContactsStore(db, userPubkey),
        this.loadDeviceStore(db),
        this.loadTorStore(),
        // Module stores
        this.loadEventsStore(db),
        this.loadMutualAidStore(db),
        this.loadFormsStore(db),
        this.loadPublicStore(db),
        this.loadFundraisingStore(db),
        this.loadPostsStore(db, userPubkey),
      ]);

      logger.info('✅ All stores loaded from Dexie');
    } catch (error) {
      console.error('Error loading stores:', error);
      throw error;
    }
  }

  /**
   * Load groups store from Dexie
   */
  private async loadGroupsStore(db: ReturnType<typeof getDB>, userPubkey: string): Promise<void> {
    try {
      // Get groups where user is a member
      const memberships = await db.groupMembers
        .where('pubkey')
        .equals(userPubkey)
        .toArray();

      const groupIds = memberships.map((m) => m.groupId);

      const groups = groupIds.length > 0
        ? await db.groups.where('id').anyOf(groupIds).toArray()
        : [];

      // Build group members map
      const groupMembers = new Map<string, typeof memberships>();
      for (const groupId of groupIds) {
        const members = await db.groupMembers
          .where('groupId')
          .equals(groupId)
          .toArray();
        groupMembers.set(groupId, members);
      }

      useGroupsStore.setState({
        groups,
        groupMembers,
        isLoading: false,
        error: null,
      });

      logger.info(`📦 Loaded ${groups.length} groups`);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }

  /**
   * Load friends store from Dexie
   */
  private async loadFriendsStore(db: ReturnType<typeof getDB>, userPubkey: string): Promise<void> {
    try {
      const friends = await db.friends
        .where('userPubkey')
        .equals(userPubkey)
        .toArray();

      // Get both incoming and outgoing requests
      const friendRequests = await db.friendRequests
        .where('toPubkey')
        .equals(userPubkey)
        .or('fromPubkey')
        .equals(userPubkey)
        .toArray();

      const inviteLinks = await db.friendInviteLinks
        .where('creatorPubkey')
        .equals(userPubkey)
        .toArray();

      useFriendsStore.setState({
        friends,
        friendRequests,
        inviteLinks,
        isLoading: false,
      });

      logger.info(`📦 Loaded ${friends.length} friends`);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  }

  /**
   * Load conversations store from Dexie
   */
  private async loadConversationsStore(db: ReturnType<typeof getDB>, userPubkey: string): Promise<void> {
    try {
      // Get conversations where user is a participant
      const conversations = await db.conversations
        .filter((c) => c.participants?.includes(userPubkey))
        .toArray();

      // Get members for each conversation
      const allMembers = [];
      for (const conv of conversations) {
        const convMembers = await db.conversationMembers
          .where('conversationId')
          .equals(conv.id)
          .toArray();
        allMembers.push(...convMembers);
      }

      useConversationsStore.setState({
        conversations,
        conversationMembers: allMembers,
        messages: [], // Messages loaded on demand per conversation
        isLoading: false,
      });

      logger.info(`📦 Loaded ${conversations.length} conversations`);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  /**
   * Load contacts store from Dexie
   * Note: Contacts are not stored in Dexie yet, but initialized empty
   */
  private async loadContactsStore(_db: ReturnType<typeof getDB>, _userPubkey: string): Promise<void> {
    // Contacts are currently derived from friends and fetched from Nostr
    // Just reset to empty state for now
    useContactsStore.setState({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load device store from Dexie
   * Note: Device data is currently not persisted to Dexie
   */
  private async loadDeviceStore(_db: ReturnType<typeof getDB>): Promise<void> {
    // Device data will be fetched/generated on demand
    // Just reset loading state
    useDeviceStore.getState().initializeCurrentDevice();
  }

  /**
   * Load Tor store
   * Just initialize detection
   */
  private async loadTorStore(): Promise<void> {
    useTorStore.getState().initialize();
  }

  /**
   * Load events store from Dexie
   */
  private async loadEventsStore(db: ReturnType<typeof getDB>): Promise<void> {
    try {
      const events = db.events ? await db.events.toArray() : [];
      const rsvps = db.rsvps ? await db.rsvps.toArray() : [];

      useEventsStore.setState({
        events,
        rsvps,
        activeEventId: null,
      });

      logger.info(`📦 Loaded ${events.length} events`);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }

  /**
   * Load mutual aid store from Dexie
   */
  private async loadMutualAidStore(db: ReturnType<typeof getDB>): Promise<void> {
    try {
      const aidItems = db.mutualAidRequests ? await db.mutualAidRequests.toArray() : [];

      useMutualAidStore.setState({
        aidItems,
        rideShares: [], // Not yet persisted to Dexie
        activeAidItemId: null,
      });

      logger.info(`📦 Loaded ${aidItems.length} mutual aid items`);
    } catch (error) {
      console.error('Failed to load mutual aid:', error);
    }
  }

  /**
   * Load forms store
   * Forms are currently not persisted to Dexie
   */
  private async loadFormsStore(_db: ReturnType<typeof getDB>): Promise<void> {
    useFormsStore.setState({
      forms: new Map(),
      submissions: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load public store
   * Public pages are currently not persisted to Dexie
   */
  private async loadPublicStore(_db: ReturnType<typeof getDB>): Promise<void> {
    usePublicStore.setState({
      publicPages: new Map(),
      analytics: new Map(),
      analyticsSummaries: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load fundraising store
   * Campaigns are currently not persisted to Dexie
   */
  private async loadFundraisingStore(_db: ReturnType<typeof getDB>): Promise<void> {
    useFundraisingStore.setState({
      campaigns: new Map(),
      campaignUpdates: new Map(),
      donations: new Map(),
      donationTiers: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load posts store from Dexie
   */
  private async loadPostsStore(db: ReturnType<typeof getDB>, _userPubkey: string): Promise<void> {
    try {
      // Check if posts table exists (it's a module table)
      if (!db.posts) {
        usePostsStore.setState({
          posts: [],
          currentPost: null,
          reactions: [],
          myReactions: new Map(),
          comments: [],
          reposts: [],
          myReposts: new Set(),
          bookmarks: [],
          myBookmarks: new Set(),
          feedFilter: { type: 'all', limit: 20 },
          isLoadingFeed: false,
          hasMorePosts: true,
        });
        return;
      }

      const posts = await db.posts.orderBy('createdAt').reverse().limit(50).toArray();
      const reactions = await db.reactions?.toArray() || [];
      const comments = await db.comments?.toArray() || [];
      const reposts = await db.reposts?.toArray() || [];
      const bookmarks = await db.bookmarks?.toArray() || [];

      usePostsStore.setState({
        posts,
        currentPost: null,
        reactions,
        myReactions: new Map(),
        comments,
        reposts,
        myReposts: new Set(),
        bookmarks,
        myBookmarks: new Set(),
        feedFilter: { type: 'all', limit: 20 },
        isLoadingFeed: false,
        hasMorePosts: posts.length === 50,
      });

      logger.info(`📦 Loaded ${posts.length} posts`);
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  }

  /**
   * Clear all stores
   * Called on lock
   */
  private clearAllStores(): void {
    // Clear local encryption key first
    clearLocalEncryptionKey();

    // Clear auth store (but keep encrypted identities)
    const { identities } = useAuthStore.getState();
    useAuthStore.setState({
      currentIdentity: null,
      lockState: 'locked',
      isLoading: false,
      isUnlocking: false,
      error: null,
      lockTimeoutWarning: null,
      // Keep encrypted identities for unlock screen
      identities,
    });

    // Clear groups store
    useGroupsStore.setState({
      activeGroup: null,
      groups: [],
      groupMembers: new Map(),
      isLoading: false,
      error: null,
    });

    // Clear friends store
    useFriendsStore.getState().clearCache();

    // Clear conversations store
    useConversationsStore.setState({
      conversations: [],
      conversationMembers: [],
      messages: [],
      presence: new Map(),
      chatWindows: [],
      isLoading: false,
      currentConversationId: undefined,
    });

    // Clear contacts store
    useContactsStore.setState({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,
    });

    // Clear device store - reset to initial state
    // Note: We don't clear devices/credentials as they may be needed for unlock
    useDeviceStore.setState({
      sessions: new Map(),
      activities: [],
      currentDeviceId: null,
    });

    // Clear events store
    useEventsStore.getState().clearEvents();

    // Clear mutual aid store
    useMutualAidStore.getState().clearAll();

    // Clear forms store
    useFormsStore.getState().clearAll();

    // Clear public store
    usePublicStore.getState().clearAll();

    // Clear fundraising store
    useFundraisingStore.getState().clearAll();

    // Clear posts store
    usePostsStore.getState().clearCache();

    logger.info('✅ All stores cleared');
  }

  /**
   * Cleanup - unsubscribe from events
   */
  public cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
  }
}

// Export singleton
export const storeInitializer = StoreInitializerService.getInstance();

/**
 * Initialize the store initializer
 * Call this on app startup
 */
export function initializeStoreInitializer(): void {
  storeInitializer.initialize();
}
