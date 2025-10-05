/**
 * Security Page
 * Comprehensive security management including devices, WebAuthn, and privacy settings
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeviceManager } from '@/components/security/DeviceManager';
import { DeviceActivityHistory } from '@/components/security/DeviceActivityHistory';
import { PrivacySettings } from '@/components/security/PrivacySettings';
import { WebAuthnSetup } from '@/components/security/WebAuthnSetup';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Fingerprint, Activity, Settings, AlertTriangle, Check } from 'lucide-react';

export function SecurityPage() {
  const [showWebAuthnSetup, setShowWebAuthnSetup] = useState(false);
  const { isWebAuthnSupported, currentDeviceId, devices, getDeviceCredentials } =
    useDeviceStore();
  const { currentIdentity } = useAuthStore();

  const currentDevice = currentDeviceId ? devices.get(currentDeviceId) : null;
  const deviceCredentials = currentDeviceId ? getDeviceCredentials(currentDeviceId) : [];
  const hasWebAuthn = deviceCredentials.length > 0;

  useEffect(() => {
    // Initialize device store on mount
    const initDevice = async () => {
      await useDeviceStore.getState().checkWebAuthnSupport();
      if (!currentDeviceId) {
        await useDeviceStore.getState().initializeCurrentDevice();
      }
    };
    initDevice();
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Security & Devices</h1>
        <p className="text-muted-foreground mt-1">
          Manage your devices, sessions, and security settings
        </p>
      </div>

      {/* WebAuthn Status Card */}
      {isWebAuthnSupported && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5" />
                  WebAuthn Protection
                  {hasWebAuthn && (
                    <Badge variant="default" className="ml-2">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {hasWebAuthn
                    ? 'Your keys are protected with WebAuthn'
                    : 'Set up biometric authentication or hardware security keys'}
                </CardDescription>
              </div>
              {!hasWebAuthn && (
                <Button onClick={() => setShowWebAuthnSetup(true)}>
                  <Shield className="mr-2 h-4 w-4" />
                  Set Up WebAuthn
                </Button>
              )}
            </div>
          </CardHeader>
          {hasWebAuthn && (
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Registered Credentials</p>
                {deviceCredentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded p-2"
                  >
                    <div>
                      <p className="font-medium">
                        {currentDevice?.name || 'This Device'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cred.id.substring(0, 32)}...
                      </p>
                    </div>
                    {cred.lastUsed && (
                      <p className="text-xs text-muted-foreground">
                        Last used:{' '}
                        {new Date(cred.lastUsed).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {!isWebAuthnSupported && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>WebAuthn not supported</strong>
            <br />
            Your browser doesn't support WebAuthn. Please use a modern browser (Chrome,
            Firefox, Safari, Edge) to enable biometric authentication and hardware security
            keys.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <DeviceManager />
        </TabsContent>

        <TabsContent value="activity">
          <DeviceActivityHistory />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacySettings />
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Advanced Security Settings
              </CardTitle>
              <CardDescription>
                Coming soon: Key rotation, backup & recovery, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Advanced features including key rotation, encrypted backups, and
                  multi-device sync will be available in a future update.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* WebAuthn Setup Dialog */}
      {currentIdentity && (
        <WebAuthnSetup
          open={showWebAuthnSetup}
          onOpenChange={setShowWebAuthnSetup}
          npub={currentIdentity.npub}
          onComplete={() => {
            // Credential added successfully
            console.log('WebAuthn credential registered');
          }}
        />
      )}
    </div>
  );
}
