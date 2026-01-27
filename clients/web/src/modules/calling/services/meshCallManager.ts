/**
 * Mesh Call Manager
 * Manages peer-to-peer mesh topology for small group calls (2-8 participants)
 *
 * Each participant connects directly to every other participant:
 * - 4 participants = 6 connections (n(n-1)/2)
 * - Connection ordering: Lower pubkey initiates to avoid duplicate offers
 * - E2EE via sender keys (each participant has their own key)
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCAdapter, type WebRTCEventHandlers } from './webrtcAdapter';
import { GroupKeyManager } from './groupKeyManager';
import { AudioMixer, ActiveSpeakerDetector } from './audioMixer';
import {
  CallType,
  Topology,
  GroupCallParticipantState,
  CALLING_KINDS,
  type GroupCallCreate,
  type GroupCallJoin,
  type GroupCallLeave,
  type GroupCallParticipant,
  type GroupCallState,
  type SenderKeyDistribution,
} from '../types';
import { CALLING_VERSION } from '@/generated/schemas/calling';
import { encryptDM } from '@/core/crypto/nip44';
import { getNostrClient } from '@/core/nostr/client';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';

/** Maximum participants for mesh topology */
const MAX_MESH_PARTICIPANTS = 8;

/** Connection timeout in milliseconds */
const CONNECTION_TIMEOUT_MS = 30000;

/** ICE reconnect delay */
const ICE_RECONNECT_DELAY_MS = 2000;

interface PeerConnection {
  connection: RTCPeerConnection;
  adapter: WebRTCAdapter;
  pubkey: string;
  displayName?: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  audioEnabled: boolean;
  videoEnabled: boolean;
  remoteStream?: MediaStream;
  pendingIceCandidates: RTCIceCandidateInit[];
}

/** Events emitted by MeshCallManager */
export interface MeshCallManagerEvents {
  'participant-joined': (pubkey: string, displayName?: string) => void;
  'participant-left': (pubkey: string) => void;
  'participant-state-changed': (pubkey: string, state: Partial<GroupCallParticipant>) => void;
  'remote-track': (pubkey: string, stream: MediaStream) => void;
  'active-speakers-changed': (speakers: string[]) => void;
  'dominant-speaker-changed': (speaker: string | null) => void;
  'connection-state-changed': (state: 'connecting' | 'connected' | 'disconnected') => void;
  'room-closed': (reason: string) => void;
  'error': (error: Error) => void;
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
 * Mesh Call Manager class
 */
export class MeshCallManager extends EventEmitter {
  // Room state
  private roomId: string | null = null;
  private groupId: string | null = null;
  private callType: CallType = CallType.Voice;
  private isHost = false;
  private roomLocked = false;

  // Local participant
  private localPubkey: string;
  private localDisplayName?: string;
  private localStream: MediaStream | null = null;

  // Peer connections (pubkey -> connection)
  private peers: Map<string, PeerConnection> = new Map();

  // E2EE
  private keyManager: GroupKeyManager | null = null;

  // Audio management
  private audioMixer: AudioMixer;
  private speakerDetector: ActiveSpeakerDetector;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;

  // Local state
  private isMuted = false;
  private isVideoEnabled = true;
  private isScreenSharing = false;

  // Nostr subscription
  private subscriptionId: string | null = null;

  constructor() {
    super();

    const { currentIdentity } = useAuthStore.getState();
    this.localPubkey = currentIdentity?.publicKey ?? '';
    this.localDisplayName = currentIdentity?.displayName;

    this.audioMixer = new AudioMixer();
    this.speakerDetector = new ActiveSpeakerDetector();

    // Set up speaker detection callbacks
    this.speakerDetector.setOnActiveSpeakersChange((speakers) => {
      this.emit('active-speakers-changed', speakers);
    });
    this.speakerDetector.setOnDominantSpeakerChange((speaker) => {
      this.emit('dominant-speaker-changed', speaker);
    });
  }

