/**
 * PSTN Provider Factory
 * Creates the appropriate provider adapter based on configuration
 */

import type { PSTNProviderAdapter, PSTNProviderConfig, PSTNProviderType } from './PSTNProviderAdapter';
import { BuiltinCreditsAdapter } from './adapters/BuiltinCreditsAdapter';
import { TwilioAdapter } from './adapters/TwilioAdapter';
import { PlivoAdapter } from './adapters/PlivoAdapter';
import { TelnyxAdapter } from './adapters/TelnyxAdapter';
import { SIPAdapter } from './adapters/SIPAdapter';

/**
 * Create a PSTN provider adapter based on configuration
 * @param config - Provider configuration
 * @returns The appropriate provider adapter
 */
export function createPSTNProvider(config: PSTNProviderConfig): PSTNProviderAdapter {
  switch (config.providerType) {
    case 'builtin-credits':
      return new BuiltinCreditsAdapter(config);

    case 'twilio':
      return new TwilioAdapter(config);

    case 'plivo':
      return new PlivoAdapter(config);

    case 'telnyx':
      return new TelnyxAdapter(config);

    case 'asterisk':
    case 'custom-sip':
      return new SIPAdapter(config);

    default:
      // Default to built-in credits for unknown types
      console.warn(`Unknown provider type: ${config.providerType}, falling back to builtin-credits`);
      return new BuiltinCreditsAdapter({
        ...config,
        providerType: 'builtin-credits',
      });
  }
}

/**
 * Get display information for a provider type
 */
export function getProviderInfo(type: PSTNProviderType): {
  name: string;
  description: string;
  supportsCredits: boolean;
  requiresApiKeys: boolean;
  requiresSipConfig: boolean;
} {
  switch (type) {
    case 'builtin-credits':
      return {
        name: 'Built-in Credits',
        description: '100 minutes/month included. Additional at $0.02/min',
        supportsCredits: true,
        requiresApiKeys: false,
        requiresSipConfig: false,
      };

    case 'twilio':
      return {
        name: 'Twilio',
        description: 'Leading cloud communications platform',
        supportsCredits: false,
        requiresApiKeys: true,
        requiresSipConfig: false,
      };

    case 'plivo':
      return {
        name: 'Plivo',
        description: 'Cloud communications with competitive pricing',
        supportsCredits: false,
        requiresApiKeys: true,
        requiresSipConfig: false,
      };

    case 'telnyx':
      return {
        name: 'Telnyx',
        description: 'Global carrier with excellent latency',
        supportsCredits: false,
        requiresApiKeys: true,
        requiresSipConfig: false,
      };

    case 'asterisk':
      return {
        name: 'Asterisk/FreePBX',
        description: 'Self-hosted PBX system',
        supportsCredits: false,
        requiresApiKeys: false,
        requiresSipConfig: true,
      };

    case 'custom-sip':
      return {
        name: 'Custom SIP Provider',
        description: 'Generic SIP/VoIP provider',
        supportsCredits: false,
        requiresApiKeys: false,
        requiresSipConfig: true,
      };

    default:
      return {
        name: 'Unknown',
        description: 'Unknown provider type',
        supportsCredits: false,
        requiresApiKeys: false,
        requiresSipConfig: false,
      };
  }
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: PSTNProviderConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.groupId) {
    errors.push('Group ID is required');
  }

  switch (config.providerType) {
    case 'builtin-credits':
      if (!config.builtinWorkerUrl) {
        errors.push('Backend worker URL is required for built-in credits');
      }
      break;

    case 'twilio':
      if (config.credentials?.type !== 'twilio') {
        errors.push('Twilio credentials required');
      } else {
        const creds = config.credentials.credentials;
        if (!creds.accountSid) errors.push('Twilio Account SID is required');
        if (!creds.authToken) errors.push('Twilio Auth Token is required');
        if (!creds.phoneNumber) errors.push('Twilio Phone Number is required');
      }
      break;

    case 'plivo':
      if (config.credentials?.type !== 'plivo') {
        errors.push('Plivo credentials required');
      } else {
        const creds = config.credentials.credentials;
        if (!creds.authId) errors.push('Plivo Auth ID is required');
        if (!creds.authToken) errors.push('Plivo Auth Token is required');
        if (!creds.phoneNumber) errors.push('Plivo Phone Number is required');
      }
      break;

    case 'telnyx':
      if (config.credentials?.type !== 'telnyx') {
        errors.push('Telnyx credentials required');
      } else {
        const creds = config.credentials.credentials;
        if (!creds.apiKey) errors.push('Telnyx API Key is required');
        if (!creds.phoneNumber) errors.push('Telnyx Phone Number is required');
      }
      break;

    case 'asterisk':
    case 'custom-sip':
      if (
        config.credentials?.type !== 'asterisk' &&
        config.credentials?.type !== 'custom-sip'
      ) {
        errors.push('SIP configuration required');
      } else {
        const sipConfig = config.credentials.config;
        if (!sipConfig.server) errors.push('SIP Server is required');
        if (!sipConfig.port || sipConfig.port < 1 || sipConfig.port > 65535) {
          errors.push('Valid SIP Port is required (1-65535)');
        }
        if (!sipConfig.username) errors.push('SIP Username is required');
        if (!sipConfig.password) errors.push('SIP Password is required');
        if (!sipConfig.callerId) errors.push('Caller ID is required');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get list of all available provider types
 */
export function getAvailableProviderTypes(): Array<{
  type: PSTNProviderType;
  name: string;
  description: string;
}> {
  const types: PSTNProviderType[] = [
    'builtin-credits',
    'twilio',
    'plivo',
    'telnyx',
    'asterisk',
    'custom-sip',
  ];

  return types.map((type) => {
    const info = getProviderInfo(type);
    return {
      type,
      name: info.name,
      description: info.description,
    };
  });
}
