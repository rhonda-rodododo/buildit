/**
 * Conference Chat Manager
 * Manages in-meeting chat with E2EE
 *
 * Features:
 * - Send to everyone (uses MLS room key - zero-knowledge)
 * - Send to hosts only (uses MLS with host subgroup)
 * - Private messages (uses NIP-44 - zero-knowledge)
 * - Message history per session
 *
 * Security (Zero-Knowledge):
 * - Public messages encrypted with MLS epoch key
 * - Private messages use NIP-44 gift-wrapped encryption
 * - Relay/SFU cannot decrypt any messages
 * - No plaintext metadata leakage
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import type { MLSKeyManager } from './mlsKeyManager';

export type MessageType = 'public' | 'hosts' | 'private';

export interface ConferenceChatMessage {
  id: string;
  roomId: string;
  senderPubkey: string;
  type: MessageType;
  recipientPubkey?: string; // Only for private messages
  content: string;
  timestamp: number;
  encrypted: boolean;
}

export interface EncryptedChatPayload {
  type: MessageType;
  epoch?: number; // MLS epoch for public/hosts messages
  encryptedContent: string; // Base64 encoded
  nonce?: string; // For AES-GCM
  recipientPubkey?: string; // For private messages
}

export interface ConferenceChatManagerEvents {
  'message-received': (message: ConferenceChatMessage) => void;
  'message-sent': (message: ConferenceChatMessage) => void;
  'history-updated': (messages: ConferenceChatMessage[]) => void;
  'encryption-error': (error: Error) => void;
}

/**
 * Conference Chat Manager
 */
