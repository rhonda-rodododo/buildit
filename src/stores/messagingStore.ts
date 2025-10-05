import { create } from 'zustand'
import type { DirectMessage, Conversation } from '@/core/messaging/dm'

interface MessagingState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Map<string, DirectMessage[]>

  // Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  setActiveConversation: (conversationId: string | null) => void
  addMessage: (message: DirectMessage) => void
  setMessages: (conversationId: string, messages: DirectMessage[]) => void
  getConversationMessages: (conversationId: string) => DirectMessage[]
  incrementUnread: (conversationId: string) => void
  markAsRead: (conversationId: string) => void
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),

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
}))
