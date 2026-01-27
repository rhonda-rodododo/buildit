/**
 * E2EE Media Frame Encryption Transforms
 * Implements end-to-end encryption for WebRTC media streams using Insertable Streams API
 *
 * Encryption layers:
 * 1. NIP-17 gift wrap for signaling (already implemented in signalingService)
 * 2. DTLS-SRTP (WebRTC built-in, hop-by-hop)
 * 3. This layer: Insertable Streams E2EE (true end-to-end, survives TURN/SFU)
 *
 * Frame format: [header(1)] [keyId(1)] [iv(12)] [ciphertext] [authTag(16)]
 * Header byte: 0x01 = encrypted frame
 */

import { logger } from '@/lib/logger';
import { deriveCallKey } from '@/core/crypto/nip44';

/** Frame header indicating encrypted content */
const ENCRYPTED_FRAME_HEADER = 0x01;

/** IV size for AES-GCM */
const IV_SIZE = 12;

/** Auth tag size for AES-GCM */
const AUTH_TAG_SIZE = 16;

/** Frame overhead: header(1) + keyId(1) + IV(12) */
const FRAME_OVERHEAD = 1 + 1 + IV_SIZE;

/** Unencrypted frame marker (for debugging/fallback) */
const UNENCRYPTED_FRAME_HEADER = 0x00;

/**
 * E2EE context for a call
 */
export interface E2EEContext {
  /** AES-GCM encryption key */
  key: CryptoKey;
  /** Key ID for rotation tracking */
  keyId: number;
  /** Nonce counter for sender (prevents IV reuse) */
  senderNonceCounter: number;
  /** Remote key IDs we've received (for receiver) */
  remoteKeyIds: Set<number>;
}

// Type definitions for Insertable Streams API (not yet in TypeScript lib)
interface RTCEncodedFrame {
  data: ArrayBuffer;
  timestamp?: number;
  type?: string;
}

type FrameTransformer = TransformStream<RTCEncodedFrame, RTCEncodedFrame>;

interface RTCRtpSenderWithEncodedStreams extends RTCRtpSender {
  createEncodedStreams?: () => { readable: ReadableStream<RTCEncodedFrame>; writable: WritableStream<RTCEncodedFrame> };
}

interface RTCRtpReceiverWithEncodedStreams extends RTCRtpReceiver {
  createEncodedStreams?: () => { readable: ReadableStream<RTCEncodedFrame>; writable: WritableStream<RTCEncodedFrame> };
}

/**
 * Create an E2EE context from a shared secret
 */
export async function createE2EEContext(
  localPrivkey: string,
  remotePubkey: string,
  callId: string
): Promise<E2EEContext> {
  // Derive call-specific key using HKDF from NIP-44 conversation key
  const keyMaterial = await deriveCallKey(localPrivkey, remotePubkey, callId);

  // Import as AES-GCM key
  // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
  const keyBuffer = keyMaterial.buffer.slice(
    keyMaterial.byteOffset,
    keyMaterial.byteOffset + keyMaterial.byteLength
  ) as ArrayBuffer;

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    key,
    keyId: 1,
    senderNonceCounter: 0,
    remoteKeyIds: new Set([1]),
  };
}

/**
 * Create encryption transform for sender
 * This encrypts outgoing media frames before they enter the WebRTC pipeline
 */
export function createEncryptionTransform(ctx: E2EEContext): FrameTransformer {
  return new TransformStream({
    transform: async (frame: RTCEncodedFrame, controller) => {
      try {
        // Generate unique IV from counter
        const iv = new Uint8Array(IV_SIZE);
        const ivView = new DataView(iv.buffer);

        // Use timestamp + counter for uniqueness
        const timestamp = frame.timestamp || Date.now();
        ivView.setUint32(0, timestamp >>> 0, false); // High bits of timestamp
        ivView.setUint32(4, ctx.senderNonceCounter++, false); // Counter
        crypto.getRandomValues(iv.subarray(8)); // Random padding

        // Encrypt the frame data
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          ctx.key,
          frame.data
        );

        // Build encrypted frame: [header(1)] [keyId(1)] [iv(12)] [ciphertext]
        const output = new Uint8Array(FRAME_OVERHEAD + ciphertext.byteLength);
        output[0] = ENCRYPTED_FRAME_HEADER;
        output[1] = ctx.keyId;
        output.set(iv, 2);
        output.set(new Uint8Array(ciphertext), FRAME_OVERHEAD);

        // Replace frame data with encrypted version
        frame.data = output.buffer;
        controller.enqueue(frame);
      } catch (error) {
        logger.error('E2EE encryption failed', error);
        // On error, drop the frame (don't send unencrypted)
      }
    },
  });
}

/**
 * Create decryption transform for receiver
 * This decrypts incoming media frames after they exit the WebRTC pipeline
 */
