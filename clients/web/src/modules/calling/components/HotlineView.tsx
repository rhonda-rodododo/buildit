/**
 * Hotline View
 * Operator interface for managing hotline calls
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Clock,
  Settings,
  Play,
  Pause,
  Coffee,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCallingStore } from '../callingStore';
import { HotlineOperatorStatusStatus, HotlineCallStateState } from '../types';

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
  const [callNotes, setCallNotes] = useState('');
  const queuedCalls = hotlineQueue.filter(
    (c) => c.hotlineId === selectedHotline && c.state === HotlineCallStateState.Queued
  );
  const activeCalls = activeHotlineCalls.filter((c) => c.hotlineId === selectedHotline);

  const getStatusColor = (status: HotlineOperatorStatusStatus) => {
    switch (status) {
      case HotlineOperatorStatusStatus.Available:
        return 'bg-green-500';
      case HotlineOperatorStatusStatus.OnCall:
        return 'bg-blue-500';
      case HotlineOperatorStatusStatus.WrapUp:
        return 'bg-yellow-500';
      case HotlineOperatorStatusStatus.Break:
        return 'bg-orange-500';
      case HotlineOperatorStatusStatus.Offline:
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
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

  const handleAcceptCall = async (_callId: string, callerPubkey?: string) => {
    if (!callerPubkey) return;
    // In a real implementation, this would accept the call from the queue
    // For now, this is a placeholder - will integrate with callingManager
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
              No hotlines are configured for this group yet.
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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            {t('hotline')}
          </h1>
          <p className="text-muted-foreground">
            Manage hotline calls and queue
          </p>
        </div>

        {/* Hotline selector */}
        {hotlineConfigs.length > 1 && (
          <Select value={selectedHotline ?? ''} onValueChange={setSelectedHotline}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select hotline" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Operator status and controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Operator Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current status */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    getStatusColor(operatorStatus?.status ?? HotlineOperatorStatusStatus.Offline)
                  )}
                />
                <span className="font-medium capitalize">
                  {operatorStatus?.status?.replace('_', ' ') ?? 'Offline'}
                </span>
              </div>

              {/* Status controls */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={
                    operatorStatus?.status === HotlineOperatorStatusStatus.Available
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => handleStatusChange(HotlineOperatorStatusStatus.Available)}
                  className="justify-start"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('goOnline')}
                </Button>
                <Button
                  variant={
                    operatorStatus?.status === HotlineOperatorStatusStatus.Break
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => handleStatusChange(HotlineOperatorStatusStatus.Break)}
                  className="justify-start"
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {t('takeBreak')}
                </Button>
                <Button
                  variant={
                    operatorStatus?.status === HotlineOperatorStatusStatus.WrapUp
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => handleStatusChange(HotlineOperatorStatusStatus.WrapUp)}
                  className="justify-start"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  {t('wrapUp')}
                </Button>
                <Button
                  variant={
                    operatorStatus?.status === HotlineOperatorStatusStatus.Offline
                      ? 'destructive'
                      : 'outline'
                  }
                  onClick={() => handleStatusChange(HotlineOperatorStatusStatus.Offline)}
                  className="justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('goOffline')}
                </Button>
              </div>

              {/* Stats */}
              {operatorStatus && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Calls handled today: {operatorStatus.callCount ?? 0}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{queuedCalls.length}</p>
                  <p className="text-sm text-muted-foreground">In Queue</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCalls.length}</p>
                  <p className="text-sm text-muted-foreground">Active Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Queue and active calls */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="queue">
            <TabsList>
              <TabsTrigger value="queue">
                <Clock className="h-4 w-4 mr-2" />
                {t('queue')}
                {queuedCalls.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {queuedCalls.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">
                <PhoneIncoming className="h-4 w-4 mr-2" />
                Active
                {activeCalls.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeCalls.length}
                  </Badge>
                )}
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
                    <Card key={call.callId}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                              {index + 1}
                            </div>
                            <Avatar>
                              <AvatarFallback>
                                {call.caller?.name?.[0]?.toUpperCase() ?? '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {call.caller?.name ?? call.caller?.phone ?? 'Unknown'}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {call.category && (
                                  <Badge variant="outline">{call.category}</Badge>
                                )}
                                {call.priority && (
                                  <Badge
                                    variant={
                                      call.priority === 'urgent'
                                        ? 'destructive'
                                        : call.priority === 'high'
                                        ? 'default'
                                        : 'secondary'
                                    }
                                  >
                                    {call.priority}
                                  </Badge>
                                )}
                                <span>
                                  Waiting{' '}
                                  {call.waitDuration
                                    ? `${Math.floor(call.waitDuration / 60)}m`
                                    : '...'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAcceptCall(call.callId, call.caller?.pubkey)}
                            disabled={
                              operatorStatus?.status !== HotlineOperatorStatusStatus.Available
                            }
                          >
                            <PhoneIncoming className="h-4 w-4 mr-2" />
                            {t('acceptCall')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              {activeCalls.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No active calls
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeCalls.map((call) => (
                    <Card key={call.callId}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarFallback>
                                {call.caller?.name?.[0]?.toUpperCase() ?? '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {call.caller?.name ?? call.caller?.phone ?? 'Unknown'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {call.callType === 'pstn' ? 'Phone Call' : 'BuildIt Call'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              {t('transferCall')}
                            </Button>
                            <Button variant="destructive" size="sm">
                              <PhoneOff className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Call notes */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('callNotes')}</label>
                          <Textarea
                            value={callNotes}
                            onChange={(e) => setCallNotes(e.target.value)}
                            placeholder="Add notes about this call..."
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
