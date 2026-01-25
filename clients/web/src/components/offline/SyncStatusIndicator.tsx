/**
 * Sync Status Indicator
 * Epic 60: Displays offline queue status and pending items
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useOfflineQueueStore } from '@/core/offline/offlineQueueStore'
import { processAllPendingItems } from '@/core/offline/queueProcessor'
import type { QueueItem } from '@/core/offline/types'
import { formatDistanceToNow } from 'date-fns'

interface SyncStatusIndicatorProps {
  className?: string
  showLabel?: boolean
  variant?: 'compact' | 'full'
}

const ITEM_TYPE_LABEL_KEYS: Record<string, string> = {
  message: 'syncStatusIndicator.itemTypes.message',
  post: 'syncStatusIndicator.itemTypes.post',
  'file-upload': 'syncStatusIndicator.itemTypes.fileUpload',
  reaction: 'syncStatusIndicator.itemTypes.reaction',
  comment: 'syncStatusIndicator.itemTypes.comment',
}

export function SyncStatusIndicator({
  className,
  showLabel = false,
  variant = 'compact',
}: SyncStatusIndicatorProps) {
  const { t } = useTranslation()
  const syncStatus = useOfflineQueueStore((state) => state.syncStatus)
  const isProcessing = useOfflineQueueStore((state) => state.isProcessing)
  const items = useOfflineQueueStore((state) => state.items)
  const getPendingItems = useOfflineQueueStore((state) => state.getPendingItems)
  const getFailedItems = useOfflineQueueStore((state) => state.getFailedItems)
  const retryItem = useOfflineQueueStore((state) => state.retryItem)
  const retryAllFailed = useOfflineQueueStore((state) => state.retryAllFailed)
  const removeItem = useOfflineQueueStore((state) => state.removeItem)
  const clearCompleted = useOfflineQueueStore((state) => state.clearCompleted)
  const clearFailed = useOfflineQueueStore((state) => state.clearFailed)

  const [isOpen, setIsOpen] = useState(false)

  const pendingItems = getPendingItems()
  const failedItems = getFailedItems()
  const totalItems = items.size
  const hasPendingWork = pendingItems.length > 0 || failedItems.length > 0

  // Determine status icon and color
  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <CloudOff className="h-4 w-4" />
    }
    if (isProcessing || syncStatus.isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }
    if (failedItems.length > 0) {
      return <AlertCircle className="h-4 w-4" />
    }
    if (pendingItems.length > 0) {
      return <Cloud className="h-4 w-4" />
    }
    return <CheckCircle className="h-4 w-4" />
  }

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'text-muted-foreground'
    if (failedItems.length > 0) return 'text-destructive'
    if (pendingItems.length > 0) return 'text-amber-500'
    return 'text-green-500'
  }

  const getStatusText = () => {
    if (!syncStatus.isOnline) return t('syncStatusIndicator.offline')
    if (isProcessing) return t('syncStatusIndicator.syncing')
    if (failedItems.length > 0) return t('syncStatusIndicator.failed', { count: failedItems.length })
    if (pendingItems.length > 0) return t('syncStatusIndicator.pending', { count: pendingItems.length })
    return t('syncStatusIndicator.synced')
  }

  const handleRetryAll = async () => {
    await retryAllFailed()
  }

  const handleSync = async () => {
    await processAllPendingItems()
  }

  // Auto-close popover when all items are processed
  useEffect(() => {
    if (isOpen && totalItems === 0) {
      setIsOpen(false)
    }
  }, [isOpen, totalItems])

  // Don't show anything if everything is synced and online
  if (!hasPendingWork && syncStatus.isOnline && variant === 'compact') {
    return null
  }

  if (variant === 'compact') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', getStatusColor(), className)}
          >
            {getStatusIcon()}
            {showLabel && <span className="text-sm">{getStatusText()}</span>}
            {hasPendingWork && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-xs"
              >
                {pendingItems.length + failedItems.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <SyncStatusPanel
            pendingItems={pendingItems}
            failedItems={failedItems}
            isOnline={syncStatus.isOnline}
            isProcessing={isProcessing}
            onRetry={retryItem}
            onRemove={removeItem}
            onRetryAll={handleRetryAll}
            onSync={handleSync}
            onClearCompleted={clearCompleted}
            onClearFailed={clearFailed}
          />
        </PopoverContent>
      </Popover>
    )
  }

  // Full variant - inline panel
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <SyncStatusPanel
        pendingItems={pendingItems}
        failedItems={failedItems}
        isOnline={syncStatus.isOnline}
        isProcessing={isProcessing}
        onRetry={retryItem}
        onRemove={removeItem}
        onRetryAll={handleRetryAll}
        onSync={handleSync}
        onClearCompleted={clearCompleted}
        onClearFailed={clearFailed}
      />
    </div>
  )
}

interface SyncStatusPanelProps {
  pendingItems: QueueItem[]
  failedItems: QueueItem[]
  isOnline: boolean
  isProcessing: boolean
  onRetry: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onRetryAll: () => Promise<void>
  onSync: () => Promise<void>
  onClearCompleted: () => Promise<void>
  onClearFailed: () => Promise<void>
}

function SyncStatusPanel({
  pendingItems,
  failedItems,
  isOnline,
  isProcessing,
  onRetry,
  onRemove,
  onRetryAll,
  onSync,
  onClearCompleted: _onClearCompleted, // Reserved for future "clear completed" button
  onClearFailed,
}: SyncStatusPanelProps) {
  void _onClearCompleted;
  const { t } = useTranslation()
  const [showPending, setShowPending] = useState(true)
  const [showFailed, setShowFailed] = useState(true)

  return (
    <div className="divide-y">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Cloud className="h-4 w-4 text-green-500" />
          ) : (
            <CloudOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {isOnline ? t('syncStatusIndicator.online') : t('syncStatusIndicator.offline')}
          </span>
        </div>
        <div className="flex gap-1">
          {isOnline && pendingItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div>
          <button
            className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            onClick={() => setShowPending(!showPending)}
          >
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-amber-500" />
              <span className="text-sm">{t('syncStatusIndicator.pendingLabel')}</span>
              <Badge variant="secondary" className="text-xs">
                {pendingItems.length}
              </Badge>
            </div>
            {showPending ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showPending && (
            <ScrollArea className="max-h-[150px]">
              <div className="px-3 pb-3 space-y-2">
                {pendingItems.map((item) => (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Failed Items */}
      {failedItems.length > 0 && (
        <div>
          <button
            className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            onClick={() => setShowFailed(!showFailed)}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm">{t('syncStatusIndicator.failedLabel')}</span>
              <Badge variant="destructive" className="text-xs">
                {failedItems.length}
              </Badge>
            </div>
            {showFailed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showFailed && (
            <>
              <div className="px-3 pb-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryAll}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('syncStatusIndicator.retryAll')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFailed}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t('syncStatusIndicator.clearAll')}
                </Button>
              </div>
              <ScrollArea className="max-h-[150px]">
                <div className="px-3 pb-3 space-y-2">
                  {failedItems.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      onRetry={onRetry}
                      onRemove={onRemove}
                      showActions
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {pendingItems.length === 0 && failedItems.length === 0 && (
        <div className="p-6 text-center text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm">{t('syncStatusIndicator.everythingSynced')}</p>
        </div>
      )}
    </div>
  )
}

interface QueueItemRowProps {
  item: QueueItem
  onRetry?: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  showActions?: boolean
}

function QueueItemRow({
  item,
  onRetry,
  onRemove,
  showActions = false,
}: QueueItemRowProps) {
  const { t } = useTranslation()

  const getItemDescription = (item: QueueItem): string => {
    switch (item.type) {
      case 'message':
        return t('syncStatusIndicator.itemDescriptions.messageTo', { conversationId: (item.payload as any).conversationId?.slice(0, 8) })
      case 'post':
        return t('syncStatusIndicator.itemDescriptions.post', { content: ((item.payload as any).content || '').slice(0, 30) })
      case 'file-upload':
        return t('syncStatusIndicator.itemDescriptions.file', { fileName: (item.payload as any).fileName })
      case 'reaction':
        return t('syncStatusIndicator.itemDescriptions.reaction', { reactionType: (item.payload as any).reactionType })
      case 'comment':
        return t('syncStatusIndicator.itemDescriptions.commentOnPost')
      default: {
        // Handle any future queue types gracefully
        const unknownItem = item as { type: string }
        return unknownItem.type
      }
    }
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">
            {t(ITEM_TYPE_LABEL_KEYS[item.type] || item.type)}
          </Badge>
          {item.status === 'failed' && item.retryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {t('syncStatusIndicator.retriesFailed', { retryCount: item.retryCount, maxRetries: item.maxRetries })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {getItemDescription(item)}
        </p>
        {item.lastError && (
          <p className="text-xs text-destructive truncate">
            {item.lastError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
        </p>
      </div>

      {showActions && (
        <div className="flex gap-1 shrink-0 ml-2">
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onRetry(item.id)}
              title={t('syncStatusIndicator.retry')}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onRemove(item.id)}
            title={t('syncStatusIndicator.remove')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
