/**
 * Device Activity History Component
 * Displays device activity logs and security events
 */

import { useState } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LogIn,
  LogOut,
  Key,
  RefreshCw,
  Plus,
  Trash2,
  Shield,
  ShieldOff,
  AlertTriangle,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DeviceActivity, DeviceActivityType } from '@/types/device';

const ACTIVITY_ICONS: Record<DeviceActivityType, LucideIcon> = {
  login: LogIn,
  logout: LogOut,
  key_access: Key,
  key_rotation: RefreshCw,
  device_added: Plus,
  device_removed: Trash2,
  device_trusted: Shield,
  device_untrusted: ShieldOff,
  session_revoked: X,
  webauthn_registered: Key,
  webauthn_authenticated: Key,
  suspicious_activity: AlertTriangle,
};

const ACTIVITY_COLORS: Record<DeviceActivityType, string> = {
  login: 'text-green-600',
  logout: 'text-gray-600',
  key_access: 'text-blue-600',
  key_rotation: 'text-purple-600',
  device_added: 'text-green-600',
  device_removed: 'text-red-600',
  device_trusted: 'text-green-600',
  device_untrusted: 'text-yellow-600',
  session_revoked: 'text-red-600',
  webauthn_registered: 'text-blue-600',
  webauthn_authenticated: 'text-green-600',
  suspicious_activity: 'text-red-600',
};

export function DeviceActivityHistory() {
  const { activities, devices, clearOldActivities } = useDeviceStore();
  const [filter, setFilter] = useState<DeviceActivityType | 'all'>('all');

  const filteredActivities = activities
    .filter((a) => filter === 'all' || a.type === filter)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100); // Limit to 100 most recent

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.get(deviceId);
    return device?.name || 'Unknown Device';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              Recent security events and device activities
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearOldActivities(30)}
            >
              Clear Old (30+ days)
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filter Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={filter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter('all')}
            >
              All
            </Badge>
            {Object.keys(ACTIVITY_ICONS).map((type) => (
              <Badge
                key={type}
                variant={filter === type ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter(type as DeviceActivityType)}
              >
                {type.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>

          {/* Activity List */}
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  deviceName={getDeviceName(activity.deviceId)}
                  formatTimestamp={formatTimestamp}
                />
              ))}

              {filteredActivities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>No activity found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

interface ActivityItemProps {
  activity: DeviceActivity;
  deviceName: string;
  formatTimestamp: (timestamp: number) => string;
}

function ActivityItem({ activity, deviceName, formatTimestamp }: ActivityItemProps) {
  const Icon = ACTIVITY_ICONS[activity.type] || AlertTriangle;
  const colorClass = ACTIVITY_COLORS[activity.type] || 'text-gray-600';

  return (
    <div className="flex items-start gap-3 border-b pb-3 last:border-0">
      <div className={`rounded-full bg-muted p-2 ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{activity.description}</p>
            <p className="text-xs text-muted-foreground">
              {deviceName} • {formatTimestamp(activity.timestamp)}
            </p>
          </div>
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {activity.type.replace(/_/g, ' ')}
          </Badge>
        </div>
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <details>
              <summary className="cursor-pointer hover:text-foreground">
                View metadata
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                {JSON.stringify(activity.metadata, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
