/**
 * Files Page
 * Main file manager interface with upload, folders, and preview
 * Epic 57: Enhanced with advanced search filters and bulk operations
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Upload,
  FolderPlus,
  Grid,
  List,
  Search,
  Filter,
  X,
  Image,
  FileText,
  Video,
  Music,
  Archive,
  File,
  CheckSquare,
  Download,
  Trash2,
  FolderInput,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { useGroupContext } from '@/contexts/GroupContext'
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'
import { FileUploadZone } from './FileUploadZone'
import { FolderBrowser } from './FolderBrowser'
import { FileList } from './FileList'
import { CreateFolderDialog } from './CreateFolderDialog'
import { MoveFolderDialog } from './MoveFolderDialog'
import type { FileType } from '../types'

type ViewMode = 'grid' | 'list'
type SizeFilter = 'all' | 'small' | 'medium' | 'large'
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year'

interface SearchFilters {
  type: FileType | 'all'
  size: SizeFilter
  date: DateFilter
}

export function FilesPage() {
  const { groupId } = useGroupContext()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    size: 'all',
    date: 'all',
  })

  // Epic 57: Bulk operations state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [bulkOperationInProgress, setBulkOperationInProgress] = useState(false)

  const currentFolderId = useFilesStore((state) => state.currentFolderId)
  const files = useFilesStore((state) => state.getGroupFiles(groupId, currentFolderId))
  const folders = useFilesStore((state) => state.getGroupFolders(groupId, currentFolderId))
  const quota = useFilesStore((state) => state.getStorageQuota(groupId))

  // Check if any filters are active
  const hasActiveFilters = filters.type !== 'all' || filters.size !== 'all' || filters.date !== 'all'

  // Clear all filters
  const clearFilters = () => {
    setFilters({ type: 'all', size: 'all', date: 'all' })
    setSearchQuery('')
  }

  // Epic 57: Bulk operations handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        // Exiting selection mode - clear selection
        setSelectedFiles(new Set())
      }
      return !prev
    })
  }, [])

  const handleBulkDownload = useCallback(async () => {
    if (selectedFiles.size === 0) return
    setBulkOperationInProgress(true)

    try {
      // For single file, just download directly
      if (selectedFiles.size === 1) {
        const fileId = Array.from(selectedFiles)[0]
        const file = files.find((f) => f.id === fileId)
        if (file) {
          const blob = await fileManager.getFileBlob(fileId)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          a.click()
          URL.revokeObjectURL(url)
        }
      } else {
        // For multiple files, create a ZIP
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()

        for (const fileId of selectedFiles) {
          const file = files.find((f) => f.id === fileId)
          if (file) {
            try {
              const blob = await fileManager.getFileBlob(fileId)
              zip.file(file.name, blob)
            } catch (err) {
              console.error(`Failed to add file ${file.name} to ZIP:`, err)
            }
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `files-${new Date().toISOString().slice(0, 10)}.zip`
        a.click()
        URL.revokeObjectURL(url)
      }

      // Clear selection after download
      setSelectedFiles(new Set())
      setSelectionMode(false)
    } catch (err) {
      console.error('Bulk download failed:', err)
      alert('Failed to download files. Please try again.')
    } finally {
      setBulkOperationInProgress(false)
    }
  }, [selectedFiles, files])

  const handleBulkDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return
    setBulkOperationInProgress(true)

    try {
      for (const fileId of selectedFiles) {
        await fileManager.deleteFile(fileId)
      }
      setSelectedFiles(new Set())
      setSelectionMode(false)
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Bulk delete failed:', err)
      alert('Failed to delete some files. Please try again.')
    } finally {
      setBulkOperationInProgress(false)
    }
  }, [selectedFiles])

  const handleBulkMove = useCallback(
    async (targetFolderId: string | null) => {
      if (selectedFiles.size === 0) return
      setBulkOperationInProgress(true)

      try {
        for (const fileId of selectedFiles) {
          await fileManager.moveFile(fileId, targetFolderId)
        }
        setSelectedFiles(new Set())
        setSelectionMode(false)
        setShowMoveDialog(false)
      } catch (err) {
        console.error('Bulk move failed:', err)
        alert('Failed to move some files. Please try again.')
      } finally {
        setBulkOperationInProgress(false)
      }
    },
    [selectedFiles]
  )

  // Load files on mount
  useEffect(() => {
    fileManager.loadGroupFiles(groupId)

    // Initialize quota if not exists
    if (!quota) {
      fileManager.initializeStorageQuota(groupId, 1024 * 1024 * 1024) // 1GB default
    }
  }, [groupId, quota])

  // Filter files by search query and filters
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Search query filter
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Type filter
      if (filters.type !== 'all' && file.type !== filters.type) {
        return false
      }

      // Size filter
      if (filters.size !== 'all') {
        const sizeMB = file.size / (1024 * 1024)
        switch (filters.size) {
          case 'small':
            if (sizeMB > 1) return false
            break
          case 'medium':
            if (sizeMB <= 1 || sizeMB > 100) return false
            break
          case 'large':
            if (sizeMB <= 100) return false
            break
        }
      }

      // Date filter
      if (filters.date !== 'all') {
        const now = Date.now()
        const fileDate = file.updatedAt
        const dayMs = 24 * 60 * 60 * 1000
        switch (filters.date) {
          case 'today':
            if (now - fileDate > dayMs) return false
            break
          case 'week':
            if (now - fileDate > 7 * dayMs) return false
            break
          case 'month':
            if (now - fileDate > 30 * dayMs) return false
            break
          case 'year':
            if (now - fileDate > 365 * dayMs) return false
            break
        }
      }

      return true
    })
  }, [files, searchQuery, filters])

  // Select all filtered files (moved here because it depends on filteredFiles)
  const selectAllFiles = useCallback(() => {
    if (selectedFiles.size === filteredFiles.length) {
      // Deselect all if all are selected
      setSelectedFiles(new Set())
    } else {
      // Select all filtered files
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)))
    }
  }, [filteredFiles, selectedFiles.size])

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
            {/* Epic 57: Selection mode toggle */}
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Select
                </>
              )}
            </Button>
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

        {/* Epic 57: Bulk operations toolbar */}
        {selectionMode && (
          <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedFiles.size > 0 && selectedFiles.size === filteredFiles.length}
                  onCheckedChange={() => selectAllFiles()}
                />
                <span className="text-sm font-medium">
                  {selectedFiles.size === 0
                    ? 'Select files'
                    : `${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''} selected`}
                </span>
              </div>
            </div>

            {selectedFiles.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDownload}
                  disabled={bulkOperationInProgress}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {selectedFiles.size > 1 ? 'Download ZIP' : 'Download'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMoveDialog(true)}
                  disabled={bulkOperationInProgress}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  Move
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkOperationInProgress}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}

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

          {/* Filter popover */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {[filters.type !== 'all', filters.size !== 'all', filters.date !== 'all'].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter Files</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* File Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Type</label>
                  <Select
                    value={filters.type}
                    onValueChange={(value) => setFilters((f) => ({ ...f, type: value as FileType | 'all' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          All Types
                        </span>
                      </SelectItem>
                      <SelectItem value="image">
                        <span className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Images
                        </span>
                      </SelectItem>
                      <SelectItem value="document">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documents
                        </span>
                      </SelectItem>
                      <SelectItem value="video">
                        <span className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Videos
                        </span>
                      </SelectItem>
                      <SelectItem value="audio">
                        <span className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Audio
                        </span>
                      </SelectItem>
                      <SelectItem value="archive">
                        <span className="flex items-center gap-2">
                          <Archive className="h-4 w-4" />
                          Archives
                        </span>
                      </SelectItem>
                      <SelectItem value="other">
                        <span className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          Other
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File Size Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Size</label>
                  <Select
                    value={filters.size}
                    onValueChange={(value) => setFilters((f) => ({ ...f, size: value as SizeFilter }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sizes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      <SelectItem value="small">Small (&lt; 1 MB)</SelectItem>
                      <SelectItem value="medium">Medium (1-100 MB)</SelectItem>
                      <SelectItem value="large">Large (&gt; 100 MB)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modified</label>
                  <Select
                    value={filters.date}
                    onValueChange={(value) => setFilters((f) => ({ ...f, date: value as DateFilter }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Past Week</SelectItem>
                      <SelectItem value="month">Past Month</SelectItem>
                      <SelectItem value="year">Past Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {filters.type !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Type: {filters.type}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, type: 'all' }))}
                />
              </Badge>
            )}
            {filters.size !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Size: {filters.size}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, size: 'all' }))}
                />
              </Badge>
            )}
            {filters.date !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Modified: {filters.date}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, date: 'all' }))}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Folder breadcrumbs */}
      <FolderBrowser />

      {/* File list */}
      <div className="flex-1 overflow-auto p-4">
        <FileList
          files={filteredFiles}
          folders={folders}
          viewMode={viewMode}
          selectionMode={selectionMode}
          selectedFiles={selectedFiles}
          onSelectionChange={setSelectedFiles}
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

      {/* Epic 57: Bulk delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected files will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkOperationInProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkOperationInProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkOperationInProgress ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Epic 57: Bulk move dialog */}
      {showMoveDialog && (
        <MoveFolderDialog
          groupId={groupId}
          currentFolderId={currentFolderId}
          selectedCount={selectedFiles.size}
          onMove={handleBulkMove}
          onClose={() => setShowMoveDialog(false)}
        />
      )}
    </div>
  )
}
