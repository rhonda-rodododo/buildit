/**
 * DeliveryProgress Component
 * Shows real-time delivery progress during newsletter sending
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  Loader2,
  StopCircle,
  Send,
} from 'lucide-react';
import type { DeliveryProgressEvent, NewsletterIssue } from '../types';

interface DeliveryProgressProps {
  issue: NewsletterIssue;
  progress: DeliveryProgressEvent | null;
  isDelivering: boolean;
  onCancel: () => void;
  onClose: () => void;
  className?: string;
}

export const DeliveryProgress: FC<DeliveryProgressProps> = ({
  issue,
  progress,
  isDelivering,
  onCancel,
  onClose,
  className,
}) => {
  const { t } = useTranslation();
  const isComplete = issue.status === 'sent' || issue.status === 'failed';
  const hasFailed = issue.stats.failed > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDelivering ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : isComplete ? (
              hasFailed ? (
                <XCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )
            ) : (
              <Send className="h-5 w-5" />
            )}
            <CardTitle>
              {isDelivering
                ? t('deliveryProgress.sending')
                : isComplete
                ? t('deliveryProgress.complete')
                : t('deliveryProgress.readyToSend')}
            </CardTitle>
          </div>
          {isDelivering && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <StopCircle className="h-4 w-4 mr-2" />
              {t('deliveryProgress.cancel')}
            </Button>
          )}
        </div>
        <CardDescription>
          {issue.subject || t('deliveryProgress.untitled')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t('deliveryProgress.progress')}</span>
            <span className="text-sm text-muted-foreground">
              {progress?.percentComplete || 0}%
            </span>
          </div>
          <Progress
            value={progress?.percentComplete || 0}
            className="h-2"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {progress?.delivered || issue.stats.delivered || 0}
            </p>
            <p className="text-sm text-muted-foreground">{t('deliveryProgress.stats.delivered')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {progress?.pending || issue.stats.pending || 0}
            </p>
            <p className="text-sm text-muted-foreground">{t('deliveryProgress.stats.pending')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {progress?.failed || issue.stats.failed || 0}
            </p>
            <p className="text-sm text-muted-foreground">{t('deliveryProgress.stats.failed')}</p>
          </div>
        </div>

        {/* Current Activity */}
        {isDelivering && progress?.currentPubkey && (
          <div className="text-center py-2 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{t('deliveryProgress.sendingTo')}</p>
            <p className="font-mono text-sm">
              {progress.currentPubkey.slice(0, 8)}...
              {progress.currentPubkey.slice(-8)}
            </p>
          </div>
        )}

        {/* Total */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t('deliveryProgress.totalRecipients', { count: progress?.total || issue.stats.totalRecipients || 0 })}
          </p>
        </div>

        {/* Actions */}
        {isComplete && (
          <div className="flex justify-end pt-4">
            <Button onClick={onClose}>{t('deliveryProgress.close')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
