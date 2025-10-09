/**
 * Database Encryption Layer
 * Encrypts sensitive data at rest using NIP-44
 */

import { encryptNIP44, decryptNIP44, deriveConversationKey } from '@/core/crypto/nip44';
import { useAuthStore } from '@/stores/authStore';

/**
 * Fields that should be encrypted in each table
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  // Messages
  messages: ['content'],

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
};

/**
 * Check if user is logged in and has decryption key
 */
function isLoggedIn(): boolean {
  const { currentIdentity } = useAuthStore.getState();
  return !!(currentIdentity?.privateKey);
}

/**
 * Get current user's private key
 */
function getPrivateKey(): Uint8Array | null {
  const { currentIdentity } = useAuthStore.getState();
  return currentIdentity?.privateKey || null;
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
 * Encrypt an object's sensitive fields
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    // No encryption key available - store as-is (will be encrypted on next login)
    return obj;
  }

  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    // No sensitive fields in this table
    return obj;
  }

  const encrypted = { ...obj };
  const encryptionKey = groupId
    ? deriveGroupKey(privateKey, groupId)
    : privateKey;

  for (const field of fieldsToEncrypt) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      const plaintext = typeof encrypted[field] === 'string'
        ? (encrypted[field] as string)
        : JSON.stringify(encrypted[field]);

      try {
        (encrypted as Record<string, any>)[field] = encryptNIP44(plaintext, encryptionKey);
      } catch (error) {
        console.error(`Failed to encrypt field ${field}:`, error);
        // Leave unencrypted on error
      }
    }
  }

  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    // No decryption key - return encrypted object as-is
    return obj;
  }

  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];
  if (!fieldsToEncrypt || fieldsToEncrypt.length === 0) {
    // No encrypted fields in this table
    return obj;
  }

  const decrypted = { ...obj };
  const encryptionKey = groupId
    ? deriveGroupKey(privateKey, groupId)
    : privateKey;

  for (const field of fieldsToEncrypt) {
    if (decrypted[field]) {
      try {
        const ciphertext = decrypted[field] as string;
        (decrypted as Record<string, any>)[field] = decryptNIP44(ciphertext, encryptionKey);
      } catch (error) {
        // Decryption failed - might be corrupted or wrong key
        console.warn(`Failed to decrypt field ${field}:`, error);
        // Leave encrypted on error
      }
    }
  }

  return decrypted;
}

/**
 * Setup encryption hooks on a Dexie database
 */
export function setupEncryptionHooks(db: any): void {
  // Get all tables that have encrypted fields
  const tablesToEncrypt = Object.keys(ENCRYPTED_FIELDS);

  for (const tableName of tablesToEncrypt) {
    const table = db[tableName];
    if (!table) continue; // Table doesn't exist yet (module not loaded)

    // Hook: Encrypt on create
    table.hook('creating', (_primKey: any, obj: any, _transaction: any) => {
      const groupId = obj.groupId; // Most tables have groupId
      return encryptObject(obj, tableName, groupId);
    });

    // Hook: Encrypt on update
    table.hook('updating', (modifications: any, _primKey: any, obj: any, _transaction: any) => {
      const groupId = obj?.groupId;

      // Encrypt modified fields
      const encrypted: Record<string, any> = {};
      const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName];

      for (const [key, value] of Object.entries(modifications)) {
        if (fieldsToEncrypt.includes(key) && value !== undefined) {
          const privateKey = getPrivateKey();
          if (privateKey) {
            const encryptionKey = groupId
              ? deriveGroupKey(privateKey, groupId)
              : privateKey;

            const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
            try {
              encrypted[key] = encryptNIP44(plaintext, encryptionKey);
            } catch (error) {
              console.error(`Failed to encrypt field ${key}:`, error);
              encrypted[key] = value;
            }
          } else {
            encrypted[key] = value;
          }
        } else {
          encrypted[key] = value;
        }
      }

      return encrypted;
    });

    // Hook: Decrypt on read
    table.hook('reading', (obj: any) => {
      if (!isLoggedIn()) {
        // Not logged in - return encrypted data
        return obj;
      }

      const groupId = obj.groupId;
      return decryptObject(obj, tableName, groupId);
    });
  }

  console.log(`🔐 Encryption hooks enabled for ${tablesToEncrypt.length} tables`);
}
