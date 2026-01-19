/**
 * Backup Service
 * Handles creating and restoring encrypted identity backups
 *
 * Security:
 * - Backups are encrypted with AES-256-GCM
 * - Keys derived from recovery phrase using PBKDF2 (600K iterations)
 * - Includes checksum for integrity verification
 * - Non-extractable keys in memory
 */

import { getDB, type DBIdentity } from '@/core/storage/db';
import { recoveryPhraseService } from './RecoveryPhraseService';
import { logger } from '@/lib/logger';
import type {
  EncryptedBackup,
  BackupContents,
  BackupMetadata,
  BackupGroup,
} from './types';

// App version for backup compatibility
const APP_VERSION = '1.0.0';
const BACKUP_VERSION = 2;

/**
 * Backup Service
 * Creates and restores encrypted identity backups
 */
export class BackupService {
  private static instance: BackupService;

  private constructor() {}

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Create an encrypted backup file
   *
   * @param identityPubkey - The identity to backup
   * @param privateKey - Decrypted private key (must be unlocked)
   * @param recoveryPhrase - 24-word recovery phrase for encryption
   * @param options - Additional backup options
   */
  public async createBackup(
    identityPubkey: string,
    privateKey: Uint8Array,
    recoveryPhrase: string,
    options: {
      includeContacts?: boolean;
      includeGroups?: boolean;
      deviceName?: string;
    } = {}
  ): Promise<EncryptedBackup> {
    const db = getDB();

    // Get identity from database
    const identity = await db.identities.get(identityPubkey);
    if (!identity) {
      throw new Error('Identity not found');
    }

    // Build backup contents
    const contents: BackupContents = {
      identity: {
        publicKey: identity.publicKey,
        privateKey: this.uint8ToHex(privateKey),
        name: identity.name,
        displayName: identity.displayName,
        nip05: identity.nip05,
        created: identity.created,
      },
    };

    // Optionally include security settings
    if (identity.securitySettings) {
      try {
        const settings = JSON.parse(identity.securitySettings);
        contents.securitySettings = {
          authMethod: settings.authMethod,
          inactivityTimeout: settings.inactivityTimeout,
          lockOnHide: settings.lockOnHide,
          lockOnClose: settings.lockOnClose,
        };
      } catch {
        // Ignore parsing errors
      }
    }

    // Optionally include contacts
    if (options.includeContacts) {
      const friends = await db.friends.where('userPubkey').equals(identityPubkey).toArray();
      contents.contacts = friends.map(f => ({
        pubkey: f.friendPubkey,
        name: f.displayName || f.username,
      }));
    }

    // Optionally include groups
    if (options.includeGroups) {
      const members = await db.groupMembers.where('pubkey').equals(identityPubkey).toArray();
      const groups = await Promise.all(
        members.map(async (m): Promise<BackupGroup | null> => {
          const group = await db.groups.get(m.groupId);
          if (!group) return null;
          return {
            id: group.id,
            name: group.name,
            description: group.description || undefined,
            role: m.role,
          };
        })
      );
      contents.groups = groups.filter((g): g is BackupGroup => g !== null);
    }

    // Serialize contents
    const plaintext = JSON.stringify(contents);
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Calculate checksum
    const checksumBuffer = await crypto.subtle.digest('SHA-256', plaintextBytes);
    const checksum = this.bufferToHex(new Uint8Array(checksumBuffer));

    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from recovery phrase
    const encryptionKey = await recoveryPhraseService.deriveEncryptionKey(recoveryPhrase, salt);

    // Encrypt the backup contents
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      encryptionKey,
      plaintextBytes as BufferSource
    );

    // Get npub prefix for identification
    const npubPrefix = identity.npub?.slice(0, 12) || identity.publicKey.slice(0, 12);

    // Build metadata
    const metadata: BackupMetadata = {
      appVersion: APP_VERSION,
      backupVersion: BACKUP_VERSION,
      createdAt: Date.now(),
      deviceName: options.deviceName,
      npubPrefix,
    };

    // Build final backup object
    const backup: EncryptedBackup = {
      version: 2,
      type: 'buildit-backup',
      createdAt: Date.now(),
      identityHint: npubPrefix.slice(0, 8),
      encryptedData: this.bufferToBase64(new Uint8Array(encryptedBuffer)),
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      checksum,
      metadata,
    };

    logger.info('Backup created successfully', { identityHint: backup.identityHint });

