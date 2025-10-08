import { FC, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { db } from '@/core/storage/db';
import type { DBIdentity } from '@/core/storage/db';

export type UserHandleFormat = '@username' | 'display-name' | 'full' | 'username-only';

export interface UserHandleProps {
  pubkey: string;
  showAvatar?: boolean;
  showBadge?: boolean; // Show NIP-05 verified badge
  format?: UserHandleFormat;
  className?: string;
  onClick?: () => void;
}

/**
 * UserHandle component - Display username/display name with optional avatar and badge
 *
 * Formats:
 * - '@username': Show @username (e.g., "@alice-organizer")
 * - 'display-name': Show display name or username (e.g., "Alice Martinez")
 * - 'full': Show display name + @username (e.g., "Alice Martinez @alice-organizer")
 * - 'username-only': Show just username without @ (e.g., "alice-organizer")
 */
export const UserHandle: FC<UserHandleProps> = ({
  pubkey,
  showAvatar = false,
  showBadge = true,
  format = '@username',
  className = '',
  onClick,
}) => {
  const [identity, setIdentity] = useState<DBIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIdentity = async () => {
      try {
        const id = await db.identities.get(pubkey);
        setIdentity(id || null);
      } catch (error) {
        console.error('Failed to load identity:', error);
      } finally {
        setLoading(false);
      }
    };

    loadIdentity();
  }, [pubkey]);

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {showAvatar && (
          <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
        )}
        <span className="h-4 w-24 bg-muted animate-pulse rounded" />
      </span>
    );
  }

  const username = identity?.username;
  const displayName = identity?.displayName;
  const nip05Verified = identity?.nip05Verified;

  // Fallback to truncated pubkey if no username/displayName
  const fallbackText = `${pubkey.slice(0, 8)}...`;

  // Format the display text based on format prop
  let displayText = fallbackText;

  if (format === '@username') {
    displayText = username ? `@${username}` : fallbackText;
  } else if (format === 'display-name') {
    displayText = displayName || username || fallbackText;
  } else if (format === 'full') {
    if (displayName && username) {
      displayText = `${displayName} @${username}`;
    } else if (displayName) {
      displayText = displayName;
    } else if (username) {
      displayText = `@${username}`;
    } else {
      displayText = fallbackText;
    }
  } else if (format === 'username-only') {
    displayText = username || fallbackText;
  }

  // Get initials for avatar
  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return pubkey.slice(0, 2).toUpperCase();
  };

  return (
    <span
      className={`inline-flex items-center gap-2 ${onClick ? 'cursor-pointer hover:underline' : ''} ${className}`}
      onClick={onClick}
    >
      {showAvatar && (
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
        </Avatar>
      )}
      <span className="font-medium">{displayText}</span>
      {showBadge && nip05Verified && (
        <Badge variant="default" className="h-4 bg-green-600 px-1">
          <ShieldCheck className="h-3 w-3" />
        </Badge>
      )}
    </span>
  );
};
