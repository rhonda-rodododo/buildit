import { create } from 'zustand'
import { dal } from '@/core/storage/dal'
import type { DBGroup, DBGroupMember, DBGroupInvitation } from '@/core/storage/db'
import { generateSecretKey } from 'nostr-tools/pure'
import { bytesToHex } from '@noble/hashes/utils'
import { secureRandomString } from '@/lib/utils'
import { createGroup as createNostrGroup } from '@/core/groups/groupManager'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupCreationParams } from '@/types/group'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'

import { logger } from '@/lib/logger';
/**
 * SECURITY: Authorization helper to check if user has required role
 */
async function checkGroupAuthorization(
  groupId: string,
  requiredRole: 'admin' | 'moderator' | 'member'
): Promise<{ authorized: boolean; currentRole: DBGroupMember['role'] | null }> {
  const currentIdentity = useAuthStore.getState().currentIdentity
  if (!currentIdentity) {
    return { authorized: false, currentRole: null }
  }

  const results = await dal.queryCustom<DBGroupMember>({
    sql: 'SELECT * FROM group_members WHERE group_id = ?1 AND pubkey = ?2 LIMIT 1',
    params: [groupId, currentIdentity.publicKey],
    dexieFallback: async (db) => {
      const result = await db.groupMembers
        .where(['groupId', 'pubkey'])
        .equals([groupId, currentIdentity.publicKey])
        .first()
      return result ? [result] : []
    },
  })

  const membership = results[0]
  if (!membership) {
    return { authorized: false, currentRole: null }
  }

  // Role hierarchy: admin > moderator > member > read-only
  const roleHierarchy: Record<DBGroupMember['role'], number> = {
    admin: 3,
    moderator: 2,
    member: 1,
    'read-only': 0,
  }

  const userLevel = roleHierarchy[membership.role] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0

  return {
    authorized: userLevel >= requiredLevel,
    currentRole: membership.role,
  }
}

/**
 * SECURITY: Get current user's pubkey (throws if not authenticated)
 */
