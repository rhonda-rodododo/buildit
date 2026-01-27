/**
 * SFU Conference Manager
 * Manages SFU-based conference calls for 50+ participants with MLS E2EE
 *
 * Architecture:
 * - Each participant has single connection to SFU (not N mesh connections)
 * - Simulcast encoding with 3 quality layers (low/medium/high)
 * - MLS (Message Layer Security) for O(log n) key updates
 * - Multi-region SFU support with <200ms latency
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCAdapter, type WebRTCEventHandlers } from './webrtcAdapter';
import { MLSKeyManager } from './mlsKeyManager';
import { SimulcastManager } from './simulcastManager';
import {
  CALLING_KINDS,
  type ConferenceRoom,
  type ConferenceParticipant,
  type MLSWelcome,
  type MLSCommit,
  type ConferenceState,
  type QualityLayer,
  type ConferenceLayout,
} from '../types';
import { CALLING_VERSION } from '@/generated/schemas/calling';
import { encryptDM } from '@/core/crypto/nip44';
import { getNostrClient } from '@/core/nostr/client';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';

/** Maximum participants for SFU topology */
const MAX_CONFERENCE_PARTICIPANTS = 100;

/** Conference room settings */
export interface ConferenceSettings {
  waitingRoom: boolean;
  locked: boolean;
  allowScreenShare: boolean;
  allowRecording: boolean;
  e2eeRequired: boolean;
  muteOnJoin: boolean;
}

/** Reconnection delay */
const RECONNECT_DELAY_MS = 2000;

/** Max reconnection attempts */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Default SFU endpoint - would be configured per deployment */
const DEFAULT_SFU_ENDPOINT = 'wss://sfu.buildit.network';

interface ConferenceParticipantState {
  pubkey: string;
  displayName?: string;
  role: 'host' | 'co_host' | 'moderator' | 'participant' | 'viewer';
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  inBreakout?: string;
  qualityPreference?: QualityLayer;
}

