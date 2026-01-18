/**
 * Conversations Store
 * Zustand store for managing conversations, messages, and presence
 *
 * IMPORTANT: Messages are E2E encrypted using NIP-17 (gift-wrapped DMs)
 * - DMs: Single gift wrap per recipient
 * - Group chats: Multiple gift wraps (one per participant)
 */

import { create } from 'zustand';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import { createPrivateDM, createGroupMessage } from '@/core/crypto/nip17';
import { getNostrClient } from '@/core/nostr/client';
import { secureRandomString } from '@/lib/utils';
import type { GiftWrap } from '@/types/nostr';
import type {
  DBConversation,
  ConversationMember,
  ConversationMessage,
  UserPresence,
  ChatWindow,
  ConversationType,
  PresenceStatus,
} from './conversationTypes';

// Filters and utilities
export interface ConversationFilter {
  type?: ConversationType[];
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  hasUnread?: boolean;
  groupId?: string;
  searchQuery?: string;
}

export interface ConversationStats {
  total: number;
  dms: number;
  groupChats: number;
  multiParty: number;
  pinned: number;
  muted: number;
  archived: number;
  unread: number;
}

interface ConversationsState {
  // State
  conversations: DBConversation[];
  conversationMembers: ConversationMember[];
  messages: ConversationMessage[];
  presence: Map<string, UserPresence>;
  chatWindows: ChatWindow[];
  isLoading: boolean;
  currentConversationId?: string;

