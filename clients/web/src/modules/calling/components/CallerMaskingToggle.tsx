/**
 * Caller Masking Toggle
 * Toggle to reveal/mask caller phone number with audit warning
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, EyeOff, AlertTriangle, Copy, Check } from 'lucide-react';

interface CallerMaskingToggleProps {
  callSid: string;
  maskedPhone: string;
  onReveal: (callSid: string) => Promise<string>;
  className?: string;
}

export function CallerMaskingToggle({
  callSid,
  maskedPhone,
  onReveal,
  className,
}: CallerMaskingToggleProps) {
  const { t } = useTranslation('calling');
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRevealClick = () => {
    if (!isRevealed) {
      setShowConfirm(true);
    } else {
      // Toggle back to masked
      setIsRevealed(false);
    }
  };

  const handleConfirmReveal = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const phone = await onReveal(callSid);
      setRevealedPhone(phone);
      setIsRevealed(true);
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('revealFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (revealedPhone) {
      await navigator.clipboard.writeText(revealedPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayPhone = isRevealed && revealedPhone ? revealedPhone : maskedPhone;

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        <span className="font-mono text-sm">{displayPhone}</span>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRevealClick}
              >
                {isRevealed ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRevealed ? t('maskNumber') : t('revealNumber')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isRevealed && revealedPhone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? t('copied') : t('copyNumber')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('revealCallerNumber')}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>{t('revealCallerWarning')}</p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm">
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('revealAuditNote1')}</li>
                  <li>{t('revealAuditNote2')}</li>
                  <li>{t('revealAuditNote3')}</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="text-red-500 text-sm text-center p-3 bg-red-500/10 rounded-lg">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isLoading}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmReveal}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <span className="animate-pulse">{t('revealing')}</span>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  {t('confirmReveal')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Standalone masked phone display without reveal capability
 */
export function MaskedPhone({
  phone,
  className,
}: {
  phone: string;
  className?: string;
}) {
  return (
    <span className={cn('font-mono text-sm', className)}>
      {phone}
    </span>
  );
}

export default CallerMaskingToggle;
