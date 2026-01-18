import { create } from 'zustand'
import type { Table } from 'dexie'
import { db, type DBGroup, type DBGroupMember, type DBGroupInvitation } from '@/core/storage/db'
import { generateSecretKey } from 'nostr-tools/pure'
import { bytesToHex } from '@noble/hashes/utils'
import { createGroup as createNostrGroup } from '@/core/groups/groupManager'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupCreationParams } from '@/types/group'
import { useNotificationStore } from '@/stores/notificationStore'

interface GroupsState {
  activeGroup: DBGroup | null
  groups: DBGroup[]
  groupMembers: Map<string, DBGroupMember[]>
  pendingInvitations: DBGroupInvitation[]
  sentInvitations: DBGroupInvitation[]
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
  // Invitation methods
  createInvitation: (
    groupId: string,
    inviterPubkey: string,
    options: {
      inviteePubkey?: string
      role?: DBGroupMember['role']
      message?: string
      expiresInHours?: number
    }
  ) => Promise<DBGroupInvitation>
  loadPendingInvitations: (userPubkey: string) => Promise<void>
  loadSentInvitations: (userPubkey: string) => Promise<void>
  acceptInvitation: (invitationId: string, userPubkey: string) => Promise<void>
  declineInvitation: (invitationId: string) => Promise<void>
  revokeInvitation: (invitationId: string) => Promise<void>
  // Member management
  updateMemberRole: (groupId: string, memberPubkey: string, newRole: DBGroupMember['role']) => Promise<void>
  removeMember: (groupId: string, memberPubkey: string) => Promise<void>
}