  /**
   * Create a new group call room
   */
  async createRoom(options: {
    groupId?: string;
    callType?: CallType;
    maxParticipants?: number;
    invitedPubkeys?: string[];
  } = {}): Promise<string> {
    if (this.roomId) {
      throw new Error('Already in a room');
    }

    const roomId = uuidv4();
    this.roomId = roomId;
    this.groupId = options.groupId ?? null;
    this.callType = options.callType ?? CallType.Voice;
    this.isHost = true;

    // Initialize E2EE key manager
    this.keyManager = new GroupKeyManager(roomId);
    this.keyManager.setOnKeyDistribution(async (dist) => {
      await this.broadcastSenderKey(dist);
    });

    // Start listening for room events
    await this.startRoomSubscription();

    // Get local media
    await this.acquireLocalMedia();

    // Broadcast room creation
    await this.broadcastRoomCreate({
      roomId,
      groupId: options.groupId,
      callType: this.callType,
      maxParticipants: options.maxParticipants ?? MAX_MESH_PARTICIPANTS,
      invitedPubkeys: options.invitedPubkeys,
    });

    // Generate and distribute sender key
    await this.keyManager.generateAndDistributeSenderKey([this.localPubkey]);

    logger.info('Created group call room', { roomId, callType: this.callType });
    return roomId;
  }

  /**
   * Join an existing group call room
   */
  async joinRoom(roomId: string, options: {
    displayName?: string;
  } = {}): Promise<void> {
    if (this.roomId) {
      throw new Error('Already in a room');
    }

    this.roomId = roomId;
    this.localDisplayName = options.displayName ?? this.localDisplayName;
    this.isHost = false;

    // Initialize E2EE key manager
    this.keyManager = new GroupKeyManager(roomId);
    this.keyManager.setOnKeyDistribution(async (dist) => {
      await this.broadcastSenderKey(dist);
    });

    // Start listening for room events
    await this.startRoomSubscription();

    // Get local media
    await this.acquireLocalMedia();

    // Broadcast join
    await this.broadcastJoin();

    // Start audio level monitoring
    this.startAudioLevelMonitoring();

    logger.info('Joined group call room', { roomId });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.roomId) return;

    // Broadcast leave
    await this.broadcastLeave();

    // Clean up
    this.cleanup();

    logger.info('Left group call room');
  }

  /**
   * Handle a new participant joining
   */
  private async handleParticipantJoined(join: GroupCallJoin): Promise<void> {
    if (join.pubkey === this.localPubkey) return;
    if (this.peers.has(join.pubkey)) return;

    logger.info('Participant joined', { pubkey: join.pubkey, displayName: join.displayName });

    // Determine who initiates the connection (lower pubkey initiates)
    const shouldInitiate = this.localPubkey < join.pubkey;

    if (shouldInitiate) {
      await this.connectToPeer(join.pubkey, join.displayName);
    }

    // Emit event
    this.emit('participant-joined', join.pubkey, join.displayName);

    // Redistribute sender key to include new participant
    if (this.keyManager && this.localStream) {
      const participants = [this.localPubkey, ...Array.from(this.peers.keys()), join.pubkey];
      await this.keyManager.generateAndDistributeSenderKey(participants);
    }
  }

  /**
   * Handle a participant leaving
   */
  private async handleParticipantLeft(leave: GroupCallLeave): Promise<void> {
    if (leave.pubkey === this.localPubkey) return;

    const peer = this.peers.get(leave.pubkey);
    if (!peer) return;

    logger.info('Participant left', { pubkey: leave.pubkey });

    // Clean up peer connection
    this.cleanupPeer(leave.pubkey);

    // Emit event
    this.emit('participant-left', leave.pubkey);

    // Rotate sender key for forward secrecy
    if (this.keyManager) {
      const remainingParticipants = [this.localPubkey, ...Array.from(this.peers.keys())];
      await this.keyManager.handleParticipantLeft(leave.pubkey, remainingParticipants);
    }
  }

