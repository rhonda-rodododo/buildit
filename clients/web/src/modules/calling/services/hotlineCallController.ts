/**
 * Hotline Call Controller
 * Handles call control operations: hold, resume, transfer, escalate, 3-way
 */

import { EventEmitter } from 'eventemitter3';
import type { HotlineCallState } from '../types';
import {
  HotlineCallStateState,
  HotlineOperatorStatusStatus,
  CALLING_KINDS,
} from '../types';
import { useCallingStore } from '../callingStore';
import type { HotlineQueueManager } from './hotlineQueueManager';
import type { SignalingService } from './signalingService';
import type { WebRTCAdapter } from './webrtcAdapter';

/**
 * Transfer request state
 */
interface TransferRequest {
  callId: string;
  fromOperator: string;
  toOperator: string;
  reason?: string;
  requestedAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

/**
 * 3-way call state
 */
interface ThreeWayCall {
  callId: string;
  participants: string[]; // operator pubkeys
  initiatedBy: string;
  startedAt: number;
}

export interface HotlineCallControllerEvents {
  'call-held': (callId: string) => void;
  'call-resumed': (callId: string) => void;
  'transfer-requested': (request: TransferRequest) => void;
  'transfer-accepted': (request: TransferRequest) => void;
  'transfer-declined': (request: TransferRequest) => void;
  'transfer-completed': (callId: string, toOperator: string) => void;
  'call-escalated': (callId: string, supervisorPubkey: string) => void;
  'three-way-started': (threeWay: ThreeWayCall) => void;
  'three-way-ended': (callId: string) => void;
  'call-ended': (callId: string, summary: string) => void;
  'notes-updated': (callId: string, notes: string) => void;
}

/**
 * Hotline Call Controller
 * Manages active call controls for operators
 */
export class HotlineCallController extends EventEmitter {
  private queueManager: HotlineQueueManager;
  private signalingService: SignalingService;
  private webrtcAdapter: WebRTCAdapter;
  private holdAudio: HTMLAudioElement | null = null;
  private pendingTransfers: Map<string, TransferRequest> = new Map();
  private activeThreeWays: Map<string, ThreeWayCall> = new Map();
  private callNotes: Map<string, string> = new Map();
  private notesAutoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  // Transfer timeout (30 seconds)
  private readonly TRANSFER_TIMEOUT = 30000;

  constructor(
    queueManager: HotlineQueueManager,
    signalingService: SignalingService,
    webrtcAdapter: WebRTCAdapter
  ) {
    super();
    this.queueManager = queueManager;
    this.signalingService = signalingService;
    this.webrtcAdapter = webrtcAdapter;

    // Setup hold music
    this.initHoldAudio();
  }

  /**
   * Put a call on hold
   */
  async holdCall(callId: string): Promise<void> {
    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call || call.state !== HotlineCallStateState.Active) {
      throw new Error('Call is not active');
    }

    // Mute audio to caller (they hear hold music)
    this.webrtcAdapter.setAudioEnabled(false);

    // Play hold music to caller
    this.startHoldMusic(callId);

