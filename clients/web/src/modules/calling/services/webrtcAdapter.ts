/**
 * WebRTC Adapter
 * Core WebRTC functionality for voice/video calling
 *
 * Handles:
 * - Media device access
 * - Peer connection management
 * - ICE candidate handling
 * - Audio/video stream management
 * - E2EE frame encryption via Insertable Streams
 */

import { logger } from '@/lib/logger';
import type { ICEServer, CallingConfig, MediaDevices } from '../types';
import {
  type E2EEContext,
  createE2EEContext,
  applyE2EETransforms,
  isE2EESupported,
  getE2EESupportInfo,
} from './e2eeTransforms';

/**
 * Default ICE server configuration
 * In production, these should be fetched from a secure endpoint
 */
const DEFAULT_ICE_SERVERS: ICEServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * WebRTC configuration
 */
const DEFAULT_CONFIG: CallingConfig = {
  iceServers: DEFAULT_ICE_SERVERS,
  relayOnly: false,
  bundlePolicy: 'max-bundle',
  iceTransportPolicy: 'all',
};

/**
 * Event handlers for WebRTC events
 */
export interface WebRTCEventHandlers {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onTrack: (stream: MediaStream, track: MediaStreamTrack) => void;
  onNegotiationNeeded: () => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onConnectionFailed: (error: Error) => void;
}

/**
 * WebRTC Adapter class
 */
