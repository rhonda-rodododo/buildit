/**
 * PSTN Call Manager
 * Handles WebRTC-PSTN bridging for inbound and outbound phone calls
 */

import { EventEmitter } from 'events';
import type { LocalPSTNCall } from '../types';
import { CALLING_KINDS } from '../types';
import { useCallingStore } from '../callingStore';
import type { SignalingService } from './signalingService';
import { fetchWithRetry } from './utils';

/**
 * PSTN bridge configuration
 */
interface PSTNBridgeConfig {
  workerUrl: string;
  sipDomain?: string;
}

/**
 * Outbound call options
 */
interface OutboundCallOptions {
  targetPhone: string;
  hotlineId: string;
  callerId?: string;
}

/**
 * PSTN call events
 */
export interface PSTNCallManagerEvents {
  'pstn-connected': (call: LocalPSTNCall) => void;
  'pstn-disconnected': (callSid: string, reason: string) => void;
  'pstn-error': (callSid: string, error: Error) => void;
  'pstn-quality-warning': (callSid: string, metric: string, value: number) => void;
  'pstn-hold': (callSid: string) => void;
  'pstn-resume': (callSid: string) => void;
  'caller-revealed': (callSid: string, phone: string) => void;
}

/**
 * PSTN Call Manager
 * Manages WebRTC-PSTN bridged calls for hotlines
 */
export class PSTNCallManager extends EventEmitter {
  private signalingService: SignalingService;
  private activeCalls: Map<string, LocalPSTNCall> = new Map();
  private callDurations: Map<string, NodeJS.Timeout> = new Map();

  // API endpoints
  private readonly API_BASE: string;

  constructor(
    signalingService: SignalingService,
    config: PSTNBridgeConfig
  ) {
    super();
    this.signalingService = signalingService;
    this.API_BASE = config.workerUrl;
  }

  /**
   * Handle incoming PSTN event from signaling
   * This should be called from the main signaling event handler
   */
  handleSignalingEvent(event: { kind: number; content: string }): void {
    if (event.kind === CALLING_KINDS.PSTN_INBOUND) {
      this.handleIncomingPSTNNotification(JSON.parse(event.content));
    } else if (event.kind === CALLING_KINDS.PSTN_BRIDGE) {
      this.handleBridgeEvent(JSON.parse(event.content));
    }
  }

  /**
   * Handle incoming PSTN call notification
   */
  private handleIncomingPSTNNotification(data: {
    callSid: string;
    hotlineId: string;
    maskedCallerId: string;
    queuePosition?: number;
  }): void {
    const call: LocalPSTNCall = {
      callSid: data.callSid,
      hotlineId: data.hotlineId,
      direction: 'inbound',
      callerPhone: data.maskedCallerId,
      status: 'queued',
      startedAt: Date.now(),
      duration: 0,
      isWebRTCBridged: false,
    };

    this.activeCalls.set(data.callSid, call);
    useCallingStore.getState().addPSTNCall(call);
  }

  /**
   * Handle bridge events from the PSTN bridge
   */
  private handleBridgeEvent(data: {
    type: string;
    callSid: string;
    [key: string]: unknown;
  }): void {
    const call = this.activeCalls.get(data.callSid);
    if (!call) return;

    switch (data.type) {
      case 'connected':
        call.status = 'connected';
        call.connectedAt = Date.now();
        call.isWebRTCBridged = true;
        this.startDurationTimer(data.callSid);
        this.emit('pstn-connected', call);
        break;

      case 'disconnected':
        call.status = 'completed';
        this.stopDurationTimer(data.callSid);
        this.emit('pstn-disconnected', data.callSid, data.reason as string || 'normal');
        this.cleanup(data.callSid);
        break;

      case 'error':
        call.status = 'failed';
        this.emit('pstn-error', data.callSid, new Error(data.message as string || 'Unknown error'));
        this.cleanup(data.callSid);
        break;

      case 'quality':
        if (typeof data.metric === 'string' && typeof data.value === 'number') {
          this.emit('pstn-quality-warning', data.callSid, data.metric, data.value);
        }
        break;
    }

    useCallingStore.getState().updatePSTNCall(data.callSid, call);
  }

  /**
   * Answer an incoming PSTN call (operator answering from queue)
   */
  async answerPSTNCall(callSid: string, operatorPubkey: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status !== 'queued' && call.status !== 'ringing') {
      throw new Error(`Cannot answer call in ${call.status} state`);
    }

