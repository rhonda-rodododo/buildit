/**
 * MutualAidFeedCard Component
 * Displays a mutual aid request or offer in the activity feed
 */

import { FC, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { MutualAidFeedItem } from './types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HandHeart,
  MapPin,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface MutualAidFeedCardProps {
  item: MutualAidFeedItem;
  className?: string;
}

export const MutualAidFeedCard: FC<MutualAidFeedCardProps> = ({ item, className }) => {
  const { data: request } = item;

  const getTypeLabel = () => {
    return request.type === 'request' ? 'requesting help' : 'offering help';
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded">
            <Clock className="w-3 h-3" />
            Open
          </span>
        );
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Matched
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/10 text-yellow-500 rounded">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'fulfilled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 text-purple-500 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Fulfilled
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
            <XCircle className="w-3 h-3" />
            Closed
          </span>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      food: 'bg-orange-500/10 text-orange-500',
      housing: 'bg-blue-500/10 text-blue-500',
      transport: 'bg-green-500/10 text-green-500',
      skills: 'bg-purple-500/10 text-purple-500',
      medical: 'bg-red-500/10 text-red-500',
      childcare: 'bg-pink-500/10 text-pink-500',
      financial: 'bg-yellow-500/10 text-yellow-500',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  const isExpired = useMemo(
    () => request.expiresAt && request.expiresAt < Date.now(),
    [request.expiresAt]
  );

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${request.createdBy}`}
            />
            <AvatarFallback>{request.createdBy.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Creator info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{request.createdBy}</span>
              <span className="text-xs text-muted-foreground">is {getTypeLabel()}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(request.created, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        {getStatusBadge()}
      </div>

      {/* Request content */}
      <div className="space-y-3">
        {/* Type indicator */}
        <div className="flex items-center gap-2">
          <HandHeart
            className={`w-5 h-5 ${
              request.type === 'request' ? 'text-blue-500' : 'text-green-500'
            }`}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {request.type}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold">{request.title}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3">{request.description}</p>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm">
          {/* Category */}
          <div className="flex items-center gap-1">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(request.category)}`}>
              {request.category}
            </span>
          </div>

          {/* Location */}
          {request.location && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{request.location}</span>
            </div>
          )}

          {/* Expiration */}
          {request.expiresAt && !isExpired && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">
                Expires {formatDistanceToNow(request.expiresAt, { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Expired indicator */}
          {isExpired && (
            <span className="text-xs text-destructive font-medium">Expired</span>
          )}
        </div>

        {/* Action buttons */}
        {request.status === 'open' && !isExpired && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {request.type === 'request' ? (
              <>
                <Button className="flex-1">Offer Help</Button>
                <Button variant="outline" className="flex-1">
                  Message
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1">Request This</Button>
                <Button variant="outline" className="flex-1">
                  Message
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm">
              Details
            </Button>
          </div>
        )}

        {/* Matched/Fulfilled state */}
        {(request.status === 'matched' || request.status === 'fulfilled') && (
          <div className="pt-2 border-t">
            <Button variant="outline" className="w-full">
              View Details
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
