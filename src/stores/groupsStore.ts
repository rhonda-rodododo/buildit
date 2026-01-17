import { create } from 'zustand'
import { db, type DBGroup, type DBGroupMember } from '@/core/storage/db'
import { generateSecretKey } from 'nostr-tools/pure'
import { bytesToHex } from '@noble/hashes/utils'
import { createGroup as createNostrGroup } from '@/core/groups/groupManager'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupCreationParams } from '@/types/group'

interface GroupsState {
  activeGroup: DBGroup | null
  groups: DBGroup[]
  groupMembers: Map<string, DBGroupMember[]>
  isLoading: boolean
  error: string | null
}

interface GroupsActions {
  setActiveGroup: (group: DBGroup | null) => void
  createGroup: (
    params: GroupCreationParams,
    creatorPrivateKey: Uint8Array,
    creatorPubkey: string
  ) => Promise<DBGroup>
  loadGroups: (userPubkey: string) => Promise<void>
  loadGroupMembers: (groupId: string) => Promise<void>
  updateGroup: (groupId: string, updates: Partial<DBGroup>) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  toggleModule: (groupId: string, module: string) => Promise<void>
}

export const useGroupsStore = create<GroupsState & GroupsActions>()(
  (set, get) => ({
      // State
      activeGroup: null,
      groups: [],
      groupMembers: new Map(),
      isLoading: false,
      error: null,

      // Actions
      setActiveGroup: (group) => {
        set({ activeGroup: group, error: null })
      },

      createGroup: async (params, creatorPrivateKey, creatorPubkey) => {
        set({ isLoading: true, error: null })

        try {
          const client = getNostrClient()

          // Create group on Nostr
          const nostrGroup = await createNostrGroup(client, params, creatorPrivateKey)

          // Generate group key for encrypted groups
          const groupKey = params.privacyLevel === 'private'
            ? bytesToHex(generateSecretKey())
            : undefined

          const dbGroup: DBGroup = {
            id: nostrGroup.id,
            name: params.name,
            description: params.description,
            adminPubkeys: [creatorPubkey],
            created: Date.now(),
            privacy: params.privacyLevel === 'secret' ? 'private' : params.privacyLevel,
            encryptedGroupKey: groupKey,
            enabledModules: params.enabledModules,
          }

          // Store in IndexedDB
          await db.groups.add(dbGroup)

          // Add creator as admin member
          await db.groupMembers.add({
            groupId: nostrGroup.id,
            pubkey: creatorPubkey,
            role: 'admin',
            joined: Date.now(),
          })

          const updatedGroups = [...get().groups, dbGroup]
          set({
            groups: updatedGroups,
            activeGroup: dbGroup,
            isLoading: false,
          })

          return dbGroup
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to create group'
          set({ error: errorMsg, isLoading: false })
          throw error
        }
      },

      loadGroups: async (userPubkey) => {
        set({ isLoading: true, error: null })

        try {
          // Get groups where user is a member from local DB
          const memberships = await db.groupMembers
            .where('pubkey')
            .equals(userPubkey)
            .toArray()

          const groupIds = memberships.map(m => m.groupId)

          // Fetch all groups from local DB
          const groups = await db.groups
            .where('id')
            .anyOf(groupIds)
            .toArray()

          set({ groups, isLoading: false })

          // Optionally sync with Nostr in background
          // const client = getNostrClient()
          // const nostrGroups = await getUserGroups(client, userPubkey)
          // ... merge with local groups ...
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load groups'
          set({ error: errorMsg, isLoading: false })
        }
      },

      loadGroupMembers: async (groupId) => {
        try {
          const members = await db.groupMembers
            .where('groupId')
            .equals(groupId)
            .toArray()

          set((state) => {
            const newGroupMembers = new Map(state.groupMembers)
            newGroupMembers.set(groupId, members)
            return { groupMembers: newGroupMembers }
          })
        } catch (error) {
          console.error('Failed to load group members:', error)
        }
      },

      updateGroup: async (groupId, updates) => {
        set({ isLoading: true, error: null })

        try {
          await db.groups.update(groupId, updates)

          const updatedGroups = get().groups.map(g =>
            g.id === groupId ? { ...g, ...updates } : g
          )

          const active = get().activeGroup
          const updatedActive = active?.id === groupId
            ? { ...active, ...updates }
            : active

          set({
            groups: updatedGroups,
            activeGroup: updatedActive,
            isLoading: false,
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to update group'
          set({ error: errorMsg, isLoading: false })
        }
      },

      deleteGroup: async (groupId) => {
        set({ isLoading: true, error: null })

        try {
          // Delete group and all related data
          await db.transaction('rw', [db.groups, db.groupMembers], async () => {
            await db.groups.delete(groupId)
            await db.groupMembers.where('groupId').equals(groupId).delete()
          })

          const updatedGroups = get().groups.filter(g => g.id !== groupId)
          const active = get().activeGroup

          set({
            groups: updatedGroups,
            activeGroup: active?.id === groupId ? null : active,
            isLoading: false,
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to delete group'
          set({ error: errorMsg, isLoading: false })
        }
      },

      toggleModule: async (groupId, module) => {
        try {
          const group = get().groups.find(g => g.id === groupId)
          if (!group) throw new Error('Group not found')

          const isEnabled = group.enabledModules.includes(module)
          const enabledModules = isEnabled
            ? group.enabledModules.filter(m => m !== module)
            : [...group.enabledModules, module]

          // First, sync with module store (this may throw errors)
          const { enableModule, disableModule } = await import('./moduleStore').then(m => m.useModuleStore.getState())
          if (isEnabled) {
            await disableModule(groupId, module)
          } else {
            await enableModule(groupId, module)
          }

          // Only update group's enabledModules list after module store succeeds
          await get().updateGroup(groupId, { enabledModules })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to toggle module'
          set({ error: errorMsg })
          throw error
        }
      },
    })
)
