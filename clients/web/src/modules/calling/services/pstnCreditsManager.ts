/**
 * PSTN Credits Manager
 * Handles credit balance tracking and usage for PSTN calls
 */

import { EventEmitter } from 'events';
import type { LocalCreditBalance, PSTNUsageRecord } from '../types';
import { CALLING_KINDS } from '../types';
import type { SignalingService } from './signalingService';
import { fetchWithRetry } from './utils';

/**
 * Credit alert thresholds
 */
const CREDIT_THRESHOLDS = {
  WARNING: 0.8, // 80% used - warning
  CRITICAL: 0.95, // 95% used - critical
};

/**
 * Credits manager configuration
 */
interface CreditsManagerConfig {
  workerUrl: string;
  pollingInterval?: number; // ms, default 60000 (1 minute)
}

/**
 * PSTN Credits Manager Events
 */
export interface PSTNCreditsManagerEvents {
  'balance-updated': (balance: LocalCreditBalance) => void;
  'credits-low': (balance: LocalCreditBalance) => void;
  'credits-critical': (balance: LocalCreditBalance) => void;
  'credits-exhausted': (balance: LocalCreditBalance) => void;
  'usage-recorded': (record: PSTNUsageRecord) => void;
}

/**
 * PSTN Credits Manager
 * Tracks credit balances and usage for PSTN calling
 */
export class PSTNCreditsManager extends EventEmitter {
  private config: CreditsManagerConfig;
  private balances: Map<string, LocalCreditBalance> = new Map();
  private usageHistory: Map<string, PSTNUsageRecord[]> = new Map();
  private pollingInterval?: NodeJS.Timeout;

  // API endpoints
  private readonly API_BASE: string;

  // Note: signalingService is kept in constructor signature for API compatibility
  // Credit events are received via handleSignalingEvent() called by external code
  constructor(_signalingService: SignalingService, config: CreditsManagerConfig) {
    super();
    this.config = config;
    this.API_BASE = config.workerUrl;
  }

  /**
   * Handle credit event from signaling
   * This should be called from the main signaling event handler
   */
  handleSignalingEvent(event: { kind: number; content: string }): void {
    if (event.kind === CALLING_KINDS.PSTN_CREDITS) {
      this.handleCreditsEvent(JSON.parse(event.content));
    }
  }

  /**
   * Handle credits event from signaling
   */
  private handleCreditsEvent(data: {
    type: string;
    groupId: string;
    [key: string]: unknown;
  }): void {
    switch (data.type) {
      case 'balance_update': {
        const balance: LocalCreditBalance = {
          groupId: data.groupId,
          monthlyAllocation: data.monthlyAllocation as number,
          used: data.used as number,
          remaining: data.remaining as number,
          percentUsed: ((data.used as number) / (data.monthlyAllocation as number)) * 100,
          resetDate: new Date(data.resetDate as number),
          isLow: (data.used as number) / (data.monthlyAllocation as number) >= CREDIT_THRESHOLDS.WARNING,
        };
        this.updateBalance(balance);
        break;
      }

      case 'usage': {
        const record: PSTNUsageRecord = {
          callSid: data.callSid as string,
          direction: data.direction as 'inbound' | 'outbound',
          duration: data.duration as number,
          creditsCost: data.creditsCost as number,
          timestamp: data.timestamp as number,
          targetPhone: data.targetPhone as string | undefined,
        };
        this.recordUsage(data.groupId, record);
        break;
      }
    }
  }

  /**
   * Fetch current balance from backend
   */
  async getBalance(groupId: string): Promise<LocalCreditBalance> {
    // Check cache first
    const cached = this.balances.get(groupId);
    if (cached) {
      return cached;
    }

    // Fetch from backend with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/credits/${groupId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      { maxRetries: 3 }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch credit balance');
    }

    const data = await response.json();

    const balance: LocalCreditBalance = {
      groupId,
      monthlyAllocation: data.monthlyAllocation,
      used: data.used,
      remaining: data.remaining,
      percentUsed: (data.used / data.monthlyAllocation) * 100,
      resetDate: new Date(data.resetDate),
      isLow: data.used / data.monthlyAllocation >= CREDIT_THRESHOLDS.WARNING,
    };

