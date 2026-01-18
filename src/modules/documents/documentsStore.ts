/**
 * Documents Store
 * State management for document editing and version control
 */

import { create } from 'zustand'
import type {
  Document,
  DocumentVersion,
  DocumentTemplate,
  DocumentComment,
  DocumentSuggestion,
  DocumentFolder,
  DocumentShareLink,
  DocumentCollaborator,
  DocumentPermission,
} from './types'

interface DocumentsState {
  documents: Map<string, Document>
  versions: Map<string, DocumentVersion[]>
  templates: Map<string, DocumentTemplate>
  currentDocumentId: string | null
  isLoading: boolean
  error: string | null
  // Epic 56: Advanced features
  comments: Map<string, DocumentComment[]> // documentId -> comments
  suggestions: Map<string, DocumentSuggestion[]> // documentId -> suggestions
  folders: Map<string, DocumentFolder> // folderId -> folder
  stars: Set<string> // Set of documentIds the current user has starred
  shareLinks: Map<string, DocumentShareLink[]> // documentId -> share links
  collaborators: Map<string, DocumentCollaborator[]> // documentId -> collaborators
  suggestionModeEnabled: boolean
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

  // Epic 56: Comments
  addComment: (comment: DocumentComment) => void
  updateComment: (commentId: string, updates: Partial<DocumentComment>) => void
  deleteComment: (documentId: string, commentId: string) => void
  resolveComment: (documentId: string, commentId: string, resolvedByPubkey: string) => void
  getDocumentComments: (documentId: string) => DocumentComment[]
  getUnresolvedComments: (documentId: string) => DocumentComment[]

  // Epic 56: Suggestions
  addSuggestion: (suggestion: DocumentSuggestion) => void
  acceptSuggestion: (documentId: string, suggestionId: string, reviewedByPubkey: string) => void
  rejectSuggestion: (documentId: string, suggestionId: string, reviewedByPubkey: string, note?: string) => void
  getDocumentSuggestions: (documentId: string) => DocumentSuggestion[]
  getPendingSuggestions: (documentId: string) => DocumentSuggestion[]
  setSuggestionMode: (enabled: boolean) => void

  // Epic 56: Folders
  addFolder: (folder: DocumentFolder) => void
  updateFolder: (folderId: string, updates: Partial<DocumentFolder>) => void
  deleteFolder: (folderId: string) => void
  getFolder: (folderId: string) => DocumentFolder | undefined
  getGroupFolders: (groupId: string) => DocumentFolder[]
  getFolderChildren: (folderId: string) => DocumentFolder[]
  getDocumentsInFolder: (folderId: string | null, groupId: string) => Document[]

  // Epic 56: Stars/Favorites
  toggleStar: (documentId: string) => void
  isStarred: (documentId: string) => boolean
  getStarredDocuments: () => Document[]

  // Epic 56: Sharing
  addShareLink: (link: DocumentShareLink) => void
  deleteShareLink: (documentId: string, linkId: string) => void
  getShareLinks: (documentId: string) => DocumentShareLink[]
  addCollaborator: (collaborator: DocumentCollaborator) => void
  removeCollaborator: (documentId: string, userPubkey: string) => void
  updateCollaboratorPermission: (documentId: string, userPubkey: string, permission: DocumentPermission) => void
  getCollaborators: (documentId: string) => DocumentCollaborator[]
  getUserPermission: (documentId: string, userPubkey: string) => DocumentPermission | null
}

