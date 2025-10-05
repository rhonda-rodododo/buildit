import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { db, type DBGroup } from '@/core/storage/db'
import { generateSecretKey } from 'nostr-tools/pure'
import { bytesToHex } from '@noble/hashes/utils'

interface GroupsState {
  activeGroup: DBGroup | null
  groups: DBGroup[]
  isLoading: boolean
  error: string | null
}

interface GroupsActions {
  setActiveGroup: (group: DBGroup | null) => void
  createGroup: (
    name: string,
    description: string,
    privacy: 'public' | 'private',
    adminPubkey: string
  ) => Promise<DBGroup>
  loadGroups: (userPubkey: string) => Promise<void>
  updateGroup: (groupId: string, updates: Partial<DBGroup>) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  toggleModule: (groupId: string, module: string) => Promise<void>
}

export const useGroupsStore = create<GroupsState & GroupsActions>()(
  persist(
    (set, get) => ({
      // State
      activeGroup: null,
      groups: [],
      isLoading: false,
      error: null,

      // Actions
      setActiveGroup: (group) => {
        set({ activeGroup: group, error: null })
      },

      createGroup: async (name, description, privacy, adminPubkey) => {
        set({ isLoading: true, error: null })

        try {
          const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          // Generate group key for encrypted groups
          const groupKey = privacy === 'private'
            ? bytesToHex(generateSecretKey())
            : undefined

          const group: DBGroup = {
            id: groupId,
            name,
            description,
            adminPubkeys: [adminPubkey],
            created: Date.now(),
            privacy,
            encryptedGroupKey: groupKey,
            enabledModules: [], // Start with no modules enabled
          }

          // Store in IndexedDB
          await db.groups.add(group)

          // Add admin as a member
          await db.groupMembers.add({
            groupId,
            pubkey: adminPubkey,
            role: 'admin',
            joined: Date.now(),
          })

          const updatedGroups = [...get().groups, group]
          set({
            groups: updatedGroups,
            activeGroup: group,
            isLoading: false,
          })

          return group
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to create group'
          set({ error: errorMsg, isLoading: false })
          throw error
        }
      },

      loadGroups: async (userPubkey) => {
        set({ isLoading: true, error: null })

        try {
          // Get groups where user is a member
          const memberships = await db.groupMembers
            .where('pubkey')
            .equals(userPubkey)
            .toArray()

          const groupIds = memberships.map(m => m.groupId)

          // Fetch all groups
          const groups = await db.groups
            .where('id')
            .anyOf(groupIds)
            .toArray()

          set({ groups, isLoading: false })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load groups'
          set({ error: errorMsg, isLoading: false })
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
        set({ isLoading: true, error: null })

        try {
          const group = get().groups.find(g => g.id === groupId)
          if (!group) throw new Error('Group not found')

          const enabledModules = group.enabledModules.includes(module)
            ? group.enabledModules.filter(m => m !== module)
            : [...group.enabledModules, module]

          await get().updateGroup(groupId, { enabledModules })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to toggle module'
          set({ error: errorMsg, isLoading: false })
        }
      },
    }),
    {
      name: 'groups-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeGroup: state.activeGroup,
      }),
    }
  )
)