    this.updateBalance(balance);
    return balance;
  }

  /**
   * Get usage history for a group
   */
  async getUsageHistory(groupId: string, days: number = 30): Promise<PSTNUsageRecord[]> {
    // Check cache first
    const cached = this.usageHistory.get(groupId);
    if (cached && cached.length > 0) {
      // Filter to requested days
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return cached.filter((r) => r.timestamp >= cutoff);
    }

    // Fetch from backend with retry
    const response = await fetchWithRetry(
      `${this.API_BASE}/api/pstn/credits/${groupId}/usage?days=${days}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      { maxRetries: 3 }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch usage history');
    }

    const data = await response.json();
    const records: PSTNUsageRecord[] = data.records;

    // Cache the records
    this.usageHistory.set(groupId, records);

    return records;
  }

  /**
   * Get usage summary for a group
   */
  async getUsageSummary(groupId: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    totalCost: number;
    inboundCalls: number;
    outboundCalls: number;
    averageCallDuration: number;
    peakHour: number; // 0-23
  }> {
    const records = await this.getUsageHistory(groupId);

    if (records.length === 0) {
      return {
        totalCalls: 0,
        totalMinutes: 0,
        totalCost: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        averageCallDuration: 0,
        peakHour: 0,
      };
    }

    const totalCalls = records.length;
    const totalMinutes = Math.round(records.reduce((sum, r) => sum + r.duration, 0) / 60);
    const totalCost = records.reduce((sum, r) => sum + r.creditsCost, 0);
    const inboundCalls = records.filter((r) => r.direction === 'inbound').length;
    const outboundCalls = records.filter((r) => r.direction === 'outbound').length;
    const averageCallDuration = Math.round(
      records.reduce((sum, r) => sum + r.duration, 0) / totalCalls
    );

    // Calculate peak hour
    const hourCounts = new Array(24).fill(0);
    for (const record of records) {
      const hour = new Date(record.timestamp).getHours();
      hourCounts[hour]++;
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalCalls,
      totalMinutes,
      totalCost,
      inboundCalls,
      outboundCalls,
      averageCallDuration,
      peakHour,
    };
  }

  /**
   * Check if group has sufficient credits for a call
   */
  async hasCredits(groupId: string, estimatedMinutes: number = 1): Promise<boolean> {
    const balance = await this.getBalance(groupId);
    return balance.remaining >= estimatedMinutes;
  }

  /**
   * Update balance and emit events if needed
   */
  private updateBalance(balance: LocalCreditBalance): void {
    const previousBalance = this.balances.get(balance.groupId);
    this.balances.set(balance.groupId, balance);

    this.emit('balance-updated', balance);

    // Check for threshold crossings
    const previousPercent = previousBalance?.percentUsed || 0;

    if (balance.remaining <= 0) {
      this.emit('credits-exhausted', balance);
    } else if (balance.percentUsed >= CREDIT_THRESHOLDS.CRITICAL * 100 &&
               previousPercent < CREDIT_THRESHOLDS.CRITICAL * 100) {
      this.emit('credits-critical', balance);
    } else if (balance.percentUsed >= CREDIT_THRESHOLDS.WARNING * 100 &&
               previousPercent < CREDIT_THRESHOLDS.WARNING * 100) {
      this.emit('credits-low', balance);
    }
  }

  /**
   * Record a usage event
   */
  private recordUsage(groupId: string, record: PSTNUsageRecord): void {
    // Add to history
    const history = this.usageHistory.get(groupId) || [];
    history.push(record);
    this.usageHistory.set(groupId, history);

    // Emit event
    this.emit('usage-recorded', record);

    // Update balance (deduct credits)
    const balance = this.balances.get(groupId);
    if (balance) {
      balance.used += record.creditsCost;
      balance.remaining = balance.monthlyAllocation - balance.used;
      balance.percentUsed = (balance.used / balance.monthlyAllocation) * 100;
      balance.isLow = balance.percentUsed >= CREDIT_THRESHOLDS.WARNING * 100;
      this.updateBalance(balance);
    }
  }

  /**
   * Start polling for balance updates
   */
  startPolling(groupIds: string[]): void {
    this.stopPolling();

    const pollInterval = this.config.pollingInterval || 60000;

    this.pollingInterval = setInterval(async () => {
      for (const groupId of groupIds) {
        try {
          await this.getBalance(groupId);
        } catch (e) {
          // Ignore errors during polling
        }
      }
    }, pollInterval);

    // Fetch immediately
    for (const groupId of groupIds) {
      this.getBalance(groupId).catch(() => {
        // Ignore initial fetch errors
      });
    }
  }

  /**
   * Stop polling for balance updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
   * Get cached balance (synchronous)
   */
  getCachedBalance(groupId: string): LocalCreditBalance | undefined {
    return this.balances.get(groupId);
  }

  /**
   * Get all cached balances
   */
  getAllCachedBalances(): LocalCreditBalance[] {
    return Array.from(this.balances.values());
  }

  /**
   * Format credits for display
   */
  static formatCredits(credits: number): string {
    if (credits >= 60) {
      const hours = Math.floor(credits / 60);
      const mins = credits % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${credits}m`;
  }

  /**
   * Format percentage for display
   */
  static formatPercentage(percent: number): string {
    return `${Math.round(percent)}%`;
  }

  /**
   * Get status color based on usage
   */
  static getStatusColor(percentUsed: number): 'green' | 'yellow' | 'red' {
    if (percentUsed >= CREDIT_THRESHOLDS.CRITICAL * 100) {
      return 'red';
    }
    if (percentUsed >= CREDIT_THRESHOLDS.WARNING * 100) {
      return 'yellow';
    }
    return 'green';
  }

  /**
   * Calculate days until reset
   */
  static getDaysUntilReset(resetDate: Date): number {
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    this.balances.clear();
    this.usageHistory.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a PSTN Credits Manager instance
 */
export function createPSTNCreditsManager(
  signalingService: SignalingService,
  config: CreditsManagerConfig
): PSTNCreditsManager {
  return new PSTNCreditsManager(signalingService, config);
}

export default PSTNCreditsManager;
