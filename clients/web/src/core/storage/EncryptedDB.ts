/**
 * Encrypted Database Layer
 * Uses NIP-44 (ChaCha20-Poly1305) with a local encryption key for at-rest encryption
 *
 * Key Hierarchy:
 * Password → (PBKDF2) → MEK (Master Encryption Key)
 * Private Key + "local-db-v1" → (HKDF) → Local Encryption Key
 * Local Encryption Key → (NIP-44) → Encrypted field values
 *
 * SECURITY INVARIANTS:
 * 1. Keys are only in memory when app is unlocked
 * 2. Sensitive fields are ALWAYS encrypted before storage
 * 3. Attempts to write sensitive data while locked throw errors
 * 4. Uses distinct key derivation for local vs relay encryption
 */

import { encryptNIP44, decryptNIP44 } from '@/core/crypto/nip44';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';

import { logger } from '@/lib/logger';
// Version marker for local encrypted data
const LOCAL_ENCRYPTION_VERSION = 'local:1:';
// Legacy NIP-44 marker (direct private key encryption)
const LEGACY_NIP44_MARKER = 'enc:1:';

// Context for local encryption key derivation
const LOCAL_KEY_CONTEXT = 'BuildItNetwork-LocalDB-v1';

/**
 * Fields that should be encrypted in each table
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  // Messages
  messages: ['content'],

  // Conversation messages (DMs and group threads)
  conversationMessages: ['content'],

  // Conversation metadata (protects social graph)
  conversations: ['name', 'lastMessagePreview'],

  // Events
  events: ['title', 'description', 'location'],

  // Group data
  groups: ['description'],

  // Mutual aid
  mutualAidRequests: ['title', 'description', 'notes'],

  // Proposals
  proposals: ['title', 'description'],

  // Wiki
  wikiPages: ['title', 'content'],

  // Database records
  databaseRecords: ['data'],

  // Posts
  posts: ['content'],

  // Friends (protects social connections)
  // SECURITY: Encrypt all identity-revealing fields to protect social graph
  // Note: friendPubkey/userPubkey are indexes and can't be encrypted at rest,
  // but we use NIP-51 encrypted lists for relay-stored social graph protection
  friends: ['displayName', 'notes', 'username', 'tags'],

  // Friend requests (protect pending connections)
  friendRequests: ['message'],

  // Friend invite links (protect invite metadata)
  friendInviteLinks: [],

  // Documents
  documents: ['title', 'content'],

  // Files metadata
  files: ['name', 'description'],

  // Search index (protect searchable content at rest)
  searchIndex: ['title', 'content', 'excerpt', 'facets', 'vector', 'tags'],

  // Tags (protect tag names which may reveal organizing activities)
  tags: ['name'],

  // Saved searches (protect search patterns)
  savedSearches: ['query', 'filters'],

  // Recent searches (protect search history)
  recentSearches: ['query'],
};

// Cached local encryption key (cleared on lock)
let localEncryptionKey: Uint8Array | null = null;

/**
 * Test mode - ONLY available during actual test runs
 *
 * SECURITY: This uses Vite's build-time define feature (import.meta.env.MODE)
 * which is replaced at build time. In production builds, the test mode code
 * is completely eliminated by the bundler's dead code elimination.
 *
 * - Production: import.meta.env.MODE === 'production' -> test mode code removed
 * - Test: import.meta.env.MODE === 'test' -> test mode available
 *
 * This prevents any runtime manipulation of test mode in production.
 */

// Build-time constant - Vite replaces this at compile time
const IS_TEST_BUILD = import.meta.env.MODE === 'test';

// Runtime flag - can only be set if build allows it
let testModeEnabled = false;

/**
 * Enable test mode (bypasses encryption)
 * SECURITY: Only available in test builds (checked at build time)
 */
export function enableTestMode(): void {
  // Build-time check - this entire branch is removed in production builds
  if (IS_TEST_BUILD) {
    testModeEnabled = true;
    logger.info('⚠️  Test mode enabled - encryption bypassed');
  } else {
    // This warning should never appear in production since the function
    // should not be called (and the check above is false)
    console.error('🚨 SECURITY: Test mode requested in production build - REJECTED');
    throw new Error('Test mode is not available in production builds');
  }
}

/**
 * Disable test mode
 */
