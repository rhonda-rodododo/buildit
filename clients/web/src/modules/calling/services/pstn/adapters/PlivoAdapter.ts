/**
 * Plivo Adapter
 * Integrates with Plivo for PSTN calling
 */

import {
  BasePSTNProviderAdapter,
  type PSTNProviderConfig,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type ProviderTestResult,
  type PlivoCredentials,
} from '../PSTNProviderAdapter';

/**
 * Plivo API base URL
 */
const PLIVO_API_BASE = 'https://api.plivo.com/v1';

/**
 * Plivo webhook callback path (user must configure)
 */
const PLIVO_CALLBACK_PATH = '/api/pstn/plivo/webhook';

/**
 * Plivo Adapter
 * Enables PSTN calling through Plivo's Voice API
 */
export class PlivoAdapter extends BasePSTNProviderAdapter {
  readonly providerType = 'plivo' as const;

  private credentials: PlivoCredentials | null = null;

  constructor(config: PSTNProviderConfig) {
    super(config);

    if (config.credentials?.type === 'plivo') {
      this.credentials = config.credentials.credentials;
    }
  }

  async initialize(): Promise<void> {
    if (!this.credentials) {
      this.status.connected = false;
      this.status.lastError = 'No Plivo credentials configured';
      return;
    }

    const result = await this.testConnection();
    this.status.connected = result.success;
    if (!result.success) {
      this.status.lastError = result.error;
      this.status.lastErrorAt = Date.now();
    }
  }

  async destroy(): Promise<void> {
    this.status.connected = false;
  }

  async testConnection(): Promise<ProviderTestResult> {
    if (!this.credentials) {
      return {
        success: false,
        error: 'No Plivo credentials configured',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials.authId}/`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid Auth ID or Auth Token',
            latencyMs: Date.now() - startTime,
          };
        }
        return {
          success: false,
          error: `Plivo API returned ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        registrationStatus: data.state,
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
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const { targetPhone, hotlineId, callerId } = options;

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid phone number format');
    }

    const fromNumber = callerId || this.credentials.phoneNumber;

    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Call/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromNumber.replace('+', ''),
            to: normalizedPhone.replace('+', ''),
            answer_url: `${PLIVO_CALLBACK_PATH}/answer?hotlineId=${hotlineId}`,
            hangup_url: `${PLIVO_CALLBACK_PATH}/hangup`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Plivo error: ${error.error || 'Unknown error'}`);
    }

    const callData = await response.json();

    return {
      callSid: callData.request_uuid,
      sipUri: `sip:${callData.request_uuid}@phone.plivo.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:stun.plivo.com:3478' },
        ],
      },
    };
  }

  async answerCall(callSid: string, _operatorPubkey?: string): Promise<AnswerCallResult> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    // Transfer call to the operator by redirecting to answer XML
    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Call/${callSid}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aleg_url: `${PLIVO_CALLBACK_PATH}/connect?callUuid=${callSid}`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      throw new Error('Failed to answer call');
    }

    return {
      sipUri: `sip:${callSid}@phone.plivo.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:stun.plivo.com:3478' },
        ],
      },
    };
  }

  async holdCall(callSid: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Call/${callSid}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aleg_url: `${PLIVO_CALLBACK_PATH}/hold`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to put call on hold');
    }
  }

  async resumeCall(callSid: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Call/${callSid}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aleg_url: `${PLIVO_CALLBACK_PATH}/resume`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to resume call');
    }
  }

  async transferCall(callSid: string, targetPhone: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid transfer phone number format');
    }

    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Call/${callSid}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aleg_url: `${PLIVO_CALLBACK_PATH}/transfer?to=${encodeURIComponent(normalizedPhone)}`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to transfer call');
    }
  }

  async endCall(callSid: string): Promise<void> {
    if (!this.credentials) {
      return;
    }

    try {
      await fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials.authId}/Call/${callSid}/`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
          },
        }
      );
    } catch {
      // Ignore errors
    }
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const response = await fetch(
      `${PLIVO_API_BASE}/Account/${this.credentials.authId}/Call/${callSid}/DTMF/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ digits }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send DTMF');
    }
  }

  // ===== Phone Numbers =====

  async listPhoneNumbers(): Promise<Array<{
    number: string;
    type: 'local' | 'toll-free' | 'mobile';
    capabilities: ('voice' | 'sms' | 'mms')[];
    assignedTo?: string;
  }>> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `${PLIVO_API_BASE}/Account/${this.credentials!.authId}/Number/`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.authId}:${this.credentials!.authToken}`)}`,
          },
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to list phone numbers');
    }

    const data = await response.json();
    return data.objects.map((num: {
      number: string;
      type: string;
      voice_enabled: boolean;
      sms_enabled: boolean;
    }) => ({
      number: '+' + num.number,
      type: num.type === 'tollfree' ? 'toll-free' as const : 'local' as const,
      capabilities: [
        ...(num.voice_enabled ? ['voice' as const] : []),
        ...(num.sms_enabled ? ['sms' as const] : []),
      ],
    }));
  }

  async provisionNumber(
    areaCode?: string,
    type: 'local' | 'toll-free' = 'local'
  ): Promise<{ number: string; monthlyCost: number }> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    // Search for available numbers
    const searchParams = new URLSearchParams({
      country_iso: 'US',
      type: type === 'toll-free' ? 'tollfree' : 'local',
      ...(areaCode && { pattern: areaCode }),
    });

    const searchResponse = await fetch(
      `${PLIVO_API_BASE}/Account/${this.credentials.authId}/PhoneNumber/?${searchParams}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('No numbers available');
    }

    const searchData = await searchResponse.json();
    if (!searchData.objects?.length) {
      throw new Error('No numbers available in this area');
    }

    const selectedNumber = searchData.objects[0];

    // Buy the number
    const buyResponse = await fetch(
      `${PLIVO_API_BASE}/Account/${this.credentials.authId}/PhoneNumber/${selectedNumber.number}/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!buyResponse.ok) {
      throw new Error('Failed to provision number');
    }

    return {
      number: '+' + selectedNumber.number,
      monthlyCost: parseFloat(selectedNumber.monthly_rental_rate) || 0.8,
    };
  }

  async releaseNumber(phoneNumber: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Plivo not configured');
    }

    // Remove the '+' for Plivo API
    const number = phoneNumber.replace('+', '');

    const response = await fetch(
      `${PLIVO_API_BASE}/Account/${this.credentials.authId}/Number/${number}/`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.authId}:${this.credentials.authToken}`)}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to release number');
    }
  }
}
