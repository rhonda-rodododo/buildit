import * as nip44 from 'nostr-tools/nip44'

/**
 * Encrypt content using NIP-44 (ChaCha20-Poly1305)
 */
export function encryptNIP44(
  plaintext: string,
  conversationKey: Uint8Array
): string {
  return nip44.v2.encrypt(plaintext, conversationKey)
}

/**
 * Decrypt content using NIP-44
 */
export function decryptNIP44(
  ciphertext: string,
  conversationKey: Uint8Array
): string {
  return nip44.v2.decrypt(ciphertext, conversationKey)
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
