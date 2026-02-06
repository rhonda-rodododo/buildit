import { type Event as NostrEvent } from 'nostr-tools'
import { createEventFromTemplate } from '@/core/nostr/nip01'
import { NostrClient } from '@/core/nostr/client'
import type {
  Group,
  GroupCreationParams,
  GroupMember,
  GroupPermission,
  GroupRole,
} from '@/types/group'
import { generateEventId } from '@/lib/utils'

/**
 * Create a new group
 */
export async function createGroup(
  client: NostrClient,
  params: GroupCreationParams,
  creatorPrivateKey: Uint8Array
): Promise<Group> {
  const now = Math.floor(Date.now() / 1000)

  // Create the group metadata event
  const groupMetadata = {
    name: params.name,
    description: params.description,
    picture: params.picture,
    tags: params.tags,
    privacyLevel: params.privacyLevel,
    enabledModules: params.enabledModules,
  }

  // Create group creation event (kind 39000)
  const creationEvent = createEventFromTemplate(
    {
      kind: 39000, // CREATE_GROUP
      content: JSON.stringify(groupMetadata),
      tags: [
        ['d', generateEventId()], // Unique group identifier
        ['name', params.name],
        ['privacy', params.privacyLevel],
        ...params.enabledModules.map(module => ['module', module]),
      ],
      created_at: now,
    },
    creatorPrivateKey
  )

  // Publish the creation event
  await client.publish(creationEvent)

  // Get creator's public key
  const creatorPubkey = creationEvent.pubkey

  // Create initial members list (creator + invited members)
  const members: GroupMember[] = [
    {
      _v: '1.0.0',
      pubkey: creatorPubkey,
      role: 'owner',
      joinedAt: now,
    },
  ]

  // Create the group object
  const group: Group = {
    _v: '1.0.0',
    id: creationEvent.id,
    name: params.name,
    description: params.description,
    picture: params.picture,
    privacyLevel: params.privacyLevel,
    members,
    createdBy: creatorPubkey,
    createdAt: now,
    tags: params.tags,
    enabledModules: params.enabledModules,
    creationEventId: creationEvent.id,
  }

  // If there are initial members to invite, send invitations
  if (params.initialMembers && params.initialMembers.length > 0) {
    for (const memberPubkey of params.initialMembers) {
      await inviteToGroup(client, group.id, memberPubkey, creatorPrivateKey)
    }
  }

  return group
}

/**
 * Invite a user to a group
 */
export async function inviteToGroup(
  client: NostrClient,
  groupId: string,
  invitedPubkey: string,
  inviterPrivateKey: Uint8Array,
  message?: string
): Promise<NostrEvent> {
  const now = Math.floor(Date.now() / 1000)

  const invitationEvent = createEventFromTemplate(
    {
      kind: 39006, // INVITATION
      content: message || `You've been invited to join this group`,
      tags: [
        ['d', groupId],
        ['p', invitedPubkey],
        ['group', groupId],
      ],
      created_at: now,
    },
    inviterPrivateKey
  )

  await client.publish(invitationEvent)
  return invitationEvent
}

/**
 * Accept a group invitation
 */
export async function acceptInvitation(
  client: NostrClient,
  groupId: string,
  invitationEventId: string,
  userPrivateKey: Uint8Array
): Promise<NostrEvent> {
  const now = Math.floor(Date.now() / 1000)

  const joinEvent = createEventFromTemplate(
    {
      kind: 39004, // JOIN_REQUEST (also used for accepting invitations)
      content: 'Accepted invitation',
      tags: [
        ['d', groupId],
        ['e', invitationEventId],
        ['group', groupId],
      ],
      created_at: now,
    },
    userPrivateKey
  )

  await client.publish(joinEvent)
  return joinEvent
}

/**
 * Leave a group
 */
export async function leaveGroup(
  client: NostrClient,
  groupId: string,
  userPrivateKey: Uint8Array,
  reason?: string
): Promise<NostrEvent> {
  const now = Math.floor(Date.now() / 1000)

  const leaveEvent = createEventFromTemplate(
    {
      kind: 39005, // LEAVE_GROUP
      content: reason || 'Left the group',
      tags: [
        ['d', groupId],
        ['group', groupId],
      ],
      created_at: now,
    },
    userPrivateKey
  )

  await client.publish(leaveEvent)
  return leaveEvent
}

