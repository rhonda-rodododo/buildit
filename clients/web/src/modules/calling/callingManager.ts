/**
 * Calling Manager
 * Orchestrates WebRTC, signaling, and state management for voice/video calls
 *
 * Responsibilities:
 * - Call lifecycle management (initiate, answer, hangup)
 * - Media device management
 * - State synchronization with store
 * - Integration with Nostr signaling
 */

import { logger } from '@/lib/logger';
import { dal } from '@/core/storage/dal';
import { useAuthStore } from '@/stores/authStore';
import { useContactsStore } from '@/stores/contactsStore';
import { v4 as uuidv4 } from 'uuid';
import {
  WebRTCAdapter,
  getMainAdapter,
  closeMainAdapter,
  type WebRTCEventHandlers,
} from './services/webrtcAdapter';
import { getCurrentPrivateKey } from '@/stores/authStore';

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
import {
  SignalingService,
  getSignalingService,
  closeSignalingService,
  type SignalingEventHandlers,
} from './services/signalingService';
import { useCallingStore } from './callingStore';
import {
  CallType,
  CallStateState,
  CallDirection,
  HangupReason,
  CallHistoryCallType,
  type CallOffer,
  type CallAnswer,
  type CallIceCandidate,
  type CallHangup,
  type CallHistory,
  type CallSettings,
  type LocalCallState,
} from './types';

/**
 * Convert CallType enum to CallHistoryCallType enum
 */
function toCallHistoryCallType(callType: CallType): CallHistoryCallType {
  return callType === CallType.Video ? CallHistoryCallType.Video : CallHistoryCallType.Voice;
}

/**
 * Convert DB string to CallHistoryCallType
 */
function dbStringToCallHistoryCallType(str: string | undefined): CallHistoryCallType | undefined {
  if (!str) return undefined;
  switch (str) {
    case 'video': return CallHistoryCallType.Video;
    case 'voice': return CallHistoryCallType.Voice;
    case 'group': return CallHistoryCallType.Group;
    default: return undefined;
  }
}
import { CALLING_VERSION } from '@/generated/schemas/calling';
import type { DBCallHistory, DBCallSettings } from './schema';

/**
 * Calling Manager class
 */
class CallingManager {
  private webrtc: WebRTCAdapter | null = null;
  private signaling: SignalingService | null = null;
  private initialized = false;
  private ringtoneAudio: HTMLAudioElement | null = null;

  // Pending ICE candidates (received before remote description is set)
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  /**
   * Initialize the calling manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { currentIdentity } = useAuthStore.getState();
    if (!currentIdentity) {
      throw new Error('No identity available');
    }

    // Initialize signaling
    this.signaling = getSignalingService();
    await this.signaling.initialize(this.createSignalingHandlers());

    // Load user settings
    await this.loadSettings(currentIdentity.publicKey);

    // Load call history
    await this.loadCallHistory();

    this.initialized = true;
    logger.info('📞 Calling manager initialized');
  }

  /**
   * Create signaling event handlers
   */
  private createSignalingHandlers(): SignalingEventHandlers {
    return {
      onCallOffer: async (offer, senderPubkey) => {
        await this.handleIncomingCall(offer, senderPubkey);
      },
      onCallAnswer: async (answer, _senderPubkey) => {
        await this.handleCallAnswer(answer);
      },
      onIceCandidate: async (candidate, _senderPubkey) => {
        await this.handleRemoteIceCandidate(candidate);
      },
      onCallHangup: async (hangup, _senderPubkey) => {
        await this.handleRemoteHangup(hangup);
      },
    };
  }

  /**
   * Create WebRTC event handlers
   */
  private createWebRTCHandlers(callId: string, remotePubkey: string): WebRTCEventHandlers {
    return {
      onIceCandidate: async (candidate) => {
        if (this.signaling) {
          await this.signaling.sendIceCandidate(remotePubkey, callId, {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid ?? undefined,
            sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
            usernameFragment: candidate.usernameFragment ?? undefined,
          });
        }
      },
      onIceConnectionStateChange: (state) => {
        this.handleIceConnectionStateChange(state);
      },
      onTrack: (stream, _track) => {
        useCallingStore.getState().updateActiveCall({
          remoteStream: stream,
        });
      },
      onNegotiationNeeded: async () => {
        // Handle renegotiation if needed
        logger.debug('Negotiation needed');
      },
      onConnectionFailed: (error) => {
        logger.error('Connection failed', error);
        this.endCall(HangupReason.NetworkFailure);
      },
    };
  }

