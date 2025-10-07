/**
 * Documents Store
 * State management for document editing and version control
 */

import { create } from 'zustand'
import type { Document, DocumentVersion, DocumentTemplate, CreateDocumentInput, UpdateDocumentInput } from './types'

interface DocumentsState {
  documents: Map<string, Document>
  versions: Map<string, DocumentVersion[]>
  templates: Map<string, DocumentTemplate>
  currentDocumentId: string | null
  isLoading: boolean
  error: string | null
}

interface DocumentsActions {
  // Document CRUD
  addDocument: (document: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  deleteDocument: (id: string) => void
  getDocument: (id: string) => Document | undefined
  getGroupDocuments: (groupId: string) => Document[]
  setCurrentDocument: (id: string | null) => void

  // Version control
  addVersion: (version: DocumentVersion) => void
  getVersions: (documentId: string) => DocumentVersion[]
  restoreVersion: (documentId: string, versionId: string) => void

  // Templates
  addTemplate: (template: DocumentTemplate) => void
  getTemplate: (id: string) => DocumentTemplate | undefined
  getAllTemplates: () => DocumentTemplate[]

  // State management
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useDocumentsStore = create<DocumentsState & DocumentsActions>((set, get) => ({
  // State
  documents: new Map(),
  versions: new Map(),
  templates: new Map(),
  currentDocumentId: null,
  isLoading: false,
  error: null,

  // Document CRUD
  addDocument: (document) =>
    set((state) => {
      const documents = new Map(state.documents)
      documents.set(document.id, document)
      return { documents }
    }),

  updateDocument: (id, updates) =>
    set((state) => {
      const documents = new Map(state.documents)
      const document = documents.get(id)
      if (document) {
        documents.set(id, { ...document, ...updates, updatedAt: Date.now() })
      }
      return { documents }
    }),

  deleteDocument: (id) =>
    set((state) => {
      const documents = new Map(state.documents)
      const versions = new Map(state.versions)
      documents.delete(id)
      versions.delete(id)
      return {
        documents,
        versions,
        currentDocumentId: state.currentDocumentId === id ? null : state.currentDocumentId
      }
    }),

  getDocument: (id) => {
    return get().documents.get(id)
  },

  getGroupDocuments: (groupId) => {
    return Array.from(get().documents.values())
      .filter((doc) => doc.groupId === groupId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  setCurrentDocument: (id) => set({ currentDocumentId: id }),

  // Version control
  addVersion: (version) =>
    set((state) => {
      const versions = new Map(state.versions)
      const docVersions = versions.get(version.documentId) || []
      versions.set(version.documentId, [...docVersions, version])
      return { versions }
    }),

  getVersions: (documentId) => {
    return get().versions.get(documentId) || []
  },

  restoreVersion: (documentId, versionId) => {
    const versions = get().getVersions(documentId)
    const version = versions.find((v) => v.id === versionId)
    if (version) {
      get().updateDocument(documentId, {
        content: version.content,
        version: version.version,
        parentVersionId: versionId,
      })
    }
  },

  // Templates
  addTemplate: (template) =>
    set((state) => {
      const templates = new Map(state.templates)
      templates.set(template.id, template)
      return { templates }
    }),

  getTemplate: (id) => {
    return get().templates.get(id)
  },

  getAllTemplates: () => {
    return Array.from(get().templates.values())
  },

  // State management
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
