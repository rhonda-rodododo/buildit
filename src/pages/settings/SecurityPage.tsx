/**
 * Security Page
 * Comprehensive security management including devices, WebAuthn, and privacy settings
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DeviceManager } from '@/components/security/DeviceManager';
import { DeviceActivityHistory } from '@/components/security/DeviceActivityHistory';
import { PrivacySettings } from '@/components/security/PrivacySettings';
import { LockSettings } from '@/components/security/LockSettings';
import { TorSettings } from '@/components/tor/TorSettings';
import { WebAuthnSetup } from '@/components/security/WebAuthnSetup';
import { BackupRestorePanel, DeviceTransferPanel, RemoteSigningPanel } from '@/components/settings/MultiDevice';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Fingerprint, Activity, Settings, AlertTriangle, Check, Lock, Smartphone, Key } from 'lucide-react';

export function SecurityPage() {
  const { t } = useTranslation();
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
      <PageMeta titleKey="common.security" descriptionKey="meta.security" path="/app/settings/security" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('securityPage.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('securityPage.description')}
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
                  {t('securityPage.webauthnProtection')}
                  {hasWebAuthn && (
                    <Badge variant="default" className="ml-2">
                      <Check className="h-3 w-3 mr-1" />
                      {t('securityPage.active')}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {hasWebAuthn
                    ? t('securityPage.keysProtected')
                    : t('securityPage.setupBiometric')}
                </CardDescription>
              </div>
              {!hasWebAuthn && (
                <Button onClick={() => setShowWebAuthnSetup(true)}>
                  <Shield className="mr-2 h-4 w-4" />
                  {t('securityPage.setupWebauthn')}
                </Button>
              )}
            </div>
          </CardHeader>
          {hasWebAuthn && (
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('securityPage.registeredCredentials')}</p>
                {deviceCredentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded p-2"
                  >
                    <div>
                      <p className="font-medium">
                        {currentDevice?.name || t('securityPage.thisDevice')}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cred.id.substring(0, 32)}...
                      </p>
                    </div>
                    {cred.lastUsed && (
                      <p className="text-xs text-muted-foreground">
                        {t('securityPage.lastUsed')}{' '}
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
            <strong>{t('securityPage.webauthnNotSupported')}</strong>
            <br />
            {t('securityPage.webauthnNotSupportedDesc')}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="space-y-6">
        <TooltipProvider delayDuration={300}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="devices" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Smartphone className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabDevices')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabDevices')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="lock" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabSession')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabSession')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="activity" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Activity className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabActivity')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabActivity')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="privacy" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabPrivacy')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabPrivacy')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="tor" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabTor')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabTor')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="advanced" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                  <Key className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{t('securityPage.tabBackup')}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">{t('securityPage.tabBackupTooltip')}</TooltipContent>
            </Tooltip>
          </TabsList>
        </TooltipProvider>

        <TabsContent value="devices">
          <DeviceManager />
        </TabsContent>

        <TabsContent value="lock">
          <LockSettings />
        </TabsContent>

        <TabsContent value="activity">
          <DeviceActivityHistory />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacySettings />
        </TabsContent>

        <TabsContent value="tor">
          <TorSettings />
        </TabsContent>

        <TabsContent value="advanced">
          <div className="space-y-6">
            {/* Backup & Recovery */}
            {currentIdentity && (
              <BackupRestorePanel identityPubkey={currentIdentity.publicKey} />
            )}

            {/* Device Transfer */}
            {currentIdentity && (
              <DeviceTransferPanel
                identityPubkey={currentIdentity.publicKey}
                npub={currentIdentity.npub}
              />
            )}

            {/* Remote Signing (NIP-46) */}
            {currentIdentity && (
              <RemoteSigningPanel
                identityPubkey={currentIdentity.publicKey}
                mode="bunker"
              />
            )}

            {!currentIdentity && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('securityPage.unlockForMultiDevice')}
                </AlertDescription>
              </Alert>
            )}
          </div>
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
          }}
        />
      )}
    </div>
  );
}
