/**
 * Active Call Controls
 * Control panel for active hotline calls - mute, hold, transfer, escalate, end
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  PhoneForwarded,
  AlertTriangle,
  Users,
  PhoneOff,
  Lock,
  Timer,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { HotlineCallState } from '../types';
import type { OperatorState } from '../services/hotlineQueueManager';

interface ActiveCallControlsProps {
  call: HotlineCallState;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isEncrypted: boolean;
  availableOperators: OperatorState[];
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onTransfer: (targetPubkey: string, reason?: string) => void;
  onEscalate: (reason: string) => void;
  onStartThreeWay: (thirdPartyPubkey: string) => void;
  onEndCall: (summary: string) => void;
}

export function ActiveCallControls({
  call,
  callDuration,
  isMuted,
  isOnHold,
  isEncrypted,
  availableOperators,
  onMuteToggle,
  onHoldToggle,
  onTransfer,
  onEscalate,
  onStartThreeWay,
  onEndCall,
}: ActiveCallControlsProps) {
  const { t } = useTranslation('calling');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [transferReason, setTransferReason] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [endSummary, setEndSummary] = useState('');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const callerName = call.caller?.name || call.caller?.phone || t('unknownCaller');
  const callerInitials = callerName.slice(0, 2).toUpperCase();

  const handleTransfer = () => {
    if (transferTarget) {
      onTransfer(transferTarget, transferReason || undefined);
      setShowTransferDialog(false);
      setTransferTarget('');
      setTransferReason('');
    }
  };

  const handleEscalate = () => {
    if (escalateReason) {
      onEscalate(escalateReason);
      setShowEscalateDialog(false);
      setEscalateReason('');
    }
  };

  const handleEndCall = () => {
    onEndCall(endSummary);
    setShowEndDialog(false);
    setEndSummary('');
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Caller info header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">{callerInitials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{callerName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {call.callType === 'pstn' && (
                  <Badge variant="outline">{t('phoneCall')}</Badge>
                )}
                {call.callType === 'internal' && (
                  <Badge variant="outline">{t('buildItCall')}</Badge>
                )}
                {isEncrypted && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    {t('e2ee')}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="text-right">
            <div className="flex items-center gap-2 text-2xl font-mono">
              <Timer className="h-5 w-5 text-muted-foreground" />
              {formatDuration(callDuration)}
            </div>
            {isOnHold && (
              <Badge variant="secondary" className="mt-1">
                {t('onHold')}
              </Badge>
            )}
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {/* Mute */}
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="lg"
            onClick={onMuteToggle}
            className="w-24 flex-col h-auto py-3"
          >
            {isMuted ? (
              <MicOff className="h-6 w-6 mb-1" />
            ) : (
              <Mic className="h-6 w-6 mb-1" />
            )}
            <span className="text-xs">{isMuted ? t('unmute') : t('mute')}</span>
          </Button>

          {/* Hold */}
          <Button
            variant={isOnHold ? 'default' : 'outline'}
            size="lg"
            onClick={onHoldToggle}
            className="w-24 flex-col h-auto py-3"
          >
            {isOnHold ? (
              <Play className="h-6 w-6 mb-1" />
            ) : (
              <Pause className="h-6 w-6 mb-1" />
            )}
            <span className="text-xs">{isOnHold ? t('resume') : t('hold')}</span>
          </Button>

          {/* Transfer */}
          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="w-24 flex-col h-auto py-3"
                disabled={availableOperators.length === 0}
              >
                <PhoneForwarded className="h-6 w-6 mb-1" />
                <span className="text-xs">{t('transfer')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('transferCall')}</DialogTitle>
                <DialogDescription>
                  {t('transferCallDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('transferTo')}</label>
                  <Select value={transferTarget} onValueChange={setTransferTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectOperator')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map((op) => (
                        <SelectItem key={op.pubkey} value={op.pubkey}>
                          {op.displayName || op.pubkey.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('transferReason')}</label>
                  <Textarea
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder={t('transferReasonPlaceholder')}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleTransfer} disabled={!transferTarget}>
                  {t('transfer')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* End Call */}
          <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                className="w-24 flex-col h-auto py-3"
              >
                <PhoneOff className="h-6 w-6 mb-1" />
                <span className="text-xs">{t('end')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('endCall')}</DialogTitle>
                <DialogDescription>
                  {t('endCallDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <label className="text-sm font-medium">{t('callSummary')}</label>
                <Textarea
                  value={endSummary}
                  onChange={(e) => setEndSummary(e.target.value)}
                  placeholder={t('callSummaryPlaceholder')}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEndDialog(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="destructive" onClick={handleEndCall}>
                  {t('endCall')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center justify-center gap-2">
          {/* Escalate */}
          <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('escalate')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('escalateCall')}</DialogTitle>
                <DialogDescription>
                  {t('escalateCallDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <label className="text-sm font-medium">{t('escalateReason')}</label>
                <Textarea
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder={t('escalateReasonPlaceholder')}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEscalateDialog(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="default"
                  onClick={handleEscalate}
                  disabled={!escalateReason}
                >
                  {t('escalate')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 3-Way Call */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4 mr-2" />
                {t('threeWay')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableOperators.length === 0 ? (
                <DropdownMenuItem disabled>
                  {t('noOperatorsAvailable')}
                </DropdownMenuItem>
              ) : (
                availableOperators.map((op) => (
                  <DropdownMenuItem
                    key={op.pubkey}
                    onClick={() => onStartThreeWay(op.pubkey)}
                  >
                    {op.displayName || op.pubkey.slice(0, 8)}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                {t('recordCall')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                {t('viewCallerHistory')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            M = {t('mute')} | H = {t('hold')} | T = {t('transfer')} | E = {t('escalate')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActiveCallControls;
