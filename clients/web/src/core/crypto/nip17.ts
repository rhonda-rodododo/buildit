import { finalizeEvent, generateSecretKey, verifyEvent } from 'nostr-tools'
import { hexToBytes } from '@noble/hashes/utils'
import { encryptNIP44, decryptNIP44, deriveConversationKey } from './nip44'
import { z } from 'zod'
import type { Rumor, Seal, GiftWrap } from '@/types/nostr'
import { logger } from '@/lib/logger'

/**
 * Normalize a private key to Uint8Array.
 * Accepts either a Uint8Array or a hex-encoded string.
 */
function normalizePrivateKey(key: Uint8Array | string): Uint8Array {
  if (typeof key === 'string') {
    return hexToBytes(key)
  }
  return key
}

/**
 * SECURITY: Zod schemas for validating decrypted NIP-17 content
 *
 * These schemas provide defense-in-depth against:
 * 1. Malformed JSON that passes decryption but causes processing errors
 * 2. Injection attacks via unexpected field types
 * 3. Object prototype pollution via __proto__ or constructor
 */

// Schema for validating Rumor (decrypted inner message)
// Uses passthrough() to allow _v and other protocol fields through validation
const LocalRumorSchema = z.object({
  _v: z.string().default('1.0.0'),
  kind: z.number().int().nonnegative(),
  content: z.string(),
  created_at: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
}).passthrough()

// Schema for validating Seal (signed wrapper)
// Uses passthrough() to allow _v and other protocol fields through validation
const LocalSealSchema = z.object({
  _v: z.string().default('1.0.0'),
  kind: z.literal(13), // Seal kind
  content: z.string(),
  created_at: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
  id: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid event ID format'),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid pubkey format'),
  sig: z.string().regex(/^[0-9a-f]{128}$/, 'Invalid signature format'),
}).passthrough()

/**
 * SECURITY: Check for prototype pollution attempts in parsed JSON
 *
 * Prototype pollution occurs when attacker-controlled JSON contains
 * __proto__, constructor.prototype, or similar properties that could
 * modify Object.prototype when assigned.
 *
 * We check if these dangerous keys have non-function values, as
 * legitimate JSON shouldn't set these to objects.
 */
function checkPrototypePollution(obj: unknown, path: string = ''): void {
  if (typeof obj !== 'object' || obj === null) {
    return
  }

  // Check if this is an array
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => checkPrototypePollution(item, `${path}[${index}]`))
    return
  }

  // Check for dangerous keys at this level
  const record = obj as Record<string, unknown>

  // __proto__ should never be in JSON
  if (Object.prototype.hasOwnProperty.call(record, '__proto__')) {
    throw new Error(`SECURITY: Prototype pollution attempt detected via __proto__ at ${path}`)
  }

  // prototype property with object value is suspicious
  if (Object.prototype.hasOwnProperty.call(record, 'prototype') && typeof record['prototype'] === 'object') {
    throw new Error(`SECURITY: Prototype pollution attempt detected via prototype at ${path}`)
  }

  // Recursively check nested objects
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'object' && value !== null) {
      checkPrototypePollution(value, path ? `${path}.${key}` : key)
    }
  }
}

/**
 * SECURITY: Safe JSON parse with schema validation
 * Prevents prototype pollution and validates structure
 */
