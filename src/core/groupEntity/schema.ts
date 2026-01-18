/**
 * Group Entity Database Schema
 * Tables for group identities, coalition chats, and role-based channels
 */

import type { Table } from 'dexie';
import type {
  DBGroupEntity,
  DBGroupEntityMessage,
  DBCoalition,
  DBChannel,
  DBSharedProject,
  DBSharedProjectInvitation,
} from './types';

/**
 * Group Entity Schema
 * Stores group Nostr identities and encrypted private keys
 */
export const GROUP_ENTITY_SCHEMA = {
  // Group entities (group Nostr identities)
  groupEntities: '++id, groupId, pubkey, createdBy, createdAt',

  // Group entity messages (audit log)
  groupEntityMessages: '++id, groupId, messageId, authorizedBy, authorizedAt, conversationId',

  // Coalitions (multi-group chats)
  coalitions: '++id, conversationId, createdBy, createdAt',

  // Role-based channels
  channels: '++id, groupId, conversationId, type, createdBy, createdAt',

  // Shared projects (cross-group collaboration)
  sharedProjects: '++id, type, itemId, ownerGroupId, status, createdBy, createdAt, updatedAt',

  // Shared project invitations (inviting groups to collaborate)
  sharedProjectInvitations: '++id, sharedProjectId, toGroupId, fromGroupId, status, sentAt, expiresAt',
};

/**
 * Type declarations for Dexie tables
 */
export interface GroupEntityTables {
  groupEntities: Table<DBGroupEntity, string>;
  groupEntityMessages: Table<DBGroupEntityMessage, string>;
  coalitions: Table<DBCoalition, string>;
  channels: Table<DBChannel, string>;
  sharedProjects: Table<DBSharedProject, string>;
  sharedProjectInvitations: Table<DBSharedProjectInvitation, string>;
}

/**
 * Seed Data
 */
export const GROUP_ENTITY_SEEDS = {
  groupEntities: [],
  groupEntityMessages: [],
  coalitions: [],
  channels: [],
  sharedProjects: [],
  sharedProjectInvitations: [],
};

/**
 * Organizing Templates
 * Pre-built message templates for common group entity use cases
 */
export const ORGANIZING_TEMPLATES = {
  // Anonymous Screening Template
  anonymousScreening: {
    name: 'Anonymous Member Screening',
    category: 'screening' as const,
    content: `Hello! This is the [Group Name] screening committee.

Thank you for your interest in joining our organization. We'd like to ask a few questions to better understand your background and interests.

Please tell us:
1. What brings you to our organization?
2. What skills or experience do you bring?
3. How did you hear about us?

All responses are kept confidential during the screening process.`,
  },

  // Coalition Announcement
  coalitionAnnouncement: {
    name: 'Coalition Action Announcement',
    category: 'action' as const,
    content: `[Coalition Name] - Joint Statement

We, the undersigned organizations, are coordinating on [action/campaign].

Next Steps:
- [Action item 1]
- [Action item 2]
- [Action item 3]

Participating Organizations:
[List will be auto-populated from coalition members]`,
  },

  // Official Group Statement
  officialStatement: {
    name: 'Official Group Statement',
    category: 'announcement' as const,
    content: `Official Statement from [Group Name]

[Date]

[Statement content]

This statement represents the collective position of [Group Name] as approved by our leadership team.

For media inquiries, contact: [contact info]`,
  },

  // Cross-Group Action Coordination
  crossGroupAction: {
    name: 'Cross-Group Action Coordination',
    category: 'action' as const,
    content: `Multi-Organization Action Plan

Action: [Action name]
Date: [Date/time]
Location: [Location]

Participating Organizations:
[Auto-populated from coalition]

Roles:
- [Organization 1]: [Role]
- [Organization 2]: [Role]

Next Steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Contact points will be shared separately through secure channels.`,
  },

  // Leadership Circle Communication
  leadershipCircle: {
    name: 'Leadership Circle - Strategic Discussion',
    category: 'general' as const,
    content: `Leadership Circle Discussion

Topic: [Topic]
Facilitator: [Name]

Agenda:
1. [Item 1]
2. [Item 2]
3. [Item 3]

Decision-making process: [Consensus / Majority vote / Other]

This conversation is restricted to the leadership circle. Please maintain confidentiality.`,
  },
};

