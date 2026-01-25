/**
 * encryption.ts Tests
 * Tests the legacy encryption layer using NIP-44
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Generate a test key at module level so it's available to mocks
const TEST_PRIVATE_KEY = generateSecretKey();
const TEST_PUBLIC_KEY = getPublicKey(TEST_PRIVATE_KEY);

// Store in global so mocks can access it
(global as any).__TEST_PRIVATE_KEY = TEST_PRIVATE_KEY;

// Mock SecureKeyManager before importing encryption module
vi.mock('@/core/crypto/SecureKeyManager', () => ({
  secureKeyManager: {
    get isUnlocked() {
      return (global as any).__mockIsUnlocked ?? false;
    },
    getCurrentPrivateKey: () => {
      if ((global as any).__mockIsUnlocked) {
        return (global as any).__TEST_PRIVATE_KEY;
      }
      return null;
    },
  },
}));

describe('encryption.ts', () => {
  beforeEach(() => {
    // Default: locked state
    (global as any).__mockIsUnlocked = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
    (global as any).__mockIsUnlocked = false;
  });

  describe('encryptObject', () => {
    it('should pass through objects for tables without encrypted fields', async () => {
      const { encryptObject } = await import('./encryption');

      const testData = {
        id: 'test-1',
        name: 'Test Name',
        value: 123,
      };

      // 'unknownTable' is not in ENCRYPTED_FIELDS
      const result = encryptObject(testData, 'unknownTable');

      expect(result.id).toBe('test-1');
      expect(result.name).toBe('Test Name');
      expect(result.value).toBe(123);
    });

    it('should pass through when no sensitive fields have data', async () => {
      const { encryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: '', // Empty content
        groupId: 'group-1',
      };

      // Even though 'messages' has 'content' as encrypted field,
      // empty content doesn't need encryption
      const result = encryptObject(testMessage, 'messages');

      expect(result.content).toBe('');
    });

    it('should throw when locked and has sensitive data', async () => {
      const { encryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: 'Secret content',
        groupId: 'group-1',
      };

      expect(() => {
        encryptObject(testMessage, 'messages');
      }).toThrow('Cannot write to messages while locked');
    });

    it('should encrypt content when unlocked', async () => {
      // Set unlocked state via global
      (global as any).__mockIsUnlocked = true;

      const { encryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: 'Secret content',
        groupId: 'group-1',
      };

      const result = encryptObject(testMessage, 'messages');

      // Content should be encrypted with enc:1: prefix
      expect(result.content).not.toBe('Secret content');
      expect(result.content).toMatch(/^enc:1:/);
      // Non-sensitive fields unchanged
      expect(result.id).toBe('msg-1');
      expect(result.groupId).toBe('group-1');
    });

    it('should skip already encrypted values', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: 'enc:1:already-encrypted-data',
        groupId: 'group-1',
      };

      const result = encryptObject(testMessage, 'messages');

      // Should keep the already-encrypted value
      expect(result.content).toBe('enc:1:already-encrypted-data');
    });

    it('should encrypt multiple fields in events table', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject } = await import('./encryption');

      const testEvent = {
        id: 'event-1',
        title: 'Secret Meeting',
        description: 'Discussing important matters',
        location: '123 Hidden Street',
        date: Date.now(),
        groupId: 'group-1',
      };

      const result = encryptObject(testEvent, 'events');

      // All sensitive fields should be encrypted
      expect(result.title).toMatch(/^enc:1:/);
      expect(result.description).toMatch(/^enc:1:/);
      expect(result.location).toMatch(/^enc:1:/);
      // Non-sensitive fields unchanged
      expect(result.id).toBe('event-1');
      expect(result.date).toBe(testEvent.date);
    });

    it('should encrypt without group key (uses user private key)', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject } = await import('./encryption');

      const msg1 = {
        id: 'msg-1',
        content: 'Same content for testing',
        groupId: 'group-1',
      };

      const msg2 = {
        id: 'msg-2',
        content: 'Same content for testing',
        groupId: 'group-2',
      };

      // Encrypt without passing groupId parameter (uses user key)
      const result1 = encryptObject(msg1, 'messages');
      const result2 = encryptObject(msg2, 'messages');

      // Both should be encrypted with user's key
      expect(result1.content).toMatch(/^enc:1:/);
      expect(result2.content).toMatch(/^enc:1:/);
    });

    // Note: deriveGroupKey uses groupId as pseudo-pubkey which is a simplified
    // implementation. Full group key management would require proper key exchange.
  });

  describe('decryptObject', () => {
    it('should pass through objects for tables without encrypted fields', async () => {
      const { decryptObject } = await import('./encryption');

      const testData = {
        id: 'test-1',
        name: 'Test Name',
      };

      const result = decryptObject(testData, 'unknownTable');

      expect(result.name).toBe('Test Name');
    });

    it('should return encrypted data when locked', async () => {
      const { decryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: 'enc:1:some-encrypted-data',
        groupId: 'group-1',
      };

      const result = decryptObject(testMessage, 'messages');

      // Should return encrypted content unchanged when locked
      expect(result.content).toBe('enc:1:some-encrypted-data');
    });

    it('should pass through non-encrypted values', async () => {
      const { decryptObject } = await import('./encryption');

      const testMessage = {
        id: 'msg-1',
        content: 'Plain text content',
        groupId: 'group-1',
      };

      const result = decryptObject(testMessage, 'messages');

      // Plain text passes through (legacy unencrypted data)
      expect(result.content).toBe('Plain text content');
    });

    it('should decrypt content when unlocked', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject, decryptObject } = await import('./encryption');

      // First encrypt
      const original = {
        id: 'msg-1',
        content: 'Secret message content',
        groupId: 'group-1',
      };

      const encrypted = encryptObject(original, 'messages');
      expect(encrypted.content).toMatch(/^enc:1:/);

      // Then decrypt
      const decrypted = decryptObject(encrypted, 'messages');
      expect(decrypted.content).toBe('Secret message content');
    });

    it('should handle decryption failure gracefully', async () => {
      (global as any).__mockIsUnlocked = true;

      const { decryptObject } = await import('./encryption');

      // Invalid ciphertext
      const testMessage = {
        id: 'msg-1',
        content: 'enc:1:invalid-not-real-ciphertext',
        groupId: 'group-1',
      };

      const result = decryptObject(testMessage, 'messages');

      // Should return error placeholder
      expect(result.content).toBe('[Decryption failed]');
    });

    it('should round-trip encrypt/decrypt events with multiple fields', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject, decryptObject } = await import('./encryption');

      const original = {
        id: 'event-1',
        title: 'Town Hall Meeting',
        description: 'Important community discussion',
        location: '456 Main Street',
        groupId: 'group-1',
      };

      const encrypted = encryptObject(original, 'events');
      const decrypted = decryptObject(encrypted, 'events');

      expect(decrypted.title).toBe('Town Hall Meeting');
      expect(decrypted.description).toBe('Important community discussion');
      expect(decrypted.location).toBe('456 Main Street');
    });

    it('should handle unicode content', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject, decryptObject } = await import('./encryption');

      const original = {
        id: 'msg-1',
        content: '🔐 Unicode: émojis, 中文, العربية, 日本語',
        groupId: 'group-1',
      };

      const encrypted = encryptObject(original, 'messages');
      const decrypted = decryptObject(encrypted, 'messages');

      expect(decrypted.content).toBe(original.content);
    });

    it('should handle JSON-stringified non-string values', async () => {
      (global as any).__mockIsUnlocked = true;

      const { encryptObject, decryptObject } = await import('./encryption');

      const original = {
        id: 'record-1',
        data: { nested: 'value', count: 42 },
        groupId: 'group-1',
      };

      const encrypted = encryptObject(original, 'databaseRecords');
      const decrypted = decryptObject(encrypted, 'databaseRecords');

      // Non-string data is JSON stringified during encryption
      expect(decrypted.data).toBe('{"nested":"value","count":42}');
    });
  });

  describe('setupEncryptionHooks', () => {
    it('should be a function', async () => {
      const { setupEncryptionHooks } = await import('./encryption');
      expect(typeof setupEncryptionHooks).toBe('function');
    });

    it('should handle database without tables gracefully', async () => {
      const { setupEncryptionHooks } = await import('./encryption');

      const mockDb = {};

      // Should not throw
      expect(() => {
        setupEncryptionHooks(mockDb);
      }).not.toThrow();
    });
  });
});
