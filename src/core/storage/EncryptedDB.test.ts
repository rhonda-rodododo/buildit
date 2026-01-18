/**
 * EncryptedDB Tests
 * Tests the local database encryption layer
 * IMPORTANT: Some tests run WITHOUT test mode to verify encryption works
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from 'nostr-tools/utils';
import {
  enableTestMode,
  disableTestMode,
  isTestMode,
  isEncrypted,
  encryptObject,
  decryptObject,
  ENCRYPTED_FIELDS,
  isEncryptionReady,
  encryptLocal,
  decryptLocal,
  clearLocalEncryptionKey,
} from './EncryptedDB';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';

describe('EncryptedDB', () => {
  // Generate test keys
  const testPrivateKey = generateSecretKey();
  const testPublicKey = getPublicKey(testPrivateKey);

  beforeEach(() => {
    // Clear any cached keys between tests
    clearLocalEncryptionKey();
    // Ensure test mode is off by default for encryption tests
    disableTestMode();
  });

  afterEach(() => {
    disableTestMode();
    clearLocalEncryptionKey();
    vi.clearAllMocks();
  });

  describe('Test Mode', () => {
    it('should enable and disable test mode', () => {
      expect(isTestMode()).toBe(false);

      enableTestMode();
      expect(isTestMode()).toBe(true);

      disableTestMode();
      expect(isTestMode()).toBe(false);
    });

    it('should bypass encryption in test mode', () => {
      enableTestMode();

      const testMessage = {
        id: 'msg-1',
        content: 'Test message content',
        groupId: 'group-1',
      };

      // In test mode, encryptObject should return data unchanged
      const result = encryptObject(testMessage, 'messages');

      expect(result.content).toBe('Test message content');
      expect(isEncrypted(result.content)).toBe(false);
    });

    it('should bypass decryption in test mode', () => {
      enableTestMode();

      const testMessage = {
        id: 'msg-1',
        content: 'local:1:encrypted-data-here',
        groupId: 'group-1',
      };

      // In test mode, decryptObject should return data unchanged
      const result = decryptObject(testMessage, 'messages');

      expect(result.content).toBe('local:1:encrypted-data-here');
    });
  });

  describe('ENCRYPTED_FIELDS Configuration', () => {
    it('should have encryption configured for messages table', () => {
      expect(ENCRYPTED_FIELDS.messages).toContain('content');
    });

    it('should have encryption configured for conversation messages', () => {
      expect(ENCRYPTED_FIELDS.conversationMessages).toContain('content');
    });

    it('should have encryption configured for conversations', () => {
      expect(ENCRYPTED_FIELDS.conversations).toContain('name');
      expect(ENCRYPTED_FIELDS.conversations).toContain('lastMessagePreview');
    });

    it('should have encryption configured for events', () => {
      expect(ENCRYPTED_FIELDS.events).toContain('title');
      expect(ENCRYPTED_FIELDS.events).toContain('description');
      expect(ENCRYPTED_FIELDS.events).toContain('location');
    });

    it('should have encryption configured for proposals', () => {
      expect(ENCRYPTED_FIELDS.proposals).toContain('title');
      expect(ENCRYPTED_FIELDS.proposals).toContain('description');
    });

    it('should have encryption configured for wiki pages', () => {
      expect(ENCRYPTED_FIELDS.wikiPages).toContain('title');
      expect(ENCRYPTED_FIELDS.wikiPages).toContain('content');
    });

    it('should have encryption configured for documents', () => {
      expect(ENCRYPTED_FIELDS.documents).toContain('title');
      expect(ENCRYPTED_FIELDS.documents).toContain('content');
    });

    it('should have encryption configured for friends', () => {
      expect(ENCRYPTED_FIELDS.friends).toContain('displayName');
      expect(ENCRYPTED_FIELDS.friends).toContain('notes');
    });

    it('should have encryption configured for posts', () => {
      expect(ENCRYPTED_FIELDS.posts).toContain('content');
    });
  });

  describe('isEncrypted', () => {
    it('should detect locally encrypted values', () => {
      expect(isEncrypted('local:1:encrypted-data')).toBe(true);
    });

    it('should detect legacy encrypted values', () => {
      expect(isEncrypted('enc:1:legacy-encrypted-data')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted({ key: 'value' })).toBe(false);
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should skip encryption for tables not in ENCRYPTED_FIELDS', () => {
      enableTestMode(); // Use test mode for this test

      const testData = {
        id: 'test-1',
        name: 'Test Name',
        content: 'Test Content',
      };

      // 'nonExistentTable' is not in ENCRYPTED_FIELDS
      const result = encryptObject(testData, 'nonExistentTable');

      expect(result.name).toBe('Test Name');
      expect(result.content).toBe('Test Content');
    });

    it('should skip encryption for empty or null sensitive fields', () => {
      enableTestMode();

      const testMessage = {
        id: 'msg-1',
        content: '', // Empty content
        groupId: null,
      };

      const result = encryptObject(testMessage, 'messages');

      expect(result.content).toBe('');
    });

    it('should skip already-encrypted values', () => {
      enableTestMode();

      const testMessage = {
        id: 'msg-1',
        content: 'local:1:already-encrypted',
        groupId: 'group-1',
      };

      // Should detect that content is already encrypted and skip
      const result = encryptObject(testMessage, 'messages');

      expect(result.content).toBe('local:1:already-encrypted');
    });

    it('should preserve non-sensitive fields unchanged', () => {
      enableTestMode();

      const testMessage = {
        id: 'msg-1',
        authorPubkey: 'pubkey123',
        content: 'Test content',
        timestamp: 1234567890,
        groupId: 'group-1',
      };

      const result = encryptObject(testMessage, 'messages');

      expect(result.id).toBe('msg-1');
      expect(result.authorPubkey).toBe('pubkey123');
      expect(result.timestamp).toBe(1234567890);
      expect(result.groupId).toBe('group-1');
    });
  });

  describe('Encryption with Real Keys', () => {
    // These tests mock the SecureKeyManager to test actual encryption

    it('should require unlocked key to encrypt', () => {
      disableTestMode(); // Ensure test mode is off

      // SecureKeyManager is locked by default
      const testMessage = {
        id: 'msg-1',
        content: 'Sensitive content',
        groupId: 'group-1',
      };

      // Should throw because keys are locked
      expect(() => {
        encryptObject(testMessage, 'messages');
      }).toThrow('Cannot write to messages while locked');
    });

    it('should require unlocked key to use encryptLocal', () => {
      disableTestMode();

      expect(() => {
        encryptLocal('test content');
      }).toThrow('App is locked');
    });

    it('should return encrypted value when locked for decryptLocal', () => {
      disableTestMode();

      const encrypted = 'local:1:some-encrypted-data';
      const result = decryptLocal(encrypted);

      // When locked, should return the encrypted value unchanged
      expect(result).toBe(encrypted);
    });

    it('should pass through unencrypted value in decryptLocal', () => {
      disableTestMode();

      const plaintext = 'plain text content';
      const result = decryptLocal(plaintext);

      // Unencrypted data passes through unchanged
      expect(result).toBe(plaintext);
    });
  });

  describe('isEncryptionReady', () => {
    it('should return false when SecureKeyManager is locked', () => {
      disableTestMode();

      // SecureKeyManager starts locked
      expect(isEncryptionReady()).toBe(false);
    });
  });

  describe('clearLocalEncryptionKey', () => {
    it('should be safe to call multiple times', () => {
      // Should not throw
      expect(() => {
        clearLocalEncryptionKey();
        clearLocalEncryptionKey();
        clearLocalEncryptionKey();
      }).not.toThrow();
    });
  });
});

describe('EncryptedDB with mocked SecureKeyManager', () => {
  const testPrivateKey = generateSecretKey();

  beforeEach(() => {
    disableTestMode();
    clearLocalEncryptionKey();

    // Mock SecureKeyManager to simulate unlocked state
    vi.spyOn(secureKeyManager, 'isUnlocked', 'get').mockReturnValue(true);
    vi.spyOn(secureKeyManager, 'getCurrentPrivateKey').mockReturnValue(testPrivateKey);
  });

  afterEach(() => {
    clearLocalEncryptionKey();
    vi.restoreAllMocks();
  });

  it('should encrypt content when key is available', () => {
    const testMessage = {
      id: 'msg-1',
      content: 'Secret message content',
      groupId: 'group-1',
    };

    const encrypted = encryptObject(testMessage, 'messages');

    // Content should be encrypted (starts with local:1:)
    expect(encrypted.content).not.toBe('Secret message content');
    expect(isEncrypted(encrypted.content)).toBe(true);
    expect(encrypted.content).toMatch(/^local:1:/);
  });

  it('should decrypt content back to original', () => {
    const originalContent = 'Secret message content that should round-trip';
    const testMessage = {
      id: 'msg-1',
      content: originalContent,
      groupId: 'group-1',
    };

    // Encrypt
    const encrypted = encryptObject(testMessage, 'messages');
    expect(encrypted.content).not.toBe(originalContent);

    // Decrypt
    const decrypted = decryptObject(encrypted, 'messages');
    expect(decrypted.content).toBe(originalContent);
  });

  it('should handle encryption/decryption of multiple fields', () => {
    const testEvent = {
      id: 'event-1',
      title: 'Secret Meeting',
      description: 'Discussing important matters',
      location: '123 Hidden Street',
      date: Date.now(),
      groupId: 'group-1',
    };

    // Encrypt
    const encrypted = encryptObject(testEvent, 'events');

    // All sensitive fields should be encrypted
    expect(isEncrypted(encrypted.title)).toBe(true);
    expect(isEncrypted(encrypted.description)).toBe(true);
    expect(isEncrypted(encrypted.location)).toBe(true);

    // Non-sensitive fields unchanged
    expect(encrypted.id).toBe('event-1');
    expect(encrypted.date).toBe(testEvent.date);

    // Decrypt
    const decrypted = decryptObject(encrypted, 'events');
    expect(decrypted.title).toBe('Secret Meeting');
    expect(decrypted.description).toBe('Discussing important matters');
    expect(decrypted.location).toBe('123 Hidden Street');
  });

  it('should use encryptLocal/decryptLocal directly', () => {
    const original = 'Direct encryption test';

    const encrypted = encryptLocal(original);
    expect(encrypted).toMatch(/^local:1:/);
    expect(encrypted).not.toBe(original);

    const decrypted = decryptLocal(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should handle JSON serialization of non-string values', () => {
    const testRecord = {
      id: 'record-1',
      data: { nested: 'value', number: 42 }, // Object that gets JSON-stringified
      groupId: 'group-1',
    };

    // Encrypt (data field in databaseRecords gets encrypted)
    const encrypted = encryptObject(testRecord, 'databaseRecords');

    // data should be encrypted
    expect(isEncrypted(encrypted.data as unknown as string)).toBe(true);

    // Decrypt
    const decrypted = decryptObject(encrypted, 'databaseRecords');

    // After decryption, it should be the JSON string (not parsed back to object)
    expect(decrypted.data).toBe('{"nested":"value","number":42}');
  });

  it('should handle unicode and special characters', () => {
    const testMessage = {
      id: 'msg-1',
      content: '🔒 Encrypted message with unicode: émojis, 中文, العربية',
      groupId: 'group-1',
    };

    const encrypted = encryptObject(testMessage, 'messages');
    const decrypted = decryptObject(encrypted, 'messages');

    expect(decrypted.content).toBe(testMessage.content);
  });

  it('should handle very long content', () => {
    const longContent = 'x'.repeat(10000);
    const testMessage = {
      id: 'msg-1',
      content: longContent,
      groupId: 'group-1',
    };

    const encrypted = encryptObject(testMessage, 'messages');
    const decrypted = decryptObject(encrypted, 'messages');

    expect(decrypted.content).toBe(longContent);
  });
});
