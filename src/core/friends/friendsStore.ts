/**
 * Friends Store
 * Zustand store for managing friend relationships and contacts
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import type {
  DBFriend,
  FriendRequest,
  FriendInviteLink,
  FriendAddMethod,
  FriendStatus,
  TrustTier,
  FriendFilter,
  FriendStats,
  FriendPrivacySettings,
} from './types';

interface FriendsState {
  // State
  friends: DBFriend[];
  friendRequests: FriendRequest[];
  inviteLinks: FriendInviteLink[];
  isLoading: boolean;

  // Actions - Friends
  addFriend: (friendPubkey: string, method: FriendAddMethod, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockFriend: (friendId: string) => Promise<void>;
  unblockFriend: (friendId: string) => Promise<void>;

  // Actions - Friend Data
  updateFriendNotes: (friendId: string, notes: string) => Promise<void>;
  updateFriendTags: (friendId: string, tags: string[]) => Promise<void>;
  toggleFavorite: (friendId: string) => Promise<void>;
  updatePrivacySettings: (friendId: string, settings: Partial<FriendPrivacySettings>) => Promise<void>;
  markVerifiedInPerson: (friendId: string) => Promise<void>;
  updateTrustTier: (friendId: string, tier: TrustTier) => Promise<void>;

  // Actions - Invite Links
  createInviteLink: (expiresAt?: number, maxUses?: number) => Promise<FriendInviteLink>;
  acceptInviteLink: (code: string) => Promise<void>;
  deleteInviteLink: (linkId: string) => Promise<void>;

  // Queries
  getFriend: (friendPubkey: string) => DBFriend | undefined;
  getFriends: (filter?: FriendFilter) => DBFriend[];
  getIncomingRequests: () => FriendRequest[];
  getOutgoingRequests: () => FriendRequest[];
  getFriendStats: () => FriendStats;
  isFriend: (pubkey: string) => boolean;
  getTrustTier: (pubkey: string) => TrustTier;

  // Utility
  loadFriends: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  clearCache: () => void;
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
      // Initial state
      friends: [],
      friendRequests: [],
      inviteLinks: [],
      isLoading: false,

      // Add friend (send request)
      addFriend: async (friendPubkey: string, method: FriendAddMethod, message?: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        // Check if already friends or request exists
        const existing = get().friends.find(
          (f) => f.userPubkey === currentIdentity.publicKey && f.friendPubkey === friendPubkey
        );
        if (existing) {
          throw new Error('Already friends or request pending');
        }

        // Create friend request
        const request: FriendRequest = {
          id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fromPubkey: currentIdentity.publicKey,
          toPubkey: friendPubkey,
          message,
          method,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        };

        // Persist to database
        try {
          await db.friendRequests.add(request);
        } catch (error) {
          console.error('Failed to save friend request:', error);
        }

        set((state) => ({
          friendRequests: [...state.friendRequests, request],
        }));

        // TODO: Send Nostr event to notify recipient
      },

      // Accept friend request
      acceptFriendRequest: async (requestId: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        const request = get().friendRequests.find((r) => r.id === requestId);
        if (!request) throw new Error('Request not found');

        const now = Date.now();

        // Create friend relationship for both users
        const friend1: DBFriend = {
          id: `friend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userPubkey: currentIdentity.publicKey,
          friendPubkey: request.fromPubkey,
          username: request.fromUsername,
          status: 'accepted',
          addedAt: now,
          acceptedAt: now,
          tags: [],
          verifiedInPerson: false,
          isFavorite: false,
          trustTier: 'friend',
          privacySettings: {
            canSeeOnlineStatus: true,
            canSeeGroups: false,
            canSeeActivity: false,
            canTagInPosts: true,
          },
        };

        const friend2: DBFriend = {
          id: `friend-${Date.now()}-${Math.random().toString(36).substr(2, 9) + '2'}`,
          userPubkey: request.fromPubkey,
          friendPubkey: currentIdentity.publicKey,
          status: 'accepted',
          addedAt: now,
          acceptedAt: now,
          tags: [],
          verifiedInPerson: false,
          isFavorite: false,
          trustTier: 'friend',
          privacySettings: {
            canSeeOnlineStatus: true,
            canSeeGroups: false,
            canSeeActivity: false,
            canTagInPosts: true,
          },
        };

        // Persist to database
        try {
          await db.friends.add(friend1);
          await db.friends.add(friend2);
          await db.friendRequests.delete(requestId);
        } catch (error) {
          console.error('Failed to accept friend request:', error);
        }

        set((state) => ({
          friends: [...state.friends, friend1],
          friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
        }));

        // TODO: Send Nostr event to notify sender
      },

      // Decline friend request
      declineFriendRequest: async (requestId: string): Promise<void> => {
        try {
          await db.friendRequests.delete(requestId);
        } catch (error) {
          console.error('Failed to decline friend request:', error);
        }

        set((state) => ({
          friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
        }));
      },

      // Remove friend
      removeFriend: async (friendId: string): Promise<void> => {
        const friend = get().friends.find((f) => f.id === friendId);
        if (!friend) return;

        // Remove both directions of friendship
        try {
          await db.friends.delete(friendId);
          // Find and remove reverse friendship
          const reverseFriend = await db.friends
            .where('[userPubkey+friendPubkey]')
            .equals([friend.friendPubkey, friend.userPubkey])
            .first();
          if (reverseFriend) {
            await db.friends.delete(reverseFriend.id);
          }
        } catch (error) {
          console.error('Failed to remove friend:', error);
        }

        set((state) => ({
          friends: state.friends.filter((f) => f.id !== friendId),
        }));
      },

      // Block friend
      blockFriend: async (friendId: string): Promise<void> => {
        try {
          await db.friends.update(friendId, { status: 'blocked' });
        } catch (error) {
          console.error('Failed to block friend:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === friendId ? { ...f, status: 'blocked' as FriendStatus } : f
          ),
        }));
      },

      // Unblock friend
      unblockFriend: async (friendId: string): Promise<void> => {
        try {
          await db.friends.update(friendId, { status: 'accepted' });
        } catch (error) {
          console.error('Failed to unblock friend:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === friendId ? { ...f, status: 'accepted' as FriendStatus } : f
          ),
        }));
      },

      // Update friend notes
      updateFriendNotes: async (friendId: string, notes: string): Promise<void> => {
        try {
          await db.friends.update(friendId, { notes });
        } catch (error) {
          console.error('Failed to update notes:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) => (f.id === friendId ? { ...f, notes } : f)),
        }));
      },

      // Update friend tags
      updateFriendTags: async (friendId: string, tags: string[]): Promise<void> => {
        try {
          await db.friends.update(friendId, { tags });
        } catch (error) {
          console.error('Failed to update tags:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) => (f.id === friendId ? { ...f, tags } : f)),
        }));
      },

      // Toggle favorite
      toggleFavorite: async (friendId: string): Promise<void> => {
        const friend = get().friends.find((f) => f.id === friendId);
        if (!friend) return;

        const isFavorite = !friend.isFavorite;

        try {
          await db.friends.update(friendId, { isFavorite });
        } catch (error) {
          console.error('Failed to toggle favorite:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) => (f.id === friendId ? { ...f, isFavorite } : f)),
        }));
      },

      // Update privacy settings
      updatePrivacySettings: async (friendId: string, settings: Partial<FriendPrivacySettings>): Promise<void> => {
        const friend = get().friends.find((f) => f.id === friendId);
        if (!friend) return;

        const newSettings = { ...friend.privacySettings, ...settings };

        try {
          await db.friends.update(friendId, { privacySettings: newSettings });
        } catch (error) {
          console.error('Failed to update privacy settings:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === friendId ? { ...f, privacySettings: newSettings } : f
          ),
        }));
      },

      // Mark as verified in person
      markVerifiedInPerson: async (friendId: string): Promise<void> => {
        try {
          await db.friends.update(friendId, {
            verifiedInPerson: true,
            trustTier: 'verified',
          });
        } catch (error) {
          console.error('Failed to mark as verified:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === friendId ? { ...f, verifiedInPerson: true, trustTier: 'verified' as TrustTier } : f
          ),
        }));
      },

      // Update trust tier
      updateTrustTier: async (friendId: string, tier: TrustTier): Promise<void> => {
        try {
          await db.friends.update(friendId, { trustTier: tier });
        } catch (error) {
          console.error('Failed to update trust tier:', error);
        }

        set((state) => ({
          friends: state.friends.map((f) => (f.id === friendId ? { ...f, trustTier: tier } : f)),
        }));
      },

      // Create invite link
      createInviteLink: async (expiresAt?: number, maxUses?: number): Promise<FriendInviteLink> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        const link: FriendInviteLink = {
          id: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          creatorPubkey: currentIdentity.publicKey,
          code: Math.random().toString(36).substr(2, 8).toUpperCase(),
          expiresAt,
          maxUses,
          currentUses: 0,
          createdAt: Date.now(),
        };

        try {
          await db.friendInviteLinks.add(link);
        } catch (error) {
          console.error('Failed to create invite link:', error);
        }

        set((state) => ({
          inviteLinks: [...state.inviteLinks, link],
        }));

        return link;
      },

      // Accept invite link
      acceptInviteLink: async (code: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        const link = await db.friendInviteLinks.where('code').equals(code).first();
        if (!link) throw new Error('Invalid invite code');

        if (link.expiresAt && link.expiresAt < Date.now()) {
          throw new Error('Invite link expired');
        }

        if (link.maxUses && link.currentUses >= link.maxUses) {
          throw new Error('Invite link has reached maximum uses');
        }

        // Send friend request to creator
        await get().addFriend(link.creatorPubkey, 'invite-link');

        // Increment usage count
        try {
          await db.friendInviteLinks.update(link.id, {
            currentUses: link.currentUses + 1,
          });
        } catch (error) {
          console.error('Failed to update invite link:', error);
        }
      },

      // Delete invite link
      deleteInviteLink: async (linkId: string): Promise<void> => {
        try {
          await db.friendInviteLinks.delete(linkId);
        } catch (error) {
          console.error('Failed to delete invite link:', error);
        }

        set((state) => ({
          inviteLinks: state.inviteLinks.filter((l) => l.id !== linkId),
        }));
      },

      // Get friend by pubkey
      getFriend: (friendPubkey: string): DBFriend | undefined => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return undefined;

        return get().friends.find(
          (f) => f.userPubkey === currentIdentity.publicKey && f.friendPubkey === friendPubkey
        );
      },

      // Get friends with filter
      getFriends: (filter?: FriendFilter): DBFriend[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        let filtered = get().friends.filter((f) => f.userPubkey === currentIdentity.publicKey);

        if (!filter) return filtered;

        // Filter by status
        if (filter.status?.length) {
          filtered = filtered.filter((f) => filter.status?.includes(f.status));
        }

        // Filter by trust tiers
        if (filter.trustTiers?.length) {
          filtered = filtered.filter((f) => filter.trustTiers?.includes(f.trustTier));
        }

        // Filter by tags
        if (filter.tags?.length) {
          filtered = filtered.filter((f) => f.tags.some((tag) => filter.tags?.includes(tag)));
        }

        // Filter favorites
        if (filter.favorites !== undefined) {
          filtered = filtered.filter((f) => f.isFavorite === filter.favorites);
        }

        // Filter verified
        if (filter.verified !== undefined) {
          filtered = filtered.filter((f) => f.verifiedInPerson === filter.verified);
        }

        // Search query
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (f) =>
              f.username?.toLowerCase().includes(query) ||
              f.displayName?.toLowerCase().includes(query) ||
              f.friendPubkey.toLowerCase().includes(query) ||
              f.notes?.toLowerCase().includes(query)
          );
        }

        // Sort
        if (filter.sortBy === 'name') {
          filtered.sort((a, b) =>
            (a.displayName || a.username || a.friendPubkey).localeCompare(
              b.displayName || b.username || b.friendPubkey
            )
          );
        } else if (filter.sortBy === 'username') {
          filtered.sort((a, b) =>
            (a.username || a.friendPubkey).localeCompare(b.username || b.friendPubkey)
          );
        } else {
          // Sort by recent (acceptedAt or addedAt)
          filtered.sort((a, b) => (b.acceptedAt || b.addedAt) - (a.acceptedAt || a.addedAt));
        }

        return filtered;
      },

      // Get incoming requests
      getIncomingRequests: (): FriendRequest[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        return get().friendRequests.filter((r) => r.toPubkey === currentIdentity.publicKey);
      },

      // Get outgoing requests
      getOutgoingRequests: (): FriendRequest[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        return get().friendRequests.filter((r) => r.fromPubkey === currentIdentity.publicKey);
      },

      // Get friend statistics
      getFriendStats: (): FriendStats => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) {
          return {
            total: 0,
            pending: 0,
            accepted: 0,
            blocked: 0,
            verified: 0,
            favorites: 0,
            byTrustTier: {
              stranger: 0,
              contact: 0,
              friend: 0,
              verified: 0,
              trusted: 0,
            },
          };
        }

        const friends = get().friends.filter((f) => f.userPubkey === currentIdentity.publicKey);

        return {
          total: friends.length,
          pending: friends.filter((f) => f.status === 'pending').length,
          accepted: friends.filter((f) => f.status === 'accepted').length,
          blocked: friends.filter((f) => f.status === 'blocked').length,
          verified: friends.filter((f) => f.verifiedInPerson).length,
          favorites: friends.filter((f) => f.isFavorite).length,
          byTrustTier: {
            stranger: friends.filter((f) => f.trustTier === 'stranger').length,
            contact: friends.filter((f) => f.trustTier === 'contact').length,
            friend: friends.filter((f) => f.trustTier === 'friend').length,
            verified: friends.filter((f) => f.trustTier === 'verified').length,
            trusted: friends.filter((f) => f.trustTier === 'trusted').length,
          },
        };
      },

      // Check if pubkey is a friend
      isFriend: (pubkey: string): boolean => {
        const friend = get().getFriend(pubkey);
        return friend?.status === 'accepted';
      },

      // Get trust tier for pubkey
      getTrustTier: (pubkey: string): TrustTier => {
        const friend = get().getFriend(pubkey);
        return friend?.trustTier || 'stranger';
      },

      // Load friends from database
      loadFriends: async (): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        set({ isLoading: true });

        try {
          const friends = await db.friends.where('userPubkey').equals(currentIdentity.publicKey).toArray();

          const requests = await db.friendRequests
            .where('toPubkey')
            .equals(currentIdentity.publicKey)
            .or('fromPubkey')
            .equals(currentIdentity.publicKey)
            .toArray();

          const invites = await db.friendInviteLinks
            .where('creatorPubkey')
            .equals(currentIdentity.publicKey)
            .toArray();

          set({
            friends,
            friendRequests: requests,
            inviteLinks: invites,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to load friends:', error);
          set({ isLoading: false });
        }
      },

      // Refresh friends
      refreshFriends: async (): Promise<void> => {
        await get().loadFriends();
      },

      // Clear cache
      clearCache: (): void => {
        set({
          friends: [],
          friendRequests: [],
          inviteLinks: [],
        });
      },
    }),
    {
      name: 'buildn-friends-store',
      partialize: () => ({
        // Only persist preferences, not all data
      }),
    }
  )
);
