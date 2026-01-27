/**
 * Operator Status Manager
 * Manages operator status, shift tracking, and availability
 */

import { EventEmitter } from 'events';
import type { HotlineOperatorStatus, HotlineConfig } from '../types';
import {
  HotlineOperatorStatusStatus,
  CALLING_KINDS,
} from '../types';
import { useCallingStore } from '../callingStore';
import type { SignalingService } from './signalingService';

/**
 * Operator shift statistics
 */
export interface ShiftStats {
  shiftStart: number;
  shiftDuration: number;
  callCount: number;
  avgCallDuration: number;
  totalTalkTime: number;
  totalHoldTime: number;
  totalWrapUpTime: number;
  longestCall: number;
  shortestCall: number;
}

/**
 * Operator break configuration
 */
export interface BreakConfig {
  type: 'short' | 'meal' | 'personal';
  maxDuration: number; // seconds
}

const BREAK_CONFIGS: Record<string, BreakConfig> = {
  short: { type: 'short', maxDuration: 15 * 60 },
  meal: { type: 'meal', maxDuration: 60 * 60 },
  personal: { type: 'personal', maxDuration: 30 * 60 },
};

export interface OperatorStatusManagerEvents {
  'status-changed': (status: HotlineOperatorStatus) => void;
  'shift-started': (pubkey: string, hotlineId: string) => void;
  'shift-ended': (pubkey: string, stats: ShiftStats) => void;
  'break-started': (pubkey: string, breakType: string) => void;
  'break-ended': (pubkey: string) => void;
  'break-overtime': (pubkey: string) => void;
}

/**
 * Operator Status Manager
 * Tracks operator availability, shifts, and break times
 */
export class OperatorStatusManager extends EventEmitter {
  private signalingService: SignalingService;
  private localPubkey: string;
  private currentStatus: HotlineOperatorStatus | null = null;
  private shiftStats: ShiftStats | null = null;
  private breakTimer: NodeJS.Timeout | null = null;
  private breakStartTime: number | null = null;
  private breakType: string | null = null;
  private callDurations: number[] = [];

  constructor(signalingService: SignalingService, localPubkey: string) {
    super();
    this.signalingService = signalingService;
    this.localPubkey = localPubkey;

    // Listen for status updates from other operators
    this.setupSignalingListeners();
  }

  /**
   * Start a new shift
   */
  async startShift(hotlineId: string): Promise<void> {
    const now = Date.now();

    this.shiftStats = {
      shiftStart: now,
      shiftDuration: 0,
      callCount: 0,
      avgCallDuration: 0,
      totalTalkTime: 0,
      totalHoldTime: 0,
      totalWrapUpTime: 0,
      longestCall: 0,
      shortestCall: Infinity,
    };

    this.callDurations = [];

    const status: HotlineOperatorStatus = {
      _v: '1',
      hotlineId,
      pubkey: this.localPubkey,
      status: HotlineOperatorStatusStatus.Available,
      callCount: 0,
      shiftStart: now,
      timestamp: now,
    };

    await this.setStatus(status);
    this.emit('shift-started', this.localPubkey, hotlineId);
  }

  /**
   * End the current shift
   */
  async endShift(): Promise<ShiftStats | null> {
    if (!this.currentStatus || !this.shiftStats) {
      return null;
    }

    const now = Date.now();
    this.shiftStats.shiftDuration = now - this.shiftStats.shiftStart;

    // Calculate average call duration
    if (this.callDurations.length > 0) {
      this.shiftStats.avgCallDuration =
        this.callDurations.reduce((a, b) => a + b, 0) / this.callDurations.length;
    }

    // Fix shortestCall if no calls were taken
    if (this.shiftStats.shortestCall === Infinity) {
      this.shiftStats.shortestCall = 0;
    }

    const stats = { ...this.shiftStats };

    // Set status to offline
    await this.setStatus({
      ...this.currentStatus,
      status: HotlineOperatorStatusStatus.Offline,
      shiftEnd: now,
      timestamp: now,
    });

    this.shiftStats = null;
    this.currentStatus = null;

    this.emit('shift-ended', this.localPubkey, stats);
    return stats;
  }

  /**
   * Set operator status
   */
  async setStatus(status: HotlineOperatorStatus): Promise<void> {
    const previousStatus = this.currentStatus?.status;
    this.currentStatus = status;

    // Update store
    const store = useCallingStore.getState();
    store.setOperatorStatus(status);

    // Broadcast status via signaling
    await this.broadcastStatus(status);

    this.emit('status-changed', status);

    // Handle wrap-up time tracking
    if (previousStatus === HotlineOperatorStatusStatus.WrapUp) {
      if (this.shiftStats) {
        const wrapUpDuration = Date.now() - (this.shiftStats.shiftStart + this.shiftStats.totalWrapUpTime);
        this.shiftStats.totalWrapUpTime += wrapUpDuration;
      }
    }

    // Handle break end
    if (previousStatus === HotlineOperatorStatusStatus.Break &&
        status.status !== HotlineOperatorStatusStatus.Break) {
      this.handleBreakEnd();
    }
  }

