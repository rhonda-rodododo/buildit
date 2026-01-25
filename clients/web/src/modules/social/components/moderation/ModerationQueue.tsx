/**
 * ModerationQueue Component
 * Admin view for reviewing content reports and moderation actions
 */

import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const getStatusBadgeLabel = (status: ContentReport['status'], t: (key: string) => string): string => {
  switch (status) {
    case 'pending': return t('moderationQueue.pendingReview');
    case 'reviewed': return t('moderationQueue.reviewed');
    case 'actioned': return t('moderationQueue.actionTaken');
    case 'dismissed': return t('moderationQueue.dismissed');
  }
};

const STATUS_BADGES: Record<ContentReport['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { variant: 'default' },
  reviewed: { variant: 'secondary' },
  actioned: { variant: 'destructive' },
  dismissed: { variant: 'outline' },
};

export const ModerationQueue: FC<ModerationQueueProps> = ({ className }) => {
  const { t } = useTranslation();
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
          ? t('moderationQueue.dismissedToast')
          : status === 'actioned'
          ? t('moderationQueue.actionedToast')
          : t('moderationQueue.reviewedToast')
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
            {t('moderationQueue.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('moderationQueue.description')}
          </p>
        </div>
        {pendingReports.length > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingReports.length} {t('moderationQueue.pending')}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('moderationQueue.pendingTab')}
            {pendingReports.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingReports.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {t('moderationQueue.reviewedTab')}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('moderationQueue.activityLog')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{t('moderationQueue.allCaughtUp')}</h3>
                <p className="text-muted-foreground">
                  {t('moderationQueue.noPendingReports')}
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
                <h3 className="font-semibold text-lg mb-2">{t('moderationQueue.noReviewedReports')}</h3>
                <p className="text-muted-foreground">
                  {t('moderationQueue.reviewedAppear')}
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
                <h3 className="font-semibold text-lg mb-2">{t('moderationQueue.noActivity')}</h3>
                <p className="text-muted-foreground">
                  {t('moderationQueue.actionsLogged')}
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
                        ? `${t('moderationQueue.user')} ${log.targetPubkey.slice(0, 8)}...`
                        : log.targetContentId
                        ? `${t('moderationQueue.content')} ${log.targetContentId.slice(0, 8)}...`
                        : t('moderationQueue.systemAction')}
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
              {t('moderationQueue.reviewReport')}
            </DialogTitle>
            <DialogDescription>
              {t('moderationQueue.takeAction')}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Report details */}
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {REPORT_ICONS[selectedReport.reportedContentType]}
                  <span className="font-medium capitalize">
                    {t(`moderationQueue.contentTypes.${selectedReport.reportedContentType}`)} {t('moderationQueue.report')}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>{t('moderationQueue.reason')}</strong>{' '}
                    <Badge variant="outline">
                      {t(`moderationQueue.reasons.${selectedReport.reason}`, selectedReport.reason)}
                    </Badge>
                  </p>
                  <p>
                    <strong>{t('moderationQueue.reportedBy')}</strong>{' '}
                    {selectedReport.reporterPubkey.slice(0, 12)}...
                  </p>
                  <p>
                    <strong>{t('moderationQueue.reportedUser')}</strong>{' '}
                    {selectedReport.reportedPubkey.slice(0, 12)}...
                  </p>
                  <p>
                    <strong>{t('moderationQueue.submitted')}</strong>{' '}
                    {formatDistanceToNow(selectedReport.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {selectedReport.description && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm font-medium">{t('moderationQueue.additionalDetails')}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Action notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('moderationQueue.notes')}</label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={t('moderationQueue.notesPlaceholder')}
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
              {t('moderationQueue.dismiss')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction(selectedReport!, 'reviewed')}
              disabled={isProcessing}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('moderationQueue.markReviewed')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction(selectedReport!, 'actioned', 'User blocked')}
              disabled={isProcessing}
              className="flex-1"
            >
              <Ban className="w-4 h-4 mr-2" />
              {t('moderationQueue.blockUser')}
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
  const { t } = useTranslation();
  const statusBadge = STATUS_BADGES[report.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {REPORT_ICONS[report.reportedContentType]}
            <CardTitle className="text-base capitalize">
              {t(`moderationQueue.contentTypes.${report.reportedContentType}`)} {t('moderationQueue.report')}
            </CardTitle>
            <Badge variant="outline">
              {t(`moderationQueue.reasons.${report.reason}`, report.reason)}
            </Badge>
          </div>
          {showStatus && (
            <Badge variant={statusBadge.variant}>{getStatusBadgeLabel(report.status, t)}</Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-4 text-xs">
          <span>
            {t('moderationQueue.from')} {report.reporterPubkey.slice(0, 8)}...
          </span>
          <span>
            {t('moderationQueue.against')} {report.reportedPubkey.slice(0, 8)}...
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
              {t('moderationQueue.reviewReportButton')}
            </Button>
          )}
          {report.actionTaken && (
            <p className="text-sm mt-2">
              <strong>{t('moderationQueue.action')}</strong> {report.actionTaken}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};
