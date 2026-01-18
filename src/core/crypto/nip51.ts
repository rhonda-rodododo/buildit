/**
 * NIP-51 Encrypted Lists Implementation
 *
 * Provides encrypted list storage on Nostr relays for:
 * - Contact lists (follow/mute)
 * - Group memberships
 * - Custom lists
 *
 * SECURITY: Protects social graph from relay operators and adversaries
 * by encrypting all list contents with user's private key.
 *
 * Kind numbers (NIP-51):
 * - 10000: Mute list
 * - 10001: Pin list
 * - 30000: Follow sets (parameterized)
 * - 30001: Relay sets (parameterized)
 * - 30003: Bookmark sets (parameterized)
 * - Custom: 39500-39599 for BuildIt-specific encrypted lists
 */

import { finalizeEvent, type UnsignedEvent, type Event as NostrEvent } from 'nostr-tools';
import { encryptNIP44, decryptNIP44 } from './nip44';
import * as nip44 from 'nostr-tools/nip44';
import { randomizeTimestamp } from './nip17';

/**
 * SECURITY: Check for prototype pollution attempts
 */
function checkPrototypePollution(obj: unknown, path: string = ''): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => checkPrototypePollution(item, `${path}[${index}]`));
    return;
  }

  const record = obj as Record<string, unknown>;

  // __proto__ should never be in JSON
  if (Object.prototype.hasOwnProperty.call(record, '__proto__')) {
    throw new Error(`SECURITY: Prototype pollution attempt detected via __proto__ at ${path}`);
  }

  // prototype property with object value is suspicious
  if (Object.prototype.hasOwnProperty.call(record, 'prototype') && typeof record['prototype'] === 'object') {
    throw new Error(`SECURITY: Prototype pollution attempt detected via prototype at ${path}`);
  }

  // Recursively check nested objects
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'object' && value !== null) {
      checkPrototypePollution(value, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * SECURITY: Safe JSON parse with prototype pollution protection
 * Returns parsed data or throws with descriptive error
 */
function safeParseArray<T>(json: string): T[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`SECURITY: Failed to parse encrypted list JSON: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }

  // Must be an array
  if (!Array.isArray(parsed)) {
    throw new Error('SECURITY: Encrypted list content must be an array');
  }

  // Check for prototype pollution
  checkPrototypePollution(parsed, 'list');

  return parsed as T[];
}

// BuildIt-specific encrypted list kinds
export const ENCRYPTED_LIST_KINDS = {
  CONTACT_LIST: 39500,      // Encrypted contact/friend list
  GROUP_MEMBERSHIP: 39501,  // Encrypted group membership list
  BLOCKED_USERS: 39502,     // Encrypted block list
  TRUSTED_USERS: 39503,     // Encrypted trusted users list
} as const;

export type EncryptedListKind = typeof ENCRYPTED_LIST_KINDS[keyof typeof ENCRYPTED_LIST_KINDS];

/**
 * Encrypted list entry types
 */
export interface ContactListEntry {
  pubkey: string;
  petname?: string;
  trustTier?: 'stranger' | 'contact' | 'friend' | 'verified' | 'trusted';
  addedAt: number;
  tags?: string[];
}

export interface GroupMembershipEntry {
  groupId: string;
  groupName?: string;
  role?: string;
  joinedAt: number;
}

export interface BlockedUserEntry {
  pubkey: string;
  reason?: string;
  blockedAt: number;
}

/**
 * Derive the encryption key for self-encrypted lists
 * Uses the user's private key + their own public key for self-encryption
 *
 * SECURITY: This creates a deterministic key that only this user can derive.
 * Using one's own pubkey as the "recipient" is a standard pattern for self-encryption.
 */
function deriveSelfEncryptionKey(privateKey: Uint8Array): Uint8Array {
  // Get the user's public key from their private key
  const { getPublicKey } = require('nostr-tools');
  const pubkey = getPublicKey(privateKey);

  // Derive conversation key with self (standard self-encryption pattern)
  return nip44.v2.utils.getConversationKey(privateKey, pubkey);
}

/**
 * Create an encrypted list event for self-storage
 *
 * SECURITY: Content is encrypted with user's own key so only they can read it.
 * Timestamp is randomized to prevent timing analysis.
 */
export function createEncryptedListEvent<T>(
  kind: EncryptedListKind,
  entries: T[],
  privateKey: Uint8Array,
  dTag?: string
): NostrEvent {
  // Derive self-encryption key
  const encryptionKey = deriveSelfEncryptionKey(privateKey);

  // Serialize entries to JSON
  const plaintext = JSON.stringify(entries);

  // Encrypt with NIP-44
  const encrypted = encryptNIP44(plaintext, encryptionKey);

  // Build tags
  const tags: string[][] = [];
  if (dTag) {
    tags.push(['d', dTag]);
  }

  // Create unsigned event with randomized timestamp
  const unsignedEvent: UnsignedEvent = {
    kind,
    content: encrypted,
    tags,
    created_at: randomizeTimestamp(),
    pubkey: '', // Will be set by finalizeEvent
  };

  // Sign and finalize
  return finalizeEvent(unsignedEvent, privateKey);
}

/**
 * Decrypt a list event
 */
export function decryptListEvent<T>(
  event: NostrEvent,
  privateKey: Uint8Array
): T[] | null {
  try {
    // Derive self-encryption key
    const encryptionKey = deriveSelfEncryptionKey(privateKey);

    // Decrypt content
    const plaintext = decryptNIP44(event.content, encryptionKey);

    // SECURITY: Safe parse with prototype pollution protection
    return safeParseArray<T>(plaintext);
  } catch (error) {
    console.error('Failed to decrypt list event:', error);
    return null;
  }
}

/**
 * Create an encrypted contact list event
 */
export function createContactListEvent(
  contacts: ContactListEntry[],
  privateKey: Uint8Array
): NostrEvent {
  return createEncryptedListEvent(
    ENCRYPTED_LIST_KINDS.CONTACT_LIST,
    contacts,
    privateKey,
    'contacts'
  );
}

/**
 * Create an encrypted group membership list event
 */
export function createGroupMembershipEvent(
  groups: GroupMembershipEntry[],
  privateKey: Uint8Array
): NostrEvent {
  return createEncryptedListEvent(
    ENCRYPTED_LIST_KINDS.GROUP_MEMBERSHIP,
    groups,
    privateKey,
    'groups'
  );
}

/**
 * Create an encrypted block list event
 */
export function createBlockListEvent(
  blockedUsers: BlockedUserEntry[],
  privateKey: Uint8Array
): NostrEvent {
  return createEncryptedListEvent(
    ENCRYPTED_LIST_KINDS.BLOCKED_USERS,
    blockedUsers,
    privateKey,
    'blocked'
  );
}

/**
 * Decrypt a contact list from an event
 */
export function decryptContactList(
  event: NostrEvent,
  privateKey: Uint8Array
): ContactListEntry[] | null {
  return decryptListEvent<ContactListEntry>(event, privateKey);
}

/**
 * Decrypt a group membership list from an event
 */
export function decryptGroupMembershipList(
  event: NostrEvent,
  privateKey: Uint8Array
): GroupMembershipEntry[] | null {
  return decryptListEvent<GroupMembershipEntry>(event, privateKey);
}

/**
 * Decrypt a block list from an event
 */
export function decryptBlockList(
  event: NostrEvent,
  privateKey: Uint8Array
): BlockedUserEntry[] | null {
  return decryptListEvent<BlockedUserEntry>(event, privateKey);
}

/**
 * Build filters to fetch encrypted lists for a user
 */
export function getEncryptedListFilters(pubkey: string, kinds?: EncryptedListKind[]) {
  const listKinds = kinds || Object.values(ENCRYPTED_LIST_KINDS);
  return {
    kinds: listKinds,
    authors: [pubkey],
    limit: 100,
  };
}
