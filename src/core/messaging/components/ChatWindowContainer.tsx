/**
 * ChatWindowContainer
 * Desktop: Manages multiple bottom-anchored chat windows (Discord/Facebook style)
 */

import { FC } from 'react';
import { useConversationsStore } from '../conversationsStore';
import { ChatWindow } from './ChatWindow';
import { ChatTaskbar } from './ChatTaskbar';
import { cn } from '@/lib/utils';

interface ChatWindowContainerProps {
  className?: string;
}

export const ChatWindowContainer: FC<ChatWindowContainerProps> = ({ className }) => {
  const { chatWindows } = useConversationsStore();

  const visibleWindows = chatWindows.filter((w) => !w.isMinimized);
  const minimizedWindows = chatWindows.filter((w) => w.isMinimized);

  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 pointer-events-none z-40',
        'hidden md:block', // Desktop only
        className
      )}
    >
      {/* Chat Windows - Bottom anchored */}
      <div className="flex items-end justify-end gap-2 p-4 pr-20">
        {visibleWindows
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((window) => (
            <ChatWindow
              key={window.id}
              windowId={window.id}
              conversationId={window.conversationId}
              style={{
                zIndex: window.zIndex,
              }}
            />
          ))}
      </div>

      {/* Chat Taskbar - Minimized chats */}
      {minimizedWindows.length > 0 && <ChatTaskbar windows={minimizedWindows} />}
    </div>
  );
};
