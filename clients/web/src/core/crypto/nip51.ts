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
  relay?: string;
  petname?: string;
  trustTier?: 'stranger' | 'contact' | 'friend' | 'verified' | 'trusted';
  addedAt: number;
  tags?: string[];
  /** Flag to mark dummy/decoy contacts for obfuscation (not synced to store) */
  isDummy?: boolean;
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

/**
 * Configuration for contact list publishing modes
 */
export interface ContactListPublishConfig {
  /** Whether to publish encrypted list to relays (default: true) */
  publishEncrypted: boolean;
  /** Whether to also publish plaintext Kind 3 for backward compatibility (default: false) */
  publishPlaintext: boolean;
  /** Number of dummy contacts to add for obfuscation (default: 0) */
  dummyContactCount: number;
}

export const DEFAULT_CONTACT_LIST_CONFIG: ContactListPublishConfig = {
  publishEncrypted: true,
  publishPlaintext: false, // Disabled by default for privacy
  dummyContactCount: 0,
};

/**
 * SECURITY: Generate cryptographically random dummy pubkeys for obfuscation
 * These look like real pubkeys but don't correspond to real users
 */
export function generateDummyPubkeys(count: number): string[] {
  const dummies: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 32 random bytes
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    // Convert to hex string (64 chars = valid pubkey format)
    const pubkey = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    dummies.push(pubkey);
  }
  return dummies;
}

/**
 * Create dummy contact entries for obfuscation
 * SECURITY: These are mixed with real contacts to obscure the actual social graph size
 */
export function createDummyContacts(count: number): ContactListEntry[] {
  const dummyPubkeys = generateDummyPubkeys(count);
  const now = Math.floor(Date.now() / 1000);

  return dummyPubkeys.map((pubkey, index) => ({
    pubkey,
    addedAt: now - (index * 86400), // Stagger timestamps to look natural
    isDummy: true,
  }));
}

/**
 * Mix real contacts with dummy contacts and shuffle
 * SECURITY: Shuffling prevents timing analysis based on position
 */
export function obfuscateContactList(
  realContacts: ContactListEntry[],
  dummyCount: number
): ContactListEntry[] {
  if (dummyCount <= 0) {
    return realContacts;
  }

  const dummies = createDummyContacts(dummyCount);
  const mixed = [...realContacts, ...dummies];

  // Fisher-Yates shuffle using crypto random
  for (let i = mixed.length - 1; i > 0; i--) {
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    const randomIndex = new DataView(randomBytes.buffer).getUint32(0) % (i + 1);
    [mixed[i], mixed[randomIndex]] = [mixed[randomIndex], mixed[i]];
  }

  return mixed;
}

/**
 * Filter out dummy contacts when loading from encrypted storage
 */
export function filterRealContacts(contacts: ContactListEntry[]): ContactListEntry[] {
  return contacts.filter(c => !c.isDummy);
}

/**
 * Parse Kind 3 plaintext contact list event into ContactListEntry format
 * Used for backward compatibility when reading old contact lists
 */
export function parseKind3ContactList(event: NostrEvent): ContactListEntry[] {
  if (event.kind !== 3) {
    throw new Error('Expected Kind 3 event');
  }

  const contacts: ContactListEntry[] = [];

  for (const tag of event.tags) {
    if (tag[0] === 'p' && tag[1]) {
      contacts.push({
        pubkey: tag[1],
        relay: tag[2] || undefined,
        petname: tag[3] || undefined,
        addedAt: event.created_at,
      });
    }
  }

  return contacts;
}

/**
 * Create a plaintext Kind 3 contact list event (for backward compatibility)
 * WARNING: This exposes the social graph - only use when explicitly enabled
 *
 * @param contacts - Contact entries to include
 * @param privateKey - Private key for signing
 * @param includeDummies - Whether to include dummy contacts for obfuscation
 */
export function createKind3ContactListEvent(
  contacts: ContactListEntry[],
  privateKey: Uint8Array,
  dummyCount: number = 0
): NostrEvent {
  // Optionally add dummy contacts
  const finalContacts = dummyCount > 0
    ? obfuscateContactList(contacts, dummyCount)
    : contacts;

  // Build p tags
  const tags: string[][] = finalContacts.map(contact => {
    const tag = ['p', contact.pubkey];
    if (contact.relay || contact.petname) {
      tag.push(contact.relay || '');
    }
    if (contact.petname) {
      tag.push(contact.petname);
    }
    return tag;
  });

  const unsignedEvent: UnsignedEvent = {
    kind: 3,
    content: '',
    tags,
    created_at: randomizeTimestamp(),
    pubkey: '',
  };

  return finalizeEvent(unsignedEvent, privateKey);
}

/**
 * Migrate contacts from Kind 3 format to encrypted NIP-51 format
 *
 * @param kind3Event - The Kind 3 contact list event to migrate
 * @param privateKey - Private key for encryption and signing
 * @returns The new encrypted contact list event
 */
export function migrateKind3ToEncrypted(
  kind3Event: NostrEvent,
  privateKey: Uint8Array
): NostrEvent {
  const contacts = parseKind3ContactList(kind3Event);
  return createContactListEvent(contacts, privateKey);
}

/**
 * Build filter to fetch Kind 3 contact list for a user
 */
export function getKind3ContactListFilter(pubkey: string) {
  return {
    kinds: [3],
    authors: [pubkey],
    limit: 1,
  };
}

/**
 * Determine if an encrypted contact list event is newer than a Kind 3 event
 */
export function isEncryptedListNewer(
  encryptedEvent: NostrEvent | null,
  kind3Event: NostrEvent | null
): boolean {
  if (!encryptedEvent) return false;
  if (!kind3Event) return true;
  return encryptedEvent.created_at > kind3Event.created_at;
}
