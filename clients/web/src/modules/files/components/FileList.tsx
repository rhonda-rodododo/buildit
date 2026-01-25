/**
 * File List
 * Display files and folders in grid or list view
 * Epic 57: Added multi-select support for bulk operations
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { hexToBytes } from '@noble/hashes/utils'
import { Folder, File, Image, Video, Music, FileText, Archive, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { FileMetadata, Folder as FolderType } from '../types'
import { useFilesStore } from '../filesStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { fileManager } from '../fileManager'
import { FilePreviewModal } from './FilePreviewModal'
import { FileShareDialog } from './FileShareDialog'
import { useGroupContext } from '@/contexts/GroupContext'

interface FileListProps {
  files: FileMetadata[]
  folders: FolderType[]
  viewMode: 'grid' | 'list'
  selectionMode?: boolean
  selectedFiles?: Set<string>
  onSelectionChange?: (selectedFiles: Set<string>) => void
}

const FILE_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  archive: Archive,
  other: File,
}

export function FileList({
  files,
  folders,
  viewMode,
  selectionMode = false,
  selectedFiles = new Set(),
  onSelectionChange,
}: FileListProps) {
  const { t } = useTranslation()
  const { groupId } = useGroupContext()
  const setCurrentFolder = useFilesStore((state) => state.setCurrentFolder)
  const groups = useGroupsStore((state) => state.groups)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [shareFileId, setShareFileId] = useState<string | null>(null)

  // Handle file selection toggle
  const toggleFileSelection = (fileId: string) => {
    if (!onSelectionChange) return
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    onSelectionChange(newSelection)
  }

  // Handle click on file (preview or select based on mode)
  const handleFileInteraction = (fileId: string, e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault()
      toggleFileSelection(fileId)
    } else {
      handleFileClick(fileId)
    }
  }

  // Get the encryption key for the current group
  const groupKey = useMemo(() => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return undefined

    if (group.encryptedGroupKey) {
      return hexToBytes(group.encryptedGroupKey)
    }

    // For public groups, generate a deterministic key from groupId
    const encoder = new TextEncoder()
    const groupIdBytes = encoder.encode(groupId)
    const key = new Uint8Array(32)
    key.set(groupIdBytes.slice(0, 32))
    return key
  }, [groups, groupId])

  const handleDeleteFile = async (fileId: string) => {
    if (confirm(t('fileList.confirmDeleteFile'))) {
      await fileManager.deleteFile(fileId)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm(t('fileList.confirmDeleteFolder'))) {
      await fileManager.deleteFolder(folderId)
    }
  }

  const handleFileClick = (fileId: string) => {
    setPreviewFileId(fileId)
  }

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const blob = await fileManager.getFileBlob(fileId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Folders */}
        {folders.map((folder) => (
          <Card
            key={folder.id}
            className="group cursor-pointer p-4 hover:bg-accent"
            onClick={() => setCurrentFolder(folder.id)}
          >
            <div className="flex items-start justify-between">
              <Folder className="h-12 w-12 text-blue-500" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)}>
                    {t('fileList.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-2 truncate font-medium">{folder.name}</p>
          </Card>
        ))}

        {/* Files */}
        {files.map((file) => {
          const Icon = FILE_ICONS[file.type]
          const isSelected = selectedFiles.has(file.id)
          return (
            <Card
              key={file.id}
              className={cn(
                'group cursor-pointer p-4 hover:bg-accent relative',
                isSelected && 'ring-2 ring-primary bg-primary/5'
              )}
              onClick={(e) => handleFileInteraction(file.id, e)}
            >
              {/* Selection checkbox (visible in selection mode or on hover) */}
              {(selectionMode || isSelected) && (
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFileSelection(file.id)
                  }}
                >
                  <Checkbox checked={isSelected} />
                </div>
              )}
              <div className="flex items-start justify-between">
                <Icon className="h-12 w-12 text-muted-foreground" />
                {!selectionMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(file.id, file.name)
                      }}>
                        {t('fileList.download')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        setShareFileId(file.id)
                      }}>
                        {t('fileList.share')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFile(file.id)
                      }}>
                        {t('fileList.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="mt-2 truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </Card>
          )
        })}
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-1">
      {/* Folders */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-accent"
          onClick={() => setCurrentFolder(folder.id)}
        >
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-blue-500" />
            <span className="font-medium">{folder.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Files */}
      {files.map((file) => {
        const Icon = FILE_ICONS[file.type]
        const isSelected = selectedFiles.has(file.id)
        return (
          <div
            key={file.id}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-accent',
              isSelected && 'bg-primary/5 ring-1 ring-primary'
            )}
            onClick={(e) => handleFileInteraction(file.id, e)}
          >
            <div className="flex items-center gap-3">
              {/* Selection checkbox (visible in selection mode or when selected) */}
              {(selectionMode || isSelected) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFileSelection(file.id)
                  }}
                >
                  <Checkbox checked={isSelected} />
                </div>
              )}
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!selectionMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(file.id, file.name)
                  }}>
                    {t('fileList.download')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    setShareFileId(file.id)
                  }}>
                    {t('fileList.share')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFile(file.id)
                  }}>
                    {t('fileList.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      })}

      {/* File Preview Modal */}
      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
          groupKey={groupKey}
          onClose={() => setPreviewFileId(null)}
          onShare={() => {
            setShareFileId(previewFileId)
            setPreviewFileId(null)
          }}
        />
      )}

      {/* File Share Dialog */}
      {shareFileId && (
        <FileShareDialog
          fileId={shareFileId}
          groupId={groupId}
          onClose={() => setShareFileId(null)}
        />
      )}
    </div>
  )
}
