/**
 * ChatWindow
 * Individual chat window for desktop multi-window UI
 */

import { FC, useState, useEffect, useRef, CSSProperties } from 'react';
import { X, Minus, Send, Smile } from 'lucide-react';
import { useConversationsStore } from '../conversationsStore';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface ChatWindowProps {
  windowId: string;
  conversationId: string;
  style?: CSSProperties;
  className?: string;
}

export const ChatWindow: FC<ChatWindowProps> = ({
  windowId,
  conversationId,
  style,
  className,
}) => {
  const {
    getConversation,
    getConversationMessages,
    getConversationMembers,
    getPresence,
    sendMessage,
    loadMessages,
    markAsRead,
    closeChatWindow,
    minimizeChatWindow,
    focusChatWindow,
  } = useConversationsStore();

  const { currentIdentity } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = getConversation(conversationId);
  const messages = getConversationMessages(conversationId);
  const members = getConversationMembers(conversationId);

  useEffect(() => {
    // Load messages when window opens
    loadMessages(conversationId);
    markAsRead(conversationId);
  }, [conversationId, loadMessages, markAsRead]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) return null;

  // Get other participant (for DMs)
  const otherParticipant =
    conversation.type === 'dm'
      ? conversation.participants.find((p) => p !== currentIdentity?.publicKey)
      : null;
  const otherMember = otherParticipant
    ? members.find((m) => m.pubkey === otherParticipant)
    : null;

  const presence = otherParticipant ? getPresence(otherParticipant) : undefined;

  const displayName =
    conversation.name || otherMember?.nickname || otherParticipant?.substring(0, 8) || 'Chat';

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      await sendMessage(conversationId, messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPresenceColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-card border border-border rounded-t-lg shadow-lg pointer-events-auto',
        'w-80 h-96',
        className
      )}
      style={style}
      onClick={() => focusChatWindow(windowId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                {displayName[0].toUpperCase()}
              </div>
            </Avatar>
            {presence && (
              <div
                className={cn(
                  'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card',
                  getPresenceColor(presence.status)
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {presence?.customStatus && (
              <p className="text-xs text-muted-foreground truncate">{presence.customStatus}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => minimizeChatWindow(windowId)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => closeChatWindow(windowId)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((msg) => {
            const isOwn = msg.from === currentIdentity?.publicKey;
            const sender = members.find((m) => m.pubkey === msg.from);

            return (
              <div
                key={msg.id}
                className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}
              >
                {!isOwn && (
                  <Avatar className="h-6 w-6">
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs">
                      {sender?.nickname?.[0] || msg.from[0].toUpperCase()}
                    </div>
                  </Avatar>
                )}

                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {!isOwn && conversation.type !== 'dm' && (
                    <p className="text-xs font-medium mb-1 opacity-70">
                      {sender?.nickname || msg.from.substring(0, 8)}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  {msg.isEdited && (
                    <p className="text-xs opacity-50 mt-1">(edited)</p>
                  )}
                </div>

                {isOwn && (
                  <Avatar className="h-6 w-6">
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs">
                      {currentIdentity?.displayName?.[0] || currentIdentity?.publicKey[0]}
                    </div>
                  </Avatar>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Smile className="h-4 w-4" />
          </Button>
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 h-8 text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
