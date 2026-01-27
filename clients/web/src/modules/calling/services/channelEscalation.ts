/**
 * Channel Escalation Service
 * Handles transitions between messaging and voice channels
 */

import { EventEmitter } from 'events';
import type { MessagingThread } from './messagingQueueManager';

export interface EscalationRequest {
  id: string;
  threadId: string;
  callId?: string;
  direction: 'to-voice' | 'to-messaging';
  initiatedBy: 'operator' | 'caller' | 'system';
  reason?: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface EscalationResult {
  success: boolean;
  escalationId: string;
  newCallId?: string;
  newThreadId?: string;
  error?: string;
}

export class ChannelEscalation extends EventEmitter {
  private escalations: Map<string, EscalationRequest> = new Map();
  private threadToCall: Map<string, string> = new Map(); // threadId -> callId
  private callToThread: Map<string, string> = new Map(); // callId -> threadId
  private operatorPubkey: string = '';

  constructor() {
    super();
  }

  /**
   * Initialize with operator context
   */
  initialize(operatorPubkey: string): void {
    this.operatorPubkey = operatorPubkey;
  }

  /**
   * Escalate a messaging thread to a voice call
   */
  async escalateToVoice(
    threadId: string,
    thread: MessagingThread,
    reason?: string
  ): Promise<EscalationResult> {
    const escalationId = crypto.randomUUID();
    const now = Date.now();

    const escalation: EscalationRequest = {
      id: escalationId,
      threadId,
      direction: 'to-voice',
      initiatedBy: 'operator',
      reason,
      status: 'pending',
      createdAt: now,
    };

    this.escalations.set(escalationId, escalation);
    this.emit('escalation-started', escalation);

    try {
      // Create a call ID for the new voice call
      const callId = crypto.randomUUID();

      // Link the thread and call
      this.threadToCall.set(threadId, callId);
      this.callToThread.set(callId, threadId);

      // In real implementation:
      // 1. Initiate WebRTC call to the caller
      // 2. Wait for caller to accept
      // 3. Transition the thread to voice mode

      escalation.callId = callId;
      escalation.status = 'completed';
      escalation.completedAt = Date.now();

      this.emit('escalation-completed', {
        escalation,
        thread,
        callId,
      });

      // Add system message to thread
      this.addTransitionMessage(thread, 'to-voice', reason);

      return {
        success: true,
        escalationId,
        newCallId: callId,
      };
    } catch (error) {
      escalation.status = 'failed';
      escalation.completedAt = Date.now();

      this.emit('escalation-failed', {
        escalation,
        error,
      });

      return {
        success: false,
        escalationId,
        error: error instanceof Error ? error.message : 'Escalation failed',
      };
    }
  }

  /**
   * De-escalate a voice call back to messaging
   */
  async deescalateToMessaging(
    callId: string,
    reason?: string
  ): Promise<EscalationResult> {
    const escalationId = crypto.randomUUID();
    const now = Date.now();

    // Check if there's an existing thread linked to this call
    let threadId = this.callToThread.get(callId);

    const escalation: EscalationRequest = {
      id: escalationId,
      threadId: threadId || '',
      callId,
      direction: 'to-messaging',
      initiatedBy: 'operator',
      reason,
      status: 'pending',
      createdAt: now,
    };

    this.escalations.set(escalationId, escalation);
    this.emit('escalation-started', escalation);

    try {
      // If no existing thread, create a new one
      if (!threadId) {
        threadId = crypto.randomUUID();
        this.threadToCall.set(threadId, callId);
        this.callToThread.set(callId, threadId);
      }

      escalation.threadId = threadId;
      escalation.status = 'completed';
      escalation.completedAt = Date.now();

      this.emit('escalation-completed', {
        escalation,
        callId,
        threadId,
      });

      return {
        success: true,
        escalationId,
        newThreadId: threadId,
      };
    } catch (error) {
      escalation.status = 'failed';
      escalation.completedAt = Date.now();

      this.emit('escalation-failed', {
        escalation,
        error,
      });

      return {
        success: false,
        escalationId,
        error: error instanceof Error ? error.message : 'De-escalation failed',
      };
    }
  }

  /**
   * Request escalation from caller (caller wants to switch channels)
   */
  async requestEscalation(
    currentChannelId: string,
    direction: 'to-voice' | 'to-messaging',
    callerPubkey: string
  ): Promise<EscalationRequest> {
    const escalationId = crypto.randomUUID();
    const now = Date.now();

    const escalation: EscalationRequest = {
      id: escalationId,
      threadId: direction === 'to-voice' ? currentChannelId : '',
      callId: direction === 'to-messaging' ? currentChannelId : undefined,
      direction,
      initiatedBy: 'caller',
      status: 'pending',
      createdAt: now,
    };

    this.escalations.set(escalationId, escalation);
    this.emit('escalation-requested', { escalation, callerPubkey });

    return escalation;
  }

