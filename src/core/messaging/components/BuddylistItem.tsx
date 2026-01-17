/**
 * BuddylistItem
 * Individual contact item in the buddylist
 */

import { FC, useMemo } from 'react';
import { Star } from 'lucide-react';
import type { UserPresence } from '../conversationTypes';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useConversationsStore } from '../conversationsStore';

interface BuddylistItemProps {
  pubkey: string;
  username?: string;
  displayName?: string;
  presence?: UserPresence;
  isFavorite?: boolean;
  unreadCount?: number;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
}

export const BuddylistItem: FC<BuddylistItemProps> = ({
  pubkey,
  username,
  displayName,
  presence,
  isFavorite,
  unreadCount,
  onClick,
  className,
  'data-testid': dataTestId,
}) => {
  const { getDirectConversation, getUnreadCount } = useConversationsStore();

  const conversation = getDirectConversation(pubkey);
  const actualUnreadCount = conversation ? getUnreadCount(conversation.id) : unreadCount || 0;

  const name = displayName || username || pubkey.substring(0, 8);

  const getPresenceColor = () => {
    switch (presence?.status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const presenceText = useMemo(() => {
    if (!presence) return 'Offline';
    if (presence.status === 'online') return 'Online';
    if (presence.status === 'away') return 'Away';
    if (presence.lastSeen) {
      const diff = Date.now() - presence.lastSeen;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    }
    return 'Offline';
  }, [presence]);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md',
        'hover:bg-muted/70 transition-colors text-left',
        'group',
        className
      )}
      data-testid={dataTestId}
    >
      {/* Avatar with presence indicator */}
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {name[0].toUpperCase()}
          </div>
        </Avatar>
        <div
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card',
            getPresenceColor()
          )}
          data-testid={`presence-indicator-${presence?.status || 'offline'}`}
        />
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{name}</p>
          {isFavorite && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground truncate" data-testid="last-seen">
          {presence?.customStatus || presenceText}
        </p>
      </div>

      {/* Unread badge */}
      {actualUnreadCount > 0 && (
        <Badge variant="destructive" className="h-5 px-1.5 text-xs shrink-0" data-testid="unread-badge">
          {actualUnreadCount > 99 ? '99+' : actualUnreadCount}
        </Badge>
      )}
    </button>
  );
};