export const useGroupsStore = create<GroupsState & GroupsActions>()(
  (set, get) => ({
      // State
      activeGroup: null,
      groups: [],
      groupMembers: new Map(),
      pendingInvitations: [],
      sentInvitations: [],
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
          // Build list of tables to delete from
          // Core tables that always exist
          const coreTables = [
            db.groups,
            db.groupMembers,
            db.messages,
            db.moduleInstances,
            db.conversations,
            db.conversationMembers,
            db.conversationMessages,
            db.groupEntities,
            db.groupEntityMessages,
            db.channels,
          ]

          // Module tables (may or may not exist depending on module registration)
          const moduleTables: Array<{ name: string; table: Table | undefined }> = [
            { name: 'events', table: db.table('events') },
            { name: 'rsvps', table: db.table('rsvps') },
            { name: 'mutualAidRequests', table: db.table('mutualAidRequests') },
            { name: 'proposals', table: db.table('proposals') },
            { name: 'wikiPages', table: db.table('wikiPages') },
            { name: 'databaseTables', table: db.table('databaseTables') },
            { name: 'databaseRecords', table: db.table('databaseRecords') },
            { name: 'databaseViews', table: db.table('databaseViews') },
            { name: 'customFieldDefinitions', table: db.table('customFieldDefinitions') },
            { name: 'customFieldValues', table: db.table('customFieldValues') },
          ]

          // Delete group and all related data in a transaction
          await db.transaction('rw', coreTables, async () => {
            // Core data deletion
            await db.groups.delete(groupId)
            await db.groupMembers.where('groupId').equals(groupId).delete()
            await db.messages.where('groupId').equals(groupId).delete()
            await db.moduleInstances.where('groupId').equals(groupId).delete()
            await db.conversations.where('groupId').equals(groupId).delete()
            // Note: conversationMembers and conversationMessages should be cleaned up
            // when their parent conversation is deleted (would need to query conversation IDs first)
            await db.groupEntities.where('groupId').equals(groupId).delete()
            await db.groupEntityMessages.where('groupId').equals(groupId).delete()
            await db.channels.where('groupId').equals(groupId).delete()
          })

          // Delete from module tables (outside main transaction to handle missing tables gracefully)
          for (const { name, table } of moduleTables) {
            try {
              if (table) {
                await table.where('groupId').equals(groupId).delete()
              }
            } catch (error) {
              // Table might not exist or not have groupId index - skip silently
              console.info(`Skipping cleanup of ${name} table (may not exist or have groupId index)`)
            }
          }

          const updatedGroups = get().groups.filter(g => g.id !== groupId)
          const active = get().activeGroup

          set({
            groups: updatedGroups,
            activeGroup: active?.id === groupId ? null : active,
            isLoading: false,
          })

          console.info(`Group ${groupId} and all related data deleted`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to delete group'
          set({ error: errorMsg, isLoading: false })
          throw error
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

      // Invitation methods
      createInvitation: async (groupId, inviterPubkey, options) => {
        const { inviteePubkey, role = 'member', message, expiresInHours = 168 } = options // Default 7 days

        // Generate unique invite code for link invites
        const code = !inviteePubkey
          ? bytesToHex(generateSecretKey()).slice(0, 16)
          : undefined

        const invitation: DBGroupInvitation = {
          id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          groupId,
          inviterPubkey,
          inviteePubkey,
          code,
          role,
          status: 'pending',
          message,
          createdAt: Date.now(),
          expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
        }

        await db.groupInvitations.add(invitation)

        // Update sent invitations list
        set(state => ({
          sentInvitations: [...state.sentInvitations, invitation]
        }))

        return invitation
      },

      loadPendingInvitations: async (userPubkey) => {
        try {
          const now = Date.now()
          const invitations = await db.groupInvitations
            .where('inviteePubkey')
            .equals(userPubkey)
            .and(inv => inv.status === 'pending' && (!inv.expiresAt || inv.expiresAt > now))
            .toArray()

          set({ pendingInvitations: invitations })
        } catch (error) {
          console.error('Failed to load pending invitations:', error)
        }
      },

      loadSentInvitations: async (userPubkey) => {
        try {
          const invitations = await db.groupInvitations
            .where('inviterPubkey')
            .equals(userPubkey)
            .toArray()

          set({ sentInvitations: invitations })
        } catch (error) {
          console.error('Failed to load sent invitations:', error)
        }
      },

      acceptInvitation: async (invitationId, userPubkey) => {
        const invitation = await db.groupInvitations.get(invitationId)
        if (!invitation) throw new Error('Invitation not found')
        if (invitation.status !== 'pending') throw new Error('Invitation is no longer pending')
        if (invitation.expiresAt && invitation.expiresAt < Date.now()) {
          await db.groupInvitations.update(invitationId, { status: 'expired' })
          throw new Error('Invitation has expired')
        }

        // Add user as group member
        await db.groupMembers.add({
          groupId: invitation.groupId,
          pubkey: userPubkey,
          role: invitation.role,
          joined: Date.now(),
        })

        // Update invitation status
        await db.groupInvitations.update(invitationId, {
          status: 'accepted',
          acceptedAt: Date.now(),
        })

        // Get group name for notification
        const group = await db.groups.get(invitation.groupId)

        // Send notification
        useNotificationStore.getState().addNotification({
          type: 'group_invitation',
          title: 'Joined Group',
          message: `You've joined ${group?.name || 'the group'}`,
          metadata: {
            groupId: invitation.groupId,
          },
        })

        // Reload groups and invitations
        await get().loadGroups(userPubkey)
        await get().loadPendingInvitations(userPubkey)
      },

      declineInvitation: async (invitationId) => {
        await db.groupInvitations.update(invitationId, { status: 'declined' })
        set(state => ({
          pendingInvitations: state.pendingInvitations.filter(inv => inv.id !== invitationId)
        }))
      },

      revokeInvitation: async (invitationId) => {
        await db.groupInvitations.update(invitationId, { status: 'revoked' })
        set(state => ({
          sentInvitations: state.sentInvitations.map(inv =>
            inv.id === invitationId ? { ...inv, status: 'revoked' as const } : inv
          )
        }))
      },

      // Member management
      updateMemberRole: async (groupId, memberPubkey, newRole) => {
        const members = get().groupMembers.get(groupId) || []
        const member = members.find(m => m.pubkey === memberPubkey)
        if (!member || !member.id) throw new Error('Member not found')

        await db.groupMembers.update(member.id, { role: newRole })

        // Update adminPubkeys in group if role changed to/from admin
        const group = get().groups.find(g => g.id === groupId)
        if (group) {
          let adminPubkeys = [...group.adminPubkeys]
          if (newRole === 'admin' && !adminPubkeys.includes(memberPubkey)) {
            adminPubkeys.push(memberPubkey)
          } else if (newRole !== 'admin' && adminPubkeys.includes(memberPubkey)) {
            adminPubkeys = adminPubkeys.filter(pk => pk !== memberPubkey)
          }
          if (adminPubkeys.length !== group.adminPubkeys.length) {
            await get().updateGroup(groupId, { adminPubkeys })
          }
        }

        // Reload members
        await get().loadGroupMembers(groupId)
      },

      removeMember: async (groupId, memberPubkey) => {
        const members = get().groupMembers.get(groupId) || []
        const member = members.find(m => m.pubkey === memberPubkey)
        if (!member || !member.id) throw new Error('Member not found')

        // Check if this is the last admin
        const group = get().groups.find(g => g.id === groupId)
        if (group && group.adminPubkeys.includes(memberPubkey) && group.adminPubkeys.length === 1) {
          throw new Error('Cannot remove the last admin. Transfer admin role first.')
        }

        await db.groupMembers.delete(member.id)

        // Update adminPubkeys if member was admin
        if (group && group.adminPubkeys.includes(memberPubkey)) {
          const adminPubkeys = group.adminPubkeys.filter(pk => pk !== memberPubkey)
          await get().updateGroup(groupId, { adminPubkeys })
        }

        // Reload members
        await get().loadGroupMembers(groupId)
      },
    })
)
