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
import { dal } from './dal';
import { clearLocalEncryptionKey } from './EncryptedDB';
import type { DBGroup, DBGroupMember } from './db';
import type { DBFriend, FriendRequest, FriendInviteLink } from '@/modules/friends/types';
import type { DBConversation, ConversationMember } from '@/core/messaging/conversationSchema';
import type { AppEvent, RSVP } from '@/modules/events/types';
import type { AidItem } from '@/modules/mutual-aid/types';
import type { DBProposal, DBVote } from '@/modules/governance/schema';
import type { WikiPage, WikiCategory } from '@/modules/wiki/types';
import type { Post, Reaction, Comment, Repost, Bookmark } from '@/modules/microblogging/types';

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
import { useGovernanceStore } from '@/modules/governance/governanceStore';
import { useWikiStore } from '@/modules/wiki/wikiStore';
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
   * Load all stores from database via DAL
   * Called after successful unlock
   */
  private async loadAllStores(userPubkey: string): Promise<void> {
    try {
      // Load core data in parallel
      await Promise.all([
        this.loadGroupsStore(userPubkey),
        this.loadFriendsStore(userPubkey),
        this.loadConversationsStore(userPubkey),
        this.loadContactsStore(),
        this.loadDeviceStore(),
        this.loadTorStore(),
        // Module stores
        this.loadEventsStore(),
        this.loadMutualAidStore(),
        this.loadGovernanceStore(),
        this.loadWikiStore(),
        this.loadFormsStore(),
        this.loadPublicStore(),
        this.loadFundraisingStore(),
        this.loadPostsStore(),
      ]);

      logger.info('✅ All stores loaded from database');
    } catch (error) {
      console.error('Error loading stores:', error);
      throw error;
    }
  }

  /**
   * Load groups store
   */
  private async loadGroupsStore(userPubkey: string): Promise<void> {
    try {
      const memberships = await dal.query<DBGroupMember>('groupMembers', {
        whereClause: { pubkey: userPubkey },
      });

      const groupIds = memberships.map((m) => m.groupId);

      // Get groups by IDs
      const groups: DBGroup[] = [];
      for (const groupId of groupIds) {
        const group = await dal.get<DBGroup>('groups', groupId);
        if (group) groups.push(group);
      }

      // Build group members map
      const groupMembers = new Map<string, DBGroupMember[]>();
      for (const groupId of groupIds) {
        const members = await dal.query<DBGroupMember>('groupMembers', {
          whereClause: { groupId },
        });
        groupMembers.set(groupId, members);
      }

      useGroupsStore.setState({
        groups,
        groupMembers,
        isLoading: false,
        error: null,
      });

      logger.info(`Loaded ${groups.length} groups`);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }

  /**
   * Load friends store
   */
  private async loadFriendsStore(userPubkey: string): Promise<void> {
    try {
      const friends = await dal.query<DBFriend>('friends', {
        whereClause: { userPubkey },
      });

      // Get both incoming and outgoing requests via custom query
      const friendRequests = await dal.queryCustom<FriendRequest>({
        sql: 'SELECT * FROM friend_requests WHERE to_pubkey = ?1 OR from_pubkey = ?1',
        params: [userPubkey],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { friendRequests: { where: (k: string) => { equals: (v: string) => { or: (k: string) => { equals: (v: string) => { toArray: () => Promise<FriendRequest[]> } } } } } };
          return dexieDb.friendRequests
            .where('toPubkey')
            .equals(userPubkey)
            .or('fromPubkey')
            .equals(userPubkey)
            .toArray();
        },
      });

      const inviteLinks = await dal.query<FriendInviteLink>('friendInviteLinks', {
        whereClause: { creatorPubkey: userPubkey },
      });

      useFriendsStore.setState({
        friends,
        friendRequests,
        inviteLinks,
        isLoading: false,
      });

      logger.info(`Loaded ${friends.length} friends`);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  }

  /**
   * Load conversations store
   */
  private async loadConversationsStore(userPubkey: string): Promise<void> {
    try {
      // Get conversations where user is a participant
      // For SQLite: use JSON contains. For Dexie: use filter
      const conversations = await dal.queryCustom<DBConversation>({
        sql: `SELECT * FROM conversations WHERE participants LIKE '%' || ?1 || '%'`,
        params: [userPubkey],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { conversations: { filter: (fn: (c: DBConversation) => boolean) => { toArray: () => Promise<DBConversation[]> } } };
          return dexieDb.conversations
            .filter((c: DBConversation) => c.participants?.includes(userPubkey))
            .toArray();
        },
      });

      // Get members for each conversation
      const allMembers: ConversationMember[] = [];
      for (const conv of conversations) {
        const convMembers = await dal.query<ConversationMember>('conversationMembers', {
          whereClause: { conversationId: conv.id },
        });
        allMembers.push(...convMembers);
      }

      useConversationsStore.setState({
        conversations,
        conversationMembers: allMembers,
        messages: [], // Messages loaded on demand per conversation
        isLoading: false,
      });

      logger.info(`Loaded ${conversations.length} conversations`);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  /**
   * Load contacts store
   * Note: Contacts are not stored in DB yet, but initialized empty
   */
  private async loadContactsStore(): Promise<void> {
    useContactsStore.setState({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load device store
   */
  private async loadDeviceStore(): Promise<void> {
    useDeviceStore.getState().initializeCurrentDevice();
  }

  /**
   * Load Tor store
   */
  private async loadTorStore(): Promise<void> {
    useTorStore.getState().initialize();
  }

  /**
   * Load events store
   */
  private async loadEventsStore(): Promise<void> {
    try {
      const events = await dal.getAll<AppEvent>('events').catch(() => [] as AppEvent[]);
      const rsvps = await dal.getAll<RSVP>('rsvps').catch(() => [] as RSVP[]);

      useEventsStore.setState({
        events,
        rsvps,
        activeEventId: null,
      });

      logger.info(`Loaded ${events.length} events`);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }

  /**
   * Load mutual aid store
   */
  private async loadMutualAidStore(): Promise<void> {
    try {
      const aidItems = await dal.getAll<AidItem>('mutualAidRequests').catch(() => [] as AidItem[]);

      useMutualAidStore.setState({
        aidItems,
        rideShares: [],
        activeAidItemId: null,
      });

      logger.info(`Loaded ${aidItems.length} mutual aid items`);
    } catch (error) {
      console.error('Failed to load mutual aid:', error);
    }
  }

  /**
   * Load governance store
   */
  private async loadGovernanceStore(): Promise<void> {
    try {
      const proposalsArr = await dal.getAll<DBProposal>('proposals').catch(() => [] as DBProposal[]);
      const votesArr = await dal.getAll<DBVote>('votes').catch(() => [] as DBVote[]);

      const proposals: Record<string, DBProposal> = {};
      for (const p of proposalsArr) {
        proposals[p.id] = p;
      }

      const votes: Record<string, DBVote[]> = {};
      for (const v of votesArr) {
        if (!votes[v.proposalId]) votes[v.proposalId] = [];
        votes[v.proposalId].push(v);
      }

      useGovernanceStore.setState({ proposals, votes });

      logger.info(`Loaded ${proposalsArr.length} proposals`);
    } catch (error) {
      console.error('Failed to load governance:', error);
    }
  }

  /**
   * Load wiki store
   */
  private async loadWikiStore(): Promise<void> {
    try {
      const pagesArr = await dal.getAll<WikiPage>('wikiPages').catch(() => [] as WikiPage[]);
      const categoriesArr = await dal.getAll<WikiCategory>('wikiCategories').catch(() => [] as WikiCategory[]);

      const pages: Record<string, WikiPage> = {};
      for (const p of pagesArr) {
        pages[p.id] = p;
      }

      const categories: Record<string, WikiCategory> = {};
      for (const c of categoriesArr) {
        categories[c.id] = c;
      }

      useWikiStore.setState({ pages, categories });

      logger.info(`Loaded ${pagesArr.length} wiki pages`);
    } catch (error) {
      console.error('Failed to load wiki:', error);
    }
  }

  /**
   * Load forms store (not yet persisted to DB)
   */
  private async loadFormsStore(): Promise<void> {
    useFormsStore.setState({
      forms: new Map(),
      submissions: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load public store (not yet persisted to DB)
   */
  private async loadPublicStore(): Promise<void> {
    usePublicStore.setState({
      publicPages: new Map(),
      analytics: new Map(),
      analyticsSummaries: new Map(),
      loading: false,
      error: null,
    });
  }

  /**
   * Load fundraising store (not yet persisted to DB)
   */
  private async loadFundraisingStore(): Promise<void> {
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
   * Load posts store
   */
  private async loadPostsStore(): Promise<void> {
    try {
      const posts = await dal.query<Post>('posts', {
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 50,
      }).catch(() => [] as Post[]);

      const reactions = await dal.getAll<Reaction>('reactions').catch(() => [] as Reaction[]);
      const comments = await dal.getAll<Comment>('comments').catch(() => [] as Comment[]);
      const reposts = await dal.getAll<Repost>('reposts').catch(() => [] as Repost[]);
      const bookmarks = await dal.getAll<Bookmark>('bookmarks').catch(() => [] as Bookmark[]);

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

      logger.info(`Loaded ${posts.length} posts`);
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

    // Clear governance store
    useGovernanceStore.setState({ proposals: {}, votes: {}, results: {} });

    // Clear wiki store
    useWikiStore.setState({ pages: {}, categories: {} });

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
