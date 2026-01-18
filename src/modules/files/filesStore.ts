/**
 * Files Store
 * State management for file uploads, folders, and sharing
 */

import { create } from 'zustand'
import type {
  FileMetadata,
  Folder,
  FileShare,
  FileVersion,
  StorageQuota,
  FileUploadProgress,
  FileFolderPermission,
  FileAccessRequest,
  FileSharingReportItem,
  FilePermission,
} from './types'

interface FilesState {
  files: Map<string, FileMetadata>
  folders: Map<string, Folder>
  shares: Map<string, FileShare>
  versions: Map<string, FileVersion[]>
  uploadProgress: Map<string, FileUploadProgress>
  storageQuotas: Map<string, StorageQuota>
  currentFolderId: string | null
  selectedFileIds: Set<string>
  isLoading: boolean
  error: string | null
  // Epic 58: Permission inheritance & access requests
  folderPermissions: Map<string, FileFolderPermission[]> // folderId -> permissions
  accessRequests: Map<string, FileAccessRequest[]> // resourceId -> requests
}

interface FilesActions {
  // File CRUD
  addFile: (file: FileMetadata) => void
  updateFile: (id: string, updates: Partial<FileMetadata>) => void
  deleteFile: (id: string) => void
  getFile: (id: string) => FileMetadata | undefined
  getGroupFiles: (groupId: string, folderId?: string | null) => FileMetadata[]
  getFolderFiles: (folderId: string) => FileMetadata[]

