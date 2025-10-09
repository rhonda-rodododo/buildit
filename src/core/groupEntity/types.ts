/**
 * Group Entity Types
 * Enables groups to message as collective identities
 */

export interface GroupEntity {
  groupId: string;
  pubkey: string; // Group's public Nostr key
  createdAt: number;
  createdBy: string; // Admin who created entity
  settings: GroupEntitySettings;
}

export interface GroupEntitySettings {
  /** Who can speak as group */
  speakerPermission: 'admins-only' | 'all-members' | 'consensus';

  /** Require approval before posting as group */
  requireApproval: boolean;

  /** Approvers (pubkeys) - for consensus mode */
  approvers?: string[];

  /** Minimum approvals needed (for consensus mode) */
  minApprovals?: number;

  /** Message templates */
  templates: MessageTemplate[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: 'announcement' | 'screening' | 'action' | 'general';
  createdBy: string;
  createdAt: number;
}

export interface GroupEntityMessage {
  id: string;
  groupId: string;
  messageId: string; // Nostr event ID
  content: string;
  authorizedBy: string; // Admin who authorized/sent
  authorizedAt: number;
  approved?: boolean;
  approvers?: string[]; // For consensus mode
  conversationId?: string; // If part of conversation
  metadata?: {
    recipientGroups?: string[]; // For coalition messages
    channels?: string[]; // For role-based channels
  };
}

export interface Coalition {
  id: string;
  name: string;
  description?: string;
  groupIds: string[]; // Participating groups
  individualPubkeys: string[]; // Individual participants
  conversationId: string;
  createdBy: string;
  createdAt: number;
  settings: CoalitionSettings;
}

export interface CoalitionSettings {
  /** Allow cross-posting to member group feeds */
  allowCrossPosting: boolean;

  /** Voting threshold for coalition decisions */
  votingThreshold: number; // 0.5 = simple majority

  /** Role permissions */
  permissions: CoalitionPermissions;
}

export interface CoalitionPermissions {
  whoCanPost: 'group-admins' | 'group-members' | 'all-participants';
  whoCanInvite: 'founders' | 'all-groups' | 'consensus';
  whoCanRemove: 'founders' | 'all-groups' | 'consensus';
}

export interface Channel {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  type: 'admin-only' | 'member' | 'public' | 'role-based';
  conversationId: string;
  permissions: ChannelPermissions;
  createdBy: string;
  createdAt: number;
}

export interface ChannelPermissions {
  /** Roles that can read */
  canRead: GroupRole[];

  /** Roles that can post */
  canPost: GroupRole[];

  /** Roles that can invite */
  canInvite: GroupRole[];

  /** Roles that can manage (edit/delete) */
  canManage: GroupRole[];
}

export type GroupRole = 'admin' | 'moderator' | 'member' | 'read-only';

/**
 * Database Schema
 */
export interface DBGroupEntity {
  id: string;
  groupId: string;
  pubkey: string;
  encryptedPrivateKey: string; // AES-256-GCM encrypted with group master key
  iv: string; // Initialization vector for decryption
  createdAt: number;
  createdBy: string;
  settings: string; // JSON.stringify(GroupEntitySettings)
}

export interface DBGroupEntityMessage {
  id: string;
  groupId: string;
  messageId: string;
  content: string;
  authorizedBy: string;
  authorizedAt: number;
  approved: number; // 0 or 1 (boolean)
  approvers: string; // JSON.stringify(string[])
  conversationId: string | null;
  metadata: string | null; // JSON.stringify
}

export interface DBCoalition {
  id: string;
  name: string;
  description: string | null;
  groupIds: string; // JSON.stringify(string[])
  individualPubkeys: string; // JSON.stringify(string[])
  conversationId: string;
  createdBy: string;
  createdAt: number;
  settings: string; // JSON.stringify(CoalitionSettings)
}

export interface DBChannel {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  type: 'admin-only' | 'member' | 'public' | 'role-based';
  conversationId: string;
  permissions: string; // JSON.stringify(ChannelPermissions)
  createdBy: string;
  createdAt: number;
}
