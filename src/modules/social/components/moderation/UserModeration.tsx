/**
 * UserModeration Component
 * Mute, Block, Report actions for users
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  VolumeX,
  Ban,
  Flag,
  Volume2,
  UserCheck,
  Clock,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { ReportReason, MuteRecord } from '../../types';

interface UserModerationProps {
  targetPubkey: string;
  targetDisplayName?: string;
  trigger?: React.ReactNode;
  onAction?: (action: 'mute' | 'unmute' | 'block' | 'unblock' | 'report') => void;
}

export const UserModeration: FC<UserModerationProps> = ({
  targetPubkey,
  targetDisplayName,
  trigger,
  onAction,
}) => {
  const { t } = useTranslation();
  const {
    muteUser,
    unmuteUser,
    blockUser,
    unblockUser,
    reportContent,
    isMuted,
    isBlocked,
  } = useSocialStore();

  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mute dialog state
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState('1440');
  const [muteScope, setMuteScope] = useState<MuteRecord['muteScope']>('all');

  // Report dialog state
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [reportDescription, setReportDescription] = useState('');

  const userIsMuted = isMuted(targetPubkey);
  const userIsBlocked = isBlocked(targetPubkey);
  const displayName = targetDisplayName || `${targetPubkey.slice(0, 8)}...`;

  const handleMute = async () => {
    setIsProcessing(true);
    try {
      const duration = muteDuration ? parseInt(muteDuration) : undefined;
      await muteUser(targetPubkey, muteReason || undefined, duration, muteScope);
      toast.success(t('userModeration.toasts.muted', { name: displayName }));
      setShowMuteDialog(false);
      resetMuteForm();
      onAction?.('mute');
    } catch (error) {
      console.error('Failed to mute user:', error);
      toast.error(t('userModeration.toasts.muteFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnmute = async () => {
    setIsProcessing(true);
    try {
      await unmuteUser(targetPubkey);
      toast.success(t('userModeration.toasts.unmuted', { name: displayName }));
      onAction?.('unmute');
    } catch (error) {
      console.error('Failed to unmute user:', error);
      toast.error(t('userModeration.toasts.unmuteFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlock = async () => {
    setIsProcessing(true);
    try {
      await blockUser(targetPubkey);
      toast.success(t('userModeration.toasts.blocked', { name: displayName }));
      setShowBlockConfirm(false);
      onAction?.('block');
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error(t('userModeration.toasts.blockFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblock = async () => {
    setIsProcessing(true);
    try {
      await unblockUser(targetPubkey);
      toast.success(t('userModeration.toasts.unblocked', { name: displayName }));
      onAction?.('unblock');
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error(t('userModeration.toasts.unblockFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReport = async () => {
    setIsProcessing(true);
    try {
      await reportContent('user', targetPubkey, targetPubkey, reportReason, reportDescription || undefined);
      toast.success(t('userModeration.toasts.reported'));
      setShowReportDialog(false);
      resetReportForm();
      onAction?.('report');
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast.error(t('userModeration.toasts.reportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const resetMuteForm = () => {
    setMuteReason('');
    setMuteDuration('1440');
    setMuteScope('all');
  };

  const resetReportForm = () => {
    setReportReason('spam');
    setReportDescription('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Mute/Unmute */}
          {userIsMuted ? (
            <DropdownMenuItem onClick={handleUnmute} disabled={isProcessing}>
              <Volume2 className="w-4 h-4 mr-2" />
              {t('userModeration.unmute')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
              <VolumeX className="w-4 h-4 mr-2" />
              {t('userModeration.mute')}
            </DropdownMenuItem>
          )}

          {/* Block/Unblock */}
          {userIsBlocked ? (
            <DropdownMenuItem onClick={handleUnblock} disabled={isProcessing}>
              <UserCheck className="w-4 h-4 mr-2" />
              {t('userModeration.unblock')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowBlockConfirm(true)}
              className="text-destructive"
            >
              <Ban className="w-4 h-4 mr-2" />
              {t('userModeration.block')}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Report */}
          <DropdownMenuItem
            onClick={() => setShowReportDialog(true)}
            className="text-destructive"
          >
            <Flag className="w-4 h-4 mr-2" />
            {t('userModeration.report')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mute Dialog */}
      <Dialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VolumeX className="w-5 h-5" />
              {t('userModeration.muteTitle', { name: displayName })}
            </DialogTitle>
            <DialogDescription>
              {t('userModeration.muteDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('userModeration.duration')}</Label>
              <Select value={muteDuration} onValueChange={setMuteDuration}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">{t('userModeration.durations.1hour')}</SelectItem>
                  <SelectItem value="1440">{t('userModeration.durations.1day')}</SelectItem>
                  <SelectItem value="10080">{t('userModeration.durations.1week')}</SelectItem>
                  <SelectItem value="43200">{t('userModeration.durations.1month')}</SelectItem>
                  <SelectItem value="">{t('userModeration.durations.indefinitely')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('userModeration.whatToMute')}</Label>
              <Select value={muteScope} onValueChange={(v) => setMuteScope(v as MuteRecord['muteScope'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('userModeration.muteScopes.all')}</SelectItem>
                  <SelectItem value="posts">{t('userModeration.muteScopes.posts')}</SelectItem>
                  <SelectItem value="comments">{t('userModeration.muteScopes.comments')}</SelectItem>
                  <SelectItem value="dms">{t('userModeration.muteScopes.dms')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mute-reason">{t('userModeration.reasonOptional')}</Label>
              <Input
                id="mute-reason"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder={t('userModeration.mutePlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMuteDialog(false)}>
              {t('userModeration.cancel')}
            </Button>
            <Button onClick={handleMute} disabled={isProcessing}>
              {isProcessing ? t('userModeration.muting') : t('userModeration.muteUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Confirmation */}
      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-destructive" />
              {t('userModeration.blockTitle', { name: displayName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('userModeration.blockDescription')}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('userModeration.blockEffects.hideContent')}</li>
                <li>{t('userModeration.blockEffects.preventSeeYou')}</li>
                <li>{t('userModeration.blockEffects.preventMessage')}</li>
                <li>{t('userModeration.blockEffects.removeFollower')}</li>
              </ul>
              <p className="mt-2">{t('userModeration.noNotification')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('userModeration.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? t('userModeration.blocking') : t('userModeration.block')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              {t('userModeration.reportTitle', { name: displayName })}
            </DialogTitle>
            <DialogDescription>
              {t('userModeration.reportDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('userModeration.reasonForReporting')}</Label>
              <Select value={reportReason} onValueChange={(v) => setReportReason(v as ReportReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.spam')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.spamDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="harassment">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.harassment')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.harassmentDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="hate-speech">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.hateSpeech')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.hateSpeechDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="violence">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.violence')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.violenceDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="misinformation">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.misinformation')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.misinformationDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="illegal-content">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.illegalContent')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.illegalContentDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="impersonation">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.impersonation')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.impersonationDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="self-harm">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.selfHarm')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.selfHarmDesc')}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div>
                      <div className="font-medium">{t('userModeration.reportReasons.other')}</div>
                      <div className="text-xs text-muted-foreground">{t('userModeration.reportReasons.otherDesc')}</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">{t('userModeration.additionalDetails')}</Label>
              <Textarea
                id="report-description"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder={t('userModeration.reportPlaceholder')}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              {t('userModeration.cancel')}
            </Button>
            <Button
              onClick={handleReport}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? t('userModeration.submitting') : t('userModeration.submitReport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
