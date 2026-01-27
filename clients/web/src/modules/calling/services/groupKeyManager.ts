/**
 * Group Key Manager
 * Handles E2EE sender keys for group calls using double ratchet
 *
 * Sender keys architecture:
 * - Each participant generates their own AES-256-GCM key
 * - Key is encrypted to each other participant via NIP-44
 * - Keys are distributed via Nostr kind 24320 (SENDER_KEY)
 * - Key rotation on: participant leave, time-based (30min), explicit request
 */

import { logger } from '@/lib/logger';
import { encryptDM } from '@/core/crypto/nip44';
import { getCurrentPrivateKey, useAuthStore } from '@/stores/authStore';
import type { SenderKeyDistribution } from '../types';
import { CALLING_VERSION } from '@/generated/schemas/calling';

/** Key rotation interval in milliseconds (30 minutes) */
const KEY_ROTATION_INTERVAL_MS = 30 * 60 * 1000;

/** Frame header size for encrypted frames */
const FRAME_HEADER_SIZE = 16; // keyId (4) + nonce (12)

/** Nonce size for AES-GCM */
const NONCE_SIZE = 12;

interface SenderKeyEntry {
  key: CryptoKey;
  keyId: number;
  createdAt: number;
}

interface PendingKeyRotation {
  reason: 'participant_leave' | 'time_based' | 'explicit';
  scheduledAt: number;
}

/**
 * Group Key Manager class
 */
export class GroupKeyManager {
  private roomId: string;
  private localPubkey: string;

  // Our own sender key
  private mySenderKey: SenderKeyEntry | null = null;

  // Sender keys from other participants: Map<"pubkey:keyId", CryptoKey>
  private senderKeys: Map<string, CryptoKey> = new Map();

  // Latest key ID per participant
  private latestKeyIds: Map<string, number> = new Map();

  // Nonce counter for our outgoing frames
  private nonceCounter: number = 0;

  // Key rotation tracking
  private rotationTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRotation: PendingKeyRotation | null = null;

