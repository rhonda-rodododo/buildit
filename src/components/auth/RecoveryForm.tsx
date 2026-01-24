/**
 * RecoveryForm Component
 * Allows users to recover their identity using their 24-word recovery phrase.
 * Used when the user has forgotten their password.
 */

import { useState, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
} from 'lucide-react';
import { recoveryPhraseService } from '@/core/backup';
import { db } from '@/core/storage/db';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface RecoveryFormProps {
  /** Called when user wants to go back to unlock form */
  onBack: () => void;
  /** Called when recovery is successful */
  onSuccess?: () => void;
  /** The identity being recovered (optional - for displaying context) */
  identityHint?: {
    name?: string;
    npub?: string;
  };
}

type RecoveryStep = 'phrase' | 'password' | 'success';

export function RecoveryForm({ onBack, onSuccess, identityHint }: RecoveryFormProps) {
  const { t } = useTranslation();
  const { loadIdentities, setCurrentIdentity, unlock } = useAuthStore();

  const [step, setStep] = useState<RecoveryStep>('phrase');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [phraseValidation, setPhraseValidation] = useState<{
    isValid: boolean;
    invalidWords: string[];
    wordCount: number;
  } | null>(null);
  // Track recovered public key for logging/debugging purposes
  const [, setRecoveredPublicKey] = useState<string | null>(null);

  const handlePhraseChange = (phrase: string) => {
    setRecoveryPhrase(phrase);
    setError(null);

    const trimmed = phrase.trim();
    if (trimmed.length > 0) {
      const validation = recoveryPhraseService.validatePhrase(trimmed);
      setPhraseValidation({
        isValid: validation.isValid,
        invalidWords: validation.invalidWords || [],
        wordCount: validation.wordCount,
      });
    } else {
      setPhraseValidation(null);
    }
  };

  const handlePhraseSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phraseValidation?.isValid) {
      setError(t('auth.recovery.invalidPhrase', 'Please enter a valid 24-word recovery phrase.'));
      return;
    }

    setStep('password');
  };

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return t('auth.recovery.passwordTooShort', 'Password must be at least 8 characters');
    }
    return null;
  };

  const handleRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.recovery.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setIsRecovering(true);

    try {
      // Convert recovery phrase to private key entropy
      const privateKeyBytes = recoveryPhraseService.recoveryPhraseToEntropy(recoveryPhrase);

      // Import nostr-tools to derive public key
      const { getPublicKey } = await import('nostr-tools/pure');
      const publicKey = getPublicKey(privateKeyBytes);

      // Check if this identity already exists in the database
      const existingIdentity = await db.identities.get(publicKey);

      if (existingIdentity) {
        // Identity exists - we need to re-encrypt with the new password
        // Use the SecureKeyManager to create new encrypted key data
        const { secureKeyManager } = await import('@/core/crypto/SecureKeyManager');
        const encryptedData = await secureKeyManager.createEncryptedKeyData(
          publicKey,
          privateKeyBytes,
          newPassword
        );

        // Update the existing identity with new encrypted data
        await db.identities.update(publicKey, {
          encryptedPrivateKey: encryptedData.encryptedPrivateKey,
          salt: encryptedData.salt,
          iv: encryptedData.iv,
          keyVersion: (existingIdentity.keyVersion || 0) + 1,
          lastUsed: Date.now(),
        });

        setRecoveredPublicKey(publicKey);
      } else {
        // New identity - create it
        const { npubEncode } = await import('nostr-tools/nip19');
        const { secureKeyManager } = await import('@/core/crypto/SecureKeyManager');

        const encryptedData = await secureKeyManager.createEncryptedKeyData(
          publicKey,
          privateKeyBytes,
          newPassword
        );

        // Create new identity in database
        await db.identities.add({
          publicKey,
          encryptedPrivateKey: encryptedData.encryptedPrivateKey,
          salt: encryptedData.salt,
          iv: encryptedData.iv,
          webAuthnProtected: false,
          keyVersion: 1,
          name: identityHint?.name || t('auth.recovery.recoveredIdentity', 'Recovered Identity'),
          npub: npubEncode(publicKey),
          created: Date.now(),
          lastUsed: Date.now(),
          // Mark as having confirmed recovery phrase (they just used it!)
          recoveryPhraseConfirmedAt: Date.now(),
        });

        setRecoveredPublicKey(publicKey);
      }

      // Reload identities and set current
      await loadIdentities();
      await setCurrentIdentity(publicKey);

      // Unlock with new password
      await unlock(newPassword);

      setStep('success');

      // Auto-proceed after short delay
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      console.error('Recovery failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('auth.recovery.failed', 'Recovery failed. Please check your recovery phrase.')
      );
    } finally {
      setIsRecovering(false);
    }
  };

  // Render phrase entry step
  if (step === 'phrase') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('auth.recovery.recoverTitle', 'Recover Your Account')}
          </CardTitle>
          <CardDescription>
            {identityHint?.name
              ? t(
                  'auth.recovery.recoverDescWithName',
                  'Enter the 24-word recovery phrase for "{{name}}" to set a new password.',
                  { name: identityHint.name }
                )
              : t(
                  'auth.recovery.recoverDesc',
                  'Enter your 24-word recovery phrase to reset your password and recover access to your account.'
                )}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handlePhraseSubmit}>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>{t('auth.recovery.secureTitle', 'Secure Recovery')}</AlertTitle>
              <AlertDescription>
                {t(
                  'auth.recovery.secureDesc',
                  'Your recovery phrase is never sent to any server. It is only used locally to derive your private key.'
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="recovery-phrase">
                {t('auth.recovery.phraseLabel', '24-Word Recovery Phrase')}
              </Label>
              <Textarea
                id="recovery-phrase"
                value={recoveryPhrase}
                onChange={(e) => handlePhraseChange(e.target.value)}
                placeholder={t('auth.recovery.phrasePlaceholder', 'Enter your recovery phrase, words separated by spaces...')}
                className="h-32 font-mono text-sm"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />

              {phraseValidation && (
                <div className="text-sm">
                  {phraseValidation.isValid ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      {t('auth.recovery.phraseValid', 'Valid recovery phrase')}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      {phraseValidation.invalidWords.length > 0
                        ? t('auth.recovery.invalidWords', 'Invalid words: {{words}}', {
                            words: phraseValidation.invalidWords.join(', '),
                          })
                        : t('auth.recovery.wrongWordCount', 'Expected 24 words, got {{count}}', {
                            count: phraseValidation.wordCount,
                          })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back', 'Back')}
            </Button>
            <Button type="submit" disabled={!phraseValidation?.isValid}>
              {t('common.continue', 'Continue')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Render password entry step
  if (step === 'password') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('auth.recovery.newPasswordTitle', 'Set New Password')}
          </CardTitle>
          <CardDescription>
            {t(
              'auth.recovery.newPasswordDesc',
              'Create a new password to protect your account on this device.'
            )}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleRecovery}>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'auth.recovery.passwordWarning',
                  'This password encrypts your private key on this device. If you forget it, you will need your recovery phrase again.'
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="new-password">{t('auth.recovery.newPassword', 'New Password')}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder={t('auth.recovery.newPasswordPlaceholder', 'Enter a strong password')}
                  className="pr-12"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('auth.recovery.passwordHint', 'Minimum 8 characters')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t('auth.recovery.confirmPassword', 'Confirm Password')}
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder={t('auth.recovery.confirmPasswordPlaceholder', 'Confirm your password')}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('phrase')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back', 'Back')}
            </Button>
            <Button
              type="submit"
              disabled={isRecovering || !newPassword || !confirmPassword}
            >
              {isRecovering
                ? t('auth.recovery.recovering', 'Recovering...')
                : t('auth.recovery.recoverButton', 'Recover Account')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Render success step
  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        <div
          className={cn(
            'rounded-full w-16 h-16 mx-auto flex items-center justify-center',
            'bg-green-100 dark:bg-green-900'
          )}
        >
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        <div>
          <h2 className="text-xl font-semibold">
            {t('auth.recovery.successTitle', 'Account Recovered!')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t(
              'auth.recovery.successDesc',
              'Your account has been recovered and you are now logged in.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default RecoveryForm;
