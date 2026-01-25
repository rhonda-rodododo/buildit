export interface Identity {
  publicKey: string // hex
  npub: string // bech32-encoded public key
  privateKey: Uint8Array
  name: string
  username?: string // Human-readable username (e.g., "alice-organizer")
  displayName?: string // Display name (e.g., "Alice Martinez")
  nip05?: string // Verified identifier (alice@domain.com)
  nip05Verified?: boolean // NIP-05 verification status
  created: number
  lastUsed: number
}

export interface KeyPair {
  publicKey: string
  privateKey: Uint8Array
}

export interface EncryptedIdentity {
  publicKey: string
  encryptedPrivateKey: string // encrypted with password
  name: string
  created: number
  lastUsed: number
}
