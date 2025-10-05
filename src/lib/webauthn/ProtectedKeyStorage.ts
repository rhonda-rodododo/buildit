/**
 * Protected Key Storage
 * Securely stores Nostr keys with WebAuthn protection
 */

import type { ProtectedKeyStorage, KeyBackup, WebAuthnCredential } from '@/types/device';
import { webAuthnService } from './WebAuthnService';

/**
 * Protected Key Storage Service
 * Encrypts and stores private keys with optional WebAuthn protection
 */
export class ProtectedKeyStorageService {
  private static instance: ProtectedKeyStorageService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ProtectedKeyStorageService {
    if (!ProtectedKeyStorageService.instance) {
      ProtectedKeyStorageService.instance = new ProtectedKeyStorageService();
    }
    return ProtectedKeyStorageService.instance;
  }

  /**
   * Store a private key with WebAuthn protection
   * The key is encrypted with a derived key from WebAuthn credential
   */
  public async storeProtectedKey(
    privateKey: string,
    deviceId: string,
    credential?: WebAuthnCredential,
    password?: string
  ): Promise<ProtectedKeyStorage> {
    // Generate encryption key
    const encryptionKey = await this.deriveEncryptionKey(password || '');

    // Encrypt the private key
    const { encryptedData, salt, iv } = await this.encryptKey(privateKey, encryptionKey);

    const storage: ProtectedKeyStorage = {
      id: crypto.randomUUID(),
      encryptedKey: encryptedData,
      salt,
      iv,
      webAuthnProtected: !!credential,
      credentialId: credential?.id,
      deviceId,
      createdAt: Date.now(),
      accessCount: 0,
    };

    return storage;
  }

  /**
   * Retrieve and decrypt a protected key
   * Requires WebAuthn authentication if protected
   */
  public async retrieveProtectedKey(
    storage: ProtectedKeyStorage,
    credential?: WebAuthnCredential,
    password?: string
  ): Promise<string> {
    // If WebAuthn protected, verify credential first
    if (storage.webAuthnProtected && credential) {
      const isValid = await webAuthnService.verifyCredential(credential);
      if (!isValid) {
        throw new Error('WebAuthn verification failed');
      }
    }

    // Derive decryption key
    const decryptionKey = await this.deriveEncryptionKey(password || '');

    // Decrypt the private key
    const privateKey = await this.decryptKey(
      storage.encryptedKey,
      decryptionKey,
      storage.salt,
      storage.iv
    );

    // Update access count
    storage.accessCount++;
    storage.lastAccessed = Date.now();

    return privateKey;
  }

  /**
   * Create an encrypted backup of keys
   */
  public async createBackup(
    privateKeys: string[],
    deviceId: string,
    credential?: WebAuthnCredential,
    password?: string
  ): Promise<KeyBackup> {
    const backupData = JSON.stringify({
      keys: privateKeys,
      timestamp: Date.now(),
      deviceId,
    });

    // Generate encryption key for backup
    const encryptionKey = await this.deriveEncryptionKey(password || crypto.randomUUID());

    // Encrypt backup
    const { encryptedData, salt, iv } = await this.encryptKey(backupData, encryptionKey);

    // Create checksum
    const checksum = await this.createChecksum(encryptedData);

    const backup: KeyBackup = {
      id: crypto.randomUUID(),
      encryptedBackup: JSON.stringify({ data: encryptedData, salt, iv }),
      backupType: 'recovery',
      createdAt: Date.now(),
      createdBy: deviceId,
      requiresWebAuthn: !!credential,
      credentialId: credential?.id,
      metadata: {
        version: 1,
        format: 'json',
        checksum,
      },
    };

    return backup;
  }

  /**
   * Restore keys from backup
   */
  public async restoreFromBackup(
    backup: KeyBackup,
    credential?: WebAuthnCredential,
    password?: string
  ): Promise<string[]> {
    // Verify WebAuthn if required
    if (backup.requiresWebAuthn && credential) {
      const isValid = await webAuthnService.verifyCredential(credential);
      if (!isValid) {
        throw new Error('WebAuthn verification failed');
      }
    }

    // Parse backup data
    const { data, salt, iv } = JSON.parse(backup.encryptedBackup);

    // Verify checksum
    if (backup.metadata?.checksum) {
      const checksum = await this.createChecksum(data);
      if (checksum !== backup.metadata.checksum) {
        throw new Error('Backup integrity check failed');
      }
    }

    // Derive decryption key
    const decryptionKey = await this.deriveEncryptionKey(password || '');

    // Decrypt backup
    const decrypted = await this.decryptKey(data, decryptionKey, salt, iv);
    const backupData = JSON.parse(decrypted);

    return backupData.keys;
  }

