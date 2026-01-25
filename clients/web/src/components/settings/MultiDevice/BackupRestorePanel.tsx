/**
 * Backup & Restore Panel
 * UI for creating encrypted backups and restoring from recovery phrase
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Download,
  Upload,
  Shield,
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  FileDown,
} from 'lucide-react';
import { backupService, recoveryPhraseService } from '@/core/backup';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';
import { useTranslation } from 'react-i18next';

interface BackupRestorePanelProps {
  identityPubkey: string;
}

export function BackupRestorePanel({ identityPubkey }: BackupRestorePanelProps) {
  const { t } = useTranslation();
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('settings.backup.title', 'Backup & Recovery')}
        </CardTitle>
        <CardDescription>
          {t('settings.backup.description', 'Protect your identity with encrypted backups and recovery phrases')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Create Backup */}
          <Dialog open={showCreateBackup} onOpenChange={setShowCreateBackup}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-4 w-4" />
                  <span className="font-medium">{t('settings.backup.create', 'Create Backup')}</span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {t('settings.backup.createDesc', 'Generate encrypted backup file with recovery phrase')}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <CreateBackupDialog
                identityPubkey={identityPubkey}
                onClose={() => setShowCreateBackup(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Restore from Backup */}
          <Dialog open={showRestore} onOpenChange={setShowRestore}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Upload className="h-4 w-4" />
                  <span className="font-medium">{t('settings.backup.restore', 'Restore Backup')}</span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {t('settings.backup.restoreDesc', 'Recover identity from backup file or recovery phrase')}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <RestoreBackupDialog onClose={() => setShowRestore(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* View Recovery Phrase */}
        <Dialog open={showRecoveryPhrase} onOpenChange={setShowRecoveryPhrase}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <KeyRound className="h-4 w-4 mr-2" />
              {t('settings.backup.viewPhrase', 'View Recovery Phrase')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <ViewRecoveryPhraseDialog
              identityPubkey={identityPubkey}
              onClose={() => setShowRecoveryPhrase(false)}
            />
          </DialogContent>
        </Dialog>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('settings.backup.importantTitle', 'Important')}</AlertTitle>
          <AlertDescription>
            {t('settings.backup.importantDesc', 'Your recovery phrase is the ONLY way to recover your identity if you lose access to all your devices. Store it securely offline.')}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// Create Backup Dialog
function CreateBackupDialog({
  identityPubkey,
  onClose,
}: {
  identityPubkey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'options' | 'phrase' | 'download'>('options');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includeGroups, setIncludeGroups] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [backupData, setBackupData] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [phraseCopied, setPhraseCopied] = useState(false);

  const handleGenerateBackup = async () => {
    if (password !== confirmPassword) {
      setError(t('settings.backup.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (password.length < 8) {
      setError(t('settings.backup.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }

    setError('');

    try {
      // Get the private key (requires unlock)
      const privateKey = secureKeyManager.getPrivateKey(identityPubkey);
      if (!privateKey) {
        setError(t('settings.backup.identityLocked', 'Identity is locked. Please unlock first.'));
        return;
      }

      // Generate recovery phrase from private key
      const phrase = recoveryPhraseService.privateKeyToRecoveryPhrase(privateKey);
      setRecoveryPhrase(phrase);

      // Create the backup
      const backup = await backupService.createBackup(identityPubkey, privateKey, phrase, {
        includeContacts,
        includeGroups,
      });

      setBackupData(JSON.stringify(backup, null, 2));
      setStep('phrase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    }
  };

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(recoveryPhrase);
    setPhraseCopied(true);
    setTimeout(() => setPhraseCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!backupData) return;

    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buildit-backup-${identityPubkey.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const phraseWords = recoveryPhrase.split(' ');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.backup.createTitle', 'Create Encrypted Backup')}</DialogTitle>
        <DialogDescription>
          {step === 'options' && t('settings.backup.createStep1', 'Configure your backup options')}
          {step === 'phrase' && t('settings.backup.createStep2', 'Save your recovery phrase')}
          {step === 'download' && t('settings.backup.createStep3', 'Download your backup file')}
        </DialogDescription>
      </DialogHeader>

      {step === 'options' && (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('settings.backup.encryptionPassword', 'Encryption Password')}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('settings.backup.passwordPlaceholder', 'Enter a strong password')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('settings.backup.confirmPassword', 'Confirm Password')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.backup.confirmPlaceholder', 'Confirm your password')}
            />
          </div>

          <div className="space-y-3">
            <Label>{t('settings.backup.includeTitle', 'Include in Backup')}</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="contacts"
                checked={includeContacts}
                onCheckedChange={(checked) => setIncludeContacts(checked as boolean)}
              />
              <label htmlFor="contacts" className="text-sm">
                {t('settings.backup.includeContacts', 'Contacts')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="groups"
                checked={includeGroups}
                onCheckedChange={(checked) => setIncludeGroups(checked as boolean)}
              />
              <label htmlFor="groups" className="text-sm">
                {t('settings.backup.includeGroups', 'Groups')}
              </label>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {step === 'phrase' && (
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('settings.backup.writePhraseTitle', 'Write Down Your Recovery Phrase')}</AlertTitle>
            <AlertDescription>
              {t('settings.backup.writePhraseDesc', 'This phrase is the ONLY way to recover your backup. Write it down and store it securely.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('settings.backup.recoveryPhrase', '24-Word Recovery Phrase')}</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPhrase(!showPhrase)}>
                {showPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <div className={`grid grid-cols-4 gap-2 p-4 bg-muted rounded-lg ${!showPhrase ? 'blur-sm select-none' : ''}`}>
              {phraseWords.map((word, i) => (
                <div key={i} className="text-sm">
                  <span className="text-muted-foreground mr-1">{i + 1}.</span>
                  <span className="font-mono">{word}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={handleCopyPhrase}>
              {phraseCopied ? (
                <><Check className="h-4 w-4 mr-2" /> {t('settings.backup.copied', 'Copied!')}</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" /> {t('settings.backup.copyPhrase', 'Copy to Clipboard')}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'download' && (
        <div className="space-y-4 py-4 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.backup.readyTitle', 'Backup Ready!')}</p>
          <p className="text-muted-foreground">
            {t('settings.backup.readyDesc', 'Your encrypted backup is ready to download.')}
          </p>
          <Button onClick={handleDownload} className="w-full">
            <FileDown className="h-4 w-4 mr-2" />
            {t('settings.backup.downloadButton', 'Download Backup File')}
          </Button>
        </div>
      )}

      <DialogFooter>
        {step === 'options' && (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleGenerateBackup} disabled={!password || !confirmPassword}>
              {t('common.continue', 'Continue')}
            </Button>
          </>
        )}
        {step === 'phrase' && (
          <>
            <Button variant="outline" onClick={() => setStep('options')}>
              {t('common.back', 'Back')}
            </Button>
            <Button onClick={() => setStep('download')}>
              {t('settings.backup.iveSavedIt', "I've Saved My Phrase")}
            </Button>
          </>
        )}
        {step === 'download' && (
          <Button onClick={onClose}>
            {t('common.done', 'Done')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

// Restore Backup Dialog
function RestoreBackupDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'phrase' | 'password' | 'complete'>('upload');
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [phraseValidation, setPhraseValidation] = useState<{ isValid: boolean; invalidWords: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackupFile(file);
      setError('');
    }
  };

  const handlePhraseChange = (phrase: string) => {
    setRecoveryPhrase(phrase);
    const validation = recoveryPhraseService.validatePhrase(phrase);
    setPhraseValidation({
      isValid: validation.isValid,
      invalidWords: validation.invalidWords || [],
    });
  };

  const handleRestore = async () => {
    if (newPassword !== confirmPassword) {
      setError(t('settings.backup.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('settings.backup.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }

    if (!backupFile) {
      setError(t('settings.backup.noFile', 'Please select a backup file'));
      return;
    }

    setIsRestoring(true);
    setError('');

    try {
      const fileContent = await backupFile.text();
      const backup = backupService.parseBackupFile(fileContent);

      // Restore returns identity and contents - we would use these to add the identity to the auth store
      await backupService.restoreBackup(
        backup,
        recoveryPhrase,
        newPassword
      );

      // TODO: Add the restored identity to the auth store
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.backup.restoreTitle', 'Restore from Backup')}</DialogTitle>
        <DialogDescription>
          {step === 'upload' && t('settings.backup.restoreStep1', 'Select your backup file')}
          {step === 'phrase' && t('settings.backup.restoreStep2', 'Enter your recovery phrase')}
          {step === 'password' && t('settings.backup.restoreStep3', 'Set a new password')}
          {step === 'complete' && t('settings.backup.restoreStep4', 'Restore complete!')}
        </DialogDescription>
      </DialogHeader>

      {step === 'upload' && (
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.backup.dropFile', 'Drop your backup file here or click to browse')}
            </p>
            <Input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="max-w-xs mx-auto"
            />
          </div>

          {backupFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <FileDown className="h-4 w-4" />
              <span className="text-sm">{backupFile.name}</span>
              <Badge variant="secondary">{(backupFile.size / 1024).toFixed(1)} KB</Badge>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {step === 'phrase' && (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('settings.backup.enterPhrase', 'Enter Your 24-Word Recovery Phrase')}</Label>
            <Textarea
              value={recoveryPhrase}
              onChange={(e) => handlePhraseChange(e.target.value)}
              placeholder={t('settings.backup.phrasePlaceholder', 'word1 word2 word3 ...')}
              className="h-24 font-mono"
            />
            {phraseValidation && (
              <div className="text-sm">
                {phraseValidation.isValid ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <Check className="h-4 w-4" /> {t('settings.backup.phraseValid', 'Valid recovery phrase')}
                  </span>
                ) : (
                  <span className="text-destructive">
                    {phraseValidation.invalidWords.length > 0
                      ? t('settings.backup.invalidWords', 'Invalid words: ') + phraseValidation.invalidWords.join(', ')
                      : t('settings.backup.invalidPhrase', 'Invalid phrase. Must be 24 words.')}
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('settings.backup.newPassword', 'New Password')}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.backup.newPasswordPlaceholder', 'Enter a password for this device')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('settings.backup.confirmNewPassword', 'Confirm Password')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.backup.confirmPlaceholder', 'Confirm your password')}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-4 py-4 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.backup.restoreComplete', 'Identity Restored!')}</p>
          <p className="text-muted-foreground">
            {t('settings.backup.restoreCompleteDesc', 'Your identity has been successfully restored from the backup.')}
          </p>
        </div>
      )}

      <DialogFooter>
        {step === 'upload' && (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => setStep('phrase')} disabled={!backupFile}>
              {t('common.continue', 'Continue')}
            </Button>
          </>
        )}
        {step === 'phrase' && (
          <>
            <Button variant="outline" onClick={() => setStep('upload')}>
              {t('common.back', 'Back')}
            </Button>
            <Button onClick={() => setStep('password')} disabled={!phraseValidation?.isValid}>
              {t('common.continue', 'Continue')}
            </Button>
          </>
        )}
        {step === 'password' && (
          <>
            <Button variant="outline" onClick={() => setStep('phrase')}>
              {t('common.back', 'Back')}
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring || !newPassword || !confirmPassword}>
              {isRestoring ? t('settings.backup.restoring', 'Restoring...') : t('settings.backup.restoreButton', 'Restore Identity')}
            </Button>
          </>
        )}
        {step === 'complete' && (
          <Button onClick={onClose}>
            {t('common.done', 'Done')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

// View Recovery Phrase Dialog
function ViewRecoveryPhraseDialog({
  identityPubkey,
  onClose,
}: {
  identityPubkey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleVerify = async () => {
    try {
      const privateKey = secureKeyManager.getPrivateKey(identityPubkey);
      if (!privateKey) {
        setError(t('settings.backup.identityLocked', 'Identity is locked'));
        return;
      }

      const recoveryPhrase = recoveryPhraseService.privateKeyToRecoveryPhrase(privateKey);
      setPhrase(recoveryPhrase);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recovery phrase');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(phrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const phraseWords = phrase.split(' ');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.backup.viewPhraseTitle', 'Recovery Phrase')}</DialogTitle>
        <DialogDescription>
          {t('settings.backup.viewPhraseDesc', 'Your recovery phrase can restore your identity on any device.')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {!phrase ? (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('settings.backup.securityWarning', 'Security Warning')}</AlertTitle>
              <AlertDescription>
                {t('settings.backup.securityWarningDesc', 'Anyone with your recovery phrase can access your identity. Only view this in a private place.')}
              </AlertDescription>
            </Alert>

            <Button onClick={handleVerify} className="w-full">
              {t('settings.backup.showPhrase', 'Show Recovery Phrase')}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('settings.backup.recoveryPhrase', '24-Word Recovery Phrase')}</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowPhrase(!showPhrase)}>
                  {showPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <div className={`grid grid-cols-4 gap-2 p-4 bg-muted rounded-lg ${!showPhrase ? 'blur-sm select-none' : ''}`}>
                {phraseWords.map((word, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-muted-foreground mr-1">{i + 1}.</span>
                    <span className="font-mono">{word}</span>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={handleCopy}>
                {copied ? (
                  <><Check className="h-4 w-4 mr-2" /> {t('settings.backup.copied', 'Copied!')}</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" /> {t('settings.backup.copyPhrase', 'Copy to Clipboard')}</>
                )}
              </Button>
            </div>
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>
      </DialogFooter>
    </>
  );
}

export default BackupRestorePanel;
