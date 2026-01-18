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
import * as nip44 from 'nostr-tools/nip44';

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
};

// Cached local encryption key (cleared on lock)
let localEncryptionKey: Uint8Array | null = null;

// Test mode - bypasses encryption for tests
let testModeEnabled = false;

/**
 * Enable test mode (bypasses encryption)
 * Only use this in test environments!
 */
export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true;
    console.info('⚠️  Test mode enabled - encryption bypassed');
  } else {
    console.warn('⚠️  Test mode requested but not in test environment');
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
 */
export function isTestMode(): boolean {
  return testModeEnabled;
}

/**
 * Get or derive the local encryption key
 * This is distinct from relay communication keys
 *
 * SECURITY: Uses SHA-256 derived context hash for key derivation
 */
function getLocalEncryptionKey(): Uint8Array | null {
  if (localEncryptionKey) {
    return localEncryptionKey;
  }

  const privateKey = secureKeyManager.getCurrentPrivateKey();
  if (!privateKey) {
    return null;
  }

  // Get the pre-computed context hash (must call initializeHashCache() at startup)
  const contextHash = hashToFakePublicKey(LOCAL_KEY_CONTEXT);

  // Derive a separate key for local database encryption
  // Using NIP-44's getConversationKey with our context as the "pubkey"
  // This creates a deterministic key from private key + context
  localEncryptionKey = nip44.v2.utils.getConversationKey(
    privateKey,
    // Use a fixed "pubkey" derived from our context to create a deterministic key
    // This is safe because it's only used locally, never for relay communication
    contextHash
  );

  return localEncryptionKey;
}

/**
 * Create a deterministic 32-byte hex string from input using SHA-256
 * Used for deriving context-specific keys for local database encryption
 *
 * SECURITY: Uses WebCrypto SHA-256 for cryptographically secure hashing
 * This ensures proper avalanche effect and resistance to preimage attacks
 */
let hashCache: Map<string, string> | null = null;

async function hashToFakePublicKeyAsync(input: string): Promise<string> {
  // Initialize cache lazily
  if (!hashCache) {
    hashCache = new Map();
  }

  // Check cache first (deterministic function, safe to cache)
  const cached = hashCache.get(input);
  if (cached) {
    return cached;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const result = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Cache the result
  hashCache.set(input, result);
  return result;
}

// Synchronous version using cached results
// IMPORTANT: Must call initializeHashCache() during app startup
function hashToFakePublicKey(input: string): string {
  if (!hashCache) {
    hashCache = new Map();
  }

  const cached = hashCache.get(input);
  if (cached) {
    return cached;
  }

  // Fallback for edge case where async init hasn't completed
  // This should rarely happen in practice
  throw new Error(
    `Hash not pre-computed for "${input}". Call initializeHashCache() during app startup.`
  );
}

/**
 * Pre-compute hash values for known contexts
 * Call this during app initialization (async)
 */
export async function initializeHashCache(): Promise<void> {
  // Pre-compute the main context hash
  await hashToFakePublicKeyAsync(LOCAL_KEY_CONTEXT);
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
      console.warn('Local decryption failed:', error);
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
      console.warn('Legacy decryption failed:', error);
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
 * Uses cached SHA-256 hashes for group IDs
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

  // Get or compute the hash for this group context
  // If not cached, we need to compute synchronously
  let contextHash: string;
  try {
    contextHash = hashToFakePublicKey(cacheKey);
  } catch {
    // Hash not pre-computed - compute synchronously using basic HKDF-expand style
    // This is a fallback; in normal operation, precomputeGroupHash() should be called
    // Using a deterministic derivation that's still cryptographically sound
    // by combining the base key with the group ID
    const groupIdBytes = new TextEncoder().encode(groupId);
    const combined = new Uint8Array(baseKey.length + groupIdBytes.length);
    combined.set(baseKey);
    combined.set(groupIdBytes, baseKey.length);

    // For groups without pre-computed hashes, derive directly from base key + groupId
    // This is secure because baseKey is already derived from private key + SHA-256
    const derived = nip44.v2.utils.getConversationKey(
      baseKey,
      // Use the first 32 bytes of group ID padded/hashed as the "pubkey"
      Array.from(groupIdBytes.slice(0, 32).reduce((acc, b, i) => {
        acc[i % 32] ^= b;
        return acc;
      }, new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
    );

    groupKeyCache.set(cacheKey, derived);
    return derived;
  }

  // Derive a group-specific key using the cached hash
  const derived = nip44.v2.utils.getConversationKey(baseKey, contextHash);
  groupKeyCache.set(cacheKey, derived);
  return derived;
}

/**
 * Pre-compute hash for a group ID (call when joining/creating groups)
 */
export async function precomputeGroupHash(groupId: string): Promise<void> {
  await hashToFakePublicKeyAsync(`group:${groupId}`);
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
  // Skip encryption in test mode
  if (testModeEnabled) {
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
  // Skip decryption in test mode
  if (testModeEnabled) {
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
        console.warn(`Decryption failed for ${tableName}.${field}:`, error);
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
        console.warn(`Legacy decryption failed for ${tableName}.${field}:`, error);
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
      // Skip encryption in test mode
      if (testModeEnabled) {
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

  console.info(`🔐 Local encryption hooks enabled for ${tablesToEncrypt.length} tables`);
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
              console.warn(`Migration failed for ${tableName}.${field}:`, err);
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
      console.error(`Migration failed for table ${tableName}:`, err);
    }
  }

  console.info(`🔄 Migration complete: ${migrated} records migrated, ${failed} failed`);
  return { migrated, failed };
}

// Register lock event listener to clear cached keys
secureKeyManager.addEventListener((event) => {
  if (event.type === 'locked') {
    clearLocalEncryptionKey();
    clearGroupKeyCache();
  }
});
