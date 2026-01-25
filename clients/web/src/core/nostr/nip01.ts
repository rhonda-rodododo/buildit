import { finalizeEvent, verifyEvent, type Event as NostrEvent, type EventTemplate } from 'nostr-tools'
import { getPublicKey } from 'nostr-tools/pure'

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return crypto.randomUUID()
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
  // Convert hex private key to Uint8Array
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
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
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
  const tags = eventIds.map(id => ['e', id])
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
  return event.tags
    .filter(tag => tag[0] === 'e' && tag[1])
    .map(tag => tag[1])
}

/**
 * Extract referenced public keys from event tags
 */
export function getReferencedPubkeys(event: NostrEvent): string[] {
  return event.tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1])
}

/**
 * Check if an event matches any of the given filters
 */
export function eventMatchesFilter(event: NostrEvent, filters: import('nostr-tools').Filter[]): boolean {
  return filters.some(filter => {
    // Check kinds
    if (filter.kinds && !filter.kinds.includes(event.kind)) {
      return false
    }

    // Check authors
    if (filter.authors && !filter.authors.includes(event.pubkey)) {
      return false
    }

    // Check IDs
    if (filter.ids && !filter.ids.includes(event.id)) {
      return false
    }

    // Check since
    if (filter.since && event.created_at < filter.since) {
      return false
    }

    // Check until
    if (filter.until && event.created_at > filter.until) {
      return false
    }

    // Check tags
    if (filter['#e']) {
      const eventTags = event.tags.filter(t => t[0] === 'e').map(t => t[1])
      if (!filter['#e'].some(id => eventTags.includes(id))) {
        return false
      }
    }

    if (filter['#p']) {
      const pubkeyTags = event.tags.filter(t => t[0] === 'p').map(t => t[1])
      if (!filter['#p'].some(pk => pubkeyTags.includes(pk))) {
        return false
      }
    }

    return true
  })
}
