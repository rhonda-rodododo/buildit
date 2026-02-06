/**
 * Documents Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated schema defines simpler Document/DocumentRevision models (protocol-level).
 * The local types below represent the richer UI-side document features
 * (CRDT collaboration, comments, suggestions, permissions, etc.).
 */

// Re-export generated Zod schemas and types
export {
  AttachmentSchema as ProtocolAttachmentSchema,
  type Attachment as ProtocolAttachment,
  DocumentSchema as ProtocolDocumentSchema,
  type Document as ProtocolDocument,
  DocumentRevisionSchema,
  type DocumentRevision as ProtocolDocumentRevision,
  DOCUMENTS_SCHEMA_VERSION,
} from '@/generated/validation/documents.zod';

// ── UI-Only Types (richer client-side document model) ────────────

export interface Document {
  id: string
  groupId: string
  title: string
  content: string // Rich text content (HTML from TipTap)
  authorPubkey: string
  createdAt: number
  updatedAt: number
  tags: string[]
  template?: string // Template ID if created from template
  isPublic: boolean
  collaborators: string[] // Pubkeys of users who can edit
  version: number
  parentVersionId?: string // For version history
  folderId?: string // Folder this document belongs to
}

export interface DocumentVersion {
  id: string
  documentId: string
  version: number
  content: string
  authorPubkey: string
  createdAt: number
  changeDescription?: string
}

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  content: string // Initial content
  tags: string[]
  icon?: string
}

export type DocumentExportFormat = 'pdf' | 'markdown' | 'html' | 'text'

export interface DocumentExportOptions {
  format: DocumentExportFormat
  includeMetadata?: boolean
  includeVersionHistory?: boolean
}

export interface CreateDocumentInput {
  groupId: string
  title: string
  content?: string
  template?: string
  isPublic?: boolean
  tags?: string[]
  folderId?: string // Folder to create document in
}

export interface UpdateDocumentInput {
  title?: string
  content?: string
  tags?: string[]
  isPublic?: boolean
  collaborators?: string[]
}

/**
 * CRDT Collaboration Session
 * Tracks active collaboration sessions for documents
 */
export interface DocumentCollaborationSession {
  documentId: string
  groupId: string
  roomId: string // Nostr room ID for CRDT sync
  participants: string[] // Active participant pubkeys
  isActive: boolean
  createdAt: number
  lastActivity: number
}

/**
 * Participant Presence
 * Real-time cursor and user presence data
 */
export interface ParticipantPresence {
  pubkey: string
  name: string
  color: string // Cursor color
  cursor?: {
    anchor: number
    head: number
  }
  lastSeen: number
}

/**
 * Document Comment
 * Inline comments on text selections
 */
export interface DocumentComment {
  id: string
  documentId: string
  authorPubkey: string
  content: string
  createdAt: number
  updatedAt?: number
  // Position in document
  from: number // Start position
  to: number // End position
  quotedText: string // The text being commented on
  // Threading
  parentCommentId?: string // For replies
  // Status
  resolved: boolean
  resolvedAt?: number
  resolvedByPubkey?: string
  // Mentions
  mentions: string[] // Pubkeys of mentioned users
}

/**
 * Document Suggestion
 * Track changes / suggestion mode
 */
export interface DocumentSuggestion {
  id: string
  documentId: string
  authorPubkey: string
  createdAt: number
  // Change details
  type: 'insertion' | 'deletion' | 'replacement'
  from: number
  to: number
  originalText: string // Text being replaced/deleted
  suggestedText: string // New text (for insertion/replacement)
  // Status
  status: 'pending' | 'accepted' | 'rejected'
  reviewedAt?: number
  reviewedByPubkey?: string
  reviewNote?: string
}

/**
 * Document Folder
 * Organize documents in folders/collections
 */
export interface DocumentFolder {
  id: string
  groupId: string
  name: string
  description?: string
  parentFolderId?: string // For nested folders
  createdByPubkey: string
  createdAt: number
  updatedAt: number
  color?: string // Folder color for visual organization
  icon?: string // Optional icon
}

/**
 * Document Permission Level
 */
export type DocumentPermission = 'view' | 'comment' | 'edit' | 'admin'

/**
 * Document Share Link
 * Shareable links with granular permissions
 */
export interface DocumentShareLink {
  id: string
  documentId: string
  createdByPubkey: string
  permission: DocumentPermission
  createdAt: number
  expiresAt?: number // Optional expiration
  isPublic: boolean // Public link vs private (requires auth)
  password?: string // Optional password protection (hashed)
  accessCount: number
  lastAccessedAt?: number
  maxAccessCount?: number // Optional access limit
}

/**
 * Document Collaborator
 * Individual user permissions for a document
 */
export interface DocumentCollaborator {
  documentId: string
  userPubkey: string
  permission: DocumentPermission
  addedByPubkey: string
  addedAt: number
  lastAccessAt?: number
}

/**
 * Document Star/Favorite
 * User's starred documents
 */
export interface DocumentStar {
  documentId: string
  userPubkey: string
  createdAt: number
}

/**
 * Document with folder info
 */
export interface DocumentWithFolder extends Document {
  folderId?: string
  folderName?: string
  folderColor?: string
}

/**
 * Update Document input with new fields
 */
export interface UpdateDocumentInputV2 extends UpdateDocumentInput {
  folderId?: string | null // null to remove from folder
}

/**
 * Create folder input
 */
export interface CreateFolderInput {
  groupId: string
  name: string
  description?: string
  parentFolderId?: string
  color?: string
  icon?: string
}

/**
 * Create comment input
 */
export interface CreateCommentInput {
  documentId: string
  content: string
  from: number
  to: number
  quotedText: string
  parentCommentId?: string
  mentions?: string[]
}

/**
 * Create suggestion input
 */
export interface CreateSuggestionInput {
  documentId: string
  type: 'insertion' | 'deletion' | 'replacement'
  from: number
  to: number
  originalText: string
  suggestedText: string
}

/**
 * Create share link input
 */
export interface CreateShareLinkInput {
  documentId: string
  permission: DocumentPermission
  expiresAt?: number
  isPublic?: boolean
  password?: string
  maxAccessCount?: number
}

/**
 * Folder Permission (for permission inheritance)
 * Permissions set at folder level that cascade to all child items
 */
export interface FolderPermission {
  folderId: string
  groupId: string
  userPubkey: string
  permission: DocumentPermission
  inheritToChildren: boolean // Whether to cascade to child folders/documents
  addedByPubkey: string
  addedAt: number
}

/**
 * Access Request
 * Request access to a document or folder
 */
export interface AccessRequest {
  id: string
  resourceId: string // Document or folder ID
  resourceType: 'document' | 'folder'
  resourceTitle: string
  requesterPubkey: string
  requestedPermission: DocumentPermission
  message?: string // Optional message from requester
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
  reviewedAt?: number
  reviewedByPubkey?: string
  reviewNote?: string
}

/**
 * Sharing Report Item
 * Individual item in a sharing report export
 */
export interface SharingReportItem {
  resourceId: string
  resourceType: 'document' | 'folder'
  resourceTitle: string
  sharedWith: {
    pubkey: string
    permission: DocumentPermission
    sharedAt: number
    via: 'direct' | 'link' | 'folder-inheritance'
  }[]
  shareLinks: {
    id: string
    permission: DocumentPermission
    isPublic: boolean
    accessCount: number
    createdAt: number
    expiresAt?: number
  }[]
  inheritedFrom?: {
    folderId: string
    folderName: string
  }
}
