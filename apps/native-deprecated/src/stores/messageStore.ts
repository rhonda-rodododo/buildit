/**
 * Message Store
 *
 * Manages direct messages using Nostr NIP-04 or NIP-44 encryption.
 * Subscribes to messages from relays and handles sending/receiving.
 */

import { create } from 'zustand'
import type { Event, Filter } from 'nostr-tools'
import { relayService, DEFAULT_RELAYS } from '../services/nostrRelay'
import { encryptDM, decryptDM, createEvent, hexToBytes } from '@buildit/sdk'
import { setSecureItem, getSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

// Nostr event kinds
const KIND_DM = 4 // NIP-04 DMs (legacy)
const KIND_GIFT_WRAP = 1059 // NIP-17 gift-wrapped messages


export interface Message {
  id: string
  content: string
  senderPubkey: string
  recipientPubkey: string
  createdAt: number
  status: 'sending' | 'sent' | 'delivered' | 'failed' | 'queued'
  isOutgoing: boolean
}

export interface QueuedMessage {
  id: string
  recipientPubkey: string
  content: string
  createdAt: number
}

export interface Conversation {
  contactPubkey: string
  contactName?: string
  messages: Message[]
  lastMessageAt: number
  unreadCount: number
}

interface MessageState {
  // State
  conversations: Map<string, Conversation>
  offlineQueue: QueuedMessage[]
  isLoading: boolean
  isConnected: boolean
  error: string | null

  // Actions
  initialize: (userPubkey: string, userPrivateKey: string) => Promise<void>
  sendMessage: (recipientPubkey: string, content: string) => Promise<void>
  retryQueuedMessages: () => Promise<void>
  markAsRead: (contactPubkey: string) => void
  getConversation: (contactPubkey: string) => Conversation | undefined
  disconnect: () => void
}

// Store the user's keys for encryption/decryption
let currentUserPubkey: string | null = null
let currentUserPrivateKey: string | null = null
let subscriptionId: string | null = null

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: new Map(),
  offlineQueue: [],
  isLoading: false,
  isConnected: false,
  error: null,

  initialize: async (userPubkey: string, userPrivateKey: string) => {
    set({ isLoading: true, error: null })

    // Load offline queue from storage
    try {
      const queueStr = await getSecureItem(STORAGE_KEYS.MESSAGE_QUEUE)
      if (queueStr) {
        try {
          const queue: QueuedMessage[] = JSON.parse(queueStr)
          set({ offlineQueue: queue })
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      // Ignore storage errors during init
    }

    currentUserPubkey = userPubkey
    currentUserPrivateKey = userPrivateKey

    try {
      // Connect to relays
      await relayService.connect(DEFAULT_RELAYS)

      // Subscribe to incoming DMs
      const filters: Filter[] = [
        // Messages sent to us
        {
          kinds: [KIND_DM],
          '#p': [userPubkey],
          since: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7, // Last 7 days
        },
        // Messages sent by us
        {
          kinds: [KIND_DM],
          authors: [userPubkey],
          since: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7,
        },
      ]

      subscriptionId = relayService.subscribe(
        filters,
        (event) => handleIncomingEvent(event, set, get),
        () => {
          // EOSE - end of stored events
          set({ isLoading: false })
        }
      )

      set({ isConnected: true })

      // Retry any queued messages after connecting
      setTimeout(() => {
        get().retryQueuedMessages()
      }, 1000)
    } catch (error) {
      console.error('Failed to initialize message store:', error)
      set({
        error: 'Failed to connect to relays',
        isLoading: false,
      })
    }
  },

  sendMessage: async (recipientPubkey: string, content: string) => {
    if (!currentUserPubkey || !currentUserPrivateKey) {
      throw new Error('Not initialized')
    }

    const { conversations, isConnected, offlineQueue } = get()

    // Create temporary message with appropriate status
    const tempId = `temp_${Date.now()}`
    const message: Message = {
      id: tempId,
      content,
      senderPubkey: currentUserPubkey,
      recipientPubkey,
      createdAt: Math.floor(Date.now() / 1000),
      status: isConnected ? 'sending' : 'queued',
      isOutgoing: true,
    }

    // Add to conversation
    const conversation = conversations.get(recipientPubkey) || {
      contactPubkey: recipientPubkey,
      messages: [],
      lastMessageAt: 0,
      unreadCount: 0,
    }

    conversation.messages.push(message)
    conversation.lastMessageAt = message.createdAt

    const newConversations = new Map(conversations)
    newConversations.set(recipientPubkey, conversation)
    set({ conversations: newConversations })

    // If offline, queue the message for later
    if (!isConnected) {
      const queuedMessage: QueuedMessage = {
        id: tempId,
        recipientPubkey,
        content,
        createdAt: message.createdAt,
      }
      const newQueue = [...offlineQueue, queuedMessage]
      set({ offlineQueue: newQueue })

      // Persist queue to storage
      try {
        await setSecureItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(newQueue))
      } catch (err) {
        console.error('Failed to persist message queue:', err)
      }
      return
    }

    try {
      // Encrypt the message
      const encrypted = await encryptDM(
        content,
        hexToBytes(currentUserPrivateKey),
        recipientPubkey
      )

      // Create and sign the Nostr event using SDK
      const event = createEvent(
        KIND_DM,
        encrypted,
        [['p', recipientPubkey]],
        currentUserPrivateKey
      )

      // Publish to relays
      const result = await relayService.publish(event)

      // Update message status
      const updatedConversation = newConversations.get(recipientPubkey)
      if (updatedConversation) {
        const msgIndex = updatedConversation.messages.findIndex((m) => m.id === tempId)
        if (msgIndex !== -1) {
          updatedConversation.messages[msgIndex].status = result.success ? 'sent' : 'failed'
          if (result.success && event.id) {
            updatedConversation.messages[msgIndex].id = event.id
          }
        }
        set({ conversations: new Map(newConversations) })
      }
    } catch (error) {
      console.error('Failed to send message:', error)

      // Mark message as failed
      const updatedConversation = conversations.get(recipientPubkey)
      if (updatedConversation) {
        const msgIndex = updatedConversation.messages.findIndex((m) => m.id === tempId)
        if (msgIndex !== -1) {
          updatedConversation.messages[msgIndex].status = 'failed'
          set({ conversations: new Map(conversations) })
        }
      }

      throw error
    }
  },

  retryQueuedMessages: async () => {
    if (!currentUserPubkey || !currentUserPrivateKey) return

    const { offlineQueue, conversations, isConnected } = get()
    if (!isConnected || offlineQueue.length === 0) return

    console.log(`Retrying ${offlineQueue.length} queued messages...`)

    const remainingQueue: QueuedMessage[] = []
    const newConversations = new Map(conversations)

    for (const queued of offlineQueue) {
      try {
        // Encrypt the message
        const encrypted = await encryptDM(
          queued.content,
          hexToBytes(currentUserPrivateKey),
          queued.recipientPubkey
        )

        // Create and sign the Nostr event
        const event = createEvent(
          KIND_DM,
          encrypted,
          [['p', queued.recipientPubkey]],
          currentUserPrivateKey
        )

        // Publish to relays
        const result = await relayService.publish(event)

        // Update message status in conversation
        const conversation = newConversations.get(queued.recipientPubkey)
        if (conversation) {
          const msgIndex = conversation.messages.findIndex((m) => m.id === queued.id)
          if (msgIndex !== -1) {
            conversation.messages[msgIndex].status = result.success ? 'sent' : 'failed'
            if (result.success && event.id) {
              conversation.messages[msgIndex].id = event.id
            }
          }
        }
      } catch (error) {
        console.error('Failed to retry queued message:', error)
        remainingQueue.push(queued)
      }
    }

    // Update state and persist remaining queue
    set({
      offlineQueue: remainingQueue,
      conversations: new Map(newConversations),
    })

    try {
      if (remainingQueue.length > 0) {
        await setSecureItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(remainingQueue))
      } else {
        // Clear the queue from storage if empty
        await setSecureItem(STORAGE_KEYS.MESSAGE_QUEUE, '[]')
      }
    } catch (err) {
      console.error('Failed to update message queue:', err)
    }

    if (remainingQueue.length > 0) {
      console.log(`${remainingQueue.length} messages still in queue`)
    } else {
      console.log('All queued messages sent successfully')
    }
  },

  markAsRead: (contactPubkey: string) => {
    const { conversations } = get()
    const conversation = conversations.get(contactPubkey)
    if (conversation) {
      conversation.unreadCount = 0
      set({ conversations: new Map(conversations) })
    }
  },

  getConversation: (contactPubkey: string) => {
    return get().conversations.get(contactPubkey)
  },

  disconnect: () => {
    if (subscriptionId) {
      relayService.unsubscribe(subscriptionId)
      subscriptionId = null
    }
    relayService.disconnect()
    currentUserPubkey = null
    currentUserPrivateKey = null
    set({
      conversations: new Map(),
      isConnected: false,
    })
  },
}))

