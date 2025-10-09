/**
 * File List
 * Display files and folders in grid or list view
 */

import { useState } from 'react'
import { Folder, File, Image, Video, Music, FileText, Archive, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FileMetadata, Folder as FolderType } from '../types'
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'
import { FilePreviewModal } from './FilePreviewModal'
import { FileShareDialog } from './FileShareDialog'
import { useGroupContext } from '@/contexts/GroupContext'

interface FileListProps {
  files: FileMetadata[]
  folders: FolderType[]
  viewMode: 'grid' | 'list'
}

const FILE_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  archive: Archive,
  other: File,
}

export function FileList({ files, folders, viewMode }: FileListProps) {
  const { groupId } = useGroupContext()
  const setCurrentFolder = useFilesStore((state) => state.setCurrentFolder)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [shareFileId, setShareFileId] = useState<string | null>(null)

  const handleDeleteFile = async (fileId: string) => {
    if (confirm('Delete this file?')) {
      await fileManager.deleteFile(fileId)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('Delete this folder and all its contents?')) {
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
                    Delete
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
          return (
            <Card
              key={file.id}
              className="group cursor-pointer p-4 hover:bg-accent"
              onClick={() => handleFileClick(file.id)}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-12 w-12 text-muted-foreground" />
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
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      setShareFileId(file.id)
                    }}>
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFile(file.id)
                    }}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
        return (
          <div
            key={file.id}
            className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-accent"
            onClick={() => handleFileClick(file.id)}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
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
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  setShareFileId(file.id)
                }}>
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteFile(file.id)
                }}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}

      {/* File Preview Modal */}
      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
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
