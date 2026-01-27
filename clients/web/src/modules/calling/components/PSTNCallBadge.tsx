/**
 * PSTN Call Badge
 * Visual indicator that a call is via PSTN (phone network)
 */

import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneOff } from 'lucide-react';
import type { LocalPSTNCall } from '../types';

interface PSTNCallBadgeProps {
  call: LocalPSTNCall;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PSTNCallBadge({
  call,
  size = 'md',
  showLabel = false,
  className,
}: PSTNCallBadgeProps) {
  const { t } = useTranslation('calling');

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getStatusColor = () => {
    switch (call.status) {
      case 'connected':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'ringing':
      case 'queued':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'on_hold':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
      case 'failed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getIcon = () => {
    if (call.status === 'completed' || call.status === 'failed') {
      return <PhoneOff className={iconSizes[size]} />;
    }
    if (call.direction === 'inbound') {
      return <PhoneIncoming className={iconSizes[size]} />;
    }
    if (call.direction === 'outbound') {
      return <PhoneOutgoing className={iconSizes[size]} />;
    }
    return <Phone className={iconSizes[size]} />;
  };

  const getStatusLabel = () => {
    switch (call.status) {
      case 'queued':
        return t('pstnQueued');
      case 'ringing':
        return t('pstnRinging');
      case 'connected':
        return t('pstnConnected');
      case 'on_hold':
        return t('pstnOnHold');
      case 'completed':
        return t('pstnCompleted');
      case 'failed':
        return t('pstnFailed');
      default:
        return t('pstn');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        sizeClasses[size],
        getStatusColor(),
        className
      )}
    >
      {getIcon()}
      {showLabel && <span>{getStatusLabel()}</span>}
      {call.status === 'connected' && call.duration > 0 && (
        <span className="font-mono">{formatDuration(call.duration)}</span>
      )}
    </div>
  );

  // Wrap in tooltip if not showing label
  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div className="font-medium">{t('pstnCall')}</div>
              <div className="text-xs text-gray-400">{getStatusLabel()}</div>
              {call.direction === 'inbound' && call.callerPhone && (
                <div className="text-xs text-gray-400">{t('from')}: {call.callerPhone}</div>
              )}
              {call.direction === 'outbound' && call.targetPhone && (
                <div className="text-xs text-gray-400">{t('to')}: {call.targetPhone}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Simple PSTN indicator icon
 */
export function PSTNIndicator({ className }: { className?: string }) {
  const { t } = useTranslation('calling');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('text-blue-400', className)}>
            <Phone className="w-4 h-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {t('pstnCall')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PSTNCallBadge;
