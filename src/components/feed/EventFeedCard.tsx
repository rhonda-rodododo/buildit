/**
 * EventFeedCard Component
 * Displays an event in the activity feed
 */

import { FC } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { EventFeedItem } from './types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEventsStore } from '@/modules/events/eventsStore';
import {
  Calendar,
  MapPin,
  Users,
  Lock,
  Globe,
  Shield,
  Clock,
} from 'lucide-react';

interface EventFeedCardProps {
  item: EventFeedItem;
  className?: string;
}

export const EventFeedCard: FC<EventFeedCardProps> = ({ item, className }) => {
  const { data: event } = item;

  const getPrivacyIcon = () => {
    switch (event.privacy) {
      case 'public':
        return <Globe className="w-3 h-3" />;
      case 'group':
        return <Users className="w-3 h-3" />;
      case 'private':
        return <Lock className="w-3 h-3" />;
      case 'direct-action':
        return <Shield className="w-3 h-3" />;
    }
  };

  const getPrivacyLabel = () => {
    switch (event.privacy) {
      case 'public':
        return 'Public Event';
      case 'group':
        return 'Group Event';
      case 'private':
        return 'Private Event';
      case 'direct-action':
        return 'Direct Action';
    }
  };

  const formatEventTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow =
      date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    if (isToday) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy • h:mm a');
    }
  };

  const getRSVPCount = () => {
    const { rsvps } = useEventsStore.getState();
    return rsvps.filter(rsvp => rsvp.eventId === event.id && rsvp.status === 'going').length;
  };

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${event.createdBy}`}
            />
            <AvatarFallback>{event.createdBy.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Creator info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{event.createdBy}</span>
              <span className="text-xs text-muted-foreground">created an event</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(event.createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Event content */}
      <div className="space-y-3">
        {/* Privacy indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {getPrivacyIcon()}
          <span>{getPrivacyLabel()}</span>
        </div>

        {/* Event title */}
        <h3 className="text-lg font-semibold">{event.title}</h3>

        {/* Event description */}
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {event.description}
          </p>
        )}

        {/* Event details */}
        <div className="space-y-2">
          {/* Date/Time */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{formatEventTime(event.startTime)}</span>
            {event.endTime && (
              <>
                <span className="text-muted-foreground">→</span>
                <span>{format(event.endTime, 'h:mm a')}</span>
              </>
            )}
          </div>

          {/* Location */}
          {event.location && !event.locationRevealTime && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Location reveal time for direct actions */}
          {event.locationRevealTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                Location revealed {formatDistanceToNow(event.locationRevealTime)} before
                event
              </span>
            </div>
          )}

          {/* Capacity */}
          {event.capacity && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                {getRSVPCount()} / {event.capacity} attending
              </span>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button className="flex-1">RSVP Going</Button>
          <Button variant="outline" className="flex-1">
            Maybe
          </Button>
          <Button variant="ghost" className="flex-1">
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
};