function safeJsonParse<T>(json: string, schema: z.ZodSchema<T>, name: string): T {
  let parsed: unknown

  try {
    // First, parse JSON
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error(`SECURITY: Failed to parse ${name} JSON: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
  }

  // Check for prototype pollution attempts
  checkPrototypePollution(parsed, name)

  // Validate against schema
  const result = schema.safeParse(parsed)
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`SECURITY: ${name} validation failed: ${errors}`)
  }

  return result.data
}

/**
 * Result of unwrapping a gift wrap, including sender identity
 */
export interface UnwrappedMessage {
  rumor: Rumor;
  senderPubkey: string; // The actual sender (from seal.pubkey)
  sealVerified: boolean; // Whether the seal signature verified
}

/**
 * Generate a cryptographically secure random integer in range [0, max)
 * Uses crypto.getRandomValues() for security-critical randomness
 */
export function secureRandomInt(max: number): number {
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
 * As per NIP-17 spec: random timestamp up to 2 days in the PAST only.
 * Never produces future timestamps, which relays reject as "created_at too late".
 * Uses crypto.getRandomValues() to prevent timing correlation attacks.
 */
export function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = secureRandomInt(twoDaysInSeconds)
  return Math.floor(baseTime / 1000) - randomOffset
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
    _v: '1.0.0',
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
  senderPrivateKey: Uint8Array | string
): Seal {
  const privKeyBytes = normalizePrivateKey(senderPrivateKey)

  // Encrypt the rumor
  const conversationKey = deriveConversationKey(privKeyBytes, rumor.tags.find(t => t[0] === 'p')?.[1] || '')
  const encryptedContent = encryptNIP44(JSON.stringify(rumor), conversationKey)

  // Create and sign the seal
  const sealTemplate = {
    kind: 13,
    content: encryptedContent,
    created_at: randomizeTimestamp(),
    tags: [],
  }

  return finalizeEvent(sealTemplate, privKeyBytes) as unknown as Seal
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

  return finalizeEvent(giftWrapTemplate, ephemeralPrivateKey) as unknown as GiftWrap
}

/**
 * Create a complete NIP-17 private DM
 * Returns a gift-wrapped event ready to publish
 */
export function createPrivateDM(
  content: string,
  senderPrivateKey: Uint8Array | string,
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
 *
 * SECURITY: This function now returns the full UnwrappedMessage including:
 * - The actual sender's pubkey (from seal.pubkey, NOT giftWrap.pubkey)
 * - Verification status of the seal signature
 *
 * The giftWrap.pubkey is an ephemeral key and MUST NOT be trusted as sender identity.
 *
 * SECURITY: Uses schema validation on decrypted content to prevent:
 * - Malformed JSON injection
 * - Prototype pollution attacks
 * - Type confusion attacks
 */
export function unwrapGiftWrap(
  giftWrap: GiftWrap,
  recipientPrivateKey: Uint8Array | string
): UnwrappedMessage {
  const privKeyBytes = normalizePrivateKey(recipientPrivateKey)

  // Decrypt the seal using the ephemeral key in the gift wrap
  const conversationKey = deriveConversationKey(privKeyBytes, giftWrap.pubkey)
  const sealJson = decryptNIP44(giftWrap.content, conversationKey)
  // SECURITY: Validate decrypted seal against schema
  const seal = safeJsonParse<Seal>(sealJson, LocalSealSchema, 'Seal')

  // SECURITY: Verify the seal's signature to ensure sender authenticity
  // The seal.pubkey is the ACTUAL sender, and we must verify they signed it
  let sealVerified = false
  try {
    sealVerified = verifyEvent(seal)
  } catch (error) {
    logger.warn('Seal signature verification failed:', error)
    sealVerified = false
  }

  // Decrypt the rumor from the seal
  const rumorConversationKey = deriveConversationKey(privKeyBytes, seal.pubkey)
  const rumorJson = decryptNIP44(seal.content, rumorConversationKey)
  // SECURITY: Validate decrypted rumor against schema
  const rumor = safeJsonParse<Rumor>(rumorJson, LocalRumorSchema, 'Rumor')

  return {
    rumor,
    senderPubkey: seal.pubkey, // The ACTUAL sender identity
    sealVerified,
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use unwrapGiftWrap which returns full UnwrappedMessage
 */
export function unwrapGiftWrapLegacy(
  giftWrap: GiftWrap,
  recipientPrivateKey: Uint8Array | string
): Rumor {
  const result = unwrapGiftWrap(giftWrap, recipientPrivateKey)
  return result.rumor
}

/**
 * Create multiple gift wraps for group messaging
 * Each member gets their own encrypted copy
 */
export function createGroupMessage(
  content: string,
  senderPrivateKey: Uint8Array | string,
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
