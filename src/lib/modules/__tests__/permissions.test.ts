import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasModulePermission, canManageModules, canConfigureModule, getUserRole } from '../permissions';

// Mock the database
const mockGroupMembers = new Map();

vi.mock('@/core/storage/db', () => ({
  db: {
    groupMembers: {
      where: (_key: string) => ({
        equals: (value: [string, string]) => ({
          first: async () => {
            const key = `${value[0]}:${value[1]}`;
            return mockGroupMembers.get(key);
          },
        }),
      }),
    },
  },
}));

describe('permissions', () => {
  const groupId = 'test-group';
  const adminPubkey = 'admin-pubkey';
  const modPubkey = 'mod-pubkey';
  const memberPubkey = 'member-pubkey';
  const nonMemberPubkey = 'non-member-pubkey';

  beforeEach(() => {
    mockGroupMembers.clear();
    mockGroupMembers.set(`${groupId}:${adminPubkey}`, {
      groupId,
      pubkey: adminPubkey,
      role: 'admin',
      joined: Date.now(),
    });
    mockGroupMembers.set(`${groupId}:${modPubkey}`, {
      groupId,
      pubkey: modPubkey,
      role: 'moderator',
      joined: Date.now(),
    });
    mockGroupMembers.set(`${groupId}:${memberPubkey}`, {
      groupId,
      pubkey: memberPubkey,
      role: 'member',
      joined: Date.now(),
    });
  });

  describe('hasModulePermission', () => {
    it('should allow "all" permission for everyone', async () => {
      expect(await hasModulePermission(nonMemberPubkey, groupId, 'all')).toBe(true);
      expect(await hasModulePermission(memberPubkey, groupId, 'all')).toBe(true);
      expect(await hasModulePermission(modPubkey, groupId, 'all')).toBe(true);
      expect(await hasModulePermission(adminPubkey, groupId, 'all')).toBe(true);
    });

    it('should allow "member" permission for members and above', async () => {
      expect(await hasModulePermission(nonMemberPubkey, groupId, 'member')).toBe(false);
      expect(await hasModulePermission(memberPubkey, groupId, 'member')).toBe(true);
      expect(await hasModulePermission(modPubkey, groupId, 'member')).toBe(true);
      expect(await hasModulePermission(adminPubkey, groupId, 'member')).toBe(true);
    });

    it('should allow "moderator" permission for moderators and above', async () => {
      expect(await hasModulePermission(nonMemberPubkey, groupId, 'moderator')).toBe(false);
      expect(await hasModulePermission(memberPubkey, groupId, 'moderator')).toBe(false);
      expect(await hasModulePermission(modPubkey, groupId, 'moderator')).toBe(true);
      expect(await hasModulePermission(adminPubkey, groupId, 'moderator')).toBe(true);
    });

    it('should allow "admin" permission only for admins', async () => {
      expect(await hasModulePermission(nonMemberPubkey, groupId, 'admin')).toBe(false);
      expect(await hasModulePermission(memberPubkey, groupId, 'admin')).toBe(false);
      expect(await hasModulePermission(modPubkey, groupId, 'admin')).toBe(false);
      expect(await hasModulePermission(adminPubkey, groupId, 'admin')).toBe(true);
    });
  });

  describe('canManageModules', () => {
    it('should only allow admins to manage modules', async () => {
      expect(await canManageModules(nonMemberPubkey, groupId)).toBe(false);
      expect(await canManageModules(memberPubkey, groupId)).toBe(false);
      expect(await canManageModules(modPubkey, groupId)).toBe(false);
      expect(await canManageModules(adminPubkey, groupId)).toBe(true);
    });
  });

  describe('canConfigureModule', () => {
    it('should allow admins and moderators to configure modules', async () => {
      expect(await canConfigureModule(nonMemberPubkey, groupId)).toBe(false);
      expect(await canConfigureModule(memberPubkey, groupId)).toBe(false);
      expect(await canConfigureModule(modPubkey, groupId)).toBe(true);
      expect(await canConfigureModule(adminPubkey, groupId)).toBe(true);
    });
  });

  describe('getUserRole', () => {
    it('should return correct role for users', async () => {
      expect(await getUserRole(adminPubkey, groupId)).toBe('admin');
      expect(await getUserRole(modPubkey, groupId)).toBe('moderator');
      expect(await getUserRole(memberPubkey, groupId)).toBe('member');
      expect(await getUserRole(nonMemberPubkey, groupId)).toBe(null);
    });
  });
});