/**
 * Update group metadata (admin only)
 */
export async function updateGroupMetadata(
  client: NostrClient,
  groupId: string,
  updates: {
    name?: string
    description?: string
    picture?: string
    tags?: string[]
  },
  adminPrivateKey: Uint8Array
): Promise<NostrEvent> {
  const now = Math.floor(Date.now() / 1000)

  const metadataEvent = createEventFromTemplate(
    {
      kind: 39001, // METADATA
      content: JSON.stringify(updates),
      tags: [
        ['d', groupId],
        ['group', groupId],
      ],
      created_at: now,
    },
    adminPrivateKey
  )

  await client.publish(metadataEvent)
  return metadataEvent
}

/**
 * Update member role (admin only)
 */
export async function updateMemberRole(
  client: NostrClient,
  groupId: string,
  memberPubkey: string,
  newRole: GroupRole,
  adminPrivateKey: Uint8Array
): Promise<NostrEvent> {
  const now = Math.floor(Date.now() / 1000)

  const roleUpdateEvent = createEventFromTemplate(
    {
      kind: 39002, // ADMINS (role management)
      content: JSON.stringify({ role: newRole }),
      tags: [
        ['d', groupId],
        ['p', memberPubkey],
        ['group', groupId],
        ['role', newRole],
      ],
      created_at: now,
    },
    adminPrivateKey
  )

  await client.publish(roleUpdateEvent)
  return roleUpdateEvent
}

/**
 * Get all groups a user is a member of
 */
export async function getUserGroups(
  client: NostrClient,
  userPubkey: string
): Promise<Group[]> {
  // Query for group creation events where user is tagged
  const events = await client.query([
    {
      kinds: [39000], // CREATE_GROUP
      '#p': [userPubkey],
    },
  ])

  const groups: Group[] = []

  for (const event of events) {
    try {
      const metadata = JSON.parse(event.content)

      const group: Group = {
        _v: '1.0.0',
        id: event.id,
        name: metadata.name,
        description: metadata.description,
        picture: metadata.picture,
        privacyLevel: metadata.privacyLevel || 'private',
        members: [], // Will be populated by querying member events
        createdBy: event.pubkey,
        createdAt: event.created_at,
        tags: metadata.tags,
        enabledModules: metadata.enabledModules || ['messaging'],
        creationEventId: event.id,
      }

      groups.push(group)
    } catch (error) {
      console.error('Failed to parse group event:', error)
    }
  }

  return groups
}

/**
 * Get group members
 */
export async function getGroupMembers(
  client: NostrClient,
  groupId: string
): Promise<GroupMember[]> {
  // Query for member-related events
  const [joinEvents, roleEvents] = await Promise.all([
    client.query([
      {
        kinds: [39004], // JOIN_REQUEST
        '#d': [groupId],
      },
    ]),
    client.query([
      {
        kinds: [39002], // ADMINS/role updates
        '#d': [groupId],
      },
    ]),
  ])

  const membersMap = new Map<string, GroupMember>()

  // Process join events
  for (const event of joinEvents) {
    if (!membersMap.has(event.pubkey)) {
      membersMap.set(event.pubkey, {
        _v: '1.0.0',
        pubkey: event.pubkey,
        role: 'member',
        joinedAt: event.created_at,
      })
    }
  }

  // Process role updates
  for (const event of roleEvents) {
    const memberPubkey = event.tags.find(t => t[0] === 'p')?.[1]
    const role = event.tags.find(t => t[0] === 'role')?.[1] as GroupRole

    if (memberPubkey && role) {
      const member = membersMap.get(memberPubkey)
      if (member) {
        member.role = role
      }
    }
  }

  return Array.from(membersMap.values())
}

/**
 * Check if user has permission in a group
 */
export function hasPermission(
  member: GroupMember,
  permission: GroupPermission
): boolean {
  // Owner has all permissions
  if (member.role === 'owner') return true

  // Admin has most permissions
  if (member.role === 'admin') {
    return permission !== 'remove_members' // Admins can't remove owner
  }

  // Check specific permissions
  return member.permissions?.includes(permission) || false
}
