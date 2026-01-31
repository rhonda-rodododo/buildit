import type { ModulePermission } from '@/types/modules';
import { dal } from '@/core/storage/dal';

/**
 * Check if a user has permission to use a module in a group
 */
export async function hasModulePermission(
  userPubkey: string,
  groupId: string,
  requiredPermission: ModulePermission
): Promise<boolean> {
  // 'all' permission means everyone can use it
  if (requiredPermission === 'all') {
    return true;
  }

  // Get user's role in the group
  const memberships = await dal.query<{ role: string }>('groupMembers', {
    whereClause: { groupId, pubkey: userPubkey },
    limit: 1,
  });
  const membership = memberships[0];

  if (!membership) {
    return false;
  }

  const { role } = membership;

  // Permission hierarchy: admin > moderator > member
  switch (requiredPermission) {
    case 'admin':
      return role === 'admin';
    case 'moderator':
      return role === 'admin' || role === 'moderator';
    case 'member':
      return role === 'admin' || role === 'moderator' || role === 'member';
    default:
      return false;
  }
}

/**
 * Check if a user can enable/disable modules for a group
 * Only admins can manage modules
 */
export async function canManageModules(userPubkey: string, groupId: string): Promise<boolean> {
  const memberships = await dal.query<{ role: string }>('groupMembers', {
    whereClause: { groupId, pubkey: userPubkey },
    limit: 1,
  });

  return memberships[0]?.role === 'admin';
}

/**
 * Check if a user can configure a module for a group
 * Admins and moderators can configure modules
 */
export async function canConfigureModule(userPubkey: string, groupId: string): Promise<boolean> {
  const memberships = await dal.query<{ role: string }>('groupMembers', {
    whereClause: { groupId, pubkey: userPubkey },
    limit: 1,
  });

  return memberships[0]?.role === 'admin' || memberships[0]?.role === 'moderator';
}

/**
 * Get user's role in a group
 */
export async function getUserRole(
  userPubkey: string,
  groupId: string
): Promise<'admin' | 'moderator' | 'member' | 'read-only' | null> {
  const memberships = await dal.query<{ role: 'admin' | 'moderator' | 'member' | 'read-only' }>('groupMembers', {
    whereClause: { groupId, pubkey: userPubkey },
    limit: 1,
  });

  return memberships[0]?.role || null;
}
