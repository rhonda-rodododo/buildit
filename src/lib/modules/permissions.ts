import type { ModulePermission } from '@/types/modules';
import { db } from '@/core/storage/db';

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
  const membership = await db.groupMembers
    .where('[groupId+pubkey]')
    .equals([groupId, userPubkey])
    .first();

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
  const membership = await db.groupMembers
    .where('[groupId+pubkey]')
    .equals([groupId, userPubkey])
    .first();

  return membership?.role === 'admin';
}

/**
 * Check if a user can configure a module for a group
 * Admins and moderators can configure modules
 */
export async function canConfigureModule(userPubkey: string, groupId: string): Promise<boolean> {
  const membership = await db.groupMembers
    .where('[groupId+pubkey]')
    .equals([groupId, userPubkey])
    .first();

  return membership?.role === 'admin' || membership?.role === 'moderator';
}

/**
 * Get user's role in a group
 */
export async function getUserRole(
  userPubkey: string,
  groupId: string
): Promise<'admin' | 'moderator' | 'member' | 'read-only' | null> {
  const membership = await db.groupMembers
    .where('[groupId+pubkey]')
    .equals([groupId, userPubkey])
    .first();

  return membership?.role || null;
}
