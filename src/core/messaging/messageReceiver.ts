/**
 * Message Receiver
 * Handles incoming NIP-17 gift-wrapped messages from Nostr relays
 *
 * Flow:
 * 1. Subscribe to kind 1059 (gift wrap) events addressed to the user
 * 2. Unwrap gift wrap → seal → rumor
 * 3. Decrypt content using NIP-44
 * 4. Store message locally (encrypted with DEK)
 * 5. Update conversation state
 */

import type { Event as NostrEvent } from 'nostr-tools';
import { unwrapGiftWrap, isGiftWrapForRecipient } from '@/core/crypto/nip17';
import { getCurrentPrivateKey } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import { getNostrClient } from '@/core/nostr/client';
import { useConversationsStore } from './conversationsStore';
import type { GiftWrap, Rumor } from '@/types/nostr';
import type { ConversationMessage } from './conversationTypes';

// Track processed event IDs to avoid duplicates
const processedEvents = new Set<string>();

// Maximum processed events to track (to avoid memory leaks)
const MAX_PROCESSED_EVENTS = 10000;

/**
 * Message receiver service
 */
class MessageReceiverService {
  private subscriptionId: string | null = null;
  private userPubkey: string | null = null;
  private isRunning = false;

  /**
   * Start listening for incoming messages
   */
  start(userPubkey: string): void {
    if (this.isRunning && this.userPubkey === userPubkey) {
      console.log('Message receiver already running for user');
      return;
    }

    this.stop(); // Stop any existing subscription
    this.userPubkey = userPubkey;
    this.isRunning = true;

    console.log(`🔔 Starting message receiver for ${userPubkey.slice(0, 8)}...`);

    const client = getNostrClient();

    // Subscribe to gift wrap events (kind 1059) addressed to this user
    this.subscriptionId = client.subscribe(
      [
        {
          kinds: [1059], // Gift wrap
          '#p': [userPubkey], // Addressed to us
          since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60, // Last 7 days
        },
      ],
      (event) => this.handleGiftWrap(event),
      () => {
        console.log('✅ Initial message sync complete');
      }
    );
  }

  /**
   * Stop listening for incoming messages
   */
  stop(): void {
    if (this.subscriptionId) {
      const client = getNostrClient();
      client.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }
    this.isRunning = false;
    this.userPubkey = null;
    console.log('🔕 Message receiver stopped');
  }

  /**
   * Handle an incoming gift wrap event
   */
  private async handleGiftWrap(event: NostrEvent): Promise<void> {
    // Skip if already processed
    if (processedEvents.has(event.id)) {
      return;
    }

    // Cleanup old processed events if needed
    if (processedEvents.size > MAX_PROCESSED_EVENTS) {
      const toRemove = Array.from(processedEvents).slice(0, MAX_PROCESSED_EVENTS / 2);
      toRemove.forEach((id) => processedEvents.delete(id));
    }

    processedEvents.add(event.id);

    // Verify this is addressed to us
    if (!this.userPubkey) {
      console.warn('No user pubkey set, ignoring gift wrap');
      return;
    }

    const giftWrap = event as unknown as GiftWrap;

    if (!isGiftWrapForRecipient(giftWrap, this.userPubkey)) {
      console.warn('Gift wrap not addressed to current user, ignoring');
      return;
    }

    // Get private key for decryption
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      console.warn('App is locked, cannot decrypt incoming message');
      // TODO: Queue for later decryption when unlocked
      return;
    }