  /**
   * Connect to a peer
   */
  private async connectToPeer(remotePubkey: string, displayName?: string): Promise<void> {
    if (this.peers.has(remotePubkey)) {
      logger.warn('Already connected to peer', { pubkey: remotePubkey });
      return;
    }

    logger.info('Connecting to peer', { pubkey: remotePubkey });

    // Create WebRTC adapter for this peer
    const adapter = new WebRTCAdapter();
    await adapter.initialize(this.createPeerHandlers(remotePubkey));

    // Create peer entry
    const peer: PeerConnection = {
      connection: adapter.getConnection(),
      adapter,
      pubkey: remotePubkey,
      displayName,
      state: 'connecting',
      audioEnabled: true,
      videoEnabled: this.callType === CallType.Video,
      pendingIceCandidates: [],
    };
    this.peers.set(remotePubkey, peer);

    // Add local stream
    if (this.localStream) {
      adapter.addLocalStream(this.localStream);
    }

    // Enable E2EE
    const privateKeyBytes = getCurrentPrivateKey();
    if (privateKeyBytes && this.roomId) {
      const privateKeyHex = bytesToHex(privateKeyBytes);
      await adapter.enableE2EE(privateKeyHex, remotePubkey, this.roomId);
    }

    // Create and send offer
    const offer = await adapter.createOffer();
    await this.sendSignalingMessage(remotePubkey, 'offer', {
      roomId: this.roomId,
      sdp: offer.sdp,
      callType: this.callType,
    });

    // Set connection timeout
    setTimeout(() => {
      const p = this.peers.get(remotePubkey);
      if (p && p.state === 'connecting') {
        logger.warn('Connection timeout', { pubkey: remotePubkey });
        this.cleanupPeer(remotePubkey);
        this.emit('error', new Error(`Connection to ${remotePubkey} timed out`));
      }
    }, CONNECTION_TIMEOUT_MS);
  }

  /**
   * Handle incoming offer from a peer
   */
  private async handleOffer(senderPubkey: string, data: { sdp: string; callType: CallType }): Promise<void> {
    // Lower pubkey should be the one initiating
    // If we receive an offer from a higher pubkey, they shouldn't be initiating
    if (senderPubkey > this.localPubkey) {
      logger.warn('Received offer from higher pubkey (they should not initiate)', { sender: senderPubkey });
      return;
    }

    if (this.peers.has(senderPubkey)) {
      logger.warn('Already have connection to peer', { pubkey: senderPubkey });
      return;
    }

    logger.info('Received offer from peer', { pubkey: senderPubkey });

    // Create WebRTC adapter for this peer
    const adapter = new WebRTCAdapter();
    await adapter.initialize(this.createPeerHandlers(senderPubkey));

    // Create peer entry
    const peer: PeerConnection = {
      connection: adapter.getConnection(),
      adapter,
      pubkey: senderPubkey,
      state: 'connecting',
      audioEnabled: true,
      videoEnabled: data.callType === CallType.Video,
      pendingIceCandidates: [],
    };
    this.peers.set(senderPubkey, peer);

    // Add local stream
    if (this.localStream) {
      adapter.addLocalStream(this.localStream);
    }

    // Enable E2EE
    const privateKeyBytes = getCurrentPrivateKey();
    if (privateKeyBytes && this.roomId) {
      const privateKeyHex = bytesToHex(privateKeyBytes);
      await adapter.enableE2EE(privateKeyHex, senderPubkey, this.roomId);
    }

    // Set remote description and create answer
    await adapter.setRemoteDescription({ type: 'offer', sdp: data.sdp });

    // Process any pending ICE candidates
    for (const candidate of peer.pendingIceCandidates) {
      await adapter.addIceCandidate(candidate);
    }
    peer.pendingIceCandidates = [];

    // Create answer
    const answer = await adapter.createAnswer();
    await this.sendSignalingMessage(senderPubkey, 'answer', {
      roomId: this.roomId,
      sdp: answer.sdp,
    });
  }

  /**
   * Handle incoming answer from a peer
   */
  private async handleAnswer(senderPubkey: string, data: { sdp: string }): Promise<void> {
    const peer = this.peers.get(senderPubkey);
    if (!peer) {
      logger.warn('Received answer for unknown peer', { pubkey: senderPubkey });
      return;
    }

    logger.info('Received answer from peer', { pubkey: senderPubkey });

    await peer.adapter.setRemoteDescription({ type: 'answer', sdp: data.sdp });

    // Process any pending ICE candidates
    for (const candidate of peer.pendingIceCandidates) {
      await peer.adapter.addIceCandidate(candidate);
    }
    peer.pendingIceCandidates = [];
  }

