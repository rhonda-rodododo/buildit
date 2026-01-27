/**
 * Hotline Queue Manager
 * Manages call queues with priority ordering and automatic call distribution (ACD)
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type {
  HotlineCallState,
} from '../types';
import {
  HotlineCallStatePriority,
  HotlineCallStateState,
  HotlineOperatorStatusStatus,
  HotlineCallStateCallType,
} from '../types';
import { useCallingStore } from '../callingStore';

/**
 * Priority weights for queue ordering
 * Higher weight = higher priority
 */
const PRIORITY_WEIGHTS: Record<HotlineCallStatePriority, number> = {
  [HotlineCallStatePriority.Urgent]: 1000,
  [HotlineCallStatePriority.High]: 100,
  [HotlineCallStatePriority.Medium]: 10,
  [HotlineCallStatePriority.Low]: 1,
};

/**
 * Configuration for ACD behavior
 */
interface ACDConfig {
  ringTimeout: number; // Seconds before returning call to queue
  wrapUpDuration: number; // Seconds in wrap-up state after call
  maxQueueSize: number; // Maximum calls in queue
  averageHandleTime: number; // Average call duration for wait estimation
}

const DEFAULT_ACD_CONFIG: ACDConfig = {
  ringTimeout: 30,
  wrapUpDuration: 60,
  maxQueueSize: 50,
  averageHandleTime: 300, // 5 minutes
};

export interface QueuedCall {
  callId: string;
  hotlineId: string;
  groupId?: string;
  callerPubkey?: string;
  callerPhone?: string;
  callerName?: string;
  priority: HotlineCallStatePriority;
  category?: string;
  queuedAt: number;
  position: number;
  estimatedWaitTime: number;
  assignedOperator?: string;
  ringStartedAt?: number;
}

export interface OperatorState {
  pubkey: string;
  displayName?: string;
  hotlineId: string;
  status: HotlineOperatorStatusStatus;
  currentCallId?: string;
  callCount: number;
  shiftStart: number;
  lastCallEndedAt?: number;
}

export interface HotlineQueueManagerEvents {
  'call-queued': (call: QueuedCall) => void;
  'call-assigned': (call: QueuedCall, operator: OperatorState) => void;
  'call-answered': (callId: string, operatorPubkey: string) => void;
  'call-abandoned': (callId: string) => void;
  'call-returned-to-queue': (callId: string) => void;
  'queue-updated': (hotlineId: string, queue: QueuedCall[]) => void;
  'operator-status-changed': (operator: OperatorState) => void;
  'wait-time-updated': (hotlineId: string, estimatedWait: number) => void;
}

/**
 * Hotline Queue Manager
 * Handles call queuing, priority ordering, and automatic call distribution
 */