    return backup;
  }

  /**
   * Restore an identity from an encrypted backup
   *
   * @param backup - The encrypted backup file
   * @param recoveryPhrase - The 24-word recovery phrase
   * @param newPassword - Password to encrypt the restored identity
   */
  public async restoreBackup(
    backup: EncryptedBackup,
    recoveryPhrase: string,
    newPassword: string
  ): Promise<{
    identity: DBIdentity;
    contents: BackupContents;
  }> {
    // Validate backup format
    if (backup.version !== 2 || backup.type !== 'buildit-backup') {
      throw new Error('Invalid backup format');
    }

    // Derive decryption key
    const salt = this.base64ToBuffer(backup.salt);
    const iv = this.base64ToBuffer(backup.iv);
    const encryptedData = this.base64ToBuffer(backup.encryptedData);

    const decryptionKey = await recoveryPhraseService.deriveEncryptionKey(recoveryPhrase, salt);

    // Decrypt the backup
    let plaintextBuffer: ArrayBuffer;
    try {
      plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        decryptionKey,
        encryptedData as BufferSource
      );
    } catch {
      throw new Error('Invalid recovery phrase or corrupted backup');
    }

    // Verify checksum
    const checksumBuffer = await crypto.subtle.digest('SHA-256', plaintextBuffer);
    const calculatedChecksum = this.bufferToHex(new Uint8Array(checksumBuffer));

    if (calculatedChecksum !== backup.checksum) {
      throw new Error('Backup integrity check failed');
    }

    // Parse contents
    const plaintext = new TextDecoder().decode(plaintextBuffer);
    const contents: BackupContents = JSON.parse(plaintext);

    // Convert private key from hex
    const privateKey = this.hexToUint8(contents.identity.privateKey);

    // Generate new encryption data for storage
    const newSalt = crypto.getRandomValues(new Uint8Array(32));
    const newIv = crypto.getRandomValues(new Uint8Array(12));

    // Derive new master key from password
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(newPassword);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: newSalt.buffer as ArrayBuffer,
        iterations: 600_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Encrypt private key with new password
    const encryptedPrivateKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: newIv as BufferSource },
      masterKey,
      privateKey as BufferSource
    );

    // Build identity record
    const identity: DBIdentity = {
      publicKey: contents.identity.publicKey,
      encryptedPrivateKey: this.bufferToBase64(new Uint8Array(encryptedPrivateKey)),
      salt: this.bufferToBase64(newSalt),
      iv: this.bufferToBase64(newIv),
      webAuthnProtected: false,
      keyVersion: 1,
      name: contents.identity.name,
      displayName: contents.identity.displayName,
      nip05: contents.identity.nip05,
      created: contents.identity.created,
      lastUsed: Date.now(),
    };

    // Store security settings if present
    if (contents.securitySettings) {
      identity.securitySettings = JSON.stringify(contents.securitySettings);
    }

    logger.info('Backup restored successfully', { publicKey: identity.publicKey.slice(0, 8) });

    return { identity, contents };
  }

  /**
   * Validate a backup file without decrypting
   */
  public validateBackupFormat(backup: unknown): backup is EncryptedBackup {
    if (!backup || typeof backup !== 'object') {
      return false;
    }

    const b = backup as Record<string, unknown>;

    return (
      b.version === 2 &&
      b.type === 'buildit-backup' &&
      typeof b.createdAt === 'number' &&
      typeof b.identityHint === 'string' &&
      typeof b.encryptedData === 'string' &&
      typeof b.salt === 'string' &&
      typeof b.iv === 'string' &&
      typeof b.checksum === 'string' &&
      typeof b.metadata === 'object' &&
      b.metadata !== null
    );
  }

  /**
   * Export backup as downloadable file
   */
  public exportBackupFile(backup: EncryptedBackup): Blob {
    const json = JSON.stringify(backup, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Generate a filename for the backup
   */
  public generateBackupFilename(backup: EncryptedBackup): string {
    const date = new Date(backup.createdAt);
    const dateStr = date.toISOString().split('T')[0];
    return `buildit-backup-${backup.identityHint}-${dateStr}.json`;
  }

  /**
   * Parse a backup file from JSON
   */
  public parseBackupFile(json: string): EncryptedBackup {
    const parsed = JSON.parse(json);
    if (!this.validateBackupFormat(parsed)) {
      throw new Error('Invalid backup file format');
    }
    return parsed;
  }

  /**
   * Create a recovery phrase for an existing identity
   * Returns the recovery phrase that can be used to restore
   */
  public async createRecoveryPhrase(privateKey: Uint8Array): Promise<string> {
    return recoveryPhraseService.privateKeyToRecoveryPhrase(privateKey);
  }

  // Utility methods

  private bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  private bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToUint8(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  private uint8ToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export singleton instance
export const backupService = BackupService.getInstance();
