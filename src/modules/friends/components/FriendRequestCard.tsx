/**
 * FriendRequestCard Component
 * Displays a pending friend request with accept/decline actions
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, QrCode, Mail, Link as LinkIcon, User } from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import type { FriendRequest } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface FriendRequestCardProps {
  request: FriendRequest;
  type: 'incoming' | 'outgoing';
}

const METHOD_ICONS = {
  qr: QrCode,
  username: User,
  email: Mail,
  'invite-link': LinkIcon,
};

const METHOD_LABELS = {
  qr: 'QR Code',
  username: 'Username Search',
  email: 'Email Invite',
  'invite-link': 'Invite Link',
};

export function FriendRequestCard({ request, type }: FriendRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { acceptFriendRequest, declineFriendRequest } = useFriendsStore();

  const displayName = request.fromUsername || request.fromPubkey.slice(0, 8);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const MethodIcon = METHOD_ICONS[request.method];

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await acceptFriendRequest(request.id);
    } catch (error) {
      console.error('Failed to accept request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await declineFriendRequest(request.id);
    } catch (error) {
      console.error('Failed to decline request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
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
              {type === 'outgoing' && (
                <Badge variant="outline" className="text-xs">
                  Sent
                </Badge>
              )}
            </div>

            {request.fromUsername && request.fromUsername !== displayName && (
              <p className="text-sm text-muted-foreground">@{request.fromUsername}</p>
            )}

            {/* Message */}
            {request.message && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{request.message}</p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <MethodIcon className="h-3 w-3" />
              <span>{METHOD_LABELS[request.method]}</span>
              <span>•</span>
              <span>{formatDistanceToNow(request.createdAt, { addSuffix: true })}</span>
            </div>
          </div>

          {/* Actions */}
          {type === 'incoming' && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="default"
                onClick={handleAccept}
                disabled={isLoading}
                title="Accept request"
                data-testid="accept-friend-request-button"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
                disabled={isLoading}
                title="Decline request"
                data-testid="decline-friend-request-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
