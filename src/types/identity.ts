export interface Identity {
  publicKey: string // hex
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
