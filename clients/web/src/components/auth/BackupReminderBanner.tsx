/**
 * BackupReminderBanner Component
 * Shows a persistent banner for users who imported their account via nsec
 * and skipped the backup flow. Reminds them to save their recovery phrase.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  X,
  Shield,
  Copy,
  Check,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { recoveryPhraseService } from '@/core/backup';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';
import { dal } from '@/core/storage/dal';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// Storage key for snooze timestamp
const SNOOZE_KEY_PREFIX = 'backup-reminder-snoozed-';
const SNOOZE_DURATION_DAYS = 7; // Show again after 7 days

interface BackupReminderBannerProps {
  /** Optional className for positioning */
  className?: string;
}

export function BackupReminderBanner({ className }: BackupReminderBannerProps) {
  const { t } = useTranslation();
  const { currentIdentity, lockState } = useAuthStore();
  const [showBanner, setShowBanner] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = currentIdentity?.publicKey;

  // Check if banner should be shown
  const checkShouldShowBanner = useCallback(async () => {
    if (!publicKey || lockState !== 'unlocked') {
      setShowBanner(false);
      return;
    }

    try {
      // Check snooze status
      const snoozeKey = `${SNOOZE_KEY_PREFIX}${publicKey}`;
      const snoozeUntil = localStorage.getItem(snoozeKey);
      if (snoozeUntil && parseInt(snoozeUntil, 10) > Date.now()) {
        setShowBanner(false);
        return;
      }

      // Check if user needs backup reminder
      const identity = await dal.get<{ importedWithoutBackup?: boolean; recoveryPhraseConfirmedAt?: number; lastBackupAt?: number }>('identities', publicKey);
      if (!identity) {
        setShowBanner(false);
        return;
      }

      // Show banner if:
      // 1. User imported without backup flow (importedWithoutBackup)
      // 2. AND has not confirmed recovery phrase or created backup
      const needsReminder = !!(
        identity.importedWithoutBackup &&
        !identity.recoveryPhraseConfirmedAt &&
        !identity.lastBackupAt
      );

      setShowBanner(needsReminder);
    } catch (err) {
      console.error('Failed to check backup status:', err);
      setShowBanner(false);
    }
  }, [publicKey, lockState]);

  useEffect(() => {
    checkShouldShowBanner();
  }, [checkShouldShowBanner]);

  const handleSnooze = () => {
    if (!publicKey) return;

    // Snooze for 7 days
    const snoozeUntil = Date.now() + SNOOZE_DURATION_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(`${SNOOZE_KEY_PREFIX}${publicKey}`, snoozeUntil.toString());
    setShowBanner(false);
  };

  const handleShowBackup = async () => {
    if (!publicKey) return;
    setError(null);

    try {
      const privateKey = secureKeyManager.getPrivateKey(publicKey);
      if (!privateKey) {
        setError(t('auth.backup.identityLocked', 'Please unlock your identity first.'));
        return;
      }

      const phrase = recoveryPhraseService.privateKeyToRecoveryPhrase(privateKey);
      setRecoveryPhrase(phrase);
      setShowBackupDialog(true);
    } catch (err) {
      console.error('Failed to get recovery phrase:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('auth.backup.phraseFailed', 'Failed to get recovery phrase')
      );
    }
  };

  const handleCopyPhrase = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = recoveryPhrase;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmBackup = async () => {
    if (!publicKey) return;

    try {
      await dal.update('identities', publicKey, {
        recoveryPhraseShownAt: Date.now(),
        recoveryPhraseConfirmedAt: Date.now(),
        importedWithoutBackup: false, // Clear the flag
      });

      setShowBackupDialog(false);
      setShowBanner(false);
      setRecoveryPhrase('');
    } catch (err) {
      console.error('Failed to update backup status:', err);
    }
  };

  const handleCloseDialog = () => {
    setShowBackupDialog(false);
    setRecoveryPhrase('');
    setShowPhrase(false);
    setError(null);
  };

  const phraseWords = recoveryPhrase.split(' ');

  if (!showBanner) {
    return null;
  }

  return (
    <>
      <Alert
        variant="destructive"
        className={cn(
          'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-200',
          className
        )}
      >
        <AlertTriangle className="h-4 w-4 !text-orange-600 dark:!text-orange-400" />
        <AlertTitle className="text-orange-800 dark:text-orange-200">
          {t('auth.backup.reminderTitle', 'Protect Your Account')}
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="flex-1 text-orange-700 dark:text-orange-300">
            {t(
              'auth.backup.reminderDescription',
              'Your account is not backed up. Save your recovery phrase to prevent losing access.'
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleShowBackup}
              className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
            >
              <Shield className="h-4 w-4 mr-1" />
              {t('auth.backup.backupNow', 'Backup Now')}
            </Button>
            <Link to="/app/settings">
              <Button
                size="sm"
                variant="ghost"
                className="text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSnooze}
              className="text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
              aria-label={t('auth.backup.snooze', 'Remind me later')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Backup Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('auth.backup.dialogTitle', 'Save Your Recovery Phrase')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'auth.backup.dialogDescription',
                'This 24-word phrase is the ONLY way to recover your account if you forget your password or lose access to this device.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'auth.backup.phraseWarning',
                  'Write down these words and store them securely offline. Anyone with this phrase can access your account.'
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  {t('auth.backup.phraseLabel', '24-Word Recovery Phrase')}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPhrase(!showPhrase)}
                  className="h-8"
                >
                  {showPhrase ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      {t('auth.recovery.hide', 'Hide')}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      {t('auth.recovery.show', 'Show')}
                    </>
                  )}
                </Button>
              </div>

              <div
                className={cn(
                  'grid grid-cols-4 gap-2 p-4 bg-muted rounded-lg border',
                  !showPhrase && 'blur-sm select-none'
                )}
              >
                {phraseWords.map((word, i) => (
                  <div key={i} className="text-sm py-1">
                    <span className="text-muted-foreground mr-1 font-mono text-xs">{i + 1}.</span>
                    <span className="font-mono">{word}</span>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={handleCopyPhrase}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('auth.recovery.copied', 'Copied!')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('auth.recovery.copyPhrase', 'Copy to Clipboard')}
                  </>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleConfirmBackup}>
              <Check className="h-4 w-4 mr-2" />
              {t('auth.backup.iveSavedIt', "I've Saved My Phrase")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BackupReminderBanner;
