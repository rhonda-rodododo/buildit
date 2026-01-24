/**
 * Auth Store - Identity Management
 *
 * Manages the current user's Nostr identity with secure persistence.
 * Uses Zustand for state management.
 */

import { create } from 'zustand'
import {
  generateKeypair,
  generateRecoveryPhrase,
  deriveKeyFromPhrase,
  importPrivateKey,
  validateRecoveryPhrase,
} from '@buildit/sdk'
import {
  STORAGE_KEYS,
  setSecureItem,
  getSecureItem,
  clearAllSecureStorage,
  hasStoredIdentity,
} from '../storage/secureStorage'
import {
  getBiometricStatus,
  enableBiometricAuth,
  disableBiometricAuth,
  quickUnlock,
  getBiometricTypeName,
  type BiometricStatus,
  type BiometricType,
} from '../services/biometricAuth'

// Re-export biometric types for convenience
export type { BiometricStatus, BiometricType }

/**
 * Stored keypair (hex strings only, no Uint8Array)
 */
export interface StoredKeypair {
  publicKey: string
  privateKey: string // hex string
}

export interface UserIdentity {
  publicKey: string
  privateKey: string
  displayName?: string
  recoveryPhrase?: string
  createdAt: number
}

export interface LinkedDevice {
  id: string
  name: string
  platform: 'ios' | 'android' | 'web'
  linkedAt: number
  lastSeen: number
}

