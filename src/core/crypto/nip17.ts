import { finalizeEvent, generateSecretKey } from 'nostr-tools'
import { encryptNIP44, decryptNIP44, deriveConversationKey } from './nip44'
import type { Rumor, Seal, GiftWrap } from '@/types/nostr'

/**
 * Generate a cryptographically secure random integer in range [0, max)
 * Uses crypto.getRandomValues() for security-critical randomness
 */
function secureRandomInt(max: number): number {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  // Use rejection sampling to avoid modulo bias
  const maxValid = Math.floor(0xFFFFFFFF / max) * max
  if (randomBuffer[0] >= maxValid) {
    // Extremely rare - retry
    return secureRandomInt(max)
  }
  return randomBuffer[0] % max
}

/**
 * Randomize timestamp within a 2-day window for metadata protection
 * As per NIP-17 spec
 * Uses crypto.getRandomValues() to prevent timing correlation attacks
 */
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = secureRandomInt(twoDaysInSeconds) - Math.floor(twoDaysInSeconds / 2)
  return Math.floor(baseTime / 1000) + randomOffset
}

/**
 * Create an unsigned rumor event (step 1 of NIP-17)
 */
export function createRumor(
  kind: number,
  content: string,
  recipientPubkey: string,
  tags: string[][] = []
): Rumor {
  return {
    kind,
    content,
    created_at: randomizeTimestamp(),
    tags: [['p', recipientPubkey], ...tags],
  }
}

/**
 * Create a seal event (step 2 of NIP-17)
 * Seals the rumor with sender's key
 */
export function createSeal(
  rumor: Rumor,
  senderPrivateKey: Uint8Array
): Seal {
  // Encrypt the rumor
  const conversationKey = deriveConversationKey(senderPrivateKey, rumor.tags.find(t => t[0] === 'p')?.[1] || '')
  const encryptedContent = encryptNIP44(JSON.stringify(rumor), conversationKey)

  // Create and sign the seal
  const sealTemplate = {
    kind: 13,
    content: encryptedContent,
    created_at: randomizeTimestamp(),
    tags: [],
  }

  return finalizeEvent(sealTemplate, senderPrivateKey) as Seal
}

/**
 * Create a gift wrap event (step 3 of NIP-17)
 * Wraps the seal for the recipient using an ephemeral key
 */
export function createGiftWrap(
  seal: Seal,
  recipientPubkey: string
): GiftWrap {
  // Generate ephemeral key for anonymity
  const ephemeralPrivateKey = generateSecretKey()

  // Encrypt the seal for the recipient
  const conversationKey = deriveConversationKey(ephemeralPrivateKey, recipientPubkey)
  const encryptedContent = encryptNIP44(JSON.stringify(seal), conversationKey)

  // Create and sign the gift wrap
  const giftWrapTemplate = {
    kind: 1059,
    content: encryptedContent,
    created_at: randomizeTimestamp(),
    tags: [['p', recipientPubkey]],
  }

  return finalizeEvent(giftWrapTemplate, ephemeralPrivateKey) as GiftWrap
}

/**
 * Create a complete NIP-17 private DM
 * Returns a gift-wrapped event ready to publish
 */
export function createPrivateDM(
  content: string,
  senderPrivateKey: Uint8Array,
  recipientPubkey: string,
  tags: string[][] = []
): GiftWrap {
  // Step 1: Create rumor
  const rumor = createRumor(14, content, recipientPubkey, tags)

  // Step 2: Create seal
  const seal = createSeal(rumor, senderPrivateKey)

  // Step 3: Create gift wrap
  const giftWrap = createGiftWrap(seal, recipientPubkey)

  return giftWrap
}

/**
 * Unwrap and decrypt a NIP-17 gift wrap
 */
export function unwrapGiftWrap(
  giftWrap: GiftWrap,
  recipientPrivateKey: Uint8Array
): Rumor {
  // Decrypt the seal using the ephemeral key in the gift wrap
  const conversationKey = deriveConversationKey(recipientPrivateKey, giftWrap.pubkey)
  const sealJson = decryptNIP44(giftWrap.content, conversationKey)
  const seal: Seal = JSON.parse(sealJson)

  // Decrypt the rumor from the seal
  const rumorConversationKey = deriveConversationKey(recipientPrivateKey, seal.pubkey)
  const rumorJson = decryptNIP44(seal.content, rumorConversationKey)
  const rumor: Rumor = JSON.parse(rumorJson)

  return rumor
}

/**
 * Create multiple gift wraps for group messaging
 * Each member gets their own encrypted copy
 */
export function createGroupMessage(
  content: string,
  senderPrivateKey: Uint8Array,
  recipientPubkeys: string[],
  tags: string[][] = []
): GiftWrap[] {
  return recipientPubkeys.map(recipientPubkey =>
    createPrivateDM(content, senderPrivateKey, recipientPubkey, tags)
  )
}

/**
 * Verify if a gift wrap is intended for a specific recipient
 */
export function isGiftWrapForRecipient(
  giftWrap: GiftWrap,
  recipientPubkey: string
): boolean {
  return giftWrap.tags.some(tag => tag[0] === 'p' && tag[1] === recipientPubkey)
}
