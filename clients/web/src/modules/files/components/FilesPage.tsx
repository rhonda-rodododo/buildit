/**
 * Files Page
 * Main file manager interface with upload, folders, and preview
 * Epic 57: Enhanced with advanced search filters, bulk operations, analytics, and content search
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  Share2,
  BarChart3,
  Clock,
  Star,
  BookmarkPlus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useGroupContext } from '@/contexts/GroupContext'
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'
import { fileAnalytics } from '../fileAnalytics'
import { FileUploadZone } from './FileUploadZone'
import { FolderBrowser } from './FolderBrowser'
import { FileList } from './FileList'
import { CreateFolderDialog } from './CreateFolderDialog'
import { MoveFolderDialog } from './MoveFolderDialog'
import { FileAnalyticsDashboard } from './FileAnalyticsDashboard'
import { BulkShareDialog } from './BulkShareDialog'
import type { FileType, SavedSearchFilter, RecentSearch } from '../types'

type ViewMode = 'grid' | 'list'
type SizeFilter = 'all' | 'small' | 'medium' | 'large'
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year'

interface SearchFilters {
  type: FileType | 'all'
  size: SizeFilter
  date: DateFilter
}

export function FilesPage() {
  const { t } = useTranslation()
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

  // Epic 57: Analytics & Search state
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showBulkShare, setShowBulkShare] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedSearchFilter[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [contentSearchResults, setContentSearchResults] = useState<Set<string> | null>(null)
  const [isContentSearching, setIsContentSearching] = useState(false)

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
      alert(t('filesPage.downloadFailed'))
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
      alert(t('filesPage.deleteFailed'))
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
        alert(t('filesPage.moveFailed'))
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

    // Load saved filters and recent searches
    const loadSearchData = async () => {
      const filters = await fileAnalytics.getSavedFilters(groupId)
      const searches = await fileAnalytics.getRecentSearches(groupId)
      setSavedFilters(filters)
      setRecentSearches(searches)
    }
    loadSearchData()
  }, [groupId, quota])

  // Epic 57: Full-text content search
  const handleContentSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setContentSearchResults(null)
      return
    }

    setIsContentSearching(true)
    try {
      const results = await fileAnalytics.searchFileContents(groupId, searchQuery)
      setContentSearchResults(new Set(results))

      // Record recent search
      await fileAnalytics.addRecentSearch(groupId, searchQuery)
      const searches = await fileAnalytics.getRecentSearches(groupId)
      setRecentSearches(searches)
    } catch (err) {
      console.error('Content search failed:', err)
    } finally {
      setIsContentSearching(false)
    }
  }, [groupId, searchQuery])

  // Epic 57: Save current filter
  const handleSaveFilter = async () => {
    if (!filterName.trim()) return

    try {
      await fileAnalytics.saveSearchFilter({
        name: filterName,
        groupId,
        query: searchQuery || undefined,
        type: filters.type !== 'all' ? filters.type : undefined,
        size: filters.size !== 'all' ? filters.size : undefined,
        date: filters.date !== 'all' ? filters.date : undefined,
      })

      const updatedFilters = await fileAnalytics.getSavedFilters(groupId)
      setSavedFilters(updatedFilters)
      setShowSaveFilterDialog(false)
      setFilterName('')
    } catch (err) {
      console.error('Failed to save filter:', err)
    }
  }

  // Epic 57: Apply saved filter
  const applySavedFilter = (filter: SavedSearchFilter) => {
    if (filter.query) setSearchQuery(filter.query)
    setFilters({
      type: (filter.type as FileType | 'all') || 'all',
      size: filter.size || 'all',
      date: filter.date || 'all',
    })
    setShowFilters(false)
  }

  // Epic 57: Delete saved filter
  const handleDeleteSavedFilter = async (filterId: string) => {
    await fileAnalytics.deleteSavedFilter(filterId)
    const updatedFilters = await fileAnalytics.getSavedFilters(groupId)
    setSavedFilters(updatedFilters)
  }

  // Epic 57: Apply recent search
  const applyRecentSearch = (search: RecentSearch) => {
    setSearchQuery(search.query)
  }

  // Epic 57: Clear recent searches
  const handleClearRecentSearches = async () => {
    await fileAnalytics.clearRecentSearches(groupId)
    setRecentSearches([])
  }

  // Filter files by search query and filters
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Search query filter (name search)
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        // Also check if file is in content search results
        if (contentSearchResults && !contentSearchResults.has(file.id)) {
          return false
        } else if (!contentSearchResults) {
          return false
        }
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
            <h1 className="text-2xl font-bold">{t('files.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {quota && t('files:storageUsed', {
                used: (quota.usedBytes / 1024 / 1024).toFixed(1),
                total: (quota.totalBytes / 1024 / 1024).toFixed(0),
                percent: quotaPercentage
              })}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Epic 57: Analytics button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnalytics(true)}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {t('files.analytics')}
            </Button>
            {/* Epic 57: Selection mode toggle */}
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  {t('common.cancel')}
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t('files.select')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {t('files.newFolder')}
            </Button>
            <Button size="sm" onClick={() => setShowUploadZone(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('files.uploadFiles')}
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
                    ? t('files.selectFiles')
                    : t('files.filesSelected', { count: selectedFiles.size })}
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
                  {selectedFiles.size > 1 ? t('files.downloadZip') : t('files.download')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMoveDialog(true)}
                  disabled={bulkOperationInProgress}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  {t('files.move')}
                </Button>
                {/* Epic 57: Bulk share */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkShare(true)}
                  disabled={bulkOperationInProgress}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('files.share')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkOperationInProgress}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
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
              placeholder={t('files.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setContentSearchResults(null) // Reset content search when query changes
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleContentSearch()
              }}
              className="pl-9 pr-20"
            />
            {/* Epic 57: Content search button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
              onClick={handleContentSearch}
              disabled={isContentSearching}
            >
              {isContentSearching ? t('files.searching') : t('files.searchContents')}
            </Button>
          </div>

          {/* Epic 57: Recent searches dropdown */}
          {recentSearches.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Clock className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{t('files.recentSearches')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleClearRecentSearches}
                  >
                    {t('files.clear')}
                  </Button>
                </div>
                <DropdownMenuSeparator />
                {recentSearches.slice(0, 5).map((search) => (
                  <DropdownMenuItem
                    key={search.id}
                    onClick={() => applyRecentSearch(search)}
                  >
                    <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                    {search.query}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Epic 57: Saved filters dropdown */}
          {savedFilters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Star className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{t('files.savedFilters')}</span>
                </div>
                <DropdownMenuSeparator />
                {savedFilters.map((filter) => (
                  <DropdownMenuItem
                    key={filter.id}
                    className="flex items-center justify-between"
                  >
                    <span
                      onClick={() => applySavedFilter(filter)}
                      className="flex-1 cursor-pointer"
                    >
                      {filter.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSavedFilter(filter.id)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Filter popover */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                {t('files.filters')}
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
                  <h4 className="font-medium">{t('files.filterFiles')}</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      {t('files.clear')}
                    </Button>
                  )}
                </div>

                {/* File Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('files.fileType')}</label>
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
                          {t('files.allTypes')}
                        </span>
                      </SelectItem>
                      <SelectItem value="image">
                        <span className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          {t('files.images')}
                        </span>
                      </SelectItem>
                      <SelectItem value="document">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {t('files.documents')}
                        </span>
                      </SelectItem>
                      <SelectItem value="video">
                        <span className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          {t('files.videos')}
                        </span>
                      </SelectItem>
                      <SelectItem value="audio">
                        <span className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          {t('files.audio')}
                        </span>
                      </SelectItem>
                      <SelectItem value="archive">
                        <span className="flex items-center gap-2">
                          <Archive className="h-4 w-4" />
                          {t('files.archives')}
                        </span>
                      </SelectItem>
                      <SelectItem value="other">
                        <span className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          {t('files.other')}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File Size Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('files.fileSize')}</label>
                  <Select
                    value={filters.size}
                    onValueChange={(value) => setFilters((f) => ({ ...f, size: value as SizeFilter }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('files.allSizes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('files.allSizes')}</SelectItem>
                      <SelectItem value="small">{t('files.sizeSmall')}</SelectItem>
                      <SelectItem value="medium">{t('files.sizeMedium')}</SelectItem>
                      <SelectItem value="large">{t('files.sizeLarge')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('files.modified')}</label>
                  <Select
                    value={filters.date}
                    onValueChange={(value) => setFilters((f) => ({ ...f, date: value as DateFilter }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('files.anyTime')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('files.anyTime')}</SelectItem>
                      <SelectItem value="today">{t('files.today')}</SelectItem>
                      <SelectItem value="week">{t('files.pastWeek')}</SelectItem>
                      <SelectItem value="month">{t('files.pastMonth')}</SelectItem>
                      <SelectItem value="year">{t('files.pastYear')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Epic 57: Save filter button */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setShowFilters(false)
                      setShowSaveFilterDialog(true)
                    }}
                  >
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    {t('files.saveFilter')}
                  </Button>
                )}
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
            <span className="text-sm text-muted-foreground">{t('files.activeFilters')}</span>
            {filters.type !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {t('files.type')}: {filters.type}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, type: 'all' }))}
                />
              </Badge>
            )}
            {filters.size !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {t('files.size')}: {filters.size}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, size: 'all' }))}
                />
              </Badge>
            )}
            {filters.date !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {t('files.modified')}: {filters.date}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilters((f) => ({ ...f, date: 'all' }))}
                />
              </Badge>
            )}
            {contentSearchResults && (
              <Badge variant="secondary" className="gap-1">
                {t('files.contentMatches')}: {contentSearchResults.size}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setContentSearchResults(null)}
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
            <AlertDialogTitle>{t('files.deleteFilesTitle', { count: selectedFiles.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.deleteFilesDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkOperationInProgress}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkOperationInProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkOperationInProgress ? t('files.deleting') : t('common.delete')}
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

      {/* Epic 57: Analytics dashboard */}
      {showAnalytics && (
        <FileAnalyticsDashboard
          groupId={groupId}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* Epic 57: Bulk share dialog */}
      {showBulkShare && (
        <BulkShareDialog
          fileIds={Array.from(selectedFiles)}
          groupId={groupId}
          onClose={() => setShowBulkShare(false)}
          onComplete={() => {
            setSelectedFiles(new Set())
            setSelectionMode(false)
          }}
        />
      )}

      {/* Epic 57: Save filter dialog */}
      <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('files.saveSearchFilter')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filter-name">{t('files.filterName')}</Label>
            <Input
              id="filter-name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder={t('files.filterNamePlaceholder')}
              className="mt-2"
            />
            <div className="mt-4 text-sm text-muted-foreground">
              <p>{t('files.filterWillSave')}</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {searchQuery && <li>{t('files.search')}: "{searchQuery}"</li>}
                {filters.type !== 'all' && <li>{t('files.type')}: {filters.type}</li>}
                {filters.size !== 'all' && <li>{t('files.size')}: {filters.size}</li>}
                {filters.date !== 'all' && <li>{t('files.modified')}: {filters.date}</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              {t('files.saveFilter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
