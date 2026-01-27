/**
 * Hotline View (Operator Dashboard)
 * Full-featured operator interface for managing hotline calls
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  PhoneIncoming,
  Clock,
  Settings,
  Users,
  BarChart3,
  Headphones,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCallingStore } from '../callingStore';
import {
  HotlineOperatorStatusStatus,
  HotlineCallStateState,
  HotlineCallStatePriority,
} from '../types';
import { OperatorStatusCard } from './OperatorStatusCard';
import { QueueCard } from './QueueCard';
import { CallNotesPanel } from './CallNotesPanel';
import { ActiveCallControls } from './ActiveCallControls';
import { HotlineQueueManager } from '../services/hotlineQueueManager';
import { HotlineCallController } from '../services/hotlineCallController';
import { OperatorStatusManager } from '../services/operatorStatusManager';
import type { ShiftStats } from '../services/operatorStatusManager';

export function HotlineView() {
  const { t } = useTranslation('calling');
  const {
    hotlineConfigs,
    operatorStatus,
    hotlineQueue,
    activeHotlineCalls,
    setOperatorStatus,
  } = useCallingStore();

  const [selectedHotline, setSelectedHotline] = useState<string | null>(
    hotlineConfigs[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<'queue' | 'active' | 'stats'>('queue');
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Service refs
  const queueManagerRef = useRef<HotlineQueueManager | null>(null);
  const callControllerRef = useRef<HotlineCallController | null>(null);
  const statusManagerRef = useRef<OperatorStatusManager | null>(null);

  // Filter calls for selected hotline
  const queuedCalls = hotlineQueue.filter(
    (c) => c.hotlineId === selectedHotline && c.state === HotlineCallStateState.Queued
  );
  const activeCalls = activeHotlineCalls.filter(
    (c) => c.hotlineId === selectedHotline &&
    (c.state === HotlineCallStateState.Active || c.state === HotlineCallStateState.OnHold)
  );
  const currentCall = activeCalls[0];

  // Get available operators for transfer
  const availableOperators = queueManagerRef.current?.getAvailableOperators(selectedHotline || '') || [];

  // Update call duration
  useEffect(() => {
    if (!currentCall?.answeredAt) return;

    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - currentCall.answeredAt!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentCall?.answeredAt]);

  // Update break time remaining
  useEffect(() => {
    if (operatorStatus?.status !== HotlineOperatorStatusStatus.Break) {
      setBreakTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = statusManagerRef.current?.getBreakTimeRemaining();
      setBreakTimeRemaining(remaining ?? null);
    }, 1000);

    return () => clearInterval(interval);
  }, [operatorStatus?.status]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCall || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'm':
          handleMuteToggle();
          break;
        case 'h':
          handleHoldToggle();
          break;
        case 't':
          // Open transfer dialog - handled by component
          break;
        case 'e':
          // Open escalate dialog - handled by component
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCall]);

  // Shift management
  const handleStartShift = async () => {
    if (!selectedHotline) return;
    setIsLoading(true);
    try {
      await statusManagerRef.current?.startShift(selectedHotline);
      setShiftStats(statusManagerRef.current?.getShiftStats() ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndShift = async () => {
    setIsLoading(true);
    try {
      const stats = await statusManagerRef.current?.endShift();
      setShiftStats(null);
      return stats ?? null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (status: HotlineOperatorStatusStatus) => {
    if (!selectedHotline || !operatorStatus) return;
    setOperatorStatus({
      ...operatorStatus,
      status,
      timestamp: Date.now(),
    });
  };

  const handleStartBreak = async (breakType: 'short' | 'meal' | 'personal') => {
    try {
      await statusManagerRef.current?.startBreak(breakType);
    } catch (error) {
      console.error('Failed to start break:', error);
    }
  };

  const handleEndBreak = async () => {
    await statusManagerRef.current?.endBreak();
  };

  // Call actions
  const handleAcceptCall = async (callId: string) => {
    if (!operatorStatus?.pubkey) return;
    queueManagerRef.current?.handleOperatorAnswer(callId, operatorStatus.pubkey);
    setActiveTab('active');
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    // Would actually toggle mute on the WebRTC connection
  };

  const handleHoldToggle = async () => {
    if (!currentCall) return;
    try {
      if (isOnHold) {
        await callControllerRef.current?.resumeCall(currentCall.callId);
      } else {
        await callControllerRef.current?.holdCall(currentCall.callId);
      }
      setIsOnHold(!isOnHold);
    } catch (error) {
      console.error('Failed to toggle hold:', error);
    }
  };

  const handleTransfer = async (targetPubkey: string, reason?: string) => {
    if (!currentCall) return;
    try {
      await callControllerRef.current?.transferCall(currentCall.callId, targetPubkey, reason);
    } catch (error) {
      console.error('Failed to transfer call:', error);
    }
  };

  const handleEscalate = async (reason: string) => {
    if (!currentCall) return;
    try {
      await callControllerRef.current?.escalateCall(currentCall.callId, reason);
    } catch (error) {
      console.error('Failed to escalate call:', error);
    }
  };

  const handleStartThreeWay = (thirdPartyPubkey: string) => {
    if (!currentCall) return;
    callControllerRef.current?.startThreeWayCall(currentCall.callId, thirdPartyPubkey);
  };

  const handleEndCall = async (summary: string) => {
    if (!currentCall) return;
    await callControllerRef.current?.endCall(currentCall.callId, summary);
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
  };

  const handleNotesChange = (notes: string) => {
    if (!currentCall) return;
    callControllerRef.current?.updateNotes(currentCall.callId, notes);
  };

  const handleCategoryChange = (category: string) => {
    if (!currentCall) return;
    callControllerRef.current?.setCategory(currentCall.callId, category);
  };

  const handlePriorityChange = (priority: HotlineCallStatePriority) => {
    if (!currentCall) return;
    callControllerRef.current?.setPriority(currentCall.callId, priority);
  };

  const handleNoteSave = () => {
    if (!currentCall) return;
    callControllerRef.current?.saveNotes(currentCall.callId);
  };

  // Update shift stats periodically
  useEffect(() => {
    if (!statusManagerRef.current) return;

    const interval = setInterval(() => {
      setShiftStats(statusManagerRef.current?.getShiftStats() ?? null);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Queue stats
  const queueStats = queueManagerRef.current?.getQueueStats(selectedHotline || '') ?? {
    totalCalls: queuedCalls.length,
    avgWaitTime: 0,
    longestWait: 0,
    byPriority: {
      [HotlineCallStatePriority.Urgent]: 0,
      [HotlineCallStatePriority.High]: 0,
      [HotlineCallStatePriority.Medium]: 0,
      [HotlineCallStatePriority.Low]: 0,
    },
    availableOperators: 0,
    onCallOperators: activeCalls.length,
  };

  // If no hotlines configured, show setup prompt
  if (hotlineConfigs.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardContent className="p-8 text-center">
            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">{t('hotline')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('noHotlinesConfigured')}
            </p>
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              {t('createHotline')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            {t('operatorDashboard')}
          </h1>
          <p className="text-muted-foreground">
            {t('manageHotlineCalls')}
          </p>
        </div>

        {/* Hotline selector */}
        {hotlineConfigs.length > 1 && (
          <Select value={selectedHotline ?? ''} onValueChange={setSelectedHotline}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('selectHotline')} />
            </SelectTrigger>
            <SelectContent>
              {hotlineConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left sidebar - Status and controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <OperatorStatusCard
            hotlineId={selectedHotline || ''}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
            onStatusChange={handleStatusChange}
            onStartBreak={handleStartBreak}
            onEndBreak={handleEndBreak}
            shiftStats={shiftStats}
            breakTimeRemaining={breakTimeRemaining}
            isLoading={isLoading}
          />

          {/* Quick stats card */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{queuedCalls.length}</p>
                  <p className="text-sm text-muted-foreground">{t('inQueue')}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{activeCalls.length}</p>
                  <p className="text-sm text-muted-foreground">{t('activeCalls')}</p>
                </div>
              </div>
              {queueStats.avgWaitTime > 0 && (
                <div className="mt-4 pt-4 border-t text-center">
                  <p className="text-sm text-muted-foreground">{t('avgWait')}</p>
                  <p className="text-lg font-semibold">
                    {Math.floor(queueStats.avgWaitTime / 60)}m {queueStats.avgWaitTime % 60}s
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="col-span-12 lg:col-span-6">
          {/* Active call panel */}
          {currentCall && (
            <div className="mb-6 space-y-4">
              <ActiveCallControls
                call={currentCall}
                callDuration={callDuration}
                isMuted={isMuted}
                isOnHold={isOnHold}
                isEncrypted={currentCall.isEncrypted ?? true}
                availableOperators={availableOperators}
                onMuteToggle={handleMuteToggle}
                onHoldToggle={handleHoldToggle}
                onTransfer={handleTransfer}
                onEscalate={handleEscalate}
                onStartThreeWay={handleStartThreeWay}
                onEndCall={handleEndCall}
              />

              <CallNotesPanel
                call={currentCall}
                onNotesChange={handleNotesChange}
                onCategoryChange={handleCategoryChange}
                onPriorityChange={handlePriorityChange}
                onSave={handleNoteSave}
              />
            </div>
          )}

          {/* Queue/Stats tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="w-full">
              <TabsTrigger value="queue" className="flex-1">
                <Clock className="h-4 w-4 mr-2" />
                {t('queue')}
                {queuedCalls.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {queuedCalls.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="flex-1">
                <PhoneIncoming className="h-4 w-4 mr-2" />
                {t('active')}
                {activeCalls.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeCalls.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('stats')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              {queuedCalls.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('noCallsInQueue')}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {queuedCalls.map((call, index) => (
                    <QueueCard
                      key={call.callId}
                      call={call}
                      position={index + 1}
                      onAccept={handleAcceptCall}
                      canAccept={operatorStatus?.status === HotlineOperatorStatusStatus.Available}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              {activeCalls.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('noActiveCalls')}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeCalls.map((call) => (
                    <Card key={call.callId}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {call.caller?.name ?? call.caller?.phone ?? t('unknownCaller')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {call.category} - {call.priority}
                            </p>
                          </div>
                          <Badge>
                            {call.state === HotlineCallStateState.OnHold ? t('onHold') : t('active')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{queueStats.totalCalls}</p>
                    <p className="text-sm text-muted-foreground">{t('totalInQueue')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{queueStats.availableOperators}</p>
                    <p className="text-sm text-muted-foreground">{t('availableOperators')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">
                      {Math.floor(queueStats.avgWaitTime / 60)}:{(queueStats.avgWaitTime % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('avgWaitTime')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">
                      {Math.floor(queueStats.longestWait / 60)}:{(queueStats.longestWait % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('longestWait')}</p>
                  </CardContent>
                </Card>

                {/* Priority breakdown */}
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">{t('byPriority')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span>{t('urgent')}: {queueStats.byPriority[HotlineCallStatePriority.Urgent]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span>{t('high')}: {queueStats.byPriority[HotlineCallStatePriority.High]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span>{t('medium')}: {queueStats.byPriority[HotlineCallStatePriority.Medium]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        <span>{t('low')}: {queueStats.byPriority[HotlineCallStatePriority.Low]}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar - Queue preview and dispatch */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Compact queue preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{t('queuePreview')}</span>
                <Badge variant="outline">{queuedCalls.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {queuedCalls.slice(0, 5).map((call, index) => (
                <QueueCard
                  key={call.callId}
                  call={call}
                  position={index + 1}
                  isCompact
                />
              ))}
              {queuedCalls.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('noCallsWaiting')}
                </p>
              )}
              {queuedCalls.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setActiveTab('queue')}
                >
                  {t('viewAll', { count: queuedCalls.length })}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Dispatch panel placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('dispatch')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dispatchComingSoon')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default HotlineView;
