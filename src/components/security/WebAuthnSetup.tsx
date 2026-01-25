/**
 * WebAuthn Setup Dialog
 * Guides users through WebAuthn/Passkey registration
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Fingerprint, Shield, Check, AlertTriangle } from 'lucide-react';
import { webAuthnService } from '@/lib/webauthn/WebAuthnService';
import { useDeviceStore } from '@/stores/deviceStore';
import type { WebAuthnCredential } from '@/types/device';

interface WebAuthnSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  npub: string;
  onComplete?: (credential: WebAuthnCredential) => void;
}

type SetupStep = 'intro' | 'device-name' | 'registering' | 'success' | 'error';

export function WebAuthnSetup({ open, onOpenChange, npub, onComplete }: WebAuthnSetupProps) {
  const { t } = useTranslation();
  const { addCredential, currentDeviceId } = useDeviceStore();
  const [step, setStep] = useState<SetupStep>('intro');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<WebAuthnCredential | null>(null);

  const hasPlatformAuthenticator = webAuthnService.isPlatformAuthenticatorAvailable();

  const handleStart = () => {
    setStep('device-name');
  };

  const handleRegister = async () => {
    if (!deviceName.trim()) {
      setError(t('webauthn.setup.enterDeviceName'));
      return;
    }

    setStep('registering');
    setError(null);

    try {
      // Register WebAuthn credential
      const newCredential = await webAuthnService.registerCredential(npub, deviceName);

      // Set device ID
      if (currentDeviceId) {
        newCredential.deviceId = currentDeviceId;
      }

      // Store credential
      addCredential(newCredential);
      setCredential(newCredential);
      setStep('success');

      if (onComplete) {
        onComplete(newCredential);
      }
    } catch (err) {
      console.error('WebAuthn registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register credential');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('intro');
    setDeviceName('');
    setError(null);
    setCredential(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('webauthn.setup.title')}
              </DialogTitle>
              <DialogDescription>
                {t('webauthn.setup.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Fingerprint className="h-4 w-4" />
                <AlertDescription>
                  {hasPlatformAuthenticator ? (
                    <>
                      <strong>{t('webauthn.setup.biometricAvailable')}</strong>
                      <br />
                      {t('webauthn.setup.biometricDetails')}
                    </>
                  ) : (
                    <>
                      <strong>{t('webauthn.setup.securityKeyRequired')}</strong>
                      <br />
                      {t('webauthn.setup.securityKeyDetails')}
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <p className="font-medium">{t('webauthn.setup.benefits')}</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('webauthn.setup.benefitBiometric')}</li>
                  <li>{t('webauthn.setup.benefitUnauthorized')}</li>
                  <li>{t('webauthn.setup.benefitDevices')}</li>
                  <li>{t('webauthn.setup.benefitStandard')}</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleStart}>
                <Shield className="mr-2 h-4 w-4" />
                {t('webauthn.setup.getStarted')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'device-name' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('webauthn.setup.nameDevice')}</DialogTitle>
              <DialogDescription>
                {t('webauthn.setup.nameDeviceDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">{t('webauthn.setup.deviceName')}</Label>
                <Input
                  id="device-name"
                  placeholder={t('webauthn.setup.deviceNamePlaceholder')}
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  autoFocus
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('intro')}>
                {t('common.back')}
              </Button>
              <Button onClick={handleRegister} disabled={!deviceName.trim()}>
                {t('common.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'registering' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('webauthn.setup.registering')}</DialogTitle>
              <DialogDescription>
                {t('webauthn.setup.registeringDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                {hasPlatformAuthenticator
                  ? t('webauthn.setup.useBiometric')
                  : t('webauthn.setup.insertKey')}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                {t('webauthn.setup.success')}
              </DialogTitle>
              <DialogDescription>
                {hasPlatformAuthenticator ? t('webauthn.setup.successDescBiometric') : t('webauthn.setup.successDescKey')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t('webauthn.setup.successImportant')}</strong> {t('webauthn.setup.successWarning')}
                </AlertDescription>
              </Alert>
              {credential && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{t('webauthn.setup.credentialDetails')}</p>
                  <p className="text-muted-foreground">{t('webauthn.setup.device')} {deviceName}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    ID: {credential.id.substring(0, 16)}...
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>{t('common.done')}</Button>
            </DialogFooter>
          </>
        )}

        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t('webauthn.setup.failed')}
              </DialogTitle>
              <DialogDescription>
                {t('webauthn.setup.failedDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="text-sm space-y-2">
                <p className="font-medium">{t('webauthn.setup.troubleshooting')}</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('webauthn.setup.troubleshootBrowser')}</li>
                  <li>{t('webauthn.setup.troubleshootAuthenticator')}</li>
                  <li>{t('webauthn.setup.troubleshootAlreadyRegistered')}</li>
                  <li>{t('webauthn.setup.troubleshootInserted')}</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => setStep('device-name')}>
                {t('webauthn.setup.tryAgain')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
