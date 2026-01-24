/**
 * File Analytics Dashboard
 * Epic 57: Storage breakdown, most accessed files, activity log, duplicate detection
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  HardDrive,
  Share2,
  Clock,
  Copy,
  Trash2,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  Archive,
  File,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fileAnalytics } from '../fileAnalytics'
import { fileManager } from '../fileManager'
import { useFilesStore } from '../filesStore'
import type { FileAnalytics, FileActivityLog, FileType } from '../types'

// Re-export for potential future use
export type { DuplicateFileGroup } from '../types'

interface FileAnalyticsDashboardProps {
  groupId: string
  onClose: () => void
}

const FILE_TYPE_ICONS: Record<FileType, typeof File> = {
  image: FileImage,
  document: FileText,
  video: FileVideo,
  audio: FileAudio,
  archive: Archive,
  other: File,
}

const FILE_TYPE_COLORS: Record<FileType, string> = {
  image: 'bg-green-500',
  document: 'bg-blue-500',
  video: 'bg-purple-500',
  audio: 'bg-yellow-500',
  archive: 'bg-orange-500',
  other: 'bg-gray-500',
}

export function FileAnalyticsDashboard({ groupId, onClose }: FileAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<FileAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const quota = useFilesStore((state) => state.getStorageQuota(groupId))
  const files = useFilesStore((state) => state.files)

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fileAnalytics.getAnalytics(groupId)
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [groupId])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const handleRefresh = () => {
    setRefreshing(true)
    loadAnalytics()
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const getActionLabel = (action: FileActivityLog['action']) => {
    const labels: Record<FileActivityLog['action'], string> = {
      upload: 'Uploaded',
      download: 'Downloaded',
      share: 'Shared',
      delete: 'Deleted',
      move: 'Moved',
      rename: 'Renamed',
      view: 'Viewed',
    }
    return labels[action]
  }

  const handleDeleteDuplicate = async (fileId: string) => {
    if (!confirm('Delete this duplicate file?')) return
    try {
      await fileManager.deleteFile(fileId)
      loadAnalytics()
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }

  // Epic 58: Export sharing report as CSV
  const exportSharingReport = useFilesStore((state) => state.exportSharingReportCSV)
  const [exporting, setExporting] = useState(false)

  const handleExportSharingReport = async () => {
    setExporting(true)
    try {
      const csv = await exportSharingReport(groupId)
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sharing-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export sharing report:', err)
      alert('Failed to export sharing report')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              File Analytics
            </DialogTitle>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicates
              {analytics?.duplicates && analytics.duplicates.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                  {analytics.duplicates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-auto">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Storage Usage Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Storage Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatSize(analytics?.totalSize || 0)}
                  </div>
                  {quota && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        of {formatSize(quota.totalBytes)} used
                      </p>
                      <Progress
                        value={(quota.usedBytes / quota.totalBytes) * 100}
                        className="mt-2"
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* File Count Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <File className="h-4 w-4" />
                    Total Files
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics?.totalFiles || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    files in this group
                  </p>
                </CardContent>
              </Card>

              {/* Shared Files Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Shared Files
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics?.sharedFilesCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    files shared with others
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Storage Breakdown by Type */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Storage by File Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.storageByType &&
                    Object.entries(analytics.storageByType)
                      .filter(([, data]) => data.count > 0)
                      .sort((a, b) => b[1].size - a[1].size)
                      .map(([type, data]) => {
                        const Icon = FILE_TYPE_ICONS[type as FileType]
                        const percentage = analytics.totalSize > 0
                          ? (data.size / analytics.totalSize) * 100
                          : 0
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium capitalize">{type}</span>
                                <span className="text-sm text-muted-foreground">
                                  {data.count} files ({formatSize(data.size)})
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${FILE_TYPE_COLORS[type as FileType]} transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  {(!analytics?.storageByType ||
                    Object.values(analytics.storageByType).every(d => d.count === 0)) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No files uploaded yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Most Accessed Files */}
            {analytics?.mostAccessedFiles && analytics.mostAccessedFiles.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Most Accessed Files</CardTitle>
                  <CardDescription>Files with the most share access</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.mostAccessedFiles.slice(0, 5).map((item, index) => {
                      const file = files.get(item.fileId)
                      if (!file) return null
                      return (
                        <div
                          key={item.fileId}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6">
                              #{index + 1}
                            </span>
                            <span className="truncate max-w-[200px]">{file.name}</span>
                          </div>
                          <Badge variant="secondary">
                            {item.accessCount} accesses
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                <div className="space-y-2 p-1">
                  {analytics.recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{getActionLabel(log.action)}</span>
                          {' '}
                          <span className="text-muted-foreground truncate inline-block max-w-[200px] align-bottom">
                            {log.fileName}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Duplicates Tab */}
          <TabsContent value="duplicates" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              {analytics?.duplicates && analytics.duplicates.length > 0 ? (
                <div className="space-y-4 p-1">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm text-yellow-600">
                      Found {analytics.duplicates.length} duplicate file groups.
                      Consider deleting duplicates to free up storage.
                    </p>
                  </div>

                  {analytics.duplicates.map((group, groupIndex) => (
                    <Card key={group.hash}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Copy className="h-4 w-4" />
                          Duplicate Group #{groupIndex + 1}
                        </CardTitle>
                        <CardDescription>
                          {group.files.length} identical files ({formatSize(group.files[0]?.size || 0)} each)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {group.files.map((file, fileIndex) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {file.path}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Created {new Date(file.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              {fileIndex > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive ml-2"
                                  onClick={() => handleDeleteDuplicate(file.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {fileIndex === 0 && (
                                <Badge variant="outline" className="ml-2">Keep</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Copy className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No duplicate files found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your storage is optimized!
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Shared Tab */}
          <TabsContent value="shared" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              {analytics?.sharedFilesCount && analytics.sharedFilesCount > 0 ? (
                <div className="p-1">
                  <div className="text-center py-8">
                    <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-2xl font-bold">{analytics.sharedFilesCount}</p>
                    <p className="text-sm text-muted-foreground">files shared</p>
                    <p className="text-xs text-muted-foreground mt-4">
                      View individual file shares in the file list.
                    </p>
                    {/* Epic 58: Export sharing report button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={handleExportSharingReport}
                      disabled={exporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {exporting ? 'Exporting...' : 'Export Sharing Report'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No files shared yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Share files to see them here
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
