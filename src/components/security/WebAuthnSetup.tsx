/**
 * WebAuthn Setup Dialog
 * Guides users through WebAuthn/Passkey registration
 */

import { useState } from 'react';
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
      setError('Please enter a device name');
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
                Set Up WebAuthn Protection
              </DialogTitle>
              <DialogDescription>
                Protect your keys with biometric authentication or a hardware security key
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Fingerprint className="h-4 w-4" />
                <AlertDescription>
                  {hasPlatformAuthenticator ? (
                    <>
                      <strong>Biometric authentication available!</strong>
                      <br />
                      You can use Touch ID, Face ID, Windows Hello, or your device's built-in
                      authentication.
                    </>
                  ) : (
                    <>
                      <strong>Security key required</strong>
                      <br />
                      This device doesn't support biometric authentication. You'll need a
                      hardware security key (like a YubiKey) to continue.
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Benefits:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Protect your keys with biometrics or hardware security</li>
                  <li>Prevent unauthorized access even if password is compromised</li>
                  <li>Works across all your devices</li>
                  <li>Industry-standard FIDO2/WebAuthn security</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStart}>
                <Shield className="mr-2 h-4 w-4" />
                Get Started
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'device-name' && (
          <>
            <DialogHeader>
              <DialogTitle>Name This Device</DialogTitle>
              <DialogDescription>
                Give this device a name so you can identify it later
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  placeholder="My iPhone, Work Laptop, etc."
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
                Back
              </Button>
              <Button onClick={handleRegister} disabled={!deviceName.trim()}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'registering' && (
          <>
            <DialogHeader>
              <DialogTitle>Registering Credential</DialogTitle>
              <DialogDescription>
                Follow the prompts on your device to complete registration
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                {hasPlatformAuthenticator
                  ? 'Use your fingerprint, face, or PIN to continue...'
                  : 'Insert and touch your security key...'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                WebAuthn Set Up Successfully
              </DialogTitle>
              <DialogDescription>
                Your keys are now protected with {hasPlatformAuthenticator ? 'biometric authentication' : 'your security key'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> You'll now need to authenticate with WebAuthn
                  whenever you access your keys. Make sure you can always access this device
                  or have a backup authentication method.
                </AlertDescription>
              </Alert>
              {credential && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Credential Details:</p>
                  <p className="text-muted-foreground">Device: {deviceName}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    ID: {credential.id.substring(0, 16)}...
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}

        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Registration Failed
              </DialogTitle>
              <DialogDescription>
                We couldn't register your WebAuthn credential
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="text-sm space-y-2">
                <p className="font-medium">Troubleshooting:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Make sure your browser supports WebAuthn</li>
                  <li>Try using a different authenticator</li>
                  <li>Check that you haven't already registered this device</li>
                  <li>Ensure your security key is properly inserted</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('device-name')}>
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
