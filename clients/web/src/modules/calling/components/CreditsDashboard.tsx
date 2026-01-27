/**
 * Credits Dashboard
 * PSTN credits usage statistics and alerts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { LocalCreditBalance, PSTNUsageRecord } from '../types';
import { PSTNCreditsManager } from '../services/pstnCreditsManager';

interface CreditsDashboardProps {
  balance: LocalCreditBalance;
  usageHistory: PSTNUsageRecord[];
  onRefresh?: () => void;
  className?: string;
}

export function CreditsDashboard({
  balance,
  usageHistory,
  onRefresh,
  className,
}: CreditsDashboardProps) {
  const { t } = useTranslation('calling');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Calculate summary stats
  const totalCalls = usageHistory.length;
  const inboundCalls = usageHistory.filter((r) => r.direction === 'inbound').length;
  const outboundCalls = usageHistory.filter((r) => r.direction === 'outbound').length;
  const totalMinutes = Math.round(
    usageHistory.reduce((sum, r) => sum + r.duration, 0) / 60
  );

  // Get status color
  const statusColor = PSTNCreditsManager.getStatusColor(balance.percentUsed);
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  // Days until reset
  const daysUntilReset = PSTNCreditsManager.getDaysUntilReset(balance.resetDate);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main balance card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white">
              {t('pstnCredits')}
            </CardTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn(
                  'w-4 h-4',
                  isRefreshing && 'animate-spin'
                )} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance display */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-white">
                {PSTNCreditsManager.formatCredits(balance.remaining)}
              </div>
              <div className="text-sm text-gray-400">
                {t('of')} {PSTNCreditsManager.formatCredits(balance.monthlyAllocation)} {t('remaining')}
              </div>
            </div>
            <div className={cn('text-2xl font-semibold', colorClasses[statusColor])}>
              {PSTNCreditsManager.formatPercentage(100 - balance.percentUsed)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress
              value={balance.percentUsed}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{PSTNCreditsManager.formatCredits(balance.used)} {t('used')}</span>
              <span>{t('resetsIn')} {daysUntilReset} {t('days')}</span>
            </div>
          </div>

          {/* Alert for low credits */}
          {balance.isLow && (
            <div className={cn(
              'flex items-center gap-2 p-3 rounded-lg text-sm',
              balance.remaining <= 0
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            )}>
              <AlertTriangle className="w-4 h-4" />
              <span>
                {balance.remaining <= 0
                  ? t('creditsExhausted')
                  : t('creditsLow')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Phone className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{totalCalls}</div>
                <div className="text-xs text-gray-400">{t('totalCalls')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{totalMinutes}</div>
                <div className="text-xs text-gray-400">{t('totalMinutes')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <PhoneIncoming className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{inboundCalls}</div>
                <div className="text-xs text-gray-400">{t('inbound')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <PhoneOutgoing className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{outboundCalls}</div>
                <div className="text-xs text-gray-400">{t('outbound')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent usage */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">
            {t('recentUsage')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {usageHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {t('noRecentUsage')}
              </div>
            ) : (
              <div className="space-y-2">
                {usageHistory.slice(0, 20).map((record) => (
                  <UsageRecordItem key={record.callSid} record={record} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Single usage record item
 */
function UsageRecordItem({ record }: { record: PSTNUsageRecord }) {
  const { t } = useTranslation('calling');

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('today');
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday');
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-gray-700/30 rounded">
      <div className="flex items-center gap-3">
        {record.direction === 'inbound' ? (
          <PhoneIncoming className="w-4 h-4 text-green-400" />
        ) : (
          <PhoneOutgoing className="w-4 h-4 text-orange-400" />
        )}
        <div>
          <div className="text-sm text-white">
            {record.direction === 'outbound' && record.targetPhone
              ? record.targetPhone
              : t(record.direction === 'inbound' ? 'inboundCall' : 'outboundCall')}
          </div>
          <div className="text-xs text-gray-400">
            {formatDate(record.timestamp)} {formatTime(record.timestamp)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-white">{formatDuration(record.duration)}</div>
        <div className="text-xs text-gray-400">{record.creditsCost}m {t('credits')}</div>
      </div>
    </div>
  );
}

/**
 * Compact credits indicator for toolbar/header
 */
export function CreditsIndicator({
  balance,
  onClick,
  className,
}: {
  balance: LocalCreditBalance;
  onClick?: () => void;
  className?: string;
}) {
  const { t } = useTranslation('calling');
  const statusColor = PSTNCreditsManager.getStatusColor(balance.percentUsed);
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn('gap-1.5', className)}
          >
            <Phone className={cn('w-4 h-4', colorClasses[statusColor])} />
            <span className={colorClasses[statusColor]}>
              {PSTNCreditsManager.formatCredits(balance.remaining)}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <div className="font-medium">{t('pstnCredits')}</div>
            <div className="text-xs text-gray-400">
              {balance.remaining} / {balance.monthlyAllocation} {t('minutesRemaining')}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CreditsDashboard;