export class HotlineQueueManager extends EventEmitter {
  private queues: Map<string, QueuedCall[]> = new Map();
  private operators: Map<string, OperatorState> = new Map();
  private config: ACDConfig;
  private ringTimers: Map<string, NodeJS.Timeout> = new Map();
  private wrapUpTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<ACDConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ACD_CONFIG, ...config };
  }

  /**
   * Enqueue a new incoming call
   */
  async enqueueCall(
    hotlineId: string,
    callData: {
      callId?: string;
      groupId?: string;
      callerPubkey?: string;
      callerPhone?: string;
      callerName?: string;
      priority?: HotlineCallStatePriority;
      category?: string;
    }
  ): Promise<QueuedCall> {
    const queue = this.getOrCreateQueue(hotlineId);

    // Check queue size limit
    if (queue.length >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const callId = callData.callId || nanoid();
    const priority = callData.priority || HotlineCallStatePriority.Medium;
    const now = Date.now();

    const call: QueuedCall = {
      callId,
      hotlineId,
      groupId: callData.groupId,
      callerPubkey: callData.callerPubkey,
      callerPhone: callData.callerPhone,
      callerName: callData.callerName,
      priority,
      category: callData.category,
      queuedAt: now,
      position: queue.length + 1,
      estimatedWaitTime: this.estimateWaitTime(hotlineId, priority),
    };

    // Insert in priority order
    this.insertByPriority(queue, call);
    this.updatePositions(hotlineId);

    // Update store
    this.syncToStore(hotlineId);

    this.emit('call-queued', call);
    this.emit('queue-updated', hotlineId, [...queue]);

    // Try to distribute immediately
    await this.attemptDistribution(hotlineId);

    return call;
  }

  /**
   * Remove a call from the queue
   */
  dequeueCall(callId: string): QueuedCall | undefined {
    for (const [hotlineId, queue] of this.queues) {
      const index = queue.findIndex((c) => c.callId === callId);
      if (index !== -1) {
        const [call] = queue.splice(index, 1);
        this.updatePositions(hotlineId);
        this.syncToStore(hotlineId);
        this.emit('queue-updated', hotlineId, [...queue]);
        return call;
      }
    }
    return undefined;
  }

  /**
   * Mark a call as abandoned (caller hung up while waiting)
   */
  abandonCall(callId: string): void {
    const call = this.dequeueCall(callId);
    if (call) {
      this.emit('call-abandoned', callId);
    }
    // Clear any pending ring timer
    this.clearRingTimer(callId);
  }

  /**
   * Register an operator
   */
  registerOperator(
    pubkey: string,
    hotlineId: string,
    displayName?: string
  ): OperatorState {
    const operator: OperatorState = {
      pubkey,
      displayName,
      hotlineId,
      status: HotlineOperatorStatusStatus.Available,
      callCount: 0,
      shiftStart: Date.now(),
    };

    this.operators.set(pubkey, operator);
    this.emit('operator-status-changed', operator);

    // Try to distribute calls to new operator
    this.attemptDistribution(hotlineId);

    return operator;
  }

  /**
   * Unregister an operator (end shift)
   */
  unregisterOperator(pubkey: string): void {
    const operator = this.operators.get(pubkey);
    if (operator) {
      this.clearWrapUpTimer(pubkey);
      this.operators.delete(pubkey);
      this.emit('operator-status-changed', {
        ...operator,
        status: HotlineOperatorStatusStatus.Offline,
      });
    }
  }

  /**
   * Update operator status
   */
  setOperatorStatus(
    pubkey: string,
    status: HotlineOperatorStatusStatus
  ): void {
    const operator = this.operators.get(pubkey);
    if (!operator) return;

    const previousStatus = operator.status;
    operator.status = status;

    // Clear wrap-up timer if changing status
    if (previousStatus === HotlineOperatorStatusStatus.WrapUp) {
      this.clearWrapUpTimer(pubkey);
    }

    this.emit('operator-status-changed', operator);

    // Try to distribute if becoming available
    if (status === HotlineOperatorStatusStatus.Available) {
      this.attemptDistribution(operator.hotlineId);
    }
  }

  /**
   * Get available operators for a hotline
   */
  getAvailableOperators(hotlineId: string): OperatorState[] {
    return Array.from(this.operators.values()).filter(
      (op) =>
        op.hotlineId === hotlineId &&
        op.status === HotlineOperatorStatusStatus.Available
    );
  }

  /**
   * Get all operators for a hotline
   */
  getOperators(hotlineId: string): OperatorState[] {
    return Array.from(this.operators.values()).filter(
      (op) => op.hotlineId === hotlineId
    );
  }

  /**
   * Get the current queue for a hotline
   */
  getQueue(hotlineId: string): QueuedCall[] {
    return [...(this.queues.get(hotlineId) || [])];
  }

  /**
   * Get queue position for a specific call
   */
  getQueuePosition(callId: string): number | undefined {
    for (const queue of this.queues.values()) {
      const call = queue.find((c) => c.callId === callId);
      if (call) return call.position;
    }
    return undefined;
  }

  /**
   * Attempt to distribute calls to available operators
   */
  async attemptDistribution(hotlineId: string): Promise<void> {
    const queue = this.queues.get(hotlineId);
    if (!queue || queue.length === 0) return;

    const availableOperators = this.getAvailableOperators(hotlineId);
    if (availableOperators.length === 0) return;

    // Get the highest priority call that isn't already being rung
    const callToAssign = queue.find((c) => !c.assignedOperator);
    if (!callToAssign) return;

    // Find the best operator (round-robin based on call count)
    const operator = availableOperators.reduce((best, current) =>
      current.callCount < best.callCount ? current : best
    );

    await this.assignCallToOperator(callToAssign, operator);
  }

  /**
   * Assign a call to a specific operator
   */
  async assignCallToOperator(
    call: QueuedCall,
    operator: OperatorState
  ): Promise<void> {
    call.assignedOperator = operator.pubkey;
    call.ringStartedAt = Date.now();

    // Update operator status to on-call (ringing)
    operator.status = HotlineOperatorStatusStatus.OnCall;
    operator.currentCallId = call.callId;

    this.emit('call-assigned', call, operator);
    this.emit('operator-status-changed', operator);

    // Set ring timeout
    const timer = setTimeout(() => {
      this.handleRingTimeout(call.callId);
    }, this.config.ringTimeout * 1000);
    this.ringTimers.set(call.callId, timer);
  }

  /**
   * Handle operator answering a call
   */
  handleOperatorAnswer(callId: string, operatorPubkey: string): void {
    this.clearRingTimer(callId);

    const call = this.dequeueCall(callId);
    if (!call) return;

    const operator = this.operators.get(operatorPubkey);
    if (operator) {
      operator.status = HotlineOperatorStatusStatus.OnCall;
      operator.currentCallId = callId;
      operator.callCount++;
      this.emit('operator-status-changed', operator);
    }

    this.emit('call-answered', callId, operatorPubkey);

    // Update store with active call
    const store = useCallingStore.getState();
    store.addHotlineCall({
      _v: '1',
      callId,
      hotlineId: call.hotlineId,
      groupId: call.groupId,
      callType: call.callerPubkey ? HotlineCallStateCallType.Internal : HotlineCallStateCallType.Pstn,
      state: HotlineCallStateState.Active,
      caller: {
        pubkey: call.callerPubkey,
        phone: call.callerPhone,
        name: call.callerName,
      },
      operator: {
        pubkey: operatorPubkey,
      },
      queuedAt: call.queuedAt,
      answeredAt: Date.now(),
      priority: call.priority,
      category: call.category,
    });
  }

  /**
   * Handle call ending
   */
  handleCallEnd(callId: string, operatorPubkey: string): void {
    const operator = this.operators.get(operatorPubkey);
    if (!operator) return;

    operator.currentCallId = undefined;
    operator.lastCallEndedAt = Date.now();

    // Enter wrap-up state
    operator.status = HotlineOperatorStatusStatus.WrapUp;
    this.emit('operator-status-changed', operator);

    // Auto-return to available after wrap-up duration
    const timer = setTimeout(() => {
      this.setOperatorStatus(operatorPubkey, HotlineOperatorStatusStatus.Available);
    }, this.config.wrapUpDuration * 1000);
    this.wrapUpTimers.set(operatorPubkey, timer);

    // Update store
    const store = useCallingStore.getState();
    store.updateHotlineCall(callId, {
      state: HotlineCallStateState.Completed,
      endedAt: Date.now(),
    });
  }

  /**
   * Handle ring timeout - return call to queue
   */
  private handleRingTimeout(callId: string): void {
    this.clearRingTimer(callId);

    // Find the call in any queue
    for (const [hotlineId, queue] of this.queues) {
      const call = queue.find((c) => c.callId === callId);
      if (call && call.assignedOperator) {
        // Reset the operator back to available
        const operator = this.operators.get(call.assignedOperator);
        if (operator) {
          operator.status = HotlineOperatorStatusStatus.Available;
          operator.currentCallId = undefined;
          this.emit('operator-status-changed', operator);
        }

        // Remove assignment and bump priority
        call.assignedOperator = undefined;
        call.ringStartedAt = undefined;

        // Bump priority slightly for long-waiting callers
        if (call.priority !== HotlineCallStatePriority.Urgent) {
          const priorities = [
            HotlineCallStatePriority.Low,
            HotlineCallStatePriority.Medium,
            HotlineCallStatePriority.High,
            HotlineCallStatePriority.Urgent,
          ];
          const currentIndex = priorities.indexOf(call.priority);
          if (currentIndex < priorities.length - 1) {
            call.priority = priorities[currentIndex + 1];
            // Re-sort queue
            queue.sort((a, b) =>
              PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority] ||
              a.queuedAt - b.queuedAt
            );
            this.updatePositions(hotlineId);
          }
        }

        this.emit('call-returned-to-queue', callId);
        this.syncToStore(hotlineId);

        // Try to assign to another operator
        this.attemptDistribution(hotlineId);
        break;
      }
    }
  }

  /**
   * Get estimated wait time for a new call at given priority
   */
  private estimateWaitTime(
    hotlineId: string,
    priority: HotlineCallStatePriority
  ): number {
    const queue = this.queues.get(hotlineId) || [];
    const availableOperators = this.getAvailableOperators(hotlineId);

    if (availableOperators.length === 0) {
      // No operators: estimate based on average handle time
      const callsAhead = queue.filter(
        (c) => PRIORITY_WEIGHTS[c.priority] >= PRIORITY_WEIGHTS[priority]
      ).length;
      return callsAhead * this.config.averageHandleTime;
    }

    // With available operators, estimate is lower
    const callsAhead = queue.filter(
      (c) => PRIORITY_WEIGHTS[c.priority] >= PRIORITY_WEIGHTS[priority]
    ).length;

    return Math.ceil(
      (callsAhead * this.config.averageHandleTime) / availableOperators.length
    );
  }

  /**
   * Update wait time estimates for all calls in queue
   */
  updateWaitEstimates(hotlineId: string): void {
    const queue = this.queues.get(hotlineId);
    if (!queue) return;

    const availableOperators = this.getAvailableOperators(hotlineId);
    const operatorCount = Math.max(1, availableOperators.length);

    queue.forEach((call, index) => {
      call.estimatedWaitTime = Math.ceil(
        ((index + 1) * this.config.averageHandleTime) / operatorCount
      );
    });

    const averageWait = queue.length > 0
      ? queue.reduce((sum, c) => sum + c.estimatedWaitTime, 0) / queue.length
      : 0;

    this.emit('wait-time-updated', hotlineId, averageWait);
    this.syncToStore(hotlineId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(hotlineId: string): {
    totalCalls: number;
    avgWaitTime: number;
    longestWait: number;
    byPriority: Record<HotlineCallStatePriority, number>;
    availableOperators: number;
    onCallOperators: number;
  } {
    const queue = this.queues.get(hotlineId) || [];
    const operators = this.getOperators(hotlineId);
    const now = Date.now();

    const byPriority: Record<HotlineCallStatePriority, number> = {
      [HotlineCallStatePriority.Urgent]: 0,
      [HotlineCallStatePriority.High]: 0,
      [HotlineCallStatePriority.Medium]: 0,
      [HotlineCallStatePriority.Low]: 0,
    };

    let totalWait = 0;
    let longestWait = 0;

    queue.forEach((call) => {
      byPriority[call.priority]++;
      const waitTime = now - call.queuedAt;
      totalWait += waitTime;
      longestWait = Math.max(longestWait, waitTime);
    });

    return {
      totalCalls: queue.length,
      avgWaitTime: queue.length > 0 ? Math.round(totalWait / queue.length / 1000) : 0,
      longestWait: Math.round(longestWait / 1000),
      byPriority,
      availableOperators: operators.filter(
        (o) => o.status === HotlineOperatorStatusStatus.Available
      ).length,
      onCallOperators: operators.filter(
        (o) => o.status === HotlineOperatorStatusStatus.OnCall
      ).length,
    };
  }

  // Helper methods

  private getOrCreateQueue(hotlineId: string): QueuedCall[] {
    if (!this.queues.has(hotlineId)) {
      this.queues.set(hotlineId, []);
    }
    return this.queues.get(hotlineId)!;
  }

  private insertByPriority(queue: QueuedCall[], call: QueuedCall): void {
    const insertIndex = queue.findIndex(
      (c) =>
        PRIORITY_WEIGHTS[c.priority] < PRIORITY_WEIGHTS[call.priority] ||
        (PRIORITY_WEIGHTS[c.priority] === PRIORITY_WEIGHTS[call.priority] &&
          c.queuedAt > call.queuedAt)
    );

    if (insertIndex === -1) {
      queue.push(call);
    } else {
      queue.splice(insertIndex, 0, call);
    }
  }

  private updatePositions(hotlineId: string): void {
    const queue = this.queues.get(hotlineId);
    if (!queue) return;

    queue.forEach((call, index) => {
      call.position = index + 1;
    });
  }

  private syncToStore(hotlineId: string): void {
    const queue = this.queues.get(hotlineId) || [];
    const store = useCallingStore.getState();

    // Convert QueuedCall to HotlineCallState for store
    const queueState: HotlineCallState[] = queue.map((call) => ({
      _v: '1',
      callId: call.callId,
      hotlineId: call.hotlineId,
      groupId: call.groupId,
      callType: call.callerPubkey ? HotlineCallStateCallType.Internal : HotlineCallStateCallType.Pstn,
      state: call.assignedOperator
        ? HotlineCallStateState.Ringing
        : HotlineCallStateState.Queued,
      caller: {
        pubkey: call.callerPubkey,
        phone: call.callerPhone,
        name: call.callerName,
      },
      queuedAt: call.queuedAt,
      queuePosition: call.position,
      waitDuration: call.estimatedWaitTime,
      priority: call.priority,
      category: call.category,
    }));

    store.setHotlineQueue(queueState);
  }

  private clearRingTimer(callId: string): void {
    const timer = this.ringTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.ringTimers.delete(callId);
    }
  }

  private clearWrapUpTimer(pubkey: string): void {
    const timer = this.wrapUpTimers.get(pubkey);
    if (timer) {
      clearTimeout(timer);
      this.wrapUpTimers.delete(pubkey);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    for (const timer of this.ringTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.wrapUpTimers.values()) {
      clearTimeout(timer);
    }
    this.ringTimers.clear();
    this.wrapUpTimers.clear();
    this.queues.clear();
    this.operators.clear();
    this.removeAllListeners();
  }
}

export default HotlineQueueManager;