  /**
   * Start a break
   */
  async startBreak(breakType: 'short' | 'meal' | 'personal'): Promise<void> {
    if (!this.currentStatus) {
      throw new Error('No active shift');
    }

    if (this.currentStatus.status === HotlineOperatorStatusStatus.OnCall) {
      throw new Error('Cannot start break while on call');
    }

    const config = BREAK_CONFIGS[breakType];
    if (!config) {
      throw new Error('Invalid break type');
    }

    this.breakType = breakType;
    this.breakStartTime = Date.now();

    await this.setStatus({
      ...this.currentStatus,
      status: HotlineOperatorStatusStatus.Break,
      timestamp: Date.now(),
    });

    // Set timer for break overtime warning
    this.breakTimer = setTimeout(() => {
      this.emit('break-overtime', this.localPubkey);
    }, config.maxDuration * 1000);

    this.emit('break-started', this.localPubkey, breakType);
  }

  /**
   * End break and return to available
   */
  async endBreak(): Promise<void> {
    if (!this.currentStatus ||
        this.currentStatus.status !== HotlineOperatorStatusStatus.Break) {
      return;
    }

    this.handleBreakEnd();

    await this.setStatus({
      ...this.currentStatus,
      status: HotlineOperatorStatusStatus.Available,
      timestamp: Date.now(),
    });

    this.emit('break-ended', this.localPubkey);
  }

  /**
   * Record a call completion
   */
  recordCallCompletion(duration: number, holdTime: number = 0): void {
    if (!this.shiftStats || !this.currentStatus) return;

    this.callDurations.push(duration);
    this.shiftStats.callCount++;
    this.shiftStats.totalTalkTime += duration - holdTime;
    this.shiftStats.totalHoldTime += holdTime;

    if (duration > this.shiftStats.longestCall) {
      this.shiftStats.longestCall = duration;
    }
    if (duration < this.shiftStats.shortestCall) {
      this.shiftStats.shortestCall = duration;
    }

    // Update current status call count
    this.currentStatus.callCount = this.shiftStats.callCount;
    this.emit('status-changed', this.currentStatus);
  }

  /**
   * Get current status
   */
  getStatus(): HotlineOperatorStatus | null {
    return this.currentStatus;
  }

  /**
   * Get current shift stats
   */
  getShiftStats(): ShiftStats | null {
    if (!this.shiftStats) return null;

    // Update duration to current time
    return {
      ...this.shiftStats,
      shiftDuration: Date.now() - this.shiftStats.shiftStart,
    };
  }

  /**
   * Get break time remaining (in seconds)
   */
  getBreakTimeRemaining(): number | null {
    if (!this.breakStartTime || !this.breakType) return null;

    const config = BREAK_CONFIGS[this.breakType];
    if (!config) return null;

    const elapsed = (Date.now() - this.breakStartTime) / 1000;
    return Math.max(0, config.maxDuration - elapsed);
  }

  /**
   * Check if operator is available to take calls
   */
  isAvailable(): boolean {
    return this.currentStatus?.status === HotlineOperatorStatusStatus.Available;
  }

  /**
   * Check if operator is on a call
   */
  isOnCall(): boolean {
    return this.currentStatus?.status === HotlineOperatorStatusStatus.OnCall;
  }

  /**
   * Get formatted shift duration
   */
  getFormattedShiftDuration(): string {
    const stats = this.getShiftStats();
    if (!stats) return '0:00:00';

    const hours = Math.floor(stats.shiftDuration / 3600000);
    const minutes = Math.floor((stats.shiftDuration % 3600000) / 60000);
    const seconds = Math.floor((stats.shiftDuration % 60000) / 1000);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Private methods

  private handleBreakEnd(): void {
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
    this.breakStartTime = null;
    this.breakType = null;
  }

  private async broadcastStatus(status: HotlineOperatorStatus): Promise<void> {
    try {
      await this.signalingService.publishNostrEvent({
        kind: CALLING_KINDS.HOTLINE_OPERATOR_STATUS,
        content: JSON.stringify(status),
        tags: [
          ['h', status.hotlineId],
          ['d', `operator:${status.pubkey}`],
        ],
      });
    } catch (error) {
      console.error('Failed to broadcast operator status:', error);
    }
  }

  private setupSignalingListeners(): void {
    // Listen for operator status updates from signaling
    this.signalingService.on('nostr-event', (event) => {
      if (event.kind === CALLING_KINDS.HOTLINE_OPERATOR_STATUS) {
        try {
          const status = JSON.parse(event.content) as HotlineOperatorStatus;
          // Only process if it's not our own status
          if (status.pubkey !== this.localPubkey) {
            // Could update a list of other operators here
          }
        } catch (error) {
          console.error('Failed to parse operator status:', error);
        }
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
    this.removeAllListeners();
  }
}

export default OperatorStatusManager;
