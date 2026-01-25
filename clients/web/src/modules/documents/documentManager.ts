/**
 * Document Manager
 * Business logic for document CRUD, versioning, and export
 */

import { getPublicKey, finalizeEvent, type Event as NostrEvent } from 'nostr-tools'
import jsPDF from 'jspdf'
import type { Document, DocumentVersion, CreateDocumentInput, UpdateDocumentInput, DocumentExportFormat, DocumentCollaborationSession } from './types'
import { useDocumentsStore } from './documentsStore'
import { db } from '@/core/storage/db'
import { createDocumentRoom } from './providers/EncryptedNostrProvider'
import type { NostrClient } from '@/core/nostr/client'

// Custom Nostr kind for documents
export const DOCUMENT_KIND = 30023 // Long-form content (NIP-23)
export const DOCUMENT_VERSION_KIND = 30024 // Custom: Document version

class DocumentManager {
  /**
   * Create a new document
   */
  async createDocument(
    input: CreateDocumentInput,
    authorPrivkey: Uint8Array
  ): Promise<Document> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const authorPubkey = getPublicKey(authorPrivkey)

    // Get template content if specified
    let initialContent = input.content || ''
    if (input.template) {
      const template = useDocumentsStore.getState().getTemplate(input.template)
      if (template) {
        initialContent = template.content
      }
    }

    const document: Document = {
      id,
      groupId: input.groupId,
      title: input.title,
      content: initialContent,
      authorPubkey,
      createdAt: now,
      updatedAt: now,
      tags: input.tags || [],
      template: input.template,
      isPublic: input.isPublic || false,
      collaborators: [authorPubkey],
      version: 1,
    }

