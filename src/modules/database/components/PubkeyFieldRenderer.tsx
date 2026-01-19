/**
 * Pubkey Field Renderer
 * Display a Nostr pubkey as a user profile with actions
 */

import { useMemo, useState } from 'react';
import { useFriendsStore } from '@/modules/friends/friendsStore';
import { useContactsStore } from '@/stores/contactsStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PubkeyFieldRendererProps {
  pubkey: string | null | undefined;
  displayFormat?: 'name' | 'avatar_only' | 'name_with_avatar' | 'full';
  onStartDM?: (pubkey: string) => void;
  onViewProfile?: (pubkey: string) => void;
  showActions?: boolean;
  className?: string;
}

interface UserInfo {
  pubkey: string;
  displayName: string;
  username?: string;
  picture?: string;
  nip05?: string;
  isFriend: boolean;
}

export function PubkeyFieldRenderer({
  pubkey,
  displayFormat = 'name_with_avatar',
  onStartDM,
  onViewProfile,
  showActions = true,
  className,
}: PubkeyFieldRendererProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Get friends from store
  const friends = useFriendsStore((s) => s.friends);

  // Get profile metadata from contacts store
  const profiles = useContactsStore((s) => s.profiles);

  // Get user info
  const userInfo = useMemo((): UserInfo | null => {
    if (!pubkey) return null;

    const profile = profiles.get(pubkey);
    const friend = Array.from(friends.values()).find(
      (f) => f.friendPubkey === pubkey
    );

    return {
      pubkey,
      displayName:
        friend?.displayName ||
        profile?.name ||
        profile?.display_name ||
        pubkey.slice(0, 8) + '...',
      username: profile?.nip05,
      picture: profile?.picture,
      nip05: profile?.nip05,
      isFriend: !!friend,
    };
  }, [pubkey, friends, profiles]);

  const handleCopy = async () => {
    if (!pubkey) return;
    await navigator.clipboard.writeText(pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!pubkey || !userInfo) {
    return (
      <span className={cn('text-muted-foreground italic text-sm', className)}>
        {t('common.notSet', 'Not set')}
      </span>
    );
  }

  // Render based on display format
  const renderDisplay = () => {
    switch (displayFormat) {
      case 'avatar_only':
        return (
          <Avatar className="h-6 w-6">
            <AvatarImage src={userInfo.picture} />
            <AvatarFallback>
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
        );

      case 'name':
        return <span className="text-sm">{userInfo.displayName}</span>;

      case 'name_with_avatar':
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={userInfo.picture} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{userInfo.displayName}</span>
          </div>
        );

      case 'full':
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={userInfo.picture} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{userInfo.displayName}</span>
              {userInfo.nip05 && (
                <span className="text-xs text-muted-foreground">
                  {userInfo.nip05}
                </span>
              )}
            </div>
          </div>
        );
    }
  };

  if (!showActions) {
    return (
      <div className={cn('inline-flex items-center', className)}>
        {renderDisplay()}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5',
            'hover:bg-muted transition-colors cursor-pointer',
            className
          )}
        >
          {renderDisplay()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-3">
          {/* User info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userInfo.picture} />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{userInfo.displayName}</div>
              {userInfo.nip05 && (
                <div className="text-xs text-muted-foreground truncate">
                  {userInfo.nip05}
                </div>
              )}
              <div className="text-xs text-muted-foreground truncate font-mono">
                {pubkey.slice(0, 16)}...
              </div>
            </div>
          </div>

          {/* Status badges */}
          {userInfo.isFriend && (
            <div className="text-xs text-green-600 dark:text-green-400">
              ✓ {t('common.friend', 'Friend')}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1">
            {onStartDM && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartDM(pubkey)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {t('common.message', 'Message')}
              </Button>
            )}
            {onViewProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewProfile(pubkey)}
              >
                <User className="h-3 w-3 mr-1" />
                {t('common.profile', 'Profile')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  {t('common.copied', 'Copied')}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  {t('common.copy', 'Copy')}
                </>
              )}
            </Button>
          </div>

          {/* External link */}
          <a
            href={`https://njump.me/${pubkey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            {t('common.viewOnNostr', 'View on Nostr')}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default PubkeyFieldRenderer;
