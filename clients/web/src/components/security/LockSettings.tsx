/**
 * Lock & Session Settings Component
 * Configure session security, auto-lock, and authentication preferences
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Timer,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { SecuritySettings } from '@/core/crypto/SecureKeyManager';
import { DEFAULT_SECURITY_SETTINGS } from '@/core/crypto/SecureKeyManager';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function LockSettings() {
  const { t } = useTranslation();
  const { currentIdentity, lockState, getSecuritySettings, updateSecuritySettings } = useAuthStore();
  const { isWebAuthnSupported } = useDeviceStore();

  // Local state for form
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when identity changes
  useEffect(() => {
    if (currentIdentity && lockState === 'unlocked') {
      const loaded = getSecuritySettings();
      setSettings(loaded);
      setHasChanges(false);
    }
  }, [currentIdentity, lockState, getSecuritySettings]);

  const handleSettingChange = <K extends keyof SecuritySettings>(
    key: K,
    value: SecuritySettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentIdentity) return;

    setIsSaving(true);
    try {
      await updateSecuritySettings(settings);
      setHasChanges(false);
      toast.success(t('settings.security.saved', 'Security settings saved'));
    } catch (error) {
      toast.error(
        t('settings.security.saveFailed', 'Failed to save security settings')
      );
      console.error('Failed to save security settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (currentIdentity && lockState === 'unlocked') {
      setSettings(getSecuritySettings());
      setHasChanges(false);
    }
  };

  if (!currentIdentity) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">
            {t('settings.security.noIdentity', 'No identity selected')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (lockState !== 'unlocked') {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">
            {t('settings.security.locked', 'Unlock to view security settings')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t('settings.security.lockSettings', 'Session & Lock Settings')}
        </CardTitle>
        <CardDescription>
          {t(
            'settings.security.lockSettingsDesc',
            'Configure how your session is protected and when auto-lock activates'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Method */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4" />
                {t('settings.security.authMethod', 'Authentication Method')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.security.authMethodDesc',
                  'How you unlock the app'
                )}
              </p>
            </div>
          </div>
          <Select
            value={settings.authMethod}
            onValueChange={(value: SecuritySettings['authMethod']) =>
              handleSettingChange('authMethod', value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="password-always">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('settings.security.passwordAlways', 'Password Always')}
                </div>
              </SelectItem>
              {isWebAuthnSupported && (
                <>
                  <SelectItem value="webauthn-preferred">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4" />
                      {t('settings.security.webauthnPreferred', 'WebAuthn Preferred')}
                    </div>
                  </SelectItem>
                  <SelectItem value="webauthn-only">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4" />
                      {t('settings.security.webauthnOnly', 'WebAuthn Only')}
                    </div>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          {settings.authMethod === 'password-always' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'settings.security.passwordAlwaysInfo',
                  'You will always need to enter your password to unlock. Most secure option.'
                )}
              </AlertDescription>
            </Alert>
          )}
          {settings.authMethod === 'webauthn-preferred' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'settings.security.webauthnPreferredInfo',
                  'Use biometrics or hardware key when available, password as fallback.'
                )}
              </AlertDescription>
            </Alert>
          )}
          {settings.authMethod === 'webauthn-only' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'settings.security.webauthnOnlyWarning',
                  'Warning: If you lose access to your biometric/hardware key, you may lose access to your account.'
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Inactivity Timeout */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                {t('settings.security.inactivityTimeout', 'Inactivity Timeout')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.security.inactivityTimeoutDesc',
                  'Auto-lock after period of inactivity (0 = never)'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="0"
              max="1440"
              value={settings.inactivityTimeout}
              onChange={(e) =>
                handleSettingChange(
                  'inactivityTimeout',
                  Math.max(0, Math.min(1440, parseInt(e.target.value) || 0))
                )
              }
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">
              {t('settings.security.minutes', 'minutes')}
              {settings.inactivityTimeout > 0 && (
                <Badge variant="outline" className="ml-2">
                  {settings.inactivityTimeout >= 60
                    ? `${Math.floor(settings.inactivityTimeout / 60)}h ${settings.inactivityTimeout % 60}m`
                    : `${settings.inactivityTimeout}m`}
                </Badge>
              )}
              {settings.inactivityTimeout === 0 && (
                <Badge variant="destructive" className="ml-2">
                  {t('settings.security.neverAutoLock', 'Never auto-lock')}
                </Badge>
              )}
            </span>
          </div>
          {settings.inactivityTimeout === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'settings.security.noTimeoutWarning',
                  'Warning: Your session will never auto-lock. This is not recommended for shared devices.'
                )}
              </AlertDescription>
            </Alert>
          )}
          {settings.inactivityTimeout > 0 && settings.inactivityTimeout < 5 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'settings.security.shortTimeoutInfo',
                  'Very short timeout may require frequent re-authentication.'
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Lock on Tab Hide */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="lock-on-hide" className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              {t('settings.security.lockOnHide', 'Lock When Tab Hidden')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.security.lockOnHideDesc',
                'Lock immediately when you switch to another tab or minimize the browser'
              )}
            </p>
          </div>
          <Switch
            id="lock-on-hide"
            checked={settings.lockOnHide}
            onCheckedChange={(checked) => handleSettingChange('lockOnHide', checked)}
          />
        </div>

        {/* Lock on Close */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="lock-on-close" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('settings.security.lockOnClose', 'Lock When Browser Closed')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.security.lockOnCloseDesc',
                'Require re-authentication when you reopen the app'
              )}
            </p>
          </div>
          <Switch
            id="lock-on-close"
            checked={settings.lockOnClose}
            onCheckedChange={(checked) => handleSettingChange('lockOnClose', checked)}
          />
        </div>
        {!settings.lockOnClose && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t(
                'settings.security.noLockOnCloseInfo',
                'Session will persist if browser is closed and reopened. Only recommended for personal devices.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Require Password for Export */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="require-password-export" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t('settings.security.requirePasswordExport', 'Require Password for Key Export')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.security.requirePasswordExportDesc',
                'Always require password verification when exporting your private key (nsec)'
              )}
            </p>
          </div>
          <Switch
            id="require-password-export"
            checked={settings.requirePasswordForExport}
            onCheckedChange={(checked) =>
              handleSettingChange('requirePasswordForExport', checked)
            }
            disabled // Always true for security
          />
        </div>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            {t(
              'settings.security.exportSecurityNote',
              'Password verification for key export cannot be disabled. This protects your private key from unauthorized access.'
            )}
          </AlertDescription>
        </Alert>

        {/* Save/Reset Buttons */}
        {hasChanges && (
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              {t('common.reset', 'Reset')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? t('common.saving', 'Saving...')
                : t('common.saveChanges', 'Save Changes')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
