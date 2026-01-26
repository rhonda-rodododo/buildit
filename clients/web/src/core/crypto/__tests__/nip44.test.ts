import { describe, it, expect } from 'vitest'
import { generateKeyPair } from '../keyManager'
import {
  encryptDM,
  decryptDM,
  deriveConversationKey,
  encryptNIP44,
  decryptNIP44,
  BUCKET_SIZES,
  findBucketSize,
  calculatePaddedSize,
} from '../nip44'
import * as nip44Raw from 'nostr-tools/nip44'

describe('NIP-44 Encryption', () => {
  describe('conversation key derivation', () => {
    it('should derive the same key for both parties', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const aliceKey = deriveConversationKey(alice.privateKey, bob.publicKey)
      const bobKey = deriveConversationKey(bob.privateKey, alice.publicKey)

      expect(aliceKey).toEqual(bobKey)
    })
  })

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt messages', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'Hello, secure world!'

      const encrypted = encryptDM(message, alice.privateKey, bob.publicKey)
      const decrypted = decryptDM(encrypted, bob.privateKey, alice.publicKey)

      expect(decrypted).toBe(message)
    })

    it('should produce different ciphertext for same message', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'Test message'

      const encrypted1 = encryptDM(message, alice.privateKey, bob.publicKey)
      const encrypted2 = encryptDM(message, alice.privateKey, bob.publicKey)

      // Due to random nonces, ciphertexts should differ
      expect(encrypted1).not.toBe(encrypted2)

      // But both should decrypt to the same message
      expect(decryptDM(encrypted1, bob.privateKey, alice.publicKey)).toBe(message)
      expect(decryptDM(encrypted2, bob.privateKey, alice.publicKey)).toBe(message)
    })

    it('should handle unicode characters', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = '你好世界! 🌍 مرحبا'

      const encrypted = encryptDM(message, alice.privateKey, bob.publicKey)
      const decrypted = decryptDM(encrypted, bob.privateKey, alice.publicKey)

      expect(decrypted).toBe(message)
    })

    it('should handle very short messages', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'A'

      const encrypted = encryptDM(message, alice.privateKey, bob.publicKey)
      const decrypted = decryptDM(encrypted, bob.privateKey, alice.publicKey)

      expect(decrypted).toBe(message)
    })
  })

  describe('fixed-bucket padding', () => {
    describe('findBucketSize', () => {
      it('should return smallest bucket that fits the content', () => {
        // Tests bucket selection - content length includes header overhead
        expect(findBucketSize(100)).toBe(256)
        expect(findBucketSize(256)).toBe(256)
        expect(findBucketSize(257)).toBe(512)
        expect(findBucketSize(512)).toBe(512)
        expect(findBucketSize(513)).toBe(1024)
        expect(findBucketSize(1024)).toBe(1024)
        expect(findBucketSize(1025)).toBe(2048)
        expect(findBucketSize(4096)).toBe(4096)
        expect(findBucketSize(4097)).toBe(8192)
        expect(findBucketSize(16384)).toBe(16384)
        expect(findBucketSize(16385)).toBe(32768)
        expect(findBucketSize(32768)).toBe(32768)
        expect(findBucketSize(32769)).toBe(65000) // Capped at 65000 for NIP-44 compatibility
        expect(findBucketSize(65000)).toBe(65000)
      })

      it('should return largest bucket for oversized content', () => {
        // Largest bucket is 65000 (not 65536) to stay within NIP-44's 65535 byte limit
        expect(findBucketSize(65001)).toBe(65000)
        expect(findBucketSize(100000)).toBe(65000)
      })
    })

    describe('calculatePaddedSize', () => {
      it('should calculate correct padded size for various message lengths', () => {
        // Header size is 12 bytes (\x00PADv2\x00 = 7 chars + 5 digit length)
        // So message + 12 must fit in bucket

        // Message of 100 chars + 12 = 112 -> bucket 256
        expect(calculatePaddedSize('a'.repeat(100))).toBe(256)

        // Message of 244 chars + 12 = 256 -> bucket 256 (exactly fits)
        expect(calculatePaddedSize('a'.repeat(244))).toBe(256)

        // Message of 245 chars + 12 = 257 -> bucket 512
        expect(calculatePaddedSize('a'.repeat(245))).toBe(512)

        // Message of 500 chars + 12 = 512 -> bucket 512 (exactly fits)
        expect(calculatePaddedSize('a'.repeat(500))).toBe(512)

        // Message of 501 chars + 12 = 513 -> bucket 1024
        expect(calculatePaddedSize('a'.repeat(501))).toBe(1024)
      })
    })

    describe('padding and unpadding', () => {
      it('should pad messages to correct bucket sizes', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        // Test various message sizes (header is 12 bytes)
        const testCases = [
          { message: 'Hi', expectedBucket: 256 },
          { message: 'a'.repeat(100), expectedBucket: 256 },
          { message: 'a'.repeat(244), expectedBucket: 256 },  // 244 + 12 = 256
          { message: 'a'.repeat(245), expectedBucket: 512 },  // 245 + 12 = 257 -> 512
          { message: 'a'.repeat(501), expectedBucket: 1024 }, // 501 + 12 = 513 -> 1024
          { message: 'a'.repeat(1000), expectedBucket: 1024 },
          { message: 'a'.repeat(1500), expectedBucket: 2048 },
        ]

        for (const { message, expectedBucket } of testCases) {
          expect(calculatePaddedSize(message)).toBe(expectedBucket)

          // Verify encryption/decryption still works
          const encrypted = encryptNIP44(message, conversationKey)
          const decrypted = decryptNIP44(encrypted, conversationKey)
          expect(decrypted).toBe(message)
        }
      })

      it('should work correctly for all bucket sizes', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        // Test a message that falls into each bucket size
        // Header is 12 bytes, so message length = bucket - 12 fits exactly
        for (const bucketSize of BUCKET_SIZES) {
          // Message that exactly fills the bucket
          const exactFitLength = bucketSize - 12
          if (exactFitLength > 0) {
            const message = 'x'.repeat(exactFitLength)
            expect(calculatePaddedSize(message)).toBe(bucketSize)

            const encrypted = encryptNIP44(message, conversationKey)
            const decrypted = decryptNIP44(encrypted, conversationKey)
            expect(decrypted).toBe(message)
          }

          // Message that's 1 byte smaller than exact fit
          const smallerLength = bucketSize - 13
          if (smallerLength > 0) {
            const smallerMessage = 'y'.repeat(smallerLength)
            expect(calculatePaddedSize(smallerMessage)).toBe(bucketSize)

            const encrypted = encryptNIP44(smallerMessage, conversationKey)
            const decrypted = decryptNIP44(encrypted, conversationKey)
            expect(decrypted).toBe(smallerMessage)
          }
        }
      })

      it('should handle empty messages', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        const message = ''
        expect(calculatePaddedSize(message)).toBe(256)

        const encrypted = encryptNIP44(message, conversationKey)
        const decrypted = decryptNIP44(encrypted, conversationKey)
        expect(decrypted).toBe(message)
      })

      it('should handle messages with special characters', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        const specialMessages = [
          '\x00PAD\x00fake padding attempt',
          '\x00PADv2\x00fake v2 padding',
          'Message with \n newlines \r\n and \t tabs',
          '你好世界! 🌍 مرحبا العالم',
          'Unicode: \u0000\u0001\u0002',
          'Emoji: 👨‍👩‍👧‍👦 🏳️‍🌈',
        ]

        for (const message of specialMessages) {
          const encrypted = encryptNIP44(message, conversationKey)
          const decrypted = decryptNIP44(encrypted, conversationKey)
          expect(decrypted).toBe(message)
        }
      })

      it('should produce different ciphertext due to random padding', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        const message = 'Test message'

        // Encrypt the same message multiple times
        const encrypted1 = encryptNIP44(message, conversationKey)
        const encrypted2 = encryptNIP44(message, conversationKey)
        const encrypted3 = encryptNIP44(message, conversationKey)

        // All should decrypt to the same message
        expect(decryptNIP44(encrypted1, conversationKey)).toBe(message)
        expect(decryptNIP44(encrypted2, conversationKey)).toBe(message)
        expect(decryptNIP44(encrypted3, conversationKey)).toBe(message)

        // But ciphertexts should differ (due to random padding + NIP44 nonce)
        expect(encrypted1).not.toBe(encrypted2)
        expect(encrypted2).not.toBe(encrypted3)
      })

      it('should handle very large messages near bucket boundaries', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        // Test messages at bucket boundaries
        const boundaries = [
          255, 256, 257,  // Around 256 bucket
          511, 512, 513,  // Around 512 bucket
          1023, 1024, 1025,  // Around 1024 bucket
          2047, 2048, 2049,  // Around 2048 bucket
          4095, 4096, 4097,  // Around 4096 bucket
        ]

        for (const length of boundaries) {
          const message = 'z'.repeat(length)
          const encrypted = encryptNIP44(message, conversationKey)
          const decrypted = decryptNIP44(encrypted, conversationKey)
          expect(decrypted).toBe(message)
        }
      })
    })

    describe('backward compatibility', () => {
      it('should decrypt legacy V1 padded messages', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        // Simulate a V1 formatted message (legacy format)
        // V1 format: \x00PAD\x00 + 3-digit padding length + base64 padding + content
        const originalContent = 'Legacy message content'
        const paddingLength = 32
        const paddingBytes = new Uint8Array(paddingLength)
        crypto.getRandomValues(paddingBytes)
        const paddingBase64 = btoa(String.fromCharCode(...paddingBytes))

        const v1PaddedMessage = `\x00PAD\x00${paddingLength.toString().padStart(3, '0')}${paddingBase64}${originalContent}`

        // Encrypt the V1 padded message directly (simulating old client)
        const encrypted = nip44Raw.v2.encrypt(v1PaddedMessage, conversationKey)

        // Decrypt with current implementation - should handle V1 format
        const decrypted = decryptNIP44(encrypted, conversationKey)
        expect(decrypted).toBe(originalContent)
      })

      it('should handle unpadded messages', () => {
        const alice = generateKeyPair()
        const bob = generateKeyPair()
        const conversationKey = deriveConversationKey(alice.privateKey, bob.publicKey)

        // Simulate an unpadded message (very old client or direct NIP44)
        const originalContent = 'Unpadded message'

        // Encrypt without any padding
        const encrypted = nip44Raw.v2.encrypt(originalContent, conversationKey)

        // Decrypt with current implementation - should return as-is
        const decrypted = decryptNIP44(encrypted, conversationKey)
        expect(decrypted).toBe(originalContent)
      })
    })
  })
})