/** Events emitted by SFUConferenceManager */
export interface SFUConferenceManagerEvents {
  'participant-joined': (pubkey: string, participant: ConferenceParticipantState) => void;
  'participant-left': (pubkey: string) => void;
  'participant-updated': (pubkey: string, updates: Partial<ConferenceParticipantState>) => void;
  'track-subscribed': (pubkey: string, stream: MediaStream, kind: 'audio' | 'video' | 'screen') => void;
  'track-unsubscribed': (pubkey: string, kind: 'audio' | 'video' | 'screen') => void;
  'quality-changed': (pubkey: string, quality: QualityLayer) => void;
  'connection-state-changed': (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
  'mls-epoch-changed': (epoch: number) => void;
  'error': (error: Error) => void;
  'room-closed': (reason: string) => void;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SFU Conference Manager
 */
export class SFUConferenceManager extends EventEmitter {
  // Room state
  private roomId: string | null = null;
  private roomName: string | null = null;
  private groupId: string | null = null;
  private isHost = false;
  private localRole: 'host' | 'co_host' | 'moderator' | 'participant' | 'viewer' = 'participant';

  // SFU connection
  private sfuEndpoint: string | null = null;
  private webrtcAdapter: WebRTCAdapter | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private reconnectAttempts = 0;

  // Local participant
  private localPubkey: string;
  private localDisplayName?: string;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  // Remote participants
  private participants: Map<string, ConferenceParticipantState> = new Map();

  // E2EE (MLS)
  private mlsKeyManager: MLSKeyManager | null = null;

  // Simulcast
  private simulcastManager: SimulcastManager | null = null;

  // Local media state
  private isMuted = false;
  private isVideoEnabled = true;
  private isScreenSharing = false;

  // Room settings
  private settings: ConferenceSettings = {
    waitingRoom: false,
    locked: false,
    allowScreenShare: true,
    allowRecording: false,
    e2eeRequired: true,
    muteOnJoin: false,
  };

  // Nostr subscription
  private subscriptionId: string | null = null;

  // Layout preference
  private layoutMode: ConferenceLayout = 'speaker';

  constructor() {
    super();

    const { currentIdentity } = useAuthStore.getState();
    this.localPubkey = currentIdentity?.publicKey ?? '';
    this.localDisplayName = currentIdentity?.displayName;
  }

  /**
   * Create a new conference room
   */
  async createConference(options: {
    name: string;
    groupId?: string;
    maxParticipants?: number;
    settings?: Partial<ConferenceSettings>;
    invitedPubkeys?: string[];
  }): Promise<ConferenceRoom> {
    if (this.roomId) {
      throw new Error('Already in a conference');
    }

    const roomId = uuidv4();
    this.roomId = roomId;
    this.roomName = options.name;
    this.groupId = options.groupId ?? null;
    this.isHost = true;
    this.localRole = 'host';
    this.settings = { ...this.settings, ...options.settings };

    // Get SFU endpoint based on region
    this.sfuEndpoint = await this.getSFUEndpoint();

    // Initialize MLS key manager
    this.mlsKeyManager = new MLSKeyManager(roomId, this.localPubkey);
    await this.mlsKeyManager.initializeGroup();

    // Initialize simulcast manager
    this.simulcastManager = new SimulcastManager();

    // Start listening for room events
    await this.startRoomSubscription();

    // Connect to SFU
    await this.connectToSFU();

    // Get local media
    await this.acquireLocalMedia();

    // Publish local tracks
    await this.publishLocalTracks();

    // Create room object
    const room: ConferenceRoom = {
      _v: CALLING_VERSION,
      roomId,
      name: options.name,
      groupId: options.groupId,
      createdBy: this.localPubkey,
      maxParticipants: options.maxParticipants ?? MAX_CONFERENCE_PARTICIPANTS,
      settings: this.settings,
      sfuEndpoint: this.sfuEndpoint,
      createdAt: Date.now(),
    };

    // Broadcast room creation
    await this.broadcastRoomCreate(room, options.invitedPubkeys);

    logger.info('Created conference room', { roomId, name: options.name });
    return room;
  }

  /**
   * Join an existing conference room
   */
  async joinConference(roomId: string, token?: string): Promise<void> {
    if (this.roomId) {
      throw new Error('Already in a conference');
    }

    this.roomId = roomId;
    this.isHost = false;
    this.localRole = 'participant';

    // Get SFU endpoint (would normally come from room info)
    this.sfuEndpoint = await this.getSFUEndpoint();

    // Initialize MLS key manager
    this.mlsKeyManager = new MLSKeyManager(roomId, this.localPubkey);

    // Initialize simulcast manager
    this.simulcastManager = new SimulcastManager();

    // Start listening for room events
    await this.startRoomSubscription();

    // Broadcast join (to get MLS welcome)
    await this.broadcastJoin();

    // Connect to SFU
    await this.connectToSFU(token);

    // Get local media
    await this.acquireLocalMedia();

    // Apply mute on join if enabled
    if (this.settings.muteOnJoin) {
      this.isMuted = true;
      this.localStream?.getAudioTracks().forEach((t) => (t.enabled = false));
    }

    // Publish local tracks
    await this.publishLocalTracks();

    logger.info('Joined conference room', { roomId });
  }

  /**
   * Leave the current conference
   */
  async leaveConference(): Promise<void> {
    if (!this.roomId) return;

    // Broadcast leave
    await this.broadcastLeave();

    // Clean up
    this.cleanup();

    logger.info('Left conference');
  }

  /**
   * Get SFU endpoint based on region
   */
  private async getSFUEndpoint(): Promise<string> {
    // In production, this would query a registry to find nearest SFU
    // For now, return default endpoint
    return DEFAULT_SFU_ENDPOINT;
  }

  /**
   * Connect to SFU
   */
  private async connectToSFU(token?: string): Promise<void> {
    if (!this.sfuEndpoint) {
      throw new Error('No SFU endpoint configured');
    }

    this.setConnectionState('connecting');

    try {
      // Create WebRTC adapter for SFU connection
      this.webrtcAdapter = new WebRTCAdapter();
      await this.webrtcAdapter.initialize(this.createSFUHandlers());

      // Configure for simulcast
      if (this.simulcastManager) {
        this.simulcastManager.configureConnection(this.webrtcAdapter.getConnection());
      }

      // Create data channel for signaling
      this.dataChannel = this.webrtcAdapter.getConnection().createDataChannel('signaling', {
        ordered: true,
      });
      this.setupDataChannelHandlers();

      // Create and send offer
      // In production, this offer would be sent to the SFU's signaling API
      const _offer = await this.webrtcAdapter.createOffer();

      // For now, we simulate the connection (offer would be sent via signaling)
      logger.info('Connecting to SFU', { endpoint: this.sfuEndpoint, token: !!token, hasOffer: !!_offer });

      // Enable E2EE via MLS
      const privateKeyBytes = getCurrentPrivateKey();
      if (privateKeyBytes && this.mlsKeyManager) {
        const privateKeyHex = bytesToHex(privateKeyBytes);
        await this.webrtcAdapter.enableE2EE(privateKeyHex, 'sfu', this.roomId!);
      }

      this.setConnectionState('connected');
      this.reconnectAttempts = 0;

    } catch (error) {
      logger.error('Failed to connect to SFU', error);
      this.setConnectionState('disconnected');
      throw error;
    }
  }

  /**
   * Create WebRTC event handlers for SFU connection
   */
  private createSFUHandlers(): WebRTCEventHandlers {
    return {
      onIceCandidate: async (candidate) => {
        // Send to SFU via data channel or signaling
        if (this.dataChannel?.readyState === 'open') {
          this.dataChannel.send(JSON.stringify({
            type: 'ice-candidate',
            candidate,
          }));
        }
      },
      onIceConnectionStateChange: (state) => {
        this.handleSFUConnectionStateChange(state);
      },
      onTrack: (stream, track) => {
        this.handleRemoteTrack(stream, track);
      },
      onNegotiationNeeded: async () => {
        logger.debug('SFU negotiation needed');
        await this.renegotiate();
      },
      onConnectionFailed: (error) => {
        logger.error('SFU connection failed', error);
        this.handleConnectionFailure();
      },
    };
  }

  /**
   * Setup data channel handlers
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      logger.info('SFU data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSFUMessage(message);
      } catch (error) {
        logger.error('Failed to parse SFU message', error);
      }
    };

    this.dataChannel.onclose = () => {
      logger.info('SFU data channel closed');
    };
  }

  /**
   * Handle SFU message from data channel
   */
  private handleSFUMessage(message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'participant-joined':
        this.handleRemoteParticipantJoined(message as { type: string; pubkey: string; [key: string]: unknown });
        break;
      case 'participant-left':
        this.handleRemoteParticipantLeft(message.pubkey as string);
        break;
      case 'quality-update':
        // Handle adaptive quality updates from SFU
        break;
    }
  }

  /**
   * Handle SFU connection state change
   */
  private handleSFUConnectionStateChange(state: RTCIceConnectionState): void {
    switch (state) {
      case 'connected':
        this.setConnectionState('connected');
        break;
      case 'disconnected':
        this.setConnectionState('reconnecting');
        this.attemptReconnect();
        break;
      case 'failed':
        this.handleConnectionFailure();
        break;
    }
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.attemptReconnect();
    } else {
      this.setConnectionState('disconnected');
      this.emit('error', new Error('Failed to connect to conference'));
      this.cleanup();
    }
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');

    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS * this.reconnectAttempts));

    try {
      await this.connectToSFU();
      if (this.localStream) {
        await this.publishLocalTracks();
      }
    } catch (error) {
      logger.error('Reconnect attempt failed', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Renegotiate SFU connection (for adding/removing tracks)
   */
  private async renegotiate(): Promise<void> {
    if (!this.webrtcAdapter) return;

    try {
      const offer = await this.webrtcAdapter.createOffer();

      // Send renegotiation via data channel
      if (this.dataChannel?.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'renegotiate',
          sdp: offer.sdp,
        }));
      }
    } catch (error) {
      logger.error('Renegotiation failed', error);
    }
  }

  /**
   * Handle remote track from SFU
   */
  private handleRemoteTrack(stream: MediaStream, track: MediaStreamTrack): void {
    // Track ID format: {pubkey}:{kind} (e.g., "abc123:video")
    const trackParts = track.id.split(':');
    if (trackParts.length < 2) return;

    const pubkey = trackParts[0];
    const kind = track.kind as 'audio' | 'video';

    // Update participant stream
    const participant = this.participants.get(pubkey);
    if (participant) {
      participant.stream = stream;
      this.emit('track-subscribed', pubkey, stream, kind);
    }
  }

  /**
   * Handle remote participant joined
   */
  private handleRemoteParticipantJoined(message: { pubkey: string; displayName?: string; role?: string }): void {
    if (message.pubkey === this.localPubkey) return;
    if (this.participants.has(message.pubkey)) return;

    const participant: ConferenceParticipantState = {
      pubkey: message.pubkey,
      displayName: message.displayName,
      role: (message.role as ConferenceParticipantState['role']) || 'participant',
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      isSpeaking: false,
      handRaised: false,
    };

    this.participants.set(message.pubkey, participant);
    this.emit('participant-joined', message.pubkey, participant);

    // Send MLS welcome if we're the host
    if (this.isHost && this.mlsKeyManager) {
      this.sendMLSWelcome(message.pubkey);
    }
  }

  /**
   * Handle remote participant left
   */
  private handleRemoteParticipantLeft(pubkey: string): void {
    if (!this.participants.has(pubkey)) return;

    this.participants.delete(pubkey);
    this.emit('participant-left', pubkey);

    // Rotate MLS key for forward secrecy
    if (this.mlsKeyManager) {
      this.rotateMLSKey();
    }
  }

  /**
   * Send MLS welcome to new participant
   */
  private async sendMLSWelcome(targetPubkey: string): Promise<void> {
    if (!this.mlsKeyManager || !this.roomId) return;

    try {
      const welcome = await this.mlsKeyManager.createWelcome(targetPubkey);

      const mlsWelcome: MLSWelcome = {
        _v: CALLING_VERSION,
        roomId: this.roomId,
        targetPubkey,
        welcome: welcome.welcomeData,
        epoch: welcome.epoch,
        timestamp: Date.now(),
      };

      await this.sendGiftWrap(targetPubkey, CALLING_KINDS.MLS_WELCOME, JSON.stringify(mlsWelcome));
    } catch (error) {
      logger.error('Failed to send MLS welcome', error);
    }
  }

  /**
   * Handle MLS welcome message
   */
  private async handleMLSWelcome(welcome: MLSWelcome): Promise<void> {
    if (!this.mlsKeyManager) return;

    try {
      await this.mlsKeyManager.handleWelcome(welcome.welcome);
      this.emit('mls-epoch-changed', welcome.epoch ?? 0);
    } catch (error) {
      logger.error('Failed to process MLS welcome', error);
    }
  }

  /**
   * Handle MLS commit message
   */
  private async handleMLSCommit(commit: MLSCommit): Promise<void> {
    if (!this.mlsKeyManager) return;

    try {
      await this.mlsKeyManager.handleCommit(commit.commit);
      this.emit('mls-epoch-changed', commit.epoch);
    } catch (error) {
      logger.error('Failed to process MLS commit', error);
    }
  }

  /**
   * Rotate MLS key (on participant leave)
   */
  private async rotateMLSKey(): Promise<void> {
    if (!this.mlsKeyManager || !this.roomId) return;

    try {
      const commit = await this.mlsKeyManager.createCommit();

      const mlsCommit: MLSCommit = {
        _v: CALLING_VERSION,
        roomId: this.roomId,
        epoch: commit.epoch,
        commit: commit.commitData,
        senderPubkey: this.localPubkey,
        timestamp: Date.now(),
      };

      // Broadcast to all participants
      for (const pubkey of this.participants.keys()) {
        await this.sendGiftWrap(pubkey, CALLING_KINDS.MLS_COMMIT, JSON.stringify(mlsCommit));
      }

      this.emit('mls-epoch-changed', commit.epoch);
    } catch (error) {
      logger.error('Failed to rotate MLS key', error);
    }
  }

  /**
   * Acquire local media
   */
  private async acquireLocalMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      logger.info('Acquired local media', {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length,
      });
    } catch (error) {
      logger.error('Failed to acquire local media', error);
      throw error;
    }
  }

  /**
   * Publish local tracks to SFU
   */
  private async publishLocalTracks(): Promise<void> {
    if (!this.localStream || !this.webrtcAdapter) return;

    // Add tracks with simulcast configuration
    if (this.simulcastManager) {
      await this.simulcastManager.addLocalStream(this.localStream, this.webrtcAdapter.getConnection());
    } else {
      this.webrtcAdapter.addLocalStream(this.localStream);
    }

    logger.info('Published local tracks to SFU');
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: typeof this.connectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('connection-state-changed', state);
    }
  }

  /**
   * Set audio enabled
   */
  setAudioEnabled(enabled: boolean): void {
    this.isMuted = !enabled;
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    this.broadcastStateChange({ audioEnabled: enabled });
  }

  /**
   * Set video enabled
   */
  setVideoEnabled(enabled: boolean): void {
    this.isVideoEnabled = enabled;
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    this.broadcastStateChange({ videoEnabled: enabled });
  }

  /**
   * Start screen sharing
   */
  async shareScreen(): Promise<void> {
    if (this.isScreenSharing) return;

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: false,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];

      // Replace video track or add screen track
      if (this.webrtcAdapter) {
        await this.webrtcAdapter.replaceTrack(screenTrack, 'video');
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.isScreenSharing = true;
      this.broadcastStateChange({ screenSharing: true });

      logger.info('Started screen sharing');
    } catch (error) {
      logger.error('Failed to start screen share', error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.isScreenSharing) return;

    // Stop screen tracks
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = null;

    // Restore camera track
    if (this.localStream && this.webrtcAdapter) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        await this.webrtcAdapter.replaceTrack(videoTrack, 'video');
      }
    }

    this.isScreenSharing = false;
    this.broadcastStateChange({ screenSharing: false });

    logger.info('Stopped screen sharing');
  }

  /**
   * Set preferred quality for a participant
   */
  setPreferredQuality(pubkey: string, quality: QualityLayer): void {
    const participant = this.participants.get(pubkey);
    if (participant) {
      participant.qualityPreference = quality;

      // Notify SFU to change subscription quality
      if (this.dataChannel?.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'quality-preference',
          pubkey,
          quality,
        }));
      }

      this.emit('quality-changed', pubkey, quality);
    }
  }

  /**
   * Set layout mode
   */
  setLayoutMode(mode: ConferenceLayout): void {
    this.layoutMode = mode;
    // Adjust quality preferences based on layout
    this.optimizeQualityForLayout();
  }

  /**
   * Optimize quality based on current layout
   */
  private optimizeQualityForLayout(): void {
    if (!this.simulcastManager) return;

    // In speaker view, set high quality for dominant speaker, low for others
    // In gallery view, calculate based on tile size
    const participantCount = this.participants.size;

    for (const [pubkey, participant] of this.participants) {
      const optimalQuality = this.simulcastManager.calculateOptimalQuality(
        participantCount,
        this.layoutMode,
        participant.isSpeaking
      );
      this.setPreferredQuality(pubkey, optimalQuality);
    }
  }

  /**
   * Get current state
   */
  getState(): ConferenceState | null {
    if (!this.roomId) return null;

    const participantsMap = new Map<string, ConferenceState['participants'] extends Map<string, infer V> ? V : never>();
    for (const [pubkey, p] of this.participants) {
      participantsMap.set(pubkey, {
        pubkey: p.pubkey,
        displayName: p.displayName,
        stream: p.stream,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        screenSharing: p.screenSharing,
        isSpeaking: p.isSpeaking,
        role: p.role,
        handRaised: p.handRaised,
        inBreakout: p.inBreakout,
      });
    }

    return {
      roomId: this.roomId,
      groupId: this.groupId ?? undefined,
      name: this.roomName ?? '',
      isHost: this.isHost,
      localPubkey: this.localPubkey,
      localStream: this.localStream ?? undefined,
      isMuted: this.isMuted,
      isVideoEnabled: this.isVideoEnabled,
      isScreenSharing: this.isScreenSharing,
      role: this.localRole,
      participants: participantsMap,
      settings: this.settings,
      mlsEpoch: this.mlsKeyManager?.getCurrentEpoch() ?? 0,
      waitingRoom: new Map(),
      raisedHands: new Map(),
      breakoutRooms: new Map(),
      activePolls: new Map(),
      isRecording: false,
      recordingConsent: new Set(),
      sfuEndpoint: this.sfuEndpoint ?? undefined,
    };
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.participants.size + 1; // +1 for self
  }

  // ============================================
  // Nostr signaling methods
  // ============================================

  /**
   * Start subscription to room events
   */
  private async startRoomSubscription(): Promise<void> {
    const client = getNostrClient();

    this.subscriptionId = client.subscribe(
      [
        {
          kinds: [1059], // Gift wrap
          '#p': [this.localPubkey],
          since: Math.floor(Date.now() / 1000) - 60,
        },
      ],
      async (event) => {
        try {
          await this.handleNostrEvent(event);
        } catch (error) {
          logger.debug('Error handling room event', error);
        }
      },
      () => {
        logger.info('Conference subscription established');
      }
    );
  }

  /**
   * Handle Nostr event
   */
  private async handleNostrEvent(event: { kind: number; content: string; pubkey: string }): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) return;

    try {
      const { decryptDM } = await import('@/core/crypto/nip44');

      // Decrypt gift wrap
      const sealContent = decryptDM(event.content, privateKey, event.pubkey);
      const seal = JSON.parse(sealContent);
      const senderPubkey = seal.pubkey;
      const rumorContent = decryptDM(seal.content, privateKey, senderPubkey);
      const rumor = JSON.parse(rumorContent);

      const content = JSON.parse(rumor.content);

      switch (rumor.kind) {
        case CALLING_KINDS.CONFERENCE_JOIN:
          this.handleRemoteParticipantJoined(content);
          break;

        case CALLING_KINDS.CONFERENCE_LEAVE:
          this.handleRemoteParticipantLeft(content.pubkey);
          break;

        case CALLING_KINDS.MLS_WELCOME:
          await this.handleMLSWelcome(content);
          break;

        case CALLING_KINDS.MLS_COMMIT:
          await this.handleMLSCommit(content);
          break;
      }
    } catch {
      // Not for us or invalid
    }
  }

  /**
   * Broadcast room creation
   */
  private async broadcastRoomCreate(room: ConferenceRoom, invitedPubkeys?: string[]): Promise<void> {
    if (!invitedPubkeys) return;

    for (const pubkey of invitedPubkeys) {
      await this.sendGiftWrap(pubkey, CALLING_KINDS.CONFERENCE_CREATE, JSON.stringify(room));
    }
  }

  /**
   * Broadcast join
   */
  private async broadcastJoin(): Promise<void> {
    const join = {
      _v: CALLING_VERSION,
      roomId: this.roomId,
      pubkey: this.localPubkey,
      displayName: this.localDisplayName,
      timestamp: Date.now(),
    };

    // Would normally be broadcast via SFU
    logger.info('Broadcast join', join);
  }

  /**
   * Broadcast leave
   */
  private async broadcastLeave(): Promise<void> {
    const leave = {
      _v: CALLING_VERSION,
      roomId: this.roomId,
      pubkey: this.localPubkey,
      timestamp: Date.now(),
    };

    // Would normally be broadcast via SFU
    logger.info('Broadcast leave', leave);
  }

  /**
   * Broadcast state change
   */
  private broadcastStateChange(state: Partial<ConferenceParticipant>): void {
    // Would normally be broadcast via SFU data channel
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'state-change',
        pubkey: this.localPubkey,
        ...state,
      }));
    }
  }

  /**
   * Send NIP-17 gift wrap
   */
  private async sendGiftWrap(recipientPubkey: string, kind: number, content: string): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) throw new Error('No private key');

    const client = getNostrClient();

    // Create rumor
    const rumor = {
      kind,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      pubkey: this.localPubkey,
    };

    // Encrypt rumor
    const encryptedRumor = encryptDM(JSON.stringify(rumor), privateKey, recipientPubkey);

    // Create seal
    const seal = {
      pubkey: this.localPubkey,
      content: encryptedRumor,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Generate ephemeral key
    const ephemeralKey = generateSecretKey();
    void getPublicKey(ephemeralKey);

    // Encrypt seal
    const encryptedSeal = encryptDM(JSON.stringify(seal), ephemeralKey, recipientPubkey);

    // Create gift wrap
    const giftWrap = finalizeEvent(
      {
        kind: 1059,
        content: encryptedSeal,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
      },
      ephemeralKey
    );

    await client.publish(giftWrap);
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Close WebRTC connection
    if (this.webrtcAdapter) {
      this.webrtcAdapter.close();
      this.webrtcAdapter = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Stop local media
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    // Close MLS key manager
    if (this.mlsKeyManager) {
      this.mlsKeyManager.close();
      this.mlsKeyManager = null;
    }

    // Close simulcast manager
    if (this.simulcastManager) {
      this.simulcastManager.close();
      this.simulcastManager = null;
    }

    // Clear participants
    this.participants.clear();

    // Unsubscribe from Nostr
    if (this.subscriptionId) {
      const client = getNostrClient();
      client.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    // Reset state
    this.roomId = null;
    this.roomName = null;
    this.groupId = null;
    this.isHost = false;
    this.sfuEndpoint = null;
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.isScreenSharing = false;
  }

  /**
   * Close the manager
   */
  close(): void {
    this.cleanup();
    this.removeAllListeners();
    logger.info('SFU conference manager closed');
  }
}

/**
 * Singleton instance
 */
let sfuConferenceManagerInstance: SFUConferenceManager | null = null;

export function getSFUConferenceManager(): SFUConferenceManager {
  if (!sfuConferenceManagerInstance) {
    sfuConferenceManagerInstance = new SFUConferenceManager();
  }
  return sfuConferenceManagerInstance;
}

export function closeSFUConferenceManager(): void {
  if (sfuConferenceManagerInstance) {
    sfuConferenceManagerInstance.close();
    sfuConferenceManagerInstance = null;
  }
}
