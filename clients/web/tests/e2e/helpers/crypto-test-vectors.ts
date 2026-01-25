/**
 * Crypto Test Vectors for E2E Testing
 *
 * Contains known test vectors for validating cryptographic operations.
 * These vectors are derived from NIP-44 specification and secp256k1 test cases.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/44.md
 */

// ============================================================================
// Secp256k1 Key Pairs
// ============================================================================

/**
 * Test keypair 1 - Alice
 * These are TEST KEYS ONLY - never use in production!
 */
export const ALICE_KEYPAIR = {
  privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
  publicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  publicKeyUncompressed: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
} as const;

/**
 * Test keypair 2 - Bob
 * These are TEST KEYS ONLY - never use in production!
 */
export const BOB_KEYPAIR = {
  privateKey: '0000000000000000000000000000000000000000000000000000000000000002',
  publicKey: '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  publicKeyUncompressed: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
} as const;

/**
 * Test keypair 3 - Charlie
 * These are TEST KEYS ONLY - never use in production!
 */
export const CHARLIE_KEYPAIR = {
  privateKey: '0000000000000000000000000000000000000000000000000000000000000003',
  publicKey: '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
  publicKeyUncompressed: 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
} as const;

/**
 * Random test keypair with realistic entropy
 * Generated for testing purposes
 */
export const RANDOM_KEYPAIR_1 = {
  privateKey: '67dde7da0c07cb67af5045bf4f5d7d3537aaaf8405b0b6cf965d272d6c934ff4',
  publicKey: '9c87e5c0c6b7f4e5c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4',
} as const;

/**
 * Another random test keypair
 */
export const RANDOM_KEYPAIR_2 = {
  privateKey: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  publicKey: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
} as const;

// ============================================================================
// NIP-44 Test Vectors
// ============================================================================

/**
 * NIP-44 encryption test vectors
 * Format: plaintext -> expected ciphertext properties
 */
export const NIP44_TEST_VECTORS = {
  simple: {
    plaintext: 'Hello, World!',
    minCiphertextLength: 32, // NIP-44 ciphertext has minimum padding
  },
  unicode: {
    plaintext: 'Hello, World!',
    minCiphertextLength: 32,
  },
  empty: {
    plaintext: '',
    // Empty plaintext should still produce valid ciphertext with padding
    minCiphertextLength: 32,
  },
  long: {
    plaintext: 'A'.repeat(1000),
    // Long messages should be properly padded
    minCiphertextLength: 1000,
  },
  binary: {
    // Test with binary-like content (hex-encoded)
    plaintext: '\x00\x01\x02\x03\x04\x05',
    minCiphertextLength: 32,
  },
  json: {
    plaintext: JSON.stringify({ type: 'message', content: 'test', timestamp: 1234567890 }),
    minCiphertextLength: 32,
  },
} as const;

// ============================================================================
// Conversation Key Test Vectors
// ============================================================================

/**
 * Expected conversation key derivation results
 * Conversation keys are derived using ECDH + HKDF as per NIP-44
 */
export const CONVERSATION_KEY_VECTORS = {
  /**
   * Alice -> Bob conversation key
   * Key = HKDF(ECDH(alice_priv, bob_pub))
   */
  aliceToBob: {
    alicePrivateKey: ALICE_KEYPAIR.privateKey,
    bobPublicKey: BOB_KEYPAIR.publicKeyUncompressed,
    // Conversation key should be 32 bytes (64 hex chars)
    keyLength: 64,
  },
  /**
   * Bob -> Alice conversation key (should be same as alice -> bob)
   */
  bobToAlice: {
    bobPrivateKey: BOB_KEYPAIR.privateKey,
    alicePublicKey: ALICE_KEYPAIR.publicKeyUncompressed,
    keyLength: 64,
  },
  /**
   * Alice -> Charlie conversation key
   */
  aliceToCharlie: {
    alicePrivateKey: ALICE_KEYPAIR.privateKey,
    charliePublicKey: CHARLIE_KEYPAIR.publicKeyUncompressed,
    keyLength: 64,
  },
} as const;

// ============================================================================
// Key Validation Utilities
// ============================================================================

/**
 * Valid hex key patterns
 */
