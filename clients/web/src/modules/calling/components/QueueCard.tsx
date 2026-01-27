/**
 * Queue Card
 * Displays a single call in the queue with priority indicator and wait time
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PhoneIncoming,
  AlertTriangle,
  ArrowUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HotlineCallState } from '../types';
import { HotlineCallStatePriority } from '../types';

interface QueueCardProps {
  call: HotlineCallState;
  position: number;
  onAccept?: (callId: string) => void;
  canAccept?: boolean;
  isCompact?: boolean;
}

export function QueueCard({
  call,
  position,
  onAccept,
  canAccept = true,
  isCompact = false,
}: QueueCardProps) {
  const { t } = useTranslation('calling');
  const [waitTime, setWaitTime] = useState('0:00');

  // Update wait time display
  useEffect(() => {
    if (!call.queuedAt) return;

    const updateWaitTime = () => {
      const elapsed = Date.now() - call.queuedAt!;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setWaitTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateWaitTime();
    const interval = setInterval(updateWaitTime, 1000);
    return () => clearInterval(interval);
  }, [call.queuedAt]);

  const getPriorityConfig = (priority?: HotlineCallStatePriority) => {
    switch (priority) {
      case HotlineCallStatePriority.Urgent:
        return {
          color: 'bg-red-500',
          textColor: 'text-red-600',
          borderColor: 'border-red-500',
          badge: 'destructive' as const,
          icon: AlertTriangle,
          pulse: true,
        };
      case HotlineCallStatePriority.High:
        return {
          color: 'bg-orange-500',
          textColor: 'text-orange-600',
          borderColor: 'border-orange-500',
          badge: 'default' as const,
          icon: ArrowUp,
          pulse: false,
        };
      case HotlineCallStatePriority.Low:
        return {
          color: 'bg-gray-400',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-300',
          badge: 'secondary' as const,
          icon: null,
          pulse: false,
        };
      case HotlineCallStatePriority.Medium:
      default:
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-600',
          borderColor: 'border-yellow-500',
          badge: 'secondary' as const,
          icon: null,
          pulse: false,
        };
    }
  };

  const priority = getPriorityConfig(call.priority);
  const callerName = call.caller?.name || call.caller?.phone || t('unknownCaller');
  const callerInitials = callerName.slice(0, 2).toUpperCase();

  if (isCompact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg border transition-colors',
          'hover:bg-muted/50',
          priority.pulse && 'animate-pulse border-red-500'
        )}
      >
        {/* Position badge */}
        <div className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
          priority.color,
          'text-white'
        )}>
          {position}
        </div>

        {/* Caller info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{callerName}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{waitTime}</span>
            {call.category && (
              <>
                <span>-</span>
                <span>{call.category}</span>
              </>
            )}
          </div>
        </div>

        {/* Priority badge */}
        <Badge variant={priority.badge} className="shrink-0">
          {call.priority}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn(
      'transition-all',
      priority.pulse && 'ring-2 ring-red-500 animate-pulse'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Position indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full text-white font-bold',
                      priority.color
                    )}
                  >
                    {position}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t('positionInQueue', { position })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Caller avatar */}
            <Avatar>
              <AvatarFallback className={cn('font-medium', priority.textColor)}>
                {callerInitials}
              </AvatarFallback>
            </Avatar>

            {/* Caller details */}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{callerName}</p>
                {priority.icon && (
                  <priority.icon className={cn('h-4 w-4', priority.textColor)} />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {/* Category badge */}
                {call.category && (
                  <Badge variant="outline" className="text-xs">
                    {call.category}
                  </Badge>
                )}

                {/* Priority badge */}
                <Badge variant={priority.badge} className="text-xs">
                  {call.priority}
                </Badge>

                {/* Wait time */}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('waitingTime', { time: waitTime })}
                </span>
              </div>
            </div>
          </div>

          {/* Accept button */}
          {onAccept && (
            <Button
              onClick={() => onAccept(call.callId)}
              disabled={!canAccept}
              size="sm"
            >
              <PhoneIncoming className="h-4 w-4 mr-2" />
              {t('acceptCall')}
            </Button>
          )}
        </div>

        {/* Estimated wait display */}
        {call.waitDuration && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              {t('estimatedWait')}: ~{Math.ceil(call.waitDuration / 60)} {t('minutes')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QueueCard;
