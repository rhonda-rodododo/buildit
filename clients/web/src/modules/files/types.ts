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
  // Epic 57: Archive preview
  archiveContents?: ArchiveEntry[]
  // Epic 57: 3D model preview
  modelData?: Uint8Array
}

// Epic 57: Archive entry for preview
export interface ArchiveEntry {
  name: string
  path: string
  size: number
  isDirectory: boolean
  modifiedAt?: Date
}

// Epic 57: Saved search filter
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

// Epic 57: Recent search
export interface RecentSearch {
  id: string
  groupId: string
  query: string
  timestamp: number
}

// Epic 57: File analytics
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

// Epic 57: File activity log entry
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

// Epic 57: Duplicate file group
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
 * Epic 58: Folder Permission (for permission inheritance)
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
 * Epic 58: File Access Request
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
 * Epic 58: File Sharing Report Item
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
