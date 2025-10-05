import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Identity } from '@/types/identity'
import { createIdentity, importFromNsec } from '@/core/crypto/keyManager'
import { db } from '@/core/storage/db'
import { bytesToHex } from '@noble/hashes/utils'

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
      setCurrentIdentity: (identity) => {
        set({ currentIdentity: identity, error: null })

        // Update last used timestamp in DB
        if (identity) {
          db.identities.update(identity.publicKey, {
            lastUsed: Date.now(),
          }).catch(console.error)
        }
      },

      createNewIdentity: async (name) => {
        set({ isLoading: true, error: null })

        try {
          const identity = createIdentity(name)

          // Store in IndexedDB (encrypted private key would happen here in production)
          await db.identities.add({
            publicKey: identity.publicKey,
            encryptedPrivateKey: bytesToHex(identity.privateKey), // TODO: Encrypt with password
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
          await db.identities.add({
            publicKey: identity.publicKey,
            encryptedPrivateKey: bytesToHex(identity.privateKey), // TODO: Encrypt with password
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

          // Convert to Identity objects (in production, decrypt private keys here)
          const identities: Identity[] = dbIdentities.map(dbId => ({
            publicKey: dbId.publicKey,
            privateKey: new Uint8Array(0), // Placeholder - load from secure storage
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
          ? { ...state.currentIdentity, privateKey: new Uint8Array(0) } // Don't persist private key
          : null,
      }),
    }
  )
)
