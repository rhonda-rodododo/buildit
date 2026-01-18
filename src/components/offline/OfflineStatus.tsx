/**
 * OfflineStatus Component
 * Displays offline queue status and sync progress
 * Epic 60: Offline Mode Enhancement
 */

import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Download,
  HardDrive,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOfflineQueueStore } from '@/core/offline/offlineQueueStore';
import { useCacheStore } from '@/core/offline/cacheStore';
import type { QueueItem } from '@/core/offline/types';

interface OfflineStatusProps {
  /** Show in compact mode (icon only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function OfflineStatus({ compact = false, className }: OfflineStatusProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const {
    syncStatus,
    isProcessing,
    getPendingItems,
    getFailedItems,
    retryAllFailed,
    clearCompleted,
    clearFailed,
    startSync,
    loadFromDatabase,
  } = useOfflineQueueStore();

  const {
    usage,
    calculateUsage,
    clearCache,
    exportOfflineData,
    pruneOldData,
    isProcessing: isCacheProcessing,
  } = useCacheStore();

  // Load queue and cache status on mount
  useEffect(() => {
    loadFromDatabase();
    calculateUsage();
  }, [loadFromDatabase, calculateUsage]);

  const pendingItems = getPendingItems();
  const failedItems = getFailedItems();
  const totalPending = pendingItems.length;
  const totalFailed = failedItems.length;

  // Determine status icon and color
  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <CloudOff className="h-4 w-4 text-yellow-500" />;
    }
    if (isProcessing) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (totalFailed > 0) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (totalPending > 0) {
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    }
    return <Cloud className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      return t('offline.status.offline', 'Offline');
    }
    if (isProcessing) {
      return t('offline.status.syncing', 'Syncing...');
    }
    if (totalFailed > 0) {
      return t('offline.status.failed', '{{count}} failed', { count: totalFailed });
    }
    if (totalPending > 0) {
      return t('offline.status.pending', '{{count}} pending', { count: totalPending });
    }
    return t('offline.status.synced', 'Synced');
  };

  const handleExport = async () => {
    try {
      const blob = await exportOfflineData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buildit-offline-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export offline data:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('relative', className)}
            aria-label={getStatusText()}
          >
            {getStatusIcon()}
            {(totalPending > 0 || totalFailed > 0) && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium flex items-center justify-center text-primary-foreground">
                {totalPending + totalFailed}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <OfflineStatusContent
            syncStatus={syncStatus}
            isProcessing={isProcessing}
            pendingItems={pendingItems}
            failedItems={failedItems}
            usage={usage}
            isCacheProcessing={isCacheProcessing}
            onRetry={retryAllFailed}
            onSync={startSync}
            onClearCompleted={clearCompleted}
            onClearFailed={clearFailed}
            onClearCache={clearCache}
            onPrune={pruneOldData}
            onExport={handleExport}
            formatBytes={formatBytes}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn('p-4 border rounded-lg', className)}>
      <OfflineStatusContent
        syncStatus={syncStatus}
        isProcessing={isProcessing}
        pendingItems={pendingItems}
        failedItems={failedItems}
        usage={usage}
        isCacheProcessing={isCacheProcessing}
        onRetry={retryAllFailed}
        onSync={startSync}
        onClearCompleted={clearCompleted}
        onClearFailed={clearFailed}
        onClearCache={clearCache}
        onPrune={pruneOldData}
        onExport={handleExport}
        formatBytes={formatBytes}
      />
    </div>
  );
}

interface OfflineStatusContentProps {
  syncStatus: ReturnType<typeof useOfflineQueueStore.getState>['syncStatus'];
  isProcessing: boolean;
  pendingItems: QueueItem[];
  failedItems: QueueItem[];
  usage: ReturnType<typeof useCacheStore.getState>['usage'];
  isCacheProcessing: boolean;
  onRetry: () => Promise<void>;
  onSync: () => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onClearFailed: () => Promise<void>;
  onClearCache: () => Promise<void>;
  onPrune: () => Promise<{
    messages: number;
    posts: number;
    files: number;
    cache: number;
  }>;
  onExport: () => Promise<void>;
  formatBytes: (bytes: number) => string;
}

function OfflineStatusContent({
  syncStatus,
  isProcessing,
  pendingItems,
  failedItems,
  usage,
  isCacheProcessing,
  onRetry,
  onSync,
  onClearCompleted: _onClearCompleted,
  onClearFailed,
  onClearCache,
  onPrune,
  onExport,
  formatBytes,
}: OfflineStatusContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {syncStatus.isOnline ? (
            <Cloud className="h-5 w-5 text-green-500" />
          ) : (
            <CloudOff className="h-5 w-5 text-yellow-500" />
          )}
          <span className="font-medium">
            {syncStatus.isOnline
              ? t('offline.online', 'Online')
              : t('offline.offline', 'Offline')}
          </span>
        </div>
        {syncStatus.backgroundSyncRegistered && (
          <Badge variant="secondary" className="text-xs">
            {t('offline.backgroundSync', 'Background Sync')}
          </Badge>
        )}
      </div>

      {/* Queue Status */}
      {(pendingItems.length > 0 || failedItems.length > 0) && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {t('offline.queue', 'Pending Queue')}
            </h4>

            {pendingItems.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('offline.pending', 'Pending')}
                </span>
                <Badge variant="outline">{pendingItems.length}</Badge>
              </div>
            )}

            {failedItems.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-red-500">
                  {t('offline.failed', 'Failed')}
                </span>
                <Badge variant="destructive">{failedItems.length}</Badge>
              </div>
            )}

            {/* Queue by type */}
            <div className="text-xs text-muted-foreground space-y-1">
              {['message', 'post', 'file-upload'].map((type) => {
                const count = pendingItems.filter((i) => i.type === type).length +
                  failedItems.filter((i) => i.type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="capitalize">{type.replace('-', ' ')}s</span>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {syncStatus.isOnline && pendingItems.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSync}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {t('offline.sync', 'Sync')}
                </Button>
              )}

              {failedItems.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  disabled={isProcessing || !syncStatus.isOnline}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t('offline.retry', 'Retry')}
                </Button>
              )}
            </div>

            {failedItems.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearFailed}
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('offline.clearFailed', 'Clear Failed')}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Cache Status */}
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <HardDrive className="h-4 w-4" />
            {t('offline.cache', 'Cache')}
          </h4>
          <span className="text-xs text-muted-foreground">
            {formatBytes(usage.totalBytes)} / {formatBytes(usage.maxBytes)}
          </span>
        </div>

        <Progress value={usage.percentUsed * 100} className="h-2" />

        <div className="text-xs text-muted-foreground">
          {usage.itemCount} {t('offline.items', 'items')}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onPrune}
            disabled={isCacheProcessing}
            className="flex-1"
          >
            {isCacheProcessing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            {t('offline.prune', 'Prune Old')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearCache}
            disabled={isCacheProcessing}
            className="flex-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('offline.clear', 'Clear')}
          </Button>
        </div>
      </div>

      {/* Export */}
      <Separator />
      <Button
        size="sm"
        variant="outline"
        onClick={onExport}
        className="w-full"
      >
        <Download className="h-4 w-4 mr-1" />
        {t('offline.export', 'Export Offline Data')}
      </Button>

      {/* Last sync time */}
      {syncStatus.lastSyncAt && (
        <div className="text-xs text-muted-foreground text-center">
          {t('offline.lastSync', 'Last synced')}: {' '}
          {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
          {syncStatus.lastSyncSuccess ? (
            <CheckCircle2 className="h-3 w-3 inline ml-1 text-green-500" />
          ) : (
            <AlertCircle className="h-3 w-3 inline ml-1 text-red-500" />
          )}
        </div>
      )}
    </div>
  );
}
