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
  FolderPermission,
  AccessRequest,
  SharingReportItem,
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
  // Epic 58: Permission inheritance & access requests
  folderPermissions: Map<string, FolderPermission[]> // folderId -> permissions
  accessRequests: Map<string, AccessRequest[]> // resourceId -> requests
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
  toggleSuggestionMode: () => void

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

  // Epic 56: Tags
  addDocumentTag: (documentId: string, tag: string) => void
  removeDocumentTag: (documentId: string, tag: string) => void
  getAllTags: (groupId: string) => string[]
  getDocumentsByTag: (groupId: string, tag: string) => Document[]

  // Epic 56: Recent documents
  getRecentDocuments: (groupId: string, limit?: number) => Document[]

  // Epic 58: Folder Permission Inheritance
  setFolderPermission: (permission: FolderPermission) => void
  removeFolderPermission: (folderId: string, userPubkey: string) => void
  getFolderPermissions: (folderId: string) => FolderPermission[]
  getInheritedPermission: (documentId: string, userPubkey: string) => DocumentPermission | null
  getEffectivePermission: (documentId: string, userPubkey: string) => DocumentPermission | null

  // Epic 58: Access Requests
  createAccessRequest: (request: AccessRequest) => void
  updateAccessRequest: (requestId: string, updates: Partial<AccessRequest>) => void
  getAccessRequests: (resourceId: string) => AccessRequest[]
  getPendingAccessRequests: (groupId: string) => AccessRequest[]
  approveAccessRequest: (requestId: string, reviewerPubkey: string, note?: string) => void
  denyAccessRequest: (requestId: string, reviewerPubkey: string, note?: string) => void

  // Epic 58: Sharing Report Export
  generateSharingReport: (groupId: string) => SharingReportItem[]
  exportSharingReportCSV: (groupId: string) => string
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
  // Epic 58: Permission inheritance & access requests
  folderPermissions: new Map(),
  accessRequests: new Map(),

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
  toggleSuggestionMode: () => set((state) => ({ suggestionModeEnabled: !state.suggestionModeEnabled })),

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

  // Epic 56: Tags
  addDocumentTag: (documentId, tag) =>
    set((state) => {
      const documents = new Map(state.documents)
      const document = documents.get(documentId)
      if (document) {
        const normalizedTag = tag.trim().toLowerCase()
        if (normalizedTag && !document.tags.includes(normalizedTag)) {
          documents.set(documentId, {
            ...document,
            tags: [...document.tags, normalizedTag],
            updatedAt: Date.now(),
          })
        }
      }
      return { documents }
    }),

  removeDocumentTag: (documentId, tag) =>
    set((state) => {
      const documents = new Map(state.documents)
      const document = documents.get(documentId)
      if (document) {
        const normalizedTag = tag.trim().toLowerCase()
        documents.set(documentId, {
          ...document,
          tags: document.tags.filter((t) => t !== normalizedTag),
          updatedAt: Date.now(),
        })
      }
      return { documents }
    }),

  getAllTags: (groupId) => {
    const docs = Array.from(get().documents.values()).filter((d) => d.groupId === groupId)
    const allTags = docs.flatMap((d) => d.tags)
    // Return unique tags sorted alphabetically
    return [...new Set(allTags)].sort()
  },

  getDocumentsByTag: (groupId, tag) => {
    const normalizedTag = tag.trim().toLowerCase()
    return Array.from(get().documents.values())
      .filter((doc) => doc.groupId === groupId && doc.tags.includes(normalizedTag))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Epic 56: Recent documents
  getRecentDocuments: (groupId, limit = 10) => {
    return Array.from(get().documents.values())
      .filter((doc) => doc.groupId === groupId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
  },

  // Epic 58: Folder Permission Inheritance
  setFolderPermission: (permission) =>
    set((state) => {
      const folderPermissions = new Map(state.folderPermissions)
      const existing = folderPermissions.get(permission.folderId) || []
      // Remove existing permission for this user, then add new one
      const filtered = existing.filter((p) => p.userPubkey !== permission.userPubkey)
      folderPermissions.set(permission.folderId, [...filtered, permission])
      return { folderPermissions }
    }),

  removeFolderPermission: (folderId, userPubkey) =>
    set((state) => {
      const folderPermissions = new Map(state.folderPermissions)
      const existing = folderPermissions.get(folderId) || []
      folderPermissions.set(folderId, existing.filter((p) => p.userPubkey !== userPubkey))
      return { folderPermissions }
    }),

  getFolderPermissions: (folderId) => {
    return get().folderPermissions.get(folderId) || []
  },

  getInheritedPermission: (documentId, userPubkey) => {
    const { documents, folders, folderPermissions } = get()
    const document = documents.get(documentId)
    if (!document || !document.folderId) return null

    // Walk up the folder tree looking for inherited permissions
    let currentFolderId: string | undefined = document.folderId
    while (currentFolderId) {
      const permissions = folderPermissions.get(currentFolderId) || []
      const userPermission = permissions.find(
        (p) => p.userPubkey === userPubkey && p.inheritToChildren
      )
      if (userPermission) {
        return userPermission.permission
      }
      // Move to parent folder
      const folder = folders.get(currentFolderId)
      currentFolderId = folder?.parentFolderId
    }
    return null
  },

  getEffectivePermission: (documentId, userPubkey) => {
    const { getUserPermission, getInheritedPermission, documents } = get()
    const document = documents.get(documentId)
    if (!document) return null

    // Check if user is the author (implicit admin)
    if (document.authorPubkey === userPubkey) return 'admin'

    // Check direct collaborator permission first
    const directPermission = getUserPermission(documentId, userPubkey)
    if (directPermission) return directPermission

    // Check inherited permission from folder
    const inheritedPermission = getInheritedPermission(documentId, userPubkey)
    if (inheritedPermission) return inheritedPermission

    // Check if document is public (view only)
    if (document.isPublic) return 'view'

    return null
  },

  // Epic 58: Access Requests
  createAccessRequest: (request) =>
    set((state) => {
      const accessRequests = new Map(state.accessRequests)
      const existing = accessRequests.get(request.resourceId) || []
      accessRequests.set(request.resourceId, [...existing, request])
      return { accessRequests }
    }),

  updateAccessRequest: (requestId, updates) =>
    set((state) => {
      const accessRequests = new Map(state.accessRequests)
      for (const [resourceId, requests] of accessRequests.entries()) {
        const index = requests.findIndex((r) => r.id === requestId)
        if (index !== -1) {
          const updated = [...requests]
          updated[index] = { ...updated[index], ...updates }
          accessRequests.set(resourceId, updated)
          break
        }
      }
      return { accessRequests }
    }),

  getAccessRequests: (resourceId) => {
    return get().accessRequests.get(resourceId) || []
  },

  getPendingAccessRequests: (groupId) => {
    const { accessRequests, documents, folders } = get()
    const pending: AccessRequest[] = []

    for (const [, requests] of accessRequests.entries()) {
      for (const request of requests) {
        if (request.status !== 'pending') continue

        // Check if this resource belongs to the group
        if (request.resourceType === 'document') {
          const doc = documents.get(request.resourceId)
          if (doc?.groupId === groupId) {
            pending.push(request)
          }
        } else if (request.resourceType === 'folder') {
          const folder = folders.get(request.resourceId)
          if (folder?.groupId === groupId) {
            pending.push(request)
          }
        }
      }
    }

    return pending.sort((a, b) => b.createdAt - a.createdAt)
  },

  approveAccessRequest: (requestId, reviewerPubkey, note) => {
    const { accessRequests, addCollaborator, setFolderPermission, folders } = get()

    // Find the request
    let request: AccessRequest | undefined
    for (const [, requests] of accessRequests.entries()) {
      request = requests.find((r) => r.id === requestId)
      if (request) break
    }

    if (!request || request.status !== 'pending') return

    // Update request status
    get().updateAccessRequest(requestId, {
      status: 'approved',
      reviewedAt: Date.now(),
      reviewedByPubkey: reviewerPubkey,
      reviewNote: note,
    })

    // Grant the permission based on resource type
    if (request.resourceType === 'document') {
      addCollaborator({
        documentId: request.resourceId,
        userPubkey: request.requesterPubkey,
        permission: request.requestedPermission,
        addedByPubkey: reviewerPubkey,
        addedAt: Date.now(),
      })
    } else if (request.resourceType === 'folder') {
      const folder = folders.get(request.resourceId)
      if (folder) {
        setFolderPermission({
          folderId: request.resourceId,
          groupId: folder.groupId,
          userPubkey: request.requesterPubkey,
          permission: request.requestedPermission,
          inheritToChildren: true,
          addedByPubkey: reviewerPubkey,
          addedAt: Date.now(),
        })
      }
    }
  },

  denyAccessRequest: (requestId, reviewerPubkey, note) => {
    get().updateAccessRequest(requestId, {
      status: 'denied',
      reviewedAt: Date.now(),
      reviewedByPubkey: reviewerPubkey,
      reviewNote: note,
    })
  },

  // Epic 58: Sharing Report Export
  generateSharingReport: (groupId) => {
    const {
      documents,
      folders,
      collaborators,
      shareLinks,
      folderPermissions,
    } = get()

    const report: SharingReportItem[] = []

    // Process documents
    for (const document of documents.values()) {
      if (document.groupId !== groupId) continue

      const docCollabs = collaborators.get(document.id) || []
      const docLinks = shareLinks.get(document.id) || []

      // Get inherited permissions from folder
      let inheritedFrom: SharingReportItem['inheritedFrom'] | undefined
      if (document.folderId) {
        const folder = folders.get(document.folderId)
        const folderPerms = folderPermissions.get(document.folderId) || []
        if (folder && folderPerms.some((p) => p.inheritToChildren)) {
          inheritedFrom = {
            folderId: folder.id,
            folderName: folder.name,
          }
        }
      }

      const sharedWith: SharingReportItem['sharedWith'] = []

      // Add direct collaborators
      for (const collab of docCollabs) {
        sharedWith.push({
          pubkey: collab.userPubkey,
          permission: collab.permission,
          sharedAt: collab.addedAt,
          via: 'direct',
        })
      }

      // Add folder-inherited permissions
      if (document.folderId) {
        const folderPerms = folderPermissions.get(document.folderId) || []
        for (const perm of folderPerms) {
          if (perm.inheritToChildren) {
            // Don't duplicate if already added as direct
            if (!sharedWith.some((s) => s.pubkey === perm.userPubkey)) {
              sharedWith.push({
                pubkey: perm.userPubkey,
                permission: perm.permission,
                sharedAt: perm.addedAt,
                via: 'folder-inheritance',
              })
            }
          }
        }
      }

      // Only include if there's sharing activity
      if (sharedWith.length > 0 || docLinks.length > 0 || document.isPublic) {
        report.push({
          resourceId: document.id,
          resourceType: 'document',
          resourceTitle: document.title,
          sharedWith,
          shareLinks: docLinks.map((link) => ({
            id: link.id,
            permission: link.permission,
            isPublic: link.isPublic,
            accessCount: link.accessCount,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
          })),
          inheritedFrom,
        })
      }
    }

    // Process folders with explicit permissions
    for (const folder of folders.values()) {
      if (folder.groupId !== groupId) continue

      const folderPerms = folderPermissions.get(folder.id) || []
      if (folderPerms.length === 0) continue

      const sharedWith: SharingReportItem['sharedWith'] = folderPerms.map((perm) => ({
        pubkey: perm.userPubkey,
        permission: perm.permission,
        sharedAt: perm.addedAt,
        via: 'direct',
      }))

      report.push({
        resourceId: folder.id,
        resourceType: 'folder',
        resourceTitle: folder.name,
        sharedWith,
        shareLinks: [],
      })
    }

    return report.sort((a, b) => a.resourceTitle.localeCompare(b.resourceTitle))
  },

  exportSharingReportCSV: (groupId) => {
    const report = get().generateSharingReport(groupId)
    const rows: string[] = []

    // Header
    rows.push('Resource Type,Resource Title,Shared With (Pubkey),Permission,Shared Via,Shared At,Public Link,Link Accesses,Link Expires')

    for (const item of report) {
      // Add rows for each shared user
      for (const share of item.sharedWith) {
        rows.push([
          item.resourceType,
          `"${item.resourceTitle.replace(/"/g, '""')}"`,
          share.pubkey.slice(0, 16) + '...',
          share.permission,
          share.via,
          new Date(share.sharedAt).toISOString(),
          '',
          '',
          '',
        ].join(','))
      }

      // Add rows for each share link
      for (const link of item.shareLinks) {
        rows.push([
          item.resourceType,
          `"${item.resourceTitle.replace(/"/g, '""')}"`,
          link.isPublic ? 'Anyone with link' : 'Authenticated users',
          link.permission,
          'link',
          new Date(link.createdAt).toISOString(),
          link.isPublic ? 'Yes' : 'No',
          link.accessCount.toString(),
          link.expiresAt ? new Date(link.expiresAt).toISOString() : 'Never',
        ].join(','))
      }

      // If no specific shares, add a row showing public status
      if (item.sharedWith.length === 0 && item.shareLinks.length === 0) {
        rows.push([
          item.resourceType,
          `"${item.resourceTitle.replace(/"/g, '""')}"`,
          'Public',
          'view',
          'public',
          '',
          'Yes',
          '',
          '',
        ].join(','))
      }
    }

    return rows.join('\n')
  },
}))
