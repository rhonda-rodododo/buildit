/**
 * ContactCard Component
 * Displays a friend/contact with actions and metadata
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageCircle,
  MoreVertical,
  Star,
  StarOff,
  ShieldCheck,
  Trash2,
  Ban,
  Eye,
} from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import type { DBFriend, TrustTier } from '../types';

interface ContactCardProps {
  friend: DBFriend;
  onMessage?: () => void;
  onViewProfile?: () => void;
}

const TRUST_TIER_COLORS: Record<TrustTier, string> = {
  stranger: 'bg-gray-500',
  contact: 'bg-blue-500',
  friend: 'bg-green-500',
  verified: 'bg-purple-500',
  trusted: 'bg-yellow-500',
};

const TRUST_TIER_LABEL_KEYS: Record<TrustTier, string> = {
  stranger: 'contactCard.trustTiers.stranger',
  contact: 'contactCard.trustTiers.contact',
  friend: 'contactCard.trustTiers.friend',
  verified: 'contactCard.trustTiers.verified',
  trusted: 'contactCard.trustTiers.trusted',
};

export function ContactCard({ friend, onMessage, onViewProfile }: ContactCardProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { toggleFavorite, removeFriend, blockFriend } = useFriendsStore();

  const displayName = friend.displayName || friend.username || friend.friendPubkey.slice(0, 8);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleToggleFavorite = async () => {
    setIsLoading(true);
    try {
      await toggleFavorite(friend.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (confirm(t('contactCard.confirmRemove', { name: displayName }))) {
      setIsLoading(true);
      try {
        await removeFriend(friend.id);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBlock = async () => {
    if (confirm(t('contactCard.confirmBlock', { name: displayName }))) {
      setIsLoading(true);
      try {
        await blockFriend(friend.id);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{displayName}</h3>
              {friend.isFavorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
              {friend.verifiedInPerson && (
                <ShieldCheck className="h-4 w-4 text-green-500" aria-label={t('contactCard.verifiedInPerson')} />
              )}
            </div>

            {friend.username && friend.username !== displayName && (
              <p className="text-sm text-muted-foreground">@{friend.username}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge
                variant="secondary"
                className={`text-xs ${TRUST_TIER_COLORS[friend.trustTier]} text-white`}
              >
                {t(TRUST_TIER_LABEL_KEYS[friend.trustTier])}
              </Badge>
              {friend.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {friend.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{friend.tags.length - 3}
                </Badge>
              )}
            </div>

            {/* Notes preview */}
            {friend.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{friend.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onMessage}
              disabled={isLoading}
              title={t('contactCard.sendMessage')}
              data-testid="contact-message-button"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" disabled={isLoading}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onViewProfile}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('contactCard.viewProfile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleFavorite}>
                  {friend.isFavorite ? (
                    <>
                      <StarOff className="mr-2 h-4 w-4" />
                      {t('contactCard.removeFromFavorites')}
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-4 w-4" />
                      {t('contactCard.addToFavorites')}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleBlock} className="text-orange-600">
                  <Ban className="mr-2 h-4 w-4" />
                  {t('contactCard.blockContact')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('contactCard.removeContact')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
