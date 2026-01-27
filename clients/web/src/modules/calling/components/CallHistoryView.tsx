/**
 * Call History View
 * Displays call history with filtering and management
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Trash2,
  Search,
  Clock,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCalling } from '../hooks/useCalling';
import { CallType, CallDirection, HangupReason, CallHistoryCallType } from '../types';
import { format } from 'date-fns';

type FilterType = 'all' | 'incoming' | 'outgoing' | 'missed';

export function CallHistoryView() {
  const { t } = useTranslation('calling');
  const { callHistory, clearCallHistory, startCall } = useCalling();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter calls
  const filteredCalls = callHistory.filter((call) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      call.remoteName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.remotePubkey.includes(searchQuery);

    // Type filter
    const isMissed =
      call.direction === CallDirection.Incoming &&
      (call.endReason === HangupReason.NoAnswer ||
        call.endReason === HangupReason.Rejected ||
        call.endReason === HangupReason.Cancelled);

    const matchesFilter =
      filter === 'all' ||
      (filter === 'incoming' && call.direction === CallDirection.Incoming && !isMissed) ||
      (filter === 'outgoing' && call.direction === CallDirection.Outgoing) ||
      (filter === 'missed' && isMissed);

    return matchesSearch && matchesFilter;
  });

  // Group calls by date
  const groupedCalls = filteredCalls.reduce((groups, call) => {
    const date = format(call.startedAt, 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(call);
    return groups;
  }, {} as Record<string, typeof filteredCalls>);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallIcon = (call: (typeof callHistory)[0]) => {
    const isMissed =
      call.direction === CallDirection.Incoming &&
      (call.endReason === HangupReason.NoAnswer ||
        call.endReason === HangupReason.Rejected ||
        call.endReason === HangupReason.Cancelled);

    if (isMissed) {
      return <PhoneMissed className="h-4 w-4 text-red-500" />;
    }
    if (call.direction === CallDirection.Incoming) {
      return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {t('history')}
          </h1>
          <p className="text-muted-foreground">
            {callHistory.length} {callHistory.length === 1 ? 'call' : 'calls'}
          </p>
        </div>

        {callHistory.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('clearHistory')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('clearHistory')}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('clearHistoryConfirm')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={clearCallHistory}>
                  {t('clearHistory')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchByNameOrPubkey')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCalls')}</SelectItem>
            <SelectItem value="incoming">{t('incoming')}</SelectItem>
            <SelectItem value="outgoing">{t('outgoing')}</SelectItem>
            <SelectItem value="missed">{t('missed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Call list */}
      {Object.keys(groupedCalls).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t('noCallHistory')}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedCalls).map(([date, calls]) => (
          <div key={date} className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {format(new Date(date), 'EEEE, MMMM d, yyyy')}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {calls.map((call) => (
                  <div
                    key={call.callId}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {call.remoteName?.[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {call.remoteName ?? 'Unknown'}
                          </span>
                          {call.wasEncrypted && (
                            <Shield className="h-3 w-3 text-green-500" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {getCallIcon(call)}
                          <span>
                            {call.callType === CallHistoryCallType.Video ? (
                              <Video className="h-3 w-3 inline mr-1" />
                            ) : (
                              <Phone className="h-3 w-3 inline mr-1" />
                            )}
                            {call.callType === CallHistoryCallType.Video ? 'Video' : 'Voice'}
                          </span>
                          <span>•</span>
                          <span>{format(call.startedAt, 'h:mm a')}</span>
                          {formatDuration(call.duration) && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(call.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          startCall(call.remotePubkey, CallType.Voice, {
                            remoteName: call.remoteName,
                          })
                        }
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          startCall(call.remotePubkey, CallType.Video, {
                            remoteName: call.remoteName,
                          })
                        }
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
