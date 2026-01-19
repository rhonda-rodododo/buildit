/**
 * GroupsStore Tests
 * Tests for group management and membership
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGroupsStore } from '../groupsStore';
import type { DBGroup, DBGroupMember } from '@/core/storage/db';

// Use vi.hoisted for data that needs to be available in vi.mock
const { mockGroups, mockGroupMembers, createMockTable } = vi.hoisted(() => ({
  mockGroups: new Map<string, DBGroup>(),
  mockGroupMembers: [] as DBGroupMember[],
  createMockTable: () => ({
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        delete: vi.fn(() => Promise.resolve(0)),
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
  }),
}));

vi.mock('@/core/storage/db', () => ({
  db: {
    groups: {
      add: vi.fn((group: DBGroup) => {
        mockGroups.set(group.id, group);
        return Promise.resolve();
      }),
      get: vi.fn((id: string) => Promise.resolve(mockGroups.get(id))),
      update: vi.fn((id: string, updates: Partial<DBGroup>) => {
        const existing = mockGroups.get(id);
        if (existing) {
          mockGroups.set(id, { ...existing, ...updates });
        }
        return Promise.resolve();
      }),
      delete: vi.fn((id: string) => {
        mockGroups.delete(id);
        return Promise.resolve();
      }),
      where: vi.fn(() => ({
        anyOf: vi.fn((ids: string[]) => ({
          toArray: vi.fn(() =>
            Promise.resolve(ids.map((id) => mockGroups.get(id)).filter(Boolean))
          ),
        })),
      })),
    },
    groupMembers: {
      add: vi.fn((member: DBGroupMember) => {
        mockGroupMembers.push(member);
        return Promise.resolve();
      }),
      update: vi.fn((_id: number, _updates: Partial<DBGroupMember>) => Promise.resolve()),
      where: vi.fn((field: string | string[]) => ({
        equals: vi.fn((value: string | string[]) => {
          // Support compound index query: where(['groupId', 'pubkey']).equals([groupId, pubkey])
          if (Array.isArray(field) && Array.isArray(value)) {
            return {
              first: vi.fn(() => {
                const [groupIdField, pubkeyField] = field;
                const [groupIdValue, pubkeyValue] = value;
                return Promise.resolve(
                  mockGroupMembers.find(
                    (m) => m[groupIdField as keyof DBGroupMember] === groupIdValue &&
                           m[pubkeyField as keyof DBGroupMember] === pubkeyValue
                  )
                );
              }),
              toArray: vi.fn(() => {
                const [groupIdField, pubkeyField] = field;
                const [groupIdValue, pubkeyValue] = value;
                return Promise.resolve(
                  mockGroupMembers.filter(
                    (m) => m[groupIdField as keyof DBGroupMember] === groupIdValue &&
                           m[pubkeyField as keyof DBGroupMember] === pubkeyValue
                  )
                );
              }),
              delete: vi.fn(() => Promise.resolve(0)),
            };
          }
          // Simple single field query
          return {
            toArray: vi.fn(() =>
              Promise.resolve(
                mockGroupMembers.filter((m) => m[field as keyof DBGroupMember] === value)
              )
            ),
            delete: vi.fn(() => {
              const toRemove = mockGroupMembers.filter(
                (m) => m[field as keyof DBGroupMember] === value
              );
              toRemove.forEach((m) => {
                const idx = mockGroupMembers.indexOf(m);
                if (idx >= 0) mockGroupMembers.splice(idx, 1);
              });
              return Promise.resolve(toRemove.length);
            }),
          };
        }),
      })),
    },
    // Core tables used by deleteGroup
    messages: createMockTable(),
    moduleInstances: createMockTable(),
    conversations: createMockTable(),
    groupEntities: createMockTable(),
    groupEntityMessages: createMockTable(),
    channels: createMockTable(),
    // db.table() method for accessing module tables dynamically
    table: vi.fn(() => createMockTable()),
    transaction: vi.fn(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => {
        await callback();
      }
    ),
  },
}));

// Mock authStore for authorization checks
const mockCurrentIdentity = {
  publicKey: 'test-user-pubkey-0123456789abcdef0123456789abcdef',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      currentIdentity: mockCurrentIdentity,
    })),
  },
}));

// Mock Nostr client
vi.mock('@/core/nostr/client', () => ({
  getNostrClient: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock group manager
vi.mock('@/core/groups/groupManager', () => ({
  createGroup: vi.fn((client, params) => ({
    id: `group-${Date.now()}`,
    name: params.name,
    description: params.description,
  })),
}));

// Mock nostr-tools
vi.mock('nostr-tools/pure', () => ({
  generateSecretKey: vi.fn(() => new Uint8Array(32).fill(42)),
}));

vi.mock('@noble/hashes/utils.js', () => ({
  bytesToHex: vi.fn(() => 'abcd1234'),
}));

describe('groupsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroups.clear();
    mockGroupMembers.length = 0;

    // Reset store state
    useGroupsStore.setState({
      activeGroup: null,
      groups: [],
      groupMembers: new Map(),
      isLoading: false,
      error: null,
    });
  });

  describe('setActiveGroup', () => {
    it('should set active group', () => {
      const { setActiveGroup } = useGroupsStore.getState();

      const group: DBGroup = {
        id: 'group-1',
        name: 'Test Group',
        description: 'A test group',
        adminPubkeys: ['admin1'],
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };

      setActiveGroup(group);

      const { activeGroup, error } = useGroupsStore.getState();
      expect(activeGroup).toEqual(group);
      expect(error).toBeNull();
    });

    it('should clear error when setting active group', () => {
      useGroupsStore.setState({ error: 'Previous error' });
      const { setActiveGroup } = useGroupsStore.getState();

      setActiveGroup(null);

      const { error } = useGroupsStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('createGroup', () => {
    it('should create a group and add to state', async () => {
      const { createGroup } = useGroupsStore.getState();

      const params = {
        name: 'New Group',
        description: 'Test description',
        privacyLevel: 'public' as const,
        enabledModules: ['messaging', 'events'],
      };

      const privateKey = new Uint8Array(32).fill(1);
      const creatorPubkey = 'creator-pubkey';

      const group = await createGroup(params, privateKey, creatorPubkey);

      expect(group).toBeDefined();
      expect(group.name).toBe('New Group');
      expect(group.description).toBe('Test description');
      expect(group.adminPubkeys).toContain(creatorPubkey);

      const { groups, activeGroup, isLoading } = useGroupsStore.getState();
      expect(groups).toHaveLength(1);
      expect(activeGroup?.id).toBe(group.id);
      expect(isLoading).toBe(false);
    });

    it('should generate group key for private groups', async () => {
      const { createGroup } = useGroupsStore.getState();

      const params = {
        name: 'Private Group',
        description: 'Secret',
        privacyLevel: 'private' as const,
        enabledModules: [],
      };

      const group = await createGroup(
        params,
        new Uint8Array(32).fill(1),
        'creator'
      );

      expect(group.encryptedGroupKey).toBeDefined();
    });

    // Note: Error handling is tested implicitly through the store's error state management
    // Testing specific error cases would require more complex mock setup
  });

  describe('loadGroups', () => {
    it('should load groups for a user', async () => {
      // Setup test data
      const group1: DBGroup = {
        id: 'group-1',
        name: 'Group 1',
        adminPubkeys: [],
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      mockGroups.set('group-1', group1);
      mockGroupMembers.push({
        groupId: 'group-1',
        pubkey: 'user1',
        role: 'member',
        joined: Date.now(),
      });

      const { loadGroups } = useGroupsStore.getState();

      await loadGroups('user1');

      const { groups, isLoading } = useGroupsStore.getState();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('group-1');
      expect(isLoading).toBe(false);
    });

    it('should handle empty membership', async () => {
      const { loadGroups } = useGroupsStore.getState();

      await loadGroups('new-user');

      const { groups } = useGroupsStore.getState();
      expect(groups).toHaveLength(0);
    });
  });

  describe('loadGroupMembers', () => {
    it('should load members for a group', async () => {
      mockGroupMembers.push(
        {
          groupId: 'group-1',
          pubkey: 'member1',
          role: 'admin',
          joined: Date.now(),
        },
        {
          groupId: 'group-1',
          pubkey: 'member2',
          role: 'member',
          joined: Date.now(),
        }
      );

      const { loadGroupMembers } = useGroupsStore.getState();

      await loadGroupMembers('group-1');

      const { groupMembers } = useGroupsStore.getState();
      expect(groupMembers.get('group-1')).toHaveLength(2);
    });
  });

  describe('updateGroup', () => {
    it('should update group in state and database', async () => {
      const testUserPubkey = 'test-user-pubkey-0123456789abcdef0123456789abcdef';
      const group: DBGroup = {
        id: 'group-1',
        name: 'Original Name',
        adminPubkeys: [testUserPubkey], // Make test user an admin
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      mockGroups.set('group-1', group);
      // Add admin membership for authorization check
      mockGroupMembers.push({
        id: 1,
        groupId: 'group-1',
        pubkey: testUserPubkey,
        role: 'admin',
        joined: Date.now(),
      });
      useGroupsStore.setState({
        groups: [group],
        activeGroup: group,
      });

      const { updateGroup } = useGroupsStore.getState();

      await updateGroup('group-1', { name: 'Updated Name' });

      const { groups, activeGroup, isLoading } = useGroupsStore.getState();
      expect(groups[0].name).toBe('Updated Name');
      expect(activeGroup?.name).toBe('Updated Name');
      expect(isLoading).toBe(false);

      // Clean up
      mockGroupMembers.length = 0;
    });

    it('should not update activeGroup if different', async () => {
      const testUserPubkey = 'test-user-pubkey-0123456789abcdef0123456789abcdef';
      const group1: DBGroup = {
        id: 'group-1',
        name: 'Group 1',
        adminPubkeys: [testUserPubkey],
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      const group2: DBGroup = {
        id: 'group-2',
        name: 'Group 2',
        adminPubkeys: [testUserPubkey],
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      mockGroups.set('group-1', group1);
      mockGroups.set('group-2', group2);
      // Add admin membership for authorization check
      mockGroupMembers.push({
        id: 1,
        groupId: 'group-1',
        pubkey: testUserPubkey,
        role: 'admin',
        joined: Date.now(),
      });
      useGroupsStore.setState({
        groups: [group1, group2],
        activeGroup: group2,
      });

      const { updateGroup } = useGroupsStore.getState();

      await updateGroup('group-1', { name: 'Updated' });

      const { activeGroup } = useGroupsStore.getState();
      expect(activeGroup?.id).toBe('group-2');
      expect(activeGroup?.name).toBe('Group 2');

      // Clean up
      mockGroupMembers.length = 0;
    });
  });

  describe('deleteGroup', () => {
    it('should delete group and related data', async () => {
      const testUserPubkey = 'test-user-pubkey-0123456789abcdef0123456789abcdef';
      const group: DBGroup = {
        id: 'group-1',
        name: 'Test',
        adminPubkeys: [testUserPubkey], // Make test user an admin
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      mockGroups.set('group-1', group);
      // Add admin membership for authorization check
      mockGroupMembers.push({
        id: 1,
        groupId: 'group-1',
        pubkey: testUserPubkey,
        role: 'admin',
        joined: Date.now(),
      });
      useGroupsStore.setState({
        groups: [group],
        activeGroup: group,
      });

      const { deleteGroup } = useGroupsStore.getState();

      await deleteGroup('group-1');

      const { groups, activeGroup, isLoading } = useGroupsStore.getState();
      expect(groups).toHaveLength(0);
      expect(activeGroup).toBeNull();
      expect(isLoading).toBe(false);

      // Clean up
      mockGroupMembers.length = 0;
    });

    it('should not clear activeGroup if deleting different group', async () => {
      const testUserPubkey = 'test-user-pubkey-0123456789abcdef0123456789abcdef';
      const group1: DBGroup = {
        id: 'group-1',
        name: 'Group 1',
        adminPubkeys: [testUserPubkey], // Make test user an admin
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      const group2: DBGroup = {
        id: 'group-2',
        name: 'Group 2',
        adminPubkeys: [testUserPubkey],
        created: Date.now(),
        privacy: 'public',
        enabledModules: [],
      };
      mockGroups.set('group-1', group1);
      mockGroups.set('group-2', group2);

      // Add admin membership for authorization check
      mockGroupMembers.push({
        id: 1,
        groupId: 'group-1',
        pubkey: testUserPubkey,
        role: 'admin',
        joined: Date.now(),
      });
      mockGroupMembers.push({
        id: 2,
        groupId: 'group-2',
        pubkey: testUserPubkey,
        role: 'admin',
        joined: Date.now(),
      });

      useGroupsStore.setState({
        groups: [group1, group2],
        activeGroup: group2,
      });

      const { deleteGroup } = useGroupsStore.getState();

      await deleteGroup('group-1');

      const { activeGroup } = useGroupsStore.getState();
      expect(activeGroup?.id).toBe('group-2');

      // Clean up
      mockGroupMembers.length = 0;
    });
  });

  describe('toggleModule', () => {
    it('should throw error if user is not authorized', async () => {
      // SECURITY: Authorization check runs before checking group existence
      // This prevents enumeration attacks (revealing which groups exist)
      const { toggleModule } = useGroupsStore.getState();

      await expect(toggleModule('non-existent', 'events')).rejects.toThrow(
        'Unauthorized'
      );
    });
  });
});
