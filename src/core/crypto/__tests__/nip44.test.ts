import { describe, it, expect } from 'vitest'
import { generateKeyPair } from '../keyManager'
import {
  encryptDM,
  decryptDM,
  deriveConversationKey,
} from '../nip44'

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
})
