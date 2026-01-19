/**
 * @buildit/sdk
 *
 * BuildIt Network SDK - Portable business logic for web and native.
 *
 * This package provides platform-agnostic utilities for:
 * - Nostr protocol (event creation, verification)
 * - Encryption (NIP-44, NIP-17)
 * - Key management (generation, derivation, recovery)
 * - Shared type definitions
 *
 * Usage:
 *   import { createTextNote, encryptDM } from '@buildit/sdk'
 *   import { generateKeypair } from '@buildit/sdk/crypto'
 *   import type { NostrIdentity } from '@buildit/sdk/types'
 */

// Re-export everything for convenience
export * from './crypto'
export * from './nostr'
export * from './types'

// Named exports for tree-shaking
export {
  // Crypto
  encryptNIP44,
  decryptNIP44,
  deriveConversationKey,
  encryptDM,
  decryptDM,
  generateKeypair,
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  deriveKeyFromPhrase,
  importPrivateKey,
  isValidPublicKey,
  isValidPrivateKey,
} from './crypto'

export {
  // Nostr
  createEvent,
  createEventFromTemplate,
  createTextNote,
  createMetadataEvent,
  createDeletionEvent,
  verifyEventSignature,
  eventMatchesFilter,
  derivePublicKey,
  getReferencedEventIds,
  getReferencedPubkeys,
  hexToBytes,
  bytesToHex,
} from './nostr'
