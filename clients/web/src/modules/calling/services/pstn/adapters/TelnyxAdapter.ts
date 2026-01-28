/**
 * Telnyx Adapter
 * Integrates with Telnyx for PSTN calling
 */

import {
  BasePSTNProviderAdapter,
  type PSTNProviderConfig,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type ProviderTestResult,
  type TelnyxCredentials,
} from '../PSTNProviderAdapter';

/**
 * Telnyx API base URL
 */
const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

/**
 * Telnyx webhook callback path (user must configure)
 */
const TELNYX_CALLBACK_PATH = '/api/pstn/telnyx/webhook';

/**
 * Telnyx Adapter
 * Enables PSTN calling through Telnyx Voice API
 */
export class TelnyxAdapter extends BasePSTNProviderAdapter {
  readonly providerType = 'telnyx' as const;

  private credentials: TelnyxCredentials | null = null;

  constructor(config: PSTNProviderConfig) {
    super(config);

    if (config.credentials?.type === 'telnyx') {
      this.credentials = config.credentials.credentials;
    }
  }

  async initialize(): Promise<void> {
    if (!this.credentials) {
      this.status.connected = false;
      this.status.lastError = 'No Telnyx credentials configured';
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
        error: 'No Telnyx credentials configured',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(
        `${TELNYX_API_BASE}/balance`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API Key',
            latencyMs: Date.now() - startTime,
          };
        }
        return {
          success: false,
          error: `Telnyx API returned ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

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
      };
    }
  }

  async initiateCall(options: OutboundCallOptions): Promise<CallInitiationResult> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    const { targetPhone, hotlineId, callerId } = options;

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid phone number format');
    }

    const fromNumber = callerId || this.credentials.phoneNumber;

    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/calls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: normalizedPhone,
            from: fromNumber,
            connection_id: this.credentials!.connectionId,
            webhook_url: `${TELNYX_CALLBACK_PATH}/events?hotlineId=${hotlineId}`,
            timeout_secs: 30,
          }),
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telnyx error: ${error.errors?.[0]?.detail || 'Unknown error'}`);
    }

    const data = await response.json();
    const callData = data.data;

    return {
      callSid: callData.call_control_id,
      sipUri: `sip:${callData.call_leg_id}@sip.telnyx.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:stun.telnyx.com:3478' },
        ],
      },
    };
  }

  async answerCall(callSid: string, _operatorPubkey?: string): Promise<AnswerCallResult> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/calls/${callSid}/actions/answer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook_url: `${TELNYX_CALLBACK_PATH}/events`,
          }),
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      throw new Error('Failed to answer call');
    }

    return {
      sipUri: `sip:${callSid}@sip.telnyx.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:stun.telnyx.com:3478' },
        ],
      },
    };
  }

  async holdCall(callSid: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    // Telnyx uses playback_start for hold music
    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/calls/${callSid}/actions/playback_start`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: `${TELNYX_CALLBACK_PATH}/hold-music.mp3`,
            loop: 'infinity',
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
      throw new Error('Telnyx not configured');
    }

    // Stop hold music
    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/calls/${callSid}/actions/playback_stop`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
            'Content-Type': 'application/json',
          },
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
      throw new Error('Telnyx not configured');
    }

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid transfer phone number format');
    }

    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/calls/${callSid}/actions/transfer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: normalizedPhone,
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
        `${TELNYX_API_BASE}/calls/${callSid}/actions/hangup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch {
      // Ignore errors
    }
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    const response = await fetch(
      `${TELNYX_API_BASE}/calls/${callSid}/actions/send_dtmf`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          digits,
          duration_millis: 250,
        }),
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
      throw new Error('Telnyx not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `${TELNYX_API_BASE}/phone_numbers`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.credentials!.apiKey}`,
          },
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to list phone numbers');
    }

    const data = await response.json();
    return data.data.map((num: {
      phone_number: string;
      number_type: string;
      features: { sms?: { domestic_two_way?: boolean }; mms?: { domestic_two_way?: boolean } };
    }) => ({
      number: num.phone_number,
      type: num.number_type === 'toll-free' ? 'toll-free' as const : 'local' as const,
      capabilities: [
        'voice' as const,
        ...(num.features?.sms?.domestic_two_way ? ['sms' as const] : []),
        ...(num.features?.mms?.domestic_two_way ? ['mms' as const] : []),
      ],
    }));
  }

  async provisionNumber(
    areaCode?: string,
    type: 'local' | 'toll-free' = 'local'
  ): Promise<{ number: string; monthlyCost: number }> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    // Search for available numbers
    const searchParams = new URLSearchParams({
      'filter[country_code]': 'US',
      'filter[number_type]': type === 'toll-free' ? 'toll-free' : 'local',
      'filter[features]': 'voice',
      ...(areaCode && { 'filter[national_destination_code]': areaCode }),
    });

    const searchResponse = await fetch(
      `${TELNYX_API_BASE}/available_phone_numbers?${searchParams}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('No numbers available');
    }

    const searchData = await searchResponse.json();
    if (!searchData.data?.length) {
      throw new Error('No numbers available in this area');
    }

    const selectedNumber = searchData.data[0];

    // Order the number
    const orderResponse = await fetch(
      `${TELNYX_API_BASE}/number_orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_numbers: [{ phone_number: selectedNumber.phone_number }],
          connection_id: this.credentials.connectionId,
        }),
      }
    );

    if (!orderResponse.ok) {
      throw new Error('Failed to provision number');
    }

    return {
      number: selectedNumber.phone_number,
      monthlyCost: parseFloat(selectedNumber.monthly_cost) || 1.0,
    };
  }

  async releaseNumber(phoneNumber: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Telnyx not configured');
    }

    // First get the phone number ID
    const listResponse = await fetch(
      `${TELNYX_API_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error('Number not found');
    }

    const listData = await listResponse.json();
    if (!listData.data?.length) {
      throw new Error('Number not found');
    }

    const numberId = listData.data[0].id;

    // Delete the number
    const deleteResponse = await fetch(
      `${TELNYX_API_BASE}/phone_numbers/${numberId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 200) {
      throw new Error('Failed to release number');
    }
  }
}