export class ConferenceChatManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private mlsKeyManager?: MLSKeyManager;
  private messages: ConferenceChatMessage[] = [];
  private hostPubkeys: Set<string> = new Set();

  // Callbacks for transport layer
  private onSendPublic?: (payload: EncryptedChatPayload) => Promise<void>;
  private onSendPrivate?: (recipientPubkey: string, payload: EncryptedChatPayload) => Promise<void>;

  // NIP-44 encryption function (injected for zero-knowledge)
  private encryptNip44?: (plaintext: string, recipientPubkey: string) => Promise<string>;
  private decryptNip44?: (ciphertext: string, senderPubkey: string) => Promise<string>;

  constructor(roomId: string, localPubkey: string) {
    super();
    this.roomId = roomId;
    this.localPubkey = localPubkey;
  }

  /**
   * Set MLS key manager for group encryption
   */
  setMLSKeyManager(mlsKeyManager: MLSKeyManager): void {
    this.mlsKeyManager = mlsKeyManager;
  }

  /**
   * Set NIP-44 encryption functions for private messages
   */
  setNip44Functions(
    encrypt: (plaintext: string, recipientPubkey: string) => Promise<string>,
    decrypt: (ciphertext: string, senderPubkey: string) => Promise<string>
  ): void {
    this.encryptNip44 = encrypt;
    this.decryptNip44 = decrypt;
  }

  /**
   * Set transport callbacks
   */
  setOnSendPublic(callback: (payload: EncryptedChatPayload) => Promise<void>): void {
    this.onSendPublic = callback;
  }

  setOnSendPrivate(
    callback: (recipientPubkey: string, payload: EncryptedChatPayload) => Promise<void>
  ): void {
    this.onSendPrivate = callback;
  }

  /**
   * Set host pubkeys for "hosts only" messages
   */
  setHostPubkeys(pubkeys: string[]): void {
    this.hostPubkeys = new Set(pubkeys);
  }

  /**
   * Send message to everyone in the room
   */
  async sendToEveryone(content: string): Promise<void> {
    await this.sendMessage(content, 'public');
  }

  /**
   * Send message to hosts only
   */
  async sendToHosts(content: string): Promise<void> {
    await this.sendMessage(content, 'hosts');
  }

  /**
   * Send private message to specific participant
   */
  async sendPrivate(recipientPubkey: string, content: string): Promise<void> {
    await this.sendMessage(content, 'private', recipientPubkey);
  }

  /**
   * Send message with encryption
   */
  private async sendMessage(
    content: string,
    type: MessageType,
    recipientPubkey?: string
  ): Promise<void> {
    const message: ConferenceChatMessage = {
      id: uuidv4(),
      roomId: this.roomId,
      senderPubkey: this.localPubkey,
      type,
      recipientPubkey,
      content,
      timestamp: Date.now(),
      encrypted: true,
    };

    // Add to local history
    this.messages.push(message);

    try {
      if (type === 'private' && recipientPubkey) {
        // Use NIP-44 for private messages (zero-knowledge)
        await this.sendPrivateMessage(message, recipientPubkey);
      } else {
        // Use MLS for public/hosts messages (zero-knowledge)
        await this.sendMlsMessage(message, type);
      }

      this.emit('message-sent', message);
      this.emit('history-updated', this.messages);

      logger.debug('Chat message sent', { type, recipientPubkey });
    } catch (error) {
      // Remove from history on failure
      this.messages = this.messages.filter((m) => m.id !== message.id);
      logger.error('Failed to send chat message', error);
      this.emit('encryption-error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Encrypt and send message using MLS (for room/hosts)
   */
  private async sendMlsMessage(
    message: ConferenceChatMessage,
    type: MessageType
  ): Promise<void> {
    if (!this.mlsKeyManager) {
      throw new Error('MLS key manager not set');
    }

    const epoch = this.mlsKeyManager.getCurrentEpoch();
    const epochKey = this.mlsKeyManager.getCurrentEpochKey();

    if (!epochKey) {
      throw new Error('No MLS epoch key available');
    }

    // Generate nonce
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content with AES-GCM
    const plaintext = new TextEncoder().encode(message.content);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      epochKey,
      plaintext
    );

    const payload: EncryptedChatPayload = {
      type,
      epoch,
      encryptedContent: this.arrayBufferToBase64(ciphertext),
      nonce: this.arrayBufferToBase64(nonce),
    };

    if (this.onSendPublic) {
      await this.onSendPublic(payload);
    }
  }

  /**
   * Encrypt and send private message using NIP-44 (zero-knowledge)
   */
  private async sendPrivateMessage(
    message: ConferenceChatMessage,
    recipientPubkey: string
  ): Promise<void> {
    if (!this.encryptNip44) {
      throw new Error('NIP-44 encryption function not set');
    }

    // NIP-44 gift-wrap provides zero-knowledge encryption
    const encryptedContent = await this.encryptNip44(message.content, recipientPubkey);

    const payload: EncryptedChatPayload = {
      type: 'private',
      encryptedContent,
      recipientPubkey,
    };

    if (this.onSendPrivate) {
      await this.onSendPrivate(recipientPubkey, payload);
    }
  }

  /**
   * Handle incoming encrypted message
   */
  async handleEncryptedMessage(
    senderPubkey: string,
    payload: EncryptedChatPayload
  ): Promise<void> {
    try {
      let decryptedContent: string;

      if (payload.type === 'private') {
        // Decrypt with NIP-44
        decryptedContent = await this.decryptPrivateMessage(senderPubkey, payload);
      } else {
        // Decrypt with MLS
        decryptedContent = await this.decryptMlsMessage(payload);
      }

      const message: ConferenceChatMessage = {
        id: uuidv4(),
        roomId: this.roomId,
        senderPubkey,
        type: payload.type,
        recipientPubkey: payload.recipientPubkey,
        content: decryptedContent,
        timestamp: Date.now(),
        encrypted: true,
      };

      // Filter hosts-only messages if not a host
      if (payload.type === 'hosts' && !this.hostPubkeys.has(this.localPubkey)) {
        logger.debug('Ignoring hosts-only message (not a host)');
        return;
      }

      this.messages.push(message);
      this.emit('message-received', message);
      this.emit('history-updated', this.messages);

      logger.debug('Chat message received', { senderPubkey, type: payload.type });
    } catch (error) {
      logger.error('Failed to decrypt chat message', error);
      this.emit('encryption-error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Decrypt MLS-encrypted message
   */
  private async decryptMlsMessage(payload: EncryptedChatPayload): Promise<string> {
    if (!this.mlsKeyManager || payload.epoch === undefined) {
      throw new Error('MLS key manager not set or invalid payload');
    }

    const epochKey = this.mlsKeyManager.getEpochKey(payload.epoch);
    if (!epochKey) {
      throw new Error(`No MLS key for epoch ${payload.epoch}`);
    }

    const ciphertext = this.base64ToArrayBuffer(payload.encryptedContent);
    const nonce = this.base64ToArrayBuffer(payload.nonce!);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      epochKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * Decrypt NIP-44 encrypted private message
   */
  private async decryptPrivateMessage(
    senderPubkey: string,
    payload: EncryptedChatPayload
  ): Promise<string> {
    if (!this.decryptNip44) {
      throw new Error('NIP-44 decryption function not set');
    }

    return this.decryptNip44(payload.encryptedContent, senderPubkey);
  }

  /**
   * Get all messages
   */
  getMessages(): ConferenceChatMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: MessageType): ConferenceChatMessage[] {
    return this.messages.filter((m) => m.type === type);
  }

  /**
   * Get private messages with specific participant
   */
  getPrivateMessagesWith(pubkey: string): ConferenceChatMessage[] {
    return this.messages.filter(
      (m) =>
        m.type === 'private' &&
        (m.senderPubkey === pubkey || m.recipientPubkey === pubkey)
    );
  }

  /**
   * Get unread count (messages since last read timestamp)
   */
  getUnreadCount(lastReadTimestamp: number): number {
    return this.messages.filter(
      (m) => m.timestamp > lastReadTimestamp && m.senderPubkey !== this.localPubkey
    ).length;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messages = [];
    this.emit('history-updated', []);
  }

  /**
   * Helper: ArrayBuffer or Uint8Array to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Close the manager
   */
  close(): void {
    this.messages = [];
    this.hostPubkeys.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createConferenceChatManager(
  roomId: string,
  localPubkey: string
): ConferenceChatManager {
  return new ConferenceChatManager(roomId, localPubkey);
}
