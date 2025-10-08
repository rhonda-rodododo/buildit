import { db } from '@/core/storage/db';

/**
 * Reserved usernames to prevent impersonation
 */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'mod',
  'moderator',
  'system',
  'support',
  'help',
  'buildit',
  'buildithq',
  'official',
  'team',
  'staff',
  'nostr',
  'root',
  'postmaster',
  'webmaster',
  'security',
  'hostmaster',
  'abuse',
  'noreply',
  'no-reply',
]);

/**
 * Offensive words to block (basic list - should be expanded)
 */
const OFFENSIVE_WORDS = new Set([
  'nazi',
  'hitler',
  'terrorist',
  // Add more offensive terms as needed
]);

/**
 * Username validation result
 */
export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate username format and content
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Check length
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  // Check format (alphanumeric + hyphens only)
  const validFormat = /^[a-z0-9-]+$/;
  if (!validFormat.test(username.toLowerCase())) {
    return { valid: false, error: 'Username can only contain letters, numbers, and hyphens' };
  }

  // Cannot start or end with hyphen
  if (username.startsWith('-') || username.endsWith('-')) {
    return { valid: false, error: 'Username cannot start or end with a hyphen' };
  }

  // Cannot have consecutive hyphens
  if (username.includes('--')) {
    return { valid: false, error: 'Username cannot contain consecutive hyphens' };
  }

  // Check reserved words
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  // Check offensive words
  const lowerUsername = username.toLowerCase();
  for (const word of OFFENSIVE_WORDS) {
    if (lowerUsername.includes(word)) {
      return { valid: false, error: 'This username contains inappropriate content' };
    }
  }

  return { valid: true };
}

/**
 * Check if username is available (not already taken)
 */
export async function isUsernameAvailable(username: string, currentPubkey?: string): Promise<boolean> {
  const existingIdentity = await db.identities
    .where('username')
    .equals(username.toLowerCase())
    .first();

  // Username is available if not found, or if it belongs to the current user
  return !existingIdentity || existingIdentity.publicKey === currentPubkey;
}

/**
 * Normalize username (lowercase, trim)
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Format username for display (@username)
 */
export function formatUsername(username: string): string {
  return `@${username}`;
}

/**
 * Get display name for a pubkey
 * Priority: displayName > username > name > npub (truncated)
 */
export async function getDisplayName(pubkey: string): Promise<string> {
  const identity = await db.identities.get(pubkey);

  if (!identity) {
    // Truncate pubkey for display
    return `${pubkey.slice(0, 8)}...`;
  }

  return identity.displayName || identity.username || identity.name || `${pubkey.slice(0, 8)}...`;
}

/**
 * Get username for a pubkey (returns undefined if no username set)
 */
export async function getUsername(pubkey: string): Promise<string | undefined> {
  const identity = await db.identities.get(pubkey);
  return identity?.username;
}

/**
 * Search identities by username (fuzzy matching)
 */
export async function searchByUsername(query: string, limit = 10): Promise<Array<{ pubkey: string; username: string; displayName?: string }>> {
  const normalizedQuery = normalizeUsername(query);

  const identities = await db.identities
    .where('username')
    .startsWithIgnoreCase(normalizedQuery)
    .limit(limit)
    .toArray();

  return identities
    .filter(id => id.username) // Only include identities with usernames
    .map(id => ({
      pubkey: id.publicKey,
      username: id.username!,
      displayName: id.displayName,
    }));
}

/**
 * Get identity by username
 */
export async function getIdentityByUsername(username: string) {
  return db.identities
    .where('username')
    .equals(normalizeUsername(username))
    .first();
}