  /**
   * Derive an encryption key from password using PBKDF2
   */
  private async deriveEncryptionKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('BuildItNetwork'), // In production, use unique salt per user
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encryptKey(
    data: string,
    key: CryptoKey
  ): Promise<{ encryptedData: string; salt: string; iv: string }> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      dataBuffer
    );

    return {
      encryptedData: this.bufferToBase64(new Uint8Array(encrypted)),
      salt: 'BuildItNetwork', // In production, use unique salt
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decryptKey(
    encryptedData: string,
    key: CryptoKey,
    _salt: string,
    ivString: string
  ): Promise<string> {
    const encrypted = this.base64ToBuffer(encryptedData);
    const iv = this.base64ToBuffer(ivString);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Create checksum for data integrity
   */
  private async createChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.bufferToBase64(new Uint8Array(hash));
  }

  /**
   * Convert buffer to base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  /**
   * Convert base64 to buffer
   */
  private base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Rotate encryption key and re-encrypt all protected keys
   * This allows changing password or upgrading encryption without losing keys
   */
  public async rotateEncryptionKey(
    storages: ProtectedKeyStorage[],
    oldPassword: string,
    newPassword: string,
    credential?: WebAuthnCredential
  ): Promise<ProtectedKeyStorage[]> {
    const rotatedStorages: ProtectedKeyStorage[] = [];

    for (const storage of storages) {
      try {
        // 1. Decrypt with old key
        const privateKey = await this.retrieveProtectedKey(
          storage,
          credential,
          oldPassword
        );

        // 2. Re-encrypt with new key
        const newEncryptionKey = await this.deriveEncryptionKey(newPassword);
        const { encryptedData, salt, iv } = await this.encryptKey(
          privateKey,
          newEncryptionKey
        );

        // 3. Create new storage with rotated encryption
        const rotatedStorage: ProtectedKeyStorage = {
          ...storage,
          encryptedKey: encryptedData,
          salt,
          iv,
          rotatedAt: Date.now(),
          rotatedFrom: storage.id,
        };

        rotatedStorages.push(rotatedStorage);
      } catch (error) {
        console.error(`Failed to rotate key ${storage.id}:`, error);
        throw new Error(`Key rotation failed for storage ${storage.id}`);
      }
    }

    return rotatedStorages;
  }

  /**
   * Upgrade storage to use WebAuthn protection
   * Re-encrypts keys with WebAuthn credential
   */
  public async upgradeToWebAuthn(
    storage: ProtectedKeyStorage,
    credential: WebAuthnCredential,
    currentPassword: string
  ): Promise<ProtectedKeyStorage> {
    // Verify WebAuthn credential
    const isValid = await webAuthnService.verifyCredential(credential);
    if (!isValid) {
      throw new Error('WebAuthn verification failed');
    }

    // Decrypt with current password
    const privateKey = await this.retrieveProtectedKey(
      storage,
      undefined,
      currentPassword
    );

    // Re-encrypt with WebAuthn protection
    const upgradedStorage = await this.storeProtectedKey(
      privateKey,
      storage.deviceId,
      credential,
      currentPassword
    );

    return {
      ...upgradedStorage,
      upgradedAt: Date.now(),
      upgradedFrom: storage.id,
    };
  }

  /**
   * Batch re-encryption for all keys in database
   * Useful for password changes or security upgrades
   */
  public async batchReencrypt(
    keys: Array<{ id: string; encryptedKey: string; salt: string; iv: string }>,
    oldPassword: string,
    newPassword: string
  ): Promise<Array<{ id: string; encryptedKey: string; salt: string; iv: string }>> {
    const reencryptedKeys = [];

    for (const key of keys) {
      try {
        // Decrypt with old password
        const oldEncryptionKey = await this.deriveEncryptionKey(oldPassword);
        const decryptedKey = await this.decryptKey(
          key.encryptedKey,
          oldEncryptionKey,
          key.salt,
          key.iv
        );

        // Re-encrypt with new password
        const newEncryptionKey = await this.deriveEncryptionKey(newPassword);
        const { encryptedData, salt, iv } = await this.encryptKey(
          decryptedKey,
          newEncryptionKey
        );

        reencryptedKeys.push({
          id: key.id,
          encryptedKey: encryptedData,
          salt,
          iv,
        });
      } catch (error) {
        console.error(`Failed to re-encrypt key ${key.id}:`, error);
        throw new Error(`Re-encryption failed for key ${key.id}`);
      }
    }

    return reencryptedKeys;
  }
}

// Export singleton instance
export const protectedKeyStorage = ProtectedKeyStorageService.getInstance();
