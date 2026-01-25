import { create } from 'zustand'
import type { DirectMessage, Conversation } from '@/core/messaging/dm'
import type { GroupThread, GroupMessage } from '@/types/group'

interface MessagingState {
  // DM state
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Map<string, DirectMessage[]>

  // Group messaging state
  groupThreads: Map<string, GroupThread[]> // groupId -> threads[]
  activeThreadId: string | null
  threadMessages: Map<string, GroupMessage[]> // threadId -> messages[]

  // DM Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  setActiveConversation: (conversationId: string | null) => void
  addMessage: (message: DirectMessage) => void
  setMessages: (conversationId: string, messages: DirectMessage[]) => void
  getConversationMessages: (conversationId: string) => DirectMessage[]
  incrementUnread: (conversationId: string) => void
  markAsRead: (conversationId: string) => void

  // Group thread actions
  setGroupThreads: (groupId: string, threads: GroupThread[]) => void
  addGroupThread: (groupId: string, thread: GroupThread) => void
  setActiveThread: (threadId: string | null) => void
  addThreadMessage: (message: GroupMessage) => void
  setThreadMessages: (threadId: string, messages: GroupMessage[]) => void
  getThreadMessages: (threadId: string) => GroupMessage[]
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  // DM state
  conversations: [],
  activeConversationId: null,
  messages: new Map(),

  // Group messaging state
  groupThreads: new Map(),
  activeThreadId: null,
  threadMessages: new Map(),

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  setActiveConversation: (conversationId) =>
    set({ activeConversationId: conversationId }),

  addMessage: (message) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const conversationMessages = newMessages.get(message.conversationId) || []

      // Avoid duplicates
      if (!conversationMessages.find(m => m.id === message.id)) {
        conversationMessages.push(message)
        conversationMessages.sort((a, b) => a.timestamp - b.timestamp)
        newMessages.set(message.conversationId, conversationMessages)
      }

      // Update conversation's last message
      const conversations = state.conversations.map(conv => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            lastMessage: message,
            unreadCount: state.activeConversationId === conv.id ? 0 : conv.unreadCount + 1,
          }
        }
        return conv
      })

      return { messages: newMessages, conversations }
    }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      newMessages.set(conversationId, messages)
      return { messages: newMessages }
    }),

  getConversationMessages: (conversationId) => {
    return get().messages.get(conversationId) || []
  },

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, unreadCount: conv.unreadCount + 1 }
          : conv
      ),
    })),

  markAsRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ),
    })),

  // Group thread actions
  setGroupThreads: (groupId, threads) =>
    set((state) => {
      const newThreads = new Map(state.groupThreads)
      newThreads.set(groupId, threads)
      return { groupThreads: newThreads }
    }),

  addGroupThread: (groupId, thread) =>
    set((state) => {
      const newThreads = new Map(state.groupThreads)
      const threads = newThreads.get(groupId) || []
      newThreads.set(groupId, [thread, ...threads])
      return { groupThreads: newThreads }
    }),

  setActiveThread: (threadId) => set({ activeThreadId: threadId }),

  addThreadMessage: (message) =>
    set((state) => {
      const newMessages = new Map(state.threadMessages)
      const messages = newMessages.get(message.threadId) || []

      // Avoid duplicates
      if (!messages.find((m) => m.id === message.id)) {
        messages.push(message)
        messages.sort((a, b) => a.timestamp - b.timestamp)
        newMessages.set(message.threadId, messages)
      }

      // Update thread's last message time and count
      const newThreads = new Map(state.groupThreads)
      const groupThreads = newThreads.get(message.groupId)
      if (groupThreads) {
        const updatedThreads = groupThreads.map((thread) =>
          thread.id === message.threadId
            ? {
                ...thread,
                lastMessageAt: message.timestamp,
                messageCount: thread.messageCount + 1,
              }
            : thread
        )
        newThreads.set(message.groupId, updatedThreads)
      }

      return { threadMessages: newMessages, groupThreads: newThreads }
    }),

  setThreadMessages: (threadId, messages) =>
    set((state) => {
      const newMessages = new Map(state.threadMessages)
      newMessages.set(threadId, messages)
      return { threadMessages: newMessages }
    }),

  getThreadMessages: (threadId) => {
    return get().threadMessages.get(threadId) || []
  },
}))
