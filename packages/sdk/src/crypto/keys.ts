/**
 * Key Management Utilities (Portable)
 *
 * Platform-agnostic key derivation and management.
 * NOTE: Key storage is platform-specific and should be handled separately.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '../nostr/events'

export { bytesToHex, hexToBytes }

/**
 * Generate a new random Nostr keypair
 */
export function generateKeypair(): {
  privateKey: Uint8Array
  publicKey: string
  privateKeyHex: string
} {
  const privateKey = generateSecretKey()
  const publicKey = getPublicKey(privateKey)
  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
  }
}

/**
 * Generate a BIP-39 recovery phrase (mnemonic)
 * @param strength - 128 for 12 words, 256 for 24 words
 */
export function generateRecoveryPhrase(strength: 128 | 256 = 128): string {
  return bip39.generateMnemonic(wordlist, strength)
}

/**
 * Validate a BIP-39 recovery phrase
 */
export function validateRecoveryPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase, wordlist)
}

/**
 * Derive a Nostr private key from a recovery phrase
 * Uses deterministic derivation for consistent results.
 *
 * Note: This is a simplified derivation. For full BIP-32/44 compliance,
 * use a proper HD wallet library.
 */
export function deriveKeyFromPhrase(phrase: string): {
  privateKey: Uint8Array
  publicKey: string
  privateKeyHex: string
} {
  if (!validateRecoveryPhrase(phrase)) {
    throw new Error('Invalid recovery phrase')
  }

  // Convert mnemonic to seed (512 bits)
  const seed = bip39.mnemonicToSeedSync(phrase)

  // Derive a 32-byte key using SHA-256 of the seed
  // This is a simplified approach - production should use BIP-32
  const privateKey = sha256(seed.slice(0, 32))

  const publicKey = getPublicKey(privateKey)

  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
  }
}

/**
 * Import a private key from hex string
 */
export function importPrivateKey(hexKey: string): {
  privateKey: Uint8Array
  publicKey: string
  privateKeyHex: string
} {
  const cleanHex = hexKey.toLowerCase().replace(/^0x/, '').trim()

  if (cleanHex.length !== 64) {
    throw new Error('Invalid private key length (must be 32 bytes / 64 hex chars)')
  }

  if (!/^[0-9a-f]+$/.test(cleanHex)) {
    throw new Error('Invalid hex characters in private key')
  }

  const privateKey = hexToBytes(cleanHex)
  const publicKey = getPublicKey(privateKey)

  return {
    privateKey,
    publicKey,
    privateKeyHex: cleanHex,
  }
}

/**
 * Derive public key from private key
 */
export function derivePublicKey(privateKey: Uint8Array): string {
  return getPublicKey(privateKey)
}

/**
 * Derive public key from hex private key
 */
export function derivePublicKeyFromHex(privateKeyHex: string): string {
  const privateKey = hexToBytes(privateKeyHex)
  return getPublicKey(privateKey)
}

/**
 * Check if a string is a valid hex public key
 */
export function isValidPublicKey(key: string): boolean {
  const cleanKey = key.toLowerCase().replace(/^0x/, '').trim()
  return cleanKey.length === 64 && /^[0-9a-f]+$/.test(cleanKey)
}

/**
 * Check if a string is a valid hex private key
 */
export function isValidPrivateKey(key: string): boolean {
  const cleanKey = key.toLowerCase().replace(/^0x/, '').trim()
  return cleanKey.length === 64 && /^[0-9a-f]+$/.test(cleanKey)
}
