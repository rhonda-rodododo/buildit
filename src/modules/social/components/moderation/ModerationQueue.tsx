/**
 * ModerationQueue Component
 * Admin view for reviewing content reports and moderation actions
 */

import { FC, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  CheckCircle2,
  XCircle,
  Flag,
  Clock,
  User,
  FileText,
  MessageSquare,
  Image as ImageIcon,
  Shield,
  Ban,
  Eye,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { ContentReport } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ModerationQueueProps {
  className?: string;
}

const REPORT_ICONS: Record<ContentReport['reportedContentType'], React.ReactNode> = {
  post: <FileText className="w-4 h-4" />,
  comment: <MessageSquare className="w-4 h-4" />,
  story: <ImageIcon className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  message: <MessageSquare className="w-4 h-4" />,
};

const STATUS_BADGES: Record<ContentReport['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { variant: 'default', label: 'Pending Review' },
  reviewed: { variant: 'secondary', label: 'Reviewed' },
  actioned: { variant: 'destructive', label: 'Action Taken' },
  dismissed: { variant: 'outline', label: 'Dismissed' },
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  'hate-speech': 'Hate Speech',
  violence: 'Violence',
  misinformation: 'Misinformation',
  'illegal-content': 'Illegal Content',
  impersonation: 'Impersonation',
  'self-harm': 'Self-Harm',
  other: 'Other',
};

export const ModerationQueue: FC<ModerationQueueProps> = ({ className }) => {
  const {
    reports,
    getPendingReports,
    reviewReport,
    blockUser,
    loadModerationData,
    moderationLogs,
  } = useSocialStore();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadModerationData();
      setIsLoading(false);
    };
    load();
  }, [loadModerationData]);

  const pendingReports = getPendingReports();
  const reviewedReports = reports.filter((r) => r.status !== 'pending');

  const handleAction = async (
    report: ContentReport,
    status: ContentReport['status'],
    action?: string
  ) => {
    setIsProcessing(true);
    try {
      await reviewReport(report.id, status, action || actionNotes || undefined);

      // If taking action, also block the user
      if (status === 'actioned') {
        await blockUser(report.reportedPubkey, `Blocked after report: ${report.reason}`);
      }

      toast.success(
        status === 'dismissed'
          ? 'Report dismissed'
          : status === 'actioned'
          ? 'Action taken and user blocked'
          : 'Report reviewed'
      );

      setSelectedReport(null);
      setActionNotes('');
    } catch (error) {
      console.error('Failed to process report:', error);
      toast.error('Failed to process report');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Moderation Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            Review and take action on reported content
          </p>
        </div>
        {pendingReports.length > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingReports.length} pending
          </Badge>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending
            {pendingReports.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingReports.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Reviewed
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  There are no pending reports to review.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onReview={() => setSelectedReport(report)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          {reviewedReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No reviewed reports</h3>
                <p className="text-muted-foreground">
                  Reviewed reports will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            reviewedReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                showStatus
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-2">
          {moderationLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No activity yet</h3>
                <p className="text-muted-foreground">
                  Moderation actions will be logged here.
                </p>
              </CardContent>
            </Card>
          ) : (
            moderationLogs.slice(0, 50).map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{log.action}</Badge>
                    <span className="text-sm">
                      {log.targetPubkey
                        ? `User: ${log.targetPubkey.slice(0, 8)}...`
                        : log.targetContentId
                        ? `Content: ${log.targetContentId.slice(0, 8)}...`
                        : 'System action'}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </span>
                </div>
                {log.reason && (
                  <p className="text-sm text-muted-foreground mt-2">{log.reason}</p>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              Review Report
            </DialogTitle>
            <DialogDescription>
              Take action on this reported content
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Report details */}
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {REPORT_ICONS[selectedReport.reportedContentType]}
                  <span className="font-medium capitalize">
                    {selectedReport.reportedContentType} Report
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Reason:</strong>{' '}
                    <Badge variant="outline">
                      {REASON_LABELS[selectedReport.reason] || selectedReport.reason}
                    </Badge>
                  </p>
                  <p>
                    <strong>Reported by:</strong>{' '}
                    {selectedReport.reporterPubkey.slice(0, 12)}...
                  </p>
                  <p>
                    <strong>Reported user:</strong>{' '}
                    {selectedReport.reportedPubkey.slice(0, 12)}...
                  </p>
                  <p>
                    <strong>Submitted:</strong>{' '}
                    {formatDistanceToNow(selectedReport.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {selectedReport.description && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm font-medium">Additional details:</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Action notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleAction(selectedReport!, 'dismissed')}
              disabled={isProcessing}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Dismiss
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction(selectedReport!, 'reviewed')}
              disabled={isProcessing}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              Mark Reviewed
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction(selectedReport!, 'actioned', 'User blocked')}
              disabled={isProcessing}
              className="flex-1"
            >
              <Ban className="w-4 h-4 mr-2" />
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Report card component
interface ReportCardProps {
  report: ContentReport;
  onReview?: () => void;
  showStatus?: boolean;
}

const ReportCard: FC<ReportCardProps> = ({ report, onReview, showStatus }) => {
  const statusBadge = STATUS_BADGES[report.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {REPORT_ICONS[report.reportedContentType]}
            <CardTitle className="text-base capitalize">
              {report.reportedContentType} Report
            </CardTitle>
            <Badge variant="outline">
              {REASON_LABELS[report.reason] || report.reason}
            </Badge>
          </div>
          {showStatus && (
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-4 text-xs">
          <span>
            From: {report.reporterPubkey.slice(0, 8)}...
          </span>
          <span>
            Against: {report.reportedPubkey.slice(0, 8)}...
          </span>
          <span>
            {formatDistanceToNow(report.createdAt, { addSuffix: true })}
          </span>
        </CardDescription>
      </CardHeader>
      {(report.description || onReview) && (
        <CardContent className="pt-0">
          {report.description && (
            <p className="text-sm text-muted-foreground mb-3">
              &ldquo;{report.description}&rdquo;
            </p>
          )}
          {onReview && (
            <Button onClick={onReview} size="sm">
              Review Report
            </Button>
          )}
          {report.actionTaken && (
            <p className="text-sm mt-2">
              <strong>Action:</strong> {report.actionTaken}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};
