/**
 * Operator Status Card
 * Displays and controls operator status, shift info, and quick stats
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  Coffee,
  LogOut,
  Clock,
  Phone,
  Timer,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCallingStore } from '../callingStore';
import { HotlineOperatorStatusStatus } from '../types';
import type { ShiftStats } from '../services/operatorStatusManager';

interface OperatorStatusCardProps {
  hotlineId: string;
  onStartShift: () => Promise<void>;
  onEndShift: () => Promise<ShiftStats | null>;
  onStatusChange: (status: HotlineOperatorStatusStatus) => void;
  onStartBreak: (breakType: 'short' | 'meal' | 'personal') => Promise<void>;
  onEndBreak: () => Promise<void>;
  shiftStats: ShiftStats | null;
  breakTimeRemaining: number | null;
  isLoading?: boolean;
}

export function OperatorStatusCard({
  hotlineId: _hotlineId,
  onStartShift,
  onEndShift,
  onStatusChange,
  onStartBreak,
  onEndBreak,
  shiftStats,
  breakTimeRemaining,
  isLoading = false,
}: OperatorStatusCardProps) {
  const { t } = useTranslation('calling');
  const { operatorStatus } = useCallingStore();
  const [shiftDuration, setShiftDuration] = useState('0:00:00');

  // Update shift duration every second
  useEffect(() => {
    if (!shiftStats) return;

    const updateDuration = () => {
      const duration = Date.now() - shiftStats.shiftStart;
      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      setShiftDuration(
        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [shiftStats]);

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
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: HotlineOperatorStatusStatus) => {
    switch (status) {
      case HotlineOperatorStatusStatus.Available:
        return t('available');
      case HotlineOperatorStatusStatus.OnCall:
        return t('onCall');
      case HotlineOperatorStatusStatus.WrapUp:
        return t('wrapUp');
      case HotlineOperatorStatusStatus.Break:
        return t('onBreak');
      case HotlineOperatorStatusStatus.Offline:
      default:
        return t('offline');
    }
  };

  const formatBreakTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStatus = operatorStatus?.status ?? HotlineOperatorStatusStatus.Offline;
  const isOnShift = currentStatus !== HotlineOperatorStatusStatus.Offline;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{t('operatorStatus')}</span>
          {isOnShift && (
            <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
              <Timer className="h-4 w-4" />
              {shiftDuration}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status indicator */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div
            className={cn(
              'w-3 h-3 rounded-full animate-pulse',
              getStatusColor(currentStatus)
            )}
          />
          <span className="font-medium">{getStatusLabel(currentStatus)}</span>
        </div>

        {/* Break countdown */}
        {currentStatus === HotlineOperatorStatusStatus.Break && breakTimeRemaining !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('breakTimeRemaining')}</span>
              <span className="font-mono">{formatBreakTime(breakTimeRemaining)}</span>
            </div>
            <Progress
              value={(breakTimeRemaining / (15 * 60)) * 100}
              className="h-2"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onEndBreak}
            >
              {t('endBreak')}
            </Button>
          </div>
        )}

        {/* Status controls */}
        {isOnShift && currentStatus !== HotlineOperatorStatusStatus.Break && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={currentStatus === HotlineOperatorStatusStatus.Available ? 'default' : 'outline'}
              onClick={() => onStatusChange(HotlineOperatorStatusStatus.Available)}
              disabled={isLoading || currentStatus === HotlineOperatorStatusStatus.OnCall}
              className="justify-start"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {t('available')}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isLoading || currentStatus === HotlineOperatorStatusStatus.OnCall}
                  className="justify-start"
                  size="sm"
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {t('break')}
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onStartBreak('short')}>
                  <Clock className="h-4 w-4 mr-2" />
                  {t('shortBreakDuration')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStartBreak('meal')}>
                  <Coffee className="h-4 w-4 mr-2" />
                  {t('mealBreakDuration')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStartBreak('personal')}>
                  <Pause className="h-4 w-4 mr-2" />
                  {t('personalBreakDuration')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={currentStatus === HotlineOperatorStatusStatus.WrapUp ? 'default' : 'outline'}
              onClick={() => onStatusChange(HotlineOperatorStatusStatus.WrapUp)}
              disabled={isLoading}
              className="justify-start"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-2" />
              {t('wrapUp')}
            </Button>

            <Button
              variant="outline"
              onClick={onEndShift}
              disabled={isLoading || currentStatus === HotlineOperatorStatusStatus.OnCall}
              className="justify-start text-destructive hover:text-destructive"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('endShift')}
            </Button>
          </div>
        )}

        {/* Start shift button */}
        {!isOnShift && (
          <Button
            onClick={onStartShift}
            disabled={isLoading}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {t('startShift')}
          </Button>
        )}

        {/* Shift stats */}
        {shiftStats && (
          <div className="pt-4 border-t space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('callsHandled')}:</span>
                <span className="font-medium">{shiftStats.callCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('avgDuration')}:</span>
                <span className="font-medium">
                  {shiftStats.avgCallDuration > 0
                    ? `${Math.floor(shiftStats.avgCallDuration / 60)}m`
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        {isOnShift && currentStatus === HotlineOperatorStatusStatus.OnCall && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {t('shortcuts')}: M = {t('mute')}, H = {t('hold')}, T = {t('transfer')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OperatorStatusCard;
