/**
 * ChatTaskbar
 * Shows minimized chat windows at the bottom right
 */

import { FC } from 'react';
import { X } from 'lucide-react';
import { useConversationsStore } from '../conversationsStore';
import type { ChatWindow } from '../conversationTypes';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatTaskbarProps {
  windows: ChatWindow[];
  className?: string;
}

export const ChatTaskbar: FC<ChatTaskbarProps> = ({ windows, className }) => {
  const {
    getConversation,
    getUnreadCount,
    restoreChatWindow,
    closeChatWindow,
  } = useConversationsStore();

  return (
    <div
      className={cn(
        'fixed bottom-4 right-20 flex items-center gap-2 pointer-events-auto',
        className
      )}
    >
      {windows.map((window) => {
        const conversation = getConversation(window.conversationId);
        const unreadCount = getUnreadCount(window.conversationId);

        if (!conversation) return null;

        const displayName = conversation.name || conversation.participants[0]?.substring(0, 8) || 'Chat';

        return (
          <div
            key={window.id}
            className="relative group"
          >
            <button
              onClick={() => restoreChatWindow(window.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg',
                'hover:bg-muted transition-colors shadow-md',
                'max-w-[200px]'
              )}
              data-testid="chat-taskbar-item"
            >
              <Avatar className="h-6 w-6 shrink-0">
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs">
                  {displayName[0].toUpperCase()}
                </div>
              </Avatar>
              <span className="text-sm font-medium truncate flex-1">{displayName}</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs shrink-0" data-testid="chat-taskbar-badge">
                  {unreadCount}
                </Badge>
              )}
            </button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'absolute -top-2 -right-2 h-5 w-5 rounded-full shadow-sm',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'bg-background border border-border'
              )}
              onClick={(e) => {
                e.stopPropagation();
                closeChatWindow(window.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
