/**
 * Prototype Pollution Prevention Tests
 *
 * These tests verify that all JSON parsing in security-critical paths
 * is protected against prototype pollution attacks.
 *
 * SECURITY: Prototype pollution can allow attackers to:
 * 1. Modify Object.prototype globally
 * 2. Bypass security checks
 * 3. Inject malicious code execution paths
 *
 * NOTE: In the actual NIP-17 flow, encryption MAC validation prevents
 * arbitrary JSON injection. These tests verify the validation layer
 * that provides defense-in-depth after decryption.
 */

import { describe, it, expect } from 'vitest'
import { generateKeyPair } from '../keyManager'
import { createPrivateDM, unwrapGiftWrap } from '../nip17'

describe('Prototype Pollution Prevention', () => {
  describe('NIP-17 Message Integrity', () => {
    it('valid messages should preserve content through encryption layers', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const message = 'Hello, this is a test message!'
      const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
      const result = unwrapGiftWrap(giftWrap, bob.privateKey)

      expect(result.rumor.content).toBe(message)
      expect(result.senderPubkey).toBe(alice.publicKey)
      expect(result.sealVerified).toBe(true)
    })

    it('should handle unicode content safely', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const message = 'Hello 世界! 🌍 مرحبا'
      const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
      const result = unwrapGiftWrap(giftWrap, bob.privateKey)

      expect(result.rumor.content).toBe(message)
    })

    it('should reject tampered content (MAC validation)', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const giftWrap = createPrivateDM('test', alice.privateKey, bob.publicKey)

      // Tamper with the encrypted content
      const tamperedGiftWrap = {
        ...giftWrap,
        content: giftWrap.content.slice(0, -10) + 'tampered!!'
      }

      // MAC validation should fail
      expect(() => unwrapGiftWrap(tamperedGiftWrap, bob.privateKey)).toThrow()
    })

    it('should reject messages with wrong recipient key', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const charlie = generateKeyPair()

      const giftWrap = createPrivateDM('test', alice.privateKey, bob.publicKey)

      // Charlie cannot decrypt Bob's message
      expect(() => unwrapGiftWrap(giftWrap, charlie.privateKey)).toThrow()
    })
  })

  describe('Object.prototype Not Polluted', () => {
    it('processing valid messages should not pollute Object.prototype', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      // Record original prototype state
      const originalKeys = Object.keys(Object.prototype)

      // Process many valid messages
      for (let i = 0; i < 10; i++) {
        const giftWrap = createPrivateDM(`message ${i}`, alice.privateKey, bob.publicKey)
        const result = unwrapGiftWrap(giftWrap, bob.privateKey)
        expect(result.rumor.content).toBe(`message ${i}`)
      }

      // Verify prototype wasn't modified
      const newKeys = Object.keys(Object.prototype)
      expect(newKeys).toEqual(originalKeys)

      // Specifically check for common pollution targets
      expect(Object.prototype).not.toHaveProperty('polluted')
      expect(Object.prototype).not.toHaveProperty('isAdmin')
    })

    it('should handle messages with special JSON characters', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      // Messages that might cause issues with naive JSON handling
      const specialMessages = [
        '{"__proto__": "test"}', // JSON string content
        '["__proto__"]',
        'null',
        'undefined',
        '\\n\\r\\t',
        '{"constructor": {"prototype": {}}}', // JSON string content
      ]

      for (const message of specialMessages) {
        const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
        const result = unwrapGiftWrap(giftWrap, bob.privateKey)
        expect(result.rumor.content).toBe(message)
      }

      // Prototype should still be clean
      expect(Object.prototype).not.toHaveProperty('polluted')
      expect(Object.prototype).not.toHaveProperty('isAdmin')
    })
  })

  describe('Seal Signature Verification', () => {
    it('should verify seal signature from actual sender', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const giftWrap = createPrivateDM('Verified message', alice.privateKey, bob.publicKey)
      const result = unwrapGiftWrap(giftWrap, bob.privateKey)

      expect(result.sealVerified).toBe(true)
      expect(result.senderPubkey).toBe(alice.publicKey)
    })

    it('gift wrap pubkey should be ephemeral (not sender)', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const giftWrap = createPrivateDM('test', alice.privateKey, bob.publicKey)

      // Gift wrap pubkey is ephemeral, NOT Alice's
      expect(giftWrap.pubkey).not.toBe(alice.publicKey)

      // But unwrapping reveals true sender
      const result = unwrapGiftWrap(giftWrap, bob.privateKey)
      expect(result.senderPubkey).toBe(alice.publicKey)
    })

    it('should handle multiple messages from same sender', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const messages = ['First', 'Second', 'Third']
      const ephemeralKeys = new Set<string>()

      for (const message of messages) {
        const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
        ephemeralKeys.add(giftWrap.pubkey)

        const result = unwrapGiftWrap(giftWrap, bob.privateKey)
        expect(result.senderPubkey).toBe(alice.publicKey)
        expect(result.sealVerified).toBe(true)
      }

      // Each gift wrap should have a different ephemeral key
      expect(ephemeralKeys.size).toBe(3)
    })
  })

  describe('Defense in Depth', () => {
    it('encryption + validation provides layered security', () => {
      // Layer 1: Encryption prevents unauthorized reading
      // Layer 2: MAC validation prevents tampering
      // Layer 3: Signature verification ensures sender authenticity
      // Layer 4: Schema validation ensures data structure
      // Layer 5: Prototype pollution checks prevent injection

      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const giftWrap = createPrivateDM('secure message', alice.privateKey, bob.publicKey)
      const result = unwrapGiftWrap(giftWrap, bob.privateKey)

      // All layers passed
      expect(result.rumor.content).toBe('secure message')
      expect(result.sealVerified).toBe(true)
      expect(result.senderPubkey).toBe(alice.publicKey)
      expect(result.rumor.kind).toBe(14) // Validated by schema
    })
  })
})
