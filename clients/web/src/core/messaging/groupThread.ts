import { type Event as NostrEvent } from 'nostr-tools'
import { NostrClient } from '@/core/nostr/client'
import { createEventFromTemplate } from '@/core/nostr/nip01'
import { encryptNIP44, decryptNIP44 } from '@/core/crypto/nip44'
import { randomizeTimestamp } from '@/core/crypto/nip17'
import type { GroupThread, GroupMessage } from '@/types/group'

// Nostr event kinds for group messaging
const GROUP_MESSAGE_KINDS = {
  CREATE_THREAD: 39100,
  THREAD_MESSAGE: 39101,
  EDIT_MESSAGE: 39102,
  DELETE_MESSAGE: 39103,
  REACTION: 39104,
} as const

/**
 * Create a new thread in a group
 */
export async function createGroupThread(
  client: NostrClient,
  groupId: string,
  title: string,
  category: string | undefined,
  privateKey: Uint8Array
): Promise<NostrEvent> {
  const event = createEventFromTemplate(
    {
      kind: GROUP_MESSAGE_KINDS.CREATE_THREAD,
      content: JSON.stringify({
        groupId,
        title,
        category,
      }),
      tags: [
        ['h', groupId], // Group ID tag
        ['title', title],
        ...(category ? [['category', category]] : []),
      ],
      created_at: randomizeTimestamp(),
    },
    privateKey
  )

  await client.publish(event)
  return event
}

/**
 * Send a message to a group thread with NIP-17 encryption
 */
export async function sendGroupMessage(
  client: NostrClient,
  threadId: string,
  groupId: string,
  content: string,
  privateKey: Uint8Array,
  groupKey: Uint8Array, // Shared group encryption key
  replyTo?: string
): Promise<NostrEvent> {
  // Encrypt message content with group key using NIP-44
  const encryptedContent = encryptNIP44(content, groupKey)

  const tags: string[][] = [
    ['h', groupId], // Group ID
    ['thread', threadId], // Thread ID
  ]

  if (replyTo) {
    tags.push(['e', replyTo, '', 'reply'])
  }

  const event = createEventFromTemplate(
    {
      kind: GROUP_MESSAGE_KINDS.THREAD_MESSAGE,
      content: encryptedContent,
      tags,
      created_at: randomizeTimestamp(),
    },
    privateKey
  )

  await client.publish(event)
  return event
}

/**
 * Decrypt and parse a group message
 */
export function decryptGroupMessage(
  event: NostrEvent,
  groupKey: Uint8Array
): GroupMessage | null {
  try {
    const threadTag = event.tags.find((t) => t[0] === 'thread')
    const groupTag = event.tags.find((t) => t[0] === 'h')
    const replyTag = event.tags.find((t) => t[0] === 'e' && t[3] === 'reply')

    if (!threadTag || !groupTag) {
      return null
    }

    // Decrypt content with group key
    const decryptedContent = decryptNIP44(event.content, groupKey)

    return {
      _v: '1.0.0',
      id: event.id,
      threadId: threadTag[1],
      groupId: groupTag[1],
      from: event.pubkey,
      content: decryptedContent,
      timestamp: event.created_at,
      replyTo: replyTag?.[1],
      reactions: {},
    }
  } catch (error) {
    console.error('Failed to decrypt group message:', error)
    return null
  }
}

/**
 * Subscribe to messages in a group thread
 */
export function subscribeToGroupThread(
  client: NostrClient,
  groupId: string,
  threadId: string,
  groupKey: Uint8Array,
  onMessage: (message: GroupMessage) => void,
  since?: number
): string {
  // Use 'a' tag for group addressing (more widely supported)
  // Format: kind:pubkey:d-tag-value
  const filter: {
    kinds: number[]
    '#a'?: string[]
    since?: number
  } = {
    kinds: [GROUP_MESSAGE_KINDS.THREAD_MESSAGE],
    '#a': [`${GROUP_MESSAGE_KINDS.CREATE_THREAD}:*:${threadId}`],
  }

  if (since) {
    filter.since = since
  }

  return client.subscribe([filter], (event: NostrEvent) => {
    // Client-side filtering for group and thread
    const threadTag = event.tags.find((t) => t[0] === 'thread')
    const groupTag = event.tags.find((t) => t[0] === 'h')

    if (threadTag?.[1] === threadId && groupTag?.[1] === groupId) {
      const message = decryptGroupMessage(event, groupKey)
      if (message) {
        onMessage(message)
      }
    }
  })
}