// Handle incoming Nostr events
async function handleIncomingEvent(
  event: Event,
  set: (state: Partial<MessageState> | ((state: MessageState) => Partial<MessageState>)) => void,
  get: () => MessageState
): Promise<void> {
  if (!currentUserPubkey || !currentUserPrivateKey) return

  try {
    // Determine if this is incoming or outgoing
    const isOutgoing = event.pubkey === currentUserPubkey
    const contactPubkey = isOutgoing
      ? event.tags.find((t) => t[0] === 'p')?.[1] || ''
      : event.pubkey

    if (!contactPubkey) return

    // Decrypt the message
    let content: string
    try {
      content = await decryptDM(
        event.content,
        hexToBytes(currentUserPrivateKey),
        isOutgoing ? contactPubkey : event.pubkey
      )
    } catch {
      // Failed to decrypt - might be encrypted for someone else
      console.warn('Failed to decrypt message:', event.id)
      return
    }

    const message: Message = {
      id: event.id,
      content,
      senderPubkey: event.pubkey,
      recipientPubkey: isOutgoing
        ? contactPubkey
        : currentUserPubkey,
      createdAt: event.created_at,
      status: 'delivered',
      isOutgoing,
    }

    // Update conversations
    set((state) => {
      const conversations = new Map(state.conversations)
      const conversation = conversations.get(contactPubkey) || {
        contactPubkey,
        messages: [],
        lastMessageAt: 0,
        unreadCount: 0,
      }

      // Check if message already exists
      if (conversation.messages.some((m) => m.id === event.id)) {
        return {}
      }

      // Add message and sort by time
      conversation.messages.push(message)
      conversation.messages.sort((a, b) => a.createdAt - b.createdAt)
      conversation.lastMessageAt = Math.max(
        conversation.lastMessageAt,
        event.created_at
      )

      // Increment unread count for incoming messages
      if (!isOutgoing) {
        conversation.unreadCount++
      }

      conversations.set(contactPubkey, conversation)

      return { conversations }
    })
  } catch (error) {
    console.error('Error handling incoming event:', error)
  }
}
