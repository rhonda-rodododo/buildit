/**
 * File Manager
 * Business logic for file uploads, encryption, and management
 */

import { getPublicKey } from 'nostr-tools'
import type {
  FileMetadata,
  Folder,
  FileShare,
  StorageQuota,
  CreateFileInput,
  CreateFolderInput,
  UpdateFileInput,
  UpdateFolderInput,
  CreateShareInput,
  BulkFileOperation,
  FilePreview,
  FileType,
  EncryptedFileBlob,
  FileVersion,
} from './types'
import { useFilesStore } from './filesStore'
import { db } from '@/core/storage/db'

class FileManager {
  /**
   * Determine file type from MIME type
   */
  private getFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text') ||
      mimeType.includes('msword') ||
      mimeType.includes('openxmlformats')
    ) {
      return 'document'
    }
    if (
      mimeType.includes('zip') ||
      mimeType.includes('rar') ||
      mimeType.includes('tar') ||
      mimeType.includes('gz')
    ) {
      return 'archive'
    }
    return 'other'
  }

  /**
   * Encrypt file using AES-GCM
   */
  private async encryptFile(
    file: File,
    groupKey: Uint8Array
  ): Promise<{ encryptedBlob: Blob; iv: Uint8Array }> {
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Import group key
    const key = await crypto.subtle.importKey(
      'raw',
      groupKey.buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer()

    // Encrypt
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      fileData
    )

    return {
      encryptedBlob: new Blob([encryptedData]),
      iv,
    }
  }

  /**
   * Decrypt file using AES-GCM
   */
  private async decryptFile(
    encryptedBlob: Blob,
    iv: Uint8Array,
    groupKey: Uint8Array
  ): Promise<Blob> {
    // Import group key
    const key = await crypto.subtle.importKey(
      'raw',
      groupKey.buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // Read encrypted blob as ArrayBuffer
    const encryptedData = await encryptedBlob.arrayBuffer()

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      encryptedData
    )

    return new Blob([decryptedData])
  }

  /**
   * Create a new file
   */
  async createFile(
    input: CreateFileInput,
    userPrivkey: Uint8Array,
    groupKey?: Uint8Array
  ): Promise<FileMetadata> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const userPubkey = getPublicKey(userPrivkey)

    // Check storage quota
    const quota = useFilesStore.getState().getStorageQuota(input.groupId)
    if (quota && quota.quotaLimit > 0) {
      if (quota.usedBytes + input.file.size > quota.quotaLimit) {
        throw new Error('Storage quota exceeded')
      }
    }

    // Determine if encryption is needed
    const shouldEncrypt = input.encrypt !== false && groupKey !== undefined

    let fileBlob: Blob = input.file
    let iv: Uint8Array | undefined
    let encryptedSize = input.file.size

    // Encrypt if needed
    if (shouldEncrypt && groupKey) {
      const encrypted = await this.encryptFile(input.file, groupKey)
      fileBlob = encrypted.encryptedBlob
      iv = encrypted.iv
      encryptedSize = fileBlob.size

      // Update upload progress
      useFilesStore.getState().setUploadProgress({
        fileId: id,
        fileName: input.name,
        progress: 50,
        status: 'encrypting',
      })
    }

    const fileMetadata: FileMetadata = {
      id,
      groupId: input.groupId,
      folderId: input.folderId || null,
      name: input.name,
      type: this.getFileType(input.file.type),
      mimeType: input.file.type,
      size: input.file.size,
      encryptedSize,
      uploadedBy: userPubkey,
      createdAt: now,
      updatedAt: now,
      isEncrypted: shouldEncrypt,
      encryptionKeyId: shouldEncrypt ? input.groupId : undefined,
      tags: input.tags || [],
      metadata: {},
      version: 1,
    }

    // Store encrypted blob in IndexedDB
    const encryptedFileBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId: id,
      data: fileBlob,
      iv: iv || new Uint8Array(0),
      createdAt: now,
    }

    await db.table('encryptedFileBlobs').add(encryptedFileBlob)

    // Store metadata in IndexedDB
    await db.table('fileMetadata').add(fileMetadata)

    // Update store
    useFilesStore.getState().addFile(fileMetadata)

    // Update storage quota
    useFilesStore.getState().updateQuotaUsage(input.groupId, encryptedSize, 1)

    // Update upload progress to complete
    useFilesStore.getState().setUploadProgress({
      fileId: id,
      fileName: input.name,
      progress: 100,
      status: 'complete',
    })

    // Remove progress after 2 seconds
    setTimeout(() => {
      useFilesStore.getState().removeUploadProgress(id)
    }, 2000)

    return fileMetadata
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    updates: UpdateFileInput
  ): Promise<FileMetadata> {
    const file = useFilesStore.getState().getFile(fileId)
    if (!file) {
      throw new Error('File not found')
    }

    const updatedFile: FileMetadata = {
      ...file,
      ...updates,
      updatedAt: Date.now(),
      version: file.version + 1,
    }

    // Update in store
    useFilesStore.getState().updateFile(fileId, updates)

    // Update in DB
    await db.table('fileMetadata').update(fileId, updatedFile)

    return updatedFile
  }

  /**
   * Create a new file version (when re-uploading same file)
   */
  async createFileVersion(
    fileId: string,
    file: File,
    userPrivkey: Uint8Array,
    groupKey?: Uint8Array,
    changeDescription?: string
  ): Promise<void> {
    const existingFile = useFilesStore.getState().getFile(fileId)
    if (!existingFile) {
      throw new Error('File not found')
    }

    const userPubkey = getPublicKey(userPrivkey)
    const versionNumber = existingFile.version + 1

    // Encrypt new version if needed
    let fileBlob: Blob = file
    let iv: Uint8Array | undefined

    if (existingFile.isEncrypted && groupKey) {
      const encrypted = await this.encryptFile(file, groupKey)
      fileBlob = encrypted.encryptedBlob
      iv = encrypted.iv
    }

    // Store version metadata
    const version: FileVersion = {
      id: crypto.randomUUID(),
      fileId,
      version: versionNumber,
      size: file.size,
      uploadedBy: userPubkey,
      createdAt: Date.now(),
      changeDescription,
    }

    await db.table('fileVersions').add(version)

    // Store new version blob
    const encryptedFileBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId: `${fileId}_v${versionNumber}`, // Use versioned fileId
      data: fileBlob,
      iv: iv || new Uint8Array(0),
      createdAt: Date.now(),
    }

    await db.table('encryptedFileBlobs').add(encryptedFileBlob)

    // Update file metadata
    await this.updateFile(fileId, {
      size: file.size,
      encryptedSize: fileBlob.size,
    })
  }

  /**
   * Get file version history
   */
  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    const versions = await db.table('fileVersions')
      .where('fileId')
      .equals(fileId)
      .reverse()
      .sortBy('version') as FileVersion[]

    return versions.reverse() // Most recent first
  }

  /**
   * Restore a previous file version
   */
  async restoreFileVersion(
    fileId: string,
    versionNumber: number
  ): Promise<void> {
    // Get version metadata
    const version = await db.table('fileVersions')
      .where({ fileId, version: versionNumber })
      .first() as FileVersion | undefined

    if (!version) {
      throw new Error('Version not found')
    }

    // Get version blob
    const versionBlob = await db.table('encryptedFileBlobs')
      .where('fileId')
      .equals(`${fileId}_v${versionNumber}`)
      .first() as EncryptedFileBlob | undefined

    if (!versionBlob) {
      throw new Error('Version blob not found')
    }

    // Replace current file blob with version blob
    await db.table('encryptedFileBlobs')
      .where('fileId')
      .equals(fileId)
      .delete()

    const newBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId,
      data: versionBlob.data,
      iv: versionBlob.iv,
      createdAt: Date.now(),
    }

    await db.table('encryptedFileBlobs').add(newBlob)

    // Update file metadata
    await this.updateFile(fileId, {
      size: version.size,
    })
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = useFilesStore.getState().getFile(fileId)
    if (!file) {
      throw new Error('File not found')
    }

    // Delete encrypted blob
    await db.table('encryptedFileBlobs')
      .where('fileId')
      .equals(fileId)
      .delete()

    // Delete metadata
    await db.table('fileMetadata').delete(fileId)

    // Delete shares
    await db.table('fileShares')
      .where('fileId')
      .equals(fileId)
      .delete()

    // Delete versions
    await db.table('fileVersions')
      .where('fileId')
      .equals(fileId)
      .delete()

    // Update storage quota
    useFilesStore.getState().updateQuotaUsage(
      file.groupId,
      -file.encryptedSize,
      -1
    )

    // Remove from store
    useFilesStore.getState().deleteFile(fileId)
  }

  /**
   * Get decrypted file blob
   */
  async getFileBlob(
    fileId: string,
    groupKey?: Uint8Array
  ): Promise<Blob> {
    const file = useFilesStore.getState().getFile(fileId)
    if (!file) {
      throw new Error('File not found')
    }

    // Get encrypted blob
    const encryptedBlob = await db.table('encryptedFileBlobs')
      .where('fileId')
      .equals(fileId)
      .first() as EncryptedFileBlob | undefined

    if (!encryptedBlob) {
      throw new Error('File blob not found')
    }

    // Decrypt if needed
    if (file.isEncrypted && groupKey) {
      return await this.decryptFile(
        encryptedBlob.data,
        encryptedBlob.iv,
        groupKey
      )
    }

    return encryptedBlob.data
  }

  /**
   * Create a new folder
   */
  async createFolder(
    input: CreateFolderInput,
    userPrivkey: Uint8Array
  ): Promise<Folder> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const userPubkey = getPublicKey(userPrivkey)

    const folder: Folder = {
      id,
      groupId: input.groupId,
      parentId: input.parentId || null,
      name: input.name,
      createdBy: userPubkey,
      createdAt: now,
      updatedAt: now,
      color: input.color,
      icon: input.icon,
    }

    // Store in DB
    await db.table('folders').add(folder)

    // Update store
    useFilesStore.getState().addFolder(folder)

    return folder
  }

  /**
   * Update folder
   */
  async updateFolder(
    folderId: string,
    updates: UpdateFolderInput
  ): Promise<Folder> {
    const folder = useFilesStore.getState().getFolder(folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    const updatedFolder: Folder = {
      ...folder,
      ...updates,
      updatedAt: Date.now(),
    }

    // Update in store
    useFilesStore.getState().updateFolder(folderId, updates)

    // Update in DB
    await db.table('folders').update(folderId, updatedFolder)

    return updatedFolder
  }

  /**
   * Delete folder and all contents
   */
  async deleteFolder(folderId: string): Promise<void> {
    const folder = useFilesStore.getState().getFolder(folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    // Delete all files in folder recursively
    const deleteFilesRecursive = async (id: string) => {
      const files = useFilesStore.getState().getFolderFiles(id)
      for (const file of files) {
        await this.deleteFile(file.id)
      }

      const subfolders = useFilesStore.getState().getGroupFolders(folder.groupId, id)
      for (const subfolder of subfolders) {
        await deleteFilesRecursive(subfolder.id)
      }
    }

    await deleteFilesRecursive(folderId)

    // Delete folder from DB
    await db.table('folders').delete(folderId)

    // Remove from store
    useFilesStore.getState().deleteFolder(folderId)
  }

  /**
   * Hash password using SHA-256
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Create a file share
   */
  async createShare(
    input: CreateShareInput,
    userPrivkey: Uint8Array
  ): Promise<FileShare> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const userPubkey = getPublicKey(userPrivkey)

    // Hash password if provided
    const hashedPassword = input.password
      ? await this.hashPassword(input.password)
      : undefined

    const share: FileShare = {
      id,
      fileId: input.fileId,
      groupId: input.groupId,
      sharedBy: userPubkey,
      sharedWith: input.sharedWith || [],
      permissions: input.permissions,
      expiresAt: input.expiresAt || null,
      password: hashedPassword,
      shareLink: input.generateLink ? crypto.randomUUID() : undefined,
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: null,
    }

    // Store in DB
    await db.table('fileShares').add(share)

    // Update store
    useFilesStore.getState().addShare(share)

    return share
  }

  /**
   * Delete a share
   */
  async deleteShare(shareId: string): Promise<void> {
    await db.table('fileShares').delete(shareId)
    useFilesStore.getState().deleteShare(shareId)
  }

  /**
   * Get file preview
   */
  async getFilePreview(
    fileId: string,
    groupKey?: Uint8Array
  ): Promise<FilePreview> {
    const file = useFilesStore.getState().getFile(fileId)
    if (!file) {
      throw new Error('File not found')
    }

    const blob = await this.getFileBlob(fileId, groupKey)

    // Image preview
    if (file.type === 'image') {
      return {
        type: 'image',
        url: URL.createObjectURL(blob),
      }
    }

    // PDF preview
    if (file.mimeType === 'application/pdf') {
      return {
        type: 'pdf',
        url: URL.createObjectURL(blob),
      }
    }

    // Text preview
    if (file.type === 'document' && blob.size < 1024 * 1024) { // Max 1MB for text preview
      const text = await blob.text()
      return {
        type: 'text',
        content: text,
        language: this.detectLanguage(file.name),
      }
    }

    // Video preview
    if (file.type === 'video') {
      return {
        type: 'video',
        url: URL.createObjectURL(blob),
      }
    }

    // Audio preview
    if (file.type === 'audio') {
      return {
        type: 'audio',
        url: URL.createObjectURL(blob),
      }
    }

    return { type: 'none' }
  }

  /**
   * Detect code language from filename
   */
  private detectLanguage(filename: string): string | undefined {
    const ext = filename.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
      sh: 'bash',
    }
    return ext ? langMap[ext] : undefined
  }

  /**
   * Copy a file to a different folder
   */
  async copyFile(fileId: string, targetFolderId: string | null): Promise<FileMetadata> {
    const originalFile = useFilesStore.getState().getFile(fileId)
    if (!originalFile) {
      throw new Error('File not found')
    }

    const newId = crypto.randomUUID()
    const now = Date.now()

    // Get original blob
    const originalBlob = await db.table('encryptedFileBlobs')
      .where('fileId')
      .equals(fileId)
      .first() as EncryptedFileBlob | undefined

    if (!originalBlob) {
      throw new Error('File blob not found')
    }

    // Create new file metadata (copy)
    const copiedFile: FileMetadata = {
      ...originalFile,
      id: newId,
      folderId: targetFolderId,
      name: `${originalFile.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }

    // Copy blob
    const copiedBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId: newId,
      data: originalBlob.data,
      iv: originalBlob.iv,
      createdAt: now,
    }

    // Store in DB
    await db.table('fileMetadata').add(copiedFile)
    await db.table('encryptedFileBlobs').add(copiedBlob)

    // Update store
    useFilesStore.getState().addFile(copiedFile)

    // Update storage quota
    useFilesStore.getState().updateQuotaUsage(
      copiedFile.groupId,
      copiedFile.encryptedSize,
      1
    )

    return copiedFile
  }

  /**
   * Bulk file operations
   */
  async bulkOperation(operation: BulkFileOperation): Promise<void> {
    const { fileIds, operation: op } = operation

    switch (op) {
      case 'delete':
        for (const fileId of fileIds) {
          await this.deleteFile(fileId)
        }
        break

      case 'move':
        if (operation.targetFolderId === undefined) {
          throw new Error('Target folder required for move operation')
        }
        for (const fileId of fileIds) {
          await this.updateFile(fileId, { folderId: operation.targetFolderId })
        }
        break

      case 'copy':
        if (operation.targetFolderId === undefined) {
          throw new Error('Target folder required for copy operation')
        }
        for (const fileId of fileIds) {
          await this.copyFile(fileId, operation.targetFolderId)
        }
        break

      case 'tag':
        if (!operation.tags) {
          throw new Error('Tags required for tag operation')
        }
        for (const fileId of fileIds) {
          const file = useFilesStore.getState().getFile(fileId)
          if (file) {
            const newTags = Array.from(new Set([...file.tags, ...operation.tags]))
            await this.updateFile(fileId, { tags: newTags })
          }
        }
        break
    }
  }

  /**
   * Initialize storage quota for a group
   */
  async initializeStorageQuota(
    groupId: string,
    quotaLimit: number = 0
  ): Promise<StorageQuota> {
    const quota: StorageQuota = {
      groupId,
      totalBytes: quotaLimit,
      usedBytes: 0,
      fileCount: 0,
      quotaLimit,
      updatedAt: Date.now(),
    }

    await db.table('storageQuotas').add(quota)
    useFilesStore.getState().setStorageQuota(quota)

    return quota
  }

  /**
   * Load all files for a group
   */
  async loadGroupFiles(groupId: string): Promise<void> {
    const files = await db.table('fileMetadata')
      .where('groupId')
      .equals(groupId)
      .toArray() as FileMetadata[]

    const folders = await db.table('folders')
      .where('groupId')
      .equals(groupId)
      .toArray() as Folder[]

    files.forEach(file => useFilesStore.getState().addFile(file))
    folders.forEach(folder => useFilesStore.getState().addFolder(folder))
  }
}

export const fileManager = new FileManager()