  /**
   * Handle incoming ICE candidate from a peer
   */
  private async handleIceCandidate(
    senderPubkey: string,
    data: { candidate: RTCIceCandidateInit }
  ): Promise<void> {
    const peer = this.peers.get(senderPubkey);
    if (!peer) {
      // Store for later
      logger.debug('Storing ICE candidate for unknown peer', { pubkey: senderPubkey });
      return;
    }

    if (peer.adapter.hasRemoteDescription()) {
      await peer.adapter.addIceCandidate(data.candidate);
    } else {
      peer.pendingIceCandidates.push(data.candidate);
    }
  }

  /**
   * Handle sender key distribution
   */
  private async handleSenderKeyDistribution(dist: SenderKeyDistribution): Promise<void> {
    if (!this.keyManager) return;
    await this.keyManager.handleSenderKeyDistribution(dist);
  }

  /**
   * Create WebRTC event handlers for a peer
   */
  private createPeerHandlers(remotePubkey: string): WebRTCEventHandlers {
    return {
      onIceCandidate: async (candidate) => {
        await this.sendSignalingMessage(remotePubkey, 'ice', {
          roomId: this.roomId,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid ?? undefined,
            sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
          },
        });
      },
      onIceConnectionStateChange: (state) => {
        this.handlePeerConnectionStateChange(remotePubkey, state);
      },
      onTrack: (stream, _track) => {
        const peer = this.peers.get(remotePubkey);
        if (peer) {
          peer.remoteStream = stream;

          // Add to audio mixer
          this.audioMixer.addParticipant(remotePubkey, stream);

          this.emit('remote-track', remotePubkey, stream);
        }
      },
      onNegotiationNeeded: async () => {
        logger.debug('Negotiation needed for peer', { pubkey: remotePubkey });
      },
      onConnectionFailed: (error) => {
        logger.error('Connection failed to peer', { pubkey: remotePubkey, error });
        this.handlePeerConnectionFailed(remotePubkey);
      },
    };
  }

  /**
   * Handle peer connection state change
   */
  private handlePeerConnectionStateChange(pubkey: string, state: RTCIceConnectionState): void {
    const peer = this.peers.get(pubkey);
    if (!peer) return;

    switch (state) {
      case 'connected':
        peer.state = 'connected';
        logger.info('Peer connected', { pubkey });
        this.emit('participant-state-changed', pubkey, { state: GroupCallParticipantState.Connected });
        break;

      case 'disconnected':
        peer.state = 'disconnected';
        logger.warn('Peer disconnected', { pubkey });
        this.emit('participant-state-changed', pubkey, { state: GroupCallParticipantState.Reconnecting });

        // Try to reconnect after a delay
        setTimeout(() => {
          const p = this.peers.get(pubkey);
          if (p && p.state === 'disconnected') {
            this.handlePeerConnectionFailed(pubkey);
          }
        }, ICE_RECONNECT_DELAY_MS);
        break;

      case 'failed':
        this.handlePeerConnectionFailed(pubkey);
        break;
    }

    this.updateOverallConnectionState();
  }

  /**
   * Handle peer connection failure
   */
  private handlePeerConnectionFailed(pubkey: string): void {
    logger.error('Peer connection failed', { pubkey });
    this.cleanupPeer(pubkey);
    this.emit('participant-left', pubkey);
  }

  /**
   * Update overall connection state
   */
  private updateOverallConnectionState(): void {
    const peerStates = Array.from(this.peers.values()).map((p) => p.state);

    if (peerStates.length === 0) {
      this.emit('connection-state-changed', 'disconnected');
    } else if (peerStates.every((s) => s === 'connected')) {
      this.emit('connection-state-changed', 'connected');
    } else if (peerStates.some((s) => s === 'connecting')) {
      this.emit('connection-state-changed', 'connecting');
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
        video: this.callType === CallType.Video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      });

      // Apply initial mute state
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
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
   * Start monitoring audio levels for speaker detection
   */
  private startAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) return;

    this.audioLevelInterval = setInterval(() => {
      // Get audio levels for all participants
      const levels = this.audioMixer.getAllAudioLevels();

      // Update speaker detector
      for (const [pubkey, level] of levels) {
        this.speakerDetector.updateLevel(pubkey, level);
      }

      // Also check local audio level
      if (this.localStream) {
        // For local audio, we'd need a separate analyser
        // For now, we just use the mute state
      }
    }, 100); // 100ms interval
  }

  /**
   * Stop audio level monitoring
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    // Broadcast state change
    this.broadcastStateChange({ audioEnabled: !this.isMuted });

    return this.isMuted;
  }

  /**
   * Toggle video
   */
  toggleVideo(): boolean {
    this.isVideoEnabled = !this.isVideoEnabled;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }

    // Broadcast state change
    this.broadcastStateChange({ videoEnabled: this.isVideoEnabled });

    return this.isVideoEnabled;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    if (this.isScreenSharing) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      for (const peer of this.peers.values()) {
        await peer.adapter.replaceTrack(screenTrack, 'video');
      }

      // Handle screen share stop
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

    // Get camera video track
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        for (const peer of this.peers.values()) {
          await peer.adapter.replaceTrack(videoTrack, 'video');
        }
      }
    }

    this.isScreenSharing = false;
    this.broadcastStateChange({ screenSharing: false });

    logger.info('Stopped screen sharing');
  }

  /**
   * Request mute from a participant (host only)
   */
  async requestMute(pubkey: string): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can request mute');
    }

    await this.sendSignalingMessage(pubkey, 'mute-request', { roomId: this.roomId });
  }

  /**
   * Remove a participant (host only)
   */
  async removeParticipant(pubkey: string): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can remove participants');
    }

    await this.sendSignalingMessage(pubkey, 'remove', { roomId: this.roomId });
    this.cleanupPeer(pubkey);
    this.emit('participant-left', pubkey);
  }

  /**
   * Check if the room is locked
   */
  isRoomLocked(): boolean {
    return this.roomLocked;
  }

  /**
   * Lock the room (host only)
   */
  lockRoom(): void {
    if (!this.isHost) {
      throw new Error('Only host can lock room');
    }
    this.roomLocked = true;
    this.broadcastRoomState({ locked: true });
  }

  /**
   * Unlock the room (host only)
   */
  unlockRoom(): void {
    if (!this.isHost) {
      throw new Error('Only host can unlock room');
    }
    this.roomLocked = false;
    this.broadcastRoomState({ locked: false });
  }

  /**
   * End the call (host only)
   */
  async endCall(): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can end call');
    }

    // Notify all participants
    for (const pubkey of this.peers.keys()) {
      await this.sendSignalingMessage(pubkey, 'end', { roomId: this.roomId });
    }

    this.cleanup();
    this.emit('room-closed', 'host_ended');
  }

  /**
   * Get current room state
   */
  getState(): GroupCallState | null {
    if (!this.roomId) return null;

    const participants = new Map<string, {
      pubkey: string;
      displayName?: string;
      stream?: MediaStream;
      audioEnabled: boolean;
      videoEnabled: boolean;
      isSpeaking: boolean;
      peerConnection?: RTCPeerConnection;
    }>();

    for (const [pubkey, peer] of this.peers) {
      participants.set(pubkey, {
        pubkey,
        displayName: peer.displayName,
        stream: peer.remoteStream,
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        isSpeaking: this.speakerDetector.isSpeaking(pubkey),
        peerConnection: peer.connection,
      });
    }

    return {
      roomId: this.roomId,
      groupId: this.groupId ?? undefined,
      callType: this.callType,
      topology: Topology.Mesh,
      isHost: this.isHost,
      localPubkey: this.localPubkey,
      localStream: this.localStream ?? undefined,
      isMuted: this.isMuted,
      isVideoEnabled: this.isVideoEnabled,
      isScreenSharing: this.isScreenSharing,
      participants,
      senderKeyId: this.keyManager?.getCurrentKeyId(),
      receivedKeys: new Map(),
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
    return this.peers.size + 1; // +1 for self
  }

  /**
   * Check if room is at capacity
   */
  isAtCapacity(): boolean {
    return this.getParticipantCount() >= MAX_MESH_PARTICIPANTS;
  }

  // ============================================
  // Nostr signaling methods
  // ============================================

  /**
   * Start subscription to room events
   */
  private async startRoomSubscription(): Promise<void> {
    const client = getNostrClient();

    // Subscribe to gift-wrapped messages for room events
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
        logger.info('Room subscription established');
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

      // Route based on kind
      const content = JSON.parse(rumor.content);

      switch (rumor.kind) {
        case CALLING_KINDS.GROUP_CALL_JOIN:
          await this.handleParticipantJoined(content);
          break;

        case CALLING_KINDS.GROUP_CALL_LEAVE:
          await this.handleParticipantLeft(content);
          break;

        case CALLING_KINDS.SENDER_KEY:
          await this.handleSenderKeyDistribution(content);
          break;

        // Custom signaling for mesh
        case 24315: // mesh-offer
          await this.handleOffer(senderPubkey, content);
          break;

        case 24316: // mesh-answer
          await this.handleAnswer(senderPubkey, content);
          break;

        case 24317: // mesh-ice
          await this.handleIceCandidate(senderPubkey, content);
          break;

        case 24318: // mesh-state
          this.handleRemoteStateChange(senderPubkey, content);
          break;

        case 24319: // mesh-control (mute-request, remove, end)
          this.handleControlMessage(senderPubkey, content);
          break;
      }
    } catch {
      // Not for us or invalid
    }
  }

  /**
   * Handle remote state change
   */
  private handleRemoteStateChange(pubkey: string, state: Partial<GroupCallParticipant>): void {
    const peer = this.peers.get(pubkey);
    if (!peer) return;

    if (state.audioEnabled !== undefined) {
      peer.audioEnabled = state.audioEnabled;
    }
    if (state.videoEnabled !== undefined) {
      peer.videoEnabled = state.videoEnabled;
    }

    this.emit('participant-state-changed', pubkey, state);
  }

  /**
   * Handle control message
   */
  private handleControlMessage(_pubkey: string, message: { type: string; roomId: string }): void {
    if (message.roomId !== this.roomId) return;

    switch (message.type) {
      case 'mute-request':
        // Auto-mute when host requests
        if (!this.isMuted) {
          this.toggleMute();
        }
        break;

      case 'remove':
        // Kicked by host
        this.cleanup();
        this.emit('room-closed', 'removed');
        break;

      case 'end':
        // Room ended by host
        this.cleanup();
        this.emit('room-closed', 'host_ended');
        break;
    }
  }

  /**
   * Send a signaling message to a peer
   */
  private async sendSignalingMessage(
    recipientPubkey: string,
    type: 'offer' | 'answer' | 'ice' | 'state' | 'mute-request' | 'remove' | 'end',
    data: Record<string, unknown>
  ): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) throw new Error('No private key');

    const kindMap: Record<string, number> = {
      'offer': 24315,
      'answer': 24316,
      'ice': 24317,
      'state': 24318,
      'mute-request': 24319,
      'remove': 24319,
      'end': 24319,
    };

    const content = type === 'mute-request' || type === 'remove' || type === 'end'
      ? { type, ...data }
      : data;

    await this.sendGiftWrap(recipientPubkey, kindMap[type], JSON.stringify(content));
  }

  /**
   * Broadcast room creation
   */
  private async broadcastRoomCreate(options: {
    roomId: string;
    groupId?: string;
    callType: CallType;
    maxParticipants: number;
    invitedPubkeys?: string[];
  }): Promise<void> {
    const create: GroupCallCreate = {
      _v: CALLING_VERSION,
      roomId: options.roomId,
      groupId: options.groupId,
      callType: options.callType,
      createdBy: this.localPubkey,
      timestamp: Date.now(),
      maxParticipants: options.maxParticipants,
      invitedPubkeys: options.invitedPubkeys,
      topology: Topology.Mesh,
    };

    // Send to invited participants
    if (options.invitedPubkeys) {
      for (const pubkey of options.invitedPubkeys) {
        await this.sendGiftWrap(pubkey, CALLING_KINDS.GROUP_CALL_CREATE, JSON.stringify(create));
      }
    }
  }

  /**
   * Broadcast join
   */
  private async broadcastJoin(): Promise<void> {
    const join: GroupCallJoin = {
      _v: CALLING_VERSION,
      roomId: this.roomId!,
      pubkey: this.localPubkey,
      displayName: this.localDisplayName,
      timestamp: Date.now(),
    };

    // Send to all existing participants we know about
    for (const pubkey of this.peers.keys()) {
      await this.sendGiftWrap(pubkey, CALLING_KINDS.GROUP_CALL_JOIN, JSON.stringify(join));
    }
  }

  /**
   * Broadcast leave
   */
  private async broadcastLeave(): Promise<void> {
    const leave: GroupCallLeave = {
      _v: CALLING_VERSION,
      roomId: this.roomId!,
      pubkey: this.localPubkey,
      timestamp: Date.now(),
    };

    for (const pubkey of this.peers.keys()) {
      await this.sendGiftWrap(pubkey, CALLING_KINDS.GROUP_CALL_LEAVE, JSON.stringify(leave));
    }
  }

  /**
   * Broadcast sender key
   */
  private async broadcastSenderKey(dist: SenderKeyDistribution): Promise<void> {
    // The distribution already has encrypted keys per participant
    // Send to all participants who have an encrypted key
    for (const pubkey of Object.keys(dist.encryptedKeys)) {
      await this.sendGiftWrap(pubkey, CALLING_KINDS.SENDER_KEY, JSON.stringify(dist));
    }
  }

  /**
   * Broadcast local state change
   */
  private broadcastStateChange(state: Partial<GroupCallParticipant>): void {
    const message = {
      roomId: this.roomId,
      ...state,
    };

    for (const pubkey of this.peers.keys()) {
      this.sendSignalingMessage(pubkey, 'state', message).catch((error) => {
        logger.error('Failed to broadcast state change', error);
      });
    }
  }

  /**
   * Broadcast room state change (host only)
   */
  private broadcastRoomState(state: { locked?: boolean }): void {
    const message = {
      roomId: this.roomId,
      type: 'room-state',
      ...state,
    };

    for (const pubkey of this.peers.keys()) {
      this.sendGiftWrap(pubkey, 24318, JSON.stringify(message)).catch((error) => {
        logger.error('Failed to broadcast room state', error);
      });
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
   * Clean up a peer connection
   */
  private cleanupPeer(pubkey: string): void {
    const peer = this.peers.get(pubkey);
    if (!peer) return;

    try {
      peer.adapter.close();
    } catch {
      // Already closed
    }

    // Remove from audio mixer
    this.audioMixer.removeParticipant(pubkey);
    this.speakerDetector.removeParticipant(pubkey);

    this.peers.delete(pubkey);
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    // Stop audio level monitoring
    this.stopAudioLevelMonitoring();

    // Close all peer connections
    for (const pubkey of this.peers.keys()) {
      this.cleanupPeer(pubkey);
    }

    // Stop local media
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close key manager
    if (this.keyManager) {
      this.keyManager.close();
      this.keyManager = null;
    }

    // Close audio mixer
    this.audioMixer.close();
    this.speakerDetector.clear();

    // Unsubscribe from Nostr
    if (this.subscriptionId) {
      const client = getNostrClient();
      client.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    // Reset state
    this.roomId = null;
    this.groupId = null;
    this.isHost = false;
    this.roomLocked = false;
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
    logger.info('Mesh call manager closed');
  }
}

/**
 * Singleton instance
 */
let meshCallManagerInstance: MeshCallManager | null = null;

export function getMeshCallManager(): MeshCallManager {
  if (!meshCallManagerInstance) {
    meshCallManagerInstance = new MeshCallManager();
  }
  return meshCallManagerInstance;
}

export function closeMeshCallManager(): void {
  if (meshCallManagerInstance) {
    meshCallManagerInstance.close();
    meshCallManagerInstance = null;
  }
}
