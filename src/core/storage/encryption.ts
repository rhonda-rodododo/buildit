/**
 * Database Encryption Layer
 * Encrypts sensitive data at rest using NIP-44
 *
 * SECURITY INVARIANT: Sensitive data is NEVER stored unencrypted.
 * - When locked: Operations that would write sensitive data throw errors
 * - When unlocked: All sensitive fields are encrypted before storage
 * - On read while locked: Return encrypted ciphertext (UI should handle gracefully)
 */

import { encryptNIP44, decryptNIP44, deriveConversationKey } from '@/core/crypto/nip44';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';

// Marker prefix for encrypted data (helps identify unencrypted legacy data)
const ENCRYPTED_MARKER = 'enc:1:';

/**
 * Fields that should be encrypted in each table
 */
/**
 * Fields that should be encrypted in each table
 *
 * IMPORTANT: When adding new encrypted fields:
 * 1. Add them here
 * 2. Consider migration for existing data
 * 3. Update any UI that displays these fields to handle locked state
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  // Messages
  messages: ['content'],

  // Conversation messages (DMs and group threads)
  conversationMessages: ['content'],

  // Conversation metadata (protects social graph)
  conversations: ['name', 'lastMessagePreview'],
  // Note: 'participants' is not encrypted as it's needed for indexing
  // Social graph protection handled via access control + E2E at relay level

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
  friends: ['displayName', 'notes'],

  // Documents
  documents: ['title', 'content'],

  // Files metadata (content encrypted separately with NIP-44)
  files: ['name', 'description'],
};

/**
 * Get current user's private key
 * Returns null if app is locked
 */
function getPrivateKey(): Uint8Array | null {
  if (!secureKeyManager.isUnlocked) {
    return null;
  }
  return secureKeyManager.getCurrentPrivateKey();
}

/**
 * Derive a group encryption key from user's private key and group ID
 * This creates a deterministic key for group-level encryption
 */
function deriveGroupKey(privateKey: Uint8Array, groupId: string): Uint8Array {
  // Use group ID as a pseudo-pubkey for key derivation
  // This is a simplified approach - in production you'd want proper group key management
  return deriveConversationKey(privateKey, groupId);
}

/**
 * Check if a field value is encrypted (has our marker prefix)
 */
function isEncrypted(value: any): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_MARKER);
}

/**
 * Encrypt an object's sensitive fields
 *
 * SECURITY: This function will throw if called when the app is locked,
 * rather than silently storing unencrypted data.
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    // No sensitive fields in this table - pass through
    return obj;
  }

  // Check if any sensitive fields have data that needs encryption
  const hasSensitiveData = fieldsToEncrypt.some(
    field => obj[field] !== undefined && obj[field] !== null && obj[field] !== ''
  );

  if (!hasSensitiveData) {
    // No sensitive data to encrypt
    return obj;
  }

  const privateKey = getPrivateKey();
  if (!privateKey) {
    // SECURITY: Never store sensitive data unencrypted
    throw new Error(
      `Cannot write to ${tableName} while locked: sensitive fields require encryption. ` +
      `Please unlock the app first.`
    );
  }

  const encrypted = { ...obj };
  const encryptionKey = groupId
    ? deriveGroupKey(privateKey, groupId)
    : privateKey;

  for (const field of fieldsToEncrypt) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      // Skip already-encrypted values
      if (isEncrypted(encrypted[field])) {
        continue;
      }

      const plaintext = typeof encrypted[field] === 'string'
        ? (encrypted[field] as string)
        : JSON.stringify(encrypted[field]);

      try {
        // Add marker prefix so we can identify encrypted data
        (encrypted as Record<string, any>)[field] =
          ENCRYPTED_MARKER + encryptNIP44(plaintext, encryptionKey);
      } catch (error) {
        console.error(`Failed to encrypt field ${field}:`, error);
        throw new Error(`Encryption failed for field ${field}: ${error}`);
      }
    }
  }

  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 *
 * Returns encrypted ciphertext if locked (UI should handle gracefully)
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    // No encrypted fields in this table
    return obj;
  }

  const privateKey = getPrivateKey();
  if (!privateKey) {
    // Locked - return data as-is (encrypted fields stay encrypted)
    // UI layer should show placeholder or "unlock to view" message
    return obj;
  }

  const decrypted = { ...obj };
  const encryptionKey = groupId
    ? deriveGroupKey(privateKey, groupId)
    : privateKey;

  for (const field of fieldsToEncrypt) {
    const value = decrypted[field];
    if (value && typeof value === 'string') {
      // Check for our encryption marker
      if (value.startsWith(ENCRYPTED_MARKER)) {
        try {
          const ciphertext = value.slice(ENCRYPTED_MARKER.length);
          (decrypted as Record<string, any>)[field] = decryptNIP44(ciphertext, encryptionKey);
        } catch (error) {
          // Decryption failed - might be corrupted or wrong key
          console.warn(`Failed to decrypt field ${field}:`, error);
          // Mark as decryption failed so UI can handle
          (decrypted as Record<string, any>)[field] = '[Decryption failed]';
        }
      }
      // If no marker, it might be legacy unencrypted data - pass through
    }
  }

  return decrypted;
}

/**
 * Setup encryption hooks on a Dexie database
 *
 * SECURITY INVARIANTS:
 * 1. create/update hooks throw if attempting to write sensitive data while locked
 * 2. read hooks return encrypted data if locked (UI handles gracefully)
 */