    // Request bridge from backend with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/answer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid,
          operatorPubkey,
        }),
      },
      { maxRetries: 2 } // Lower retries for time-sensitive call operations
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to answer call: ${error}`);
    }

    const { sipUri, webrtcConfig } = await response.json();

    // Update call state
    call.status = 'ringing';
    call.operatorPubkey = operatorPubkey;
    useCallingStore.getState().updatePSTNCall(callSid, call);

    // Setup WebRTC connection to SIP bridge
    await this.setupWebRTCBridge(callSid, sipUri, webrtcConfig);

    // Notify via signaling
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.PSTN_BRIDGE,
      content: JSON.stringify({
        _v: '1',
        callSid,
        type: 'answer',
        operatorPubkey,
        timestamp: Date.now(),
      }),
      tags: [],
    });
  }

  /**
   * Initiate an outbound PSTN call
   */
  async dialOutbound(options: OutboundCallOptions): Promise<string> {
    const { targetPhone, hotlineId, callerId } = options;

    // Request outbound call from backend with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/outbound`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPhone,
          hotlineId,
          callerId,
          operatorPubkey: useCallingStore.getState().localPubkey,
        }),
      },
      { maxRetries: 2 }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to initiate call: ${error}`);
    }

    const { callSid, sipUri, webrtcConfig } = await response.json();

    // Create local call state
    const call: LocalPSTNCall = {
      callSid,
      hotlineId,
      direction: 'outbound',
      targetPhone,
      operatorPubkey: useCallingStore.getState().localPubkey,
      status: 'ringing',
      startedAt: Date.now(),
      duration: 0,
      isWebRTCBridged: false,
    };

    this.activeCalls.set(callSid, call);
    useCallingStore.getState().addPSTNCall(call);

    // Setup WebRTC connection to SIP bridge
    await this.setupWebRTCBridge(callSid, sipUri, webrtcConfig);

    // Notify via signaling
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.PSTN_OUTBOUND,
      content: JSON.stringify({
        _v: '1',
        callSid,
        hotlineId,
        targetPhone: this.maskPhoneNumber(targetPhone),
        timestamp: Date.now(),
      }),
      tags: [],
    });

    return callSid;
  }

  /**
   * Setup WebRTC connection to SIP bridge
   */
  private async setupWebRTCBridge(
    callSid: string,
    sipUri: string,
    webrtcConfig: RTCConfiguration
  ): Promise<void> {
    // Get local media stream
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false, // PSTN is audio-only
    });

    // Setup peer connection for SIP bridge
    const pc = new RTCPeerConnection(webrtcConfig);

    // Add local audio track
    localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Handle remote audio
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      // Route remote audio to default output
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(() => {
        // Autoplay may be blocked
      });
    };

    // Create offer for SIP bridge
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer to SIP bridge with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/bridge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid,
          sipUri,
          sdp: offer.sdp,
        }),
      },
      { maxRetries: 2 }
    ).catch((error) => {
      pc.close();
      throw error;
    });

    if (!response.ok) {
      pc.close();
      throw new Error('Failed to connect to SIP bridge');
    }

    const { sdp: answerSdp } = await response.json();

    // Set remote description from SIP bridge
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    });

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      const call = this.activeCalls.get(callSid);
      if (!call) return;

      switch (pc.connectionState) {
        case 'connected':
          call.status = 'connected';
          call.connectedAt = Date.now();
          call.isWebRTCBridged = true;
          this.startDurationTimer(callSid);
          this.emit('pstn-connected', call);
          break;

        case 'disconnected':
        case 'failed':
          call.status = 'completed';
          this.emit('pstn-disconnected', callSid, pc.connectionState);
          this.cleanup(callSid);
          break;
      }

      useCallingStore.getState().updatePSTNCall(callSid, call);
    };

    // Store peer connection reference
    const call = this.activeCalls.get(callSid);
    if (call) {
      (call as LocalPSTNCall & { peerConnection?: RTCPeerConnection }).peerConnection = pc;
    }
  }

  /**
   * Put a PSTN call on hold
   */
  async holdPSTNCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== 'connected') {
      throw new Error('Call not connected');
    }

    // Notify backend to play hold music to caller with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/hold`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, action: 'hold' }),
      },
      { maxRetries: 2 }
    );

    if (!response.ok) {
      throw new Error('Failed to put call on hold');
    }

    call.status = 'on_hold';
    useCallingStore.getState().updatePSTNCall(callSid, call);
    this.emit('pstn-hold', callSid);
  }

  /**
   * Resume a PSTN call from hold
   */
  async resumePSTNCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== 'on_hold') {
      throw new Error('Call not on hold');
    }

    // Notify backend to stop hold music with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/hold`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, action: 'resume' }),
      },
      { maxRetries: 2 }
    );

    if (!response.ok) {
      throw new Error('Failed to resume call');
    }

    call.status = 'connected';
    useCallingStore.getState().updatePSTNCall(callSid, call);
    this.emit('pstn-resume', callSid);
  }

  /**
   * Transfer a PSTN call to another phone number
   */
  async transferPSTNCall(callSid: string, targetPhone: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    // Request transfer from backend with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/transfer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid,
          targetPhone,
        }),
      },
      { maxRetries: 2 }
    );

    if (!response.ok) {
      throw new Error('Failed to transfer call');
    }

    // Backend will handle the actual transfer
    // This call will be disconnected from our end
    call.status = 'completed';
    useCallingStore.getState().updatePSTNCall(callSid, call);
    this.cleanup(callSid);
  }

  /**
   * End a PSTN call
   */
  async endPSTNCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) return;

    // Notify backend to end call with retry (best effort)
    await fetchWithRetry(
      `${this.API_BASE}/api/pstn/voice/hangup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid }),
      },
      { maxRetries: 1 }
    ).catch(() => {
      // Ignore errors, call might already be ended
    });

    // Clean up WebRTC
    const callWithPc = call as LocalPSTNCall & { peerConnection?: RTCPeerConnection };
    if (callWithPc.peerConnection) {
      callWithPc.peerConnection.close();
    }

    call.status = 'completed';
    useCallingStore.getState().updatePSTNCall(callSid, call);
    this.emit('pstn-disconnected', callSid, 'user_hangup');
    this.cleanup(callSid);
  }

  /**
   * Reveal the real phone number (requires authorization)
   */
  async revealCallerPhone(callSid: string, operatorPubkey: string): Promise<string> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.direction !== 'inbound') {
      throw new Error('Call not found or not inbound');
    }

    // Request reveal from backend (will be audited) with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/caller/reveal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid,
          operatorPubkey,
          maskedId: call.callerPhone,
        }),
      },
      {
        maxRetries: 2,
        // Don't retry on 403 authorization errors
        retryOn: (error) => {
          if (error instanceof Error && error.message.includes('403')) {
            return false;
          }
          return true;
        },
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized to reveal caller phone');
      }
      throw new Error('Failed to reveal caller phone');
    }

    const { phone } = await response.json();
    this.emit('caller-revealed', callSid, phone);
    return phone;
  }

  /**
   * Get active PSTN call
   */
  getCall(callSid: string): LocalPSTNCall | undefined {
    return this.activeCalls.get(callSid);
  }

  /**
   * Get all active PSTN calls
   */
  getAllCalls(): LocalPSTNCall[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Mask a phone number for privacy
   */
  private maskPhoneNumber(phone: string): string {
    // Show only last 4 digits
    if (phone.length <= 4) return '****';
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }

  /**
   * Start duration timer for a call
   */
  private startDurationTimer(callSid: string): void {
    // Clear any existing timer
    this.stopDurationTimer(callSid);

    // Update duration every second
    const timer = setInterval(() => {
      const call = this.activeCalls.get(callSid);
      if (call && call.connectedAt) {
        call.duration = Math.floor((Date.now() - call.connectedAt) / 1000);
        useCallingStore.getState().updatePSTNCall(callSid, { duration: call.duration });
      }
    }, 1000);

    this.callDurations.set(callSid, timer);
  }

  /**
   * Stop duration timer for a call
   */
  private stopDurationTimer(callSid: string): void {
    const timer = this.callDurations.get(callSid);
    if (timer) {
      clearInterval(timer);
      this.callDurations.delete(callSid);
    }
  }

  /**
   * Clean up call resources
   */
  private cleanup(callSid: string): void {
    this.stopDurationTimer(callSid);
    this.activeCalls.delete(callSid);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop all duration timers
    for (const timer of this.callDurations.values()) {
      clearInterval(timer);
    }
    this.callDurations.clear();

    // Close all peer connections
    for (const call of this.activeCalls.values()) {
      const callWithPc = call as LocalPSTNCall & { peerConnection?: RTCPeerConnection };
      if (callWithPc.peerConnection) {
        callWithPc.peerConnection.close();
      }
    }
    this.activeCalls.clear();

    this.removeAllListeners();
  }
}

/**
 * Create a PSTN Call Manager instance
 */
export function createPSTNCallManager(
  signalingService: SignalingService,
  config: PSTNBridgeConfig
): PSTNCallManager {
  return new PSTNCallManager(signalingService, config);
}

export default PSTNCallManager;
