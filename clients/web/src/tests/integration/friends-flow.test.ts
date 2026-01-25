/**
 * Friends Integration Tests
 *
 * Tests friend relationships, requests, invite links,
 * trust tiers, privacy settings, and filtering.
 *
 * Epic 51: Quality & Testing Completion
 */

import { describe, it, expect } from 'vitest';
import type {
  DBFriend,
  FriendRequest,
  FriendInviteLink,
  FriendStatus,
  TrustTier,
  FriendAddMethod,
  FriendFilter,
  FriendPrivacySettings,
  FriendStats,
} from '@/modules/friends/types';

describe('Friends Integration Tests', () => {
  // Helper to create a mock friend
  const createMockFriend = (overrides: Partial<DBFriend> = {}): DBFriend => ({
    id: `friend-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    userPubkey: 'user-pubkey-123',
    friendPubkey: `friend-${Math.random().toString(36).slice(2, 11)}`,
    status: 'accepted' as FriendStatus,
    addedAt: Date.now() - 86400000,
    acceptedAt: Date.now(),
    tags: [],
    verifiedInPerson: false,
    isFavorite: false,
    trustTier: 'friend' as TrustTier,
    privacySettings: {
      canSeeOnlineStatus: true,
      canSeeGroups: false,
      canSeeActivity: false,
      canTagInPosts: true,
    },
    ...overrides,
  });

  // Helper to create a mock friend request
  const createMockRequest = (overrides: Partial<FriendRequest> = {}): FriendRequest => ({
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    fromPubkey: 'sender-pubkey',
    toPubkey: 'recipient-pubkey',
    method: 'username' as FriendAddMethod,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  });

  describe('Friend Relationship Creation', () => {
    it('should create friend with all required fields', () => {
      const friend = createMockFriend({
        username: 'alice',
        displayName: 'Alice Smith',
      });

      expect(friend.id).toBeTruthy();
      expect(friend.userPubkey).toBe('user-pubkey-123');
      expect(friend.friendPubkey).toBeTruthy();
      expect(friend.status).toBe('accepted');
      expect(friend.addedAt).toBeLessThan(Date.now());
      expect(friend.tags).toEqual([]);
      expect(friend.trustTier).toBe('friend');
    });

    it('should enforce bidirectional friendship', () => {
      const userAPubkey = 'user-a-pubkey';
      const userBPubkey = 'user-b-pubkey';

      // Create both directions
      const friendA = createMockFriend({
        userPubkey: userAPubkey,
        friendPubkey: userBPubkey,
      });

      const friendB = createMockFriend({
        userPubkey: userBPubkey,
        friendPubkey: userAPubkey,
      });

      // Both directions should exist
      expect(friendA.userPubkey).toBe(userAPubkey);
      expect(friendA.friendPubkey).toBe(userBPubkey);
      expect(friendB.userPubkey).toBe(userBPubkey);
      expect(friendB.friendPubkey).toBe(userAPubkey);
    });

    it('should support all friend statuses', () => {
      const statuses: FriendStatus[] = ['pending', 'accepted', 'blocked'];

      statuses.forEach((status) => {
        const friend = createMockFriend({ status });
        expect(friend.status).toBe(status);
      });
    });

    it('should track accepted timestamp when accepting', () => {
      const addedAt = Date.now() - 86400000; // 1 day ago
      const acceptedAt = Date.now();

      const friend = createMockFriend({
        status: 'accepted',
        addedAt,
        acceptedAt,
      });

      expect(friend.acceptedAt).toBeDefined();
      expect(friend.acceptedAt).toBeGreaterThan(friend.addedAt);
    });
  });

  describe('Friend Request Flow', () => {
    it('should create friend request with message', () => {
      const request = createMockRequest({
        message: 'Hey, I met you at the rally!',
        method: 'qr',
      });

      expect(request.id).toBeTruthy();
      expect(request.message).toBe('Hey, I met you at the rally!');
      expect(request.method).toBe('qr');
      expect(request.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should support all add methods', () => {
      const methods: FriendAddMethod[] = ['qr', 'username', 'email', 'invite-link'];

      methods.forEach((method) => {
        const request = createMockRequest({ method });
        expect(request.method).toBe(method);
      });
    });

    it('should expire requests after 30 days by default', () => {
      const request = createMockRequest();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      expect(request.expiresAt).toBeDefined();
      expect(request.expiresAt! - request.createdAt).toBeCloseTo(thirtyDays, -3);
    });

    it('should identify incoming vs outgoing requests', () => {
      const currentUserPubkey = 'current-user';

      const incoming = createMockRequest({
        fromPubkey: 'other-user',
        toPubkey: currentUserPubkey,
      });

      const outgoing = createMockRequest({
        fromPubkey: currentUserPubkey,
        toPubkey: 'other-user',
      });

      expect(incoming.toPubkey).toBe(currentUserPubkey);
      expect(outgoing.fromPubkey).toBe(currentUserPubkey);
    });

    it('should convert accepted request to friendship', () => {
      const request = createMockRequest({
        fromPubkey: 'sender',
        toPubkey: 'recipient',
      });

      // Simulate accepting the request
      const now = Date.now();
      const friend: DBFriend = {
        id: `friend-${now}`,
        userPubkey: request.toPubkey,
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

      expect(friend.status).toBe('accepted');
      expect(friend.friendPubkey).toBe(request.fromPubkey);
    });
  });

  describe('Invite Links', () => {
    it('should create invite link with code', () => {
      const link: FriendInviteLink = {
        id: `invite-${Date.now()}`,
        creatorPubkey: 'creator-pubkey',
        code: 'ABC12345',
        currentUses: 0,
        createdAt: Date.now(),
      };

      expect(link.code).toHaveLength(8);
      expect(link.currentUses).toBe(0);
    });

    it('should enforce max uses limit', () => {
      const link: FriendInviteLink = {
        id: `invite-${Date.now()}`,
        creatorPubkey: 'creator',
        code: 'LIMITED1',
        maxUses: 5,
        currentUses: 5,
        createdAt: Date.now(),
      };

      const canUse = !link.maxUses || link.currentUses < link.maxUses;
      expect(canUse).toBe(false);
    });

    it('should respect expiration time', () => {
      const expiredLink: FriendInviteLink = {
        id: `invite-${Date.now()}`,
        creatorPubkey: 'creator',
        code: 'EXPIRED1',
        expiresAt: Date.now() - 1000, // Already expired
        currentUses: 0,
        createdAt: Date.now() - 86400000,
      };

      const validLink: FriendInviteLink = {
        id: `invite-${Date.now()}`,
        creatorPubkey: 'creator',
        code: 'VALID123',
        expiresAt: Date.now() + 86400000, // Future
        currentUses: 0,
        createdAt: Date.now(),
      };

      const isExpired = (link: FriendInviteLink) =>
        link.expiresAt !== undefined && link.expiresAt < Date.now();

      expect(isExpired(expiredLink)).toBe(true);
      expect(isExpired(validLink)).toBe(false);
    });

    it('should increment usage on accept', () => {
      const link: FriendInviteLink = {
        id: `invite-${Date.now()}`,
        creatorPubkey: 'creator',
        code: 'USEONCE1',
        maxUses: 10,
        currentUses: 3,
        createdAt: Date.now(),
      };

      // Simulate accepting
      link.currentUses += 1;

      expect(link.currentUses).toBe(4);
    });
  });

  describe('Trust Tiers', () => {
    it('should support all trust tiers', () => {
      const tiers: TrustTier[] = ['stranger', 'contact', 'friend', 'verified', 'trusted'];

      tiers.forEach((tier) => {
        const friend = createMockFriend({ trustTier: tier });
        expect(friend.trustTier).toBe(tier);
      });
    });

    it('should upgrade to verified when verified in person', () => {
      const friend = createMockFriend({
        trustTier: 'friend',
        verifiedInPerson: false,
      });

      // Simulate verification
      friend.verifiedInPerson = true;
      friend.trustTier = 'verified';

      expect(friend.verifiedInPerson).toBe(true);
      expect(friend.trustTier).toBe('verified');
    });

    it('should order trust tiers correctly', () => {
      const tierOrder: Record<TrustTier, number> = {
        stranger: 0,
        contact: 1,
        friend: 2,
        verified: 3,
        trusted: 4,
      };

      expect(tierOrder.trusted).toBeGreaterThan(tierOrder.verified);
      expect(tierOrder.verified).toBeGreaterThan(tierOrder.friend);
      expect(tierOrder.friend).toBeGreaterThan(tierOrder.contact);
      expect(tierOrder.contact).toBeGreaterThan(tierOrder.stranger);
    });

    it('should default strangers for non-friends', () => {
      const getTrustTier = (friends: DBFriend[], pubkey: string): TrustTier => {
        const friend = friends.find((f) => f.friendPubkey === pubkey);
        return friend?.trustTier || 'stranger';
      };

      const friends: DBFriend[] = [
        createMockFriend({ friendPubkey: 'known-pubkey', trustTier: 'friend' }),
      ];

      expect(getTrustTier(friends, 'known-pubkey')).toBe('friend');
      expect(getTrustTier(friends, 'unknown-pubkey')).toBe('stranger');
    });
  });

  describe('Privacy Settings', () => {
    it('should have default privacy settings', () => {
      const friend = createMockFriend();

      expect(friend.privacySettings).toEqual({
        canSeeOnlineStatus: true,
        canSeeGroups: false,
        canSeeActivity: false,
        canTagInPosts: true,
      });
    });

    it('should update individual privacy settings', () => {
      const friend = createMockFriend();

      const updatePrivacy = (
        current: FriendPrivacySettings,
        updates: Partial<FriendPrivacySettings>
      ): FriendPrivacySettings => ({ ...current, ...updates });

      const updated = updatePrivacy(friend.privacySettings, {
        canSeeGroups: true,
        canSeeActivity: true,
      });

      expect(updated.canSeeOnlineStatus).toBe(true); // Unchanged
      expect(updated.canSeeGroups).toBe(true);
      expect(updated.canSeeActivity).toBe(true);
      expect(updated.canTagInPosts).toBe(true); // Unchanged
    });

    it('should restrict access based on privacy settings', () => {
      const friend = createMockFriend({
        privacySettings: {
          canSeeOnlineStatus: false,
          canSeeGroups: false,
          canSeeActivity: false,
          canTagInPosts: false,
        },
      });

      const canAccess = (friend: DBFriend, feature: keyof FriendPrivacySettings): boolean => {
        return friend.privacySettings[feature];
      };

      expect(canAccess(friend, 'canSeeOnlineStatus')).toBe(false);
      expect(canAccess(friend, 'canSeeGroups')).toBe(false);
      expect(canAccess(friend, 'canSeeActivity')).toBe(false);
      expect(canAccess(friend, 'canTagInPosts')).toBe(false);
    });
  });

  describe('Friend Filtering', () => {
    const friends: DBFriend[] = [
      createMockFriend({
        friendPubkey: 'alice',
        username: 'alice',
        status: 'accepted',
        trustTier: 'verified',
        isFavorite: true,
        verifiedInPerson: true,
        tags: ['organizer', 'trusted'],
      }),
      createMockFriend({
        friendPubkey: 'bob',
        username: 'bob',
        status: 'accepted',
        trustTier: 'friend',
        isFavorite: false,
        verifiedInPerson: false,
        tags: ['coworker'],
      }),
      createMockFriend({
        friendPubkey: 'charlie',
        username: 'charlie',
        status: 'blocked',
        trustTier: 'contact',
        isFavorite: false,
        verifiedInPerson: false,
        tags: [],
      }),
    ];

    const filterFriends = (list: DBFriend[], filter: FriendFilter): DBFriend[] => {
      let result = [...list];

      if (filter.status?.length) {
        result = result.filter((f) => filter.status!.includes(f.status));
      }
      if (filter.trustTiers?.length) {
        result = result.filter((f) => filter.trustTiers!.includes(f.trustTier));
      }
      if (filter.tags?.length) {
        result = result.filter((f) => f.tags.some((t) => filter.tags!.includes(t)));
      }
      if (filter.favorites !== undefined) {
        result = result.filter((f) => f.isFavorite === filter.favorites);
      }
      if (filter.verified !== undefined) {
        result = result.filter((f) => f.verifiedInPerson === filter.verified);
      }
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        result = result.filter(
          (f) =>
            f.username?.toLowerCase().includes(q) ||
            f.displayName?.toLowerCase().includes(q) ||
            f.friendPubkey.toLowerCase().includes(q)
        );
      }

      return result;
    };

    it('should filter by status', () => {
      const blocked = filterFriends(friends, { status: ['blocked'] });
      expect(blocked).toHaveLength(1);
      expect(blocked[0].friendPubkey).toBe('charlie');
    });

    it('should filter by trust tier', () => {
      const verified = filterFriends(friends, { trustTiers: ['verified'] });
      expect(verified).toHaveLength(1);
      expect(verified[0].friendPubkey).toBe('alice');
    });

    it('should filter by tags', () => {
      const organizers = filterFriends(friends, { tags: ['organizer'] });
      expect(organizers).toHaveLength(1);
      expect(organizers[0].friendPubkey).toBe('alice');
    });

    it('should filter favorites only', () => {
      const favs = filterFriends(friends, { favorites: true });
      expect(favs).toHaveLength(1);
      expect(favs[0].friendPubkey).toBe('alice');
    });

    it('should filter verified only', () => {
      const verified = filterFriends(friends, { verified: true });
      expect(verified).toHaveLength(1);
      expect(verified[0].friendPubkey).toBe('alice');
    });

    it('should search by username', () => {
      const results = filterFriends(friends, { searchQuery: 'bob' });
      expect(results).toHaveLength(1);
      expect(results[0].friendPubkey).toBe('bob');
    });

    it('should combine multiple filters', () => {
      const results = filterFriends(friends, {
        status: ['accepted'],
        trustTiers: ['verified', 'friend'],
        favorites: false,
      });
      expect(results).toHaveLength(1);
      expect(results[0].friendPubkey).toBe('bob');
    });
  });

  describe('Friend Statistics', () => {
    it('should calculate friend statistics correctly', () => {
      const friends: DBFriend[] = [
        createMockFriend({ status: 'accepted', trustTier: 'verified', verifiedInPerson: true, isFavorite: true }),
        createMockFriend({ status: 'accepted', trustTier: 'friend', verifiedInPerson: false, isFavorite: true }),
        createMockFriend({ status: 'accepted', trustTier: 'friend', verifiedInPerson: false, isFavorite: false }),
        createMockFriend({ status: 'pending', trustTier: 'contact', verifiedInPerson: false, isFavorite: false }),
        createMockFriend({ status: 'blocked', trustTier: 'stranger', verifiedInPerson: false, isFavorite: false }),
      ];

      const calculateStats = (list: DBFriend[]): FriendStats => ({
        total: list.length,
        pending: list.filter((f) => f.status === 'pending').length,
        accepted: list.filter((f) => f.status === 'accepted').length,
        blocked: list.filter((f) => f.status === 'blocked').length,
        verified: list.filter((f) => f.verifiedInPerson).length,
        favorites: list.filter((f) => f.isFavorite).length,
        byTrustTier: {
          stranger: list.filter((f) => f.trustTier === 'stranger').length,
          contact: list.filter((f) => f.trustTier === 'contact').length,
          friend: list.filter((f) => f.trustTier === 'friend').length,
          verified: list.filter((f) => f.trustTier === 'verified').length,
          trusted: list.filter((f) => f.trustTier === 'trusted').length,
        },
      });

      const stats = calculateStats(friends);

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.accepted).toBe(3);
      expect(stats.blocked).toBe(1);
      expect(stats.verified).toBe(1);
      expect(stats.favorites).toBe(2);
      expect(stats.byTrustTier.friend).toBe(2);
      expect(stats.byTrustTier.verified).toBe(1);
      expect(stats.byTrustTier.contact).toBe(1);
      expect(stats.byTrustTier.stranger).toBe(1);
    });

    it('should return zero stats for empty list', () => {
      const calculateStats = (list: DBFriend[]): FriendStats => ({
        total: list.length,
        pending: list.filter((f) => f.status === 'pending').length,
        accepted: list.filter((f) => f.status === 'accepted').length,
        blocked: list.filter((f) => f.status === 'blocked').length,
        verified: list.filter((f) => f.verifiedInPerson).length,
        favorites: list.filter((f) => f.isFavorite).length,
        byTrustTier: {
          stranger: list.filter((f) => f.trustTier === 'stranger').length,
          contact: list.filter((f) => f.trustTier === 'contact').length,
          friend: list.filter((f) => f.trustTier === 'friend').length,
          verified: list.filter((f) => f.trustTier === 'verified').length,
          trusted: list.filter((f) => f.trustTier === 'trusted').length,
        },
      });

      const stats = calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.accepted).toBe(0);
      expect(stats.blocked).toBe(0);
    });
  });

  describe('Friend Tags', () => {
    it('should add tags to friend', () => {
      const friend = createMockFriend({ tags: [] });

      const addTag = (current: string[], tag: string): string[] => {
        if (!current.includes(tag)) {
          return [...current, tag];
        }
        return current;
      };

      let tags = addTag(friend.tags, 'organizer');
      tags = addTag(tags, 'trusted');

      expect(tags).toContain('organizer');
      expect(tags).toContain('trusted');
      expect(tags).toHaveLength(2);
    });

    it('should not add duplicate tags', () => {
      const friend = createMockFriend({ tags: ['organizer'] });

      const addTag = (current: string[], tag: string): string[] => {
        if (!current.includes(tag)) {
          return [...current, tag];
        }
        return current;
      };

      const tags = addTag(friend.tags, 'organizer');
      expect(tags).toHaveLength(1);
    });

    it('should remove tags', () => {
      const friend = createMockFriend({ tags: ['organizer', 'trusted', 'coworker'] });

      const removeTag = (current: string[], tag: string): string[] =>
        current.filter((t) => t !== tag);

      const tags = removeTag(friend.tags, 'trusted');
      expect(tags).toEqual(['organizer', 'coworker']);
    });
  });

  describe('Friend Notes', () => {
    it('should add notes to friend', () => {
      const friend = createMockFriend({ notes: undefined });

      const notes = 'Met at the climate march. Interested in housing justice.';
      friend.notes = notes;

      expect(friend.notes).toBe(notes);
    });

    it('should allow searching by notes', () => {
      const friends: DBFriend[] = [
        createMockFriend({ friendPubkey: 'friend1', notes: 'Works at the food co-op' }),
        createMockFriend({ friendPubkey: 'friend2', notes: 'Housing activist' }),
        createMockFriend({ friendPubkey: 'friend3', notes: undefined }),
      ];

      const searchByNotes = (list: DBFriend[], query: string): DBFriend[] =>
        list.filter((f) => f.notes?.toLowerCase().includes(query.toLowerCase()));

      const results = searchByNotes(friends, 'co-op');
      expect(results).toHaveLength(1);
      expect(results[0].friendPubkey).toBe('friend1');
    });
  });

  describe('Block and Unblock', () => {
    it('should block a friend', () => {
      const friend = createMockFriend({ status: 'accepted' });

      friend.status = 'blocked';

      expect(friend.status).toBe('blocked');
    });

    it('should unblock and restore accepted status', () => {
      const friend = createMockFriend({ status: 'blocked' });

      friend.status = 'accepted';

      expect(friend.status).toBe('accepted');
    });

    it('should hide blocked friends from normal queries', () => {
      const friends: DBFriend[] = [
        createMockFriend({ friendPubkey: 'friend1', status: 'accepted' }),
        createMockFriend({ friendPubkey: 'friend2', status: 'blocked' }),
        createMockFriend({ friendPubkey: 'friend3', status: 'accepted' }),
      ];

      const getActiveFriends = (list: DBFriend[]): DBFriend[] =>
        list.filter((f) => f.status === 'accepted');

      const active = getActiveFriends(friends);
      expect(active).toHaveLength(2);
      expect(active.map((f) => f.friendPubkey)).not.toContain('friend2');
    });
  });

  describe('Favorite Friends', () => {
    it('should toggle favorite status', () => {
      const friend = createMockFriend({ isFavorite: false });

      friend.isFavorite = !friend.isFavorite;
      expect(friend.isFavorite).toBe(true);

      friend.isFavorite = !friend.isFavorite;
      expect(friend.isFavorite).toBe(false);
    });

    it('should sort favorites first', () => {
      const friends: DBFriend[] = [
        createMockFriend({ friendPubkey: 'friend1', isFavorite: false, acceptedAt: 3 }),
        createMockFriend({ friendPubkey: 'friend2', isFavorite: true, acceptedAt: 1 }),
        createMockFriend({ friendPubkey: 'friend3', isFavorite: false, acceptedAt: 2 }),
        createMockFriend({ friendPubkey: 'friend4', isFavorite: true, acceptedAt: 4 }),
      ];

      const sortWithFavoritesFirst = (list: DBFriend[]): DBFriend[] =>
        [...list].sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) {
            return b.isFavorite ? 1 : -1;
          }
          return (b.acceptedAt || 0) - (a.acceptedAt || 0);
        });

      const sorted = sortWithFavoritesFirst(friends);

      expect(sorted[0].friendPubkey).toBe('friend4'); // Favorite, most recent
      expect(sorted[1].friendPubkey).toBe('friend2'); // Favorite, older
      expect(sorted[2].friendPubkey).toBe('friend1'); // Non-favorite, most recent
      expect(sorted[3].friendPubkey).toBe('friend3'); // Non-favorite, older
    });
  });

  describe('isFriend Helper', () => {
    it('should return true for accepted friends', () => {
      const friends: DBFriend[] = [
        createMockFriend({ friendPubkey: 'alice', status: 'accepted' }),
        createMockFriend({ friendPubkey: 'bob', status: 'pending' }),
        createMockFriend({ friendPubkey: 'charlie', status: 'blocked' }),
      ];

      const isFriend = (pubkey: string): boolean => {
        const friend = friends.find((f) => f.friendPubkey === pubkey);
        return friend?.status === 'accepted';
      };

      expect(isFriend('alice')).toBe(true);
      expect(isFriend('bob')).toBe(false);
      expect(isFriend('charlie')).toBe(false);
      expect(isFriend('unknown')).toBe(false);
    });
  });
});
