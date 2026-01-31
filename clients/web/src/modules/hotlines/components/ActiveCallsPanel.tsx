/**
 * Active Calls Panel Component
 * Displays and manages currently active calls
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import {
  Phone,
  PhoneOff,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHotlinesStore } from '../hotlinesStore';
import type { HotlineCall, Priority } from '../types';

interface ActiveCallsPanelProps {
  hotlineId: string;
}

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function ActiveCallsPanel({ hotlineId }: ActiveCallsPanelProps) {
  const { t } = useTranslation();
  const currentIdentity = useAuthStore((state) => state.currentIdentity);
  const { activeCalls, isLoading, loadActiveCalls, startCall, endCall, updateCall } =
    useHotlinesStore();
  const [newCallOpen, setNewCallOpen] = useState(false);
  const [endCallDialogOpen, setEndCallDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<HotlineCall | null>(null);
  const [summary, setSummary] = useState('');

  // Form state for new call
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  useEffect(() => {
    loadActiveCalls(hotlineId);
    // Refresh every 30 seconds
    const interval = setInterval(() => loadActiveCalls(hotlineId), 30000);
    return () => clearInterval(interval);
  }, [hotlineId, loadActiveCalls]);

  const handleStartCall = async () => {
    try {
      await startCall(
        hotlineId,
        { callerName, callerPhone, priority },
        currentIdentity?.publicKey || ''
      );
      setNewCallOpen(false);
      setCallerName('');
      setCallerPhone('');
      setPriority('medium');
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  const handleEndCall = async () => {
    if (!selectedCall) return;
    try {
      await endCall(selectedCall.id, summary);
      setEndCallDialogOpen(false);
      setSelectedCall(null);
      setSummary('');
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  const handleHoldCall = async (call: HotlineCall) => {
    const newStatus = call.status === 'on-hold' ? 'active' : 'on-hold';
    await updateCall(call.id, { status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Call Button */}
      <Dialog open={newCallOpen} onOpenChange={setNewCallOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t('activeCallsPanel.startNewCall')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('activeCallsPanel.newCallTitle')}</DialogTitle>
            <DialogDescription>
              {t('activeCallsPanel.newCallDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="callerName">{t('activeCallsPanel.callerName')}</Label>
              <Input
                id="callerName"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder={t('activeCallsPanel.callerNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callerPhone">{t('activeCallsPanel.phoneNumber')}</Label>
              <Input
                id="callerPhone"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder={t('activeCallsPanel.phonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{t('activeCallsPanel.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('activeCallsPanel.priorities.low')}</SelectItem>
                  <SelectItem value="medium">{t('activeCallsPanel.priorities.medium')}</SelectItem>
                  <SelectItem value="high">{t('activeCallsPanel.priorities.high')}</SelectItem>
                  <SelectItem value="urgent">{t('activeCallsPanel.priorities.urgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCallOpen(false)}>
              {t('activeCallsPanel.cancel')}
            </Button>
            <Button onClick={handleStartCall}>
              <Phone className="h-4 w-4 mr-2" />
              {t('activeCallsPanel.startCall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Calls List */}
      {activeCalls.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t('activeCallsPanel.noActiveCalls')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCalls.map((call) => (
            <div
              key={call.id}
              className="p-4 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    {call.status === 'on-hold' ? (
                      <Pause className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <Phone className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {call.callerName || t('activeCallsPanel.unknownCaller')}
                      </span>
                      <Badge variant="secondary" className={priorityColors[call.priority]}>
                        {t(`activeCallsPanel.priorities.${call.priority}`)}
                      </Badge>
                      {call.status === 'on-hold' && (
                        <Badge variant="outline">{t('activeCallsPanel.onHold')}</Badge>
                      )}
                    </div>
                    {call.callerPhone && (
                      <p className="text-sm text-muted-foreground">
                        {call.callerPhone}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('startedTimeAgo', { time: formatDistanceToNow(call.callTime, { addSuffix: true }) })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleHoldCall(call)}
                  >
                    {call.status === 'on-hold' ? (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        {t('activeCallsPanel.resume')}
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        {t('activeCallsPanel.hold')}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCall(call);
                      setEndCallDialogOpen(true);
                    }}
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    {t('activeCallsPanel.end')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* End Call Dialog */}
      <Dialog open={endCallDialogOpen} onOpenChange={setEndCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('activeCallsPanel.endCallTitle')}</DialogTitle>
            <DialogDescription>
              {t('activeCallsPanel.endCallDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="summary">{t('activeCallsPanel.callSummary')}</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t('activeCallsPanel.summaryPlaceholder')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndCallDialogOpen(false)}>
              {t('activeCallsPanel.cancel')}
            </Button>
            <Button onClick={handleEndCall} variant="destructive">
              <PhoneOff className="h-4 w-4 mr-2" />
              {t('activeCallsPanel.endCallButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ActiveCallsPanel;
