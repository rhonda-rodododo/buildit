/**
 * Privacy Settings Component
 * Configure device tracking and privacy preferences
 */

import { useDeviceStore } from '@/stores/deviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

export function PrivacySettings() {
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
          Privacy & Security Settings
        </CardTitle>
        <CardDescription>
          Configure how device tracking and session management works
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IP Address Anonymization */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="anonymize-ip">Anonymize IP Addresses</Label>
            <p className="text-sm text-muted-foreground">
              Hide or hash IP addresses in session logs for better privacy
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
            <Label htmlFor="limit-fingerprint">Limit Device Fingerprinting</Label>
            <p className="text-sm text-muted-foreground">
              Reduce detail collected during device fingerprinting
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
            <Label htmlFor="auto-expire">Auto-Expire Inactive Sessions</Label>
            <p className="text-sm text-muted-foreground">
              Automatically end sessions that haven't been used
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
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
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
                ({Math.floor(privacySettings.sessionTimeoutMinutes / 60 / 24)} days)
              </span>
            </div>
          </div>
        )}

        {/* New Device Authorization */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="require-auth">Require Authorization for New Devices</Label>
            <p className="text-sm text-muted-foreground">
              Manually approve new devices before they can access your account
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
            <Label htmlFor="location-tracking">Enable Location Tracking</Label>
            <p className="text-sm text-muted-foreground">
              Track approximate location (city/country) for sessions
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
              Location tracking may compromise your privacy. Only enable if you understand
              the risks.
            </AlertDescription>
          </Alert>
        )}

        {/* Activity History Logging */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="activity-logs">Log Device Activity</Label>
            <p className="text-sm text-muted-foreground">
              Keep a history of device activities and security events
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
              Disabling activity logs will make it harder to detect unauthorized access or
              suspicious activity.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
