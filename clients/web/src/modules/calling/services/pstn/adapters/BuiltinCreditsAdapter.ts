/**
 * Built-in Credits Adapter
 * Uses the BuildIt backend for PSTN calls with a credit-based system
 */

import {
  BasePSTNProviderAdapter,
  type PSTNProviderConfig,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type ProviderTestResult,
} from '../PSTNProviderAdapter';
import type { LocalCreditBalance, PSTNUsageRecord } from '../../../types';

/**
 * Credit alert thresholds
 */
const CREDIT_THRESHOLDS = {
  WARNING: 0.8,   // 80% used
  CRITICAL: 0.95, // 95% used
};

/**
 * Built-in Credits Adapter
 * Default PSTN provider that uses the BuildIt backend with metered credits
 */
export class BuiltinCreditsAdapter extends BasePSTNProviderAdapter {
  readonly providerType = 'builtin-credits' as const;

  private readonly apiBase: string;
  private cachedBalance: LocalCreditBalance | null = null;
  private usageCache: Map<number, PSTNUsageRecord[]> = new Map();

  constructor(config: PSTNProviderConfig) {
    super(config);
    this.apiBase = config.builtinWorkerUrl || '';
    if (!this.apiBase) {
      console.warn('BuiltinCreditsAdapter: No worker URL provided');
    }
  }

  async initialize(): Promise<void> {
    // Test connection on initialize
    const result = await this.testConnection();
    this.status.connected = result.success;
    if (!result.success) {
      this.status.lastError = result.error;
      this.status.lastErrorAt = Date.now();
    }
  }

  async destroy(): Promise<void> {
    this.cachedBalance = null;
    this.usageCache.clear();
    this.status.connected = false;
  }

  async testConnection(): Promise<ProviderTestResult> {
    if (!this.apiBase) {
      return {
        success: false,
        error: 'No backend URL configured',
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.withRetry(
        () => fetch(`${this.apiBase}/api/pstn/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        { maxRetries: 2, backoff: 500 }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Backend returned ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async initiateCall(options: OutboundCallOptions): Promise<CallInitiationResult> {
    const { targetPhone, hotlineId, callerId, operatorPubkey } = options;

    // Validate phone number
    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid phone number format');
    }

    // Check credits before initiating
    const hasCredits = await this.hasCredits(1);
    if (!hasCredits) {
      throw new Error('Insufficient credits for call');
    }

    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/voice/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPhone: normalizedPhone,
          hotlineId,
          callerId,
          operatorPubkey,
          groupId: this.config.groupId,
        }),
      }),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to initiate call: ${error}`);
    }

    const data = await response.json();
    return {
      callSid: data.callSid,
      sipUri: data.sipUri,
      webrtcConfig: data.webrtcConfig,
    };
  }

  async answerCall(callSid: string, operatorPubkey?: string): Promise<AnswerCallResult> {
    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/voice/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid,
          operatorPubkey,
          groupId: this.config.groupId,
        }),
      }),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to answer call: ${error}`);
    }

    const data = await response.json();
    return {
      sipUri: data.sipUri,
      webrtcConfig: data.webrtcConfig,
    };
  }

  async holdCall(callSid: string): Promise<void> {
    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/voice/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, action: 'hold' }),
      }),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to put call on hold');
    }
  }

  async resumeCall(callSid: string): Promise<void> {
    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/voice/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, action: 'resume' }),
      }),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to resume call');
    }
  }

  async transferCall(callSid: string, targetPhone: string): Promise<void> {
    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid transfer phone number format');
    }

    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/voice/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, targetPhone: normalizedPhone }),
      }),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to transfer call');
    }
  }

  async endCall(callSid: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/api/pstn/voice/hangup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid }),
      });
    } catch {
      // Ignore errors - call might already be ended
    }
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/pstn/voice/dtmf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid, digits }),
    });

    if (!response.ok) {
      throw new Error('Failed to send DTMF');
    }
  }

  // ===== Credits =====

  async getBalance(): Promise<LocalCreditBalance> {
    // Return cached if recent (within 5 seconds)
    if (this.cachedBalance) {
      return this.cachedBalance;
    }

    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/credits/${this.config.groupId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch credit balance');
    }

    const data = await response.json();

    const balance: LocalCreditBalance = {
      groupId: this.config.groupId,
      monthlyAllocation: data.monthlyAllocation,
      used: data.used,
      remaining: data.remaining,
      percentUsed: (data.used / data.monthlyAllocation) * 100,
      resetDate: new Date(data.resetDate),
      isLow: data.used / data.monthlyAllocation >= CREDIT_THRESHOLDS.WARNING,
    };

    this.cachedBalance = balance;
    this.status.creditsRemaining = balance.remaining;

    // Clear cache after 5 seconds
    setTimeout(() => {
      if (this.cachedBalance === balance) {
        this.cachedBalance = null;
      }
    }, 5000);

    return balance;
  }

  async getUsageHistory(days: number = 30): Promise<PSTNUsageRecord[]> {
    // Check cache
    const cached = this.usageCache.get(days);
    if (cached) {
      return cached;
    }

    const response = await this.withRetry(
      () => fetch(
        `${this.apiBase}/api/pstn/credits/${this.config.groupId}/usage?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch usage history');
    }

    const data = await response.json();
    const records: PSTNUsageRecord[] = data.records;

    // Cache for 30 seconds
    this.usageCache.set(days, records);
    setTimeout(() => this.usageCache.delete(days), 30000);

    return records;
  }

  async hasCredits(estimatedMinutes: number = 1): Promise<boolean> {
    try {
      const balance = await this.getBalance();
      return balance.remaining >= estimatedMinutes;
    } catch {
      // On error, allow the call attempt and let backend handle credits
      return true;
    }
  }

  // ===== Phone Numbers =====

  async listPhoneNumbers(): Promise<Array<{
    number: string;
    type: 'local' | 'toll-free' | 'mobile';
    capabilities: ('voice' | 'sms' | 'mms')[];
    assignedTo?: string;
  }>> {
    const response = await this.withRetry(
      () => fetch(`${this.apiBase}/api/pstn/numbers/${this.config.groupId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to list phone numbers');
    }

    const data = await response.json();
    return data.numbers;
  }

  async provisionNumber(
    areaCode?: string,
    type: 'local' | 'toll-free' = 'local'
  ): Promise<{ number: string; monthlyCost: number }> {
    const response = await fetch(`${this.apiBase}/api/pstn/numbers/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: this.config.groupId,
        areaCode,
        type,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to provision number: ${error}`);
    }

    return response.json();
  }

  async releaseNumber(phoneNumber: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/pstn/numbers/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: this.config.groupId,
        phoneNumber,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to release phone number');
    }
  }
}
