/**
 * Files Page
 * Main file manager interface with upload, folders, and preview
 */

import { useState, useEffect } from 'react'
import { Upload, FolderPlus, Grid, List, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGroupContext } from '@/contexts/GroupContext'
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'
import { FileUploadZone } from './FileUploadZone'
import { FolderBrowser } from './FolderBrowser'
import { FileList } from './FileList'
import { CreateFolderDialog } from './CreateFolderDialog'

type ViewMode = 'grid' | 'list'

export function FilesPage() {
  const { groupId } = useGroupContext()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  const currentFolderId = useFilesStore((state) => state.currentFolderId)
  const files = useFilesStore((state) => state.getGroupFiles(groupId, currentFolderId))
  const folders = useFilesStore((state) => state.getGroupFolders(groupId, currentFolderId))
  const quota = useFilesStore((state) => state.getStorageQuota(groupId))

  // Load files on mount
  useEffect(() => {
    fileManager.loadGroupFiles(groupId)

    // Initialize quota if not exists
    if (!quota) {
      fileManager.initializeStorageQuota(groupId, 1024 * 1024 * 1024) // 1GB default
    }
  }, [groupId, quota])

  // Filter files by search query
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const quotaPercentage = quota
    ? Math.round((quota.usedBytes / quota.totalBytes) * 100)
    : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Files</h1>
            <p className="text-sm text-muted-foreground">
              {quota && (
                <>
                  {(quota.usedBytes / 1024 / 1024).toFixed(1)} MB /{' '}
                  {(quota.totalBytes / 1024 / 1024).toFixed(0)} MB used ({quotaPercentage}%)
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button size="sm" onClick={() => setShowUploadZone(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Files
            </Button>
          </div>
        </div>

        {/* Search and view controls */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Folder breadcrumbs */}
      <FolderBrowser />

      {/* File list */}
      <div className="flex-1 overflow-auto p-4">
        <FileList
          files={filteredFiles}
          folders={folders}
          viewMode={viewMode}
        />
      </div>

      {/* Upload dialog */}
      {showUploadZone && (
        <FileUploadZone
          groupId={groupId}
          folderId={currentFolderId}
          onClose={() => setShowUploadZone(false)}
        />
      )}

      {/* Create folder dialog */}
      {showCreateFolder && (
        <CreateFolderDialog
          groupId={groupId}
          parentId={currentFolderId}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  )
}