function getCurrentUserPubkey(): string {
  const currentIdentity = useAuthStore.getState().currentIdentity
  if (!currentIdentity) {
    throw new Error('Not authenticated')
  }
  return currentIdentity.publicKey
}

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

          // Store in database
          await dal.add('groups', dbGroup)

          // Add creator as admin member
          await dal.add('groupMembers', {
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
          const memberships = await dal.query<DBGroupMember>('groupMembers', {
            whereClause: { pubkey: userPubkey },
          })

          const groupIds = memberships.map(m => m.groupId)

          // Fetch all groups from local DB using queryCustom for anyOf
          const groups = groupIds.length > 0
            ? await dal.queryCustom<DBGroup>({
                sql: `SELECT * FROM groups WHERE id IN (${groupIds.map((_, i) => `?${i + 1}`).join(',')})`,
                params: groupIds,
                dexieFallback: async (db) => {
                  return db.groups.where('id').anyOf(groupIds).toArray()
                },
              })
            : []

          set({ groups, isLoading: false })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load groups'
          set({ error: errorMsg, isLoading: false })
        }
      },

      loadGroupMembers: async (groupId) => {
        try {
          const members = await dal.query<DBGroupMember>('groupMembers', {
            whereClause: { groupId },
          })

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
          // SECURITY: Check if user has admin permission
          const { authorized, currentRole } = await checkGroupAuthorization(groupId, 'admin')
          if (!authorized) {
            throw new Error(`Unauthorized: only admins can update group settings (your role: ${currentRole || 'not a member'})`)
          }

          await dal.update('groups', groupId, updates)

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
          throw error
        }
      },

      deleteGroup: async (groupId) => {
        set({ isLoading: true, error: null })

        try {
          // SECURITY: Check if user has admin permission
          const { authorized, currentRole } = await checkGroupAuthorization(groupId, 'admin')
          if (!authorized) {
            throw new Error(`Unauthorized: only admins can delete groups (your role: ${currentRole || 'not a member'})`)
          }

          // Core tables deletion
          await dal.delete('groups', groupId)

          // Delete related data using queryCustom for where().equals().delete() patterns
          const coreTables = [
            'groupMembers',
            'messages',
            'moduleInstances',
            'conversations',
            'groupEntities',
            'groupEntityMessages',
            'channels',
          ] as const

          for (const table of coreTables) {
            try {
              await dal.queryCustom({
                sql: `DELETE FROM ${table} WHERE group_id = ?1`,
                params: [groupId],
                dexieFallback: async (db) => {
                  await db.table(table).where('groupId').equals(groupId).delete()
                  return []
                },
              })
            } catch (error) {
              logger.info(`Skipping cleanup of ${table} table (may not exist or have groupId index)`)
            }
          }

          // Module tables (may or may not exist depending on module registration)
          const moduleTables = [
            'events',
            'rsvps',
            'mutualAidRequests',
            'proposals',
            'wikiPages',
            'databaseTables',
            'databaseRecords',
            'databaseViews',
            'customFieldDefinitions',
            'customFieldValues',
          ]

          for (const table of moduleTables) {
            try {
              await dal.queryCustom({
                sql: `DELETE FROM ${table} WHERE group_id = ?1`,
                params: [groupId],
                dexieFallback: async (db) => {
                  await db.table(table).where('groupId').equals(groupId).delete()
                  return []
                },
              })
            } catch (error) {
              // Table might not exist or not have groupId index - skip silently
              logger.info(`Skipping cleanup of ${table} table (may not exist or have groupId index)`)
            }
          }

          const updatedGroups = get().groups.filter(g => g.id !== groupId)
          const active = get().activeGroup

          set({
            groups: updatedGroups,
            activeGroup: active?.id === groupId ? null : active,
            isLoading: false,
          })

          logger.info(`Group ${groupId} and all related data deleted`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to delete group'
          set({ error: errorMsg, isLoading: false })
          throw error
        }
      },

      toggleModule: async (groupId, module) => {
        try {
          // SECURITY: Check if user has admin permission
          const { authorized, currentRole } = await checkGroupAuthorization(groupId, 'admin')
          if (!authorized) {
            throw new Error(`Unauthorized: only admins can toggle modules (your role: ${currentRole || 'not a member'})`)
          }

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

        // SECURITY: Check if inviter has appropriate permission
        // Admins can invite with any role, moderators can only invite members
        const requiredRole = (role === 'admin' || role === 'moderator') ? 'admin' : 'moderator'
        const { authorized, currentRole } = await checkGroupAuthorization(groupId, requiredRole)
        if (!authorized) {
          throw new Error(
            `Unauthorized: ${requiredRole}s or higher can create ${role} invitations (your role: ${currentRole || 'not a member'})`
          )
        }

        // SECURITY: Verify inviterPubkey matches current user
        const currentPubkey = getCurrentUserPubkey()
        if (inviterPubkey !== currentPubkey) {
          throw new Error('Unauthorized: cannot create invitations on behalf of another user')
        }

        // Generate unique invite code for link invites
        const code = !inviteePubkey
          ? bytesToHex(generateSecretKey()).slice(0, 16)
          : undefined

        const invitation: DBGroupInvitation = {
          id: `inv_${Date.now()}_${secureRandomString(9)}`,
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

        await dal.add('groupInvitations', invitation)

        // Update sent invitations list
        set(state => ({
          sentInvitations: [...state.sentInvitations, invitation]
        }))

        return invitation
      },

      loadPendingInvitations: async (userPubkey) => {
        try {
          const now = Date.now()
          const allInvitations = await dal.query<DBGroupInvitation>('groupInvitations', {
            whereClause: { inviteePubkey: userPubkey },
          })

          // Filter in JS for complex conditions
          const invitations = allInvitations.filter(
            inv => inv.status === 'pending' && (!inv.expiresAt || inv.expiresAt > now)
          )

          set({ pendingInvitations: invitations })
        } catch (error) {
          console.error('Failed to load pending invitations:', error)
        }
      },

      loadSentInvitations: async (userPubkey) => {
        try {
          const invitations = await dal.query<DBGroupInvitation>('groupInvitations', {
            whereClause: { inviterPubkey: userPubkey },
          })

          set({ sentInvitations: invitations })
        } catch (error) {
          console.error('Failed to load sent invitations:', error)
        }
      },

      acceptInvitation: async (invitationId, userPubkey) => {
        const invitation = await dal.get<DBGroupInvitation>('groupInvitations', invitationId)
        if (!invitation) throw new Error('Invitation not found')
        if (invitation.status !== 'pending') throw new Error('Invitation is no longer pending')
        if (invitation.expiresAt && invitation.expiresAt < Date.now()) {
          await dal.update('groupInvitations', invitationId, { status: 'expired' })
          throw new Error('Invitation has expired')
        }

        // Add user as group member
        await dal.add('groupMembers', {
          groupId: invitation.groupId,
          pubkey: userPubkey,
          role: invitation.role,
          joined: Date.now(),
        })

        // Update invitation status
        await dal.update('groupInvitations', invitationId, {
          status: 'accepted',
          acceptedAt: Date.now(),
        })

        // Get group name for notification
        const group = await dal.get<DBGroup>('groups', invitation.groupId)

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
        await dal.update('groupInvitations', invitationId, { status: 'declined' })
        set(state => ({
          pendingInvitations: state.pendingInvitations.filter(inv => inv.id !== invitationId)
        }))
      },

      revokeInvitation: async (invitationId) => {
        await dal.update('groupInvitations', invitationId, { status: 'revoked' })
        set(state => ({
          sentInvitations: state.sentInvitations.map(inv =>
            inv.id === invitationId ? { ...inv, status: 'revoked' as const } : inv
          )
        }))
      },

      // Member management
      updateMemberRole: async (groupId, memberPubkey, newRole) => {
        // SECURITY: Check if user has admin permission
        const { authorized, currentRole } = await checkGroupAuthorization(groupId, 'admin')
        if (!authorized) {
          throw new Error(`Unauthorized: only admins can change member roles (your role: ${currentRole || 'not a member'})`)
        }

        // SECURITY: Prevent admins from demoting themselves if they're the last admin
        const currentGroup = get().groups.find(g => g.id === groupId)
        const currentPubkey = getCurrentUserPubkey()
        if (currentGroup && memberPubkey === currentPubkey && newRole !== 'admin' && currentGroup.adminPubkeys.length === 1) {
          throw new Error('Cannot demote yourself: you are the last admin. Promote another admin first.')
        }

        const members = get().groupMembers.get(groupId) || []
        const member = members.find(m => m.pubkey === memberPubkey)
        if (!member || !member.id) throw new Error('Member not found')

        await dal.update('groupMembers', member.id, { role: newRole })

        // Update adminPubkeys in group if role changed to/from admin
        const groupToUpdate = get().groups.find(g => g.id === groupId)
        if (groupToUpdate) {
          let adminPubkeys = [...groupToUpdate.adminPubkeys]
          if (newRole === 'admin' && !adminPubkeys.includes(memberPubkey)) {
            adminPubkeys.push(memberPubkey)
          } else if (newRole !== 'admin' && adminPubkeys.includes(memberPubkey)) {
            adminPubkeys = adminPubkeys.filter(pk => pk !== memberPubkey)
          }
          if (adminPubkeys.length !== groupToUpdate.adminPubkeys.length) {
            await get().updateGroup(groupId, { adminPubkeys })
          }
        }

        // Reload members
        await get().loadGroupMembers(groupId)
      },

      removeMember: async (groupId, memberPubkey) => {
        // SECURITY: Check if user has admin permission
        const { authorized, currentRole } = await checkGroupAuthorization(groupId, 'admin')
        if (!authorized) {
          throw new Error(`Unauthorized: only admins can remove members (your role: ${currentRole || 'not a member'})`)
        }

        const members = get().groupMembers.get(groupId) || []
        const member = members.find(m => m.pubkey === memberPubkey)
        if (!member || !member.id) throw new Error('Member not found')

        // Check if this is the last admin
        const group = get().groups.find(g => g.id === groupId)
        if (group && group.adminPubkeys.includes(memberPubkey) && group.adminPubkeys.length === 1) {
          throw new Error('Cannot remove the last admin. Transfer admin role first.')
        }

        // SECURITY: Prevent admins from removing themselves (they should leave the group instead)
        const currentPubkey = getCurrentUserPubkey()
        if (memberPubkey === currentPubkey) {
          throw new Error('Cannot remove yourself. Use "Leave Group" instead.')
        }

        await dal.delete('groupMembers', member.id)

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
