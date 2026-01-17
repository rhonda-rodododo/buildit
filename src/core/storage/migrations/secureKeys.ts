/**
 * Secure Keys Migration
 *
 * Migrates existing identities from old format (hex-encoded "encrypted" keys)
 * to the new secure format (properly encrypted with PBKDF2+AES-GCM).
 *
 * This migration is needed because the original implementation stored private keys
 * as hex-encoded strings in a field called "encryptedPrivateKey" - but they weren't
 * actually encrypted, just encoded. This was a critical security vulnerability.
 */

import { db, type DBIdentity } from '@/core/storage/db';
import { hexToBytes } from '@noble/hashes/utils';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';

/**
 * Check if an identity needs migration
 * Old format: no salt field, encryptedPrivateKey is hex (64 chars)
 */
export function identityNeedsMigration(identity: DBIdentity): boolean {
  // New format has salt field
  if (identity.salt) {
    return false;
  }

  // Old format: encryptedPrivateKey is a 64-char hex string (32 bytes)
  // New format: encryptedPrivateKey is base64 and longer
  if (identity.encryptedPrivateKey && /^[0-9a-f]{64}$/i.test(identity.encryptedPrivateKey)) {
    return true;
  }

  return false;
}

/**
 * Get all identities that need migration
 */
export async function getIdentitiesNeedingMigration(): Promise<DBIdentity[]> {
  const allIdentities = await db.identities.toArray();
  return allIdentities.filter(identityNeedsMigration);
}

/**
 * Check if any identities need migration
 */
export async function hasPendingMigrations(): Promise<boolean> {
  const identities = await getIdentitiesNeedingMigration();
  return identities.length > 0;
}

/**
 * Migrate a single identity to the new secure format
 *
 * @param publicKey - The identity's public key
 * @param password - The password to encrypt with (chosen by user during migration)
 */
export async function migrateIdentity(publicKey: string, password: string): Promise<void> {
  // Get the identity from database
  const identity = await db.identities.get(publicKey);
  if (!identity) {
    throw new Error('Identity not found');
  }

  // Verify it needs migration
  if (!identityNeedsMigration(identity)) {
    throw new Error('Identity does not need migration');
  }

  // Extract the private key from the old format
  // Old format: hex-encoded 32-byte private key
  let privateKey: Uint8Array;
  try {
    privateKey = hexToBytes(identity.encryptedPrivateKey);
  } catch (error) {
    throw new Error('Failed to decode private key from old format');
  }

  // Verify the key is valid (should be 32 bytes)
  if (privateKey.length !== 32) {
    throw new Error('Invalid private key length');
  }

  // Create new encrypted key data with proper encryption
  const encryptedData = await secureKeyManager.createEncryptedKeyData(
    publicKey,
    privateKey,
    password
  );

  // Update the identity in the database
  await db.identities.update(publicKey, {
    encryptedPrivateKey: encryptedData.encryptedPrivateKey,
    salt: encryptedData.salt,
    iv: encryptedData.iv,
    webAuthnProtected: false,
    keyVersion: 1,
  });

  // Zero-fill the private key in memory
  privateKey.fill(0);

  console.log(`✅ Migrated identity ${publicKey.slice(0, 8)}... to secure storage`);
}

/**
 * Migrate all identities that need migration
 * Returns the public keys that were migrated
 *
 * Note: This requires the same password for all identities.
 * For production, you'd want to handle each identity separately
 * or allow different passwords per identity.
 */
export async function migrateAllIdentities(password: string): Promise<string[]> {
  const identities = await getIdentitiesNeedingMigration();
  const migrated: string[] = [];

  for (const identity of identities) {
    try {
      await migrateIdentity(identity.publicKey, password);
      migrated.push(identity.publicKey);
    } catch (error) {
      console.error(`Failed to migrate identity ${identity.publicKey}:`, error);
      throw error;
    }
  }

  return migrated;
}

/**
 * Migration status for UI display
 */
export interface MigrationStatus {
  needsMigration: boolean;
  identityCount: number;
  identities: Array<{
    publicKey: string;
    name: string;
    npub?: string;
  }>;
}

/**
 * Get migration status for all identities
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const identities = await getIdentitiesNeedingMigration();

  return {
    needsMigration: identities.length > 0,
    identityCount: identities.length,
    identities: identities.map((id) => ({
      publicKey: id.publicKey,
      name: id.name,
      npub: id.npub,
    })),
  };
}

/**
 * Verify the migration was successful by attempting to unlock
 */
export async function verifyMigration(publicKey: string, password: string): Promise<boolean> {
  const identity = await db.identities.get(publicKey);
  if (!identity) {
    return false;
  }

  // Should no longer need migration
  if (identityNeedsMigration(identity)) {
    return false;
  }

  // Try to verify the password
  try {
    const encryptedData = {
      publicKey: identity.publicKey,
      encryptedPrivateKey: identity.encryptedPrivateKey,
      salt: identity.salt,
      iv: identity.iv,
      webAuthnProtected: identity.webAuthnProtected,
      credentialId: identity.credentialId,
      createdAt: identity.created,
      keyVersion: identity.keyVersion,
    };

    return await secureKeyManager.verifyPassword(encryptedData, password);
  } catch {
    return false;
  }
}
