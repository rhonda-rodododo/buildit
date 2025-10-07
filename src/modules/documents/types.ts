/**
 * Documents Module Types
 * WYSIWYG document editing with version control
 */

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
}

export interface UpdateDocumentInput {
  title?: string
  content?: string
  tags?: string[]
  isPublic?: boolean
  collaborators?: string[]
}
