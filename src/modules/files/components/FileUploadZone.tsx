/**
 * File Upload Zone
 * Drag & drop file upload with progress tracking
 */

import { useState, useCallback } from 'react'
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
import { useFilesStore } from '../filesStore'
import { fileManager } from '../fileManager'

interface FileUploadZoneProps {
  groupId: string
  folderId: string | null
  onClose: () => void
}

export function FileUploadZone({ groupId, folderId, onClose }: FileUploadZoneProps) {
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
      // TODO: Get group key for encryption
      const groupKey = new Uint8Array(32) // Placeholder

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
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
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
            Drag & drop files here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Files will be encrypted before upload
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
            <p className="text-sm font-medium">Selected files:</p>
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
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
