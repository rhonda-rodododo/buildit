/**
 * UserModeration Component
 * Mute, Block, Report actions for users
 */

import { FC, useState } from 'react';
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

const MUTE_DURATIONS = [
  { value: '60', label: '1 hour' },
  { value: '1440', label: '1 day' },
  { value: '10080', label: '1 week' },
  { value: '43200', label: '1 month' },
  { value: '', label: 'Indefinitely' },
];

const MUTE_SCOPES: { value: MuteRecord['muteScope']; label: string }[] = [
  { value: 'all', label: 'All content (posts, comments, DMs)' },
  { value: 'posts', label: 'Posts only' },
  { value: 'comments', label: 'Comments only' },
  { value: 'dms', label: 'Direct messages only' },
];

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: 'Spam', description: 'Repetitive or unwanted content' },
  { value: 'harassment', label: 'Harassment', description: 'Targeting or intimidating behavior' },
  { value: 'hate-speech', label: 'Hate Speech', description: 'Content that promotes discrimination' },
  { value: 'violence', label: 'Violence', description: 'Content promoting violence or harm' },
  { value: 'misinformation', label: 'Misinformation', description: 'False or misleading information' },
  { value: 'illegal-content', label: 'Illegal Content', description: 'Content that may be illegal' },
  { value: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { value: 'self-harm', label: 'Self-Harm', description: 'Content promoting self-harm' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

export const UserModeration: FC<UserModerationProps> = ({
  targetPubkey,
  targetDisplayName,
  trigger,
  onAction,
}) => {
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
      toast.success(`${displayName} has been muted`);
      setShowMuteDialog(false);
      resetMuteForm();
      onAction?.('mute');
    } catch (error) {
      console.error('Failed to mute user:', error);
      toast.error('Failed to mute user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnmute = async () => {
    setIsProcessing(true);
    try {
      await unmuteUser(targetPubkey);
      toast.success(`${displayName} has been unmuted`);
      onAction?.('unmute');
    } catch (error) {
      console.error('Failed to unmute user:', error);
      toast.error('Failed to unmute user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlock = async () => {
    setIsProcessing(true);
    try {
      await blockUser(targetPubkey);
      toast.success(`${displayName} has been blocked`);
      setShowBlockConfirm(false);
      onAction?.('block');
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error('Failed to block user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblock = async () => {
    setIsProcessing(true);
    try {
      await unblockUser(targetPubkey);
      toast.success(`${displayName} has been unblocked`);
      onAction?.('unblock');
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReport = async () => {
    setIsProcessing(true);
    try {
      await reportContent('user', targetPubkey, targetPubkey, reportReason, reportDescription || undefined);
      toast.success('Report submitted. Thank you for helping keep the community safe.');
      setShowReportDialog(false);
      resetReportForm();
      onAction?.('report');
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast.error('Failed to submit report');
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
              Unmute
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
              <VolumeX className="w-4 h-4 mr-2" />
              Mute
            </DropdownMenuItem>
          )}

          {/* Block/Unblock */}
          {userIsBlocked ? (
            <DropdownMenuItem onClick={handleUnblock} disabled={isProcessing}>
              <UserCheck className="w-4 h-4 mr-2" />
              Unblock
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowBlockConfirm(true)}
              className="text-destructive"
            >
              <Ban className="w-4 h-4 mr-2" />
              Block
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Report */}
          <DropdownMenuItem
            onClick={() => setShowReportDialog(true)}
            className="text-destructive"
          >
            <Flag className="w-4 h-4 mr-2" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mute Dialog */}
      <Dialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VolumeX className="w-5 h-5" />
              Mute {displayName}
            </DialogTitle>
            <DialogDescription>
              Their content will be hidden from your feed. They won&apos;t be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={muteDuration} onValueChange={setMuteDuration}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {MUTE_DURATIONS.map((duration) => (
                    <SelectItem key={duration.value} value={duration.value}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>What to mute</Label>
              <Select value={muteScope} onValueChange={(v) => setMuteScope(v as MuteRecord['muteScope'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUTE_SCOPES.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mute-reason">Reason (optional)</Label>
              <Input
                id="mute-reason"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="Why are you muting this user?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMuteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMute} disabled={isProcessing}>
              {isProcessing ? 'Muting...' : 'Mute User'}
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
              Block {displayName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Blocking will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Hide all their content from you</li>
                <li>Prevent them from seeing your content</li>
                <li>Prevent them from messaging you</li>
                <li>Remove them from your followers</li>
              </ul>
              <p className="mt-2">They won&apos;t be notified that you blocked them.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Blocking...' : 'Block'}
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
              Report {displayName}
            </DialogTitle>
            <DialogDescription>
              Help us understand what&apos;s wrong. Your report is confidential.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for reporting</Label>
              <Select value={reportReason} onValueChange={(v) => setReportReason(v as ReportReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      <div>
                        <div className="font-medium">{reason.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {reason.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">Additional details (optional)</Label>
              <Textarea
                id="report-description"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Provide more context about why you're reporting this user..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