  /**
   * Accept a pending escalation request
   */
  async acceptEscalation(escalationId: string): Promise<EscalationResult> {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) {
      return {
        success: false,
        escalationId,
        error: 'Escalation not found',
      };
    }

    if (escalation.status !== 'pending') {
      return {
        success: false,
        escalationId,
        error: 'Escalation is not pending',
      };
    }

    escalation.status = 'accepted';

    // Perform the actual escalation
    if (escalation.direction === 'to-voice') {
      const callId = crypto.randomUUID();
      escalation.callId = callId;
      this.threadToCall.set(escalation.threadId, callId);
      this.callToThread.set(callId, escalation.threadId);

      escalation.status = 'completed';
      escalation.completedAt = Date.now();

      this.emit('escalation-completed', escalation);

      return {
        success: true,
        escalationId,
        newCallId: callId,
      };
    } else {
      const threadId = crypto.randomUUID();
      escalation.threadId = threadId;
      if (escalation.callId) {
        this.callToThread.set(escalation.callId, threadId);
        this.threadToCall.set(threadId, escalation.callId);
      }

      escalation.status = 'completed';
      escalation.completedAt = Date.now();

      this.emit('escalation-completed', escalation);

      return {
        success: true,
        escalationId,
        newThreadId: threadId,
      };
    }
  }

  /**
   * Decline a pending escalation request
   */
  declineEscalation(escalationId: string, reason?: string): boolean {
    const escalation = this.escalations.get(escalationId);
    if (!escalation || escalation.status !== 'pending') {
      return false;
    }

    escalation.status = 'declined';
    escalation.completedAt = Date.now();
    if (reason) {
      escalation.reason = reason;
    }

    this.emit('escalation-declined', escalation);
    return true;
  }

  /**
   * Get call ID linked to a thread
   */
  getLinkedCall(threadId: string): string | undefined {
    return this.threadToCall.get(threadId);
  }

  /**
   * Get thread ID linked to a call
   */
  getLinkedThread(callId: string): string | undefined {
    return this.callToThread.get(callId);
  }

  /**
   * Check if thread has a linked call
   */
  hasLinkedCall(threadId: string): boolean {
    return this.threadToCall.has(threadId);
  }

  /**
   * Check if call has a linked thread
   */
  hasLinkedThread(callId: string): boolean {
    return this.callToThread.has(callId);
  }

  /**
   * Get escalation by ID
   */
  getEscalation(escalationId: string): EscalationRequest | undefined {
    return this.escalations.get(escalationId);
  }

  /**
   * Get pending escalation requests for a thread or call
   */
  getPendingEscalations(channelId: string): EscalationRequest[] {
    return Array.from(this.escalations.values()).filter(
      (e) =>
        e.status === 'pending' &&
        (e.threadId === channelId || e.callId === channelId)
    );
  }

  /**
   * Add a system message about channel transition
   */
  private addTransitionMessage(
    thread: MessagingThread,
    direction: 'to-voice' | 'to-messaging',
    reason?: string
  ): void {
    const message = direction === 'to-voice'
      ? '📞 This conversation has been escalated to a voice call' +
        (reason ? `: ${reason}` : '')
      : '💬 This conversation has been moved to messaging' +
        (reason ? `: ${reason}` : '');

    thread.messages.push({
      id: crypto.randomUUID(),
      threadId: thread.threadId,
      content: message,
      senderPubkey: 'system',
      senderType: 'system',
      timestamp: Date.now(),
      read: true,
    });
  }

  /**
   * Clear link between thread and call (on call end)
   */
  clearLink(channelId: string): void {
    // Try to find and clear by thread ID
    const callId = this.threadToCall.get(channelId);
    if (callId) {
      this.threadToCall.delete(channelId);
      this.callToThread.delete(callId);
      return;
    }

    // Try to find and clear by call ID
    const threadId = this.callToThread.get(channelId);
    if (threadId) {
      this.callToThread.delete(channelId);
      this.threadToCall.delete(threadId);
    }
  }

  /**
   * Get escalation history for a channel
   */
  getHistory(channelId: string): EscalationRequest[] {
    return Array.from(this.escalations.values())
      .filter((e) => e.threadId === channelId || e.callId === channelId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

// Singleton instance
export const channelEscalation = new ChannelEscalation();
