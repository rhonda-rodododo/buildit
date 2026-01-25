/**
 * File Upload Zone
 * Drag & drop file upload with progress tracking
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { hexToBytes } from '@noble/hashes/utils'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'
import { toast } from 'sonner'

interface FileUploadZoneProps {
  groupId: string
  folderId: string | null
  onClose: () => void
}

export function FileUploadZone({ groupId, folderId, onClose }: FileUploadZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const uploadProgress = useFilesStore((state) => state.getAllUploadProgress())

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(files)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(files)
    }
  }, [])

  const handleUpload = async () => {
    const privateKey = getCurrentPrivateKey()
    if (!privateKey || selectedFiles.length === 0) return

    setIsUploading(true)

    try {
      // Get group encryption key for file encryption
      const group = useGroupsStore.getState().groups.find(g => g.id === groupId)
      if (!group) {
        toast.error(t('fileUploadZone.groupNotFound'))
        return
      }

      // Get the group key - only private groups have encryption keys
      let groupKey: Uint8Array
      if (group.encryptedGroupKey) {
        // Convert hex string back to bytes
        groupKey = hexToBytes(group.encryptedGroupKey)
      } else {
        // For public groups without a key, generate a deterministic key from groupId
        // This is less secure but maintains compatibility for public groups
        const encoder = new TextEncoder()
        const groupIdBytes = encoder.encode(groupId)
        groupKey = new Uint8Array(32)
        groupKey.set(groupIdBytes.slice(0, 32))
      }

      for (const file of selectedFiles) {
        await fileManager.createFile(
          {
            groupId,
            folderId,
            name: file.name,
            file,
            encrypt: true,
          },
          privateKey,
          groupKey
        )
      }

      setSelectedFiles([])
      onClose()
      toast.success(t('fileUploadZone.success', { count: selectedFiles.length }))
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error(t('fileUploadZone.error'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fileUploadZone.title')}</DialogTitle>
        </DialogHeader>

        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            {t('fileUploadZone.dragDrop')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('fileUploadZone.encrypted')}
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">{t('fileUploadZone.selectedFiles')}</p>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadProgress.map((progress) => (
              <div key={progress.fileId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{progress.fileName}</span>
                  <span className="text-muted-foreground">{progress.status}</span>
                </div>
                <Progress value={progress.progress} />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('fileUploadZone.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {selectedFiles.length > 0 ? t('fileUploadZone.uploadCount', { count: selectedFiles.length }) : t('fileUploadZone.upload')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
