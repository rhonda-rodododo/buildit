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
import { db, type DBIdentity } from '@/core/storage/db';
import * as nip19 from 'nostr-tools/nip19';
import {
  secureKeyManager,
  type EncryptedKeyData,
  type SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  type LockState,
  type SecureKeyManagerEvent,
} from '@/core/crypto/SecureKeyManager';

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

  // Legacy logout (now just locks)
  logout: () => void;

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

        await db.identities.add(dbIdentity);

        // Unlock with the new identity
        await secureKeyManager.unlockWithPassword(encryptedData, password);

        const publicIdentity = dbIdentityToPublic(dbIdentity);

        set((state) => ({
          identities: [...state.identities, publicIdentity],
          currentIdentity: publicIdentity,
          lockState: 'unlocked',
          isLoading: false,
        }));

        // Return full identity with private key
        return identity;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to create identity';
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
        const existing = await db.identities.get(identity.publicKey);
        if (existing) {
          throw new Error('Identity already exists');
        }

        // Create encrypted key data
        const encryptedData = await secureKeyManager.createEncryptedKeyData(
          identity.publicKey,
          identity.privateKey,
          password
        );

        // Store in IndexedDB
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

        await db.identities.add(dbIdentity);

        // Unlock with the new identity
        await secureKeyManager.unlockWithPassword(encryptedData, password);

        const publicIdentity = dbIdentityToPublic(dbIdentity);

        set((state) => ({
          identities: [...state.identities, publicIdentity],
          currentIdentity: publicIdentity,
          lockState: 'unlocked',
          isLoading: false,
        }));

        return identity;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to import identity';
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
        const dbIdentities = await db.identities.toArray();
        const identities = dbIdentities.map(dbIdentityToPublic);

        set({ identities, isLoading: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to load identities';
        set({ error: errorMsg, isLoading: false });
      }
    },

    /**
     * Remove an identity
     */
    removeIdentity: async (publicKey: string) => {
      set({ isLoading: true, error: null });

      try {
        await db.identities.delete(publicKey);

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
        const errorMsg = error instanceof Error ? error.message : 'Failed to remove identity';
        set({ error: errorMsg, isLoading: false });
      }
    },

    /**
     * Set the current identity (must unlock separately)
     */
    setCurrentIdentity: async (publicKey: string | null) => {
      if (!publicKey) {
        // Clearing current identity - lock
        secureKeyManager.lock();
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

      set({ currentIdentity: identity, lockState: 'locked' });
    },

    /**
     * Unlock the current identity with password
     */
    unlock: async (password: string) => {
      const current = get().currentIdentity;
      if (!current) {
        throw new Error('No identity selected');
      }

      set({ isUnlocking: true, error: null });

      try {
        // Get encrypted data from database
        const dbIdentity = await db.identities.get(current.publicKey);
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
        await db.identities.update(current.publicKey, { lastUsed: Date.now() });

        set({ isUnlocking: false, lockState: 'unlocked' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to unlock';
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
        const dbIdentity = await db.identities.get(current.publicKey);
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
        await db.identities.update(current.publicKey, {
          encryptedPrivateKey: newEncryptedData.encryptedPrivateKey,
          salt: newEncryptedData.salt,
          iv: newEncryptedData.iv,
          keyVersion: newEncryptedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to change password';
        set({ error: errorMsg, isLoading: false });
        throw error;
      }
    },

    /**
     * Verify password without unlocking
     */
    verifyPassword: async (password: string): Promise<boolean> => {
      const current = get().currentIdentity;
      if (!current) {
        return false;
      }

      try {
        const dbIdentity = await db.identities.get(current.publicKey);
        if (!dbIdentity || !dbIdentity.salt) {
          return false;
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);
        return await secureKeyManager.verifyPassword(encryptedData, password);
      } catch {
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
        const dbIdentity = await db.identities.get(current.publicKey);
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
        await db.identities.update(current.publicKey, {
          webAuthnProtected: true,
          credentialId: updatedData.credentialId,
          keyVersion: updatedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to enable WebAuthn';
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
        const dbIdentity = await db.identities.get(current.publicKey);
        if (!dbIdentity) {
          throw new Error('Identity not found');
        }

        const encryptedData = dbIdentityToEncryptedData(dbIdentity);
        const updatedData = await secureKeyManager.disableWebAuthn(encryptedData, password);

        // Update in database
        await db.identities.update(current.publicKey, {
          webAuthnProtected: false,
          credentialId: undefined,
          keyVersion: updatedData.keyVersion,
        });

        set({ isLoading: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to disable WebAuthn';
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
      await db.identities.update(current.publicKey, {
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

      const dbIdentity = await db.identities.get(current.publicKey);
      if (!dbIdentity) {
        throw new Error('Identity not found');
      }

      const encryptedData = dbIdentityToEncryptedData(dbIdentity);
      const privateKey = await secureKeyManager.exportPrivateKey(encryptedData, password);

      // Return as nsec
      return nip19.nsecEncode(privateKey);
    },

    /**
     * Legacy logout - now just locks
     */
    logout: () => {
      get().lock();
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
