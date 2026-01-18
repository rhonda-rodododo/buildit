/**
 * Device Manager Component
 * Displays and manages all devices and active sessions
 */

import { useState } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  Shield,
  ShieldOff,
  LogOut,
  Trash2,
  Check,
  Clock,
  MapPin,
} from 'lucide-react';
import type { DeviceInfo, DeviceSession } from '@/types/device';

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
};

export function DeviceManager() {
  const {
    devices,
    currentDeviceId,
    removeDevice,
    trustDevice,
    untrustDevice,
    revokeSession,
    revokeAllSessions,
    getActiveSessions,
  } = useDeviceStore();

  const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  const deviceList = Array.from(devices.values());
  const activeSessions = getActiveSessions();

  const handleRemoveDevice = (deviceId: string) => {
    removeDevice(deviceId);
    setDeviceToRemove(null);
  };

  const handleRevokeAllSessions = () => {
    revokeAllSessions(true); // Keep current device
    setShowRevokeAll(false);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Device Management</CardTitle>
              <CardDescription>
                Manage devices and sessions that have access to your account
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowRevokeAll(true)}
              disabled={activeSessions.length <= 1}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out All Devices
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deviceList.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isCurrent={device.id === currentDeviceId}
                onRemove={() => setDeviceToRemove(device.id)}
                onTrust={() => trustDevice(device.id)}
                onUntrust={() => untrustDevice(device.id)}
                onRevokeSession={(sessionId) => revokeSession(sessionId)}
                sessions={activeSessions.filter((s) => s.deviceId === device.id)}
                formatTimestamp={formatTimestamp}
              />
            ))}

            {deviceList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No devices found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remove Device Confirmation */}
      <AlertDialog open={!!deviceToRemove} onOpenChange={() => setDeviceToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this device? All sessions for this device will
              be revoked and you'll need to re-authorize it to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deviceToRemove && handleRemoveDevice(deviceToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke All Sessions Confirmation */}
      <AlertDialog open={showRevokeAll} onOpenChange={setShowRevokeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out All Devices</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of all other devices except this one. You'll need to sign
              in again on those devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeAllSessions}>
              Sign Out All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DeviceCardProps {
  device: DeviceInfo;
  isCurrent: boolean;
  sessions: DeviceSession[];
  onRemove: () => void;
  onTrust: () => void;
  onUntrust: () => void;
  onRevokeSession: (sessionId: string) => void;
  formatTimestamp: (timestamp: number) => string;
}

function DeviceCard({
  device,
  isCurrent,
  sessions,
  onRemove,
  onTrust,
  onUntrust,
  onRevokeSession,
  formatTimestamp,
}: DeviceCardProps) {
  const DeviceIcon = DEVICE_ICONS[device.type] || HelpCircle;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="rounded-full bg-primary/10 p-2">
            <DeviceIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{device.name}</h4>
              {isCurrent && (
                <Badge variant="default" className="text-xs">
                  Current Device
                </Badge>
              )}
              {device.isTrusted && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Trusted
                </Badge>
              )}
              {device.webAuthnEnabled && (
                <Badge variant="outline" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  WebAuthn
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {device.browser} • {device.os}
            </div>
          </div>
        </div>

        {!isCurrent && (
          <div className="flex gap-2">
            {device.isTrusted ? (
              <Button variant="ghost" size="sm" onClick={onUntrust}>
                <ShieldOff className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onTrust}>
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Active Sessions</div>
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between text-sm bg-muted/50 rounded p-2"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimestamp(session.lastActive)}</span>
                </div>
                {session.location && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{session.location}</span>
                  </div>
                )}
                {session.ipAddress && (
                  <span className="text-muted-foreground font-mono text-xs">
                    {session.ipAddress}
                  </span>
                )}
              </div>
              {!isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevokeSession(session.id)}
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No active sessions</div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last seen: {formatTimestamp(device.lastSeen)}</span>
        <span>First seen: {formatTimestamp(device.firstSeen)}</span>
      </div>
    </div>
  );
}
