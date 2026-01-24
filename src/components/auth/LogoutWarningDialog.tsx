/**
 * LogoutWarningDialog Component
 * Warns users if they're about to logout without having a confirmed backup.
 * Provides options to create backup, logout anyway, or cancel.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Download,
  LogOut,
  Shield,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { recoveryPhraseService } from '@/core/backup';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';
import { db } from '@/core/storage/db';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface LogoutWarningDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The identity public key */
  identityPubkey: string;
  /** Called when user confirms logout (can be async) */
  onLogout: () => void | Promise<void>;
  /** Called when user creates backup */
  onBackupCreated?: () => void;
}

type DialogStep = 'warning' | 'show-phrase';

export function LogoutWarningDialog({
  open,
  onOpenChange,
  identityPubkey,
  onLogout,
  onBackupCreated,
}: LogoutWarningDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<DialogStep>('warning');
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShowRecoveryPhrase = async () => {
    setError(null);

    try {
      // Get the private key (must be unlocked)
      const privateKey = secureKeyManager.getPrivateKey(identityPubkey);
      if (!privateKey) {
        setError(
          t(
            'auth.logout.identityLocked',
            'Identity is locked. Please unlock first to view your recovery phrase.'
          )
        );
        return;
      }

      // Generate recovery phrase
      const phrase = recoveryPhraseService.privateKeyToRecoveryPhrase(privateKey);
      setRecoveryPhrase(phrase);
      setStep('show-phrase');
    } catch (err) {
      console.error('Failed to get recovery phrase:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('auth.logout.phraseFailed', 'Failed to get recovery phrase')
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
    try {
      // Mark the identity as having confirmed their backup
      await db.identities.update(identityPubkey, {
        recoveryPhraseShownAt: Date.now(),
        recoveryPhraseConfirmedAt: Date.now(),
      });

      onBackupCreated?.();
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Failed to update backup status:', err);
    }
  };

  const handleLogoutAnyway = async () => {
    await onLogout();
    onOpenChange(false);
    resetState();
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setStep('warning');
    setRecoveryPhrase('');
    setShowPhrase(false);
    setCopied(false);
    setError(null);
  };

  const phraseWords = recoveryPhrase.split(' ');

  // Warning step
  if (step === 'warning') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('auth.logout.warningTitle', 'No Backup Found')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'auth.logout.warningDescription',
                "You haven't created a backup for this account. If you logout and forget your password, you may permanently lose access."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('auth.logout.noRecoveryTitle', 'No Password Reset')}</AlertTitle>
              <AlertDescription>
                {t(
                  'auth.logout.noRecoveryDescription',
                  'BuildIt has no server-side password recovery. Your recovery phrase is the ONLY way to restore your account if you forget your password.'
                )}
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleShowRecoveryPhrase} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {t('auth.logout.createBackupNow', 'Create Backup Now')}
            </Button>

            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogoutAnyway}
                className="flex-1 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('auth.logout.logoutAnyway', 'Logout Anyway')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show recovery phrase step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('auth.logout.saveBackupTitle', 'Save Your Recovery Phrase')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'auth.logout.saveBackupDescription',
              'Write down these 24 words and store them securely. This is your only way to recover your account.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t(
                'auth.logout.phraseWarning',
                'Anyone with this phrase can access your account. Store it securely offline and never share it.'
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                {t('auth.logout.phraseLabel', '24-Word Recovery Phrase')}
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
          <Button variant="outline" onClick={() => setStep('warning')}>
            {t('common.back', 'Back')}
          </Button>
          <Button onClick={handleConfirmBackup}>
            <Check className="h-4 w-4 mr-2" />
            {t('auth.logout.iveSavedIt', "I've Saved My Phrase")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LogoutWarningDialog;
