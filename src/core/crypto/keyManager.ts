import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import * as nip19 from 'nostr-tools/nip19'
import type { Identity, KeyPair } from '@/types/identity'

/**
 * Generate a new Nostr key pair
 */
export function generateKeyPair(): KeyPair {
  const privateKey = generateSecretKey()
  const publicKey = getPublicKey(privateKey)

  return {
    privateKey,
    publicKey,
  }
}

/**
 * Create a new identity
 */
export function createIdentity(name: string = 'Anonymous'): Identity {
  const { privateKey, publicKey } = generateKeyPair()
  const npub = nip19.npubEncode(publicKey)

  return {
    publicKey,
    npub,
    privateKey,
    name,
    created: Date.now(),
    lastUsed: Date.now(),
  }
}

/**
 * Import identity from nsec (NIP-19 encoded private key)
 */
export function importFromNsec(nsec: string, name: string = 'Imported'): Identity {
  try {
    const decoded = nip19.decode(nsec)

    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format')
    }

    const privateKey = decoded.data as Uint8Array
    const publicKey = getPublicKey(privateKey)
    const npub = nip19.npubEncode(publicKey)

    return {
      publicKey,
      npub,
      privateKey,
      name,
      created: Date.now(),
      lastUsed: Date.now(),
    }
  } catch (error) {
    throw new Error(`Failed to import nsec: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Export private key as nsec
 */
export function exportToNsec(privateKey: Uint8Array): string {
  return nip19.nsecEncode(privateKey)
}

/**
 * Export public key as npub
 */
export function exportToNpub(publicKey: string): string {
  return nip19.npubEncode(publicKey)
}

/**
 * Decode npub to hex public key
 */
export function decodeNpub(npub: string): string {
  const decoded = nip19.decode(npub)

  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format')
  }

  return decoded.data as string
}

/**
 * Convert private key to hex string
 */
export function privateKeyToHex(privateKey: Uint8Array): string {
  return bytesToHex(privateKey)
}

/**
 * Convert hex string to private key
 */
export function hexToPrivateKey(hex: string): Uint8Array {
  return hexToBytes(hex)
}

/**
 * Validate if a string is a valid hex public key
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey)
}

/**
 * Validate if a string is a valid nsec
 */
export function isValidNsec(nsec: string): boolean {
  try {
    const decoded = nip19.decode(nsec)
    return decoded.type === 'nsec'
  } catch {
    return false
  }
}

/**
 * Validate if a string is a valid npub
 */
export function isValidNpub(npub: string): boolean {
  try {
    const decoded = nip19.decode(npub)
    return decoded.type === 'npub'
  } catch {
    return false
  }
}

/**
 * Generate a random passphrase for key encryption
 */
export function generatePassphrase(wordCount: number = 12): string {
  // Simple implementation - in production, use BIP-39 wordlist
  const words = []
  const charset = 'abcdefghijklmnopqrstuvwxyz'

  for (let i = 0; i < wordCount; i++) {
    let word = ''
    for (let j = 0; j < 6; j++) {
      word += charset[Math.floor(Math.random() * charset.length)]
    }
    words.push(word)
  }

  return words.join(' ')
}

/**
 * Key manager class for managing multiple identities
 */
export class KeyManager {
  private identities: Map<string, Identity>

  constructor() {
    this.identities = new Map()
  }

  /**
   * Add an identity to the manager
   */
  addIdentity(identity: Identity): void {
    this.identities.set(identity.publicKey, identity)
  }

  /**
   * Remove an identity
   */
  removeIdentity(publicKey: string): void {
    this.identities.delete(publicKey)
  }

  /**
   * Get an identity by public key
   */
  getIdentity(publicKey: string): Identity | undefined {
    const identity = this.identities.get(publicKey)

    if (identity) {
      // Update last used timestamp
      identity.lastUsed = Date.now()
    }

    return identity
  }

  /**
   * Get all identities
   */
  getAllIdentities(): Identity[] {
    return Array.from(this.identities.values())
  }

  /**
   * Check if an identity exists
   */
  hasIdentity(publicKey: string): boolean {
    return this.identities.has(publicKey)
  }

  /**
   * Clear all identities (use with caution!)
   */
  clear(): void {
    this.identities.clear()
  }

  /**
   * Export all identities as JSON (WARNING: contains private keys!)
   */
  exportAll(): string {
    const identities = Array.from(this.identities.values()).map(id => ({
      ...id,
      privateKey: bytesToHex(id.privateKey),
    }))

    return JSON.stringify(identities, null, 2)
  }

  /**
   * Import identities from JSON export
   */
  importAll(json: string): void {
    try {
      const identities = JSON.parse(json)

      identities.forEach((id: Identity & { privateKey: string }) => {
        this.addIdentity({
          ...id,
          privateKey: hexToBytes(id.privateKey),
        })
      })
    } catch (error) {
      throw new Error(`Failed to import identities: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
