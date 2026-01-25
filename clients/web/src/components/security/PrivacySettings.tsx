/**
 * Privacy Settings Component
 * Configure device tracking and privacy preferences
 */

import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '@/stores/deviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

export function PrivacySettings() {
  const { t } = useTranslation();
  const { privacySettings, updatePrivacySettings } = useDeviceStore();

  const handleToggle = (key: keyof typeof privacySettings, value: boolean) => {
    updatePrivacySettings({ [key]: value });
  };

  const handleSessionTimeout = (minutes: number) => {
    if (minutes >= 1 && minutes <= 525600) { // Max 1 year
      updatePrivacySettings({ sessionTimeoutMinutes: minutes });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('privacySettings.title')}
        </CardTitle>
        <CardDescription>
          {t('privacySettings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IP Address Anonymization */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="anonymize-ip">{t('privacySettings.anonymizeIp.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.anonymizeIp.description')}
            </p>
          </div>
          <Switch
            id="anonymize-ip"
            checked={privacySettings.anonymizeIpAddresses}
            onCheckedChange={(checked) => handleToggle('anonymizeIpAddresses', checked)}
          />
        </div>

        {/* Fingerprinting Limit */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="limit-fingerprint">{t('privacySettings.limitFingerprinting.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.limitFingerprinting.description')}
            </p>
          </div>
          <Switch
            id="limit-fingerprint"
            checked={privacySettings.limitFingerprinting}
            onCheckedChange={(checked) => handleToggle('limitFingerprinting', checked)}
          />
        </div>

        {/* Auto-Expire Sessions */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-expire">{t('privacySettings.autoExpireSessions.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.autoExpireSessions.description')}
            </p>
          </div>
          <Switch
            id="auto-expire"
            checked={privacySettings.autoExpireSessions}
            onCheckedChange={(checked) => handleToggle('autoExpireSessions', checked)}
          />
        </div>

        {/* Session Timeout */}
        {privacySettings.autoExpireSessions && (
          <div className="space-y-2 pl-6">
            <Label htmlFor="session-timeout">{t('privacySettings.sessionTimeout.label')}</Label>
            <div className="flex items-center gap-4">
              <Input
                id="session-timeout"
                type="number"
                min="1"
                max="525600"
                value={privacySettings.sessionTimeoutMinutes}
                onChange={(e) => handleSessionTimeout(parseInt(e.target.value) || 1)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                {t('privacySettings.sessionTimeout.days', { count: Math.floor(privacySettings.sessionTimeoutMinutes / 60 / 24) })}
              </span>
            </div>
          </div>
        )}

        {/* New Device Authorization */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="require-auth">{t('privacySettings.requireAuthNewDevice.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.requireAuthNewDevice.description')}
            </p>
          </div>
          <Switch
            id="require-auth"
            checked={privacySettings.requireAuthOnNewDevice}
            onCheckedChange={(checked) => handleToggle('requireAuthOnNewDevice', checked)}
          />
        </div>

        {/* Location Tracking */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="location-tracking">{t('privacySettings.locationTracking.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.locationTracking.description')}
            </p>
          </div>
          <Switch
            id="location-tracking"
            checked={privacySettings.enableLocationTracking}
            onCheckedChange={(checked) => handleToggle('enableLocationTracking', checked)}
          />
        </div>

        {privacySettings.enableLocationTracking && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('privacySettings.locationTracking.warning')}
            </AlertDescription>
          </Alert>
        )}

        {/* Activity History Logging */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="activity-logs">{t('privacySettings.activityLogs.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('privacySettings.activityLogs.description')}
            </p>
          </div>
          <Switch
            id="activity-logs"
            checked={privacySettings.logActivityHistory}
            onCheckedChange={(checked) => handleToggle('logActivityHistory', checked)}
          />
        </div>

        {!privacySettings.logActivityHistory && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('privacySettings.activityLogs.warning')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
