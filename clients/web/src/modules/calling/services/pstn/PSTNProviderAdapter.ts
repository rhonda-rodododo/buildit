/**
 * PSTN Provider Adapter Interface
 * Defines the contract for all PSTN providers (Twilio, Plivo, Telnyx, Asterisk, built-in credits)
 */

import type { LocalCreditBalance, PSTNUsageRecord } from '../../types';

/**
 * Supported PSTN provider types
 */
export type PSTNProviderType =
  | 'builtin-credits'  // Default - uses our backend
  | 'twilio'
  | 'plivo'
  | 'telnyx'
  | 'asterisk'         // Self-hosted Asterisk/FreePBX
  | 'custom-sip';      // Generic SIP provider

/**
 * SIP transport protocol
 */
export type SIPTransport = 'udp' | 'tcp' | 'tls';

/**
 * Outbound call options
 */
export interface OutboundCallOptions {
  targetPhone: string;
  hotlineId: string;
  callerId?: string;
  groupId?: string;
  operatorPubkey?: string;
}

/**
 * Call initiation result
 */
export interface CallInitiationResult {
  callSid: string;
  sipUri: string;
  webrtcConfig?: RTCConfiguration;
}

/**
 * Answer call result
 */
export interface AnswerCallResult {
  sipUri: string;
  webrtcConfig?: RTCConfiguration;
}

/**
 * Provider test result
 */
export interface ProviderTestResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
  registrationStatus?: string;
}

/**
 * Twilio credentials
 */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  apiKeySid?: string;
  apiKeySecret?: string;
}

/**
 * Plivo credentials
 */
export interface PlivoCredentials {
  authId: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * Telnyx credentials
 */
export interface TelnyxCredentials {
  apiKey: string;
  phoneNumber: string;
  connectionId?: string;
}

/**
 * SIP configuration for self-hosted providers
 */
export interface SIPConfig {
  server: string;
  port: number;
  transport: SIPTransport;
  username: string;
  password: string;
  realm?: string;
  callerId: string;
  stunServers?: string[];
  turnServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

/**
 * Provider credentials union type
 */
export type ProviderCredentials =
  | { type: 'builtin-credits' }
  | { type: 'twilio'; credentials: TwilioCredentials }
  | { type: 'plivo'; credentials: PlivoCredentials }
  | { type: 'telnyx'; credentials: TelnyxCredentials }
  | { type: 'asterisk'; config: SIPConfig }
  | { type: 'custom-sip'; config: SIPConfig };

/**
 * PSTN provider configuration
 */
export interface PSTNProviderConfig {
  providerType: PSTNProviderType;
  credentials?: ProviderCredentials;

  // Built-in credits backend URL (for built-in provider or fallback)
  builtinWorkerUrl?: string;

  // Group this config applies to
  groupId: string;

  // Whether to fall back to built-in credits if provider fails
  fallbackToBuiltin?: boolean;
}

/**
 * Provider status
 */
export interface ProviderStatus {
  connected: boolean;
  registrationStatus?: 'registered' | 'registering' | 'unregistered' | 'failed';
  lastError?: string;
  lastErrorAt?: number;
  creditsRemaining?: number;
}

/**
 * PSTN Provider Adapter Interface
 * All providers must implement this interface
 */
export interface PSTNProviderAdapter {
  /**
   * The type of provider
   */
  readonly providerType: PSTNProviderType;

  /**
   * Get current provider status
   */
  getStatus(): ProviderStatus;

  // ===== Call Lifecycle =====

  /**
   * Initiate an outbound call
   * @returns Call SID and SIP URI for WebRTC bridge
   */
  initiateCall(options: OutboundCallOptions): Promise<CallInitiationResult>;

  /**
   * Answer an inbound call
   * @param callSid - The call identifier
   * @param operatorPubkey - The operator answering the call
   * @returns SIP URI for WebRTC bridge
   */
  answerCall(callSid: string, operatorPubkey?: string): Promise<AnswerCallResult>;

  /**
   * Put a call on hold
   */
  holdCall(callSid: string): Promise<void>;

  /**
   * Resume a call from hold
   */
  resumeCall(callSid: string): Promise<void>;

  /**
   * Transfer call to another phone number
   */
  transferCall(callSid: string, targetPhone: string): Promise<void>;