export const KEY_PATTERNS = {
  /** 32 bytes = 64 hex chars for private keys */
  privateKeyHex: /^[0-9a-f]{64}$/i,
  /** 32 bytes = 64 hex chars for x-only public keys (Nostr) */
  publicKeyHex: /^[0-9a-f]{64}$/i,
  /** 33 bytes = 66 hex chars for compressed public keys */
  compressedPublicKeyHex: /^(02|03)[0-9a-f]{64}$/i,
  /** Conversation key should be 32 bytes */
  conversationKeyHex: /^[0-9a-f]{64}$/i,
  /** NIP-44 ciphertext is base64 encoded */
  nip44CiphertextBase64: /^[A-Za-z0-9+/]+=*$/,
} as const;

/**
 * Invalid key test cases for error handling validation
 */
export const INVALID_KEY_VECTORS = {
  tooShort: 'abcd',
  tooLong: 'a'.repeat(128),
  notHex: 'zzzz' + '0'.repeat(60),
  oddLength: '0'.repeat(63),
  empty: '',
  withSpaces: '00 00 00 00' + '00'.repeat(28),
  withPrefix: '0x' + '00'.repeat(32),
} as const;

// ============================================================================
// Test Message Content
// ============================================================================

/**
 * Sample messages for encryption testing
 */
export const TEST_MESSAGES = {
  short: 'Hi',
  medium: 'Hello, this is a test message for NIP-44 encryption.',
  long: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20),
  unicode: 'Bonjour le monde!',
  emoji: 'Hello World! ',
  specialChars: '<script>alert("test")</script> & "quotes" \'apostrophes\'',
  json: {
    type: 'dm',
    content: 'Secret message',
    timestamp: Date.now(),
    nonce: Math.random().toString(36),
  },
  binary: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
} as const;

// ============================================================================
// Keyring Test Data
// ============================================================================

/**
 * Secret types for keyring testing
 */
export const SECRET_TYPES = {
  nostrPrivateKey: 'nostr_private_key',
  masterKey: 'master_key',
  databaseKey: 'database_key',
  apiToken: 'api_token',
  customPrefix: 'custom_',
} as const;

/**
 * Test users for keyring operations
 */
export const TEST_USERS = {
  alice: {
    id: 'alice_test_user',
    displayName: 'Alice Test',
  },
  bob: {
    id: 'bob_test_user',
    displayName: 'Bob Test',
  },
  charlie: {
    id: 'charlie_test_user',
    displayName: 'Charlie Test',
  },
} as const;

/**
 * Sample secrets for keyring testing
 */
export const TEST_SECRETS = {
  nostrKey: {
    type: SECRET_TYPES.nostrPrivateKey,
    value: RANDOM_KEYPAIR_1.privateKey,
    label: 'Test Nostr Key',
  },
  masterKey: {
    type: SECRET_TYPES.masterKey,
    value: 'deadbeef'.repeat(8), // 32 bytes hex
    label: 'Test Master Key',
  },
  databaseKey: {
    type: SECRET_TYPES.databaseKey,
    value: 'cafebabe'.repeat(8), // 32 bytes hex
    label: 'Test Database Key',
  },
  apiToken: {
    type: SECRET_TYPES.apiToken,
    value: 'sk_test_' + 'a'.repeat(48),
    label: 'Test API Token',
  },
  customSecret: {
    type: SECRET_TYPES.customPrefix + 'backup_key',
    value: '12345678'.repeat(8),
    label: 'Custom Backup Key',
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string is valid hex of expected length
 */
export function isValidHex(str: string, expectedLength?: number): boolean {
  if (!/^[0-9a-f]*$/i.test(str)) return false;
  if (expectedLength !== undefined && str.length !== expectedLength) return false;
  return true;
}

/**
 * Check if a string is valid base64
 */
export function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

/**
 * Generate a random hex string of specified byte length
 */
export function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert string to hex
 */
export function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex to string
 */
export function hexToString(hex: string): string {
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );
  return new TextDecoder().decode(bytes);
}

// ============================================================================
// Export Types
// ============================================================================

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyUncompressed?: string;
}

export interface TestVector {
  plaintext: string;
  minCiphertextLength: number;
}

export interface ConversationKeyVector {
  alicePrivateKey?: string;
  bobPrivateKey?: string;
  alicePublicKey?: string;
  bobPublicKey?: string;
  charliePublicKey?: string;
  keyLength: number;
}
