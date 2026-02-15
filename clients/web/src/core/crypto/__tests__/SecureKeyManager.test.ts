/**
 * SecureKeyManager Tests
 * Tests for secure key storage and encryption
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Argon2id key derivation is CPU-heavy; increase timeout for CI runners
import {
  SecureKeyManager,
  DEFAULT_SECURITY_SETTINGS,
  type EncryptedKeyData,
  type SecuritySettings,
} from '../SecureKeyManager';

// Mock WebAuthn service
vi.mock('@/lib/webauthn/WebAuthnService', () => ({
  webAuthnService: {
    authenticateCredential: vi.fn(),
  },
}));

describe('SecureKeyManager', { timeout: 30_000 }, () => {
  let manager: SecureKeyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the singleton instance
    // Note: We're testing the singleton which maintains state between tests
    // For isolation, we lock it before each test
    manager = SecureKeyManager.getInstance();
    manager.lock();
  });

  afterEach(() => {
    manager.lock();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = SecureKeyManager.getInstance();
      const instance2 = SecureKeyManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initial state', () => {
    it('should start in locked state', () => {
      expect(manager.lockState).toBe('locked');
      expect(manager.isUnlocked).toBe(false);
      expect(manager.currentIdentity).toBeNull();
    });
  });

  describe('generateSalt', () => {
    it('should generate a 32-byte salt', () => {
      const salt = manager.generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32);
    });

    it('should generate unique salts each time', () => {
      const salt1 = manager.generateSalt();
      const salt2 = manager.generateSalt();
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('event listeners', () => {
    it('should add and remove event listeners', () => {
      const listener = vi.fn();

      const removeListener = manager.addEventListener(listener);
      expect(typeof removeListener).toBe('function');

      // Remove the listener
      removeListener();

      // Lock should not call the listener now
      manager.lock();
      // Note: lock emits event but we removed listener
    });

    it('should emit locked event when locking', () => {
      const listener = vi.fn();
      const removeListener = manager.addEventListener(listener);

      manager.lock();

      expect(listener).toHaveBeenCalledWith({ type: 'locked' });

      removeListener();
    });
  });

  describe('lock', () => {
    it('should set lock state to locked', () => {
      manager.lock();
      expect(manager.lockState).toBe('locked');
      expect(manager.isUnlocked).toBe(false);
    });

    it('should clear current identity', () => {
      manager.lock();
      expect(manager.currentIdentity).toBeNull();
    });

    it('should return null for private key after lock', () => {
      manager.lock();
      expect(manager.getCurrentPrivateKey()).toBeNull();
      expect(manager.getPrivateKey('any-key')).toBeNull();
    });

    it('should return null for database key after lock', () => {
      manager.lock();
      expect(manager.getDatabaseKey()).toBeNull();
    });

    it('should return null for master key after lock', () => {
      manager.lock();
      expect(manager.getMasterKey()).toBeNull();
    });
  });

  describe('security settings', () => {
    it('should return default settings for unknown identity', () => {
      const settings = manager.getSecuritySettings('unknown-pubkey');
      expect(settings).toEqual(DEFAULT_SECURITY_SETTINGS);
    });

    it('should set and get security settings', () => {
      const customSettings: SecuritySettings = {
        authMethod: 'webauthn-preferred',
        inactivityTimeout: 30,
        lockOnHide: true,
        lockOnClose: false,
        requirePasswordForExport: true,
      };

      manager.setSecuritySettings('test-pubkey', customSettings);

      const retrieved = manager.getSecuritySettings('test-pubkey');
      expect(retrieved).toEqual(customSettings);
    });
  });

  describe('DEFAULT_SECURITY_SETTINGS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_SECURITY_SETTINGS.authMethod).toBe('password-always');
      expect(DEFAULT_SECURITY_SETTINGS.inactivityTimeout).toBe(15);
      expect(DEFAULT_SECURITY_SETTINGS.lockOnHide).toBe(false);
      expect(DEFAULT_SECURITY_SETTINGS.lockOnClose).toBe(true);
      expect(DEFAULT_SECURITY_SETTINGS.requirePasswordForExport).toBe(true);
    });
  });

  // Note: The following tests require WebCrypto which may not be fully available
  // in all test environments. These test the expected behavior.

  describe('createEncryptedKeyData', () => {
    it('should create encrypted key data structure', async () => {
      const publicKey = 'test-public-key';
      const privateKey = new Uint8Array(32).fill(1);
      const password = 'test-password';

      const result = await manager.createEncryptedKeyData(publicKey, privateKey, password);

      expect(result.publicKey).toBe(publicKey);
      expect(result.encryptedPrivateKey).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.webAuthnProtected).toBe(false);
      expect(result.keyVersion).toBe(1);
      expect(result.createdAt).toBeDefined();
    });

    it('should create different encrypted data for same key with different passwords', async () => {
      const publicKey = 'test-public-key';
      const privateKey = new Uint8Array(32).fill(1);

      const result1 = await manager.createEncryptedKeyData(publicKey, privateKey, 'password1');
      const result2 = await manager.createEncryptedKeyData(publicKey, privateKey, 'password2');

      expect(result1.encryptedPrivateKey).not.toBe(result2.encryptedPrivateKey);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should set webAuthnProtected when credential provided', async () => {
      const publicKey = 'test-public-key';
      const privateKey = new Uint8Array(32).fill(1);
      const password = 'test-password';
      const credential = {
        id: 'cred-123',
        publicKey: 'cred-public-key',
        deviceId: 'device-1',
        counter: 0,
        createdAt: Date.now(),
      };

      const result = await manager.createEncryptedKeyData(publicKey, privateKey, password, credential);

      expect(result.webAuthnProtected).toBe(true);
      expect(result.credentialId).toBe('cred-123');
    });
  });

  describe('unlockWithPassword', () => {
    let encryptedData: EncryptedKeyData;
    const password = 'test-password';
    const privateKey = new Uint8Array(32).fill(42);

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData('test-pubkey', privateKey, password);
      manager.lock();
    });

    it('should unlock with correct password', async () => {
      const result = await manager.unlockWithPassword(encryptedData, password);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
      expect(manager.isUnlocked).toBe(true);
      expect(manager.lockState).toBe('unlocked');
      expect(manager.currentIdentity).toBe('test-pubkey');
    });

    it('should store decrypted key accessible via getPrivateKey', async () => {
      await manager.unlockWithPassword(encryptedData, password);

      const storedKey = manager.getPrivateKey('test-pubkey');
      expect(storedKey).toBeInstanceOf(Uint8Array);
      expect(Array.from(storedKey!)).toEqual(Array.from(privateKey));
    });

    it('should make getCurrentPrivateKey return the key', async () => {
      await manager.unlockWithPassword(encryptedData, password);

      const currentKey = manager.getCurrentPrivateKey();
      expect(currentKey).toBeInstanceOf(Uint8Array);
    });

    it('should set database key after unlock', async () => {
      await manager.unlockWithPassword(encryptedData, password);

      const dbKey = manager.getDatabaseKey();
      expect(dbKey).not.toBeNull();
    });

    it('should set master key after unlock', async () => {
      await manager.unlockWithPassword(encryptedData, password);

      const masterKey = manager.getMasterKey();
      expect(masterKey).not.toBeNull();
    });

    it('should throw with incorrect password', async () => {
      await expect(manager.unlockWithPassword(encryptedData, 'wrong-password')).rejects.toThrow(
        'Invalid password or corrupted key data'
      );
    });

    it('should emit unlocked event', async () => {
      const listener = vi.fn();
      const removeListener = manager.addEventListener(listener);

      await manager.unlockWithPassword(encryptedData, password);

      expect(listener).toHaveBeenCalledWith({
        type: 'unlocked',
        publicKey: 'test-pubkey',
      });

      removeListener();
    });
  });

  describe('verifyPassword', () => {
    let encryptedData: EncryptedKeyData;
    const password = 'test-password';

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData(
        'verify-pubkey',
        new Uint8Array(32).fill(1),
        password
      );
    });

    it('should return true for correct password', async () => {
      const result = await manager.verifyPassword(encryptedData, password);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const result = await manager.verifyPassword(encryptedData, 'wrong');
      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    let encryptedData: EncryptedKeyData;
    const oldPassword = 'old-password';
    const newPassword = 'new-password';

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData(
        'change-pubkey',
        new Uint8Array(32).fill(5),
        oldPassword
      );
      manager.lock();
    });

    it('should change password successfully', async () => {
      const newEncrypted = await manager.changePassword(encryptedData, oldPassword, newPassword);

      expect(newEncrypted.encryptedPrivateKey).not.toBe(encryptedData.encryptedPrivateKey);
      expect(newEncrypted.salt).not.toBe(encryptedData.salt);
      expect(newEncrypted.keyVersion).toBe(encryptedData.keyVersion + 1);
    });

    it('should allow unlock with new password', async () => {
      const newEncrypted = await manager.changePassword(encryptedData, oldPassword, newPassword);
      manager.lock();

      await expect(manager.unlockWithPassword(newEncrypted, newPassword)).resolves.toBeDefined();
    });

    it('should not allow unlock with old password after change', async () => {
      const newEncrypted = await manager.changePassword(encryptedData, oldPassword, newPassword);
      manager.lock();

      await expect(manager.unlockWithPassword(newEncrypted, oldPassword)).rejects.toThrow();
    });
  });

  describe('enableWebAuthn', () => {
    let encryptedData: EncryptedKeyData;
    const password = 'test-password';
    const credential = {
      id: 'webauthn-cred-123',
      publicKey: 'webauthn-public-key',
      deviceId: 'device-1',
      counter: 0,
      createdAt: Date.now(),
    };

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData(
        'webauthn-pubkey',
        new Uint8Array(32).fill(3),
        password
      );
    });

    it('should enable WebAuthn with correct password', async () => {
      const result = await manager.enableWebAuthn(encryptedData, credential, password);

      expect(result.webAuthnProtected).toBe(true);
      expect(result.credentialId).toBe('webauthn-cred-123');
      expect(result.keyVersion).toBe(encryptedData.keyVersion + 1);
    });

    it('should throw with incorrect password', async () => {
      await expect(
        manager.enableWebAuthn(encryptedData, credential, 'wrong-password')
      ).rejects.toThrow('Invalid password');
    });
  });

  describe('disableWebAuthn', () => {
    let encryptedData: EncryptedKeyData;
    const password = 'test-password';

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData(
        'disable-webauthn-pubkey',
        new Uint8Array(32).fill(4),
        password,
        {
          id: 'cred-to-disable',
          publicKey: 'pk',
          deviceId: 'd1',
          counter: 0,
          createdAt: Date.now(),
        }
      );
    });

    it('should disable WebAuthn with correct password', async () => {
      const result = await manager.disableWebAuthn(encryptedData, password);

      expect(result.webAuthnProtected).toBe(false);
      expect(result.credentialId).toBeUndefined();
      expect(result.keyVersion).toBe(encryptedData.keyVersion + 1);
    });

    it('should throw with incorrect password', async () => {
      await expect(manager.disableWebAuthn(encryptedData, 'wrong-password')).rejects.toThrow(
        'Invalid password'
      );
    });
  });

  describe('exportPrivateKey', () => {
    let encryptedData: EncryptedKeyData;
    const password = 'export-password';
    const privateKey = new Uint8Array(32).fill(7);

    beforeEach(async () => {
      encryptedData = await manager.createEncryptedKeyData('export-pubkey', privateKey, password);
    });

    it('should export private key with correct password', async () => {
      const result = await manager.exportPrivateKey(encryptedData, password);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual(Array.from(privateKey));
    });

    it('should throw with incorrect password', async () => {
      await expect(manager.exportPrivateKey(encryptedData, 'wrong')).rejects.toThrow(
        'Invalid password'
      );
    });
  });

  describe('unlockWithWebAuthn', () => {
    it('should throw if WebAuthn not enabled', async () => {
      const encryptedData: EncryptedKeyData = {
        publicKey: 'test-pubkey',
        encryptedPrivateKey: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        webAuthnProtected: false,
        createdAt: Date.now(),
        keyVersion: 1,
      };

      await expect(
        manager.unlockWithWebAuthn(encryptedData, [], {
          publicKey: 'pk',
          encryptedKey: 'ek',
          iv: 'iv',
          deviceId: 'd1',
          credentialId: 'c1',
          createdAt: Date.now(),
        })
      ).rejects.toThrow('WebAuthn not enabled for this identity');
    });
  });
});
