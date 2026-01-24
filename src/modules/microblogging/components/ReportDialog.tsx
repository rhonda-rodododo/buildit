/**
 * Report Dialog Component
 * Epic 61: Report content for moderation review
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import type { ReportReason } from '../types';
import { cn } from '@/lib/utils';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: 'post' | 'comment' | 'user' | 'message' | 'story';
  contentId: string;
  contentAuthorId: string;
  onSuccess?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'spam',
    label: 'Spam',
    description: 'Unsolicited or repetitive content',
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Targeted harassment or bullying',
  },
  {
    value: 'hate_speech',
    label: 'Hate Speech',
    description: 'Content that promotes hatred based on identity',
  },
  {
    value: 'violence',
    label: 'Violence',
    description: 'Threats or promotion of violence',
  },
  {
    value: 'illegal_content',
    label: 'Illegal Content',
    description: 'Content that violates laws',
  },
  {
    value: 'misinformation',
    label: 'Misinformation',
    description: 'False or misleading information',
  },
  {
    value: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
  },
  {
    value: 'copyright',
    label: 'Copyright',
    description: 'Content that infringes on copyrights',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

export function ReportDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentAuthorId,
  onSuccess,
}: ReportDialogProps) {
  const { t } = useTranslation();
  const reportContent = useSocialFeaturesStore((s) => s.reportContent);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await reportContent(
        contentType,
        contentId,
        contentAuthorId,
        reason,
        description.trim() || undefined
      );

      // Reset form
      setReason(null);
      setDescription('');

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason(null);
    setDescription('');
    onOpenChange(false);
  };

  const contentTypeLabel = {
    post: t('report.contentTypes.post', 'post'),
    comment: t('report.contentTypes.comment', 'comment'),
    user: t('report.contentTypes.user', 'user'),
    message: t('report.contentTypes.message', 'message'),
    story: t('report.contentTypes.story', 'story'),
  }[contentType];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            {t('report.title', 'Report {{type}}', { type: contentTypeLabel })}
          </DialogTitle>
          <DialogDescription>
            {t('report.description', 'Help us understand what\'s wrong with this content.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason selection */}
          <div className="space-y-3">
            <Label>{t('report.reason', 'Why are you reporting this?')}</Label>
            <RadioGroup
              value={reason || ''}
              onValueChange={(v) => setReason(v as ReportReason)}
              className="space-y-2"
            >
              {REPORT_REASONS.map((r) => (
                <div
                  key={r.value}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                    reason === r.value && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setReason(r.value)}
                >
                  <RadioGroupItem value={r.value} id={r.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={r.value} className="font-medium cursor-pointer">
                      {t(`report.reasons.${r.value}`, r.label)}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(`report.reasonDescriptions.${r.value}`, r.description)}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label htmlFor="report-description">
              {t('report.additionalInfo', 'Additional information (optional)')}
            </Label>
            <Textarea
              id="report-description"
              placeholder={t('report.additionalInfoPlaceholder', 'Provide any additional context...')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {t(
                'report.privacyNote',
                'Your report is confidential. The reported user will not know who reported them.'
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
          >
            {isSubmitting
              ? t('report.submitting', 'Submitting...')
              : t('report.submit', 'Submit Report')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
