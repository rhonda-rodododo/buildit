import { describe, it, expect } from 'vitest'
import { generateKeyPair } from '../keyManager'
import {
  createPrivateDM,
  unwrapGiftWrap,
  createGroupMessage,
  isGiftWrapForRecipient,
} from '../nip17'

describe('NIP-17 Gift Wrap', () => {
  describe('createPrivateDM', () => {
    it('should create a valid gift wrap', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'Private message'

      const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)

      expect(giftWrap.kind).toBe(1059)
      expect(giftWrap.content).toBeTruthy()
      expect(giftWrap.tags).toContainEqual(['p', bob.publicKey])
    })

    it('should use ephemeral key (pubkey should not be sender)', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()

      const giftWrap = createPrivateDM('Test', alice.privateKey, bob.publicKey)

      // Gift wrap should be signed with ephemeral key, not Alice's key
      expect(giftWrap.pubkey).not.toBe(alice.publicKey)
    })
  })

  describe('unwrapGiftWrap', () => {
    it('should decrypt gift wrap and reveal rumor', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'Secret message'

      const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
      const rumor = unwrapGiftWrap(giftWrap, bob.privateKey)

      expect(rumor.kind).toBe(14) // Private DM kind
      expect(rumor.content).toBe(message)
      expect(rumor.tags).toContainEqual(['p', bob.publicKey])
    })

    it('should preserve message content through encryption layers', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const message = 'Test with unicode: 你好 🌍'

      const giftWrap = createPrivateDM(message, alice.privateKey, bob.publicKey)
      const rumor = unwrapGiftWrap(giftWrap, bob.privateKey)

      expect(rumor.content).toBe(message)
    })
  })

  describe('createGroupMessage', () => {
    it('should create multiple gift wraps for each recipient', () => {
      const sender = generateKeyPair()
      const recipients = [
        generateKeyPair().publicKey,
        generateKeyPair().publicKey,
        generateKeyPair().publicKey,
      ]

      const giftWraps = createGroupMessage('Group message', sender.privateKey, recipients)

      expect(giftWraps).toHaveLength(3)
      giftWraps.forEach((gw, index) => {
        expect(gw.tags).toContainEqual(['p', recipients[index]])
      })
    })
  })

  describe('isGiftWrapForRecipient', () => {
    it('should correctly identify intended recipient', () => {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const charlie = generateKeyPair()

      const giftWrap = createPrivateDM('Test', alice.privateKey, bob.publicKey)

      expect(isGiftWrapForRecipient(giftWrap, bob.publicKey)).toBe(true)
      expect(isGiftWrapForRecipient(giftWrap, charlie.publicKey)).toBe(false)
    })
  })
})