export function disableTestMode(): void {
  testModeEnabled = false;
}

/**
 * Check if test mode is enabled
 * SECURITY: Always returns false in production builds (dead code elimination)
 */
export function isTestMode(): boolean {
  // In production builds, IS_TEST_BUILD is false, so this always returns false
  // The bundler's dead code elimination will optimize this
  return IS_TEST_BUILD && testModeEnabled;
}

/**
 * Get or derive the local encryption key
 * This is distinct from relay communication keys
 *
 * SECURITY: Uses HMAC-SHA256 for key derivation from private key + context.
 * This is cryptographically sound: HMAC-SHA256 is a standard PRF that produces
 * a 32-byte key suitable for NIP-44 encryption without requiring valid curve points.
 */
function getLocalEncryptionKey(): Uint8Array | null {
  if (localEncryptionKey) {
    return localEncryptionKey;
  }

  const privateKey = secureKeyManager.getCurrentPrivateKey();
  if (!privateKey) {
    return null;
  }

  // Derive a separate key for local database encryption using HMAC-SHA256
  // key = HMAC-SHA256(privateKey, context)
  // This produces a deterministic 32-byte key without needing valid EC points
  const contextBytes = new TextEncoder().encode(LOCAL_KEY_CONTEXT);
  localEncryptionKey = hmac(sha256, privateKey, contextBytes);

  return localEncryptionKey;
}

/**
 * Initialize encryption subsystem (called during app startup)
 * With HMAC-SHA256 key derivation, no pre-computation is needed.
 * This function is kept for backward compatibility with existing call sites.
 */
export async function initializeHashCache(): Promise<void> {
  // No-op: HMAC-SHA256 key derivation is synchronous and doesn't need pre-computation
}

/**
 * Clear the cached local encryption key (call on lock)
 */
