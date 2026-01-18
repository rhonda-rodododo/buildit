import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Event as NostrEvent } from 'nostr-tools';
import { getPublicKey, generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex } from 'nostr-tools/utils';
import type { GroupMember, GroupCreationParams, GroupRole } from '@/types/group';
import { NostrClient } from '@/core/nostr/client';

import {
  createGroup,
  inviteToGroup,
  acceptInvitation,
  leaveGroup,
  updateGroupMetadata,
  updateMemberRole,
  getUserGroups,
  getGroupMembers,
  hasPermission,
} from './groupManager';

// Mock the NostrClient
vi.mock('@/core/nostr/client', () => {
  return {
    NostrClient: vi.fn().mockImplementation(() => ({
      publish: vi.fn().mockResolvedValue([{ relay: 'wss://test', success: true }]),
      query: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue('sub-id'),
      unsubscribe: vi.fn(),
    })),
  };
});

// Mock generateEventId to return predictable values
vi.mock('@/lib/utils', () => ({
  generateEventId: vi.fn().mockReturnValue('mock-event-id-12345'),
}));

describe('groupManager', () => {
  let mockClient: {
    publish: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let creatorPrivateKey: Uint8Array;
  let creatorPublicKey: string;
  let memberPrivateKey: Uint8Array;
  let memberPublicKey: string;

  beforeEach(() => {
    // Create fresh keypairs for each test
    creatorPrivateKey = generateSecretKey();
    creatorPublicKey = getPublicKey(creatorPrivateKey);
    memberPrivateKey = generateSecretKey();
    memberPublicKey = getPublicKey(memberPrivateKey);

    // Create a fresh mock client
    mockClient = {
      publish: vi.fn().mockResolvedValue([{ relay: 'wss://test', success: true }]),
      query: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue('sub-id'),
      unsubscribe: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a group with valid parameters', async () => {
      const params: GroupCreationParams = {
        name: 'Test Group',
        description: 'A test group for unit testing',
        privacyLevel: 'private',
        enabledModules: ['messaging'],
        tags: ['test', 'unit-test'],
      };

      const group = await createGroup(
        mockClient as unknown as NostrClient,
        params,
        creatorPrivateKey
      );

      // Verify group properties
      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('A test group for unit testing');
      expect(group.privacyLevel).toBe('private');
      expect(group.enabledModules).toEqual(['messaging']);
      expect(group.tags).toEqual(['test', 'unit-test']);
      expect(group.createdBy).toBe(creatorPublicKey);
      expect(group.members).toHaveLength(1);
      expect(group.members[0].role).toBe('owner');
      expect(group.members[0].pubkey).toBe(creatorPublicKey);

      // Verify publish was called
      expect(mockClient.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockClient.publish.mock.calls[0][0] as NostrEvent;
      expect(publishedEvent.kind).toBe(39000); // CREATE_GROUP
      expect(publishedEvent.pubkey).toBe(creatorPublicKey);
    });

    it('should create a group with picture and website', async () => {
      const params: GroupCreationParams = {
        name: 'Visual Group',
        description: 'A group with picture',
        privacyLevel: 'public',
        enabledModules: ['messaging', 'events'],
        picture: 'https://example.com/logo.png',
      };

      const group = await createGroup(
        mockClient as unknown as NostrClient,
        params,
        creatorPrivateKey
      );

      expect(group.picture).toBe('https://example.com/logo.png');
      expect(group.enabledModules).toContain('events');
    });

    it('should invite initial members when specified', async () => {
      const params: GroupCreationParams = {
        name: 'Group with Members',
        description: 'Initial members test',
        privacyLevel: 'private',
        enabledModules: ['messaging'],
        initialMembers: [memberPublicKey],
      };

      await createGroup(
        mockClient as unknown as NostrClient,
        params,
        creatorPrivateKey
      );

      // Should publish creation event + invitation event
      expect(mockClient.publish).toHaveBeenCalledTimes(2);

      // Second call should be the invitation
      const invitationEvent = mockClient.publish.mock.calls[1][0] as NostrEvent;
      expect(invitationEvent.kind).toBe(39006); // INVITATION
    });

    it('should handle secret privacy level', async () => {
      const params: GroupCreationParams = {
        name: 'Secret Group',
        description: 'Top secret group',
        privacyLevel: 'secret',
        enabledModules: ['messaging'],
      };

      const group = await createGroup(
        mockClient as unknown as NostrClient,
        params,
        creatorPrivateKey
      );

      expect(group.privacyLevel).toBe('secret');

      const publishedEvent = mockClient.publish.mock.calls[0][0] as NostrEvent;
      const privacyTag = publishedEvent.tags.find(t => t[0] === 'privacy');
      expect(privacyTag?.[1]).toBe('secret');
    });

    it('should include enabled modules in event tags', async () => {
      const params: GroupCreationParams = {
        name: 'Multi-module Group',
        description: 'Group with multiple modules',
        privacyLevel: 'private',
        enabledModules: ['messaging', 'events', 'governance', 'wiki'],
      };

      await createGroup(
        mockClient as unknown as NostrClient,
        params,
        creatorPrivateKey
      );

      const publishedEvent = mockClient.publish.mock.calls[0][0] as NostrEvent;
      const moduleTags = publishedEvent.tags.filter(t => t[0] === 'module');

      expect(moduleTags).toHaveLength(4);
      expect(moduleTags.map(t => t[1])).toEqual(['messaging', 'events', 'governance', 'wiki']);
    });
  });

  describe('inviteToGroup', () => {
    it('should create an invitation event', async () => {
      const groupId = 'test-group-id';

      const event = await inviteToGroup(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        creatorPrivateKey
      );

      expect(event.kind).toBe(39006); // INVITATION
      expect(event.pubkey).toBe(creatorPublicKey);

      const groupTag = event.tags.find(t => t[0] === 'group');
      expect(groupTag?.[1]).toBe(groupId);

      const pTag = event.tags.find(t => t[0] === 'p');
      expect(pTag?.[1]).toBe(memberPublicKey);
    });

    it('should include custom message in invitation', async () => {
      const groupId = 'test-group-id';
      const message = 'Welcome to our organizing group!';

      const event = await inviteToGroup(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        creatorPrivateKey,
        message
      );

      expect(event.content).toBe(message);
    });

    it('should use default message when none provided', async () => {
      const groupId = 'test-group-id';

      const event = await inviteToGroup(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        creatorPrivateKey
      );

      expect(event.content).toContain("You've been invited");
    });
  });

  describe('acceptInvitation', () => {
    it('should create a join event referencing the invitation', async () => {
      const groupId = 'test-group-id';
      const invitationEventId = 'invitation-event-123';

      const event = await acceptInvitation(
        mockClient as unknown as NostrClient,
        groupId,
        invitationEventId,
        memberPrivateKey
      );

      expect(event.kind).toBe(39004); // JOIN_REQUEST
      expect(event.pubkey).toBe(memberPublicKey);
      expect(event.content).toBe('Accepted invitation');

      const eTag = event.tags.find(t => t[0] === 'e');
      expect(eTag?.[1]).toBe(invitationEventId);

      const groupTag = event.tags.find(t => t[0] === 'group');
      expect(groupTag?.[1]).toBe(groupId);
    });
  });

  describe('leaveGroup', () => {
    it('should create a leave event', async () => {
      const groupId = 'test-group-id';

      const event = await leaveGroup(
        mockClient as unknown as NostrClient,
        groupId,
        memberPrivateKey
      );

      expect(event.kind).toBe(39005); // LEAVE_GROUP
      expect(event.pubkey).toBe(memberPublicKey);
      expect(event.content).toBe('Left the group');

      const groupTag = event.tags.find(t => t[0] === 'group');
      expect(groupTag?.[1]).toBe(groupId);
    });

    it('should include custom reason when provided', async () => {
      const groupId = 'test-group-id';
      const reason = 'Moving on to other projects';

      const event = await leaveGroup(
        mockClient as unknown as NostrClient,
        groupId,
        memberPrivateKey,
        reason
      );

      expect(event.content).toBe(reason);
    });
  });

  describe('updateGroupMetadata', () => {
    it('should create a metadata update event', async () => {
      const groupId = 'test-group-id';
      const updates = {
        name: 'Updated Group Name',
        description: 'New and improved description',
      };

      const event = await updateGroupMetadata(
        mockClient as unknown as NostrClient,
        groupId,
        updates,
        creatorPrivateKey
      );

      expect(event.kind).toBe(39001); // METADATA
      expect(event.pubkey).toBe(creatorPublicKey);

      const content = JSON.parse(event.content);
      expect(content.name).toBe('Updated Group Name');
      expect(content.description).toBe('New and improved description');
    });

    it('should handle partial updates', async () => {
      const groupId = 'test-group-id';
      const updates = {
        picture: 'https://new-image.com/logo.png',
      };

      const event = await updateGroupMetadata(
        mockClient as unknown as NostrClient,
        groupId,
        updates,
        creatorPrivateKey
      );

      const content = JSON.parse(event.content);
      expect(content.picture).toBe('https://new-image.com/logo.png');
      expect(content.name).toBeUndefined();
    });

    it('should update tags', async () => {
      const groupId = 'test-group-id';
      const updates = {
        tags: ['activism', 'community', 'mutual-aid'],
      };

      const event = await updateGroupMetadata(
        mockClient as unknown as NostrClient,
        groupId,
        updates,
        creatorPrivateKey
      );

      const content = JSON.parse(event.content);
      expect(content.tags).toEqual(['activism', 'community', 'mutual-aid']);
    });
  });

  describe('updateMemberRole', () => {
    it('should create a role update event', async () => {
      const groupId = 'test-group-id';
      const newRole: GroupRole = 'admin';

      const event = await updateMemberRole(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        newRole,
        creatorPrivateKey
      );

      expect(event.kind).toBe(39002); // ADMINS
      expect(event.pubkey).toBe(creatorPublicKey);

      const content = JSON.parse(event.content);
      expect(content.role).toBe('admin');

      const pTag = event.tags.find(t => t[0] === 'p');
      expect(pTag?.[1]).toBe(memberPublicKey);

      const roleTag = event.tags.find(t => t[0] === 'role');
      expect(roleTag?.[1]).toBe('admin');
    });

    it('should handle moderator role', async () => {
      const groupId = 'test-group-id';
      const newRole: GroupRole = 'moderator';

      const event = await updateMemberRole(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        newRole,
        creatorPrivateKey
      );

      const roleTag = event.tags.find(t => t[0] === 'role');
      expect(roleTag?.[1]).toBe('moderator');
    });

    it('should handle demotion to member', async () => {
      const groupId = 'test-group-id';
      const newRole: GroupRole = 'member';

      const event = await updateMemberRole(
        mockClient as unknown as NostrClient,
        groupId,
        memberPublicKey,
        newRole,
        creatorPrivateKey
      );

      const roleTag = event.tags.find(t => t[0] === 'role');
      expect(roleTag?.[1]).toBe('member');
    });
  });

  describe('getUserGroups', () => {
    it('should query for groups where user is tagged', async () => {
      const mockGroupEvent: NostrEvent = {
        id: 'group-event-1',
        pubkey: creatorPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 39000,
        tags: [
          ['d', 'group-id-1'],
          ['p', memberPublicKey],
          ['name', 'Test Group'],
        ],
        content: JSON.stringify({
          name: 'Test Group',
          description: 'A test group',
          privacyLevel: 'private',
          enabledModules: ['messaging'],
        }),
        sig: 'mock-signature',
      };

      mockClient.query.mockResolvedValueOnce([mockGroupEvent]);

      const groups = await getUserGroups(
        mockClient as unknown as NostrClient,
        memberPublicKey
      );

      expect(mockClient.query).toHaveBeenCalledWith([
        {
          kinds: [39000],
          '#p': [memberPublicKey],
        },
      ]);

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].description).toBe('A test group');
      expect(groups[0].privacyLevel).toBe('private');
    });

    it('should return empty array when no groups found', async () => {
      mockClient.query.mockResolvedValueOnce([]);

      const groups = await getUserGroups(
        mockClient as unknown as NostrClient,
        memberPublicKey
      );

      expect(groups).toHaveLength(0);
    });

    it('should handle multiple groups', async () => {
      const mockGroupEvents: NostrEvent[] = [
        {
          id: 'group-1',
          pubkey: creatorPublicKey,
          created_at: 1000,
          kind: 39000,
          tags: [['d', 'g1'], ['p', memberPublicKey]],
          content: JSON.stringify({ name: 'Group 1', description: 'First', privacyLevel: 'private' }),
          sig: 'sig1',
        },
        {
          id: 'group-2',
          pubkey: creatorPublicKey,
          created_at: 2000,
          kind: 39000,
          tags: [['d', 'g2'], ['p', memberPublicKey]],
          content: JSON.stringify({ name: 'Group 2', description: 'Second', privacyLevel: 'public' }),
          sig: 'sig2',
        },
      ];

      mockClient.query.mockResolvedValueOnce(mockGroupEvents);

      const groups = await getUserGroups(
        mockClient as unknown as NostrClient,
        memberPublicKey
      );

      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('Group 1');
      expect(groups[1].name).toBe('Group 2');
    });

    it('should handle malformed group events gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockGroupEvents: NostrEvent[] = [
        {
          id: 'good-group',
          pubkey: creatorPublicKey,
          created_at: 1000,
          kind: 39000,
          tags: [],
          content: JSON.stringify({ name: 'Good Group', description: 'Valid', privacyLevel: 'private' }),
          sig: 'sig',
        },
        {
          id: 'bad-group',
          pubkey: creatorPublicKey,
          created_at: 2000,
          kind: 39000,
          tags: [],
          content: 'invalid json {{{',
          sig: 'sig',
        },
      ];

      mockClient.query.mockResolvedValueOnce(mockGroupEvents);

      const groups = await getUserGroups(
        mockClient as unknown as NostrClient,
        memberPublicKey
      );

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('Good Group');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getGroupMembers', () => {
    it('should query for join and role events', async () => {
      const groupId = 'test-group-id';

      const joinEvent: NostrEvent = {
        id: 'join-1',
        pubkey: memberPublicKey,
        created_at: 1000,
        kind: 39004,
        tags: [['d', groupId]],
        content: 'Joined',
        sig: 'sig',
      };

      mockClient.query
        .mockResolvedValueOnce([joinEvent]) // join events
        .mockResolvedValueOnce([]); // role events

      const members = await getGroupMembers(
        mockClient as unknown as NostrClient,
        groupId
      );

      expect(members).toHaveLength(1);
      expect(members[0].pubkey).toBe(memberPublicKey);
      expect(members[0].role).toBe('member');
      expect(members[0].joinedAt).toBe(1000);
    });

    it('should apply role updates to members', async () => {
      const groupId = 'test-group-id';

      const joinEvent: NostrEvent = {
        id: 'join-1',
        pubkey: memberPublicKey,
        created_at: 1000,
        kind: 39004,
        tags: [['d', groupId]],
        content: 'Joined',
        sig: 'sig',
      };

      const roleEvent: NostrEvent = {
        id: 'role-1',
        pubkey: creatorPublicKey,
        created_at: 2000,
        kind: 39002,
        tags: [['d', groupId], ['p', memberPublicKey], ['role', 'admin']],
        content: JSON.stringify({ role: 'admin' }),
        sig: 'sig',
      };

      mockClient.query
        .mockResolvedValueOnce([joinEvent])
        .mockResolvedValueOnce([roleEvent]);

      const members = await getGroupMembers(
        mockClient as unknown as NostrClient,
        groupId
      );

      expect(members).toHaveLength(1);
      expect(members[0].pubkey).toBe(memberPublicKey);
      expect(members[0].role).toBe('admin');
    });

    it('should handle multiple members', async () => {
      const groupId = 'test-group-id';
      const member2PrivateKey = generateSecretKey();
      const member2PublicKey = getPublicKey(member2PrivateKey);

      const joinEvents: NostrEvent[] = [
        {
          id: 'join-1',
          pubkey: memberPublicKey,
          created_at: 1000,
          kind: 39004,
          tags: [['d', groupId]],
          content: 'Joined',
          sig: 'sig',
        },
        {
          id: 'join-2',
          pubkey: member2PublicKey,
          created_at: 1500,
          kind: 39004,
          tags: [['d', groupId]],
          content: 'Joined',
          sig: 'sig',
        },
      ];

      mockClient.query
        .mockResolvedValueOnce(joinEvents)
        .mockResolvedValueOnce([]);

      const members = await getGroupMembers(
        mockClient as unknown as NostrClient,
        groupId
      );

      expect(members).toHaveLength(2);
    });

    it('should return empty array when no members found', async () => {
      mockClient.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const members = await getGroupMembers(
        mockClient as unknown as NostrClient,
        'empty-group'
      );

      expect(members).toHaveLength(0);
    });

    it('should not duplicate members on multiple join events', async () => {
      const groupId = 'test-group-id';

      // Same member joining twice (edge case)
      const joinEvents: NostrEvent[] = [
        {
          id: 'join-1',
          pubkey: memberPublicKey,
          created_at: 1000,
          kind: 39004,
          tags: [['d', groupId]],
          content: 'Joined first time',
          sig: 'sig',
        },
        {
          id: 'join-2',
          pubkey: memberPublicKey,
          created_at: 2000,
          kind: 39004,
          tags: [['d', groupId]],
          content: 'Joined again',
          sig: 'sig',
        },
      ];

      mockClient.query
        .mockResolvedValueOnce(joinEvents)
        .mockResolvedValueOnce([]);

      const members = await getGroupMembers(
        mockClient as unknown as NostrClient,
        groupId
      );

      // Should not duplicate the member
      expect(members).toHaveLength(1);
      expect(members[0].joinedAt).toBe(1000); // First join time preserved
    });
  });

  describe('hasPermission', () => {
    it('should return true for owner on any permission', () => {
      const owner: GroupMember = {
        pubkey: creatorPublicKey,
        role: 'owner',
        joinedAt: 1000,
      };

      expect(hasPermission(owner, 'invite_members')).toBe(true);
      expect(hasPermission(owner, 'remove_members')).toBe(true);
      expect(hasPermission(owner, 'edit_group')).toBe(true);
      expect(hasPermission(owner, 'post_messages')).toBe(true);
      expect(hasPermission(owner, 'create_events')).toBe(true);
      expect(hasPermission(owner, 'vote')).toBe(true);
    });

    it('should return true for admin on most permissions', () => {
      const admin: GroupMember = {
        pubkey: memberPublicKey,
        role: 'admin',
        joinedAt: 1000,
      };

      expect(hasPermission(admin, 'invite_members')).toBe(true);
      expect(hasPermission(admin, 'edit_group')).toBe(true);
      expect(hasPermission(admin, 'post_messages')).toBe(true);
    });

    it('should return false for admin on remove_members', () => {
      const admin: GroupMember = {
        pubkey: memberPublicKey,
        role: 'admin',
        joinedAt: 1000,
      };

      // Admins can't remove owner
      expect(hasPermission(admin, 'remove_members')).toBe(false);
    });

    it('should check custom permissions for regular members', () => {
      const member: GroupMember = {
        pubkey: memberPublicKey,
        role: 'member',
        joinedAt: 1000,
        permissions: ['post_messages', 'vote'],
      };

      expect(hasPermission(member, 'post_messages')).toBe(true);
      expect(hasPermission(member, 'vote')).toBe(true);
      expect(hasPermission(member, 'invite_members')).toBe(false);
      expect(hasPermission(member, 'edit_group')).toBe(false);
    });

    it('should return false for member without custom permissions', () => {
      const member: GroupMember = {
        pubkey: memberPublicKey,
        role: 'member',
        joinedAt: 1000,
      };

      expect(hasPermission(member, 'invite_members')).toBe(false);
      expect(hasPermission(member, 'edit_group')).toBe(false);
    });

    it('should handle moderator role', () => {
      const moderator: GroupMember = {
        pubkey: memberPublicKey,
        role: 'moderator',
        joinedAt: 1000,
        permissions: ['post_messages', 'manage_events'],
      };

      expect(hasPermission(moderator, 'post_messages')).toBe(true);
      expect(hasPermission(moderator, 'manage_events')).toBe(true);
      expect(hasPermission(moderator, 'invite_members')).toBe(false);
    });
  });
});
