/**
 * Nostr Event Utilities (Portable)
 *
 * Platform-agnostic implementation of Nostr event creation and verification.
 */

import {
  finalizeEvent,
  verifyEvent,
  type Event as NostrEvent,
  type EventTemplate,
  type Filter,
} from 'nostr-tools'
import { getPublicKey } from 'nostr-tools/pure'

export type { NostrEvent, EventTemplate, Filter }

/**
 * Platform-agnostic UUID generation
 */
function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  // Fallback UUID v4 implementation
  const bytes = new Uint8Array(16)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  // Set version (4) and variant (10xx)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a unique event ID (for internal tracking, not Nostr event ID)
 */
export function generateEventId(): string {
  return generateUUID()
}

/**
 * Create and sign a Nostr event
 */
export function createEvent(
  kind: number,
  content: string,
  tags: string[][],
  privateKey: string
): NostrEvent {
  const template: EventTemplate = {
    kind,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  }
  const privKeyBytes = hexToBytes(privateKey)
  return finalizeEvent(template, privKeyBytes)
}

/**
 * Create and sign a Nostr event from template
 */
export function createEventFromTemplate(
  template: EventTemplate,
  privateKey: Uint8Array
): NostrEvent {
  return finalizeEvent(template, privateKey)
}

/**
 * Verify a Nostr event signature
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  return verifyEvent(event)
}

/**
 * Get public key from private key
 */
export function derivePublicKey(privateKey: Uint8Array): string {
  return getPublicKey(privateKey)
}

/**
 * Create a text note event (kind 1)
 */
export function createTextNote(
  content: string,
  privateKey: Uint8Array,
  tags: string[][] = []
): NostrEvent {
  return createEventFromTemplate(
    {
      kind: 1,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    },
    privateKey
  )
}

/**
 * Create a metadata event (kind 0)
 */
export function createMetadataEvent(
  metadata: {
    name?: string
    about?: string
    picture?: string
    nip05?: string
    [key: string]: string | undefined
  },
  privateKey: Uint8Array
): NostrEvent {
  return createEventFromTemplate(
    {
      kind: 0,
      content: JSON.stringify(metadata),
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    },
    privateKey
  )
}

/**
 * Create a deletion event (kind 5)
 */
export function createDeletionEvent(
  eventIds: string[],
  privateKey: Uint8Array,
  reason?: string
): NostrEvent {
  const tags = eventIds.map((id) => ['e', id])
  return createEventFromTemplate(
    {
      kind: 5,
      content: reason || '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    },
    privateKey
  )
}

/**
 * Extract referenced event IDs from event tags
 */
export function getReferencedEventIds(event: NostrEvent): string[] {
  return event.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1])
}

/**
 * Extract referenced public keys from event tags
 */
export function getReferencedPubkeys(event: NostrEvent): string[] {
  return event.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1])
}

/**
 * Check if an event matches any of the given filters
 */
export function eventMatchesFilter(event: NostrEvent, filters: Filter[]): boolean {
  return filters.some((filter) => {
    if (filter.kinds && !filter.kinds.includes(event.kind)) {
      return false
    }
    if (filter.authors && !filter.authors.includes(event.pubkey)) {
      return false
    }
    if (filter.ids && !filter.ids.includes(event.id)) {
      return false
    }
    if (filter.since && event.created_at < filter.since) {
      return false
    }
    if (filter.until && event.created_at > filter.until) {
      return false
    }
    if (filter['#e']) {
      const eventTags = event.tags.filter((t) => t[0] === 'e').map((t) => t[1])
      if (!filter['#e'].some((id) => eventTags.includes(id))) {
        return false
      }
    }
    if (filter['#p']) {
      const pubkeyTags = event.tags.filter((t) => t[0] === 'p').map((t) => t[1])
      if (!filter['#p'].some((pk) => pubkeyTags.includes(pk))) {
        return false
      }
    }
    return true
  })
}