export function clearLocalEncryptionKey(): void {
  if (localEncryptionKey) {
    // Zero-fill before clearing (security best practice)
    localEncryptionKey.fill(0);
    localEncryptionKey = null;
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith(LOCAL_ENCRYPTION_VERSION) || value.startsWith(LEGACY_NIP44_MARKER);
}

/**
 * Check if encryption is ready (app is unlocked)
 */
export function isEncryptionReady(): boolean {
  return secureKeyManager.isUnlocked && getLocalEncryptionKey() !== null;
}

/**
 * Encrypt a string for local storage
 */
export function encryptLocal(plaintext: string): string {
  const key = getLocalEncryptionKey();
  if (!key) {
    throw new Error('App is locked - cannot encrypt');
  }

  const encrypted = encryptNIP44(plaintext, key);
  return `${LOCAL_ENCRYPTION_VERSION}${encrypted}`;
}

/**
 * Decrypt a string from local storage
 * Handles both new and legacy formats
 */
export function decryptLocal(encrypted: string): string {
  const key = getLocalEncryptionKey();

  // Handle new local format
  if (encrypted.startsWith(LOCAL_ENCRYPTION_VERSION)) {
    if (!key) {
      // Locked - return encrypted
      return encrypted;
    }
    const ciphertext = encrypted.slice(LOCAL_ENCRYPTION_VERSION.length);
    try {
      return decryptNIP44(ciphertext, key);
    } catch (error) {
      logger.warn('Local decryption failed:', error);
      return '[Decryption failed]';
    }
  }

  // Handle legacy format (direct private key encryption)
  if (encrypted.startsWith(LEGACY_NIP44_MARKER)) {
    const privateKey = secureKeyManager.getCurrentPrivateKey();
    if (!privateKey) {
      return encrypted;
    }
    const ciphertext = encrypted.slice(LEGACY_NIP44_MARKER.length);
    try {
      return decryptNIP44(ciphertext, privateKey);
    } catch (error) {
      logger.warn('Legacy decryption failed:', error);
      return '[Decryption failed]';
    }
  }

  // Unencrypted data - return as-is
  return encrypted;
}

// Cache for group-specific derived keys
const groupKeyCache = new Map<string, Uint8Array>();

/**
 * Derive a group-specific local encryption key
 * Uses HMAC-SHA256 for deterministic key derivation from base key + group ID.
 *
 * SECURITY: HMAC-SHA256(baseKey, "group:" + groupId) produces a 32-byte key
 * that is cryptographically bound to both the user's private key (via baseKey)
 * and the group ID. This is a standard key derivation pattern that doesn't
 * require valid EC curve points (unlike the previous getConversationKey approach).
 */
function deriveGroupLocalKey(groupId: string): Uint8Array | null {
  const baseKey = getLocalEncryptionKey();
  if (!baseKey) return null;

  // Check key cache first
  const cacheKey = `group:${groupId}`;
  const cached = groupKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Derive a group-specific key using HMAC-SHA256
  // key = HMAC-SHA256(baseKey, "group:" + groupId)
  const contextBytes = new TextEncoder().encode(cacheKey);
  const derived = hmac(sha256, baseKey, contextBytes);

  groupKeyCache.set(cacheKey, derived);
  return derived;
}

/**
 * Pre-compute hash for a group ID (call when joining/creating groups)
 * With HMAC-SHA256 key derivation, no pre-computation is needed.
 * This function is kept for backward compatibility with existing call sites.
 */
export async function precomputeGroupHash(_groupId: string): Promise<void> {
  // No-op: HMAC-SHA256 key derivation is synchronous and doesn't need pre-computation
}

/**
 * Clear group key cache (call on lock)
 */
export function clearGroupKeyCache(): void {
  // Zero-fill all cached keys
  for (const key of groupKeyCache.values()) {
    key.fill(0);
  }
  groupKeyCache.clear();
}

/**
 * Encrypt an object's sensitive fields
 */
export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  // SECURITY: isTestMode() uses build-time check + runtime flag
  // In production, this condition is always false (dead code eliminated)
  if (isTestMode()) {
    return obj;
  }

  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    return obj;
  }

  // Check if any sensitive fields have data
  const hasSensitiveData = fieldsToEncrypt.some(
    field => obj[field] !== undefined && obj[field] !== null && obj[field] !== ''
  );

  if (!hasSensitiveData) {
    return obj;
  }

  const key = groupId ? deriveGroupLocalKey(groupId) : getLocalEncryptionKey();
  if (!key) {
    throw new Error(
      `Cannot write to ${tableName} while locked: sensitive fields require encryption.`
    );
  }

  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    const value = encrypted[field];
    if (value !== undefined && value !== null && value !== '') {
      // Skip already-encrypted values
      if (isEncrypted(value)) {
        continue;
      }

      const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
      (encrypted as Record<string, unknown>)[field] = `${LOCAL_ENCRYPTION_VERSION}${encryptNIP44(plaintext, key)}`;
    }
  }

  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 */
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  // SECURITY: isTestMode() uses build-time check + runtime flag
  // In production, this condition is always false (dead code eliminated)
  if (isTestMode()) {
    return obj;
  }

  const fieldsToDecrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToDecrypt || fieldsToDecrypt.length === 0) {
    return obj;
  }

  const key = groupId ? deriveGroupLocalKey(groupId) : getLocalEncryptionKey();
  const privateKey = secureKeyManager.getCurrentPrivateKey();

  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    const value = decrypted[field];
    if (typeof value !== 'string') continue;

    // New local format
    if (value.startsWith(LOCAL_ENCRYPTION_VERSION)) {
      if (!key) {
        continue; // Locked - keep encrypted
      }
      const ciphertext = value.slice(LOCAL_ENCRYPTION_VERSION.length);
      try {
        (decrypted as Record<string, unknown>)[field] = decryptNIP44(ciphertext, key);
      } catch (error) {
        logger.warn(`Decryption failed for ${tableName}.${field}:`, error);
        (decrypted as Record<string, unknown>)[field] = '[Decryption failed]';
      }
    }
    // Legacy format
    else if (value.startsWith(LEGACY_NIP44_MARKER)) {
      if (!privateKey) {
        continue; // Locked
      }
      const ciphertext = value.slice(LEGACY_NIP44_MARKER.length);
      try {
        (decrypted as Record<string, unknown>)[field] = decryptNIP44(ciphertext, privateKey);
      } catch (error) {
        logger.warn(`Legacy decryption failed for ${tableName}.${field}:`, error);
        (decrypted as Record<string, unknown>)[field] = '[Decryption failed]';
      }
    }
    // Unencrypted - pass through
  }

  return decrypted;
}

/**
 * Setup encryption hooks on a Dexie database
 */