  // Folder CRUD
  addFolder: (folder: Folder) => void
  updateFolder: (id: string, updates: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  getFolder: (id: string) => Folder | undefined
  getGroupFolders: (groupId: string, parentId?: string | null) => Folder[]
  getFolderPath: (folderId: string) => Folder[]

  // File sharing
  addShare: (share: FileShare) => void
  updateShare: (id: string, updates: Partial<FileShare>) => void
  deleteShare: (id: string) => void
  getFileShares: (fileId: string) => FileShare[]
  getShareByLink: (shareLink: string) => FileShare | undefined

  // File versions
  addVersion: (version: FileVersion) => void
  getVersions: (fileId: string) => FileVersion[]

  // Upload progress
  setUploadProgress: (progress: FileUploadProgress) => void
  removeUploadProgress: (fileId: string) => void
  getAllUploadProgress: () => FileUploadProgress[]

  // Storage quota
  setStorageQuota: (quota: StorageQuota) => void
  getStorageQuota: (groupId: string) => StorageQuota | undefined
  updateQuotaUsage: (groupId: string, bytesChange: number, fileCountChange: number) => void

  // Navigation
  setCurrentFolder: (folderId: string | null) => void
  getCurrentFolder: () => Folder | undefined

  // Selection
  selectFile: (fileId: string) => void
  deselectFile: (fileId: string) => void
  selectAllFiles: (fileIds: string[]) => void
  clearSelection: () => void
  getSelectedFiles: () => FileMetadata[]

  // State management
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // Epic 58: Folder Permission Inheritance
  setFolderPermission: (permission: FileFolderPermission) => void
  removeFolderPermission: (folderId: string, userPubkey: string) => void
  getFolderPermissions: (folderId: string) => FileFolderPermission[]
  getInheritedPermissions: (fileId: string, userPubkey: string) => FilePermission[] | null
  getEffectivePermissions: (fileId: string, userPubkey: string) => FilePermission[] | null

  // Epic 58: Access Requests
  createAccessRequest: (request: FileAccessRequest) => void
  updateAccessRequest: (requestId: string, updates: Partial<FileAccessRequest>) => void
  getAccessRequests: (resourceId: string) => FileAccessRequest[]
  getPendingAccessRequests: (groupId: string) => FileAccessRequest[]
  approveAccessRequest: (requestId: string, reviewerPubkey: string, note?: string) => void
  denyAccessRequest: (requestId: string, reviewerPubkey: string, note?: string) => void

  // Epic 58: Sharing Report Export
  generateSharingReport: (groupId: string) => FileSharingReportItem[]
  exportSharingReportCSV: (groupId: string) => string
}

const initialState: FilesState = {
  files: new Map(),
  folders: new Map(),
  shares: new Map(),
  versions: new Map(),
  uploadProgress: new Map(),
  storageQuotas: new Map(),
  currentFolderId: null,
  selectedFileIds: new Set(),
  isLoading: false,
  error: null,
  // Epic 58: Permission inheritance & access requests
  folderPermissions: new Map(),
  accessRequests: new Map(),
}

export const useFilesStore = create<FilesState & FilesActions>((set, get) => ({
  ...initialState,

  // File CRUD
  addFile: (file) =>
    set((state) => {
      const files = new Map(state.files)
      files.set(file.id, file)
      return { files }
    }),

  updateFile: (id, updates) =>
    set((state) => {
      const files = new Map(state.files)
      const file = files.get(id)
      if (file) {
        files.set(id, { ...file, ...updates, updatedAt: Date.now() })
      }
      return { files }
    }),

  deleteFile: (id) =>
    set((state) => {
      const files = new Map(state.files)
      const shares = new Map(state.shares)
      const versions = new Map(state.versions)

      files.delete(id)
      versions.delete(id)

      // Delete associated shares
      Array.from(shares.entries()).forEach(([shareId, share]) => {
        if (share.fileId === id) {
          shares.delete(shareId)
        }
      })

      return { files, shares, versions }
    }),

  getFile: (id) => get().files.get(id),

  getGroupFiles: (groupId, folderId = null) => {
    return Array.from(get().files.values())
      .filter((file) => file.groupId === groupId && file.folderId === folderId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  getFolderFiles: (folderId) => {
    return Array.from(get().files.values())
      .filter((file) => file.folderId === folderId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Folder CRUD
  addFolder: (folder) =>
    set((state) => {
      const folders = new Map(state.folders)
      folders.set(folder.id, folder)
      return { folders }
    }),

  updateFolder: (id, updates) =>
    set((state) => {
      const folders = new Map(state.folders)
      const folder = folders.get(id)
      if (folder) {
        folders.set(id, { ...folder, ...updates, updatedAt: Date.now() })
      }
      return { folders }
    }),

  deleteFolder: (id) =>
    set((state) => {
      const folders = new Map(state.folders)
      const files = new Map(state.files)

      // Recursively delete child folders and files
      const deleteRecursive = (folderId: string) => {
        // Delete files in this folder
        Array.from(files.entries()).forEach(([fileId, file]) => {
          if (file.folderId === folderId) {
            files.delete(fileId)
          }
        })

        // Delete child folders
        Array.from(folders.entries()).forEach(([childId, folder]) => {
          if (folder.parentId === folderId) {
            deleteRecursive(childId)
            folders.delete(childId)
          }
        })
      }

      deleteRecursive(id)
      folders.delete(id)

      return {
        folders,
        files,
        currentFolderId: state.currentFolderId === id ? null : state.currentFolderId
      }
    }),

  getFolder: (id) => get().folders.get(id),

  getGroupFolders: (groupId, parentId = null) => {
    return Array.from(get().folders.values())
      .filter((folder) => folder.groupId === groupId && folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  getFolderPath: (folderId) => {
    const path: Folder[] = []
    const folders = get().folders
    let currentId: string | null = folderId

    while (currentId) {
      const folder = folders.get(currentId)
      if (!folder) break
      path.unshift(folder)
      currentId = folder.parentId
    }

    return path
  },

  // File sharing
  addShare: (share) =>
    set((state) => {
      const shares = new Map(state.shares)
      shares.set(share.id, share)
      return { shares }
    }),

  updateShare: (id, updates) =>
    set((state) => {
      const shares = new Map(state.shares)
      const share = shares.get(id)
      if (share) {
        shares.set(id, { ...share, ...updates })
      }
      return { shares }
    }),

  deleteShare: (id) =>
    set((state) => {
      const shares = new Map(state.shares)
      shares.delete(id)
      return { shares }
    }),

  getFileShares: (fileId) => {
    return Array.from(get().shares.values())
      .filter((share) => share.fileId === fileId)
      .sort((a, b) => b.createdAt - a.createdAt)
  },

  getShareByLink: (shareLink) => {
    return Array.from(get().shares.values())
      .find((share) => share.shareLink === shareLink)
  },

  // File versions
  addVersion: (version) =>
    set((state) => {
      const versions = new Map(state.versions)
      const fileVersions = versions.get(version.fileId) || []
      versions.set(version.fileId, [...fileVersions, version].sort((a, b) => b.version - a.version))
      return { versions }
    }),

  getVersions: (fileId) => {
    return get().versions.get(fileId) || []
  },

  // Upload progress
  setUploadProgress: (progress) =>
    set((state) => {
      const uploadProgress = new Map(state.uploadProgress)
      uploadProgress.set(progress.fileId, progress)
      return { uploadProgress }
    }),

  removeUploadProgress: (fileId) =>
    set((state) => {
      const uploadProgress = new Map(state.uploadProgress)
      uploadProgress.delete(fileId)
      return { uploadProgress }
    }),

  getAllUploadProgress: () => {
    return Array.from(get().uploadProgress.values())
  },

  // Storage quota
  setStorageQuota: (quota) =>
    set((state) => {
      const storageQuotas = new Map(state.storageQuotas)
      storageQuotas.set(quota.groupId, quota)
      return { storageQuotas }
    }),

  getStorageQuota: (groupId) => {
    return get().storageQuotas.get(groupId)
  },

  updateQuotaUsage: (groupId, bytesChange, fileCountChange) =>
    set((state) => {
      const storageQuotas = new Map(state.storageQuotas)
      const quota = storageQuotas.get(groupId)

      if (quota) {
        storageQuotas.set(groupId, {
          ...quota,
          usedBytes: Math.max(0, quota.usedBytes + bytesChange),
          fileCount: Math.max(0, quota.fileCount + fileCountChange),
          updatedAt: Date.now(),
        })
      }

      return { storageQuotas }
    }),

  // Navigation
  setCurrentFolder: (folderId) => set({ currentFolderId: folderId }),

  getCurrentFolder: () => {
    const folderId = get().currentFolderId
    return folderId ? get().folders.get(folderId) : undefined
  },

  // Selection
  selectFile: (fileId) =>
    set((state) => {
      const selectedFileIds = new Set(state.selectedFileIds)
      selectedFileIds.add(fileId)
      return { selectedFileIds }
    }),

  deselectFile: (fileId) =>
    set((state) => {
      const selectedFileIds = new Set(state.selectedFileIds)
      selectedFileIds.delete(fileId)
      return { selectedFileIds }
    }),

  selectAllFiles: (fileIds) =>
    set({ selectedFileIds: new Set(fileIds) }),

  clearSelection: () =>
    set({ selectedFileIds: new Set() }),

  getSelectedFiles: () => {
    const { files, selectedFileIds } = get()
    return Array.from(selectedFileIds)
      .map((id) => files.get(id))
      .filter((file): file is FileMetadata => file !== undefined)
  },

  // State management
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),

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

  getInheritedPermissions: (fileId, userPubkey) => {
    const { files, folders, folderPermissions } = get()
    const file = files.get(fileId)
    if (!file || !file.folderId) return null

    // Walk up the folder tree looking for inherited permissions
    let currentFolderId: string | null = file.folderId
    while (currentFolderId) {
      const permissions = folderPermissions.get(currentFolderId) || []
      const userPermission = permissions.find(
        (p) => p.userPubkey === userPubkey && p.inheritToChildren
      )
      if (userPermission) {
        return userPermission.permissions
      }
      // Move to parent folder
      const folder = folders.get(currentFolderId)
      currentFolderId = folder?.parentId ?? null
    }
    return null
  },

  getEffectivePermissions: (fileId, userPubkey) => {
    const { getInheritedPermissions, shares, files } = get()
    const file = files.get(fileId)
    if (!file) return null

    // Check if user is the uploader (implicit full access)
    if (file.uploadedBy === userPubkey) {
      return ['view', 'download', 'edit', 'delete'] as FilePermission[]
    }

    // Check direct shares
    const fileShares = Array.from(shares.values()).filter((s) => s.fileId === fileId)
    for (const share of fileShares) {
      if (share.sharedWith.length === 0 || share.sharedWith.includes(userPubkey)) {
        return share.permissions
      }
    }

    // Check inherited permission from folder
    const inheritedPermissions = getInheritedPermissions(fileId, userPubkey)
    if (inheritedPermissions) return inheritedPermissions

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
    const { accessRequests, files, folders } = get()
    const pending: FileAccessRequest[] = []

    for (const [, requests] of accessRequests.entries()) {
      for (const request of requests) {
        if (request.status !== 'pending') continue

        // Check if this resource belongs to the group
        if (request.resourceType === 'file') {
          const file = files.get(request.resourceId)
          if (file?.groupId === groupId) {
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
    const { accessRequests, addShare, setFolderPermission, files, folders } = get()

    // Find the request
    let request: FileAccessRequest | undefined
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
    if (request.resourceType === 'file') {
      const file = files.get(request.resourceId)
      if (file) {
        addShare({
          id: crypto.randomUUID(),
          fileId: request.resourceId,
          groupId: file.groupId,
          sharedBy: reviewerPubkey,
          sharedWith: [request.requesterPubkey],
          permissions: request.requestedPermissions,
          expiresAt: null,
          createdAt: Date.now(),
          accessCount: 0,
          lastAccessedAt: null,
        })
      }
    } else if (request.resourceType === 'folder') {
      const folder = folders.get(request.resourceId)
      if (folder) {
        setFolderPermission({
          folderId: request.resourceId,
          groupId: folder.groupId,
          userPubkey: request.requesterPubkey,
          permissions: request.requestedPermissions,
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
    const { files, folders, shares, folderPermissions } = get()

    const report: FileSharingReportItem[] = []

    // Process files
    for (const file of files.values()) {
      if (file.groupId !== groupId) continue

      const fileShares = Array.from(shares.values()).filter((s) => s.fileId === file.id)

      // Get inherited permissions from folder
      let inheritedFrom: FileSharingReportItem['inheritedFrom'] | undefined
      if (file.folderId) {
        const folder = folders.get(file.folderId)
        const folderPerms = folderPermissions.get(file.folderId) || []
        if (folder && folderPerms.some((p) => p.inheritToChildren)) {
          inheritedFrom = {
            folderId: folder.id,
            folderName: folder.name,
          }
        }
      }

      const sharedWith: FileSharingReportItem['sharedWith'] = []

      // Add direct shares
      for (const share of fileShares) {
        if (share.sharedWith.length === 0) {
          // Shared with all group members
          sharedWith.push({
            pubkey: 'all-group-members',
            permissions: share.permissions,
            sharedAt: share.createdAt,
            via: share.shareLink ? 'link' : 'direct',
          })
        } else {
          for (const pubkey of share.sharedWith) {
            sharedWith.push({
              pubkey,
              permissions: share.permissions,
              sharedAt: share.createdAt,
              via: 'direct',
            })
          }
        }
      }

      // Add folder-inherited permissions
      if (file.folderId) {
        const folderPerms = folderPermissions.get(file.folderId) || []
        for (const perm of folderPerms) {
          if (perm.inheritToChildren) {
            // Don't duplicate if already added
            if (!sharedWith.some((s) => s.pubkey === perm.userPubkey)) {
              sharedWith.push({
                pubkey: perm.userPubkey,
                permissions: perm.permissions,
                sharedAt: perm.addedAt,
                via: 'folder-inheritance',
              })
            }
          }
        }
      }

      // Only include if there's sharing activity
      if (sharedWith.length > 0 || fileShares.some((s) => s.shareLink)) {
        report.push({
          resourceId: file.id,
          resourceType: 'file',
          resourceName: file.name,
          size: file.size,
          sharedWith,
          shareLinks: fileShares
            .filter((s) => s.shareLink)
            .map((share) => ({
              id: share.id,
              permissions: share.permissions,
              hasPassword: !!share.password,
              accessCount: share.accessCount,
              createdAt: share.createdAt,
              expiresAt: share.expiresAt,
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

      const sharedWith: FileSharingReportItem['sharedWith'] = folderPerms.map((perm) => ({
        pubkey: perm.userPubkey,
        permissions: perm.permissions,
        sharedAt: perm.addedAt,
        via: 'direct',
      }))

      report.push({
        resourceId: folder.id,
        resourceType: 'folder',
        resourceName: folder.name,
        sharedWith,
        shareLinks: [],
      })
    }

    return report.sort((a, b) => a.resourceName.localeCompare(b.resourceName))
  },

  exportSharingReportCSV: (groupId) => {
    const report = get().generateSharingReport(groupId)
    const rows: string[] = []

    // Header
    rows.push('Resource Type,Resource Name,Size (bytes),Shared With (Pubkey),Permissions,Shared Via,Shared At,Has Link,Link Has Password,Link Accesses,Link Expires')

    for (const item of report) {
      // Add rows for each shared user
      for (const share of item.sharedWith) {
        rows.push([
          item.resourceType,
          `"${item.resourceName.replace(/"/g, '""')}"`,
          item.size?.toString() || '',
          share.pubkey === 'all-group-members' ? 'All group members' : share.pubkey.slice(0, 16) + '...',
          share.permissions.join(';'),
          share.via,
          new Date(share.sharedAt).toISOString(),
          '',
          '',
          '',
          '',
        ].join(','))
      }

      // Add rows for each share link
      for (const link of item.shareLinks) {
        rows.push([
          item.resourceType,
          `"${item.resourceName.replace(/"/g, '""')}"`,
          item.size?.toString() || '',
          'Anyone with link',
          link.permissions.join(';'),
          'link',
          new Date(link.createdAt).toISOString(),
          'Yes',
          link.hasPassword ? 'Yes' : 'No',
          link.accessCount.toString(),
          link.expiresAt ? new Date(link.expiresAt).toISOString() : 'Never',
        ].join(','))
      }
    }

    return rows.join('\n')
  },
}))
