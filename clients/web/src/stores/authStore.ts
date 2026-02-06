/**
 * Auth Store
 * Manages identity authentication with secure key storage.
 *
 * Key Security Features:
 * - Private keys encrypted at rest using AES-GCM with PBKDF2-derived key
 * - Keys only decrypted in memory when unlocked
 * - Automatic lock on inactivity
 * - Optional WebAuthn for quick unlock
 *
 * This store does NOT use Zustand persist - all data comes from IndexedDB
 * which is encrypted via the database encryption layer.
 */

import { create } from 'zustand';
import type { Identity } from '@/types/identity';
import { createIdentity, importFromNsec } from '@/core/crypto/keyManager';
import type { DBIdentity } from '@/core/storage/db';
import { dal } from '@/core/storage/dal';
import * as nip19 from 'nostr-tools/nip19';
import { logger } from '@/lib/logger';
import {
  secureKeyManager,
  type EncryptedKeyData,
  type SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  type LockState,
  type SecureKeyManagerEvent,
} from '@/core/crypto/SecureKeyManager';
import {
  checkRateLimit,
  getRateLimitMessage,
  recordFailure,
  recordSuccess,
  clearRateLimitState,
} from '@/lib/security/rateLimiter';
import { getTranslatedErrorMessage } from '@/lib/i18n/errorTranslations';

// sessionStorage key for persisting selected identity within a tab session.
// SECURITY: Uses sessionStorage instead of localStorage to prevent social graph
// leakage from device forensics. Public keys are cleared on tab close.
export const SELECTED_IDENTITY_KEY = 'buildit-selected-identity';

/**
 * Get the saved identity public key from sessionStorage.
 * Used by main.tsx to restore identity selection on page refresh.
 * SECURITY: Stored in sessionStorage (cleared on tab close) to limit
 * forensic exposure of which identities are active on the device.
 */
export function getSavedIdentityPubkey(): string | null {
  return sessionStorage.getItem(SELECTED_IDENTITY_KEY);
}

/**
 * SECURITY: Clear all session data from stores when switching identities
 * This prevents data leakage between accounts.
 */
async function clearAllSessionData(): Promise<void> {
  logger.info('🔒 Clearing session data for identity switch');

  // Import stores dynamically to avoid circular dependencies
  const { useGroupsStore } = await import('@/stores/groupsStore');
  const { useMessagingStore } = await import('@/stores/messagingStore');
  const { useContactsStore } = await import('@/stores/contactsStore');
  const { useNotificationStore } = await import('@/stores/notificationStore');

  // Clear groups store
  useGroupsStore.setState({
    activeGroup: null,
    groups: [],
    groupMembers: new Map(),
    pendingInvitations: [],
    sentInvitations: [],
    isLoading: false,
    error: null,
  });

  // Clear messaging store
  useMessagingStore.setState({
    conversations: [],
    messages: new Map(),
    activeConversationId: null,
    groupThreads: new Map(),
    activeThreadId: null,
    threadMessages: new Map(),
  });

  // Clear contacts store
  useContactsStore.setState({
    contacts: new Map(),
    profiles: new Map(),
    loading: false,
    error: null,
  });

  // Clear notifications (keep structure but clear items)
  useNotificationStore.setState({
    notifications: [],
  });

  // Stop the message receiver
  try {
    const { stopMessageReceiver } = await import('@/core/messaging/messageReceiver');
    stopMessageReceiver();
  } catch {
    // Message receiver may not be initialized
  }

  // Clear any cached encryption keys
  const { clearLocalEncryptionKey, clearGroupKeyCache } = await import('@/core/storage/EncryptedDB');
  clearLocalEncryptionKey();
  clearGroupKeyCache();

  logger.info('✅ Session data cleared');
}

/**
 * Auth state interface
 * Note: privateKey is NOT stored in state - it's managed by SecureKeyManager
 */
interface AuthState {
  // Current identity (without private key until unlocked)
  currentIdentity: Omit<Identity, 'privateKey'> | null;