    // Update call state
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.OnHold,
    });

    // Send hold notification via signaling
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        callId,
        state: 'on_hold',
        timestamp: Date.now(),
      }),
      tags: [['p', call.caller?.pubkey || '']],
    });

    this.emit('call-held', callId);
  }

  /**
   * Resume a call from hold
   */
  async resumeCall(callId: string): Promise<void> {
    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call || call.state !== HotlineCallStateState.OnHold) {
      throw new Error('Call is not on hold');
    }

    // Stop hold music
    this.stopHoldMusic();

    // Resume audio
    this.webrtcAdapter.setAudioEnabled(true);

    // Update call state
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Active,
    });

    // Send resume notification
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        callId,
        state: 'active',
        timestamp: Date.now(),
      }),
      tags: [['p', call.caller?.pubkey || '']],
    });

    this.emit('call-resumed', callId);
  }

  /**
   * Request to transfer a call to another operator
   */
  async transferCall(
    callId: string,
    targetOperatorPubkey: string,
    reason?: string
  ): Promise<TransferRequest> {
    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const currentOperator = call.operator?.pubkey;
    if (!currentOperator) {
      throw new Error('Call has no operator');
    }

    // Check target is available
    const targetOperator = this.queueManager.getOperators(call.hotlineId)
      .find((op) => op.pubkey === targetOperatorPubkey);

    if (!targetOperator) {
      throw new Error('Target operator not found');
    }

    if (targetOperator.status !== HotlineOperatorStatusStatus.Available) {
      throw new Error('Target operator is not available');
    }

    // Create transfer request
    const request: TransferRequest = {
      callId,
      fromOperator: currentOperator,
      toOperator: targetOperatorPubkey,
      reason,
      requestedAt: Date.now(),
      expiresAt: Date.now() + this.TRANSFER_TIMEOUT,
      status: 'pending',
    };

    this.pendingTransfers.set(callId, request);

    // Put call on hold during transfer
    await this.holdCall(callId);

    // Update call state
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Transferred,
    });

    // Send transfer request via signaling
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        type: 'transfer_request',
        callId,
        fromOperator: currentOperator,
        toOperator: targetOperatorPubkey,
        reason,
        hotlineId: call.hotlineId,
        caller: call.caller,
        timestamp: Date.now(),
      }),
      tags: [['p', targetOperatorPubkey]],
    });

    // Set timeout for transfer
    setTimeout(() => {
      const pending = this.pendingTransfers.get(callId);
      if (pending && pending.status === 'pending') {
        this.handleTransferExpired(callId);
      }
    }, this.TRANSFER_TIMEOUT);

    this.emit('transfer-requested', request);
    return request;
  }

  /**
   * Accept a transfer request
   */
  async acceptTransfer(callId: string): Promise<void> {
    const request = this.pendingTransfers.get(callId);
    if (!request || request.status !== 'pending') {
      throw new Error('No pending transfer request');
    }

    request.status = 'accepted';
    this.pendingTransfers.delete(callId);

    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call) return;

    // Update call with new operator
    store.updateHotlineCall(callId, {
      operator: { pubkey: request.toOperator },
      state: HotlineCallStateState.Active,
    });

    // Notify original operator to disconnect
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        type: 'transfer_accepted',
        callId,
        newOperator: request.toOperator,
        timestamp: Date.now(),
      }),
      tags: [['p', request.fromOperator]],
    });

    // Release original operator
    this.queueManager.handleCallEnd(callId, request.fromOperator);

    // Resume call for new operator
    await this.resumeCall(callId);

    this.emit('transfer-accepted', request);
    this.emit('transfer-completed', callId, request.toOperator);
  }

  /**
   * Decline a transfer request
   */
  async declineTransfer(callId: string): Promise<void> {
    const request = this.pendingTransfers.get(callId);
    if (!request || request.status !== 'pending') {
      throw new Error('No pending transfer request');
    }

    request.status = 'declined';
    this.pendingTransfers.delete(callId);

    const store = useCallingStore.getState();

    // Resume call with original operator
    await this.resumeCall(callId);

    // Update state back to active
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Active,
    });

    // Notify original operator
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        type: 'transfer_declined',
        callId,
        timestamp: Date.now(),
      }),
      tags: [['p', request.fromOperator]],
    });

    this.emit('transfer-declined', request);
  }

  /**
   * Handle transfer timeout
   */
  private async handleTransferExpired(callId: string): Promise<void> {
    const request = this.pendingTransfers.get(callId);
    if (!request) return;

    request.status = 'expired';
    this.pendingTransfers.delete(callId);

    const store = useCallingStore.getState();

    // Resume call with original operator
    try {
      await this.resumeCall(callId);
      store.updateHotlineCall(callId, {
        state: HotlineCallStateState.Active,
      });
    } catch (e) {
      // Call may have ended
    }
  }

  /**
   * Escalate call to a supervisor (creates 3-way call)
   */
  async escalateCall(callId: string, reason: string): Promise<void> {
    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    // Find an available supervisor
    const operators = this.queueManager.getOperators(call.hotlineId);
    const supervisor = operators.find(
      (op) =>
        op.status === HotlineOperatorStatusStatus.Available &&
        op.pubkey !== call.operator?.pubkey
      // In a real implementation, check for supervisor role
    );

    if (!supervisor) {
      throw new Error('No supervisor available');
    }

    // Create 3-way call
    const threeWay: ThreeWayCall = {
      callId,
      participants: [call.operator?.pubkey || '', supervisor.pubkey],
      initiatedBy: call.operator?.pubkey || '',
      startedAt: Date.now(),
    };

    this.activeThreeWays.set(callId, threeWay);

    // Update call state
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Escalated,
      notes: `${call.notes || ''}\n[ESCALATED: ${reason}]`,
    });

    // Notify supervisor
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        type: 'escalation_request',
        callId,
        fromOperator: call.operator?.pubkey,
        reason,
        hotlineId: call.hotlineId,
        caller: call.caller,
        timestamp: Date.now(),
      }),
      tags: [['p', supervisor.pubkey]],
    });

    this.emit('call-escalated', callId, supervisor.pubkey);
    this.emit('three-way-started', threeWay);
  }

  /**
   * Start a 3-way call with another operator
   */
  async startThreeWayCall(
    callId: string,
    thirdPartyPubkey: string
  ): Promise<ThreeWayCall> {
    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const threeWay: ThreeWayCall = {
      callId,
      participants: [call.operator?.pubkey || '', thirdPartyPubkey],
      initiatedBy: call.operator?.pubkey || '',
      startedAt: Date.now(),
    };

    this.activeThreeWays.set(callId, threeWay);

    // In a real implementation, this would set up the 3-way WebRTC connections
    // For now, just emit the event
    this.emit('three-way-started', threeWay);
    return threeWay;
  }

  /**
   * End a 3-way call (drop the third party)
   */
  endThreeWayCall(callId: string): void {
    const threeWay = this.activeThreeWays.get(callId);
    if (!threeWay) return;

    this.activeThreeWays.delete(callId);

    const store = useCallingStore.getState();
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Active,
    });

    this.emit('three-way-ended', callId);
  }

  /**
   * Update call notes with auto-save
   */
  updateNotes(callId: string, notes: string): void {
    this.callNotes.set(callId, notes);

    // Clear existing timer
    const existingTimer = this.notesAutoSaveTimers.get(callId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Auto-save after 5 seconds of no typing
    const timer = setTimeout(() => {
      this.saveNotes(callId);
    }, 5000);
    this.notesAutoSaveTimers.set(callId, timer);
  }

  /**
   * Save notes immediately
   */
  saveNotes(callId: string): void {
    const notes = this.callNotes.get(callId);
    if (notes === undefined) return;

    const store = useCallingStore.getState();
    store.updateHotlineCall(callId, { notes });

    this.emit('notes-updated', callId, notes);

    // Clear timer
    const timer = this.notesAutoSaveTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.notesAutoSaveTimers.delete(callId);
    }
  }

  /**
   * End a call with summary
   */
  async endCall(callId: string, summary: string): Promise<void> {
    // Save any pending notes
    this.saveNotes(callId);

    const store = useCallingStore.getState();
    const call = store.getHotlineCallById(callId);
    if (!call) return;

    // Stop hold music if playing
    this.stopHoldMusic();

    // Clean up any 3-way call
    this.activeThreeWays.delete(callId);

    // Update call state
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Completed,
      endedAt: Date.now(),
      notes: `${call.notes || ''}\n\n---\nSummary: ${summary}`,
    });

    // Release operator
    if (call.operator?.pubkey) {
      this.queueManager.handleCallEnd(callId, call.operator.pubkey);
    }

    // Close WebRTC connection
    this.webrtcAdapter.close();

    // Send end notification
    await this.signalingService.publishNostrEvent({
      kind: CALLING_KINDS.HOTLINE_CALL_STATE,
      content: JSON.stringify({
        _v: '1',
        callId,
        state: 'completed',
        timestamp: Date.now(),
      }),
      tags: [['p', call.caller?.pubkey || '']],
    });

    // Clean up notes
    this.callNotes.delete(callId);
    const timer = this.notesAutoSaveTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.notesAutoSaveTimers.delete(callId);
    }

    this.emit('call-ended', callId, summary);
  }

  /**
   * Set call category
   */
  setCategory(callId: string, category: string): void {
    const store = useCallingStore.getState();
    store.updateHotlineCall(callId, { category });
  }

  /**
   * Set call priority
   */
  setPriority(callId: string, priority: HotlineCallState['priority']): void {
    const store = useCallingStore.getState();
    store.updateHotlineCall(callId, { priority });
  }

  /**
   * Get call notes
   */
  getNotes(callId: string): string {
    return this.callNotes.get(callId) || '';
  }

  // Hold music management

  private initHoldAudio(): void {
    if (typeof window !== 'undefined') {
      this.holdAudio = new Audio();
      this.holdAudio.loop = true;
      // In production, this would be a proper hold music file
      // For now, we'll use a data URL with a simple tone or silence
    }
  }

  private startHoldMusic(_callId: string): void {
    if (this.holdAudio) {
      this.holdAudio.currentTime = 0;
      this.holdAudio.play().catch(() => {
        // Auto-play may be blocked
      });
    }
  }

  private stopHoldMusic(): void {
    if (this.holdAudio) {
      this.holdAudio.pause();
      this.holdAudio.currentTime = 0;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHoldMusic();
    this.holdAudio = null;

    for (const timer of this.notesAutoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.notesAutoSaveTimers.clear();
    this.pendingTransfers.clear();
    this.activeThreeWays.clear();
    this.callNotes.clear();
    this.removeAllListeners();
  }
}

export default HotlineCallController;
