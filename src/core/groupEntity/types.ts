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
 * Shared Project Types
 * Enable cross-group collaboration on specific items
 */

export type SharedProjectType = 'event' | 'campaign' | 'document' | 'mutual-aid-request';

export type GroupParticipantRole = 'contributor' | 'viewer';

export type SharedProjectStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface GroupParticipant {
  /** Participating group's ID */
  groupId: string;
  /** Who invited this group (pubkey) */
  invitedBy: string;
  /** When the group was invited */
  invitedAt: number;
  /** When the group accepted (null if pending) */
  joinedAt: number | null;
  /** Role in the shared project */
  role: GroupParticipantRole;
  /** Status of this group's participation */
  status: 'pending' | 'accepted' | 'declined';
}

export interface SharedPermissions {
  /** Can edit the shared item */
  canEdit: boolean;
  /** Can add comments/discussion */
  canComment: boolean;
  /** Can invite additional groups */
  canInvite: boolean;
  /** Can remove other groups (owner only typically) */
  canRemove: boolean;
  /** Can archive/complete the project */
  canArchive: boolean;
}

export interface SharedProject {
  id: string;
  /** Type of shared item */
  type: SharedProjectType;
  /** Reference to the shared item (e.g., eventId, documentId) */
  itemId: string;
  /** Group that owns/created the shared project */
  ownerGroupId: string;
  /** Name of the shared project */
  name: string;
  /** Description of collaboration purpose */
  description?: string;
  /** Participating groups */
  participantGroups: GroupParticipant[];
  /** Default permissions for new participants */
  defaultPermissions: SharedPermissions;
  /** Conversation ID for project discussion */
  conversationId?: string;
  /** Status of the shared project */
  status: SharedProjectStatus;
  /** Who created the shared project (pubkey) */
  createdBy: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface GroupInvitation {
  id: string;
  /** The shared project being invited to */
  sharedProjectId: string;
  /** Group receiving the invitation */
  toGroupId: string;
  /** Group sending the invitation */
  fromGroupId: string;
  /** Who sent the invitation (pubkey) */
  sentBy: string;
  /** When the invitation was sent */
  sentAt: number;
  /** Role being offered */
  role: GroupParticipantRole;
  /** Custom permissions (or use default) */
  permissions?: Partial<SharedPermissions>;
  /** Personal message with the invitation */
  message?: string;
  /** Invitation status */
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  /** When responded (if responded) */
  respondedAt?: number;
  /** Who responded (pubkey) */
  respondedBy?: string;
  /** Expiration timestamp (optional) */
  expiresAt?: number;
}

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

export interface DBSharedProject {
  id: string;
  type: SharedProjectType;
  itemId: string;
  ownerGroupId: string;
  name: string;
  description: string | null;
  participantGroups: string; // JSON.stringify(GroupParticipant[])
  defaultPermissions: string; // JSON.stringify(SharedPermissions)
  conversationId: string | null;
  status: SharedProjectStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface DBSharedProjectInvitation {
  id: string;
  sharedProjectId: string;
  toGroupId: string;
  fromGroupId: string;
  sentBy: string;
  sentAt: number;
  role: GroupParticipantRole;
  permissions: string | null; // JSON.stringify(Partial<SharedPermissions>)
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  respondedAt: number | null;
  respondedBy: string | null;
  expiresAt: number | null;
}