interface AuthState {
  // State
  identity: UserIdentity | null
  linkedDevices: LinkedDevice[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  isLocked: boolean
  biometricStatus: BiometricStatus | null

  // Actions
  initialize: () => Promise<void>
  createIdentity: (displayName: string) => Promise<{ keypair: StoredKeypair; recoveryPhrase: string }>
  importFromPhrase: (phrase: string, displayName?: string) => Promise<StoredKeypair>
  importFromPrivateKey: (privateKey: string, displayName?: string) => Promise<StoredKeypair>
  updateDisplayName: (name: string) => Promise<void>
  logout: () => Promise<void>
  addLinkedDevice: (device: Omit<LinkedDevice, 'id' | 'linkedAt' | 'lastSeen'>) => Promise<void>
  removeLinkedDevice: (deviceId: string) => Promise<void>
  clearError: () => void

  // Lock/Unlock
  lock: () => void
  unlock: () => void
  attemptBiometricUnlock: () => Promise<boolean>

  // Biometric settings
  refreshBiometricStatus: () => Promise<void>
  enableBiometric: () => Promise<boolean>
  disableBiometric: () => Promise<void>
  getBiometricTypeName: () => string
}

export const useAuthStore = create<AuthState>((set, get) => ({
  identity: null,
  linkedDevices: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  isLocked: true,
  biometricStatus: null,

  initialize: async () => {
    set({ isLoading: true, error: null })

    try {
      // Check if we have stored identity
      const hasIdentity = await hasStoredIdentity()

      if (hasIdentity) {
        // Load stored identity
        const [privateKey, publicKey, displayName, recoveryPhrase] = await Promise.all([
          getSecureItem(STORAGE_KEYS.PRIVATE_KEY),
          getSecureItem(STORAGE_KEYS.PUBLIC_KEY),
          getSecureItem(STORAGE_KEYS.DISPLAY_NAME),
          getSecureItem(STORAGE_KEYS.RECOVERY_PHRASE),
        ])

        if (privateKey && publicKey) {
          // Load linked devices
          const linkedDevicesStr = await getSecureItem(STORAGE_KEYS.LINKED_DEVICES)
          const linkedDevices: LinkedDevice[] = linkedDevicesStr
            ? JSON.parse(linkedDevicesStr)
            : []

          // Load biometric status
          const biometricStatus = await getBiometricStatus()

          set({
            identity: {
              publicKey,
              privateKey,
              displayName: displayName || undefined,
              recoveryPhrase: recoveryPhrase || undefined,
              createdAt: Date.now(), // Could store this separately
            },
            linkedDevices,
            biometricStatus,
            isLoading: false,
            isInitialized: true,
            isLocked: true, // Start locked, require biometric or explicit unlock
          })

          // Attempt biometric unlock if enabled
          if (biometricStatus.isEnabled) {
            // Small delay to let the UI initialize
            setTimeout(async () => {
              const success = await quickUnlock()
              if (success) {
                useAuthStore.setState({ isLocked: false })
              }
            }, 500)
          }

          return
        }
      }

      // No stored identity
      set({ identity: null, isLoading: false, isInitialized: true })
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      set({
        error: 'Failed to load identity',
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  createIdentity: async (displayName: string) => {
    set({ isLoading: true, error: null })

    try {
      // Generate new keypair and recovery phrase
      const keypair = generateKeypair()
      const recoveryPhrase = generateRecoveryPhrase()

      // Store securely (use hex strings for storage)
      await Promise.all([
        setSecureItem(STORAGE_KEYS.PRIVATE_KEY, keypair.privateKeyHex),
        setSecureItem(STORAGE_KEYS.PUBLIC_KEY, keypair.publicKey),
        setSecureItem(STORAGE_KEYS.DISPLAY_NAME, displayName),
        setSecureItem(STORAGE_KEYS.RECOVERY_PHRASE, recoveryPhrase),
      ])

      const identity: UserIdentity = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKeyHex,
        displayName,
        recoveryPhrase,
        createdAt: Date.now(),
      }

      set({ identity, isLoading: false })

      return { keypair: { publicKey: keypair.publicKey, privateKey: keypair.privateKeyHex }, recoveryPhrase }
    } catch (error) {
      console.error('Failed to create identity:', error)
      set({ error: 'Failed to create identity', isLoading: false })
      throw error
    }
  },

  importFromPhrase: async (phrase: string, displayName?: string) => {
    set({ isLoading: true, error: null })

    try {
      // Validate and derive keypair
      if (!validateRecoveryPhrase(phrase)) {
        throw new Error('Invalid recovery phrase')
      }

      const keypair = deriveKeyFromPhrase(phrase)

      // Store securely (use hex strings for storage)
      await Promise.all([
        setSecureItem(STORAGE_KEYS.PRIVATE_KEY, keypair.privateKeyHex),
        setSecureItem(STORAGE_KEYS.PUBLIC_KEY, keypair.publicKey),
        setSecureItem(STORAGE_KEYS.RECOVERY_PHRASE, phrase),
        displayName ? setSecureItem(STORAGE_KEYS.DISPLAY_NAME, displayName) : Promise.resolve(),
      ])

      const identity: UserIdentity = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKeyHex,
        displayName,
        recoveryPhrase: phrase,
        createdAt: Date.now(),
      }

      set({ identity, isLoading: false })

      return { publicKey: keypair.publicKey, privateKey: keypair.privateKeyHex }
    } catch (error) {
      console.error('Failed to import from phrase:', error)
      set({ error: 'Failed to import identity', isLoading: false })
      throw error
    }
  },

  importFromPrivateKey: async (privateKeyInput: string, displayName?: string) => {
    set({ isLoading: true, error: null })

    try {
      const keypair = importPrivateKey(privateKeyInput)

      // Store securely (use hex strings for storage)
      await Promise.all([
        setSecureItem(STORAGE_KEYS.PRIVATE_KEY, keypair.privateKeyHex),
        setSecureItem(STORAGE_KEYS.PUBLIC_KEY, keypair.publicKey),
        displayName ? setSecureItem(STORAGE_KEYS.DISPLAY_NAME, displayName) : Promise.resolve(),
      ])

      const identity: UserIdentity = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKeyHex,
        displayName,
        createdAt: Date.now(),
      }

      set({ identity, isLoading: false })

      return { publicKey: keypair.publicKey, privateKey: keypair.privateKeyHex }
    } catch (error) {
      console.error('Failed to import from key:', error)
      set({ error: 'Failed to import identity', isLoading: false })
      throw error
    }
  },

  updateDisplayName: async (name: string) => {
    const { identity } = get()
    if (!identity) return

    await setSecureItem(STORAGE_KEYS.DISPLAY_NAME, name)
    set({ identity: { ...identity, displayName: name } })
  },

  logout: async () => {
    set({ isLoading: true })

    try {
      await clearAllSecureStorage()
      set({
        identity: null,
        linkedDevices: [],
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to logout:', error)
      set({ error: 'Failed to logout', isLoading: false })
    }
  },

  addLinkedDevice: async (device) => {
    const { linkedDevices } = get()

    const newDevice: LinkedDevice = {
      ...device,
      id: Math.random().toString(36).slice(2),
      linkedAt: Date.now(),
      lastSeen: Date.now(),
    }

    const updatedDevices = [...linkedDevices, newDevice]
    await setSecureItem(STORAGE_KEYS.LINKED_DEVICES, JSON.stringify(updatedDevices))
    set({ linkedDevices: updatedDevices })
  },

  removeLinkedDevice: async (deviceId: string) => {
    const { linkedDevices } = get()
    const updatedDevices = linkedDevices.filter((d) => d.id !== deviceId)
    await setSecureItem(STORAGE_KEYS.LINKED_DEVICES, JSON.stringify(updatedDevices))
    set({ linkedDevices: updatedDevices })
  },

  clearError: () => set({ error: null }),

  // Lock/Unlock methods
  lock: () => {
    set({ isLocked: true })
  },

  unlock: () => {
    const { identity } = get()
    if (identity) {
      set({ isLocked: false })
    }
  },

  attemptBiometricUnlock: async () => {
    const { identity, biometricStatus } = get()

    if (!identity) {
      return false
    }

    if (!biometricStatus?.isEnabled) {
      return false
    }

    try {
      const success = await quickUnlock()
      if (success) {
        set({ isLocked: false })
      }
      return success
    } catch (error) {
      console.error('Biometric unlock failed:', error)
      return false
    }
  },

  // Biometric settings
  refreshBiometricStatus: async () => {
    try {
      const status = await getBiometricStatus()
      set({ biometricStatus: status })
    } catch (error) {
      console.error('Failed to get biometric status:', error)
      set({
        biometricStatus: {
          isAvailable: false,
          isEnabled: false,
          biometricType: 'none',
          securityLevel: 'none',
        },
      })
    }
  },

  enableBiometric: async () => {
    try {
      const success = await enableBiometricAuth()
      if (success) {
        await get().refreshBiometricStatus()
      }
      return success
    } catch (error) {
      console.error('Failed to enable biometric:', error)
      set({ error: 'Failed to enable biometric authentication' })
      return false
    }
  },

  disableBiometric: async () => {
    try {
      await disableBiometricAuth()
      await get().refreshBiometricStatus()
    } catch (error) {
      console.error('Failed to disable biometric:', error)
      set({ error: 'Failed to disable biometric authentication' })
    }
  },

  getBiometricTypeName: () => {
    const { biometricStatus } = get()
    if (!biometricStatus) return 'Biometrics'
    return getBiometricTypeName(biometricStatus.biometricType)
  },
}))