  /**
   * Handle ICE connection state changes
   */
  private handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    const store = useCallingStore.getState();

    switch (state) {
      case 'connected':
        store.updateActiveCall({
          state: CallStateState.Connected,
          connectedAt: Date.now(),
        });
        break;
      case 'disconnected':
      case 'failed':
        store.updateActiveCall({
          state: CallStateState.Reconnecting,
        });
        break;
      case 'closed':
        // Connection closed, call ended
        break;
    }
  }

  /**
   * Start an outgoing call
   */
  async startCall(
    remotePubkey: string,
    callType: CallType,
    options: {
      remoteName?: string;
      groupId?: string;
      hotlineId?: string;
    } = {}
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const store = useCallingStore.getState();
    if (store.isInCall()) {
      throw new Error('Already in a call');
    }

    const callId = uuidv4();

    // Set up call state
    const callState: LocalCallState = {
      callId,
      remotePubkey,
      remoteName: options.remoteName,
      direction: CallDirection.Outgoing,
      callType,
      state: CallStateState.Initiating,
      startedAt: Date.now(),
      isMuted: false,
      isVideoEnabled: callType === CallType.Video,
      isScreenSharing: false,
      isEncrypted: true,
    };

    store.setActiveCall(callState);

    try {
      // Initialize WebRTC
      this.webrtc = getMainAdapter();
      await this.webrtc.initialize(this.createWebRTCHandlers(callId, remotePubkey));

      // Get local media
      const localStream = await this.webrtc.getLocalStream({
        audio: true,
        video: callType === CallType.Video,
      });

      store.updateActiveCall({ localStream });

      // Add tracks to peer connection
      this.webrtc.addLocalStream(localStream);

      // Enable E2EE encryption
      const privateKeyBytes = getCurrentPrivateKey();
      if (privateKeyBytes) {
        const privateKeyHex = bytesToHex(privateKeyBytes);
        const e2eeEnabled = await this.webrtc.enableE2EE(privateKeyHex, remotePubkey, callId);
        if (e2eeEnabled) {
          logger.info('E2EE encryption enabled for call');
        } else {
          logger.warn('E2EE not available, proceeding with DTLS-SRTP only');
        }
      }

      // Create and send offer
      const offer = await this.webrtc.createOffer();

      await this.signaling!.sendCallOffer(remotePubkey, offer.sdp!, callType, {
        callId,
        groupId: options.groupId,
        hotlineId: options.hotlineId,
      });

      store.updateActiveCall({ state: CallStateState.Ringing });

      logger.info('📞 Started outgoing call', { callId, callType, remotePubkey });

      return callId;
    } catch (error) {
      logger.error('Failed to start call', error);
      store.setActiveCall(null);
      closeMainAdapter();
      throw error;
    }
  }

  /**
   * Handle incoming call offer
   */
  private async handleIncomingCall(offer: CallOffer, senderPubkey: string): Promise<void> {
    const store = useCallingStore.getState();
    const settings = store.settings;

    // Check if we're in DND mode
    if (settings?.doNotDisturb) {
      await this.signaling?.sendHangup(senderPubkey, offer.callId, HangupReason.Busy);
      return;
    }

    // Check if we're already in a call
    if (store.isInCall()) {
      await this.signaling?.sendHangup(senderPubkey, offer.callId, HangupReason.Busy);
      return;
    }

    // Check if we allow unknown callers
    if (settings && !settings.allowUnknownCallers) {
      const { isFollowing } = useContactsStore.getState();
      if (!isFollowing(senderPubkey)) {
        // Reject calls from unknown users
        await this.signaling?.sendHangup(senderPubkey, offer.callId, HangupReason.Rejected);
        return;
      }
    }

    // Show incoming call UI
    store.setIncomingCall({
      callId: offer.callId,
      remotePubkey: senderPubkey,
      callType: offer.callType,
      timestamp: offer.timestamp,
    });

    // Play ringtone
    this.playRingtone();

    // Auto-answer if enabled
    if (settings?.autoAnswer) {
      await this.answerCall(offer.callId);
    }

    // Set a timeout for no answer
    setTimeout(async () => {
      if (store.incomingCall?.callId === offer.callId) {
        store.clearIncomingCall();
        this.stopRingtone();
        await this.signaling?.sendHangup(senderPubkey, offer.callId, HangupReason.NoAnswer);
      }
    }, 30000); // 30 second timeout

    logger.info('📞 Incoming call', { callId: offer.callId, callType: offer.callType });
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string): Promise<void> {
    const store = useCallingStore.getState();
    const incomingCall = store.incomingCall;

    if (!incomingCall || incomingCall.callId !== callId) {
      throw new Error('No incoming call to answer');
    }

    this.stopRingtone();
    store.clearIncomingCall();

    // Set up call state
    const callState: LocalCallState = {
      callId,
      remotePubkey: incomingCall.remotePubkey,
      remoteName: incomingCall.remoteName,
      direction: CallDirection.Incoming,
      callType: incomingCall.callType,
      state: CallStateState.Connecting,
      startedAt: Date.now(),
      isMuted: false,
      isVideoEnabled: incomingCall.callType === CallType.Video,
      isScreenSharing: false,
      isEncrypted: true,
    };

    store.setActiveCall(callState);

    try {
      // Initialize WebRTC
      this.webrtc = getMainAdapter();
      await this.webrtc.initialize(
        this.createWebRTCHandlers(callId, incomingCall.remotePubkey)
      );

      // Get local media
      const localStream = await this.webrtc.getLocalStream({
        audio: true,
        video: incomingCall.callType === CallType.Video,
      });

      store.updateActiveCall({ localStream });
      this.webrtc.addLocalStream(localStream);

      // Enable E2EE encryption
      const privateKeyBytes = getCurrentPrivateKey();
      if (privateKeyBytes) {
        const privateKeyHex = bytesToHex(privateKeyBytes);
        const e2eeEnabled = await this.webrtc.enableE2EE(privateKeyHex, incomingCall.remotePubkey, callId);
        if (e2eeEnabled) {
          logger.info('E2EE encryption enabled for incoming call');
        } else {
          logger.warn('E2EE not available, proceeding with DTLS-SRTP only');
        }
      }

      // We need to wait for the offer SDP - it should be cached or re-fetched
      // For now, this assumes the offer was stored when received
      // In a real implementation, you'd need to handle this more carefully

      logger.info('📞 Answered call', { callId });
    } catch (error) {
      logger.error('Failed to answer call', error);
      store.setActiveCall(null);
      closeMainAdapter();
      throw error;
    }
  }

  /**
   * Handle call answer from remote
   */
  private async handleCallAnswer(answer: CallAnswer): Promise<void> {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall || activeCall.callId !== answer.callId) {
      logger.warn('Received answer for unknown call', { callId: answer.callId });
      return;
    }

    try {
      await this.webrtc?.setRemoteDescription({
        type: 'answer',
        sdp: answer.sdp,
      });

      // Process any pending ICE candidates
      const pending = this.pendingIceCandidates.get(answer.callId) || [];
      for (const candidate of pending) {
        await this.webrtc?.addIceCandidate(candidate);
      }
      this.pendingIceCandidates.delete(answer.callId);

      store.updateActiveCall({ state: CallStateState.Connecting });
      logger.info('📞 Call answered', { callId: answer.callId });
    } catch (error) {
      logger.error('Failed to process call answer', error);
      await this.endCall(HangupReason.NetworkFailure);
    }
  }

  /**
   * Handle remote ICE candidate
   */
  private async handleRemoteIceCandidate(candidate: CallIceCandidate): Promise<void> {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    const iceCandidate: RTCIceCandidateInit = {
      candidate: candidate.candidate.candidate,
      sdpMid: candidate.candidate.sdpMid,
      sdpMLineIndex: candidate.candidate.sdpMLineIndex,
      usernameFragment: candidate.candidate.usernameFragment,
    };

    if (!activeCall || activeCall.callId !== candidate.callId) {
      // Store pending candidate
      const pending = this.pendingIceCandidates.get(candidate.callId) || [];
      pending.push(iceCandidate);
      this.pendingIceCandidates.set(candidate.callId, pending);
      return;
    }

    try {
      await this.webrtc?.addIceCandidate(iceCandidate);
    } catch (error) {
      logger.error('Failed to add ICE candidate', error);
    }
  }

  /**
   * Handle remote hangup
   */
  private async handleRemoteHangup(hangup: CallHangup): Promise<void> {
    const store = useCallingStore.getState();

    // Check if this is for incoming call
    if (store.incomingCall?.callId === hangup.callId) {
      this.stopRingtone();
      store.clearIncomingCall();
      return;
    }

    // Check if this is for active call
    if (store.activeCall?.callId === hangup.callId) {
      await this.endCallInternal(hangup.reason);
    }
  }

  /**
   * Decline an incoming call
   */
  async declineCall(callId: string): Promise<void> {
    const store = useCallingStore.getState();
    const incomingCall = store.incomingCall;

    if (!incomingCall || incomingCall.callId !== callId) {
      return;
    }

    this.stopRingtone();
    store.clearIncomingCall();

    await this.signaling?.sendHangup(incomingCall.remotePubkey, callId, HangupReason.Rejected);

    logger.info('📞 Declined call', { callId });
  }

  /**
   * End the current call
   */
  async endCall(reason: HangupReason = HangupReason.Completed): Promise<void> {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall) return;

    // Send hangup to remote
    await this.signaling?.sendHangup(activeCall.remotePubkey, activeCall.callId, reason);

    await this.endCallInternal(reason);
  }

  /**
   * Internal end call (doesn't send hangup)
   */
  private async endCallInternal(reason: HangupReason): Promise<void> {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall) return;

    // Calculate duration
    const endedAt = Date.now();
    const duration = activeCall.connectedAt
      ? Math.floor((endedAt - activeCall.connectedAt) / 1000)
      : 0;

    // Save to history
    const historyEntry: CallHistory = {
      _v: CALLING_VERSION,
      callId: activeCall.callId,
      remotePubkey: activeCall.remotePubkey,
      remoteName: activeCall.remoteName,
      direction: activeCall.direction,
      callType: toCallHistoryCallType(activeCall.callType),
      startedAt: activeCall.startedAt,
      connectedAt: activeCall.connectedAt,
      endedAt,
      duration,
      endReason: reason,
      wasEncrypted: activeCall.isEncrypted,
    };

    await this.saveCallHistory(historyEntry);
    store.addCallHistory(historyEntry);

    // Clean up
    closeMainAdapter();
    this.webrtc = null;

    store.setActiveCall(null);

    logger.info('📞 Call ended', { callId: activeCall.callId, reason, duration });
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall || !this.webrtc) return;

    const newMuted = !activeCall.isMuted;
    this.webrtc.setAudioEnabled(!newMuted);
    store.updateActiveCall({ isMuted: newMuted });
  }

  /**
   * Toggle video
   */
  toggleVideo(): void {
    const store = useCallingStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall || !this.webrtc) return;

    const newEnabled = !activeCall.isVideoEnabled;
    this.webrtc.setVideoEnabled(newEnabled);
    store.updateActiveCall({ isVideoEnabled: newEnabled });
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    const store = useCallingStore.getState();
    if (!this.webrtc) return;

    try {
      await this.webrtc.startScreenShare();
      store.updateActiveCall({ isScreenSharing: true });
    } catch (error) {
      logger.error('Failed to start screen share', error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    const store = useCallingStore.getState();
    if (!this.webrtc) return;

    await this.webrtc.stopScreenShare();
    store.updateActiveCall({ isScreenSharing: false });
  }

  /**
   * Switch camera
   */
  async switchCamera(): Promise<void> {
    if (this.webrtc) {
      await this.webrtc.switchCamera();
    }
  }

  /**
   * Get call quality stats
   */
  async getQualityStats(): Promise<void> {
    if (!this.webrtc) return;

    const stats = await this.webrtc.getStats();
    useCallingStore.getState().updateActiveCall({ quality: stats });
  }

  /**
   * Load call settings from database
   */
  async loadSettings(pubkey: string): Promise<void> {
    try {
      const settings = await dal.get<DBCallSettings>('callSettings', pubkey);
      if (settings) {
        useCallingStore.getState().setSettings({
          _v: CALLING_VERSION,
          defaultCallType: settings.defaultCallType === 'video' ? CallType.Video : CallType.Voice,
          autoAnswer: settings.autoAnswer,
          doNotDisturb: settings.doNotDisturb,
          allowUnknownCallers: settings.allowUnknownCallers,
          preferredAudioInput: settings.preferredAudioInput,
          preferredAudioOutput: settings.preferredAudioOutput,
          preferredVideoInput: settings.preferredVideoInput,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          relayOnlyMode: settings.relayOnlyMode,
        });
      }
    } catch (error) {
      logger.error('Failed to load call settings', error);
    }
  }

  /**
   * Save call settings to database
   */
  async saveSettings(settings: CallSettings): Promise<void> {
    const { currentIdentity } = useAuthStore.getState();
    if (!currentIdentity) return;

    try {
      const dbSettings: DBCallSettings = {
        pubkey: currentIdentity.publicKey,
        defaultCallType: settings.defaultCallType === CallType.Video ? 'video' : 'voice',
        autoAnswer: settings.autoAnswer ?? false,
        doNotDisturb: settings.doNotDisturb ?? false,
        allowUnknownCallers: settings.allowUnknownCallers ?? true,
        preferredAudioInput: settings.preferredAudioInput,
        preferredAudioOutput: settings.preferredAudioOutput,
        preferredVideoInput: settings.preferredVideoInput,
        echoCancellation: settings.echoCancellation ?? true,
        noiseSuppression: settings.noiseSuppression ?? true,
        autoGainControl: settings.autoGainControl ?? true,
        relayOnlyMode: settings.relayOnlyMode ?? false,
        updatedAt: Date.now(),
      };

      await dal.put('callSettings', dbSettings);
      useCallingStore.getState().setSettings(settings);
    } catch (error) {
      logger.error('Failed to save call settings', error);
    }
  }

  /**
   * Load call history from database
   */
  async loadCallHistory(): Promise<void> {
    try {
      const history = await dal.query<DBCallHistory>('callHistory', {
        orderBy: 'startedAt',
        orderDir: 'desc',
        limit: 100,
      });

      const formattedHistory: CallHistory[] = history.map((h) => ({
        _v: CALLING_VERSION,
        callId: h.callId,
        remotePubkey: h.remotePubkey,
        remoteName: h.remoteName,
        direction: h.direction === 'incoming' ? CallDirection.Incoming : CallDirection.Outgoing,
        callType: dbStringToCallHistoryCallType(h.callType),
        startedAt: h.startedAt,
        connectedAt: h.connectedAt,
        endedAt: h.endedAt,
        duration: h.duration,
        endReason: h.endReason as HangupReason | undefined,
        wasEncrypted: h.wasEncrypted,
        groupId: h.groupId,
        roomId: h.roomId,
        participantCount: h.participantCount,
      }));

      useCallingStore.getState().setCallHistory(formattedHistory);
    } catch (error) {
      logger.error('Failed to load call history', error);
    }
  }

  /**
   * Save call to history
   */
  private async saveCallHistory(entry: CallHistory): Promise<void> {
    try {
      const dbEntry: DBCallHistory = {
        callId: entry.callId,
        remotePubkey: entry.remotePubkey,
        remoteName: entry.remoteName,
        direction: entry.direction === CallDirection.Incoming ? 'incoming' : 'outgoing',
        callType: entry.callType === CallHistoryCallType.Video ? 'video' :
                  entry.callType === CallHistoryCallType.Group ? 'group' : 'voice',
        startedAt: entry.startedAt,
        connectedAt: entry.connectedAt,
        endedAt: entry.endedAt,
        duration: entry.duration,
        endReason: entry.endReason,
        wasEncrypted: entry.wasEncrypted ?? true,
        groupId: entry.groupId,
        roomId: entry.roomId,
        participantCount: entry.participantCount,
      };

      await dal.add('callHistory', dbEntry);
    } catch (error) {
      logger.error('Failed to save call history', error);
    }
  }

  /**
   * Clear call history
   */
  async clearCallHistory(): Promise<void> {
    try {
      await dal.queryCustom<void>({
        sql: 'DELETE FROM call_history',
        params: [],
        dexieFallback: async (db) => {
          await db.table('callHistory').clear();
        },
      });
      useCallingStore.getState().clearCallHistory();
    } catch (error) {
      logger.error('Failed to clear call history', error);
    }
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<void> {
    const adapter = new WebRTCAdapter();
    const devices = await adapter.getMediaDevices();
    useCallingStore.getState().setDevices(devices);
  }

  /**
   * Play ringtone for incoming calls
   */
  private playRingtone(): void {
    try {
      // Use Web Audio API or a simple audio element
      // For now, use system notification sound
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      // Create audio context for ringtone
      this.ringtoneAudio = new Audio('/sounds/ringtone.mp3');
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.play().catch(() => {
        // Autoplay might be blocked
      });
    } catch (error) {
      logger.warn('Could not play ringtone', error);
    }
  }

  /**
   * Stop ringtone
   */
  private stopRingtone(): void {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  /**
   * Clean up and close the manager
   */
  close(): void {
    this.stopRingtone();
    closeMainAdapter();
    closeSignalingService();
    this.webrtc = null;
    this.signaling = null;
    this.initialized = false;
    this.pendingIceCandidates.clear();

    logger.info('📞 Calling manager closed');
  }
}

/**
 * Singleton instance
 */
let callingManagerInstance: CallingManager | null = null;

export function getCallingManager(): CallingManager {
  if (!callingManagerInstance) {
    callingManagerInstance = new CallingManager();
  }
  return callingManagerInstance;
}

export function closeCallingManager(): void {
  if (callingManagerInstance) {
    callingManagerInstance.close();
    callingManagerInstance = null;
  }
}
