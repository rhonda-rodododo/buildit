/**
 * Error message to translation key mapping
 * Maps error messages from crypto layer and stores to i18n translation keys
 */

import i18n from '@/i18n/config';

/**
 * Map of error message patterns to translation keys
 * Uses startsWith matching for partial matches
 */
const ERROR_KEY_MAP: Record<string, string> = {
  // Crypto layer errors
  'Invalid password or corrupted key data': 'errors.invalidPassword',
  'Invalid nsec format': 'errors.invalidNsec',
  'Invalid npub format': 'errors.invalidNpub',
  'Invalid word count': 'errors.invalidWordCount',
  'Invalid password': 'errors.invalidPassword',

  // Auth store errors
  'Identity already exists': 'errors.identityAlreadyExists',
  'Identity not found': 'errors.identityNotFound',
  'No identity selected': 'errors.noIdentitySelected',

  // WebAuthn errors
  'WebAuthn not enabled': 'errors.webauthnNotEnabled',
  'WebAuthn authentication failed': 'errors.webauthnFailed',
  'WebAuthn is not supported': 'errors.webauthnNotSupported',

  // Migration errors
  'needs to be migrated': 'errors.migrationRequired',

  // Rate limiting
  'Too many attempts': 'errors.rateLimited',
  'Rate limited': 'errors.rateLimited',

  // Network errors
  'Network error': 'errors.networkError',
  'Failed to fetch': 'errors.networkError',

  // Fallback errors
  'Failed to create identity': 'errors.failedToCreateIdentity',
  'Failed to import identity': 'errors.failedToImportIdentity',
  'Failed to load identities': 'errors.failedToLoadIdentities',
  'Failed to remove identity': 'errors.failedToRemoveIdentity',
  'Failed to unlock': 'errors.failedToUnlock',
  'Failed to change password': 'errors.failedToChangePassword',
  'Failed to enable WebAuthn': 'errors.failedToEnableWebauthn',
  'Failed to disable WebAuthn': 'errors.failedToDisableWebauthn',
};

/**
 * Translate an error message to the user's current language
 * Falls back to the original message if no translation is found
 */
export function translateError(errorMessage: string): string {
  // First, try exact match
  const exactKey = ERROR_KEY_MAP[errorMessage];
  if (exactKey) {
    return i18n.t(exactKey);
  }

  // Then, try partial match (for errors that include dynamic content)
  for (const [pattern, key] of Object.entries(ERROR_KEY_MAP)) {
    if (errorMessage.includes(pattern)) {
      return i18n.t(key);
    }
  }

  // Fall back to original message
  return errorMessage;
}

/**
 * Get the translated error message from an Error object or string
 */
export function getTranslatedErrorMessage(
  error: unknown,
  fallbackKey: string = 'errors.unknownError'
): string {
  if (error instanceof Error) {
    return translateError(error.message);
  }

  if (typeof error === 'string') {
    return translateError(error);
  }

  return i18n.t(fallbackKey);
}