  /**
   * End/hangup a call
   */
  endCall(callSid: string): Promise<void>;

  /**
   * Send DTMF tones during a call
   */
  sendDTMF?(callSid: string, digits: string): Promise<void>;

  /**
   * Mute/unmute the call (local side)
   */
  muteCall?(callSid: string, muted: boolean): Promise<void>;

  // ===== Credits (for built-in provider) =====

  /**
   * Get current credit balance
   * Only applicable for built-in credits provider
   */
  getBalance?(): Promise<LocalCreditBalance>;

  /**
   * Get usage history
   * Only applicable for built-in credits provider
   */
  getUsageHistory?(days: number): Promise<PSTNUsageRecord[]>;

  /**
   * Check if there are sufficient credits for a call
   */
  hasCredits?(estimatedMinutes?: number): Promise<boolean>;

  // ===== Phone Numbers =====

  /**
   * List available/owned phone numbers
   */
  listPhoneNumbers?(): Promise<Array<{
    number: string;
    type: 'local' | 'toll-free' | 'mobile';
    capabilities: ('voice' | 'sms' | 'mms')[];
    assignedTo?: string; // hotlineId
  }>>;

  /**
   * Provision a new phone number
   */
  provisionNumber?(areaCode?: string, type?: 'local' | 'toll-free'): Promise<{
    number: string;
    monthlyCost: number;
  }>;

  /**
   * Release a phone number
   */
  releaseNumber?(phoneNumber: string): Promise<void>;

  // ===== Configuration =====

  /**
   * Test the provider connection and credentials
   */
  testConnection(): Promise<ProviderTestResult>;

  /**
   * Initialize/connect the provider
   */
  initialize(): Promise<void>;

  /**
   * Cleanup provider resources
   */
  destroy(): Promise<void>;
}

/**
 * Event types emitted by provider adapters
 */
export interface PSTNProviderEvents {
  'call-initiated': (callSid: string, targetPhone: string) => void;
  'call-answered': (callSid: string) => void;
  'call-ended': (callSid: string, reason: string) => void;
  'call-failed': (callSid: string, error: Error) => void;
  'call-hold': (callSid: string) => void;
  'call-resume': (callSid: string) => void;
  'registration-change': (status: 'registered' | 'unregistered' | 'failed') => void;
  'error': (error: Error) => void;
}

/**
 * Base class with common functionality for provider adapters
 */
export abstract class BasePSTNProviderAdapter implements PSTNProviderAdapter {
  abstract readonly providerType: PSTNProviderType;
  protected config: PSTNProviderConfig;
  protected status: ProviderStatus = {
    connected: false,
  };

  constructor(config: PSTNProviderConfig) {
    this.config = config;
  }

  getStatus(): ProviderStatus {
    return { ...this.status };
  }

  abstract initiateCall(options: OutboundCallOptions): Promise<CallInitiationResult>;
  abstract answerCall(callSid: string, operatorPubkey?: string): Promise<AnswerCallResult>;
  abstract holdCall(callSid: string): Promise<void>;
  abstract resumeCall(callSid: string): Promise<void>;
  abstract transferCall(callSid: string, targetPhone: string): Promise<void>;
  abstract endCall(callSid: string): Promise<void>;
  abstract testConnection(): Promise<ProviderTestResult>;
  abstract initialize(): Promise<void>;
  abstract destroy(): Promise<void>;

  /**
   * Utility: Retry a function with exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; backoff?: number; onRetry?: (attempt: number, error: Error) => void } = {}
  ): Promise<T> {
    const { maxRetries = 3, backoff = 1000, onRetry } = options;
    let lastError: Error = new Error('No attempts made');

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries - 1) {
          if (onRetry) {
            onRetry(i + 1, lastError);
          }
          await this.delay(backoff * Math.pow(2, i));
        }
      }
    }

    throw lastError;
  }

  /**
   * Utility: Delay helper
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Utility: Mask phone number for privacy
   */
  protected maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return '****';
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }

  /**
   * Utility: Validate E.164 phone number format
   */
  protected isValidE164(phone: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * Utility: Normalize phone number to E.164 format
   */
  protected normalizePhoneNumber(phone: string, defaultCountryCode = '+1'): string {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Add country code if missing
    if (!cleaned.startsWith('+')) {
      cleaned = defaultCountryCode + cleaned;
    }

    return cleaned;
  }
}