export const useDocumentsStore = create<DocumentsState & DocumentsActions>((set, get) => ({
  // State
  documents: new Map(),
  versions: new Map(),
  templates: new Map(),
  currentDocumentId: null,
  isLoading: false,
  error: null,
  // Epic 56: Advanced features state
  comments: new Map(),
  suggestions: new Map(),
  folders: new Map(),
  stars: new Set(),
  shareLinks: new Map(),
  collaborators: new Map(),
  suggestionModeEnabled: false,

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

  // Epic 56: Comments
  addComment: (comment) =>
    set((state) => {
      const comments = new Map(state.comments)
      const docComments = comments.get(comment.documentId) || []
      comments.set(comment.documentId, [...docComments, comment])
      return { comments }
    }),

  updateComment: (commentId, updates) =>
    set((state) => {
      const comments = new Map(state.comments)
      for (const [docId, docComments] of comments.entries()) {
        const index = docComments.findIndex((c) => c.id === commentId)
        if (index !== -1) {
          const updated = [...docComments]
          updated[index] = { ...updated[index], ...updates, updatedAt: Date.now() }
          comments.set(docId, updated)
          break
        }
      }
      return { comments }
    }),

  deleteComment: (documentId, commentId) =>
    set((state) => {
      const comments = new Map(state.comments)
      const docComments = comments.get(documentId) || []
      comments.set(documentId, docComments.filter((c) => c.id !== commentId))
      return { comments }
    }),

  resolveComment: (documentId, commentId, resolvedByPubkey) =>
    set((state) => {
      const comments = new Map(state.comments)
      const docComments = comments.get(documentId) || []
      const updated = docComments.map((c) =>
        c.id === commentId
          ? { ...c, resolved: true, resolvedAt: Date.now(), resolvedByPubkey }
          : c
      )
      comments.set(documentId, updated)
      return { comments }
    }),

  getDocumentComments: (documentId) => {
    return get().comments.get(documentId) || []
  },

  getUnresolvedComments: (documentId) => {
    return (get().comments.get(documentId) || []).filter((c) => !c.resolved)
  },

  // Epic 56: Suggestions
  addSuggestion: (suggestion) =>
    set((state) => {
      const suggestions = new Map(state.suggestions)
      const docSuggestions = suggestions.get(suggestion.documentId) || []
      suggestions.set(suggestion.documentId, [...docSuggestions, suggestion])
      return { suggestions }
    }),

  acceptSuggestion: (documentId, suggestionId, reviewedByPubkey) =>
    set((state) => {
      const suggestions = new Map(state.suggestions)
      const docSuggestions = suggestions.get(documentId) || []
      const updated = docSuggestions.map((s) =>
        s.id === suggestionId
          ? { ...s, status: 'accepted' as const, reviewedAt: Date.now(), reviewedByPubkey }
          : s
      )
      suggestions.set(documentId, updated)
      return { suggestions }
    }),

  rejectSuggestion: (documentId, suggestionId, reviewedByPubkey, note) =>
    set((state) => {
      const suggestions = new Map(state.suggestions)
      const docSuggestions = suggestions.get(documentId) || []
      const updated = docSuggestions.map((s) =>
        s.id === suggestionId
          ? { ...s, status: 'rejected' as const, reviewedAt: Date.now(), reviewedByPubkey, reviewNote: note }
          : s
      )
      suggestions.set(documentId, updated)
      return { suggestions }
    }),

  getDocumentSuggestions: (documentId) => {
    return get().suggestions.get(documentId) || []
  },

  getPendingSuggestions: (documentId) => {
    return (get().suggestions.get(documentId) || []).filter((s) => s.status === 'pending')
  },

  setSuggestionMode: (enabled) => set({ suggestionModeEnabled: enabled }),

  // Epic 56: Folders
  addFolder: (folder) =>
    set((state) => {
      const folders = new Map(state.folders)
      folders.set(folder.id, folder)
      return { folders }
    }),

  updateFolder: (folderId, updates) =>
    set((state) => {
      const folders = new Map(state.folders)
      const folder = folders.get(folderId)
      if (folder) {
        folders.set(folderId, { ...folder, ...updates, updatedAt: Date.now() })
      }
      return { folders }
    }),

  deleteFolder: (folderId) =>
    set((state) => {
      const folders = new Map(state.folders)
      folders.delete(folderId)
      return { folders }
    }),

  getFolder: (folderId) => {
    return get().folders.get(folderId)
  },

  getGroupFolders: (groupId) => {
    return Array.from(get().folders.values())
      .filter((f) => f.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  getFolderChildren: (folderId) => {
    return Array.from(get().folders.values())
      .filter((f) => f.parentFolderId === folderId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  getDocumentsInFolder: (folderId, groupId) => {
    return Array.from(get().documents.values())
      .filter((doc) => {
        const docWithFolder = doc as Document & { folderId?: string }
        return doc.groupId === groupId && docWithFolder.folderId === folderId
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Epic 56: Stars/Favorites
  toggleStar: (documentId) =>
    set((state) => {
      const stars = new Set(state.stars)
      if (stars.has(documentId)) {
        stars.delete(documentId)
      } else {
        stars.add(documentId)
      }
      return { stars }
    }),

  isStarred: (documentId) => {
    return get().stars.has(documentId)
  },

  getStarredDocuments: () => {
    const { documents, stars } = get()
    return Array.from(documents.values())
      .filter((doc) => stars.has(doc.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Epic 56: Sharing
  addShareLink: (link) =>
    set((state) => {
      const shareLinks = new Map(state.shareLinks)
      const docLinks = shareLinks.get(link.documentId) || []
      shareLinks.set(link.documentId, [...docLinks, link])
      return { shareLinks }
    }),

  deleteShareLink: (documentId, linkId) =>
    set((state) => {
      const shareLinks = new Map(state.shareLinks)
      const docLinks = shareLinks.get(documentId) || []
      shareLinks.set(documentId, docLinks.filter((l) => l.id !== linkId))
      return { shareLinks }
    }),

  getShareLinks: (documentId) => {
    return get().shareLinks.get(documentId) || []
  },

  addCollaborator: (collaborator) =>
    set((state) => {
      const collaborators = new Map(state.collaborators)
      const docCollabs = collaborators.get(collaborator.documentId) || []
      // Remove existing if present, then add updated
      const filtered = docCollabs.filter((c) => c.userPubkey !== collaborator.userPubkey)
      collaborators.set(collaborator.documentId, [...filtered, collaborator])
      return { collaborators }
    }),

  removeCollaborator: (documentId, userPubkey) =>
    set((state) => {
      const collaborators = new Map(state.collaborators)
      const docCollabs = collaborators.get(documentId) || []
      collaborators.set(documentId, docCollabs.filter((c) => c.userPubkey !== userPubkey))
      return { collaborators }
    }),

  updateCollaboratorPermission: (documentId, userPubkey, permission) =>
    set((state) => {
      const collaborators = new Map(state.collaborators)
      const docCollabs = collaborators.get(documentId) || []
      const updated = docCollabs.map((c) =>
        c.userPubkey === userPubkey ? { ...c, permission } : c
      )
      collaborators.set(documentId, updated)
      return { collaborators }
    }),

  getCollaborators: (documentId) => {
    return get().collaborators.get(documentId) || []
  },

  getUserPermission: (documentId, userPubkey) => {
    const collabs = get().collaborators.get(documentId) || []
    const collab = collabs.find((c) => c.userPubkey === userPubkey)
    return collab?.permission || null
  },
}))
