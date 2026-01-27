/**
 * Conference Frame Encryptor
 * Extends E2EE transforms for SFU conference calls using MLS epoch keys
 *
 * Frame format: [epoch(1)][counter(4)][iv(12)][encrypted payload][authTag(16)]
 *
 * Key differences from 1:1 E2EE:
 * - Uses MLS epoch keys instead of derived peer keys
 * - Includes epoch byte for out-of-order decryption
 * - Supports key caching for late/missing commits
 */

import { logger } from '@/lib/logger';
import { MLSKeyManager } from './mlsKeyManager';

/** IV size for AES-GCM */
const IV_SIZE = 12;

/** Counter size (for uniqueness) */
const COUNTER_SIZE = 4;

/** Frame header: epoch(1) + counter(4) + iv(12) = 17 bytes */
const FRAME_HEADER_SIZE = 1 + COUNTER_SIZE + IV_SIZE;

/** Auth tag size for AES-GCM */
const AUTH_TAG_SIZE = 16;

// Type definitions for Insertable Streams API
interface RTCEncodedFrame {
  data: ArrayBuffer;
  timestamp?: number;
  type?: string;
}

type FrameTransformer = TransformStream<RTCEncodedFrame, RTCEncodedFrame>;

/**
 * Conference E2EE context
 */
export interface ConferenceE2EEContext {
  mlsKeyManager: MLSKeyManager;
  senderCounter: number;
  roomId: string;
}

/**
 * Create conference E2EE context
 */
export function createConferenceE2EEContext(
  mlsKeyManager: MLSKeyManager,
  roomId: string
): ConferenceE2EEContext {
  return {
    mlsKeyManager,
    senderCounter: 0,
    roomId,
  };
}

/**
 * Create encryption transform for conference sender
 */
export function createConferenceEncryptionTransform(
  ctx: ConferenceE2EEContext
): FrameTransformer {
  return new TransformStream({
    transform: async (frame: RTCEncodedFrame, controller) => {
      try {
        const epoch = ctx.mlsKeyManager.getCurrentEpoch();
        const key = ctx.mlsKeyManager.getCurrentEpochKey();

        if (!key) {
          // No key available - drop frame
          logger.warn('No MLS key available for encryption');
          return;
        }

        // Generate unique IV from counter
        const iv = new Uint8Array(IV_SIZE);
        const ivView = new DataView(iv.buffer);

        // Use timestamp + counter for uniqueness
        const timestamp = frame.timestamp || Date.now();
        ivView.setUint32(0, timestamp >>> 0, false);
        ivView.setUint32(4, ctx.senderCounter, false);
        crypto.getRandomValues(iv.subarray(8));

        const counter = ctx.senderCounter++;

        // Encrypt frame data
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          frame.data
        );

        // Build encrypted frame: [epoch(1)][counter(4)][iv(12)][ciphertext]
        const output = new Uint8Array(FRAME_HEADER_SIZE + ciphertext.byteLength);
        output[0] = epoch & 0xff;

        // Write counter
        const counterView = new DataView(output.buffer, 1, COUNTER_SIZE);
        counterView.setUint32(0, counter, false);

        // Write IV and ciphertext
        output.set(iv, 1 + COUNTER_SIZE);
        output.set(new Uint8Array(ciphertext), FRAME_HEADER_SIZE);

        // Replace frame data with encrypted version
        frame.data = output.buffer;
        controller.enqueue(frame);
      } catch (error) {
        logger.error('Conference E2EE encryption failed', error);
        // Drop frame on error - don't send unencrypted
      }
    },
  });
}

/**
 * Create decryption transform for conference receiver
 */
export function createConferenceDecryptionTransform(
  ctx: ConferenceE2EEContext
): FrameTransformer {
  return new TransformStream({
    transform: async (frame: RTCEncodedFrame, controller) => {
      try {
        const frameData = new Uint8Array(frame.data);

        // Check minimum frame size
        if (frameData.length < FRAME_HEADER_SIZE + AUTH_TAG_SIZE) {
          // Too short to be encrypted - might be unencrypted frame
          controller.enqueue(frame);
          return;
        }

        // Extract epoch
        const epoch = frameData[0];

        // Get key for this epoch
        const key = ctx.mlsKeyManager.getEpochKey(epoch);
        if (!key) {
          logger.warn('No MLS key for epoch', { epoch });
          // Drop frame - can't decrypt
          return;
        }

        // Extract IV
        const iv = frameData.slice(1 + COUNTER_SIZE, FRAME_HEADER_SIZE);

        // Extract ciphertext
        const ciphertext = frameData.slice(FRAME_HEADER_SIZE);

        // Decrypt
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );

        // Replace frame data with decrypted version
        frame.data = plaintext;
        controller.enqueue(frame);
      } catch (error) {
        logger.error('Conference E2EE decryption failed', error);
        // Drop frame on error
      }
    },
  });
}

/**
 * Conference Frame Encryptor class (alternative OOP interface)
 */
export class ConferenceFrameEncryptor {
  private ctx: ConferenceE2EEContext;