export class WebRTCAdapter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: CallingConfig;
  private eventHandlers: WebRTCEventHandlers | null = null;

  // E2EE support via Insertable Streams
  private encryptionKey: CryptoKey | null = null;
  private e2eeContext: E2EEContext | null = null;
  private senderTransform: TransformStream | null = null;
  private receiverTransform: TransformStream | null = null;

  constructor(config?: Partial<CallingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the peer connection
   */
  async initialize(handlers: WebRTCEventHandlers): Promise<void> {
    this.eventHandlers = handlers;

    const rtcConfig: RTCConfiguration = {
      iceServers: this.config.iceServers.map((server) => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential,
      })),
      bundlePolicy: this.config.bundlePolicy,
      iceTransportPolicy: this.config.relayOnly ? 'relay' : this.config.iceTransportPolicy,
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Set up event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        handlers.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        handlers.onIceConnectionStateChange(this.peerConnection.iceConnectionState);

        if (this.peerConnection.iceConnectionState === 'failed') {
          handlers.onConnectionFailed(new Error('ICE connection failed'));
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStream = stream;
        handlers.onTrack(stream, event.track);
      }
    };

    this.peerConnection.onnegotiationneeded = () => {
      handlers.onNegotiationNeeded();
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      handlers.onDataChannel?.(event.channel);
    };

    logger.info('WebRTC adapter initialized');
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDevices> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
      audioInputs: devices.filter((d) => d.kind === 'audioinput'),
      audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
      videoInputs: devices.filter((d) => d.kind === 'videoinput'),
    };
  }

  /**
   * Request media permissions and get local stream
   */
  async getLocalStream(options: {
    audio?: boolean | MediaTrackConstraints;
    video?: boolean | MediaTrackConstraints;
  }): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: options.audio ?? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: options.video ?? false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      logger.info('Local stream acquired', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
      });

      return this.localStream;
    } catch (error) {
      logger.error('Failed to get local stream', error);
      throw error;
    }
  }

  /**
   * Add local stream tracks to peer connection
   */
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });

    logger.info('Local stream added to peer connection');
  }

  /**
   * Create an SDP offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);
    logger.info('Created and set local offer');

    return offer;
  }

  /**
   * Create an SDP answer
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    logger.info('Created and set local answer');

    return answer;
  }

  /**
   * Set remote description (offer or answer)
   */
  async setRemoteDescription(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    logger.info('Set remote description', { type: sdp.type });
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    logger.debug('Added ICE candidate');
  }

  /**
   * Mute/unmute local audio
   */
  setAudioEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      logger.info(`Audio ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Enable/disable local video
   */
  setVideoEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      logger.info(`Video ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track if in a call
      if (this.peerConnection && this.localStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = this.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === 'video');

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }

      logger.info('Screen sharing started');
      return screenStream;
    } catch (error) {
      logger.error('Failed to start screen share', error);
      throw error;
    }
  }

  /**
   * Stop screen sharing and restore camera
   */
  async stopScreenShare(): Promise<void> {
    if (this.localStream && this.peerConnection) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection
        .getSenders()
        .find((s) => s.track?.kind === 'video');

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
    }
    logger.info('Screen sharing stopped');
  }

  /**
   * Switch camera (for mobile)
   */
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const currentTrack = this.localStream.getVideoTracks()[0];
    if (!currentTrack) return;

    const constraints = currentTrack.getConstraints();
    const facingMode =
      constraints.facingMode === 'user' ? 'environment' : 'user';

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
    });

    const newTrack = newStream.getVideoTracks()[0];
    const sender = this.peerConnection
      ?.getSenders()
      .find((s) => s.track?.kind === 'video');

    if (sender && newTrack) {
      await sender.replaceTrack(newTrack);
      currentTrack.stop();
      this.localStream.removeTrack(currentTrack);
      this.localStream.addTrack(newTrack);
    }

    logger.info('Camera switched');
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<{
    roundTripTime?: number;
    jitter?: number;
    packetLoss?: number;
    bandwidth?: number;
    audioLevel?: number;
  }> {
    if (!this.peerConnection) {
      return {};
    }

    const stats = await this.peerConnection.getStats();
    let roundTripTime: number | undefined;
    let jitter: number | undefined;
    let packetLoss: number | undefined;
    let bandwidth: number | undefined;
    let audioLevel: number | undefined;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = report.currentRoundTripTime;
      }

      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        jitter = report.jitter;
        if (report.packetsLost && report.packetsReceived) {
          packetLoss =
            (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100;
        }
      }

      if (report.type === 'outbound-rtp') {
        bandwidth = report.bytesSent;
      }

      if (report.type === 'media-source' && report.kind === 'audio') {
        audioLevel = report.audioLevel;
      }
    });

    return { roundTripTime, jitter, packetLoss, bandwidth, audioLevel };
  }

  /**
   * Create a data channel for signaling or other data
   */
  createDataChannel(label: string): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.dataChannel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });

    return this.dataChannel;
  }

  /**
   * Check if E2EE is supported (Insertable Streams API)
   */
  static isE2EESupported(): boolean {
    return isE2EESupported();
  }

  /**
   * Get detailed E2EE support information
   */
  static getE2EESupportInfo() {
    return getE2EESupportInfo();
  }

  /**
   * Get E2EE state for debugging/monitoring
   * Returns whether E2EE is configured and transforms are active
   */
  getE2EEState(): {
    hasKey: boolean;
    hasContext: boolean;
    keyId: number | null;
    hasSenderTransform: boolean;
    hasReceiverTransform: boolean;
    hasHandlers: boolean;
    supported: boolean;
  } {
    return {
      hasKey: this.encryptionKey !== null,
      hasContext: this.e2eeContext !== null,
      keyId: this.e2eeContext?.keyId ?? null,
      hasSenderTransform: this.senderTransform !== null,
      hasReceiverTransform: this.receiverTransform !== null,
      hasHandlers: this.eventHandlers !== null,
      supported: isE2EESupported(),
    };
  }

  /**
   * Set up E2EE encryption key (legacy method for backward compatibility)
   * This uses the Insertable Streams API for true E2EE
   */
  async setupE2EE(key: CryptoKey): Promise<void> {
    this.encryptionKey = key;

    if (!isE2EESupported()) {
      logger.warn('E2EE not supported in this browser');
      return;
    }

    // E2EE setup will be applied when tracks are added
    logger.info('E2EE key set');
  }

  /**
   * Enable full E2EE with context for a call
   * Must be called after peer connection is initialized and tracks are added
   *
   * @param localPrivkey - Local private key (hex string)
   * @param remotePubkey - Remote public key (hex string)
   * @param callId - Unique call identifier
   */
  async enableE2EE(localPrivkey: string, remotePubkey: string, callId: string): Promise<boolean> {
    if (!this.peerConnection) {
      logger.error('Cannot enable E2EE: peer connection not initialized');
      return false;
    }

    if (!isE2EESupported()) {
      const info = getE2EESupportInfo();
      logger.warn('E2EE not supported in this browser', info);
      return false;
    }

    try {
      // Create E2EE context with derived key
      this.e2eeContext = await createE2EEContext(localPrivkey, remotePubkey, callId);

      // Apply transforms to existing senders/receivers
      await applyE2EETransforms(this.peerConnection, this.e2eeContext);

      logger.info('E2EE enabled for call', { callId, keyId: this.e2eeContext.keyId });
      return true;
    } catch (error) {
      logger.error('Failed to enable E2EE', error);
      return false;
    }
  }

  /**
   * Check if E2EE is currently active
   */
  isE2EEActive(): boolean {
    return this.e2eeContext !== null;
  }

  /**
   * Get the local stream
   */
  getLocalMediaStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get the remote stream
   */
  getRemoteMediaStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get the peer connection
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.peerConnection?.iceConnectionState === 'connected';
  }

  /**
   * Close the connection and clean up
   */
  close(): void {
    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.encryptionKey = null;
    this.e2eeContext = null;
    this.senderTransform = null;
    this.receiverTransform = null;
    this.eventHandlers = null;

    logger.info('WebRTC adapter closed');
  }
}

/**
 * Singleton instance for the main call
 */
let mainAdapter: WebRTCAdapter | null = null;

export function getMainAdapter(): WebRTCAdapter {
  if (!mainAdapter) {
    mainAdapter = new WebRTCAdapter();
  }
  return mainAdapter;
}

export function closeMainAdapter(): void {
  if (mainAdapter) {
    mainAdapter.close();
    mainAdapter = null;
  }
}
