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
    }

    // Update in store
    useFilesStore.getState().updateFile(fileId, updates)

    // Update in DB
    await db.table('fileMetadata').update(fileId, updatedFile)

    return updatedFile
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
   * Create a file share
   */
  async createShare(input: CreateShareInput): Promise<FileShare> {
    const id = crypto.randomUUID()
    const now = Date.now()

    const share: FileShare = {
      id,
      fileId: input.fileId,
      groupId: input.groupId,
      sharedBy: '', // TODO: Get current user pubkey
      sharedWith: input.sharedWith || [],
      permissions: input.permissions,
      expiresAt: input.expiresAt || null,
      password: input.password, // TODO: Hash password
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
        // TODO: Implement copy operation
        throw new Error('Copy operation not yet implemented')

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