  // Actions - Conversations
  createConversation: (
    type: ConversationType,
    participants: string[],
    name?: string,
    groupId?: string
  ) => Promise<DBConversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  pinConversation: (conversationId: string) => Promise<void>;
  unpinConversation: (conversationId: string) => Promise<void>;
  muteConversation: (conversationId: string) => Promise<void>;
  unmuteConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  unarchiveConversation: (conversationId: string) => Promise<void>;
  updateConversationName: (conversationId: string, name: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;

  // Actions - Members
  addMember: (conversationId: string, pubkey: string, role?: 'admin' | 'member') => Promise<void>;
  removeMember: (conversationId: string, pubkey: string) => Promise<void>;
  updateMemberRole: (conversationId: string, pubkey: string, role: 'admin' | 'member') => Promise<void>;
  updateLastRead: (conversationId: string) => Promise<void>;

  // Actions - Messages
  sendMessage: (conversationId: string, content: string, replyTo?: string) => Promise<ConversationMessage>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  loadMessages: (conversationId: string, limit?: number) => Promise<void>;

  // Actions - Presence
  updatePresence: (status: PresenceStatus, customStatus?: string) => Promise<void>;
  refreshPresence: (pubkeys: string[]) => Promise<void>;
  getPresence: (pubkey: string) => UserPresence | undefined;

  // Actions - Chat Windows (Desktop)
  openChatWindow: (conversationId: string) => void;
  closeChatWindow: (windowId: string) => void;
  minimizeChatWindow: (windowId: string) => void;
  restoreChatWindow: (windowId: string) => void;
  focusChatWindow: (windowId: string) => void;
  updateWindowPosition: (windowId: string, position: { x: number; y: number }) => void;

  // Queries
  getConversation: (conversationId: string) => DBConversation | undefined;
  getConversations: (filter?: ConversationFilter) => DBConversation[];
  getConversationMembers: (conversationId: string) => ConversationMember[];
  getConversationMessages: (conversationId: string) => ConversationMessage[];
  getDirectConversation: (otherPubkey: string) => DBConversation | undefined;
  getConversationStats: () => ConversationStats;
  getUnreadCount: (conversationId: string) => number;
  getTotalUnreadCount: () => number;

  // Utility
  loadConversations: () => Promise<void>;
  setCurrentConversation: (conversationId?: string) => void;
  getCurrentConversation: () => DBConversation | undefined;
  refreshConversations: () => Promise<void>;
  clearCache: () => void;
}

export const useConversationsStore = create<ConversationsState>()(
  (set, get) => ({
    // Initial state
      conversations: [],
      conversationMembers: [],
      messages: [],
      presence: new Map(),
      chatWindows: [],
      isLoading: false,
      currentConversationId: undefined,

      // Create conversation
      createConversation: async (
        type: ConversationType,
        participants: string[],
        name?: string,
        groupId?: string
      ): Promise<DBConversation> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        const now = Date.now();

        // For DMs, check if conversation already exists
        if (type === 'dm' && participants.length === 2) {
          const existing = get()
            .conversations.find(
              (c) =>
                c.type === 'dm' &&
                c.participants.length === 2 &&
                c.participants.includes(currentIdentity.publicKey) &&
                c.participants.includes(participants.find((p) => p !== currentIdentity.publicKey)!)
            );
          if (existing) return existing;
        }

        const conversation: DBConversation = {
          id: `conv-${Date.now()}-${secureRandomString(9)}`,
          type,
          name,
          participants: [...new Set([currentIdentity.publicKey, ...participants])], // Dedupe
          groupId,
          createdBy: currentIdentity.publicKey,
          createdAt: now,
          lastMessageAt: now,
          isPinned: false,
          isMuted: false,
          isArchived: false,
          unreadCount: 0,
        };

        // Create conversation members
        const members: ConversationMember[] = conversation.participants.map((pubkey) => ({
          id: `member-${conversation.id}-${pubkey}`,
          conversationId: conversation.id,
          pubkey,
          role: pubkey === currentIdentity.publicKey ? 'admin' : 'member',
          joinedAt: now,
          lastReadAt: now,
        }));

        try {
          await db.conversations.add(conversation);
          await db.conversationMembers.bulkAdd(members);
        } catch (error) {
          console.error('Failed to create conversation:', error);
          throw error;
        }

        set((state) => ({
          conversations: [...state.conversations, conversation],
          conversationMembers: [...state.conversationMembers, ...members],
        }));

        return conversation;
      },

      // Delete conversation
      deleteConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.delete(conversationId);
          await db.conversationMembers.where('conversationId').equals(conversationId).delete();
          await db.conversationMessages.where('conversationId').equals(conversationId).delete();
        } catch (error) {
          console.error('Failed to delete conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          conversationMembers: state.conversationMembers.filter((m) => m.conversationId !== conversationId),
          messages: state.messages.filter((m) => m.conversationId !== conversationId),
        }));
      },

      // Pin conversation
      pinConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isPinned: true });
        } catch (error) {
          console.error('Failed to pin conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isPinned: true } : c
          ),
        }));
      },

      // Unpin conversation
      unpinConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isPinned: false });
        } catch (error) {
          console.error('Failed to unpin conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isPinned: false } : c
          ),
        }));
      },

      // Mute conversation
      muteConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isMuted: true });
        } catch (error) {
          console.error('Failed to mute conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isMuted: true } : c
          ),
        }));
      },

      // Unmute conversation
      unmuteConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isMuted: false });
        } catch (error) {
          console.error('Failed to unmute conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isMuted: false } : c
          ),
        }));
      },

      // Archive conversation
      archiveConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isArchived: true });
        } catch (error) {
          console.error('Failed to archive conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isArchived: true } : c
          ),
        }));
      },

      // Unarchive conversation
      unarchiveConversation: async (conversationId: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { isArchived: false });
        } catch (error) {
          console.error('Failed to unarchive conversation:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isArchived: false } : c
          ),
        }));
      },

      // Update conversation name
      updateConversationName: async (conversationId: string, name: string): Promise<void> => {
        try {
          await db.conversations.update(conversationId, { name });
        } catch (error) {
          console.error('Failed to update conversation name:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, name } : c
          ),
        }));
      },

      // Mark as read
      markAsRead: async (conversationId: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        const now = Date.now();

        try {
          // Update conversation unread count
          await db.conversations.update(conversationId, { unreadCount: 0 });

          // Update member's lastReadAt
          const member = await db.conversationMembers
            .where('[conversationId+pubkey]')
            .equals([conversationId, currentIdentity.publicKey])
            .first();

          if (member) {
            await db.conversationMembers.update(member.id, { lastReadAt: now });
          }
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          ),
          conversationMembers: state.conversationMembers.map((m) =>
            m.conversationId === conversationId && m.pubkey === currentIdentity.publicKey
              ? { ...m, lastReadAt: now }
              : m
          ),
        }));
      },

      // Add member
      addMember: async (
        conversationId: string,
        pubkey: string,
        role: 'admin' | 'member' = 'member'
      ): Promise<void> => {
        const conv = get().getConversation(conversationId);
        if (!conv) return;

        const member: ConversationMember = {
          id: `member-${conversationId}-${pubkey}`,
          conversationId,
          pubkey,
          role,
          joinedAt: Date.now(),
          lastReadAt: Date.now(),
        };

        try {
          await db.conversations.update(conversationId, {
            participants: [...conv.participants, pubkey],
          });
          await db.conversationMembers.add(member);
        } catch (error) {
          console.error('Failed to add member:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, participants: [...c.participants, pubkey] } : c
          ),
          conversationMembers: [...state.conversationMembers, member],
        }));
      },

      // Remove member
      removeMember: async (conversationId: string, pubkey: string): Promise<void> => {
        const conv = get().getConversation(conversationId);
        if (!conv) return;

        try {
          await db.conversations.update(conversationId, {
            participants: conv.participants.filter((p) => p !== pubkey),
          });
          await db.conversationMembers
            .where('[conversationId+pubkey]')
            .equals([conversationId, pubkey])
            .delete();
        } catch (error) {
          console.error('Failed to remove member:', error);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, participants: c.participants.filter((p) => p !== pubkey) } : c
          ),
          conversationMembers: state.conversationMembers.filter(
            (m) => !(m.conversationId === conversationId && m.pubkey === pubkey)
          ),
        }));
      },

      // Update member role
      updateMemberRole: async (
        conversationId: string,
        pubkey: string,
        role: 'admin' | 'member'
      ): Promise<void> => {
        try {
          const member = await db.conversationMembers
            .where('[conversationId+pubkey]')
            .equals([conversationId, pubkey])
            .first();

          if (member) {
            await db.conversationMembers.update(member.id, { role });
          }
        } catch (error) {
          console.error('Failed to update member role:', error);
        }

        set((state) => ({
          conversationMembers: state.conversationMembers.map((m) =>
            m.conversationId === conversationId && m.pubkey === pubkey ? { ...m, role } : m
          ),
        }));
      },

      // Update last read timestamp
      updateLastRead: async (conversationId: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        const now = Date.now();

        try {
          const member = await db.conversationMembers
            .where('[conversationId+pubkey]')
            .equals([conversationId, currentIdentity.publicKey])
            .first();

          if (member) {
            await db.conversationMembers.update(member.id, { lastReadAt: now });
          }
        } catch (error) {
          console.error('Failed to update last read:', error);
        }

        set((state) => ({
          conversationMembers: state.conversationMembers.map((m) =>
            m.conversationId === conversationId && m.pubkey === currentIdentity.publicKey
              ? { ...m, lastReadAt: now }
              : m
          ),
        }));
      },

      // Send message
      sendMessage: async (
        conversationId: string,
        content: string,
        replyTo?: string
      ): Promise<ConversationMessage> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) throw new Error('Not authenticated');

        const privateKey = getCurrentPrivateKey();
        if (!privateKey) throw new Error('App is locked');

        const conversation = get().getConversation(conversationId);
        if (!conversation) throw new Error('Conversation not found');

        const now = Date.now();

        const message: ConversationMessage = {
          id: `msg-${Date.now()}-${secureRandomString(9)}`,
          conversationId,
          from: currentIdentity.publicKey,
          content,
          timestamp: now,
          replyTo,
          isEdited: false,
          reactions: {},
        };

        // Store locally first (encrypted by Dexie hooks)
        try {
          await db.conversationMessages.add(message);
          await db.conversations.update(conversationId, {
            lastMessageAt: now,
            lastMessagePreview: content.substring(0, 100),
          });
        } catch (error) {
          console.error('Failed to store message locally:', error);
          throw error;
        }

        // Update Zustand state
        set((state) => ({
          messages: [...state.messages, message],
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageAt: now,
                  lastMessagePreview: content.substring(0, 100),
                }
              : c
          ),
        }));

        // Create NIP-17 gift-wrapped events and publish to Nostr
        try {
          const client = getNostrClient();

          // Build tags for the message
          const tags: string[][] = [
            ['conversation', conversationId], // Custom tag for conversation threading
          ];
          if (replyTo) {
            tags.push(['e', replyTo, '', 'reply']); // Reply tag
          }

          // Get recipients (all participants except self)
          const recipients = conversation.participants.filter(
            (p) => p !== currentIdentity.publicKey
          );

          if (recipients.length === 0) {
            // Self-conversation or no recipients, skip relay publish
            return message;
          }

          let giftWraps: GiftWrap[];

          if (conversation.type === 'dm' && recipients.length === 1) {
            // DM: Single gift wrap for the recipient
            const giftWrap = createPrivateDM(
              content,
              privateKey,
              recipients[0],
              tags
            );
            giftWraps = [giftWrap];
          } else {
            // Group chat: Multiple gift wraps (one per participant)
            giftWraps = createGroupMessage(
              content,
              privateKey,
              recipients,
              tags
            );
          }

          // Publish all gift wraps to relays
          const publishResults = await Promise.all(
            giftWraps.map((gw) => client.publish(gw))
          );

          // Log any publish failures
          const failures = publishResults.flat().filter((r) => !r.success);
          if (failures.length > 0) {
            console.warn('Some relays failed to receive message:', failures);
            // Message is still stored locally, will retry on next sync
          }
        } catch (error) {
          console.error('Failed to publish message to Nostr:', error);
          // Message is stored locally, will be queued for retry
          // TODO: Add to offline queue for later retry
        }

        return message;
      },

      // Edit message
      editMessage: async (messageId: string, newContent: string): Promise<void> => {
        const now = Date.now();

        try {
          await db.conversationMessages.update(messageId, {
            content: newContent,
            isEdited: true,
            editedAt: now,
          });
        } catch (error) {
          console.error('Failed to edit message:', error);
        }

        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? { ...m, content: newContent, isEdited: true, editedAt: now }
              : m
          ),
        }));
      },

      // Delete message
      deleteMessage: async (messageId: string): Promise<void> => {
        try {
          await db.conversationMessages.delete(messageId);
        } catch (error) {
          console.error('Failed to delete message:', error);
        }

        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId),
        }));
      },

      // Add reaction
      addReaction: async (messageId: string, emoji: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        const message = get().messages.find((m) => m.id === messageId);
        if (!message) return;

        const updatedReactions = { ...message.reactions };
        if (!updatedReactions[emoji]) {
          updatedReactions[emoji] = [];
        }
        if (!updatedReactions[emoji].includes(currentIdentity.publicKey)) {
          updatedReactions[emoji].push(currentIdentity.publicKey);
        }

        try {
          await db.conversationMessages.update(messageId, { reactions: updatedReactions });
        } catch (error) {
          console.error('Failed to add reaction:', error);
        }

        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, reactions: updatedReactions } : m
          ),
        }));
      },

      // Remove reaction
      removeReaction: async (messageId: string, emoji: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        const message = get().messages.find((m) => m.id === messageId);
        if (!message) return;

        const updatedReactions = { ...message.reactions };
        if (updatedReactions[emoji]) {
          updatedReactions[emoji] = updatedReactions[emoji].filter(
            (p) => p !== currentIdentity.publicKey
          );
          if (updatedReactions[emoji].length === 0) {
            delete updatedReactions[emoji];
          }
        }

        try {
          await db.conversationMessages.update(messageId, { reactions: updatedReactions });
        } catch (error) {
          console.error('Failed to remove reaction:', error);
        }

        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, reactions: updatedReactions } : m
          ),
        }));
      },

      // Load messages for a conversation
      loadMessages: async (conversationId: string, limit: number = 50): Promise<void> => {
        try {
          const messages = await db.conversationMessages
            .where('conversationId')
            .equals(conversationId)
            .limit(limit)
            .toArray();

          set((state) => ({
            messages: [
              ...state.messages.filter((m) => m.conversationId !== conversationId),
              ...messages,
            ],
          }));
        } catch (error) {
          console.error('Failed to load messages:', error);
        }
      },

      // Update user presence
      updatePresence: async (status: PresenceStatus, customStatus?: string): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        const presence: UserPresence = {
          pubkey: currentIdentity.publicKey,
          status,
          lastSeen: Date.now(),
          customStatus,
        };

        try {
          await db.userPresence.put(presence);
        } catch (error) {
          console.error('Failed to update presence:', error);
        }

        set((state) => {
          const newPresence = new Map(state.presence);
          newPresence.set(currentIdentity.publicKey, presence);
          return { presence: newPresence };
        });

        // TODO: Broadcast presence update via Nostr
      },

      // Refresh presence for multiple users
      refreshPresence: async (pubkeys: string[]): Promise<void> => {
        try {
          const presenceData = await db.userPresence.where('pubkey').anyOf(pubkeys).toArray();

          set((state) => {
            const newPresence = new Map(state.presence);
            presenceData.forEach((p) => newPresence.set(p.pubkey, p));
            return { presence: newPresence };
          });
        } catch (error) {
          console.error('Failed to refresh presence:', error);
        }

        // TODO: Query presence from Nostr
      },

      // Get presence for a user
      getPresence: (pubkey: string): UserPresence | undefined => {
        return get().presence.get(pubkey);
      },

      // Open chat window (desktop)
      openChatWindow: (conversationId: string): void => {
        const windows = get().chatWindows;
        const existingWindow = windows.find((w) => w.conversationId === conversationId);

        if (existingWindow) {
          // Window exists, restore and focus
          get().restoreChatWindow(existingWindow.id);
          get().focusChatWindow(existingWindow.id);
          return;
        }

        // Max 3 windows
        if (windows.filter((w) => !w.isMinimized).length >= 3) {
          // Close oldest non-minimized window
          const oldestWindow = windows
            .filter((w) => !w.isMinimized)
            .sort((a, b) => a.zIndex - b.zIndex)[0];
          if (oldestWindow) {
            get().closeChatWindow(oldestWindow.id);
          }
        }

        const newWindow: ChatWindow = {
          id: `window-${Date.now()}-${secureRandomString(9)}`,
          conversationId,
          isMinimized: false,
          position: { x: 100 + windows.length * 30, y: 100 + windows.length * 30 },
          size: { width: 320, height: 400 },
          zIndex: Math.max(...windows.map((w) => w.zIndex), 0) + 1,
        };

        set((state) => ({
          chatWindows: [...state.chatWindows, newWindow],
        }));
      },

      // Close chat window
      closeChatWindow: (windowId: string): void => {
        set((state) => ({
          chatWindows: state.chatWindows.filter((w) => w.id !== windowId),
        }));
      },

      // Minimize chat window
      minimizeChatWindow: (windowId: string): void => {
        set((state) => ({
          chatWindows: state.chatWindows.map((w) =>
            w.id === windowId ? { ...w, isMinimized: true } : w
          ),
        }));
      },

      // Restore chat window
      restoreChatWindow: (windowId: string): void => {
        set((state) => ({
          chatWindows: state.chatWindows.map((w) =>
            w.id === windowId ? { ...w, isMinimized: false } : w
          ),
        }));
      },

      // Focus chat window (bring to front)
      focusChatWindow: (windowId: string): void => {
        const maxZ = Math.max(...get().chatWindows.map((w) => w.zIndex), 0);
        set((state) => ({
          chatWindows: state.chatWindows.map((w) =>
            w.id === windowId ? { ...w, zIndex: maxZ + 1 } : w
          ),
        }));
      },

      // Update window position
      updateWindowPosition: (windowId: string, position: { x: number; y: number }): void => {
        set((state) => ({
          chatWindows: state.chatWindows.map((w) => (w.id === windowId ? { ...w, position } : w)),
        }));
      },

      // Get conversation by ID
      getConversation: (conversationId: string): DBConversation | undefined => {
        return get().conversations.find((c) => c.id === conversationId);
      },

      // Get conversations with filter
      getConversations: (filter?: ConversationFilter): DBConversation[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        let filtered = get().conversations.filter((c) =>
          c.participants.includes(currentIdentity.publicKey)
        );

        if (!filter) return filtered.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

        // Filter by type
        if (filter.type?.length) {
          filtered = filtered.filter((c) => filter.type?.includes(c.type));
        }

        // Filter by pinned
        if (filter.isPinned !== undefined) {
          filtered = filtered.filter((c) => c.isPinned === filter.isPinned);
        }

        // Filter by muted
        if (filter.isMuted !== undefined) {
          filtered = filtered.filter((c) => c.isMuted === filter.isMuted);
        }

        // Filter by archived
        if (filter.isArchived !== undefined) {
          filtered = filtered.filter((c) => c.isArchived === filter.isArchived);
        }

        // Filter by unread
        if (filter.hasUnread !== undefined) {
          filtered = filtered.filter((c) => (c.unreadCount > 0) === filter.hasUnread);
        }

        // Filter by group
        if (filter.groupId) {
          filtered = filtered.filter((c) => c.groupId === filter.groupId);
        }

        // Search query
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          filtered = filtered.filter((c) => c.name?.toLowerCase().includes(query));
        }

        // Sort: pinned first, then by last message
        return filtered.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastMessageAt - a.lastMessageAt;
        });
      },

      // Get conversation members
      getConversationMembers: (conversationId: string): ConversationMember[] => {
        return get().conversationMembers.filter((m) => m.conversationId === conversationId);
      },

      // Get conversation messages
      getConversationMessages: (conversationId: string): ConversationMessage[] => {
        return get()
          .messages.filter((m) => m.conversationId === conversationId)
          .sort((a, b) => a.timestamp - b.timestamp);
      },

      // Get direct conversation with another user
      getDirectConversation: (otherPubkey: string): DBConversation | undefined => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return undefined;

        return get().conversations.find(
          (c) =>
            c.type === 'dm' &&
            c.participants.length === 2 &&
            c.participants.includes(currentIdentity.publicKey) &&
            c.participants.includes(otherPubkey)
        );
      },

      // Get conversation statistics
      getConversationStats: (): ConversationStats => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity)
          return { total: 0, dms: 0, groupChats: 0, multiParty: 0, pinned: 0, muted: 0, archived: 0, unread: 0 };

        const conversations = get().conversations.filter((c) =>
          c.participants.includes(currentIdentity.publicKey)
        );

        return {
          total: conversations.length,
          dms: conversations.filter((c) => c.type === 'dm').length,
          groupChats: conversations.filter((c) => c.type === 'group-chat').length,
          multiParty: conversations.filter((c) => c.type === 'multi-party').length,
          pinned: conversations.filter((c) => c.isPinned).length,
          muted: conversations.filter((c) => c.isMuted).length,
          archived: conversations.filter((c) => c.isArchived).length,
          unread: conversations.filter((c) => c.unreadCount > 0).length,
        };
      },

      // Get unread count for a conversation
      getUnreadCount: (conversationId: string): number => {
        const conv = get().getConversation(conversationId);
        return conv?.unreadCount || 0;
      },

      // Get total unread count
      getTotalUnreadCount: (): number => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return 0;

        return get()
          .conversations.filter((c) => c.participants.includes(currentIdentity.publicKey))
          .reduce((sum, c) => sum + c.unreadCount, 0);
      },

      // Load conversations from database
      loadConversations: async (): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        set({ isLoading: true });

        try {
          // Load conversations where user is a participant
          const conversations = await db.conversations
            .where('*participants')
            .equals(currentIdentity.publicKey)
            .toArray();

          const conversationIds = conversations.map((c) => c.id);

          const members = await db.conversationMembers
            .where('conversationId')
            .anyOf(conversationIds)
            .toArray();

          const presenceData = await db.userPresence.toArray();
          const presenceMap = new Map<string, UserPresence>();
          presenceData.forEach((p) => presenceMap.set(p.pubkey, p));

          set({
            conversations,
            conversationMembers: members,
            presence: presenceMap,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to load conversations:', error);
          set({ isLoading: false });
        }
      },

      // Set current conversation
      setCurrentConversation: (conversationId?: string): void => {
        set({ currentConversationId: conversationId });
      },

      // Get current conversation
      getCurrentConversation: (): DBConversation | undefined => {
        const id = get().currentConversationId;
        return id ? get().getConversation(id) : undefined;
      },

      // Refresh conversations
      refreshConversations: async (): Promise<void> => {
        await get().loadConversations();
      },

      // Clear cache
      clearCache: (): void => {
        set({
          conversations: [],
          conversationMembers: [],
          messages: [],
          presence: new Map(),
          chatWindows: [],
          currentConversationId: undefined,
        });
      },
    })
);
