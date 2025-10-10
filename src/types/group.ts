export type GroupPrivacyLevel = 'public' | 'private' | 'secret'

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member'

export type GroupPermission =
  | 'invite_members'
  | 'remove_members'
  | 'edit_group'
  | 'post_messages'
  | 'create_events'
  | 'manage_events'
  | 'vote'
  | 'create_proposals'

export interface GroupMember {
  pubkey: string
  role: GroupRole
  joinedAt: number
  invitedBy?: string
  permissions?: GroupPermission[]
}

export interface Group {
  id: string // deterministic ID based on creation event
  name: string
  description: string
  picture?: string
  privacyLevel: GroupPrivacyLevel
  members: GroupMember[]
  createdBy: string
  createdAt: number

  // Optional metadata
  tags?: string[]
  website?: string
  location?: string

  // Plugin configuration
  enabledModules: GroupModule[]

  // Nostr event references
  creationEventId: string
  metadataEventId?: string
}

export type GroupModule =
  | 'custom-fields'
  | 'public'
  | 'messaging'
  | 'events'
  | 'mutual-aid'
  | 'governance'
  | 'wiki'
  | 'database'
  | 'crm'
  | 'documents'
  | 'files'
  | 'microblogging'
  | 'forms'
  | 'fundraising'

export interface GroupInvitation {
  id: string
  groupId: string
  invitedPubkey: string
  invitedBy: string
  message?: string
  createdAt: number
  expiresAt?: number
  status: 'pending' | 'accepted' | 'declined' | 'expired'
}

export interface GroupSettings {
  groupId: string

  // Discovery settings
  discoverable: boolean // Can be found in public search
  requireApproval: boolean // Require admin approval for join requests

  // Permission settings
  defaultRole: GroupRole
  defaultPermissions: GroupPermission[]

  // Messaging settings
  allowDirectMessages: boolean
  allowThreads: boolean

  // Module-specific settings
  moduleSettings: Record<GroupModule, Record<string, unknown>>
}

// Nostr event kinds for groups (using NIP-29 as reference)
export const GROUP_EVENT_KINDS = {
  // Group management
  CREATE_GROUP: 39000,
  METADATA: 39001,
  ADMINS: 39002,
  MEMBERS: 39003,

  // Group actions
  JOIN_REQUEST: 39004,
  LEAVE_GROUP: 39005,
  INVITATION: 39006,

  // Group content
  POST: 39007,
  REPLY: 39008,
  DELETE_POST: 39009,
} as const

export interface GroupCreationParams {
  name: string
  description: string
  privacyLevel: GroupPrivacyLevel
  picture?: string
  tags?: string[]
  enabledModules: GroupModule[]
  initialMembers?: string[] // Additional pubkeys to invite
}

export interface GroupUpdateParams {
  name?: string
  description?: string
  picture?: string
  tags?: string[]
  privacyLevel?: GroupPrivacyLevel
}

export interface GroupMemberUpdate {
  pubkey: string
  role?: GroupRole
  permissions?: GroupPermission[]
}

// Group messaging types
export interface GroupThread {
  id: string
  groupId: string
  title: string
  createdBy: string
  createdAt: number
  lastMessageAt: number
  messageCount: number
  category?: string
  pinned?: boolean
}

export interface GroupMessage {
  id: string
  threadId: string
  groupId: string
  from: string
  content: string
  timestamp: number
  replyTo?: string
  reactions?: Record<string, string[]> // emoji -> pubkeys[]
  edited?: boolean
  editedAt?: number
  deleted?: boolean
}
