/**
 * Files Module Types
 * Encrypted file storage and management
 */

export type FileType = 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other'

export interface FileMetadata {
  id: string
  groupId: string
  folderId: string | null // null = root folder
  name: string
  type: FileType
  mimeType: string
  size: number // bytes
  encryptedSize: number // encrypted blob size
  uploadedBy: string // pubkey
  createdAt: number
  updatedAt: number
  isEncrypted: boolean
  encryptionKeyId?: string // Reference to encryption key
  thumbnailId?: string // ID of thumbnail file (for images/videos)
  tags: string[]
  metadata: Record<string, unknown> // Extra metadata (dimensions, duration, etc.)
  version: number
  parentVersionId?: string
}

export interface Folder {
  id: string
  groupId: string
  parentId: string | null // null = root
  name: string
  createdBy: string // pubkey
  createdAt: number
  updatedAt: number
  color?: string // Optional folder color
  icon?: string // Optional icon name
}

export interface FileShare {
  id: string
  fileId: string
  groupId: string
  sharedBy: string // pubkey
  sharedWith: string[] // pubkeys (empty array = shared with all group members)
  permissions: FilePermission[]
  expiresAt: number | null // null = never expires
  password?: string // Optional password hash for link sharing
  shareLink?: string // Public share link ID
  createdAt: number
  accessCount: number
  lastAccessedAt: number | null
}

export type FilePermission = 'view' | 'download' | 'edit' | 'delete'

export interface FileVersion {
  id: string
  fileId: string
  version: number
  size: number
  uploadedBy: string
  createdAt: number
  changeDescription?: string
}

export interface EncryptedFileBlob {
  id: string
  fileId: string
  data: Blob // Encrypted file content
  iv: Uint8Array // Initialization vector for AES-GCM
  createdAt: number
}

export interface StorageQuota {
  groupId: string
  totalBytes: number
  usedBytes: number
  fileCount: number
  quotaLimit: number // bytes (0 = unlimited)
  updatedAt: number
}

export interface FileUploadProgress {
  fileId: string
  fileName: string
  progress: number // 0-100
  status: 'pending' | 'uploading' | 'encrypting' | 'complete' | 'error'
  error?: string
}

// Input types
export interface CreateFileInput {
  groupId: string
  folderId?: string | null
  name: string
  file: File
  tags?: string[]
  encrypt?: boolean
}

export interface CreateFolderInput {
  groupId: string
  parentId?: string | null
  name: string
  color?: string
  icon?: string
}

export interface UpdateFileInput {
  name?: string
  folderId?: string | null
  tags?: string[]
  size?: number
  encryptedSize?: number
}

export interface UpdateFolderInput {
  name?: string
  parentId?: string | null
  color?: string
  icon?: string
}

export interface CreateShareInput {
  fileId: string
  groupId: string
  sharedWith?: string[] // Empty = all group members
  permissions: FilePermission[]
  expiresAt?: number | null
  password?: string
  generateLink?: boolean
}

export interface BulkFileOperation {
  fileIds: string[]
  operation: 'move' | 'copy' | 'delete' | 'tag'
  targetFolderId?: string
  tags?: string[]
}

// Preview types
export interface FilePreview {
  type: 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'code' | 'none'
  url?: string // Object URL for preview
  content?: string // Text content
  language?: string // For code syntax highlighting
}
