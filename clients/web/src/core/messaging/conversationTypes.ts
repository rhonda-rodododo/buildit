/**
 * Conversation System Types
 * Unified conversation model for DMs, group chats, and coalition chats
 */

/**
 * Conversation type
 * - dm: 1:1 direct message
 * - group-chat: Multi-user chat within a group context
 * - multi-party: Cross-group or ad-hoc multi-user chat (coalitions)
 */
export type ConversationType = 'dm' | 'group-chat' | 'multi-party';

/**
 * Database schema for conversations
 */
export interface DBConversation {
  id: string;
  type: ConversationType;
  name?: string; // Optional custom name (required for multi-party)
  participants: string[]; // Array of pubkeys
  groupId?: string; // If conversation is group-based
  isGroupEntity?: boolean; // If group is messaging as entity (Epic 43)
  createdBy: string; // Pubkey of creator
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview?: string; // Preview of last message
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  unreadCount: number;
}

/**
 * Conversation member metadata
 */
export interface ConversationMember {
  id: string; // Unique identifier for the member record
  conversationId: string;
  pubkey: string;
  role?: 'admin' | 'member'; // For multi-party chats
  joinedAt: number;
  lastReadAt: number; // Timestamp of last read message
  nickname?: string; // Custom nickname in this conversation
}

/**
 * Message within a conversation
 */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  from: string; // Sender pubkey
  content: string;
  timestamp: number;
  replyTo?: string; // Reply to message ID
  isEdited: boolean;
  editedAt?: number;
  reactions: Record<string, string[]>; // emoji -> pubkeys
  attachments?: MessageAttachment[];
}

/**
 * Message attachment (for future file support)
 */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

/**
 * Online presence status
 */
export type PresenceStatus = 'online' | 'away' | 'offline';

/**
 * User presence information
 */
export interface UserPresence {
  pubkey: string;
  status: PresenceStatus;
  lastSeen: number;
  customStatus?: string; // Custom status message
}

/**
 * Chat window state (for desktop multi-window UI)
 */
export interface ChatWindow {
  id: string;
  conversationId: string;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}
