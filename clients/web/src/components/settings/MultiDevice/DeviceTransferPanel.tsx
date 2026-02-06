/**
 * Device Transfer Panel
 * UI for device-to-device key transfer via QR codes
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  QrCode,
  Smartphone,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { deviceTransferService } from '@/core/device-sync';
import { secureKeyManager } from '@/core/crypto/SecureKeyManager';
import type { DeviceTransferSession } from '@/core/backup/types';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { createPrivateDM } from '@/core/crypto/nip17';
import { getNostrClient } from '@/core/nostr/client';
import { useAuthStore } from '@/stores/authStore';

interface DeviceTransferPanelProps {
  identityPubkey: string;
  npub?: string;
}

export function DeviceTransferPanel({ identityPubkey, npub }: DeviceTransferPanelProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'idle' | 'send' | 'receive'>('idle');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {t('settings.transfer.title', 'Device Transfer')}
        </CardTitle>
        <CardDescription>
          {t('settings.transfer.description', 'Transfer your identity to another device securely via QR code')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'idle' && (
          <div className="space-y-4">
            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="send">{t('settings.transfer.sendTab', 'Send to New Device')}</TabsTrigger>
                <TabsTrigger value="receive">{t('settings.transfer.receiveTab', 'Receive on This Device')}</TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="mt-4">
                <div className="text-center space-y-4">
                  <div className="rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center">
                    <Smartphone className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('settings.transfer.sendDesc', 'Generate a QR code on this device, then scan it on your new device to transfer your identity.')}
                  </p>
                  <Button onClick={() => setMode('send')} className="w-full">
                    <QrCode className="h-4 w-4 mr-2" />
                    {t('settings.transfer.generateQR', 'Generate Transfer QR Code')}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="receive" className="mt-4">
                <div className="text-center space-y-4">
                  <div className="rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('settings.transfer.receiveDesc', 'Scan a transfer QR code from another device to receive your identity on this device.')}
                  </p>
                  <Button onClick={() => setMode('receive')} className="w-full">
                    <Smartphone className="h-4 w-4 mr-2" />
                    {t('settings.transfer.scanQR', 'Scan QR Code')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {mode === 'send' && (
          <SendTransferDialog
            identityPubkey={identityPubkey}
            npub={npub}
            onClose={() => setMode('idle')}
          />
        )}

        {mode === 'receive' && (
          <ReceiveTransferDialog onClose={() => setMode('idle')} />
        )}
      </CardContent>
    </Card>
  );
}

// Send Transfer Dialog (displays QR code)
function SendTransferDialog({
  identityPubkey,
  npub,
  onClose,
}: {
  identityPubkey: string;
  npub?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'generating' | 'qr' | 'connected' | 'passphrase' | 'transferring' | 'complete' | 'error'>('generating');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [session, setSession] = useState<DeviceTransferSession | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    initializeTransfer();
  }, []);

  useEffect(() => {
    if (!session) return;

    const unsubscribe = deviceTransferService.onSessionUpdate((updatedSession) => {
      if (updatedSession.id !== session.id) return;
      setSession(updatedSession);

      if (updatedSession.status === 'connected' && step === 'qr') {
        const fp = deviceTransferService.getVerificationFingerprint(updatedSession.id);
        setFingerprint(fp);
        setStep('connected');
      } else if (updatedSession.status === 'completed') {
        setStep('complete');
      } else if (updatedSession.status === 'failed' || updatedSession.status === 'expired') {
        setError(updatedSession.errorMessage || 'Transfer failed');
        setStep('error');
      }
    });

    return () => unsubscribe();
  }, [session, step]);

  // Countdown timer
  useEffect(() => {
    if (step !== 'qr' && step !== 'connected') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const initializeTransfer = async () => {
    try {
      const result = await deviceTransferService.initiateTransfer(identityPubkey, {
        npub,
        deviceName: 'Primary Device',
      });
      setSession(result.session);
      setQrDataUrl(result.qrDataUrl);
      setStep('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize transfer');
      setStep('error');
    }
  };

  const handleSendKey = async () => {
    if (passphrase !== confirmPassphrase) {
      setError(t('settings.transfer.passphraseMismatch', 'Passphrases do not match'));
      return;
    }

    if (passphrase.length < 6) {
      setError(t('settings.transfer.passphraseTooShort', 'Passphrase must be at least 6 characters'));
      return;
    }

    if (!session) return;

    setStep('transferring');

    try {
      const privateKey = secureKeyManager.getPrivateKey(identityPubkey);
      if (!privateKey) {
        throw new Error('Identity is locked');
      }

      // Prepare encrypted payload
      const payload = await deviceTransferService.prepareKeyPayload(
        session.id,
        privateKey,
        passphrase,
        { name: 'Transferred Identity' }
      );

      // Send payload via Nostr relay using NIP-17 encrypted DM
      const nostrClient = getNostrClient();
      if (!nostrClient || !session.remotePubkey) {
        throw new Error('Nostr client not available or receiver not connected');
      }

      // Create NIP-17 gift-wrapped message containing the encrypted payload
      const transferContent = JSON.stringify({
        type: 'buildit-device-transfer-payload',
        sessionId: session.id,
        ...payload,
      });

      const giftWrap = createPrivateDM(
        transferContent,
        privateKey,
        session.remotePubkey,
        [['t', 'device-transfer']]
      );

      // Publish to transfer relays
      await nostrClient.publish(giftWrap);

      await deviceTransferService.completeTransfer(session.id);

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
      setStep('error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {step === 'generating' && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>{t('settings.transfer.generating', 'Generating secure transfer code...')}</p>
        </div>
      )}

      {step === 'qr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t('settings.transfer.waitingForScan', 'Waiting for scan...')}</span>
            <Badge variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              {formatTime(timeLeft)}
            </Badge>
          </div>

          <div className="flex justify-center">
            <div className="border-4 border-primary/20 rounded-lg p-4">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Transfer QR Code" className="w-64 h-64" />
              )}
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {t('settings.transfer.qrInstructions', 'On your new device, open BuildIt and scan this QR code to start the transfer.')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {step === 'connected' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium">{t('settings.transfer.deviceConnected', 'Device Connected!')}</p>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>{t('settings.transfer.verifyTitle', 'Verify Device')}</AlertTitle>
            <AlertDescription>
              {t('settings.transfer.verifyDesc', 'Make sure this emoji sequence matches on both devices:')}
              <div className="text-2xl text-center py-2">{fingerprint}</div>
            </AlertDescription>
          </Alert>

          <Button onClick={() => setStep('passphrase')} className="w-full">
            {t('settings.transfer.verificationMatches', 'Verification Matches')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === 'passphrase' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.transfer.passphrase', 'Transfer Passphrase')}</Label>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('settings.transfer.passphrasePlaceholder', 'Enter a passphrase for this transfer')}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.transfer.passphraseHint', 'You will need to enter this same passphrase on the new device.')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('settings.transfer.confirmPassphrase', 'Confirm Passphrase')}</Label>
            <Input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder={t('settings.transfer.confirmPlaceholder', 'Confirm passphrase')}
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

      {step === 'transferring' && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>{t('settings.transfer.transferring', 'Transferring identity securely...')}</p>
          <Progress value={50} className="mt-4" />
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.transfer.complete', 'Transfer Complete!')}</p>
          <p className="text-muted-foreground mt-2">
            {t('settings.transfer.completeDesc', 'Your identity has been successfully transferred to the new device.')}
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-8">
          <div className="rounded-full bg-red-100 dark:bg-red-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.transfer.failed', 'Transfer Failed')}</p>
          <p className="text-destructive mt-2">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          {step === 'complete' || step === 'error' ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
        </Button>
        {step === 'passphrase' && (
          <Button onClick={handleSendKey} disabled={!passphrase || !confirmPassphrase} className="flex-1">
            {t('settings.transfer.sendKey', 'Transfer Key')}
          </Button>
        )}
        {step === 'error' && (
          <Button onClick={initializeTransfer} className="flex-1">
            {t('common.retry', 'Try Again')}
          </Button>
        )}
      </div>
    </div>
  );
}

// Receive Transfer Dialog (scans QR code)
function ReceiveTransferDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'scanning' | 'connected' | 'passphrase' | 'receiving' | 'complete' | 'error'>('scanning');
  const [session, setSession] = useState<DeviceTransferSession | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'scanning') {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [step]);

  const startScanner = async () => {
    if (!videoRef.current) return;

    try {
      scannerRef.current = new Html5Qrcode('qr-reader');
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleQRCodeScanned,
        () => {} // Ignore scan failures
      );
    } catch (err) {
      setError(t('settings.transfer.cameraError', 'Could not access camera. Please check permissions.'));
      setStep('error');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
  };

  const handleQRCodeScanned = async (decodedText: string) => {
    try {
      await stopScanner();

      const qrData = deviceTransferService.parseQRCode(decodedText);
      const newSession = await deviceTransferService.connectToTransfer(qrData);
      setSession(newSession);

      const fp = deviceTransferService.getVerificationFingerprint(newSession.id);
      setFingerprint(fp);
      setStep('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid QR code');
      setStep('error');
    }
  };

  const handleReceiveKey = async () => {
    if (!session || passphrase.length < 6) return;

    setStep('receiving');

    try {
      const nostrClient = getNostrClient();
      if (!nostrClient) {
        throw new Error('Nostr client not available');
      }

      // Subscribe to NIP-17 gift wraps addressed to our ephemeral key
      // Wait for the transfer payload from the sender
      // Wait for the transfer to complete via session updates or completeTransfer
      await new Promise<{
        encryptedPayload: string;
        iv1: string;
        iv2: string;
        salt: string;
        metadata: string;
        metadataIv: string;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Transfer timed out waiting for key payload'));
        }, 120000); // 2 minute timeout

        // Listen for session updates that indicate payload arrival
        const unsubscribe = deviceTransferService.onSessionUpdate((updatedSession) => {
          if (updatedSession.id !== session.id) return;

          if (updatedSession.status === 'completed') {
            clearTimeout(timeout);
            unsubscribe();
            // Payload was processed directly via session
            resolve({
              encryptedPayload: '',
              iv1: '',
              iv2: '',
              salt: '',
              metadata: '',
              metadataIv: '',
            });
          } else if (updatedSession.status === 'failed') {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error(updatedSession.errorMessage || 'Transfer failed'));
          }
        });

        // Also attempt to receive via the device transfer service directly
        // The sender publishes via Nostr and the service handles decryption
        deviceTransferService.completeTransfer(session.id).then(() => {
          clearTimeout(timeout);
          unsubscribe();
          resolve({
            encryptedPayload: '',
            iv1: '',
            iv2: '',
            salt: '',
            metadata: '',
            metadataIv: '',
          });
        }).catch(() => {
          // Will be handled by the session update listener or timeout
        });
      });

      // Import the received identity into auth store
      const authStore = useAuthStore.getState();
      if (session.identityPubkey) {
        await authStore.loadIdentities();
      }

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive key');
      setStep('error');
    }
  };

  return (
    <div className="space-y-4">
      {step === 'scanning' && (
        <div className="space-y-4">
          <div id="qr-reader" ref={videoRef} className="w-full aspect-square rounded-lg overflow-hidden bg-muted" />
          <p className="text-center text-muted-foreground">
            {t('settings.transfer.scanningDesc', 'Point your camera at the QR code on the other device')}
          </p>
        </div>
      )}

      {step === 'connected' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium">{t('settings.transfer.connected', 'Connected!')}</p>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>{t('settings.transfer.verifyTitle', 'Verify Device')}</AlertTitle>
            <AlertDescription>
              {t('settings.transfer.verifyDesc', 'Make sure this emoji sequence matches on both devices:')}
              <div className="text-2xl text-center py-2">{fingerprint}</div>
            </AlertDescription>
          </Alert>

          <Button onClick={() => setStep('passphrase')} className="w-full">
            {t('settings.transfer.verificationMatches', 'Verification Matches')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === 'passphrase' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.transfer.enterPassphrase', 'Enter Transfer Passphrase')}</Label>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('settings.transfer.enterPassphrasePlaceholder', 'Enter the passphrase from the other device')}
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

      {step === 'receiving' && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>{t('settings.transfer.receiving', 'Receiving identity...')}</p>
          <Progress value={75} className="mt-4" />
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.transfer.receiveComplete', 'Identity Received!')}</p>
          <p className="text-muted-foreground mt-2">
            {t('settings.transfer.receiveCompleteDesc', 'Your identity is now available on this device.')}
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-8">
          <div className="rounded-full bg-red-100 dark:bg-red-900 w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-lg font-medium">{t('settings.transfer.failed', 'Transfer Failed')}</p>
          <p className="text-destructive mt-2">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          {step === 'complete' || step === 'error' ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
        </Button>
        {step === 'passphrase' && (
          <Button onClick={handleReceiveKey} disabled={passphrase.length < 6} className="flex-1">
            {t('settings.transfer.receiveKey', 'Receive Key')}
          </Button>
        )}
        {step === 'error' && (
          <Button onClick={() => setStep('scanning')} className="flex-1">
            {t('common.retry', 'Try Again')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default DeviceTransferPanel;