  constructor(mlsKeyManager: MLSKeyManager, roomId: string) {
    this.ctx = createConferenceE2EEContext(mlsKeyManager, roomId);
  }

  /**
   * Encrypt a frame
   */
  async encryptFrame(
    frame: RTCEncodedFrame
  ): Promise<RTCEncodedFrame> {
    const epoch = this.ctx.mlsKeyManager.getCurrentEpoch();
    const key = this.ctx.mlsKeyManager.getCurrentEpochKey();

    if (!key) {
      throw new Error('No MLS key available for encryption');
    }

    // Generate unique IV
    const iv = new Uint8Array(IV_SIZE);
    const ivView = new DataView(iv.buffer);
    const timestamp = frame.timestamp || Date.now();
    ivView.setUint32(0, timestamp >>> 0, false);
    ivView.setUint32(4, this.ctx.senderCounter, false);
    crypto.getRandomValues(iv.subarray(8));

    const counter = this.ctx.senderCounter++;

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      frame.data
    );

    // Build output
    const output = new Uint8Array(FRAME_HEADER_SIZE + ciphertext.byteLength);
    output[0] = epoch & 0xff;

    const counterView = new DataView(output.buffer, 1, COUNTER_SIZE);
    counterView.setUint32(0, counter, false);

    output.set(iv, 1 + COUNTER_SIZE);
    output.set(new Uint8Array(ciphertext), FRAME_HEADER_SIZE);

    return {
      ...frame,
      data: output.buffer,
    };
  }

  /**
   * Decrypt a frame
   */
  async decryptFrame(
    frame: RTCEncodedFrame
  ): Promise<RTCEncodedFrame> {
    const frameData = new Uint8Array(frame.data);

    if (frameData.length < FRAME_HEADER_SIZE + AUTH_TAG_SIZE) {
      return frame; // Not encrypted or too short
    }

    const epoch = frameData[0];
    const key = this.ctx.mlsKeyManager.getEpochKey(epoch);

    if (!key) {
      throw new Error(`No MLS key for epoch ${epoch}`);
    }

    const iv = frameData.slice(1 + COUNTER_SIZE, FRAME_HEADER_SIZE);
    const ciphertext = frameData.slice(FRAME_HEADER_SIZE);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return {
      ...frame,
      data: plaintext,
    };
  }

  /**
   * Create encryption transform stream
   */
  createEncryptionTransform(): FrameTransformer {
    return createConferenceEncryptionTransform(this.ctx);
  }

  /**
   * Create decryption transform stream
   */
  createDecryptionTransform(): FrameTransformer {
    return createConferenceDecryptionTransform(this.ctx);
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.ctx.mlsKeyManager.getCurrentEpoch();
  }
}

/**
 * Apply conference E2EE transforms to a peer connection
 */
export async function applyConferenceE2EE(
  connection: RTCPeerConnection,
  mlsKeyManager: MLSKeyManager,
  roomId: string
): Promise<ConferenceFrameEncryptor> {
  const encryptor = new ConferenceFrameEncryptor(mlsKeyManager, roomId);

  // Apply to all senders
  for (const sender of connection.getSenders()) {
    if (sender.track) {
      await applySenderTransform(sender, encryptor);
    }
  }

  // Apply to all receivers
  for (const receiver of connection.getReceivers()) {
    if (receiver.track) {
      await applyReceiverTransform(receiver, encryptor);
    }
  }

  // Listen for new tracks
  connection.ontrack = (event) => {
    applyReceiverTransform(event.receiver, encryptor);
  };

  return encryptor;
}

/**
 * Apply encryption transform to sender
 */
async function applySenderTransform(
  sender: RTCRtpSender,
  encryptor: ConferenceFrameEncryptor
): Promise<void> {
  // Check for Insertable Streams support
  const senderWithStreams = sender as RTCRtpSender & {
    createEncodedStreams?: () => {
      readable: ReadableStream<RTCEncodedFrame>;
      writable: WritableStream<RTCEncodedFrame>;
    };
  };

  if (!senderWithStreams.createEncodedStreams) {
    logger.warn('Insertable Streams not supported for sender');
    return;
  }

  const { readable, writable } = senderWithStreams.createEncodedStreams();
  const transform = encryptor.createEncryptionTransform();

  readable.pipeThrough(transform).pipeTo(writable);
  logger.debug('Applied encryption transform to sender');
}

/**
 * Apply decryption transform to receiver
 */
async function applyReceiverTransform(
  receiver: RTCRtpReceiver,
  encryptor: ConferenceFrameEncryptor
): Promise<void> {
  // Check for Insertable Streams support
  const receiverWithStreams = receiver as RTCRtpReceiver & {
    createEncodedStreams?: () => {
      readable: ReadableStream<RTCEncodedFrame>;
      writable: WritableStream<RTCEncodedFrame>;
    };
  };

  if (!receiverWithStreams.createEncodedStreams) {
    logger.warn('Insertable Streams not supported for receiver');
    return;
  }

  const { readable, writable } = receiverWithStreams.createEncodedStreams();
  const transform = encryptor.createDecryptionTransform();

  readable.pipeThrough(transform).pipeTo(writable);
  logger.debug('Applied decryption transform to receiver');
}
