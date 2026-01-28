/**
 * PSTN Provider System
 * Exports for the BYOA (Bring Your Own Asterisk/Twilio/Plivo) provider system
 */

// Provider interface and base class
export {
  type PSTNProviderAdapter,
  type PSTNProviderType,
  type PSTNProviderConfig,
  type ProviderCredentials,
  type ProviderStatus,
  type ProviderTestResult,
  type OutboundCallOptions,
  type CallInitiationResult,
  type AnswerCallResult,
  type TwilioCredentials,
  type PlivoCredentials,
  type TelnyxCredentials,
  type SIPConfig,
  type SIPTransport,
  type PSTNProviderEvents,
  BasePSTNProviderAdapter,
} from './PSTNProviderAdapter';

// Provider factory
export {
  createPSTNProvider,
  getProviderInfo,
  validateProviderConfig,
  getAvailableProviderTypes,
} from './PSTNProviderFactory';

// Provider adapters
export {
  BuiltinCreditsAdapter,
  TwilioAdapter,
  PlivoAdapter,
  TelnyxAdapter,
  SIPAdapter,
} from './adapters';
