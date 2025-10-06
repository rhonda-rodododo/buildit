import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Identity } from '@/types/identity'
import { createIdentity, importFromNsec } from '@/core/crypto/keyManager'
import { db } from '@/core/storage/db'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import * as nip19 from 'nostr-tools/nip19'

interface AuthState {
  currentIdentity: Identity | null
  identities: Identity[]
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  setCurrentIdentity: (identity: Identity | null) => void
  createNewIdentity: (name: string) => Promise<Identity>
  importIdentity: (nsec: string, name: string) => Promise<Identity>
  loadIdentities: () => Promise<void>
  loadCurrentIdentityPrivateKey: () => Promise<void>
  removeIdentity: (publicKey: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      currentIdentity: null,
      identities: [],
      isLoading: false,
      error: null,

      // Actions
      setCurrentIdentity: async (identity) => {
        set({ currentIdentity: identity, error: null })

        // Update last used timestamp in DB
        if (identity) {
          db.identities.update(identity.publicKey, {
            lastUsed: Date.now(),
          }).catch(console.error)

          // Load private key from DB if not already loaded
          if (!identity.privateKey) {
            await get().loadCurrentIdentityPrivateKey()
          }
        }
      },

      createNewIdentity: async (name) => {
        set({ isLoading: true, error: null })

        try {
          const identity = createIdentity(name)

          // Store in IndexedDB
          // NOTE: Keys are hex-encoded for local storage (IndexedDB is browser-sandboxed)
          // For WebAuthn-protected keys, use ProtectedKeyStorage service
          // For password-protected keys, use protectedKeyStorage.storeProtectedKey()
          await db.identities.add({
            publicKey: identity.publicKey,
            encryptedPrivateKey: bytesToHex(identity.privateKey),
            name: identity.name,
            created: identity.created,
            lastUsed: identity.lastUsed,
          })

          const updatedIdentities = [...get().identities, identity]
          set({
            identities: updatedIdentities,
            currentIdentity: identity,
            isLoading: false,
          })

          return identity
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to create identity'
          set({ error: errorMsg, isLoading: false })
          throw error
        }
      },

      importIdentity: async (nsec, name) => {
        set({ isLoading: true, error: null })

        try {
          const identity = importFromNsec(nsec, name)

          // Store in IndexedDB
          // NOTE: Keys are hex-encoded for local storage (IndexedDB is browser-sandboxed)
          // For WebAuthn-protected keys, use ProtectedKeyStorage service
          await db.identities.add({
            publicKey: identity.publicKey,
            encryptedPrivateKey: bytesToHex(identity.privateKey),
            name: identity.name,
            created: identity.created,
            lastUsed: identity.lastUsed,
          })

          const updatedIdentities = [...get().identities, identity]
          set({
            identities: updatedIdentities,
            currentIdentity: identity,
            isLoading: false,
          })

          return identity
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to import identity'
          set({ error: errorMsg, isLoading: false })
          throw error
        }
      },

      loadIdentities: async () => {
        set({ isLoading: true, error: null })

        try {
          const dbIdentities = await db.identities.toArray()

          // Convert to Identity objects
          // Keys are stored hex-encoded in IndexedDB (browser-sandboxed)
          const identities: Identity[] = dbIdentities.map(dbId => ({
            publicKey: dbId.publicKey,
            npub: nip19.npubEncode(dbId.publicKey),
            privateKey: hexToBytes(dbId.encryptedPrivateKey),
            name: dbId.name,
            created: dbId.created,
            lastUsed: dbId.lastUsed,
          }))

          set({ identities, isLoading: false })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load identities'
          set({ error: errorMsg, isLoading: false })
        }
      },

      loadCurrentIdentityPrivateKey: async () => {
        const current = get().currentIdentity
        if (!current) return

        try {
          const dbIdentity = await db.identities.get(current.publicKey)
          if (!dbIdentity) {
            console.error('Identity not found in database')
            return
          }

          // Restore private key from DB (hex-encoded in IndexedDB)
          const privateKey = hexToBytes(dbIdentity.encryptedPrivateKey)

          set({
            currentIdentity: {
              ...current,
              privateKey,
            },
          })
        } catch (error) {
          console.error('Failed to load private key:', error)
        }
      },

      removeIdentity: async (publicKey) => {
        set({ isLoading: true, error: null })

        try {
          await db.identities.delete(publicKey)

          const updatedIdentities = get().identities.filter(id => id.publicKey !== publicKey)
          const current = get().currentIdentity

          set({
            identities: updatedIdentities,
            currentIdentity: current?.publicKey === publicKey ? null : current,
            isLoading: false,
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to remove identity'
          set({ error: errorMsg, isLoading: false })
        }
      },

      logout: () => {
        set({ currentIdentity: null, error: null })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentIdentity: state.currentIdentity
          ? {
              publicKey: state.currentIdentity.publicKey,
              npub: state.currentIdentity.npub,
              name: state.currentIdentity.name,
              created: state.currentIdentity.created,
              lastUsed: state.currentIdentity.lastUsed,
            }
          : null,
      }),
      onRehydrateStorage: () => async (state) => {
        // After rehydrating from localStorage, restore the full Identity with private key from DB
        // NOTE: We defer database access to avoid opening the DB before modules register schemas
        if (state?.currentIdentity) {
          // The private key will be loaded lazily via loadCurrentIdentityPrivateKey()
          // when the app actually needs it (after database initialization)
        }
      },
    }
  )
)