    // Create Nostr event
    const event: NostrEvent = finalizeEvent({
      kind: DOCUMENT_KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', id], // Replaceable event identifier
        ['title', input.title],
        ['published_at', String(Math.floor(now / 1000))],
        ['summary', input.title],
        ...(input.tags || []).map(tag => ['t', tag]),
      ],
      content: initialContent,
    }, authorPrivkey)

    // Store in local DB
    await db.table('documents').add({
      id: document.id,
      groupId: document.groupId,
      data: document,
      nostrEvent: event,
    })

    // Update store
    useDocumentsStore.getState().addDocument(document)

    // Create initial version
    await this.createVersion(document, authorPrivkey, 'Initial version')

    return document
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    documentId: string,
    updates: UpdateDocumentInput,
    authorPrivkey: Uint8Array,
    changeDescription?: string
  ): Promise<Document> {
    const document = useDocumentsStore.getState().getDocument(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    const authorPubkey = getPublicKey(authorPrivkey)

    // Check if user has permission to edit
    if (!document.collaborators.includes(authorPubkey) && document.authorPubkey !== authorPubkey) {
      throw new Error('Not authorized to edit this document')
    }

    const now = Date.now()
    const newVersion = document.version + 1

    const updatedDocument: Document = {
      ...document,
      ...updates,
      updatedAt: now,
      version: newVersion,
    }

    // Update in store
    useDocumentsStore.getState().updateDocument(documentId, updatedDocument)

    // Update in DB
    await db.table('documents').update(documentId, {
      data: updatedDocument,
    })

    // Create version snapshot if content changed
    if (updates.content && updates.content !== document.content) {
      await this.createVersion(updatedDocument, authorPrivkey, changeDescription)
    }

    return updatedDocument
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Remove from DB
    await db.table('documents').delete(documentId)
    await db.table('documentVersions').where('documentId').equals(documentId).delete()

    // Remove from store
    useDocumentsStore.getState().deleteDocument(documentId)
  }

  /**
   * Create a version snapshot
   */
  private async createVersion(
    document: Document,
    authorPrivkey: Uint8Array,
    changeDescription?: string
  ): Promise<DocumentVersion> {
    const versionId = crypto.randomUUID()
    const now = Date.now()
    const authorPubkey = getPublicKey(authorPrivkey)

    const version: DocumentVersion = {
      id: versionId,
      documentId: document.id,
      version: document.version,
      content: document.content,
      authorPubkey,
      createdAt: now,
      changeDescription,
    }

    // Store in DB
    await db.table('documentVersions').add({
      id: versionId,
      documentId: document.id,
      data: version,
    })

    // Update store
    useDocumentsStore.getState().addVersion(version)

    return version
  }

  /**
   * Export document to different formats
   */
  async exportDocument(documentId: string, format: DocumentExportFormat): Promise<string> {
    const document = useDocumentsStore.getState().getDocument(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    switch (format) {
      case 'html':
        return this.exportToHTML(document)
      case 'markdown':
        return this.exportToMarkdown(document)
      case 'text':
        return this.exportToText(document)
      case 'pdf':
        // PDF export requires browser print API
        return this.exportToPDF(document)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private exportToHTML(document: Document): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${document.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1e293b; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${document.title}</h1>
  <div class="meta">
    Created: ${new Date(document.createdAt).toLocaleDateString()}
    | Updated: ${new Date(document.updatedAt).toLocaleDateString()}
    | Version: ${document.version}
  </div>
  ${document.content}
</body>
</html>
    `.trim()
  }

  private exportToMarkdown(document: Document): string {
    // Convert HTML to Markdown (basic conversion)
    let markdown = document.content

    // Headers
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1\n')

    // Lists
    markdown = markdown.replace(/<ul>/g, '').replace(/<\/ul>/g, '\n')
    markdown = markdown.replace(/<ol>/g, '').replace(/<\/ol>/g, '\n')
    markdown = markdown.replace(/<li>(.*?)<\/li>/g, '- $1\n')

    // Formatting
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*')
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`')

    // Paragraphs
    markdown = markdown.replace(/<p>(.*?)<\/p>/g, '$1\n\n')

    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '')

    return `# ${document.title}\n\n${markdown.trim()}`
  }

  private exportToText(document: Document): string {
    // Strip all HTML tags
    const text = document.content.replace(/<[^>]*>/g, '')
    return `${document.title}\n\n${text}`
  }

  private exportToPDF(document: Document): string {
    // Create PDF using jsPDF
    const pdf = new jsPDF()

    // Add title
    pdf.setFontSize(20)
    pdf.text(document.title, 20, 20)

    // Add metadata
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text(`Created: ${new Date(document.createdAt).toLocaleDateString()}`, 20, 30)
    pdf.text(`Updated: ${new Date(document.updatedAt).toLocaleDateString()}`, 20, 35)
    pdf.text(`Version: ${document.version}`, 20, 40)

    // Add content (strip HTML and add as text)
    pdf.setFontSize(12)
    pdf.setTextColor(0)
    const content = document.content.replace(/<[^>]*>/g, '').replace(/\n\n+/g, '\n')
    const splitContent = pdf.splitTextToSize(content, 170)
    pdf.text(splitContent, 20, 50)

    // Download PDF
    pdf.save(`${document.title}.pdf`)

    return 'PDF generated and downloaded'
  }

  /**
   * Get document with version history
   */
  async getDocumentWithVersions(documentId: string) {
    const document = useDocumentsStore.getState().getDocument(documentId)
    const versions = useDocumentsStore.getState().getVersions(documentId)

    return {
      document,
      versions: versions.sort((a, b) => b.version - a.version),
    }
  }

  /**
   * Start a collaboration session for a document
   */
  async startCollaboration(
    documentId: string,
    groupId: string,
    nostrClient: NostrClient,
    userPrivateKey: Uint8Array,
    collaboratorPubkeys: string[]
  ): Promise<DocumentCollaborationSession> {
    const document = useDocumentsStore.getState().getDocument(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    const now = Date.now()
    const userPubkey = getPublicKey(userPrivateKey)

    // Create collaboration session
    const session: DocumentCollaborationSession = {
      documentId,
      groupId,
      roomId: documentId, // Use document ID as room ID
      participants: [userPubkey],
      isActive: true,
      createdAt: now,
      lastActivity: now,
    }

    // Store in DB
    await db.table('documentCollaboration').add(session)

    // Create document room on Nostr
    await createDocumentRoom(
      nostrClient,
      userPrivateKey,
      collaboratorPubkeys,
      documentId,
      document.title
    )

    return session
  }

  /**
   * End a collaboration session
   */
  async endCollaboration(documentId: string): Promise<void> {
    await db.table('documentCollaboration')
      .where('documentId')
      .equals(documentId)
      .modify({ isActive: false })
  }

  /**
   * Get active collaboration session for a document
   */
  async getCollaborationSession(documentId: string): Promise<DocumentCollaborationSession | null> {
    const session = await db.table('documentCollaboration')
      .where({ documentId, isActive: true })
      .first()

    return session?.data || null
  }
}

export const documentManager = new DocumentManager()
