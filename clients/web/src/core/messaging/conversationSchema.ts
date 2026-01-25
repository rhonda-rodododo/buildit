/**
 * Conversation System - Database Schema
 * Dexie table definitions for conversations
 */

import type { TableSchema } from '@/types/modules';
import type {
  DBConversation,
  ConversationMember,
  ConversationMessage,
  UserPresence,
  ChatWindow,
} from './conversationTypes';

/**
 * Database table interfaces for TypeScript
 */
export type {
  DBConversation,
  ConversationMember,
  ConversationMessage,
  UserPresence,
  ChatWindow,
};

/**
 * Dexie table definitions for conversation system
 */
export const conversationSchema: TableSchema[] = [
  {
    name: 'conversations',
    schema:
      'id, type, createdBy, createdAt, lastMessageAt, groupId, isPinned, isMuted, isArchived, *participants',
    indexes: [
      'id',
      'type', // Filter by conversation type
      'createdBy', // User's created conversations
      'createdAt', // Sort by creation date
      'lastMessageAt', // Sort by recent activity
      'groupId', // Query group-based conversations
      'isPinned', // Pinned conversations
      'isMuted', // Muted conversations
      'isArchived', // Archived conversations
      '*participants', // Multi-entry index for participant searches
    ],
  },
  {
    name: 'conversationMembers',
    schema: 'id, conversationId, pubkey, [conversationId+pubkey], role, joinedAt, lastReadAt',
    indexes: [
      'id',
      'conversationId', // All members of a conversation
      'pubkey', // All conversations for a user
      '[conversationId+pubkey]', // Unique constraint
      'role', // Filter by admin/member
      'joinedAt', // Sort by join date
      'lastReadAt', // Track read status
    ],
  },
  {
    name: 'conversationMessages',
    schema: 'id, conversationId, from, timestamp, replyTo, isEdited',
    indexes: [
      'id',
      'conversationId', // All messages in a conversation
      'from', // Messages from a user
      'timestamp', // Sort chronologically
      'replyTo', // Thread replies
      'isEdited', // Edited messages
    ],
  },
  {
    name: 'userPresence',
    schema: 'pubkey, status, lastSeen',
    indexes: ['pubkey', 'status', 'lastSeen'],
  },
  {
    name: 'chatWindows',
    schema: 'id, conversationId, isMinimized, zIndex',
    indexes: ['id', 'conversationId', 'isMinimized', 'zIndex'],
  },
];

/**
 * Indexes explanation:
 *
 * conversations:
 * - *participants: Multi-entry index for searching conversations by participant
 * - lastMessageAt: Sort conversations by most recent activity
 * - isPinned/isMuted/isArchived: Quick filters for UI
 * - groupId: Find all conversations for a group
 *
 * conversationMembers:
 * - [conversationId+pubkey]: Prevent duplicate memberships
 * - lastReadAt: Track unread status per member
 *
 * conversationMessages:
 * - conversationId + timestamp: Efficient message loading
 * - replyTo: Support threaded conversations
 *
 * userPresence:
 * - pubkey: Lookup presence for a user
 * - status: Query online/away/offline users
 * - lastSeen: Sort by recent activity
 *
 * chatWindows:
 * - conversationId: Find window for a conversation
 * - zIndex: Manage window stacking order
 */

/**
 * Migration functions for conversation system
 */
export const conversationMigrations = [
  {
    version: 1,
    description: 'Initialize conversation system schema',
    migrate: async (db: any) => {
      // Set default values
      await db.conversations.toCollection().modify((conv: DBConversation) => {
        conv.participants = conv.participants || [];
        conv.isPinned = conv.isPinned || false;
        conv.isMuted = conv.isMuted || false;
        conv.isArchived = conv.isArchived || false;
        conv.unreadCount = conv.unreadCount || 0;
      });
    },
  },
];

/**
 * Seed data for conversation system
 */
export const conversationSeeds = {
  conversations: [
    // Example DM conversation
    {
      id: 'conv-dm-seed-1',
      type: 'dm' as const,
      participants: ['test-user-alice', 'test-user-bob'],
      createdBy: 'test-user-alice',
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      lastMessageAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      lastMessagePreview: "Hey, are you coming to the meeting tomorrow?",
      isPinned: true,
      isMuted: false,
      isArchived: false,
      unreadCount: 0,
    },
    // Example group chat
    {
      id: 'conv-group-seed-1',
      type: 'group-chat' as const,
      name: 'Climate Action Planning',
      participants: ['test-user-alice', 'test-user-bob', 'test-user-charlie'],
      groupId: 'group-seed-1',
      createdBy: 'test-user-alice',
      createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
      lastMessageAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      lastMessagePreview: "Let's finalize the banner designs",
      isPinned: false,
      isMuted: false,
      isArchived: false,
      unreadCount: 3,
    },
  ],
  conversationMembers: [
    // Alice in DM with Bob
    {
      id: 'member-seed-1',
      conversationId: 'conv-dm-seed-1',
      pubkey: 'test-user-alice',
      joinedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      lastReadAt: Date.now() - 2 * 60 * 60 * 1000,
    },
    // Bob in DM with Alice
    {
      id: 'member-seed-2',
      conversationId: 'conv-dm-seed-1',
      pubkey: 'test-user-bob',
      joinedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      lastReadAt: Date.now() - 5 * 60 * 60 * 1000,
    },
    // Members in group chat
    {
      id: 'member-seed-3',
      conversationId: 'conv-group-seed-1',
      pubkey: 'test-user-alice',
      role: 'admin' as const,
      joinedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
      lastReadAt: Date.now() - 30 * 60 * 1000,
    },
    {
      id: 'member-seed-4',
      conversationId: 'conv-group-seed-1',
      pubkey: 'test-user-bob',
      role: 'member' as const,
      joinedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
      lastReadAt: Date.now() - 3 * 60 * 60 * 1000,
    },
    {
      id: 'member-seed-5',
      conversationId: 'conv-group-seed-1',
      pubkey: 'test-user-charlie',
      role: 'member' as const,
      joinedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
      lastReadAt: Date.now() - 6 * 60 * 60 * 1000,
    },
  ],
  userPresence: [
    {
      pubkey: 'test-user-alice',
      status: 'online' as const,
      lastSeen: Date.now(),
    },
    {
      pubkey: 'test-user-bob',
      status: 'away' as const,
      lastSeen: Date.now() - 10 * 60 * 1000, // 10 minutes ago
    },
    {
      pubkey: 'test-user-charlie',
      status: 'offline' as const,
      lastSeen: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    },
  ],
};
