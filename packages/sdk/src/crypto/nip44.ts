/**
 * NIP-44 Encryption Utilities (Portable)
 *
 * Platform-agnostic implementation of NIP-44 encryption with
 * additional random padding for traffic analysis resistance.
 */

import * as nip44 from 'nostr-tools/nip44'

/**
 * SECURITY: Application-layer message padding for traffic analysis resistance
 *
 * NIP-44 already pads to powers of 2, but for state-actor threat models,
 * we add additional random padding to:
 * 1. Prevent message type identification by exact size
 * 2. Add entropy to message patterns
 * 3. Make correlation attacks harder
 *
 * Format: [marker][3-digit length][base64 padding][actual content]
 * Max padding: 255 bytes (fits in 1 byte length prefix)
 */
const MIN_PADDING = 16
const MAX_PADDING = 64
const PADDING_MARKER = '\x00PAD\x00'

/**
 * Platform-agnostic random bytes generation
 * Works with globalThis.crypto (browser, Node 20+, React Native with polyfill)
 */
function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // SECURITY: Never use Math.random() for cryptographic operations
    // Throw error instead of silently using insecure random
    throw new Error('@buildit/sdk: crypto.getRandomValues not available. Add a secure polyfill.')
  }
  return bytes
}

/**
 * Platform-agnostic base64 encoding
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    return btoa(String.fromCharCode(...bytes))
  }
  // Node.js / React Native fallback
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  // Manual fallback (should add proper polyfill)
  throw new Error('@buildit/sdk: No base64 encoder available')
}

/**
 * Add random padding to plaintext before encryption
 * Uses cryptographically secure randomness
 */
function addRandomPadding(plaintext: string): string {
  const paddingLengthBuffer = getRandomBytes(1)
  const paddingLength = MIN_PADDING + (paddingLengthBuffer[0] % (MAX_PADDING - MIN_PADDING + 1))
  const paddingBytes = getRandomBytes(paddingLength)
  const paddingBase64 = uint8ArrayToBase64(paddingBytes)
  return `${PADDING_MARKER}${paddingLength.toString().padStart(3, '0')}${paddingBase64}${plaintext}`
}

/**
 * Remove random padding from decrypted plaintext
 */
function removeRandomPadding(paddedText: string): string {
  if (!paddedText.startsWith(PADDING_MARKER)) {
    return paddedText // No padding marker - return as-is (legacy message)
  }

  const markerEnd = PADDING_MARKER.length
  const paddingLengthStr = paddedText.slice(markerEnd, markerEnd + 3)
  const paddingLength = parseInt(paddingLengthStr, 10)

  if (isNaN(paddingLength) || paddingLength < 0 || paddingLength > 255) {
    return paddedText // Invalid padding - return original
  }

  const base64Length = Math.ceil(paddingLength / 3) * 4
  const contentStart = markerEnd + 3 + base64Length
  return paddedText.slice(contentStart)
}

/**
 * Encrypt content using NIP-44 (ChaCha20-Poly1305)
 * SECURITY: Adds random padding before encryption for traffic analysis resistance
 */
export function encryptNIP44(
  plaintext: string,
  conversationKey: Uint8Array
): string {
  const paddedPlaintext = addRandomPadding(plaintext)
  return nip44.v2.encrypt(paddedPlaintext, conversationKey)
}

/**
 * Decrypt content using NIP-44
 * SECURITY: Removes random padding after decryption
 */
export function decryptNIP44(
  ciphertext: string,
  conversationKey: Uint8Array
): string {
  const paddedPlaintext = nip44.v2.decrypt(ciphertext, conversationKey)
  return removeRandomPadding(paddedPlaintext)
}

/**
 * Derive conversation key from private key and recipient public key
 */
export function deriveConversationKey(
  privateKey: Uint8Array,
  recipientPubkey: string
): Uint8Array {
  return nip44.v2.utils.getConversationKey(privateKey, recipientPubkey)
}

/**
 * Encrypt DM content for a specific recipient
 */
export function encryptDM(
  content: string,
  senderPrivateKey: Uint8Array,
  recipientPubkey: string
): string {
  const conversationKey = deriveConversationKey(senderPrivateKey, recipientPubkey)
  return encryptNIP44(content, conversationKey)
}

/**
 * Decrypt DM content from a sender
 */
export function decryptDM(
  ciphertext: string,
  recipientPrivateKey: Uint8Array,
  senderPubkey: string
): string {
  const conversationKey = deriveConversationKey(recipientPrivateKey, senderPubkey)
  return decryptNIP44(ciphertext, conversationKey)
}
