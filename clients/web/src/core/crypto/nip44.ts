import * as nip44 from 'nostr-tools/nip44'
import { logger } from '@/lib/logger'

/**
 * SECURITY: Application-layer message padding for traffic analysis resistance
 *
 * NIP-44 already pads to powers of 2, but for state-actor threat models,
 * we add additional padding to fixed bucket sizes to:
 * 1. Prevent message type identification by exact size
 * 2. Add entropy to message patterns
 * 3. Make correlation attacks harder
 * 4. Ensure all messages fit into predictable size categories
 *
 * Fixed bucket sizes prevent traffic analysis by making all messages
 * appear to be one of a small number of standard sizes.
 *
 * Version 1 (legacy): Random padding 16-64 bytes
 * Format: \x00PAD\x00 + 3-digit length + base64 padding + content
 *
 * Version 2 (current): Fixed bucket padding
 * Format: \x00PADv2\x00 + 5-digit content length + content + random padding to bucket size
 */

// Fixed bucket sizes for traffic analysis resistance
// Messages are padded to the smallest bucket that fits
// Note: NIP-44 has a max plaintext size of 65535 bytes, so we cap at 65000 to leave room for headers
export const BUCKET_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65000] as const;
export type BucketSize = typeof BUCKET_SIZES[number];

// Padding markers for version detection
const PADDING_MARKER_V1 = '\x00PAD\x00';     // Legacy format
const PADDING_MARKER_V2 = '\x00PADv2\x00';   // Fixed bucket format

// V2 header overhead: marker (7) + content length (5) = 12 bytes
// Marker is \x00PADv2\x00 which is 7 characters
const V2_HEADER_SIZE = PADDING_MARKER_V2.length + 5;

// Padding character set - printable ASCII for safe transport
// Using alphanumeric chars to avoid issues with special characters
const PADDING_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Find the smallest bucket size that can fit the given content length
 * @param contentLength - The length of the content (including header overhead)
 * @returns The bucket size to use
 */
export function findBucketSize(contentLength: number): BucketSize {
  for (const bucket of BUCKET_SIZES) {
    if (contentLength <= bucket) {
      return bucket;
    }
  }
  // If content exceeds largest bucket, use largest bucket
  // (message will overflow but this is extremely rare)
  return BUCKET_SIZES[BUCKET_SIZES.length - 1];
}

/**
 * Generate random padding string of specified length
 * Uses cryptographically secure randomness
 */
function generateRandomPadding(length: number): string {
  if (length <= 0) return '';

  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Convert to random characters from our safe character set
  let padding = '';
  for (let i = 0; i < length; i++) {
    padding += PADDING_CHARS[randomBytes[i] % PADDING_CHARS.length];
  }
  return padding;
}

/**
 * Add fixed-bucket padding to plaintext before encryption (V2 format)
 * Uses cryptographically secure randomness for padding bytes
 *
 * Format: MARKER_V2 + content_length (5 digits) + content + random_padding
 * Total size is padded to the smallest bucket that fits
 */
function addRandomPadding(plaintext: string): string {
  // Calculate total size needed: header + content
  const totalContentSize = V2_HEADER_SIZE + plaintext.length;

  // Find the appropriate bucket size
  const bucketSize = findBucketSize(totalContentSize);

  // Calculate padding needed to fill the bucket
  const paddingNeeded = bucketSize - totalContentSize;

  // Generate random padding characters (1 byte = 1 char)
  const padding = generateRandomPadding(paddingNeeded);

  // Format: MARKER_V2 + content length (5 digits, zero-padded) + content + padding
  // Note: We store original content length so we can extract it exactly
  return `${PADDING_MARKER_V2}${plaintext.length.toString().padStart(5, '0')}${plaintext}${padding}`;
}

/**
 * Remove padding from decrypted plaintext
 * Handles both V1 (legacy) and V2 (fixed bucket) formats
 */
