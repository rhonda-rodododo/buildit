/**
 * Twilio Adapter
 * Integrates with Twilio Programmable Voice for PSTN calling
 */

import {
  BasePSTNProviderAdapter,
  type PSTNProviderConfig,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type ProviderTestResult,
  type TwilioCredentials,
} from '../PSTNProviderAdapter';

/**
 * Twilio TwiML Application webhook base (user must configure their own)
 */
const TWIML_APP_CALLBACK_PATH = '/api/pstn/twilio/webhook';

/**
 * Twilio Adapter
 * Enables PSTN calling through Twilio's Programmable Voice API
 */
export class TwilioAdapter extends BasePSTNProviderAdapter {
  readonly providerType = 'twilio' as const;

  private credentials: TwilioCredentials | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: PSTNProviderConfig) {
    super(config);

    if (config.credentials?.type === 'twilio') {
      this.credentials = config.credentials.credentials;
    }
  }

  async initialize(): Promise<void> {
    if (!this.credentials) {
      this.status.connected = false;
      this.status.lastError = 'No Twilio credentials configured';
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
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.status.connected = false;
  }

  async testConnection(): Promise<ProviderTestResult> {
    if (!this.credentials) {
      return {
        success: false,
        error: 'No Twilio credentials configured',
      };
    }

    const startTime = Date.now();

    try {
      // Test by fetching account info
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}.json`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid Account SID or Auth Token',
            latencyMs: Date.now() - startTime,
          };
        }
        return {
          success: false,
          error: `Twilio API returned ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        registrationStatus: data.status,
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
      throw new Error('Twilio not configured');
    }

    const { targetPhone, hotlineId, callerId } = options;

    // Validate and normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid phone number format');
    }

    // Use provided caller ID or configured number
    const fromNumber = callerId || this.credentials.phoneNumber;

    // Create call via Twilio API
    const formData = new URLSearchParams();
    formData.append('To', normalizedPhone);
    formData.append('From', fromNumber);
    formData.append('Url', `${TWIML_APP_CALLBACK_PATH}/voice?hotlineId=${hotlineId}`);
    formData.append('StatusCallback', `${TWIML_APP_CALLBACK_PATH}/status`);
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed');

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio error: ${error.message || error.code || 'Unknown error'}`);
    }

    const callData = await response.json();

    // Pre-fetch access token for WebRTC connection (if backend supports it)
    this.getAccessToken().catch(() => {
      // Token fetch may fail if backend isn't configured yet
    });

    return {
      callSid: callData.sid,
      sipUri: `sip:${callData.sid}@${this.credentials.accountSid}.pstn.twilio.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        // Twilio provides TURN through their client SDK
      },
    };
  }

  async answerCall(callSid: string, _operatorPubkey?: string): Promise<AnswerCallResult> {
    if (!this.credentials) {
      throw new Error('Twilio not configured');
    }

    // Update call to connect via TwiML
    const formData = new URLSearchParams();
    formData.append('Url', `${TWIML_APP_CALLBACK_PATH}/connect?callSid=${callSid}`);

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        }
      ),
      { maxRetries: 2, backoff: 1000 }
    );

    if (!response.ok) {
      throw new Error('Failed to answer call');
    }

    return {
      sipUri: `sip:${callSid}@${this.credentials.accountSid}.pstn.twilio.com`,
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    };
  }

  async holdCall(callSid: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Twilio not configured');
    }

    const formData = new URLSearchParams();
    formData.append('Url', `${TWIML_APP_CALLBACK_PATH}/hold`);

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
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
      throw new Error('Twilio not configured');
    }

    const formData = new URLSearchParams();
    formData.append('Url', `${TWIML_APP_CALLBACK_PATH}/resume`);

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
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
      throw new Error('Twilio not configured');
    }

    const normalizedPhone = this.normalizePhoneNumber(targetPhone);
    if (!this.isValidE164(normalizedPhone)) {
      throw new Error('Invalid transfer phone number format');
    }

    const formData = new URLSearchParams();
    formData.append('Url', `${TWIML_APP_CALLBACK_PATH}/transfer?to=${encodeURIComponent(normalizedPhone)}`);

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
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
      const formData = new URLSearchParams();
      formData.append('Status', 'completed');

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        }
      );
    } catch {
      // Ignore errors - call might already be ended
    }
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Twilio not configured');
    }

    // Send DTMF via TwiML Play
    const formData = new URLSearchParams();
    formData.append('Digits', digits);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/Calls/${callSid}/Payments.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
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
      throw new Error('Twilio not configured');
    }

    const response = await this.withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.credentials!.accountSid}/IncomingPhoneNumbers.json`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${btoa(`${this.credentials!.accountSid}:${this.credentials!.authToken}`)}`,
          },
        }
      ),
      { maxRetries: 2, backoff: 500 }
    );

    if (!response.ok) {
      throw new Error('Failed to list phone numbers');
    }

    const data = await response.json();
    return data.incoming_phone_numbers.map((num: {
      phone_number: string;
      capabilities: { voice: boolean; sms: boolean; mms: boolean };
      friendly_name?: string;
    }) => ({
      number: num.phone_number,
      type: num.phone_number.startsWith('+1800') || num.phone_number.startsWith('+1888')
        ? 'toll-free' as const
        : 'local' as const,
      capabilities: [
        ...(num.capabilities.voice ? ['voice' as const] : []),
        ...(num.capabilities.sms ? ['sms' as const] : []),
        ...(num.capabilities.mms ? ['mms' as const] : []),
      ],
    }));
  }

  async provisionNumber(
    areaCode?: string,
    type: 'local' | 'toll-free' = 'local'
  ): Promise<{ number: string; monthlyCost: number }> {
    if (!this.credentials) {
      throw new Error('Twilio not configured');
    }

    // Search for available numbers
    const searchType = type === 'toll-free' ? 'TollFree' : 'Local';
    const searchParams = new URLSearchParams();
    if (areaCode) {
      searchParams.append('AreaCode', areaCode);
    }
    searchParams.append('VoiceEnabled', 'true');

    const searchResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/AvailablePhoneNumbers/US/${searchType}.json?${searchParams}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('No numbers available');
    }

    const searchData = await searchResponse.json();
    if (!searchData.available_phone_numbers?.length) {
      throw new Error('No numbers available in this area');
    }

    const selectedNumber = searchData.available_phone_numbers[0];

    // Purchase the number
    const purchaseData = new URLSearchParams();
    purchaseData.append('PhoneNumber', selectedNumber.phone_number);
    purchaseData.append('VoiceUrl', `${TWIML_APP_CALLBACK_PATH}/voice`);

    const purchaseResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/IncomingPhoneNumbers.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: purchaseData,
      }
    );

    if (!purchaseResponse.ok) {
      throw new Error('Failed to provision number');
    }

    return {
      number: selectedNumber.phone_number,
      monthlyCost: type === 'toll-free' ? 2.0 : 1.15, // Approximate Twilio pricing
    };
  }

  async releaseNumber(phoneNumber: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Twilio not configured');
    }

    // First get the number SID
    const listResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error('Number not found');
    }

    const listData = await listResponse.json();
    if (!listData.incoming_phone_numbers?.length) {
      throw new Error('Number not found');
    }

    const numberSid = listData.incoming_phone_numbers[0].sid;

    // Delete the number
    const deleteResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/IncomingPhoneNumbers/${numberSid}.json`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${this.credentials.accountSid}:${this.credentials.authToken}`)}`,
        },
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      throw new Error('Failed to release number');
    }
  }

  // ===== Private Helpers =====

  /**
   * Get Twilio access token for client SDK
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    // In production, this should be fetched from your backend
    // The backend would use the Twilio SDK to generate a token
    // For now, we'll need a backend endpoint to generate tokens
    throw new Error(
      'Access token generation requires backend support. ' +
      'Configure a backend endpoint to generate Twilio access tokens.'
    );
  }
}
