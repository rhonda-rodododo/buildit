/**
 * MessagingStore Tests
 * Tests for DM and group thread messaging state management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMessagingStore } from '../messagingStore';
import type { DirectMessage, Conversation } from '@/core/messaging/dm';
import type { GroupThread, GroupMessage } from '@/types/group';

describe('messagingStore', () => {
  beforeEach(() => {
    // Reset store state
    useMessagingStore.setState({
      conversations: [],
      activeConversationId: null,
      messages: new Map(),
      groupThreads: new Map(),
      activeThreadId: null,
      threadMessages: new Map(),
    });
  });

  describe('DM Conversations', () => {
    const mockConversation: Conversation = {
      id: 'conv-1',
      participantPubkeys: ['pubkey1', 'pubkey2'],
      unreadCount: 0,
      lastUpdated: Date.now(),
    };

    describe('setConversations', () => {
      it('should set conversations', () => {
        const { setConversations } = useMessagingStore.getState();
        const conversations = [mockConversation];

        setConversations(conversations);

        const { conversations: result } = useMessagingStore.getState();
        expect(result).toEqual(conversations);
      });
    });

    describe('addConversation', () => {
      it('should add a conversation to the beginning', () => {
        const { setConversations, addConversation } = useMessagingStore.getState();
        setConversations([mockConversation]);

        const newConv: Conversation = {
          id: 'conv-2',
          participantPubkeys: ['pubkey3', 'pubkey4'],
          unreadCount: 1,
          lastUpdated: Date.now(),
        };
        addConversation(newConv);

        const { conversations } = useMessagingStore.getState();
        expect(conversations).toHaveLength(2);
        expect(conversations[0].id).toBe('conv-2');
        expect(conversations[1].id).toBe('conv-1');
      });
    });

    describe('setActiveConversation', () => {
      it('should set active conversation ID', () => {
        const { setActiveConversation } = useMessagingStore.getState();

        setActiveConversation('conv-1');

        const { activeConversationId } = useMessagingStore.getState();
        expect(activeConversationId).toBe('conv-1');
      });

      it('should clear active conversation when null', () => {
        const { setActiveConversation } = useMessagingStore.getState();
        setActiveConversation('conv-1');
        setActiveConversation(null);

        const { activeConversationId } = useMessagingStore.getState();
        expect(activeConversationId).toBeNull();
      });
    });
  });

  describe('DM Messages', () => {
    const mockMessage: DirectMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderPubkey: 'pubkey1',
      content: 'Hello',
      timestamp: 1000,
      status: 'sent',
    };

    beforeEach(() => {
      const conversation: Conversation = {
        id: 'conv-1',
        participantPubkeys: ['pubkey1', 'pubkey2'],
        unreadCount: 0,
        lastUpdated: Date.now(),
      };
      useMessagingStore.getState().setConversations([conversation]);
    });

    describe('addMessage', () => {
      it('should add a message to the conversation', () => {
        const { addMessage, getConversationMessages } = useMessagingStore.getState();

        addMessage(mockMessage);

        const messages = getConversationMessages('conv-1');
        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual(mockMessage);
      });

      it('should not add duplicate messages', () => {
        const { addMessage, getConversationMessages } = useMessagingStore.getState();

        addMessage(mockMessage);
        addMessage(mockMessage);

        const messages = getConversationMessages('conv-1');
        expect(messages).toHaveLength(1);
      });

      it('should sort messages by timestamp', () => {
        const { addMessage, getConversationMessages } = useMessagingStore.getState();

        const msg2: DirectMessage = { ...mockMessage, id: 'msg-2', timestamp: 500 };
        const msg3: DirectMessage = { ...mockMessage, id: 'msg-3', timestamp: 1500 };

        addMessage(mockMessage); // timestamp 1000
        addMessage(msg3); // timestamp 1500
        addMessage(msg2); // timestamp 500

        const messages = getConversationMessages('conv-1');
        expect(messages[0].id).toBe('msg-2');
        expect(messages[1].id).toBe('msg-1');
        expect(messages[2].id).toBe('msg-3');
      });

      it('should update conversation lastMessage', () => {
        const { addMessage } = useMessagingStore.getState();

        addMessage(mockMessage);

        const { conversations } = useMessagingStore.getState();
        expect(conversations[0].lastMessage).toEqual(mockMessage);
      });

      it('should increment unread when not active conversation', () => {
        const { addMessage, setActiveConversation } = useMessagingStore.getState();
        setActiveConversation('conv-other');

        addMessage(mockMessage);

        const { conversations } = useMessagingStore.getState();
        expect(conversations[0].unreadCount).toBe(1);
      });

      it('should not increment unread when active conversation', () => {
        const { addMessage, setActiveConversation } = useMessagingStore.getState();
        setActiveConversation('conv-1');

        addMessage(mockMessage);

        const { conversations } = useMessagingStore.getState();
        expect(conversations[0].unreadCount).toBe(0);
      });
    });

    describe('setMessages', () => {
      it('should set messages for a conversation', () => {
        const { setMessages, getConversationMessages } = useMessagingStore.getState();

        const messages = [mockMessage, { ...mockMessage, id: 'msg-2' }];
        setMessages('conv-1', messages);

        const result = getConversationMessages('conv-1');
        expect(result).toHaveLength(2);
      });
    });

    describe('getConversationMessages', () => {
      it('should return empty array for non-existent conversation', () => {
        const { getConversationMessages } = useMessagingStore.getState();

        const messages = getConversationMessages('non-existent');
        expect(messages).toEqual([]);
      });
    });

    describe('incrementUnread', () => {
      it('should increment unread count', () => {
        const { incrementUnread } = useMessagingStore.getState();

        incrementUnread('conv-1');
        incrementUnread('conv-1');

        const { conversations } = useMessagingStore.getState();
        expect(conversations[0].unreadCount).toBe(2);
      });
    });

    describe('markAsRead', () => {
      it('should mark conversation as read', () => {
        const { incrementUnread, markAsRead } = useMessagingStore.getState();

        incrementUnread('conv-1');
        incrementUnread('conv-1');
        markAsRead('conv-1');

        const { conversations } = useMessagingStore.getState();
        expect(conversations[0].unreadCount).toBe(0);
      });
    });
  });

  describe('Group Threads', () => {
    const mockThread: GroupThread = {
      id: 'thread-1',
      groupId: 'group-1',
      title: 'Test Thread',
      createdBy: 'pubkey1',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 0,
    };

    describe('setGroupThreads', () => {
      it('should set threads for a group', () => {
        const { setGroupThreads } = useMessagingStore.getState();

        setGroupThreads('group-1', [mockThread]);

        const { groupThreads } = useMessagingStore.getState();
        expect(groupThreads.get('group-1')).toHaveLength(1);
      });
    });

    describe('addGroupThread', () => {
      it('should add a thread to the beginning', () => {
        const { setGroupThreads, addGroupThread } = useMessagingStore.getState();
        setGroupThreads('group-1', [mockThread]);

        const newThread: GroupThread = { ...mockThread, id: 'thread-2', title: 'New Thread' };
        addGroupThread('group-1', newThread);

        const { groupThreads } = useMessagingStore.getState();
        const threads = groupThreads.get('group-1');
        expect(threads).toHaveLength(2);
        expect(threads![0].id).toBe('thread-2');
      });

      it('should create new array if group has no threads', () => {
        const { addGroupThread } = useMessagingStore.getState();

        addGroupThread('new-group', mockThread);

        const { groupThreads } = useMessagingStore.getState();
        expect(groupThreads.get('new-group')).toHaveLength(1);
      });
    });

    describe('setActiveThread', () => {
      it('should set active thread ID', () => {
        const { setActiveThread } = useMessagingStore.getState();

        setActiveThread('thread-1');

        const { activeThreadId } = useMessagingStore.getState();
        expect(activeThreadId).toBe('thread-1');
      });
    });
  });

  describe('Thread Messages', () => {
    const mockGroupMessage: GroupMessage = {
      id: 'gmsg-1',
      threadId: 'thread-1',
      groupId: 'group-1',
      senderPubkey: 'pubkey1',
      content: 'Hello group',
      timestamp: 1000,
    };

    beforeEach(() => {
      const thread: GroupThread = {
        id: 'thread-1',
        groupId: 'group-1',
        title: 'Test Thread',
        createdBy: 'pubkey1',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        messageCount: 0,
      };
      useMessagingStore.getState().setGroupThreads('group-1', [thread]);
    });

    describe('addThreadMessage', () => {
      it('should add a message to the thread', () => {
        const { addThreadMessage, getThreadMessages } = useMessagingStore.getState();

        addThreadMessage(mockGroupMessage);

        const messages = getThreadMessages('thread-1');
        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual(mockGroupMessage);
      });

      it('should not add duplicate messages', () => {
        const { addThreadMessage, getThreadMessages } = useMessagingStore.getState();

        addThreadMessage(mockGroupMessage);
        addThreadMessage(mockGroupMessage);

        const messages = getThreadMessages('thread-1');
        expect(messages).toHaveLength(1);
      });

      it('should sort messages by timestamp', () => {
        const { addThreadMessage, getThreadMessages } = useMessagingStore.getState();

        const msg2: GroupMessage = { ...mockGroupMessage, id: 'gmsg-2', timestamp: 500 };
        const msg3: GroupMessage = { ...mockGroupMessage, id: 'gmsg-3', timestamp: 1500 };

        addThreadMessage(mockGroupMessage);
        addThreadMessage(msg3);
        addThreadMessage(msg2);

        const messages = getThreadMessages('thread-1');
        expect(messages[0].id).toBe('gmsg-2');
        expect(messages[1].id).toBe('gmsg-1');
        expect(messages[2].id).toBe('gmsg-3');
      });

      it('should update thread lastMessageAt and messageCount', () => {
        const { addThreadMessage } = useMessagingStore.getState();

        addThreadMessage(mockGroupMessage);

        const { groupThreads } = useMessagingStore.getState();
        const thread = groupThreads.get('group-1')![0];
        expect(thread.lastMessageAt).toBe(mockGroupMessage.timestamp);
        expect(thread.messageCount).toBe(1);
      });
    });

    describe('setThreadMessages', () => {
      it('should set messages for a thread', () => {
        const { setThreadMessages, getThreadMessages } = useMessagingStore.getState();

        const messages = [mockGroupMessage, { ...mockGroupMessage, id: 'gmsg-2' }];
        setThreadMessages('thread-1', messages);

        const result = getThreadMessages('thread-1');
        expect(result).toHaveLength(2);
      });
    });

    describe('getThreadMessages', () => {
      it('should return empty array for non-existent thread', () => {
        const { getThreadMessages } = useMessagingStore.getState();

        const messages = getThreadMessages('non-existent');
        expect(messages).toEqual([]);
      });
    });
  });
});