export function createDecryptionTransform(ctx: E2EEContext): FrameTransformer {
  return new TransformStream({
    transform: async (frame: RTCEncodedFrame, controller) => {
      try {
        const frameData = new Uint8Array(frame.data);

        // Check if frame is encrypted
        if (frameData.length < FRAME_OVERHEAD + AUTH_TAG_SIZE) {
          // Frame too small, might be unencrypted or malformed
          logger.warn('Received frame too small for E2EE', { size: frameData.length });
          controller.enqueue(frame);
          return;
        }

        const header = frameData[0];
        if (header === UNENCRYPTED_FRAME_HEADER) {
          // Unencrypted frame (fallback/compatibility)
          logger.debug('Received unencrypted frame');
          controller.enqueue(frame);
          return;
        }

        if (header !== ENCRYPTED_FRAME_HEADER) {
          // Unknown frame format
          logger.warn('Unknown frame header', { header });
          controller.enqueue(frame);
          return;
        }

        // Parse encrypted frame
        const keyId = frameData[1];
        const iv = frameData.slice(2, 2 + IV_SIZE);
        const ciphertext = frameData.slice(FRAME_OVERHEAD);

        // Check if we know this key ID
        if (!ctx.remoteKeyIds.has(keyId)) {
          logger.warn('Unknown key ID', { keyId });
          // For now, try decryption anyway (key rotation handling TBD)
        }

        // Decrypt
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          ctx.key,
          ciphertext
        );

        // Replace frame data with decrypted version
        frame.data = plaintext;
        controller.enqueue(frame);
      } catch (error) {
        logger.error('E2EE decryption failed', error);
        // On decryption failure, drop the frame
        // This could be due to key mismatch, corruption, or tampering
      }
    },
  });
}

/**
 * Apply E2EE transforms to a peer connection using createEncodedStreams API
 * This is the legacy API that works in most browsers supporting Insertable Streams
 */
export async function applyE2EETransforms(
  peerConnection: RTCPeerConnection,
  ctx: E2EEContext
): Promise<void> {
  // Check for Insertable Streams support (legacy API)
  const supportsEncodedStreams =
    typeof RTCRtpSender !== 'undefined' &&
    'createEncodedStreams' in RTCRtpSender.prototype;

  if (!supportsEncodedStreams) {
    logger.warn('Insertable Streams API not supported, E2EE disabled');
    return;
  }

  // Apply transforms to senders (outgoing)
  for (const sender of peerConnection.getSenders()) {
    if (!sender.track) continue;

    try {
      const senderWithStreams = sender as RTCRtpSenderWithEncodedStreams;
      if (senderWithStreams.createEncodedStreams) {
        const { readable, writable } = senderWithStreams.createEncodedStreams();
        const encryptTransform = createEncryptionTransform(ctx);
        readable.pipeThrough(encryptTransform).pipeTo(writable);
        logger.info('E2EE encryption applied to sender', { kind: sender.track.kind });
      }
    } catch (error) {
      logger.error('Failed to apply E2EE to sender', error);
    }
  }

  // Apply transforms to receivers (incoming)
  for (const receiver of peerConnection.getReceivers()) {
    if (!receiver.track) continue;

    try {
      const receiverWithStreams = receiver as RTCRtpReceiverWithEncodedStreams;
      if (receiverWithStreams.createEncodedStreams) {
        const { readable, writable } = receiverWithStreams.createEncodedStreams();
        const decryptTransform = createDecryptionTransform(ctx);
        readable.pipeThrough(decryptTransform).pipeTo(writable);
        logger.info('E2EE decryption applied to receiver', { kind: receiver.track.kind });
      }
    } catch (error) {
      logger.error('Failed to apply E2EE to receiver', error);
    }
  }
}

/**
 * Rotate the E2EE key (for forward secrecy)
 * Should be called periodically or when participants change
 */
export async function rotateE2EEKey(
  ctx: E2EEContext,
  localPrivkey: string,
  remotePubkey: string,
  callId: string
): Promise<E2EEContext> {
  // Derive new key with incremented key ID
  const newKeyMaterial = await deriveCallKey(
    localPrivkey,
    remotePubkey,
    `${callId}:${ctx.keyId + 1}`
  );

  // Note: slice() ensures we get a pure ArrayBuffer, not SharedArrayBuffer
  const newKeyBuffer = newKeyMaterial.buffer.slice(
    newKeyMaterial.byteOffset,
    newKeyMaterial.byteOffset + newKeyMaterial.byteLength
  ) as ArrayBuffer;

  const newKey = await crypto.subtle.importKey(
    'raw',
    newKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    key: newKey,
    keyId: ctx.keyId + 1,
    senderNonceCounter: 0,
    remoteKeyIds: new Set([...ctx.remoteKeyIds, ctx.keyId + 1]),
  };
}

/**
 * Check if E2EE is supported in the current browser
 */
export function isE2EESupported(): boolean {
  return (
    typeof RTCRtpSender !== 'undefined' &&
    'createEncodedStreams' in RTCRtpSender.prototype
  );
}

/**
 * Get E2EE support details for debugging
 */
export function getE2EESupportInfo(): {
  supported: boolean;
  method: 'createEncodedStreams' | 'none';
  browserInfo: string;
} {
  const browserInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

  if (
    typeof RTCRtpSender !== 'undefined' &&
    'createEncodedStreams' in RTCRtpSender.prototype
  ) {
    return {
      supported: true,
      method: 'createEncodedStreams',
      browserInfo,
    };
  }

  return {
    supported: false,
    method: 'none',
    browserInfo,
  };
}