export function setupEncryptionHooks(db: any): void {
  // Get all tables that have encrypted fields
  const tablesToEncrypt = Object.keys(ENCRYPTED_FIELDS);

  for (const tableName of tablesToEncrypt) {
    const table = db[tableName];
    if (!table) continue; // Table doesn't exist yet (module not loaded)

    // Hook: Encrypt on create
    // SECURITY: Will throw if called while locked with sensitive data
    table.hook('creating', (_primKey: any, obj: any, _transaction: any) => {
      const groupId = obj.groupId; // Most tables have groupId
      return encryptObject(obj, tableName, groupId);
    });

    // Hook: Encrypt on update
    // SECURITY: Will throw if called while locked with sensitive data
    table.hook('updating', (modifications: any, _primKey: any, obj: any, _transaction: any) => {
      const groupId = obj?.groupId;
      const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];

      // Check if any sensitive fields are being modified
      const hasSensitiveModifications = fieldsToEncrypt.some(
        field => modifications[field] !== undefined
      );

      if (!hasSensitiveModifications) {
        // No sensitive fields being modified - pass through
        return modifications;
      }

      const privateKey = getPrivateKey();
      if (!privateKey) {
        // SECURITY: Never store sensitive data unencrypted
        throw new Error(
          `Cannot update ${tableName} while locked: sensitive fields require encryption. ` +
          `Please unlock the app first.`
        );
      }

      // Encrypt modified sensitive fields
      const encrypted: Record<string, any> = {};
      const encryptionKey = groupId
        ? deriveGroupKey(privateKey, groupId)
        : privateKey;

      for (const [key, value] of Object.entries(modifications)) {
        if (fieldsToEncrypt.includes(key) && value !== undefined && value !== null) {
          // Skip already-encrypted values
          if (typeof value === 'string' && value.startsWith(ENCRYPTED_MARKER)) {
            encrypted[key] = value;
            continue;
          }

          const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
          try {
            encrypted[key] = ENCRYPTED_MARKER + encryptNIP44(plaintext, encryptionKey);
          } catch (error) {
            console.error(`Failed to encrypt field ${key}:`, error);
            throw new Error(`Encryption failed for field ${key}: ${error}`);
          }
        } else {
          encrypted[key] = value;
        }
      }

      return encrypted;
    });

    // Hook: Decrypt on read
    // Safe to call while locked - returns encrypted data for UI to handle
    table.hook('reading', (obj: any) => {
      const groupId = obj?.groupId;
      return decryptObject(obj, tableName, groupId);
    });
  }

  console.log(`🔐 Encryption hooks enabled for ${tablesToEncrypt.length} tables`);
}
