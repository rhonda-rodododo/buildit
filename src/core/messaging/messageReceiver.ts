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
import { unwrapGiftWrap, isGiftWrapForRecipient, type UnwrappedMessage } from '@/core/crypto/nip17';
import { verifyEventSignature } from '@/core/nostr/nip01';
import { getCurrentPrivateKey } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import { getNostrClient } from '@/core/nostr/client';
import { useConversationsStore } from './conversationsStore';
import type { GiftWrap } from '@/types/nostr';
import type { ConversationMessage } from './conversationTypes';

import { logger } from '@/lib/logger';
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
      logger.info('Message receiver already running for user');
      return;
    }

    this.stop(); // Stop any existing subscription
    this.userPubkey = userPubkey;
    this.isRunning = true;

    logger.info(`🔔 Starting message receiver for ${userPubkey.slice(0, 8)}...`);

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
        logger.info('✅ Initial message sync complete');
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
    logger.info('🔕 Message receiver stopped');
  }

  /**
   * Handle an incoming gift wrap event
   *
   * SECURITY: Now verifies both gift wrap signature and seal signature
   * before processing the message. Invalid signatures are rejected.
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

    // SECURITY: Verify the gift wrap event signature first
    // This ensures the event wasn't tampered with in transit
    if (!verifyEventSignature(event)) {
      console.warn('Gift wrap signature verification failed, rejecting event:', event.id);
      return;
    }

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
      // Unwrap the gift wrap to get the rumor and VERIFIED sender identity
      const unwrapped = unwrapGiftWrap(giftWrap, privateKey);

      // SECURITY: Reject messages with invalid seal signatures
      // The seal signature proves the sender's identity
      if (!unwrapped.sealVerified) {
        console.warn('Seal signature verification failed, rejecting message:', event.id);
        return;
      }

      // Process based on rumor kind
      if (unwrapped.rumor.kind === 14) {
        // NIP-17 DM
        await this.processPrivateMessage(unwrapped, giftWrap);
      } else {
        logger.info(`Received unknown rumor kind: ${unwrapped.rumor.kind}`);
      }
    } catch (error) {
      console.error('Failed to process gift wrap:', error);
    }
  }

  /**
   * Process a decrypted private message (kind 14 rumor)
   *
   * SECURITY: Now uses the verified sender pubkey from the seal,
   * NOT the ephemeral gift wrap pubkey.
   */
  private async processPrivateMessage(unwrapped: UnwrappedMessage, giftWrap: GiftWrap): Promise<void> {
    if (!this.userPubkey) return;

    const { rumor, senderPubkey } = unwrapped;

    // SECURITY: senderPubkey is from seal.pubkey which was signature-verified
    // This is the ACTUAL sender identity (not giftWrap.pubkey which is ephemeral)

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
      // We now have the verified sender pubkey from the seal
      console.warn('No conversation ID in message tags, sender:', senderPubkey.slice(0, 8));
      return;
    }

    const conversation = store.getConversation(conversationId);

    if (!conversation) {
      // Conversation doesn't exist locally, try to create it
      // This can happen when receiving a message in a new conversation
      logger.info(`Creating new conversation: ${conversationId}`);

      // For now, we'll skip creating conversations from incoming messages
      // The sender should have created the conversation first
      // TODO: Implement conversation discovery/creation from incoming messages
      return;
    }

    // Create message record with VERIFIED sender identity
    const message: ConversationMessage = {
      id: giftWrap.id, // Use gift wrap ID as message ID (unique)
      conversationId,
      from: senderPubkey, // SECURITY: Now correctly using verified sender from seal
      content: rumor.content,
      timestamp: rumor.created_at * 1000, // Convert to ms
      replyTo,
      isEdited: false,
      reactions: {},
    };

    // Check if message already exists
    const existingMessage = await db.conversationMessages.get(message.id);
    if (existingMessage) {
      logger.info('Message already exists, skipping');
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

      logger.info(`📨 Received message in conversation ${conversationId.slice(0, 8)}...`);
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

    logger.info(`📥 Fetching message history since ${new Date(sinceTime * 1000).toISOString()}`);

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

    logger.info(`✅ Processed ${processed} historical messages`);
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
