/**
 * Signaling Service
 * Handles call signaling over Nostr using NIP-17 gift wrap for metadata protection
 *
 * Signaling messages:
 * - Call offer (SDP + capabilities)
 * - Call answer (SDP)
 * - ICE candidates
 * - Call hangup
 * - Group call events (create, join, leave)
 */

import { logger } from '@/lib/logger';
import { getNostrClient } from '@/core/nostr/client';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import type { Event as NostrEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { encryptDM, decryptDM } from '@/core/crypto/nip44';
import { v4 as uuidv4 } from 'uuid';
import {
  CALLING_KINDS,
  CallType,
  HangupReason,
  CallOfferSchema,
  CallAnswerSchema,
  CallIceCandidateSchema,
  CallHangupSchema,
  type CallOffer,
  type CallAnswer,
  type CallIceCandidate,
  type CallHangup,
  type CallCapabilities,
  type Candidate,
} from '../types';
import { CALLING_VERSION } from '@/generated/schemas/calling';

/**
 * Event handlers for incoming signaling messages
 */
export interface SignalingEventHandlers {
  onCallOffer: (offer: CallOffer, senderPubkey: string) => void;
  onCallAnswer: (answer: CallAnswer, senderPubkey: string) => void;
  onIceCandidate: (candidate: CallIceCandidate, senderPubkey: string) => void;
  onCallHangup: (hangup: CallHangup, senderPubkey: string) => void;
}

/**
 * Signaling Service class
 */
export class SignalingService {
  private handlers: SignalingEventHandlers | null = null;
  private subscriptionId: string | null = null;
  private userPubkey: string | null = null;

  /**
   * Initialize the signaling service and start listening for events
   */
  async initialize(handlers: SignalingEventHandlers): Promise<void> {
    this.handlers = handlers;

    const { currentIdentity } = useAuthStore.getState();
    if (!currentIdentity) {
      throw new Error('No identity available');
    }

    this.userPubkey = currentIdentity.publicKey;
    await this.startListening();

    logger.info('Signaling service initialized');
  }

  /**
   * Start listening for incoming call events
   */
  private async startListening(): Promise<void> {
    const client = getNostrClient();

    // Subscribe to NIP-17 gift-wrapped messages (kind 1059)
    // The actual call events are inside the wrapped content
    this.subscriptionId = client.subscribe(
      [
        {
          kinds: [1059], // Gift wrap
          '#p': [this.userPubkey!],
          since: Math.floor(Date.now() / 1000) - 60, // Last minute only
        },
      ],
      async (event: NostrEvent) => {
        try {
          await this.handleGiftWrap(event);
        } catch (error) {
          logger.error('Error handling gift wrap', error);
        }
      },
      () => {
        logger.info('📞 Call signaling subscription established');
      }
    );
  }

  /**
   * Handle incoming NIP-17 gift wrap
   */
  private async handleGiftWrap(event: NostrEvent): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      logger.warn('No private key available to decrypt');
      return;
    }

    try {
      // Decrypt the seal (inner layer) - using gift wrap pubkey
      const sealContent = decryptDM(event.content, privateKey, event.pubkey);
      const seal = JSON.parse(sealContent);

      // The seal contains the actual sender and the rumor (message)
      const senderPubkey = seal.pubkey;
      const rumorContent = decryptDM(seal.content, privateKey, senderPubkey);
      const rumor = JSON.parse(rumorContent);

      // Check if this is a call signaling event
      await this.handleSignalingEvent(rumor, senderPubkey);
    } catch (error) {
      // Not all gift wraps are for us or are call-related
      logger.debug('Could not process gift wrap', error);
    }
  }

  /**
   * Route signaling events to appropriate handlers
   */
  private async handleSignalingEvent(rumor: { kind: number; content: string }, senderPubkey: string): Promise<void> {
    if (!this.handlers) return;

    const content = JSON.parse(rumor.content);

    switch (rumor.kind) {
      case CALLING_KINDS.CALL_OFFER: {
        const parsed = CallOfferSchema.safeParse(content);
        if (parsed.success) {
          logger.info('📞 Received call offer', { callId: parsed.data.callId });
          this.handlers.onCallOffer(parsed.data, senderPubkey);
        }
        break;
      }

      case CALLING_KINDS.CALL_ANSWER: {
        const parsed = CallAnswerSchema.safeParse(content);
        if (parsed.success) {
          logger.info('📞 Received call answer', { callId: parsed.data.callId });
          this.handlers.onCallAnswer(parsed.data, senderPubkey);
        }
        break;
      }

      case CALLING_KINDS.CALL_ICE: {
        const parsed = CallIceCandidateSchema.safeParse(content);
        if (parsed.success) {
          logger.debug('📞 Received ICE candidate', { callId: parsed.data.callId });
          this.handlers.onIceCandidate(parsed.data, senderPubkey);
        }
        break;
      }

      case CALLING_KINDS.CALL_HANGUP: {
        const parsed = CallHangupSchema.safeParse(content);
        if (parsed.success) {
          logger.info('📞 Received hangup', { callId: parsed.data.callId, reason: parsed.data.reason });
          this.handlers.onCallHangup(parsed.data, senderPubkey);
        }
        break;
      }

      default:
        // Not a call event we handle
        break;
    }
  }

  /**
   * Send a NIP-17 gift-wrapped message
   */
  private async sendGiftWrap(
    recipientPubkey: string,
    kind: number,
    content: string
  ): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey || !this.userPubkey) {
      throw new Error('No identity available');
    }

    const client = getNostrClient();

    // Create the rumor (unsigned inner message)
    const rumor = {
      kind,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      pubkey: this.userPubkey,
    };

    // Encrypt rumor for recipient
    const encryptedRumor = encryptDM(JSON.stringify(rumor), privateKey, recipientPubkey);

    // Create seal
    const seal = {
      pubkey: this.userPubkey,
      content: encryptedRumor,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Generate ephemeral key for the gift wrap
    const ephemeralKey = generateSecretKey();
    // Note: getPublicKey available if needed for verification
    void getPublicKey(ephemeralKey); // Ephemeral pubkey is embedded in the signed event

    // Encrypt seal with ephemeral key
    const encryptedSeal = encryptDM(JSON.stringify(seal), ephemeralKey, recipientPubkey);

    // Create gift wrap event
    const giftWrap = finalizeEvent(
      {
        kind: 1059,
        content: encryptedSeal,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
      },
      ephemeralKey
    );

    // Publish the gift wrap
    await client.publish(giftWrap);
  }

  /**
   * Send a call offer
   */
  async sendCallOffer(
    recipientPubkey: string,
    sdp: string,
    callType: CallType,
    options: {
      callId?: string;
      groupId?: string;
      roomId?: string;
      hotlineId?: string;
      isReconnect?: boolean;
      isRenegotiation?: boolean;
      capabilities?: CallCapabilities;
    } = {}
  ): Promise<string> {
    const callId = options.callId ?? uuidv4();

    const offer: CallOffer = {
      _v: CALLING_VERSION,
      callId,
      callType,
      sdp,
      timestamp: Date.now(),
      groupId: options.groupId,
      roomId: options.roomId,
      hotlineId: options.hotlineId,
      isReconnect: options.isReconnect,
      isRenegotiation: options.isRenegotiation,
      capabilities: options.capabilities ?? {
        video: callType === CallType.Video,
        screenShare: true,
        e2ee: true,
        insertableStreams: 'RTCRtpScriptTransform' in window,
      },
    };

    await this.sendGiftWrap(recipientPubkey, CALLING_KINDS.CALL_OFFER, JSON.stringify(offer));
    logger.info('📞 Sent call offer', { callId, callType });

    return callId;
  }

  /**
   * Send a call answer
   */
  async sendCallAnswer(
    recipientPubkey: string,
    callId: string,
    sdp: string
  ): Promise<void> {
    const answer: CallAnswer = {
      _v: CALLING_VERSION,
      callId,
      sdp,
      timestamp: Date.now(),
    };

    await this.sendGiftWrap(recipientPubkey, CALLING_KINDS.CALL_ANSWER, JSON.stringify(answer));
    logger.info('📞 Sent call answer', { callId });
  }

  /**
   * Send an ICE candidate
   */
  async sendIceCandidate(
    recipientPubkey: string,
    callId: string,
    candidate: Candidate
  ): Promise<void> {
    const iceCandidate: CallIceCandidate = {
      _v: CALLING_VERSION,
      callId,
      candidate,
    };

    await this.sendGiftWrap(recipientPubkey, CALLING_KINDS.CALL_ICE, JSON.stringify(iceCandidate));
    logger.debug('📞 Sent ICE candidate', { callId });
  }

  /**
   * Send a hangup signal
   */
  async sendHangup(
    recipientPubkey: string,
    callId: string,
    reason: HangupReason
  ): Promise<void> {
    const hangup: CallHangup = {
      _v: CALLING_VERSION,
      callId,
      reason,
      timestamp: Date.now(),
    };

    await this.sendGiftWrap(recipientPubkey, CALLING_KINDS.CALL_HANGUP, JSON.stringify(hangup));
    logger.info('📞 Sent hangup', { callId, reason });
  }

  /**
   * Publish a custom Nostr event (for hotline state updates, etc.)
   * Uses NIP-17 gift wrap for privacy
   */
  async publishNostrEvent(event: {
    kind: number;
    content: string;
    tags: string[][];
  }): Promise<void> {
    // Extract recipient from 'p' tag
    const pTag = event.tags.find((tag) => tag[0] === 'p');
    if (!pTag || !pTag[1]) {
      logger.warn('Cannot publish event without recipient pubkey');
      return;
    }

    const recipientPubkey = pTag[1];
    await this.sendGiftWrap(recipientPubkey, event.kind, event.content);
    logger.debug('Published Nostr event', { kind: event.kind });
  }

  /**
   * Stop listening and clean up
   */
  close(): void {
    if (this.subscriptionId) {
      const client = getNostrClient();
      client.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    this.handlers = null;
    this.userPubkey = null;

    logger.info('Signaling service closed');
  }
}

/**
 * Singleton instance
 */
let signalingServiceInstance: SignalingService | null = null;

export function getSignalingService(): SignalingService {
  if (!signalingServiceInstance) {
    signalingServiceInstance = new SignalingService();
  }
  return signalingServiceInstance;
}

export function closeSignalingService(): void {
  if (signalingServiceInstance) {
    signalingServiceInstance.close();
    signalingServiceInstance = null;
  }
}