export function setupLocalEncryptionHooks(db: any): void {
  const tablesToEncrypt = Object.keys(ENCRYPTED_FIELDS);

  for (const tableName of tablesToEncrypt) {
    const table = db[tableName];
    if (!table) continue;

    // Hook: Encrypt on create
    table.hook('creating', (_primKey: unknown, obj: Record<string, unknown>, _trans: unknown) => {
      const groupId = obj.groupId as string | undefined;
      return encryptObject(obj, tableName, groupId);
    });

    // Hook: Encrypt on update
    table.hook('updating', (
      modifications: Record<string, unknown>,
      _primKey: unknown,
      obj: Record<string, unknown> | null,
      _trans: unknown
    ) => {
      // SECURITY: isTestMode() uses build-time check + runtime flag
      // In production, this condition is always false (dead code eliminated)
      if (isTestMode()) {
        return modifications;
      }

      const groupId = obj?.groupId as string | undefined;
      const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];

      // Check if any sensitive fields are being modified
      const hasSensitiveModifications = fieldsToEncrypt.some(
        field => modifications[field] !== undefined
      );

      if (!hasSensitiveModifications) {
        return modifications;
      }

      const key = groupId ? deriveGroupLocalKey(groupId) : getLocalEncryptionKey();
      if (!key) {
        throw new Error(
          `Cannot update ${tableName} while locked: sensitive fields require encryption.`
        );
      }

      const encrypted: Record<string, unknown> = {};

      for (const [field, value] of Object.entries(modifications)) {
        if (fieldsToEncrypt.includes(field) && value !== undefined && value !== null) {
          // Skip already-encrypted values
          if (typeof value === 'string' && isEncrypted(value)) {
            encrypted[field] = value;
            continue;
          }

          const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
          encrypted[field] = `${LOCAL_ENCRYPTION_VERSION}${encryptNIP44(plaintext, key)}`;
        } else {
          encrypted[field] = value;
        }
      }

      return encrypted;
    });

    // Hook: Decrypt on read
    table.hook('reading', (obj: Record<string, unknown> | null) => {
      if (!obj) return obj;
      const groupId = obj.groupId as string | undefined;
      return decryptObject(obj, tableName, groupId);
    });
  }

  logger.info(`🔐 Local encryption hooks enabled for ${tablesToEncrypt.length} tables`);
}

/**
 * Migrate data from legacy format to new local encryption format
 */
export async function migrateToLocalEncryption(db: any): Promise<{ migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;

  if (!isEncryptionReady()) {
    throw new Error('Cannot migrate while locked');
  }

  for (const [tableName, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const table = db[tableName];
    if (!table) continue;

    try {
      const records = await table.toArray();
      const privateKey = secureKeyManager.getCurrentPrivateKey();
      const localKey = getLocalEncryptionKey();

      if (!privateKey || !localKey) continue;

      for (const record of records) {
        let needsUpdate = false;
        const updates: Record<string, string> = {};

        for (const field of fields) {
          const value = record[field];
          if (typeof value === 'string' && value.startsWith(LEGACY_NIP44_MARKER)) {
            try {
              // Decrypt with legacy key (private key)
              const ciphertext = value.slice(LEGACY_NIP44_MARKER.length);
              const plaintext = decryptNIP44(ciphertext, privateKey);

              // Re-encrypt with local key
              const groupId = record.groupId as string | undefined;
              const key = groupId ? deriveGroupLocalKey(groupId) : localKey;
              if (key) {
                updates[field] = `${LOCAL_ENCRYPTION_VERSION}${encryptNIP44(plaintext, key)}`;
                needsUpdate = true;
              }
            } catch (err) {
              logger.warn(`Migration failed for ${tableName}.${field}:`, err);
              failed++;
            }
          }
        }

        if (needsUpdate) {
          const primaryKey = record.id ?? record.publicKey;
          if (primaryKey) {
            await table.update(primaryKey, updates);
            migrated++;
          }
        }
      }
    } catch (err) {
      logger.error(`Migration failed for table ${tableName}:`, err);
    }
  }

  logger.info(`🔄 Migration complete: ${migrated} records migrated, ${failed} failed`);
  return { migrated, failed };
}

// Register lock event listener to clear cached keys
secureKeyManager.addEventListener((event) => {
  if (event.type === 'locked') {
    clearLocalEncryptionKey();
    clearGroupKeyCache();
  }
});
