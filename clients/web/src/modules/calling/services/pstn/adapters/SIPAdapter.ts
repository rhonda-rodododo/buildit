/**
 * SIP Adapter
 * Generic SIP adapter for Asterisk, FreePBX, and other SIP providers
 *
 * This adapter uses WebRTC-SIP bridging via JsSIP or similar library.
 * It requires a SIP-to-WebRTC gateway or a SIP provider that supports WebRTC.
 */

import {
  BasePSTNProviderAdapter,
  type PSTNProviderConfig,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type ProviderTestResult,
  type SIPConfig,
} from '../PSTNProviderAdapter';

/**
 * SIP Registration states
 */
type SIPRegistrationState = 'unregistered' | 'registering' | 'registered' | 'failed';

/**
 * Active SIP call info
 */
interface ActiveSIPCall {
  callId: string;
  sipCallId: string;
  direction: 'inbound' | 'outbound';
  status: 'initiating' | 'ringing' | 'connected' | 'on_hold' | 'ended';
  remoteUri: string;
  localStream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

/**
 * SIP Adapter
 * Enables PSTN calling through self-hosted Asterisk/FreePBX or generic SIP providers
 */
export class SIPAdapter extends BasePSTNProviderAdapter {
  readonly providerType: 'asterisk' | 'custom-sip';

  private sipConfig: SIPConfig | null = null;
  private registrationState: SIPRegistrationState = 'unregistered';
  private activeCalls: Map<string, ActiveSIPCall> = new Map();
  private registrationTimeout: ReturnType<typeof setTimeout> | null = null;

  // WebRTC configuration for SIP
  private webrtcConfig: RTCConfiguration = {
    iceServers: [],
  };

  constructor(config: PSTNProviderConfig) {
    super(config);

    this.providerType = config.providerType === 'asterisk' ? 'asterisk' : 'custom-sip';

    if (config.credentials?.type === 'asterisk' || config.credentials?.type === 'custom-sip') {
      this.sipConfig = config.credentials.config;
      this.setupWebRTCConfig();
    }
  }

  private setupWebRTCConfig(): void {
    if (!this.sipConfig) return;

    const iceServers: RTCIceServer[] = [];

    // Add STUN servers
    if (this.sipConfig.stunServers?.length) {
      iceServers.push({
        urls: this.sipConfig.stunServers,
      });
    } else {
      // Default STUN servers
      iceServers.push({
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      });
    }

    // Add TURN servers if configured
    if (this.sipConfig.turnServers?.length) {
      iceServers.push(...this.sipConfig.turnServers);
    }

    this.webrtcConfig = { iceServers };
  }

  async initialize(): Promise<void> {
    if (!this.sipConfig) {
      this.status.connected = false;
      this.status.lastError = 'No SIP configuration provided';
      return;
    }

    const result = await this.testConnection();
    this.status.connected = result.success;
    this.status.registrationStatus = result.registrationStatus as 'registered' | 'registering' | 'unregistered' | 'failed';

    if (!result.success) {
      this.status.lastError = result.error;
      this.status.lastErrorAt = Date.now();
    }
  }

  async destroy(): Promise<void> {
    // Close all active calls
    for (const [callId] of this.activeCalls) {
      await this.endCall(callId);
    }

    // Clear registration timeout
    if (this.registrationTimeout) {
      clearTimeout(this.registrationTimeout);
      this.registrationTimeout = null;
    }

    this.registrationState = 'unregistered';
    // Update status to reflect registration state
    this.status.registrationStatus = this.registrationState;
    this.status.connected = false;
    this.status.registrationStatus = 'unregistered';
    this.activeCalls.clear();
  }