  // All identities (public info only)
  identities: Omit<Identity, 'privateKey'>[];

  // Lock state
  lockState: LockState;

  // Loading states
  isLoading: boolean;
  isUnlocking: boolean;

  // Error state
  error: string | null;

  // Lock timeout warning
  lockTimeoutWarning: number | null; // seconds remaining
}

interface AuthActions {
  // Identity management
  createNewIdentity: (name: string, password: string) => Promise<Identity>;
  importIdentity: (nsec: string, name: string, password: string) => Promise<Identity>;
  loadIdentities: () => Promise<void>;
  removeIdentity: (publicKey: string) => Promise<void>;
  setCurrentIdentity: (publicKey: string | null) => Promise<void>;

  // Lock/Unlock
  unlock: (password: string) => Promise<void>;
  lock: () => void;

  // Get private key (only when unlocked)
  getPrivateKey: () => Uint8Array | null;

  // Password management
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;

  // WebAuthn
  enableWebAuthn: (password: string) => Promise<void>;
  disableWebAuthn: (password: string) => Promise<void>;

  // Security settings
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => Promise<void>;
  getSecuritySettings: () => SecuritySettings;

  // Export (requires password)
  exportPrivateKey: (password: string) => Promise<string>;

  // Backup status tracking
  updateBackupStatus: (updates: {
    recoveryPhraseShownAt?: number;
    recoveryPhraseConfirmedAt?: number;
    lastBackupAt?: number;
  }) => Promise<void>;
  checkBackupStatus: () => Promise<{
    hasValidBackup: boolean;
    importedWithoutBackup: boolean;
    recoveryPhraseConfirmedAt?: number;
    lastBackupAt?: number;
  }>;

  // Logout (clears all state and returns to login)
  logout: () => Promise<void>;

  // Internal
  _handleSecureKeyManagerEvent: (event: SecureKeyManagerEvent) => void;
}

/**
 * Convert DBIdentity to public Identity (no private key)
 */
function dbIdentityToPublic(dbId: DBIdentity): Omit<Identity, 'privateKey'> {
  return {
    publicKey: dbId.publicKey,
    npub: dbId.npub || nip19.npubEncode(dbId.publicKey),
    name: dbId.name,
    username: dbId.username,
    displayName: dbId.displayName,
    nip05: dbId.nip05,
    nip05Verified: dbId.nip05Verified,
    created: dbId.created,
    lastUsed: dbId.lastUsed,
  };
}

/**
 * Convert DBIdentity to EncryptedKeyData format
 */
