/**
 * ContactsStore Tests
 * Tests for contact and profile management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContactsStore } from '../contactsStore';
import type { Contact } from '@/types/contacts';

// Mock nostr client
vi.mock('@/core/nostr/client', () => ({
  getNostrClient: vi.fn(() => ({
    query: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock authStore
vi.mock('../authStore', () => ({
  useAuthStore: {
    getState: () => ({
      currentIdentity: {
        publicKey: 'mock-pubkey-123',
        npub: 'npub1mock',
      },
    }),
  },
  getCurrentPrivateKey: vi.fn(() => new Uint8Array(32).fill(1)),
}));

// Mock nostr-tools
vi.mock('nostr-tools/pure', () => ({
  finalizeEvent: vi.fn((event) => ({
    ...event,
    id: 'mock-event-id',
    pubkey: 'mock-pubkey',
    sig: 'mock-sig',
  })),
}));

describe('contactsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    useContactsStore.setState({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,
    });
  });

  describe('addContact', () => {
    it('should add a contact', () => {
      const { addContact } = useContactsStore.getState();

      const contact: Contact = {
        pubkey: 'pubkey1',
        relationship: 'following',
        followedAt: Math.floor(Date.now() / 1000),
      };

      addContact(contact);

      const { contacts } = useContactsStore.getState();
      expect(contacts.get('pubkey1')).toEqual(contact);
    });
  });

  describe('removeContact', () => {
    it('should remove a contact', () => {
      const { addContact, removeContact } = useContactsStore.getState();

      addContact({
        pubkey: 'pubkey1',
        relationship: 'following',
        followedAt: Math.floor(Date.now() / 1000),
      });

      removeContact('pubkey1');

      const { contacts } = useContactsStore.getState();
      expect(contacts.has('pubkey1')).toBe(false);
    });
  });

  describe('updateContact', () => {
    it('should update a contact', () => {
      const { addContact, updateContact } = useContactsStore.getState();

      addContact({
        pubkey: 'pubkey1',
        relationship: 'following',
        followedAt: Math.floor(Date.now() / 1000),
      });

      updateContact('pubkey1', { petname: 'Friend' });

      const { contacts } = useContactsStore.getState();
      expect(contacts.get('pubkey1')?.petname).toBe('Friend');
    });

    it('should not update non-existent contact', () => {
      const { updateContact } = useContactsStore.getState();

      updateContact('non-existent', { petname: 'Test' });

      const { contacts } = useContactsStore.getState();
      expect(contacts.has('non-existent')).toBe(false);
    });
  });

  describe('getContact', () => {
    it('should get a contact by pubkey', () => {
      const { addContact, getContact } = useContactsStore.getState();

      const contact: Contact = {
        pubkey: 'pubkey1',
        relationship: 'following',
        followedAt: Math.floor(Date.now() / 1000),
      };
      addContact(contact);

      const result = getContact('pubkey1');
      expect(result).toEqual(contact);
    });

    it('should return undefined for non-existent contact', () => {
      const { getContact } = useContactsStore.getState();

      const result = getContact('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('followUser', () => {
    it('should add a following contact', async () => {
      const { followUser } = useContactsStore.getState();

      await followUser('pubkey1', 'wss://relay.test', 'Alice');

      const { contacts } = useContactsStore.getState();
      const contact = contacts.get('pubkey1');
      expect(contact).toBeDefined();
      expect(contact?.relationship).toBe('following');
      expect(contact?.relay).toBe('wss://relay.test');
      expect(contact?.petname).toBe('Alice');
    });
  });

  describe('unfollowUser', () => {
    it('should remove a contact', async () => {
      const { followUser, unfollowUser } = useContactsStore.getState();

      await followUser('pubkey1');
      await unfollowUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      expect(contacts.has('pubkey1')).toBe(false);
    });
  });

  describe('blockUser', () => {
    it('should block an existing contact', async () => {
      const { followUser, blockUser } = useContactsStore.getState();

      await followUser('pubkey1');
      await blockUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      const contact = contacts.get('pubkey1');
      expect(contact?.relationship).toBe('blocked');
      expect(contact?.blockedAt).toBeDefined();
    });

    it('should create blocked contact if not exists', async () => {
      const { blockUser } = useContactsStore.getState();

      await blockUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      const contact = contacts.get('pubkey1');
      expect(contact?.relationship).toBe('blocked');
    });
  });

  describe('unblockUser', () => {
    it('should restore to following if previously followed', async () => {
      const { addContact, blockUser, unblockUser } = useContactsStore.getState();

      addContact({
        pubkey: 'pubkey1',
        relationship: 'following',
        followedAt: Math.floor(Date.now() / 1000),
      });
      await blockUser('pubkey1');
      await unblockUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      const contact = contacts.get('pubkey1');
      expect(contact?.relationship).toBe('following');
      expect(contact?.blockedAt).toBeUndefined();
    });

    it('should remove contact if not previously followed', async () => {
      const { blockUser, unblockUser } = useContactsStore.getState();

      await blockUser('pubkey1');
      await unblockUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      expect(contacts.has('pubkey1')).toBe(false);
    });
  });

  describe('muteUser', () => {
    it('should mute an existing contact', async () => {
      const { addContact, muteUser } = useContactsStore.getState();

      addContact({
        pubkey: 'pubkey1',
        relationship: 'following',
      });

      await muteUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      expect(contacts.get('pubkey1')?.mutedAt).toBeDefined();
    });
  });

  describe('unmuteUser', () => {
    it('should unmute a contact', async () => {
      const { addContact, muteUser, unmuteUser } = useContactsStore.getState();

      addContact({
        pubkey: 'pubkey1',
        relationship: 'following',
        mutedAt: Math.floor(Date.now() / 1000),
      });

      await unmuteUser('pubkey1');

      const { contacts } = useContactsStore.getState();
      expect(contacts.get('pubkey1')?.mutedAt).toBeUndefined();
    });
  });

  describe('getFollowing', () => {
    it('should return following and friend contacts', () => {
      const { addContact, getFollowing } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });
      addContact({ pubkey: 'friend1', relationship: 'friend' });
      addContact({ pubkey: 'follower1', relationship: 'follower' });
      addContact({ pubkey: 'blocked1', relationship: 'blocked' });

      const following = getFollowing();
      expect(following).toHaveLength(2);
      expect(following.map((c) => c.pubkey)).toContain('following1');
      expect(following.map((c) => c.pubkey)).toContain('friend1');
    });
  });

  describe('getFollowers', () => {
    it('should return followers and friends', () => {
      const { addContact, getFollowers } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });
      addContact({ pubkey: 'friend1', relationship: 'friend' });
      addContact({ pubkey: 'follower1', relationship: 'follower' });

      const followers = getFollowers();
      expect(followers).toHaveLength(2);
      expect(followers.map((c) => c.pubkey)).toContain('follower1');
      expect(followers.map((c) => c.pubkey)).toContain('friend1');
    });
  });

  describe('getFriends', () => {
    it('should return only friends', () => {
      const { addContact, getFriends } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });
      addContact({ pubkey: 'friend1', relationship: 'friend' });
      addContact({ pubkey: 'friend2', relationship: 'friend' });

      const friends = getFriends();
      expect(friends).toHaveLength(2);
      expect(friends.every((c) => c.relationship === 'friend')).toBe(true);
    });
  });

  describe('getBlocked', () => {
    it('should return blocked contacts', () => {
      const { addContact, getBlocked } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });
      addContact({ pubkey: 'blocked1', relationship: 'blocked' });
      addContact({ pubkey: 'blocked2', relationship: 'blocked' });

      const blocked = getBlocked();
      expect(blocked).toHaveLength(2);
      expect(blocked.every((c) => c.relationship === 'blocked')).toBe(true);
    });
  });

  describe('getMuted', () => {
    it('should return muted contacts', () => {
      const { addContact, getMuted } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });
      addContact({
        pubkey: 'muted1',
        relationship: 'following',
        mutedAt: Math.floor(Date.now() / 1000),
      });

      const muted = getMuted();
      expect(muted).toHaveLength(1);
      expect(muted[0].pubkey).toBe('muted1');
    });
  });

  describe('isFollowing', () => {
    it('should return true for following contacts', () => {
      const { addContact, isFollowing } = useContactsStore.getState();

      addContact({ pubkey: 'following1', relationship: 'following' });

      expect(isFollowing('following1')).toBe(true);
    });

    it('should return true for friend contacts', () => {
      const { addContact, isFollowing } = useContactsStore.getState();

      addContact({ pubkey: 'friend1', relationship: 'friend' });

      expect(isFollowing('friend1')).toBe(true);
    });

    it('should return false for other relationships', () => {
      const { addContact, isFollowing } = useContactsStore.getState();

      addContact({ pubkey: 'follower1', relationship: 'follower' });
      addContact({ pubkey: 'blocked1', relationship: 'blocked' });

      expect(isFollowing('follower1')).toBe(false);
      expect(isFollowing('blocked1')).toBe(false);
      expect(isFollowing('non-existent')).toBe(false);
    });
  });

  describe('isFriend', () => {
    it('should return true only for friends', () => {
      const { addContact, isFriend } = useContactsStore.getState();

      addContact({ pubkey: 'friend1', relationship: 'friend' });
      addContact({ pubkey: 'following1', relationship: 'following' });

      expect(isFriend('friend1')).toBe(true);
      expect(isFriend('following1')).toBe(false);
      expect(isFriend('non-existent')).toBe(false);
    });
  });

  describe('setProfile', () => {
    it('should set profile for a pubkey', () => {
      const { setProfile } = useContactsStore.getState();

      setProfile('pubkey1', {
        name: 'Alice',
        about: 'A test user',
        picture: 'https://example.com/avatar.png',
      });

      const { profiles } = useContactsStore.getState();
      const profile = profiles.get('pubkey1');
      expect(profile?.name).toBe('Alice');
      expect(profile?.about).toBe('A test user');
    });
  });

  describe('publishConfig', () => {
    it('should have default publish configuration', () => {
      const { getPublishConfig } = useContactsStore.getState();

      const config = getPublishConfig();
      expect(config.publishEncrypted).toBe(true);
      expect(config.publishPlaintext).toBe(false);
      expect(config.dummyContactCount).toBe(0);
    });

    it('should update publish configuration', () => {
      const { setPublishConfig, getPublishConfig } = useContactsStore.getState();

      setPublishConfig({
        publishPlaintext: true,
        dummyContactCount: 10,
      });

      const config = getPublishConfig();
      expect(config.publishEncrypted).toBe(true); // Unchanged
      expect(config.publishPlaintext).toBe(true); // Updated
      expect(config.dummyContactCount).toBe(10); // Updated
    });

    it('should preserve config when updating partial settings', () => {
      const { setPublishConfig, getPublishConfig } = useContactsStore.getState();

      // Reset to known state
      setPublishConfig({
        publishEncrypted: true,
        publishPlaintext: false,
        dummyContactCount: 5,
      });

      // Update only one setting
      setPublishConfig({ dummyContactCount: 15 });

      const config = getPublishConfig();
      expect(config.publishEncrypted).toBe(true);
      expect(config.publishPlaintext).toBe(false);
      expect(config.dummyContactCount).toBe(15);
    });
  });
});