  // Event callbacks
  private onKeyDistribution: ((dist: SenderKeyDistribution) => Promise<void>) | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
    const { currentIdentity } = useAuthStore.getState();
    this.localPubkey = currentIdentity?.publicKey ?? '';
  }

  /**
   * Set callback for sending key distributions
   */
  setOnKeyDistribution(cb: (dist: SenderKeyDistribution) => Promise<void>): void {
    this.onKeyDistribution = cb;
  }

  /**
   * Generate a new sender key and distribute to participants
   */
  async generateAndDistributeSenderKey(participants: string[]): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      throw new Error('No private key available');
    }

    // Generate new AES-256-GCM key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable for distribution
      ['encrypt', 'decrypt']
    );

    // Export the raw key bytes
    const rawKey = await crypto.subtle.exportKey('raw', key);
    const keyBytes = new Uint8Array(rawKey);

    // Generate key ID (incremental)
    const keyId = (this.mySenderKey?.keyId ?? 0) + 1;

    // Store our own key
    this.mySenderKey = {
      key,
      keyId,
      createdAt: Date.now(),
    };
    this.nonceCounter = 0;

    // Encrypt key to each participant
    const encryptedKeys: Record<string, string> = {};

    for (const pubkey of participants) {
      if (pubkey === this.localPubkey) continue;

      try {
        // Encrypt the raw key bytes using NIP-44
        const keyHex = this.bytesToHex(keyBytes);
        const encrypted = encryptDM(keyHex, privateKey, pubkey);
        encryptedKeys[pubkey] = encrypted;
      } catch (error) {
        logger.error('Failed to encrypt sender key for participant', { pubkey, error });
      }
    }

    // Create distribution message
    const distribution: SenderKeyDistribution = {
      _v: CALLING_VERSION,
      roomId: this.roomId,
      senderPubkey: this.localPubkey,
      keyId,
      encryptedKeys,
      timestamp: Date.now(),
    };

    // Send via callback
    if (this.onKeyDistribution) {
      await this.onKeyDistribution(distribution);
    }

    // Schedule time-based rotation
    this.scheduleRotation();

    logger.info('Generated and distributed sender key', { roomId: this.roomId, keyId });
  }

  /**
   * Handle incoming sender key distribution
   */
  async handleSenderKeyDistribution(dist: SenderKeyDistribution): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      logger.warn('No private key available to decrypt sender key');
      return;
    }

    // Get the encrypted key for us
    const encryptedKey = dist.encryptedKeys[this.localPubkey];
    if (!encryptedKey) {
      logger.debug('Sender key distribution not for us', { from: dist.senderPubkey });
      return;
    }

    try {
      // Decrypt the key
      const { decryptDM } = await import('@/core/crypto/nip44');
      const keyHex = decryptDM(encryptedKey, privateKey, dist.senderPubkey);
      const keyBytes = this.hexToBytes(keyHex);

      // Import as CryptoKey
      // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
      const keyBuffer = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength
      ) as ArrayBuffer;

      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false, // not extractable
        ['decrypt']
      );

      // Store the key
      const keyMapKey = `${dist.senderPubkey}:${dist.keyId}`;
      this.senderKeys.set(keyMapKey, key);
      this.latestKeyIds.set(dist.senderPubkey, dist.keyId);

      logger.info('Received sender key', {
        from: dist.senderPubkey,
        keyId: dist.keyId,
      });
    } catch (error) {
      logger.error('Failed to decrypt sender key', { from: dist.senderPubkey, error });
    }
  }

  /**
   * Encrypt a media frame for sending
   * Frame format: [keyId(4)] [nonce(12)] [ciphertext] [tag(16)]
   */
  async encryptFrame(frame: Uint8Array): Promise<Uint8Array> {
    if (!this.mySenderKey) {
      throw new Error('No sender key available');
    }

    // Generate nonce from counter
    const nonce = new Uint8Array(NONCE_SIZE);
    const nonceView = new DataView(nonce.buffer);
    // Use timestamp + counter for uniqueness
    nonceView.setUint32(0, Math.floor(Date.now() / 1000), false);
    nonceView.setUint32(4, this.nonceCounter++, false);
    // Random padding for remaining bytes
    crypto.getRandomValues(nonce.subarray(8));

    // Encrypt - convert Uint8Array to ArrayBuffer for crypto API
    // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
    const frameBuffer = frame.buffer.slice(
      frame.byteOffset,
      frame.byteOffset + frame.byteLength
    ) as ArrayBuffer;

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      this.mySenderKey.key,
      frameBuffer
    );

    // Build output: keyId + nonce + ciphertext (includes tag)
    const output = new Uint8Array(4 + NONCE_SIZE + ciphertext.byteLength);
    const outputView = new DataView(output.buffer);
    outputView.setUint32(0, this.mySenderKey.keyId, false);
    output.set(nonce, 4);
    output.set(new Uint8Array(ciphertext), 4 + NONCE_SIZE);

    return output;
  }

  /**
   * Decrypt a media frame from a participant
   */
  async decryptFrame(senderPubkey: string, frame: Uint8Array): Promise<Uint8Array> {
    if (frame.length < FRAME_HEADER_SIZE) {
      throw new Error('Frame too short');
    }

    // Parse header
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const keyId = view.getUint32(0, false);
    const nonce = frame.slice(4, 4 + NONCE_SIZE);
    const ciphertext = frame.slice(4 + NONCE_SIZE);

    // Look up the key
    const keyMapKey = `${senderPubkey}:${keyId}`;
    const key = this.senderKeys.get(keyMapKey);

    if (!key) {
      throw new Error(`No key found for ${senderPubkey} with keyId ${keyId}`);
    }

    // Decrypt - convert Uint8Array to ArrayBuffer for crypto API
    // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
    const ciphertextBuffer = ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength
    ) as ArrayBuffer;

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      ciphertextBuffer
    );

    return new Uint8Array(plaintext);
  }

  /**
   * Handle participant leaving - trigger key rotation
   */
  async handleParticipantLeft(pubkey: string, remainingParticipants: string[]): Promise<void> {
    // Remove their keys
    for (const [keyMapKey] of this.senderKeys) {
      if (keyMapKey.startsWith(`${pubkey}:`)) {
        this.senderKeys.delete(keyMapKey);
      }
    }
    this.latestKeyIds.delete(pubkey);

    // Rotate our key to ensure forward secrecy
    if (remainingParticipants.length > 0) {
      this.pendingRotation = {
        reason: 'participant_leave',
        scheduledAt: Date.now(),
      };
      await this.generateAndDistributeSenderKey(remainingParticipants);
    }

    logger.info('Rotated keys due to participant leave', { leftPubkey: pubkey });
  }

  /**
   * Schedule time-based key rotation
   */
  private scheduleRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    this.rotationTimer = setTimeout(async () => {
      this.pendingRotation = {
        reason: 'time_based',
        scheduledAt: Date.now(),
      };
      // The MeshCallManager will call generateAndDistributeSenderKey with current participants
      logger.info('Time-based key rotation scheduled');
    }, KEY_ROTATION_INTERVAL_MS);
  }

  /**
   * Check if key rotation is pending
   */
  isPendingRotation(): boolean {
    return this.pendingRotation !== null;
  }

  /**
   * Clear pending rotation
   */
  clearPendingRotation(): void {
    this.pendingRotation = null;
  }

  /**
   * Get current key ID
   */
  getCurrentKeyId(): number | undefined {
    return this.mySenderKey?.keyId;
  }

  /**
   * Check if we have a key for a participant
   */
  hasKeyForParticipant(pubkey: string): boolean {
    return this.latestKeyIds.has(pubkey);
  }

  /**
   * Clean up
   */
  close(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    this.mySenderKey = null;
    this.senderKeys.clear();
    this.latestKeyIds.clear();
    this.pendingRotation = null;

    logger.info('Group key manager closed');
  }

  // Utility methods
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
}
