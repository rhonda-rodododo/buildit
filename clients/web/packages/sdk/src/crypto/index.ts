/**
 * @buildit/sdk - Crypto Module
 *
 * Portable cryptographic utilities for Nostr encryption and key management.
 */

export {
  encryptNIP44,
  decryptNIP44,
  deriveConversationKey,
  encryptDM,
  decryptDM,
} from './nip44'

export {
  generateKeypair,
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  deriveKeyFromPhrase,
  importPrivateKey,
  derivePublicKey,
  derivePublicKeyFromHex,
  isValidPublicKey,
  isValidPrivateKey,
  bytesToHex,
  hexToBytes,
} from './keys'
