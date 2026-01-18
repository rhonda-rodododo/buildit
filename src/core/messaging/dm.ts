import { type Event as NostrEvent } from 'nostr-tools'
import { createPrivateDM, unwrapGiftWrap } from '@/core/crypto/nip17'
import { verifyEventSignature } from '@/core/nostr/nip01'
import { NostrClient } from '@/core/nostr/client'
import type { GiftWrap } from '@/types/nostr'

export interface DirectMessage {
  id: string
  from: string
  to: string
  content: string
  timestamp: number
  conversationId: string
  decrypted: boolean
}

export interface Conversation {
  id: string
  participants: string[]
  lastMessage?: DirectMessage
  unreadCount: number
}

/**
 * Send an encrypted direct message using NIP-17
 */
export async function sendDirectMessage(
  client: NostrClient,
  recipientPubkey: string,
  content: string,
  senderPrivateKey: Uint8Array
): Promise<NostrEvent> {
  // Create a gift-wrapped private DM (NIP-17)
  const giftWrap = createPrivateDM(content, senderPrivateKey, recipientPubkey)

  // Publish the wrapped event
  await client.publish(giftWrap)

  return giftWrap
}

/**
 * Receive and decrypt a direct message
 *
 * SECURITY: Now properly extracts sender identity from the seal (not the ephemeral gift wrap key)
 * and verifies both gift wrap and seal signatures.
 */
export async function receiveDirectMessage(
  giftWrap: GiftWrap,
  recipientPrivateKey: Uint8Array
): Promise<DirectMessage | null> {
  try {
    // SECURITY: Verify gift wrap signature before processing
    if (!verifyEventSignature(giftWrap as unknown as NostrEvent)) {
      console.warn('Gift wrap signature verification failed')
      return null
    }

    // Unwrap to get rumor and VERIFIED sender identity
    const unwrapped = unwrapGiftWrap(giftWrap, recipientPrivateKey)
    const { rumor, senderPubkey, sealVerified } = unwrapped

    // SECURITY: Reject messages with invalid seal signatures
    if (!sealVerified) {
      console.warn('Seal signature verification failed, cannot trust sender identity')
      return null
    }

    if (!rumor || rumor.kind !== 14) {
      return null
    }

    const recipientTag = rumor.tags.find((t: string[]) => t[0] === 'p')
    if (!recipientTag) {
      return null
    }

    // SECURITY: senderPubkey is now correctly extracted from seal.pubkey
    // (NOT giftWrap.pubkey which is an ephemeral key)
    const conversationId = getConversationId(senderPubkey, recipientTag[1])

    return {
      id: giftWrap.id,
      from: senderPubkey, // SECURITY: Now using verified sender from seal
      to: recipientTag[1],
      content: rumor.content,
      timestamp: rumor.created_at,
      conversationId,
      decrypted: true,
    }
  } catch (error) {
    console.error('Failed to decrypt message:', error)
    return null
  }
}

/**
 * Generate a deterministic conversation ID from two pubkeys
 */
export function getConversationId(pubkey1: string, pubkey2: string): string {
  const sorted = [pubkey1, pubkey2].sort()
  return `dm:${sorted[0]}:${sorted[1]}`
}

/**
 * Subscribe to direct messages for a user
 */
export function subscribeToDirectMessages(
  client: NostrClient,
  userPubkey: string,
  privateKey: Uint8Array,
  onMessage: (message: DirectMessage) => void,
  since?: number
): string {
  // Subscribe to gift-wrapped events (kind 1059) addressed to this user
  const filter: {
    kinds: number[]
    '#p': string[]
    since?: number
  } = {
    kinds: [1059], // Gift Wrap kind
    '#p': [userPubkey],
  }

  if (since) {
    filter.since = since
  }

  return client.subscribe(
    [filter],
    async (event: NostrEvent) => {
      const dm = await receiveDirectMessage(event as GiftWrap, privateKey)
      if (dm) {
        onMessage(dm)
      }
    }
  )
}

/**
 * Load conversation history
 */
export async function loadConversationHistory(
  client: NostrClient,
  userPubkey: string,
  otherPubkey: string,
  privateKey: Uint8Array,
  limit = 50
): Promise<DirectMessage[]> {
  // Query for gift-wrapped events between these two users
  const events = await client.query([
    {
      kinds: [1059],
      '#p': [userPubkey],
      limit,
    },
  ])

  const messages: DirectMessage[] = []

  for (const event of events) {
    const dm = await receiveDirectMessage(event as GiftWrap, privateKey)
    if (dm && (dm.from === otherPubkey || dm.to === otherPubkey)) {
      messages.push(dm)
    }
  }

  // Sort by timestamp
  return messages.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get all conversations for a user
 */
export async function getConversations(
  client: NostrClient,
  userPubkey: string,
  privateKey: Uint8Array
): Promise<Conversation[]> {
  // Query for all gift-wrapped messages to this user
  const events = await client.query([
    {
      kinds: [1059],
      '#p': [userPubkey],
      limit: 100,
    },
  ])

  const conversationsMap = new Map<string, Conversation>()

  for (const event of events) {
    const dm = await receiveDirectMessage(event as GiftWrap, privateKey)
    if (!dm) continue

    const otherPubkey = dm.from === userPubkey ? dm.to : dm.from
    const convId = dm.conversationId

    if (!conversationsMap.has(convId)) {
      conversationsMap.set(convId, {
        id: convId,
        participants: [userPubkey, otherPubkey],
        unreadCount: 0,
      })
    }

    const conv = conversationsMap.get(convId)!
    if (!conv.lastMessage || dm.timestamp > conv.lastMessage.timestamp) {
      conv.lastMessage = dm
    }
  }

  return Array.from(conversationsMap.values()).sort((a, b) => {
    const aTime = a.lastMessage?.timestamp || 0
    const bTime = b.lastMessage?.timestamp || 0
    return bTime - aTime
  })
}
