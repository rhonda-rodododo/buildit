/**
 * LoginForm Component
 * Multi-step form for creating new identities or importing existing ones.
 * Includes mandatory recovery phrase verification for new accounts.
 */

import { useState, type FC } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react';
import { APP_CONFIG } from '@/config/app';
import { recoveryPhraseService } from '@/core/backup';
import { db } from '@/core/storage/db';
import RecoveryPhraseSetup from './RecoveryPhraseSetup';
import { useTranslation } from 'react-i18next';

interface LoginFormProps {
  /** Called when user wants to go back (e.g., to unlock screen) */
  onBack?: () => void;
  /** Initial tab to display */
  defaultTab?: 'create' | 'import';
}

type FormStep = 'credentials' | 'recovery-setup';

export const LoginForm: FC<LoginFormProps> = ({ onBack, defaultTab = 'create' }) => {
  const { t } = useTranslation();
  const { createNewIdentity, importIdentity } = useAuthStore();

  // Form state
  const [step, setStep] = useState<FormStep>('credentials');
  const [activeTab, setActiveTab] = useState<'create' | 'import'>(defaultTab);
  const [name, setName] = useState('');
  const [nsec, setNsec] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery phrase state (for new accounts)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [pendingIdentityPubkey, setPendingIdentityPubkey] = useState<string | null>(null);

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return t('auth.login.passwordTooShort', 'Password must be at least 8 characters');
    }
    return null;
  };

  const handleCreateIdentity = async () => {
    if (!name.trim()) return;

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.login.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Create identity - this returns the full identity with private key
      const identity = await createNewIdentity(name, password);

      // Generate recovery phrase from private key
      const phrase = recoveryPhraseService.privateKeyToRecoveryPhrase(identity.privateKey);
      setRecoveryPhrase(phrase);
      setPendingIdentityPubkey(identity.publicKey);

      // Move to recovery phrase setup step
      setStep('recovery-setup');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('auth.login.createFailed', 'Failed to create identity');
      setError(errorMsg);
      console.error('Failed to create identity:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportIdentity = async () => {
    if (!nsec.trim() || !name.trim()) return;

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.login.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const identity = await importIdentity(nsec, name, password);

      // For imported identities, mark that they skipped the backup flow
      // This will trigger the backup reminder banner
      await db.identities.update(identity.publicKey, {
        importedWithoutBackup: true,
      });

      // Imported identities go directly to the app (no recovery phrase setup)
      // They should already have their recovery phrase from the original account
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('auth.login.importFailed', 'Failed to import identity');
      setError(errorMsg);
      console.error('Failed to import identity:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryPhraseComplete = async () => {
    if (!pendingIdentityPubkey) return;

    try {
      // Update the identity to mark recovery phrase as confirmed
      await db.identities.update(pendingIdentityPubkey, {
        recoveryPhraseShownAt: Date.now(),
        recoveryPhraseConfirmedAt: Date.now(),
      });

      // Identity is already unlocked from createNewIdentity, so we're done
      // The auth state should already be set correctly
    } catch (err) {
      console.error('Failed to update recovery phrase confirmation:', err);
      // Don't block the user even if this fails
    }
  };

  const handleBackFromRecovery = () => {
    // User wants to go back - this is a bit tricky because identity is already created
    // For now, just go back to credentials (they can still use the account)
    setStep('credentials');
    setRecoveryPhrase('');
  };

  // If we're in the recovery setup step, show that component
  if (step === 'recovery-setup' && recoveryPhrase) {
    return (
      <RecoveryPhraseSetup
        recoveryPhrase={recoveryPhrase}
        onComplete={handleRecoveryPhraseComplete}
        onBack={handleBackFromRecovery}
        userName={name}
      />
    );
  }

  // Render the credentials form
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle>{APP_CONFIG.fullName}</CardTitle>
            <CardDescription>{APP_CONFIG.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'import')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">{t('auth.login.tabCreate', 'Create New')}</TabsTrigger>
            <TabsTrigger value="import">{t('auth.login.tabImport', 'Import')}</TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4" role="alert" id="form-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.login.displayName', 'Display Name')}</Label>
              <Input
                id="name"
                placeholder={t('auth.login.namePlaceholder', 'Enter your name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.login.password', 'Password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.login.passwordPlaceholder', 'Create a strong password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  aria-describedby={error ? 'form-error password-hint' : 'password-hint'}
                  aria-invalid={error ? 'true' : undefined}
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
              <p id="password-hint" className="text-xs text-muted-foreground">
                {t('auth.login.passwordHint', 'Minimum 8 characters. This password encrypts your private keys.')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('auth.login.confirmPassword', 'Confirm Password')}</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.login.confirmPlaceholder', 'Confirm your password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('auth.login.securityNote', 'Your private key will be encrypted with this password. It never leaves your device unencrypted.')}
              </p>
            </div>

            <Button
              onClick={handleCreateIdentity}
              disabled={loading || !name.trim() || !password || !confirmPassword}
              className="w-full"
            >
              {loading ? t('auth.login.creating', 'Creating...') : t('auth.login.createButton', 'Create Identity')}
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-name">{t('auth.login.displayName', 'Display Name')}</Label>
              <Input
                id="import-name"
                placeholder={t('auth.login.namePlaceholder', 'Enter your name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nsec">{t('auth.login.privateKey', 'Private Key (nsec)')}</Label>
              <Input
                id="nsec"
                type="password"
                placeholder="nsec1..."
                value={nsec}
                onChange={(e) => setNsec(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-password">{t('auth.login.password', 'Password')}</Label>
              <div className="relative">
                <Input
                  id="import-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.login.passwordPlaceholder', 'Create a strong password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  aria-describedby={error ? 'form-error import-password-hint' : 'import-password-hint'}
                  aria-invalid={error ? 'true' : undefined}
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
              <p id="import-password-hint" className="text-xs text-muted-foreground">
                {t('auth.login.importPasswordHint', 'This password will encrypt your imported key locally.')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-confirm-password">{t('auth.login.confirmPassword', 'Confirm Password')}</Label>
              <Input
                id="import-confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.login.confirmPlaceholder', 'Confirm your password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              onClick={handleImportIdentity}
              disabled={loading || !name.trim() || !nsec.trim() || !password || !confirmPassword}
              className="w-full"
            >
              {loading ? t('auth.login.importing', 'Importing...') : t('auth.login.importButton', 'Import Identity')}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
