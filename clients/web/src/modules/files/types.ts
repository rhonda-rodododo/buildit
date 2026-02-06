/**
 * Files Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated schema defines simpler File/Folder/FileShare models (protocol-level).
 * The local types below represent the richer UI-side file management features
 * (encrypted blobs, upload progress, previews, analytics, permissions, etc.).
 */

// Re-export generated Zod schemas and types
export {
  FileSchema as ProtocolFileSchema,
  type File as ProtocolFile,
  FolderSchema as ProtocolFolderSchema,
  type Folder as ProtocolFolder,
  FileShareSchema as ProtocolFileShareSchema,
  type FileShare as ProtocolFileShare,
  FILES_SCHEMA_VERSION,
} from '@/generated/validation/files.zod';

// ── UI-Only Types (richer client-side file model) ────────────────

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
  operation: 'move' | 'copy' | 'delete' | 'tag' | 'share'
  targetFolderId?: string
  tags?: string[]
}

// Preview types
export interface FilePreview {
  type: 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'code' | 'office' | 'archive' | '3d' | 'none'
  url?: string // Object URL for preview
  content?: string // Text content
  language?: string // For code syntax highlighting
  archiveContents?: ArchiveEntry[]
  modelData?: Uint8Array
}

export interface ArchiveEntry {
  name: string
  path: string
  size: number
  isDirectory: boolean
  modifiedAt?: Date
}

export interface SavedSearchFilter {
  id: string
  name: string
  groupId: string
  query?: string
  type?: FileType | 'all'
  size?: 'all' | 'small' | 'medium' | 'large'
  date?: 'all' | 'today' | 'week' | 'month' | 'year'
  createdAt: number
}

export interface RecentSearch {
  id: string
  groupId: string
  query: string
  timestamp: number
}

export interface FileAnalytics {
  groupId: string
  totalFiles: number
  totalSize: number
  storageByType: Record<FileType, { count: number; size: number }>
  mostAccessedFiles: { fileId: string; accessCount: number }[]
  sharedFilesCount: number
  recentActivity: FileActivityLog[]
  duplicates: DuplicateFileGroup[]
}

export interface FileActivityLog {
  id: string
  groupId: string
  fileId: string
  fileName: string
  action: 'upload' | 'download' | 'share' | 'delete' | 'move' | 'rename' | 'view'
  userPubkey: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface DuplicateFileGroup {
  hash: string
  files: {
    id: string
    name: string
    path: string
    size: number
    createdAt: number
  }[]
}

/**
 * Folder Permission (for permission inheritance)
 * Permissions set at folder level that cascade to all child items
 */
export interface FileFolderPermission {
  folderId: string
  groupId: string
  userPubkey: string
  permissions: FilePermission[]
  inheritToChildren: boolean // Whether to cascade to child folders/files
  addedByPubkey: string
  addedAt: number
}

/**
 * File Access Request
 * Request access to a file or folder
 */
export interface FileAccessRequest {
  id: string
  resourceId: string // File or folder ID
  resourceType: 'file' | 'folder'
  resourceName: string
  requesterPubkey: string
  requestedPermissions: FilePermission[]
  message?: string // Optional message from requester
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
  reviewedAt?: number
  reviewedByPubkey?: string
  reviewNote?: string
}

/**
 * File Sharing Report Item
 * Individual item in a sharing report export
 */
export interface FileSharingReportItem {
  resourceId: string
  resourceType: 'file' | 'folder'
  resourceName: string
  size?: number
  sharedWith: {
    pubkey: string
    permissions: FilePermission[]
    sharedAt: number
    via: 'direct' | 'link' | 'folder-inheritance'
  }[]
  shareLinks: {
    id: string
    permissions: FilePermission[]
    hasPassword: boolean
    accessCount: number
    createdAt: number
    expiresAt?: number | null
  }[]
  inheritedFrom?: {
    folderId: string
    folderName: string
  }
}
