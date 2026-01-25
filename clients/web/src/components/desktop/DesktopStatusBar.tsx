/**
 * Desktop Status Bar
 * Shows connection status, sync status, and desktop-specific info
 * Only visible in Tauri environment
 */

import { FC, useEffect, useState } from 'react';
import { Wifi, WifiOff, Bluetooth, BluetoothOff, RefreshCw, Check } from 'lucide-react';
import { useTauri } from '@/lib/tauri';
import { cn } from '@/lib/utils';

interface DesktopStatusBarProps {
  className?: string;
}

/**
 * Status bar for desktop app showing connection and sync status
 */
export const DesktopStatusBar: FC<DesktopStatusBarProps> = ({ className }) => {
  const { isTauri } = useTauri();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bleStatus, setBleStatus] = useState<'connected' | 'scanning' | 'off'>('off');

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for sync events
  useEffect(() => {
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => setIsSyncing(false);
    const handleBleStatus = (e: CustomEvent<'connected' | 'scanning' | 'off'>) => {
      setBleStatus(e.detail);
    };

    window.addEventListener('sync-start', handleSyncStart);
    window.addEventListener('sync-end', handleSyncEnd);
    window.addEventListener('ble-status', handleBleStatus as EventListener);

    return () => {
      window.removeEventListener('sync-start', handleSyncStart);
      window.removeEventListener('sync-end', handleSyncEnd);
      window.removeEventListener('ble-status', handleBleStatus as EventListener);
    };
  }, []);

  // Only render in Tauri environment
  if (!isTauri) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-1 text-xs text-muted-foreground border-t bg-muted/30',
        className
      )}
    >
      {/* Network status */}
      <div className="flex items-center gap-1">
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-yellow-500" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* BLE status */}
      <div className="flex items-center gap-1">
        {bleStatus === 'connected' ? (
          <>
            <Bluetooth className="h-3 w-3 text-blue-500" />
            <span>BLE Connected</span>
          </>
        ) : bleStatus === 'scanning' ? (
          <>
            <Bluetooth className="h-3 w-3 text-blue-500 animate-pulse" />
            <span>Scanning...</span>
          </>
        ) : (
          <>
            <BluetoothOff className="h-3 w-3" />
            <span>BLE Off</span>
          </>
        )}
      </div>

      {/* Sync status */}
      <div className="flex items-center gap-1 ml-auto">
        {isSyncing ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span>Synced</span>
          </>
        )}
      </div>
    </div>
  );
};

export default DesktopStatusBar;
