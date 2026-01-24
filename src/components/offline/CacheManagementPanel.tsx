/**
 * Cache Management Panel
 * Epic 60: UI for managing cache settings, viewing usage, and clearing data
 */

import { useState, useEffect } from 'react'
import {
  HardDrive,
  Trash2,
  Download,
  RefreshCw,
  AlertCircle,
  Archive,
  Image,
  FileText,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCacheStore } from '@/core/offline/cacheStore'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface CacheManagementPanelProps {
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function CacheManagementPanel({ className }: CacheManagementPanelProps) {
  const usage = useCacheStore((state) => state.usage)
  const config = useCacheStore((state) => state.config)
  const pruneConfig = useCacheStore((state) => state.pruneConfig)
  const isProcessing = useCacheStore((state) => state.isProcessing)
  const lastPruneAt = useCacheStore((state) => state.lastPruneAt)
  const loadUsage = useCacheStore((state) => state.loadUsage)
  const setConfig = useCacheStore((state) => state.setConfig)
  const setPruneConfig = useCacheStore((state) => state.setPruneConfig)
  const evictLRU = useCacheStore((state) => state.evictLRU)
  const clearCache = useCacheStore((state) => state.clearCache)
  const pruneOldData = useCacheStore((state) => state.pruneOldData)
  const exportOfflineData = useCacheStore((state) => state.exportOfflineData)

  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showPruneDialog, setShowPruneDialog] = useState(false)

  // Load usage on mount
  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  const handleExport = async () => {
    try {
      const blob = await exportOfflineData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `buildit-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
    }
  }

  const handleClearCache = async () => {
    await clearCache()
    setShowClearDialog(false)
  }

  const handlePruneData = async () => {
    await pruneOldData()
    setShowPruneDialog(false)
  }

  const usagePercent = Math.min(usage.percentUsed * 100, 100)
  const usageColor =
    usagePercent > 90
      ? 'text-destructive'
      : usagePercent > 70
        ? 'text-amber-500'
        : 'text-green-500'

  return (
    <div className={cn('space-y-6', className)}>
      {/* Storage Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            Cached data for offline access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className={usageColor}>
                {formatBytes(usage.totalBytes)} used
              </span>
              <span className="text-muted-foreground">
                {formatBytes(usage.maxBytes)} limit
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usage.itemCount} cached items</span>
              {usage.oldestItemAge > 0 && (
                <span>
                  Oldest: {formatDistanceToNow(Date.now() - usage.oldestItemAge)} ago
                </span>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Images & Media</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">App Data</span>
            </div>
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Offline Queue</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadUsage()}
              disabled={isProcessing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isProcessing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => evictLRU()}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Free Space
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Settings</CardTitle>
          <CardDescription>
            Configure how long data is kept offline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Max cache size */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Maximum Cache Size</Label>
              <p className="text-xs text-muted-foreground">
                Limit for cached files and images
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(config.maxSizeBytes / (1024 * 1024))}
                onChange={(e) =>
                  setConfig({
                    maxSizeBytes: parseInt(e.target.value) * 1024 * 1024,
                  })
                }
                className="w-20 text-right"
                min={10}
                max={500}
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>

          <Separator />

          {/* Max cache age */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cache Expiration</Label>
              <p className="text-xs text-muted-foreground">
                Auto-delete cached items older than
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.maxAgeDays}
                onChange={(e) =>
                  setConfig({ maxAgeDays: parseInt(e.target.value) })
                }
                className="w-20 text-right"
                min={1}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Pruning Card */}
      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
          <CardDescription>
            Configure how long messages and posts are kept locally
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages retention */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Messages</Label>
              <p className="text-xs text-muted-foreground">
                Keep local messages for
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={pruneConfig.messagesAgeDays}
                onChange={(e) =>
                  setPruneConfig({ messagesAgeDays: parseInt(e.target.value) })
                }
                className="w-20 text-right"
                min={7}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          <Separator />

          {/* Posts retention */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Posts</Label>
              <p className="text-xs text-muted-foreground">
                Keep local posts for
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={pruneConfig.postsAgeDays}
                onChange={(e) =>
                  setPruneConfig({ postsAgeDays: parseInt(e.target.value) })
                }
                className="w-20 text-right"
                min={7}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          <Separator />

          {/* Files retention */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Files</Label>
              <p className="text-xs text-muted-foreground">
                Keep cached files for
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={pruneConfig.filesAgeDays}
                onChange={(e) =>
                  setPruneConfig({ filesAgeDays: parseInt(e.target.value) })
                }
                className="w-20 text-right"
                min={7}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* Last prune info and prune button */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              {lastPruneAt ? (
                <>Last cleanup: {formatDistanceToNow(lastPruneAt, { addSuffix: true })}</>
              ) : (
                <>No cleanup performed yet</>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPruneDialog(true)}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clean Up Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Clear All Cache</Label>
              <p className="text-xs text-muted-foreground">
                Remove all cached data. You'll need to re-download content.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDialog(true)}
            >
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clear Cache Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all cached files, images, and temporary data.
              Your messages, posts, and account data will not be affected.
              Content will need to be re-downloaded when you access it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>
              Clear Cache
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Prune Data Dialog */}
      <AlertDialog open={showPruneDialog} onOpenChange={setShowPruneDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean Up Old Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove old messages, posts, and cached files based on
              your retention settings. This helps free up storage space while
              keeping recent data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePruneData}>
              Clean Up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