function dbIdentityToEncryptedData(dbId: DBIdentity): EncryptedKeyData {
  return {
    publicKey: dbId.publicKey,
    encryptedPrivateKey: dbId.encryptedPrivateKey,
    salt: dbId.salt,
    iv: dbId.iv,
    webAuthnProtected: dbId.webAuthnProtected,
    credentialId: dbId.credentialId,
    createdAt: dbId.created,
    lastUnlockedAt: dbId.lastUsed,
    keyVersion: dbId.keyVersion,
  };
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => {
  // Subscribe to SecureKeyManager events
  secureKeyManager.addEventListener((event) => {
    get()._handleSecureKeyManagerEvent(event);
  });

  return {
    // Initial state
    currentIdentity: null,
    identities: [],
    lockState: 'locked',
    isLoading: false,
    isUnlocking: false,
    error: null,
    lockTimeoutWarning: null,

    /**
     * Handle SecureKeyManager events
     */
    _handleSecureKeyManagerEvent: (event: SecureKeyManagerEvent) => {
      switch (event.type) {
        case 'locked':
          set({ lockState: 'locked', lockTimeoutWarning: null });
          break;
        case 'unlocked':
          set({ lockState: 'unlocked', lockTimeoutWarning: null });
          break;
        case 'lock-timeout-warning':
          set({ lockTimeoutWarning: event.secondsRemaining });
          break;
      }
    },

    /**
     * Create a new identity with password protection
     */
    createNewIdentity: async (name: string, password: string): Promise<Identity> => {
      set({ isLoading: true, error: null });

      try {
        // Generate new identity with keys
        const identity = createIdentity(name);

        // Create encrypted key data
        const encryptedData = await secureKeyManager.createEncryptedKeyData(
          identity.publicKey,
          identity.privateKey,
          password
        );

        // Store in IndexedDB with proper encryption
        const dbIdentity: DBIdentity = {
          publicKey: identity.publicKey,
          encryptedPrivateKey: encryptedData.encryptedPrivateKey,
          salt: encryptedData.salt,
          iv: encryptedData.iv,
          webAuthnProtected: false,
          keyVersion: 1,
          name: identity.name,
          npub: identity.npub,
          created: identity.created,
          lastUsed: identity.lastUsed,
        };

        await dal.add('identities', dbIdentity);

        // Unlock with the new identity
        await secureKeyManager.unlockWithPassword(encryptedData, password);

        const publicIdentity = dbIdentityToPublic(dbIdentity);

        set((state) => ({
          identities: [...state.identities, publicIdentity],
          currentIdentity: publicIdentity,
          lockState: 'unlocked',
          isLoading: false,
        }));

        // Persist selected identity to localStorage for session persistence
        sessionStorage.setItem(SELECTED_IDENTITY_KEY, identity.publicKey);

        // Return full identity with private key
        return identity;
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToCreateIdentity');
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Import an identity from nsec with password protection
     */
    importIdentity: async (nsec: string, name: string, password: string): Promise<Identity> => {
      set({ isLoading: true, error: null });

      try {
        // Import identity from nsec
        const identity = importFromNsec(nsec, name);

        // Check if identity already exists
        const existing = await dal.get<DBIdentity>('identities', identity.publicKey);
        if (existing) {
          throw new Error('Identity already exists');
        }

        // Create encrypted key data
        const encryptedData = await secureKeyManager.createEncryptedKeyData(
          identity.publicKey,
          identity.privateKey,
          password
        );

        // Store in database
        const dbIdentity: DBIdentity = {
          publicKey: identity.publicKey,
          encryptedPrivateKey: encryptedData.encryptedPrivateKey,
          salt: encryptedData.salt,
          iv: encryptedData.iv,
          webAuthnProtected: false,
          keyVersion: 1,
          name: identity.name,
          npub: identity.npub,
          created: identity.created,
          lastUsed: identity.lastUsed,
        };

        await dal.add('identities', dbIdentity);

        // Unlock with the new identity
        await secureKeyManager.unlockWithPassword(encryptedData, password);

        const publicIdentity = dbIdentityToPublic(dbIdentity);

        set((state) => ({
          identities: [...state.identities, publicIdentity],
          currentIdentity: publicIdentity,
          lockState: 'unlocked',
          isLoading: false,
        }));

        // Persist selected identity to localStorage for session persistence
        sessionStorage.setItem(SELECTED_IDENTITY_KEY, identity.publicKey);

        return identity;
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToImportIdentity');
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Load all identities from database (public info only)
     */
    loadIdentities: async () => {
      set({ isLoading: true, error: null });

      try {
        const dbIdentities = await dal.getAll<DBIdentity>('identities');
        const identities = dbIdentities.map(dbIdentityToPublic);

        set({ identities, isLoading: false });
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToLoadIdentities');
        set({ error: errorMsg, isLoading: false });
      }
    },

    /**
     * Remove an identity
     */
    removeIdentity: async (publicKey: string) => {
      set({ isLoading: true, error: null });

      try {
        await dal.delete('identities', publicKey);

        // SECURITY: Clear rate limit state for the removed identity
        clearRateLimitState(publicKey);

        const current = get().currentIdentity;
        const isCurrentIdentity = current?.publicKey === publicKey;

        // If removing current identity, lock first
        if (isCurrentIdentity) {
          secureKeyManager.lock();
        }

        set((state) => ({
          identities: state.identities.filter((id) => id.publicKey !== publicKey),
          currentIdentity: isCurrentIdentity ? null : state.currentIdentity,
          lockState: isCurrentIdentity ? 'locked' : state.lockState,
          isLoading: false,
        }));
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToRemoveIdentity');
        set({ error: errorMsg, isLoading: false });
      }
    },

    /**
     * Set the current identity (must unlock separately)
     *
     * SECURITY: Clears all session data from other stores when switching identities
     * to prevent data leakage between accounts.
     */
    setCurrentIdentity: async (publicKey: string | null) => {
      const previousIdentity = get().currentIdentity;

      // SECURITY: Clear all session data before switching identities
      // This prevents data from one identity leaking to another
      if (previousIdentity && previousIdentity.publicKey !== publicKey) {
        await clearAllSessionData();
      }

      if (!publicKey) {
        // Clearing current identity - lock and clear localStorage
        secureKeyManager.lock();
        sessionStorage.removeItem(SELECTED_IDENTITY_KEY);
        set({ currentIdentity: null, lockState: 'locked' });
        return;
      }

      // Find identity
      const identity = get().identities.find((id) => id.publicKey === publicKey);
      if (!identity) {
        throw new Error('Identity not found');
      }

      // Lock the current session before switching
      secureKeyManager.lock();

      // Persist selected identity to localStorage for session persistence
      sessionStorage.setItem(SELECTED_IDENTITY_KEY, publicKey);

      set({ currentIdentity: identity, lockState: 'locked' });
    },

    /**
     * Unlock the current identity with password
     *
     * SECURITY: Rate limited with exponential backoff to prevent brute-force attacks.
     * After 3 failed attempts, wait time doubles each failure (max 1 hour).
     */
    unlock: async (password: string) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      // SECURITY: Check rate limit before attempting unlock
      const waitTime = checkRateLimit(current.publicKey);
      if (waitTime > 0) {
        const message = getRateLimitMessage(current.publicKey);
        set({ error: message, isUnlocking: false });
        throw new Error(message || 'Rate limited. Please try again later.');
      }

      set({ isUnlocking: true, error: null });

      try {
        // Get encrypted data from database
        const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
        if (!dbIdentity) {
          throw new Error('Identity not found in database');
        }

        // Check if this is an old-format identity (no salt field)
        if (!dbIdentity.salt) {
          throw new Error(
            'This identity needs to be migrated. Please use the migration tool in Settings.'
          );
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);

        // Unlock with SecureKeyManager
        await secureKeyManager.unlockWithPassword(encryptedData, password);

        // SECURITY: Record successful auth to clear rate limit state
        recordSuccess(current.publicKey);

        // Load security settings
        if (dbIdentity.securitySettings) {
          try {
            const settings = JSON.parse(dbIdentity.securitySettings) as SecuritySettings;
            secureKeyManager.setSecuritySettings(current.publicKey, settings);
          } catch {
            // Use defaults if parsing fails
          }
        }

        // Update last used timestamp
        await dal.update('identities', current.publicKey, { lastUsed: Date.now() });

        set({ isUnlocking: false, lockState: 'unlocked' });
      } catch (error) {
        // SECURITY: Record failed auth attempt
        recordFailure(current.publicKey);

        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToUnlock');
        set({ error: errorMsg, isUnlocking: false });
        throw error;
      }
    },

    /**
     * Lock the app (clear keys from memory)
     */
    lock: () => {
      secureKeyManager.lock();
      set({ lockState: 'locked', lockTimeoutWarning: null });
    },

    /**
     * Get the current private key (only if unlocked)
     */
    getPrivateKey: (): Uint8Array | null => {
      return secureKeyManager.getCurrentPrivateKey();
    },

    /**
     * Change password for current identity
     */
    changePassword: async (oldPassword: string, newPassword: string) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      set({ isLoading: true, error: null });

      try {
        const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
        if (!dbIdentity) {
          throw new Error('Identity not found');
        }

        const oldEncryptedData = dbIdentityToEncryptedData(dbIdentity);
        const newEncryptedData = await secureKeyManager.changePassword(
          oldEncryptedData,
          oldPassword,
          newPassword
        );

        // Update in database
        await dal.update('identities', current.publicKey, {
          encryptedPrivateKey: newEncryptedData.encryptedPrivateKey,
          salt: newEncryptedData.salt,
          iv: newEncryptedData.iv,
          keyVersion: newEncryptedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToChangePassword');
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Verify password without unlocking
     *
     * SECURITY: Rate limited with exponential backoff to prevent brute-force attacks.
     * Shares rate limit state with unlock() function.
     */
    verifyPassword: async (password: string): Promise<boolean> => {
      const current = get().currentIdentity;
      if (!current) {
        return false;
      }

      // SECURITY: Check rate limit before attempting verification
      const waitTime = checkRateLimit(current.publicKey);
      if (waitTime > 0) {
        console.warn('Password verification rate limited');
        return false;
      }

      try {
        const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
        if (!dbIdentity || !dbIdentity.salt) {
          return false;
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);
        const isValid = await secureKeyManager.verifyPassword(encryptedData, password);

        if (isValid) {
          // SECURITY: Record success to clear rate limit state
          recordSuccess(current.publicKey);
        } else {
          // SECURITY: Record failed verification attempt
          recordFailure(current.publicKey);
        }

        return isValid;
      } catch {
        // SECURITY: Record failed attempt
        recordFailure(current.publicKey);
        return false;
      }
    },

    /**
     * Enable WebAuthn for quick unlock
     */
    enableWebAuthn: async (password: string) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      set({ isLoading: true, error: null });

      try {
        // First verify password
        const isValid = await get().verifyPassword(password);
        if (!isValid) {
          throw new Error('Invalid password');
        }

        // Import WebAuthn service dynamically
        const { webAuthnService } = await import('@/lib/webauthn/WebAuthnService');
        await webAuthnService.init();

        if (!webAuthnService.isWebAuthnSupported()) {
          throw new Error('WebAuthn is not supported on this device');
        }

        // Register credential
        const credential = await webAuthnService.registerCredential(
          current.npub,
          current.displayName || current.name
        );

        // Get encrypted data from database
        const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
        if (!dbIdentity) {
          throw new Error('Identity not found');
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);
        const updatedData = await secureKeyManager.enableWebAuthn(
          encryptedData,
          credential,
          password
        );

        // Update in database
        await dal.update('identities', current.publicKey, {
          webAuthnProtected: true,
          credentialId: updatedData.credentialId,
          keyVersion: updatedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToEnableWebauthn');
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Disable WebAuthn
     */
    disableWebAuthn: async (password: string) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      set({ isLoading: true, error: null });

      try {
        const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
        if (!dbIdentity) {
          throw new Error('Identity not found');
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);
        const updatedData = await secureKeyManager.disableWebAuthn(encryptedData, password);

        // Update in database
        await dal.update('identities', current.publicKey, {
          webAuthnProtected: false,
          credentialId: undefined,
          keyVersion: updatedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = getTranslatedErrorMessage(error, 'errors.failedToDisableWebauthn');
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Update security settings
     */
    updateSecuritySettings: async (settings: Partial<SecuritySettings>) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      const currentSettings = get().getSecuritySettings();
      const newSettings: SecuritySettings = {
        ...currentSettings,
        ...settings,
      };

      // Update in SecureKeyManager
      secureKeyManager.setSecuritySettings(current.publicKey, newSettings);

      // Persist to database
      await dal.update('identities', current.publicKey, {
        securitySettings: JSON.stringify(newSettings),
      });
    },

    /**
     * Get security settings for current identity
     */
    getSecuritySettings: (): SecuritySettings => {
      const current = get().currentIdentity;
      if (!current) {
        return DEFAULT_SECURITY_SETTINGS;
      }
      return secureKeyManager.getSecuritySettings(current.publicKey);
    },

    /**
     * Export private key (requires password verification)
     */
    exportPrivateKey: async (password: string): Promise<string> => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      const dbIdentity = await dal.get<DBIdentity>('identities', current.publicKey);
      if (!dbIdentity) {
        throw new Error('Identity not found');
      }

      const encryptedData = dbIdentityToEncryptedData(dbIdentity);
      const privateKey = await secureKeyManager.exportPrivateKey(encryptedData, password);

      // Return as nsec
      return nip19.nsecEncode(privateKey);
    },

    /**
     * Update backup status for current identity
     * Used to track when user has saved their recovery phrase or created a backup
     */
    updateBackupStatus: async (updates: {
      recoveryPhraseShownAt?: number;
      recoveryPhraseConfirmedAt?: number;
      lastBackupAt?: number;
    }) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      await dal.update('identities', current.publicKey, updates);
    },

    /**
     * Check backup status for current identity
     * Returns whether user has a valid backup and related timestamps
     */
    checkBackupStatus: async () => {
      const current = get().currentIdentity;
      if (!current) {
        return {
          hasValidBackup: false,
          importedWithoutBackup: false,
        };
      }

      const identity = await dal.get<DBIdentity>('identities', current.publicKey);
      if (!identity) {
        return {
          hasValidBackup: false,
          importedWithoutBackup: false,
        };
      }

      const hasValidBackup = !!(
        identity.recoveryPhraseConfirmedAt ||
        identity.lastBackupAt
      );

      return {
        hasValidBackup,
        importedWithoutBackup: identity.importedWithoutBackup || false,
        recoveryPhraseConfirmedAt: identity.recoveryPhraseConfirmedAt,
        lastBackupAt: identity.lastBackupAt,
      };
    },

    /**
     * Logout - clear all authentication state and return to login
     *
     * This fully logs out the user by:
     * 1. Locking the SecureKeyManager (clearing private key from memory)
     * 2. Clearing the current identity from state
     * 3. Clearing the saved identity from localStorage
     * 4. Clearing all session data from other stores
     */
    logout: async () => {
      // Lock first to clear private key from memory
      get().lock();

      // Clear all session data before clearing identity
      await clearAllSessionData();

      // Clear current identity from state
      set({ currentIdentity: null });

      // Clear from localStorage so user goes to login on refresh
      sessionStorage.removeItem(SELECTED_IDENTITY_KEY);
    },
  };
});

/**
 * Hook to get the current identity with private key
 * Returns null if locked
 */
export function useCurrentIdentityWithKey(): Identity | null {
  const { currentIdentity, lockState } = useAuthStore();

  if (!currentIdentity || lockState !== 'unlocked') {
    return null;
  }

  const privateKey = secureKeyManager.getCurrentPrivateKey();
  if (!privateKey) {
    return null;
  }

  return {
    ...currentIdentity,
    privateKey,
  };
}

/**
 * Hook to check if app is locked
 */
export function useIsLocked(): boolean {
  return useAuthStore((state) => state.lockState === 'locked');
}

/**
 * Hook to get lock timeout warning
 */
export function useLockTimeoutWarning(): number | null {
  return useAuthStore((state) => state.lockTimeoutWarning);
}

/**
 * Hook to get the private key for the current identity
 * Returns null if locked or no identity selected
 *
 * This is a simpler hook for components that just need the private key
 */
export function usePrivateKey(): Uint8Array | null {
  const { currentIdentity, lockState } = useAuthStore();

  if (!currentIdentity || lockState !== 'unlocked') {
    return null;
  }

  return secureKeyManager.getCurrentPrivateKey();
}

/**
 * Get the current identity's private key (non-hook version for use in stores/callbacks)
 * Returns null if locked
 */
export function getCurrentPrivateKey(): Uint8Array | null {
  const { currentIdentity, lockState } = useAuthStore.getState();
  if (!currentIdentity || lockState !== 'unlocked') {
    return null;
  }
  return secureKeyManager.getCurrentPrivateKey();
}
