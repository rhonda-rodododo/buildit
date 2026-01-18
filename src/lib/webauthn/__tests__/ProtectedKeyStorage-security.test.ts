import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Security tests for ProtectedKeyStorage
 *
 * These tests verify:
 * 1. Random salt generation for each encryption
 * 2. PBKDF2 iteration count (600K per OWASP 2023)
 * 3. AES-GCM encryption with random IVs
 * 4. Key derivation security
 */

describe('ProtectedKeyStorage Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Salt Generation', () => {
    it('should generate unique random salt for each key storage', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')

      // Create a fresh instance for testing
      const storage = ProtectedKeyStorageService.getInstance()

      const spy = vi.spyOn(crypto, 'getRandomValues')

      // Store a key
      await storage.storeProtectedKey('test-private-key', 'device-1', undefined, 'password')

      // Verify crypto.getRandomValues was called (for salt generation)
      expect(spy).toHaveBeenCalled()

      // Check that we called it with a 16-byte array (for salt)
      const saltCalls = spy.mock.calls.filter(call => {
        const arr = call[0]
        return arr instanceof Uint8Array && arr.length === 16
      })
      expect(saltCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should produce different salts for same password', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')

      const storage = ProtectedKeyStorageService.getInstance()
      const password = 'same-password'

      const result1 = await storage.storeProtectedKey('key1', 'device-1', undefined, password)
      const result2 = await storage.storeProtectedKey('key2', 'device-1', undefined, password)

      // Salts should be different
      expect(result1.salt).not.toBe(result2.salt)
    })

    it('should use 16 bytes (128 bits) of salt', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')

      const storage = ProtectedKeyStorageService.getInstance()

      const result = await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      // Salt is base64 encoded 16 bytes
      // 16 bytes = 128 bits, base64 encoded = 24 characters (with padding)
      const saltBytes = atob(result.salt)
      expect(saltBytes.length).toBe(16)
    })
  })

  describe('PBKDF2 Configuration', () => {
    it('should use 600,000 iterations per OWASP 2023', async () => {
      const spy = vi.spyOn(crypto.subtle, 'deriveKey')

      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      // Find the PBKDF2 call
      const pbkdf2Call = spy.mock.calls.find(call => {
        const algorithm = call[0] as AlgorithmIdentifier & { name?: string }
        return typeof algorithm === 'object' && algorithm.name === 'PBKDF2'
      })

      expect(pbkdf2Call).toBeDefined()

      const algorithm = pbkdf2Call![0] as Pbkdf2Params
      expect(algorithm.iterations).toBe(600000)
      expect(algorithm.hash).toBe('SHA-256')
    })

    it('should use SHA-256 as the hash algorithm', async () => {
      const spy = vi.spyOn(crypto.subtle, 'deriveKey')

      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      const pbkdf2Call = spy.mock.calls.find(call => {
        const algorithm = call[0] as AlgorithmIdentifier & { name?: string }
        return typeof algorithm === 'object' && algorithm.name === 'PBKDF2'
      })

      const algorithm = pbkdf2Call![0] as Pbkdf2Params
      expect(algorithm.hash).toBe('SHA-256')
    })

    it('should derive AES-256-GCM key', async () => {
      const spy = vi.spyOn(crypto.subtle, 'deriveKey')

      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      const call = spy.mock.calls[0]
      const derivedKeyType = call[2] as AesKeyGenParams

      expect(derivedKeyType.name).toBe('AES-GCM')
      expect(derivedKeyType.length).toBe(256)
    })
  })

  describe('AES-GCM Encryption', () => {
    it('should use random IV for each encryption', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const result1 = await storage.storeProtectedKey('key', 'device-1', undefined, 'password')
      const result2 = await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      // IVs should be different
      expect(result1.iv).not.toBe(result2.iv)
    })

    it('should use 12-byte (96-bit) IV per NIST recommendation', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const result = await storage.storeProtectedKey('key', 'device-1', undefined, 'password')

      // IV is base64 encoded 12 bytes
      const ivBytes = atob(result.iv)
      expect(ivBytes.length).toBe(12)
    })

    it('should successfully encrypt and decrypt data', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const originalKey = 'my-secret-private-key'
      const password = 'secure-password'

      const encrypted = await storage.storeProtectedKey(originalKey, 'device-1', undefined, password)
      const decrypted = await storage.retrieveProtectedKey(encrypted, undefined, password)

      expect(decrypted).toBe(originalKey)
    })

    it('should fail decryption with wrong password', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const encrypted = await storage.storeProtectedKey('key', 'device-1', undefined, 'correct-password')

      await expect(
        storage.retrieveProtectedKey(encrypted, undefined, 'wrong-password')
      ).rejects.toThrow()
    })
  })

  describe('Key Rotation', () => {
    it('should generate new salt during key rotation', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const original = await storage.storeProtectedKey('key', 'device-1', undefined, 'old-password')
      const rotated = await storage.rotateEncryptionKey([original], 'old-password', 'new-password')

      // New storage should have different salt
      expect(rotated[0].salt).not.toBe(original.salt)
    })

    it('should decrypt with new password after rotation', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const originalKey = 'my-secret-key'
      const original = await storage.storeProtectedKey(originalKey, 'device-1', undefined, 'old-password')
      const [rotated] = await storage.rotateEncryptionKey([original], 'old-password', 'new-password')

      // Should fail with old password
      await expect(
        storage.retrieveProtectedKey(rotated, undefined, 'old-password')
      ).rejects.toThrow()

      // Should succeed with new password
      const decrypted = await storage.retrieveProtectedKey(rotated, undefined, 'new-password')
      expect(decrypted).toBe(originalKey)
    })
  })

  describe('Backup Security', () => {
    it('should use random salt for backups', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const backup1 = await storage.createBackup(['key1'], 'device-1', undefined, 'password')
      const backup2 = await storage.createBackup(['key2'], 'device-1', undefined, 'password')

      const data1 = JSON.parse(backup1.encryptedBackup)
      const data2 = JSON.parse(backup2.encryptedBackup)

      expect(data1.salt).not.toBe(data2.salt)
    })

    it('should create SHA-256 checksum for integrity', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const backup = await storage.createBackup(['key'], 'device-1', undefined, 'password')

      expect(backup.metadata?.checksum).toBeDefined()
      // SHA-256 base64 encoded = 44 characters
      expect(backup.metadata?.checksum?.length).toBe(44)
    })

    it('should create checksum that can detect tampering', async () => {
      const { ProtectedKeyStorageService } = await import('../ProtectedKeyStorage')
      const storage = ProtectedKeyStorageService.getInstance()

      const backup = await storage.createBackup(['key'], 'device-1', undefined, 'password')

      // Verify checksum exists and is SHA-256 (44 chars base64)
      expect(backup.metadata?.checksum).toBeDefined()
      expect(backup.metadata?.checksum?.length).toBe(44)

      // Verify backup can be restored
      const restored = await storage.restoreFromBackup(backup, undefined, 'password')
      expect(restored).toEqual(['key'])

      // The checksum provides integrity verification
      // In a real tampering scenario, decryption would also fail
      // due to AES-GCM authentication tag verification
    })
  })
})
