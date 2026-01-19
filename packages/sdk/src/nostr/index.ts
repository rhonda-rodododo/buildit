/**
 * @buildit/sdk - Nostr Module
 *
 * Portable Nostr protocol utilities for event creation and verification.
 */

export {
  // Event creation
  createEvent,
  createEventFromTemplate,
  createTextNote,
  createMetadataEvent,
  createDeletionEvent,
  generateEventId,

  // Event verification
  verifyEventSignature,
  eventMatchesFilter,

  // Key utilities
  derivePublicKey,

  // Tag utilities
  getReferencedEventIds,
  getReferencedPubkeys,

  // Byte conversion
  hexToBytes,
  bytesToHex,

  // Types
  type NostrEvent,
  type EventTemplate,
  type Filter,
} from './events'