  async testConnection(): Promise<ProviderTestResult> {
    if (!this.sipConfig) {
      return {
        success: false,
        error: 'No SIP configuration provided',
      };
    }

    const startTime = Date.now();

    try {
      // Test connection by attempting to resolve the SIP server
      const sipUri = this.buildSIPUri('test');

      // For WebRTC-SIP, we attempt a basic OPTIONS ping
      // In a real implementation, this would use JsSIP or SIP.js
      const registrarUrl = this.getWebSocketUrl();

      // Log SIP URI for debugging (will be used when OPTIONS ping is implemented)
      console.debug(`Testing SIP connection to ${sipUri} via ${registrarUrl}`);

      // Simple connectivity test - check if WebSocket endpoint is reachable
      const testPromise = new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(registrarUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });

      await testPromise;

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        registrationStatus: 'registered',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        latencyMs: Date.now() - startTime,
        registrationStatus: 'failed',
      };
    }
  }

  async initiateCall(options: OutboundCallOptions): Promise<CallInitiationResult> {
    if (!this.sipConfig) {
      throw new Error('SIP not configured');
    }

    const { targetPhone, hotlineId: _hotlineId } = options;

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid phone number format');
    }

    // Generate call ID
    const callId = `sip-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sipUri = this.buildSIPUri(normalizedPhone.replace('+', ''));

    // Create call record
    const call: ActiveSIPCall = {
      callId,
      sipCallId: callId,
      direction: 'outbound',
      status: 'initiating',
      remoteUri: sipUri,
    };

    this.activeCalls.set(callId, call);

    // In a real implementation, this would:
    // 1. Get user media
    // 2. Create RTCPeerConnection
    // 3. Use JsSIP/SIP.js to send INVITE with SDP offer
    // 4. Handle SDP answer and ICE candidates

    return {
      callSid: callId,
      sipUri,
      webrtcConfig: this.webrtcConfig,
    };
  }

  async answerCall(callSid: string, _operatorPubkey?: string): Promise<AnswerCallResult> {
    if (!this.sipConfig) {
      throw new Error('SIP not configured');
    }

    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    // Update call status
    call.status = 'connected';

    // In a real implementation, this would:
    // 1. Send 200 OK with SDP answer
    // 2. Complete ICE connectivity
    // 3. Start audio streaming

    return {
      sipUri: call.remoteUri,
      webrtcConfig: this.webrtcConfig,
    };
  }

  async holdCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    // In a real implementation, this would send re-INVITE with hold SDP
    // (c=IN IP4 0.0.0.0 or a=sendonly)
    call.status = 'on_hold';
  }

  async resumeCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    // In a real implementation, this would send re-INVITE with active SDP
    call.status = 'connected';
  }

  async transferCall(callSid: string, targetPhone: string): Promise<void> {
    if (!this.sipConfig) {
      throw new Error('SIP not configured');
    }

    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error('Call not found');
    }

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid transfer phone number format');
    }

    // In a real implementation, this would:
    // 1. Send REFER to the new destination
    // 2. Handle NOTIFY events for transfer status
    // 3. BYE original call when transfer completes

    const transferUri = this.buildSIPUri(normalizedPhone.replace('+', ''));
    console.log(`Transferring call ${callSid} to ${transferUri}`);

    // End the current call after transfer
    call.status = 'ended';
    this.activeCalls.delete(callSid);
  }

  async endCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      return;
    }

    // Close peer connection if exists
    if (call.peerConnection) {
      call.peerConnection.close();
    }

    // Stop local media
    if (call.localStream) {
      call.localStream.getTracks().forEach((track) => track.stop());
    }

    // In a real implementation, this would send BYE
    call.status = 'ended';
    this.activeCalls.delete(callSid);
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || !call.peerConnection) {
      throw new Error('Call not found or not connected');
    }

    // Send DTMF via WebRTC
    const senders = call.peerConnection.getSenders();
    const audioSender = senders.find((s) => s.track?.kind === 'audio');

    if (audioSender?.dtmf) {
      audioSender.dtmf.insertDTMF(digits, 200, 100);
    } else {
      // Fallback: send INFO request with DTMF payload
      console.warn('RTCDTMFSender not available, DTMF may not work');
    }
  }

  // ===== Helper Methods =====

  /**
   * Build SIP URI for a phone number
   */
  private buildSIPUri(phoneNumber: string): string {
    if (!this.sipConfig) {
      throw new Error('SIP not configured');
    }

    return `sip:${phoneNumber}@${this.sipConfig.server}:${this.sipConfig.port}`;
  }

  /**
   * Get WebSocket URL for SIP over WebSocket
   */
  private getWebSocketUrl(): string {
    if (!this.sipConfig) {
      throw new Error('SIP not configured');
    }

    const protocol = this.sipConfig.transport === 'tls' ? 'wss' : 'ws';
    return `${protocol}://${this.sipConfig.server}:${this.sipConfig.port}/ws`;
  }


  /**
   * Create WebRTC offer for SIP INVITE
   */
  async createWebRTCOffer(): Promise<{
    localStream: MediaStream;
    peerConnection: RTCPeerConnection;
    offer: RTCSessionDescriptionInit;
  }> {
    // Get local media
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    // Create peer connection
    const peerConnection = new RTCPeerConnection(this.webrtcConfig);

    // Add local tracks
    localStream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    return { localStream, peerConnection, offer };
  }

  /**
   * Handle remote SDP answer
   */
  async handleRemoteAnswer(
    peerConnection: RTCPeerConnection,
    sdpAnswer: string
  ): Promise<void> {
    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: sdpAnswer,
    });
  }

  /**
   * Handle ICE candidate
   */
  addIceCandidate(
    peerConnection: RTCPeerConnection,
    candidate: RTCIceCandidateInit
  ): void {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // ===== Phone Numbers (not typically supported for self-hosted) =====

  async listPhoneNumbers(): Promise<Array<{
    number: string;
    type: 'local' | 'toll-free' | 'mobile';
    capabilities: ('voice' | 'sms' | 'mms')[];
    assignedTo?: string;
  }>> {
    // Self-hosted PBX typically has configured extensions/DIDs
    // This would require custom integration with your PBX
    if (!this.sipConfig) {
      return [];
    }

    return [
      {
        number: this.sipConfig.callerId,
        type: 'local',
        capabilities: ['voice'],
      },
    ];
  }

  async provisionNumber(
    _areaCode?: string,
    _type?: 'local' | 'toll-free'
  ): Promise<{ number: string; monthlyCost: number }> {
    throw new Error(
      'Phone number provisioning is not available for self-hosted PBX. ' +
      'Please configure numbers directly in your Asterisk/FreePBX system.'
    );
  }

  async releaseNumber(_phoneNumber: string): Promise<void> {
    throw new Error(
      'Phone number management is not available for self-hosted PBX. ' +
      'Please configure numbers directly in your Asterisk/FreePBX system.'
    );
  }
}