    try {
      // Unwrap the gift wrap to get the rumor
      const rumor = unwrapGiftWrap(giftWrap, privateKey);

      // Process based on rumor kind
      if (rumor.kind === 14) {
        // NIP-17 DM
        await this.processPrivateMessage(rumor, giftWrap);
      } else {
        console.log(`Received unknown rumor kind: ${rumor.kind}`);
      }
    } catch (error) {
      console.error('Failed to process gift wrap:', error);
    }
  }

  /**
   * Process a decrypted private message (kind 14 rumor)
   */
  private async processPrivateMessage(rumor: Rumor, giftWrap: GiftWrap): Promise<void> {
    if (!this.userPubkey) return;

    // Extract sender from the seal's pubkey (wrapped in gift wrap)
    // The sender is the one who signed the seal
    const senderPubkey = giftWrap.pubkey; // Ephemeral key, not sender

    // For NIP-17, the actual sender is found in the seal
    // But after unwrapping, we need to trust the rumor's implicit sender
    // The p tag in the rumor indicates the recipient
    const recipientTag = rumor.tags?.find((t) => t[0] === 'p');
    const recipientPubkey = recipientTag?.[1];

    if (!recipientPubkey || recipientPubkey !== this.userPubkey) {
      console.warn('Message not addressed to current user');
      return;
    }

    // Find conversation ID from tags
    const conversationTag = rumor.tags?.find((t) => t[0] === 'conversation');
    const conversationId = conversationTag?.[1];

    // Extract reply reference if present
    const replyTag = rumor.tags?.find((t) => t[0] === 'e' && t[3] === 'reply');
    const replyTo = replyTag?.[1];

    // Get or create conversation
    const store = useConversationsStore.getState();

    if (!conversationId) {
      // No conversation ID in tags, try to find existing DM or create new one
      // Note: We need to determine the sender somehow
      // In NIP-17, the seal is signed by the actual sender
      // TODO: Extract sender from seal before unwrapping
      console.warn('No conversation ID in message tags');
      return;
    }

    const conversation = store.getConversation(conversationId);

    if (!conversation) {
      // Conversation doesn't exist locally, try to create it
      // This can happen when receiving a message in a new conversation
      console.log(`Creating new conversation: ${conversationId}`);

      // For now, we'll skip creating conversations from incoming messages
      // The sender should have created the conversation first
      // TODO: Implement conversation discovery/creation from incoming messages
      return;
    }

    // Create message record
    const message: ConversationMessage = {
      id: giftWrap.id, // Use gift wrap ID as message ID (unique)
      conversationId,
      from: senderPubkey, // Note: This is ephemeral key, not actual sender
      content: rumor.content,
      timestamp: rumor.created_at * 1000, // Convert to ms
      replyTo,
      isEdited: false,
      reactions: {},
    };

    // Check if message already exists
    const existingMessage = await db.conversationMessages.get(message.id);
    if (existingMessage) {
      console.log('Message already exists, skipping');
      return;
    }

    // Store message locally (Dexie hooks will encrypt)
    try {
      await db.conversationMessages.add(message);

      // Update conversation metadata
      await db.conversations.update(conversationId, {
        lastMessageAt: message.timestamp,
        lastMessagePreview: rumor.content.substring(0, 100),
        unreadCount: (conversation.unreadCount || 0) + 1,
      });

      // Update Zustand state
      useConversationsStore.setState((state) => ({
        messages: [...state.messages, message],
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageAt: message.timestamp,
                lastMessagePreview: rumor.content.substring(0, 100),
                unreadCount: (c.unreadCount || 0) + 1,
              }
            : c
        ),
      }));

      console.log(`📨 Received message in conversation ${conversationId.slice(0, 8)}...`);
    } catch (error) {
      console.error('Failed to store incoming message:', error);
    }
  }

  /**
   * Fetch historical messages (catch up after being offline)
   */
  async fetchHistory(userPubkey: string, since?: number): Promise<number> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      console.warn('App is locked, cannot fetch history');
      return 0;
    }

    const client = getNostrClient();
    const sinceTime = since || Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // Default: 30 days

    console.log(`📥 Fetching message history since ${new Date(sinceTime * 1000).toISOString()}`);

    const events = await client.query(
      [
        {
          kinds: [1059], // Gift wrap
          '#p': [userPubkey],
          since: sinceTime,
        },
      ],
      30000 // 30 second timeout
    );

    let processed = 0;
    for (const event of events) {
      try {
        await this.handleGiftWrap(event);
        processed++;
      } catch (error) {
        console.error('Failed to process historical message:', error);
      }
    }

    console.log(`✅ Processed ${processed} historical messages`);
    return processed;
  }

  /**
   * Check if the receiver is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const messageReceiver = new MessageReceiverService();

/**
 * Start message receiver (call after unlock)
 */
export function startMessageReceiver(userPubkey: string): void {
  messageReceiver.start(userPubkey);
}

/**
 * Stop message receiver (call on lock)
 */
export function stopMessageReceiver(): void {
  messageReceiver.stop();
}

/**
 * Fetch historical messages
 */
export async function fetchMessageHistory(
  userPubkey: string,
  since?: number
): Promise<number> {
  return messageReceiver.fetchHistory(userPubkey, since);
}