/**
 * Load thread messages
 */
export async function loadThreadMessages(
  client: NostrClient,
  groupId: string,
  threadId: string,
  groupKey: Uint8Array,
  limit = 50
): Promise<GroupMessage[]> {
  // Query by kind only, then filter client-side
  const events = await client.query([
    {
      kinds: [GROUP_MESSAGE_KINDS.THREAD_MESSAGE],
      limit: limit * 5, // Get more events to account for filtering
    },
  ])

  const messages: GroupMessage[] = []

  for (const event of events) {
    // Client-side filtering
    const threadTag = event.tags.find((t) => t[0] === 'thread')
    const groupTag = event.tags.find((t) => t[0] === 'h')

    if (threadTag?.[1] === threadId && groupTag?.[1] === groupId) {
      const message = decryptGroupMessage(event, groupKey)
      if (message) {
        messages.push(message)
      }
    }
  }

  return messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit)
}

/**
 * Get all threads for a group
 */
export async function getGroupThreads(
  client: NostrClient,
  groupId: string
): Promise<GroupThread[]> {
  // Query by kind only, filter client-side
  const events = await client.query([
    {
      kinds: [GROUP_MESSAGE_KINDS.CREATE_THREAD],
      limit: 500, // Get more for filtering
    },
  ])

  // Filter for this group
  const groupEvents = events.filter(event => {
    const groupTag = event.tags.find((t) => t[0] === 'h')
    return groupTag?.[1] === groupId
  })

  return groupEvents.map((event): GroupThread => {
    const data = JSON.parse(event.content)
    const titleTag = event.tags.find((t) => t[0] === 'title')
    const categoryTag = event.tags.find((t) => t[0] === 'category')

    return {
      _v: '1.0.0',
      id: event.id,
      groupId: data.groupId,
      title: titleTag?.[1] || data.title,
      createdBy: event.pubkey,
      createdAt: event.created_at,
      lastMessageAt: event.created_at,
      messageCount: 0,
      category: categoryTag?.[1] || data.category,
      pinned: false,
    }
  }).slice(0, 100)
}

/**
 * Edit a message (publish edit event, original stays on relay)
 */
export async function editGroupMessage(
  client: NostrClient,
  originalMessageId: string,
  newContent: string,
  privateKey: Uint8Array,
  groupKey: Uint8Array
): Promise<NostrEvent> {
  const encryptedContent = encryptNIP44(newContent, groupKey)

  const event = createEventFromTemplate(
    {
      kind: GROUP_MESSAGE_KINDS.EDIT_MESSAGE,
      content: encryptedContent,
      tags: [['e', originalMessageId]],
      created_at: randomizeTimestamp(),
    },
    privateKey
  )

  await client.publish(event)
  return event
}

/**
 * Delete a message (publish deletion event)
 */
export async function deleteGroupMessage(
  client: NostrClient,
  messageId: string,
  privateKey: Uint8Array
): Promise<NostrEvent> {
  const event = createEventFromTemplate(
    {
      kind: GROUP_MESSAGE_KINDS.DELETE_MESSAGE,
      content: '',
      tags: [['e', messageId]],
      created_at: randomizeTimestamp(),
    },
    privateKey
  )

  await client.publish(event)
  return event
}

/**
 * Add a reaction to a message
 */
export async function addReaction(
  client: NostrClient,
  messageId: string,
  emoji: string,
  privateKey: Uint8Array
): Promise<NostrEvent> {
  const event = createEventFromTemplate(
    {
      kind: GROUP_MESSAGE_KINDS.REACTION,
      content: emoji,
      tags: [['e', messageId]],
      created_at: randomizeTimestamp(),
    },
    privateKey
  )

  await client.publish(event)
  return event
}
