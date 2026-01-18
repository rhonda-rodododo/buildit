/**
 * Key Rotation Tests
 * Tests for key rotation and re-encryption functionality
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProtectedKeyStorageService } from '@/lib/webauthn/ProtectedKeyStorage';

describe('Key Rotation and Re-encryption', () => {
  let service: ProtectedKeyStorageService;
  const testDeviceId = 'test-device-123';
  const testPrivateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const oldPassword = 'oldPassword123';
  const newPassword = 'newPassword456';

  beforeEach(() => {
    service = ProtectedKeyStorageService.getInstance();
  });

  describe('Key Rotation', () => {
    it('should rotate encryption key and re-encrypt successfully', async () => {
      // 1. Create original protected key with old password
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      // 2. Rotate the key
      const rotated = await service.rotateEncryptionKey(
        [original],
        oldPassword,
        newPassword
      );

      // Verify rotation metadata
      expect(rotated).toHaveLength(1);
      expect(rotated[0].rotatedAt).toBeDefined();
      expect(rotated[0].rotatedFrom).toBe(original.id);

      // 3. Verify can decrypt with new password
      const decrypted = await service.retrieveProtectedKey(
        rotated[0],
        undefined,
        newPassword
      );

      expect(decrypted).toBe(testPrivateKey);
    });

    it('should fail to decrypt rotated key with old password', async () => {
      // Create and rotate key
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      const rotated = await service.rotateEncryptionKey(
        [original],
        oldPassword,
        newPassword
      );

      // Try to decrypt with old password - should fail
      await expect(
        service.retrieveProtectedKey(rotated[0], undefined, oldPassword)
      ).rejects.toThrow();
    });

    it('should rotate multiple keys in batch', async () => {
      // Create multiple keys
      const key1 = await service.storeProtectedKey(
        testPrivateKey + '1',
        testDeviceId,
        undefined,
        oldPassword
      );

      const key2 = await service.storeProtectedKey(
        testPrivateKey + '2',
        testDeviceId,
        undefined,
        oldPassword
      );

      const key3 = await service.storeProtectedKey(
        testPrivateKey + '3',
        testDeviceId,
        undefined,
        oldPassword
      );

      // Rotate all keys
      const rotated = await service.rotateEncryptionKey(
        [key1, key2, key3],
        oldPassword,
        newPassword
      );

      expect(rotated).toHaveLength(3);

      // Verify all can be decrypted with new password
      const decrypted1 = await service.retrieveProtectedKey(
        rotated[0],
        undefined,
        newPassword
      );
      const decrypted2 = await service.retrieveProtectedKey(
        rotated[1],
        undefined,
        newPassword
      );
      const decrypted3 = await service.retrieveProtectedKey(
        rotated[2],
        undefined,
        newPassword
      );

      expect(decrypted1).toBe(testPrivateKey + '1');
      expect(decrypted2).toBe(testPrivateKey + '2');
      expect(decrypted3).toBe(testPrivateKey + '3');
    });

    it('should preserve encryption when no password change', async () => {
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      // "Rotate" with same password (no actual change)
      const rotated = await service.rotateEncryptionKey(
        [original],
        oldPassword,
        oldPassword
      );

      // Should still decrypt successfully
      const decrypted = await service.retrieveProtectedKey(
        rotated[0],
        undefined,
        oldPassword
      );

      expect(decrypted).toBe(testPrivateKey);
    });
  });

  describe('Batch Re-encryption', () => {
    it('should re-encrypt batch of keys', async () => {
      const key1 = await service.storeProtectedKey(
        testPrivateKey + '1',
        testDeviceId,
        undefined,
        oldPassword
      );

      const key2 = await service.storeProtectedKey(
        testPrivateKey + '2',
        testDeviceId,
        undefined,
        oldPassword
      );

      const keys = [
        { id: key1.id, encryptedKey: key1.encryptedKey, salt: key1.salt, iv: key1.iv },
        { id: key2.id, encryptedKey: key2.encryptedKey, salt: key2.salt, iv: key2.iv },
      ];

      const reencrypted = await service.batchReencrypt(
        keys,
        oldPassword,
        newPassword
      );

      expect(reencrypted).toHaveLength(2);
      // IDs should be preserved
      expect(reencrypted[0].id).toBe(key1.id);
      expect(reencrypted[1].id).toBe(key2.id);

      // Verify encryption changed
      expect(reencrypted[0].encryptedKey).not.toBe(key1.encryptedKey);
      expect(reencrypted[1].encryptedKey).not.toBe(key2.encryptedKey);
    });

    it('should throw error if old password is incorrect', async () => {
      const key = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      const keys = [
        { id: '1', encryptedKey: key.encryptedKey, salt: key.salt, iv: key.iv },
      ];

      await expect(
        service.batchReencrypt(keys, 'wrongPassword', newPassword)
      ).rejects.toThrow();
    });
  });

  describe('Key Encryption Properties', () => {
    it('should generate unique IVs for each encryption', async () => {
      const key1 = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      const key2 = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      // Different encryptions should have different IVs
      expect(key1.iv).not.toBe(key2.iv);
      // And different encrypted data even though plaintext is the same
      expect(key1.encryptedKey).not.toBe(key2.encryptedKey);
    });

    it('should preserve key integrity through rotation', async () => {
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      // Multiple rotations
      let current = [original];
      for (let i = 0; i < 5; i++) {
        current = await service.rotateEncryptionKey(
          current,
          i === 0 ? oldPassword : `password${i}`,
          `password${i + 1}`
        );
      }

      // Verify key still decrypts correctly after 5 rotations
      const finalDecrypted = await service.retrieveProtectedKey(
        current[0],
        undefined,
        'password5'
      );

      expect(finalDecrypted).toBe(testPrivateKey);
    });

    it('should handle empty password (using default derivation)', async () => {
      const key = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        '' // Empty password
      );

      const decrypted = await service.retrieveProtectedKey(key, undefined, '');
      expect(decrypted).toBe(testPrivateKey);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when rotating with wrong old password', async () => {
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      await expect(
        service.rotateEncryptionKey(
          [original],
          'wrongPassword',
          newPassword
        )
      ).rejects.toThrow();
    });

    it('should provide detailed error message on rotation failure', async () => {
      const original = await service.storeProtectedKey(
        testPrivateKey,
        testDeviceId,
        undefined,
        oldPassword
      );

      try {
        await service.rotateEncryptionKey(
          [original],
          'wrongPassword',
          newPassword
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Key rotation failed');
      }
    });
  });
});
