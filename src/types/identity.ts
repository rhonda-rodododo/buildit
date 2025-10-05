export interface Identity {
  publicKey: string // hex
  npub: string // bech32-encoded public key
  privateKey: Uint8Array
  name: string
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
