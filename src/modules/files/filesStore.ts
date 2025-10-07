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
}))