function removeRandomPadding(paddedText: string): string {
  // Check for V2 padding marker (fixed bucket format)
  if (paddedText.startsWith(PADDING_MARKER_V2)) {
    return removeV2Padding(paddedText);
  }

  // Check for V1 padding marker (legacy format)
  if (paddedText.startsWith(PADDING_MARKER_V1)) {
    return removeV1Padding(paddedText);
  }

  // No padding marker - return as-is (unpadded legacy message)
  return paddedText;
}

/**
 * Remove V2 fixed-bucket padding
 */
function removeV2Padding(paddedText: string): string {
  const markerEnd = PADDING_MARKER_V2.length;

  // Extract content length (5 digits after marker)
  const contentLengthStr = paddedText.slice(markerEnd, markerEnd + 5);
  const contentLength = parseInt(contentLengthStr, 10);

  if (isNaN(contentLength) || contentLength < 0 || contentLength > 65536) {
    logger.warn('Invalid content length in V2 padded message');
    return paddedText;
  }

  // Extract content (starts after marker + length field)
  const contentStart = markerEnd + 5;
  const contentEnd = contentStart + contentLength;

  return paddedText.slice(contentStart, contentEnd);
}

/**
 * Remove V1 legacy padding (backward compatibility)
 */
function removeV1Padding(paddedText: string): string {
  const markerEnd = PADDING_MARKER_V1.length;

  // Extract padding length (3 digits after marker)
  const paddingLengthStr = paddedText.slice(markerEnd, markerEnd + 3);
  const paddingLength = parseInt(paddingLengthStr, 10);

  if (isNaN(paddingLength) || paddingLength < 0 || paddingLength > 255) {
    logger.warn('Invalid padding length in V1 message');
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
 * Calculate the padded message size for a given plaintext
 * Useful for testing and verification
 */
export function calculatePaddedSize(plaintext: string): number {
  const totalContentSize = V2_HEADER_SIZE + plaintext.length;
  return findBucketSize(totalContentSize);
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
 * Derive conversation key from private key and recipient public key
 */
export function deriveConversationKey(
  privateKey: Uint8Array | string,
  recipientPubkey: string
): Uint8Array {
  return nip44.v2.utils.getConversationKey(normalizePrivateKey(privateKey), recipientPubkey)
}

/**
 * Encrypt DM content for a specific recipient
 */
export function encryptDM(
  content: string,
  senderPrivateKey: Uint8Array | string,
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
  recipientPrivateKey: Uint8Array | string,
  senderPubkey: string
): string {
  const conversationKey = deriveConversationKey(recipientPrivateKey, senderPubkey)
  return decryptNIP44(ciphertext, conversationKey)
}

/**
 * Derive a call-specific encryption key using HKDF
 * Uses the NIP-44 conversation key as input key material
 *
 * @param localPrivkey - Local private key (hex string)
 * @param remotePubkey - Remote public key (hex string)
 * @param callId - Unique call identifier (used as salt)
 * @returns 32-byte key suitable for AES-256-GCM
 */
export async function deriveCallKey(
  localPrivkey: string,
  remotePubkey: string,
  callId: string
): Promise<Uint8Array> {
  // Convert hex private key to Uint8Array
  const privkeyBytes = hexToBytes(localPrivkey);

  // Get the NIP-44 conversation key as input key material
  const conversationKey = deriveConversationKey(privkeyBytes, remotePubkey);

  // Use HKDF to derive a call-specific key
  // Import conversation key as HKDF input
  // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
  const conversationKeyBuffer = conversationKey.buffer.slice(
    conversationKey.byteOffset,
    conversationKey.byteOffset + conversationKey.byteLength
  ) as ArrayBuffer;

  const baseKey = await crypto.subtle.importKey(
    'raw',
    conversationKeyBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive 256 bits (32 bytes) for AES-256-GCM
  const salt = new TextEncoder().encode(callId);
  const info = new TextEncoder().encode('buildit-call-e2ee-v1');

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: info.buffer as ArrayBuffer,
    },
    baseKey,
    256 // bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
