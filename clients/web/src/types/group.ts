/**
 * Group Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (GroupCreationParams, GroupUpdateParams, GroupMemberUpdate) are defined here.
 */

// Re-export all generated Zod schemas and types
export {
  GroupPrivacyLevelSchema,
  type GroupPrivacyLevel,
  GroupRoleSchema,
  type GroupRole,
  GroupPermissionSchema,
  type GroupPermission,
  GroupModuleSchema,
  type GroupModule,
  GroupMemberSchema,
  type GroupMember,
  GroupSchema,
  type Group,
  GroupInvitationSchema,
  type GroupInvitation,
  GroupSettingsSchema,
  type GroupSettings,
  GroupThreadSchema,
  type GroupThread,
  GroupMessageSchema,
  type GroupMessage,
  GROUPS_SCHEMA_VERSION,
} from '@/generated/validation/groups.zod';

// ── Constants ────────────────────────────────────────────────────

import type { GroupPrivacyLevel, GroupModule, GroupRole, GroupPermission } from '@/generated/validation/groups.zod';

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

// ── UI-Only Types ────────────────────────────────────────────────

export interface GroupCreationParams {
  name: string
  description: string
  privacyLevel: GroupPrivacyLevel
  picture?: string
  tags?: string[]
  enabledModules: GroupModule[]
  initialMembers?: string[] // Additional pubkeys to invite

  // Template support
  templateId?: string // Template used to create this group
  templateEnhancements?: string[] // Enhancement IDs that were enabled
  includeDemoData?: boolean // Whether to seed demo data

  // Module configurations from template
  moduleConfigs?: Record<GroupModule, Record<string, unknown>>

  // Sub-templates to apply (for modules like CRM)
  subTemplates?: Record<GroupModule, string>
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
