/**
 * Call Log List Component
 * Displays history of calls for a hotline
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHotlinesStore } from '../hotlinesStore';
import type { HotlineCall, Priority, CallStatus } from '../types';

interface CallLogListProps {
  hotlineId: string;
}

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusIcons: Record<CallStatus, React.ReactNode> = {
  active: <Phone className="h-4 w-4 text-green-600" />,
  'on-hold': <Clock className="h-4 w-4 text-yellow-600" />,
  completed: <CheckCircle className="h-4 w-4 text-green-600" />,
  escalated: <AlertCircle className="h-4 w-4 text-red-600" />,
  transferred: <Phone className="h-4 w-4 text-blue-600" />,
};

function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function CallLogList({ hotlineId }: CallLogListProps) {
  const { t } = useTranslation('hotlines');
  const { callHistory, isLoading, loadCallHistory } = useHotlinesStore();

  useEffect(() => {
    loadCallHistory(hotlineId, { limit: 50 });
  }, [hotlineId, loadCallHistory]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (callHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t('noCallsInHistory')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {callHistory.map((call) => (
        <CallLogItem key={call.id} call={call} />
      ))}
    </div>
  );
}

function CallLogItem({ call }: { call: HotlineCall }) {
  const { t } = useTranslation('hotlines');
  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1">{statusIcons[call.status]}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {call.callerName || 'Unknown Caller'}
              </span>
              <Badge variant="secondary" className={priorityColors[call.priority]}>
                {call.priority}
              </Badge>
            </div>
            {call.callerPhone && (
              <p className="text-sm text-muted-foreground">{call.callerPhone}</p>
            )}
            {call.summary && (
              <p className="text-sm mt-1 line-clamp-2">{call.summary}</p>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{formatDistanceToNow(call.callTime, { addSuffix: true })}</p>
          <p>{formatDuration(call.callTime, call.endTime)}</p>
        </div>
      </div>
      {call.followUpNeeded && (
        <div className="mt-2 flex items-center gap-1 text-sm text-orange-600">
          <AlertCircle className="h-3 w-3" />
          {t('followUpNeeded')}
        </div>
      )}
    </div>
  );
}

export default CallLogList;
