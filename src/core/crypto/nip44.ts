import * as nip44 from 'nostr-tools/nip44'
import { logger } from '@/lib/logger'

/**
 * SECURITY: Application-layer message padding for traffic analysis resistance
 *
 * NIP-44 already pads to powers of 2, but for state-actor threat models,
 * we add additional random padding to:
 * 1. Prevent message type identification by exact size
 * 2. Add entropy to message patterns
 * 3. Make correlation attacks harder
 *
 * Format: [1-byte padding length][random padding bytes][actual content]
 * Max padding: 255 bytes (fits in 1 byte length prefix)
 */
const MIN_PADDING = 16;  // Minimum random padding bytes
const MAX_PADDING = 64;  // Maximum random padding bytes
const PADDING_MARKER = '\x00PAD\x00';  // Marker to identify padded messages

/**
 * Add random padding to plaintext before encryption
 * Uses cryptographically secure randomness
 */
function addRandomPadding(plaintext: string): string {
  // Generate random padding length between MIN and MAX
  const paddingLengthBuffer = new Uint8Array(1);
  crypto.getRandomValues(paddingLengthBuffer);
  const paddingLength = MIN_PADDING + (paddingLengthBuffer[0] % (MAX_PADDING - MIN_PADDING + 1));

  // Generate random padding bytes
  const paddingBytes = new Uint8Array(paddingLength);
  crypto.getRandomValues(paddingBytes);

  // Convert to base64 for safe text transport
  const paddingBase64 = btoa(String.fromCharCode(...paddingBytes));

  // Format: MARKER + length (2 digits, zero-padded) + padding + content
  return `${PADDING_MARKER}${paddingLength.toString().padStart(3, '0')}${paddingBase64}${plaintext}`;
}

/**
 * Remove random padding from decrypted plaintext
 */
function removeRandomPadding(paddedText: string): string {
  // Check for padding marker
  if (!paddedText.startsWith(PADDING_MARKER)) {
    // No padding marker - return as-is (legacy message or unpadded)
    return paddedText;
  }

  // Extract padding length (3 digits after marker)
  const markerEnd = PADDING_MARKER.length;
  const paddingLengthStr = paddedText.slice(markerEnd, markerEnd + 3);
  const paddingLength = parseInt(paddingLengthStr, 10);

  if (isNaN(paddingLength) || paddingLength < 0 || paddingLength > 255) {
    // Invalid padding length - return original (corrupted?)
    logger.warn('Invalid padding length in message');
    return paddedText;
  }

  // Calculate base64 length for the padding (base64 pads to multiple of 4)
  // Formula: ceil(n / 3) * 4 for n input bytes
  const base64Length = Math.ceil(paddingLength / 3) * 4;

  // Skip marker + length + base64 padding to get actual content
  const contentStart = markerEnd + 3 + base64Length;
  return paddedText.slice(contentStart);
}

/**
 * Encrypt content using NIP-44 (ChaCha20-Poly1305)
 * SECURITY: Adds random padding before encryption for traffic analysis resistance
 */
export function encryptNIP44(
  plaintext: string,
  conversationKey: Uint8Array
): string {
  const paddedPlaintext = addRandomPadding(plaintext);
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
  const paddedPlaintext = nip44.v2.decrypt(ciphertext, conversationKey);
  return removeRandomPadding(paddedPlaintext);
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
