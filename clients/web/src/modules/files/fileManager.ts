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
  ArchiveEntry,
} from './types'
import { fileAnalytics } from './fileAnalytics'
import { useFilesStore } from './filesStore'
import { dal } from '@/core/storage/dal'

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

    await dal.add('encryptedFileBlobs', encryptedFileBlob)

    // Store metadata in IndexedDB
    await dal.add('fileMetadata', fileMetadata)

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

    // Epic 57: Index file content and store hash for analytics
    try {
      await fileAnalytics.indexFileContent(id, input.groupId, input.file, input.file.type)
      await fileAnalytics.storeFileHash(id, input.groupId, input.file)
      await fileAnalytics.logActivity(input.groupId, id, input.name, 'upload', userPubkey)
    } catch (err) {
      // Non-critical, don't fail upload
      console.error('Failed to index file for analytics:', err)
    }

    return fileMetadata
  }

  /**
   * Move a file to a different folder
   * Epic 57: Added for bulk move operations
   */
  async moveFile(fileId: string, targetFolderId: string | null): Promise<void> {
    await this.updateFile(fileId, { folderId: targetFolderId })
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
    await dal.update('fileMetadata', fileId, updatedFile)

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

    await dal.add('fileVersions', version)

    // Store new version blob
    const encryptedFileBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId: `${fileId}_v${versionNumber}`, // Use versioned fileId
      data: fileBlob,
      iv: iv || new Uint8Array(0),
      createdAt: Date.now(),
    }

    await dal.add('encryptedFileBlobs', encryptedFileBlob)

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
    const versions = await dal.query<FileVersion>('fileVersions', {
      whereClause: { fileId },
      orderBy: 'version',
      orderDir: 'desc',
    })

    return versions
  }

  /**
   * Restore a previous file version
   */
  async restoreFileVersion(
    fileId: string,
    versionNumber: number
  ): Promise<void> {
    // Get version metadata
    const versions = await dal.queryCustom<FileVersion>({
      sql: 'SELECT * FROM file_versions WHERE file_id = ?1 AND version = ?2 LIMIT 1',
      params: [fileId, versionNumber],
      dexieFallback: async (db) => {
        const result = await db.table('fileVersions')
          .where({ fileId, version: versionNumber })
          .first();
        return result ? [result] : [];
      },
    })
    const version = versions[0]

    if (!version) {
      throw new Error('Version not found')
    }

    // Get version blob
    const versionBlobs = await dal.queryCustom<EncryptedFileBlob>({
      sql: 'SELECT * FROM encrypted_file_blobs WHERE file_id = ?1 LIMIT 1',
      params: [`${fileId}_v${versionNumber}`],
      dexieFallback: async (db) => {
        const result = await db.table('encryptedFileBlobs')
          .where('fileId')
          .equals(`${fileId}_v${versionNumber}`)
          .first();
        return result ? [result] : [];
      },
    })
    const versionBlob = versionBlobs[0]

    if (!versionBlob) {
      throw new Error('Version blob not found')
    }

    // Replace current file blob with version blob
    await dal.queryCustom({
      sql: 'DELETE FROM encrypted_file_blobs WHERE file_id = ?1',
      params: [fileId],
      dexieFallback: async (db) => {
        await db.table('encryptedFileBlobs')
          .where('fileId')
          .equals(fileId)
          .delete();
      },
    })

    const newBlob: EncryptedFileBlob = {
      id: crypto.randomUUID(),
      fileId,
      data: versionBlob.data,
      iv: versionBlob.iv,
      createdAt: Date.now(),
    }

    await dal.add('encryptedFileBlobs', newBlob)

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
    await dal.queryCustom({
      sql: 'DELETE FROM encrypted_file_blobs WHERE file_id = ?1',
      params: [fileId],
      dexieFallback: async (db) => {
        await db.table('encryptedFileBlobs')
          .where('fileId')
          .equals(fileId)
          .delete();
      },
    })

    // Delete metadata
    await dal.delete('fileMetadata', fileId)

    // Delete shares
    await dal.queryCustom({
      sql: 'DELETE FROM file_shares WHERE file_id = ?1',
      params: [fileId],
      dexieFallback: async (db) => {
        await db.table('fileShares')
          .where('fileId')
          .equals(fileId)
          .delete();
      },
    })

    // Delete versions
    await dal.queryCustom({
      sql: 'DELETE FROM file_versions WHERE file_id = ?1',
      params: [fileId],
      dexieFallback: async (db) => {
        await db.table('fileVersions')
          .where('fileId')
          .equals(fileId)
          .delete();
      },
    })

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
    const blobs = await dal.queryCustom<EncryptedFileBlob>({
      sql: 'SELECT * FROM encrypted_file_blobs WHERE file_id = ?1 LIMIT 1',
      params: [fileId],
      dexieFallback: async (db) => {
        const result = await db.table('encryptedFileBlobs')
          .where('fileId')
          .equals(fileId)
          .first();
        return result ? [result] : [];
      },
    })
    const encryptedBlob = blobs[0]

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
    await dal.add('folders', folder)

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
    await dal.update('folders', folderId, updatedFolder)

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
    await dal.delete('folders', folderId)

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
    await dal.add('fileShares', share)

    // Update store
    useFilesStore.getState().addShare(share)

    return share
  }

  /**
   * Delete a share
   */
  async deleteShare(shareId: string): Promise<void> {
    await dal.delete('fileShares', shareId)
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

    // Epic 57: Office file preview (DOCX, XLSX, PPTX)
    if (this.isOfficeFile(file.mimeType, file.name)) {
      return {
        type: 'office',
        url: URL.createObjectURL(blob),
      }
    }

    // Epic 57: Archive preview (ZIP, TAR)
    if (file.type === 'archive' || this.isArchiveFile(file.mimeType, file.name)) {
      try {
        const contents = await this.getArchiveContents(blob, file.name)
        return {
          type: 'archive',
          archiveContents: contents,
        }
      } catch (err) {
        console.error('Failed to read archive:', err)
        return { type: 'none' }
      }
    }

    // Epic 57: 3D model preview (OBJ, STL)
    if (this.is3DModelFile(file.name)) {
      const data = new Uint8Array(await blob.arrayBuffer())
      return {
        type: '3d',
        modelData: data,
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
   * Epic 57: Check if file is an Office document
   */
  private isOfficeFile(mimeType: string, filename: string): boolean {
    const officeMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/msword', // doc
      'application/vnd.ms-excel', // xls
      'application/vnd.ms-powerpoint', // ppt
    ]

    if (officeMimeTypes.includes(mimeType)) return true

    const ext = filename.split('.').pop()?.toLowerCase()
    return ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext || '')
  }

  /**
   * Epic 57: Check if file is an archive
   */
  private isArchiveFile(mimeType: string, filename: string): boolean {
    const archiveMimeTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ]

    if (archiveMimeTypes.includes(mimeType)) return true

    const ext = filename.split('.').pop()?.toLowerCase()
    return ['zip', 'tar', 'tar.gz', 'tgz', 'gz', 'rar', '7z'].includes(ext || '')
  }

  /**
   * Epic 57: Check if file is a 3D model
   */
  private is3DModelFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['obj', 'stl', 'gltf', 'glb', 'fbx', '3ds'].includes(ext || '')
  }

  /**
   * Epic 57: Get archive contents
   */
  private async getArchiveContents(blob: Blob, filename: string): Promise<ArchiveEntry[]> {
    const entries: ArchiveEntry[] = []
    const ext = filename.split('.').pop()?.toLowerCase()

    if (ext === 'zip') {
      // Use JSZip to list contents
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(blob)

      zip.forEach((relativePath, file) => {
        // Cast to access internal properties (JSZip doesn't expose uncompressed size directly)
        const fileWithData = file as unknown as { _data?: { uncompressedSize?: number } }
        entries.push({
          name: file.name.split('/').pop() || file.name,
          path: relativePath,
          size: fileWithData._data?.uncompressedSize || 0,
          isDirectory: file.dir,
          modifiedAt: file.date,
        })
      })
    } else if (ext === 'tar' || ext === 'tgz' || ext === 'tar.gz') {
      // Parse tar archives client-side
      try {
        let tarData: Uint8Array

        // For .tgz or .tar.gz, decompress first
        if (ext === 'tgz' || filename.endsWith('.tar.gz')) {
          const pako = (await import('pako')).default
          const compressed = new Uint8Array(await blob.arrayBuffer())
          tarData = pako.ungzip(compressed)
        } else {
          tarData = new Uint8Array(await blob.arrayBuffer())
        }

        // Parse tar headers (512-byte blocks)
        let offset = 0
        while (offset < tarData.length - 512) {
          // Read filename (first 100 bytes)
          const nameBytes = tarData.slice(offset, offset + 100)
          const name = new TextDecoder().decode(nameBytes).replace(/\0+$/, '')

          if (!name) break // Empty block = end of archive

          // Read file size (octal string at offset 124, 12 bytes)
          const sizeBytes = tarData.slice(offset + 124, offset + 136)
          const sizeStr = new TextDecoder().decode(sizeBytes).replace(/\0+$/, '').trim()
          const size = parseInt(sizeStr, 8) || 0

          // Read type flag (offset 156)
          const typeFlag = tarData[offset + 156]
          const isDirectory = typeFlag === 53 // ASCII '5'

          entries.push({
            name: name.split('/').pop() || name,
            path: name,
            size,
            isDirectory,
          })

          // Skip to next header (header + file data padded to 512-byte boundary)
          offset += 512 + Math.ceil(size / 512) * 512
        }
      } catch (err) {
        console.error('Failed to parse tar:', err)
        entries.push({
          name: 'Archive (unable to read contents)',
          path: '/',
          size: blob.size,
          isDirectory: true,
        })
      }
    }

    return entries.sort((a, b) => {
      // Directories first
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.path.localeCompare(b.path)
    })
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
    const originalBlobs = await dal.queryCustom<EncryptedFileBlob>({
      sql: 'SELECT * FROM encrypted_file_blobs WHERE file_id = ?1 LIMIT 1',
      params: [fileId],
      dexieFallback: async (db) => {
        const result = await db.table('encryptedFileBlobs')
          .where('fileId')
          .equals(fileId)
          .first();
        return result ? [result] : [];
      },
    })
    const originalBlob = originalBlobs[0]

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
    await dal.add('fileMetadata', copiedFile)
    await dal.add('encryptedFileBlobs', copiedBlob)

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

    await dal.add('storageQuotas', quota)
    useFilesStore.getState().setStorageQuota(quota)

    return quota
  }

  /**
   * Load all files for a group
   */
  async loadGroupFiles(groupId: string): Promise<void> {
    const files = await dal.query<FileMetadata>('fileMetadata', {
      whereClause: { groupId },
    })

    const folders = await dal.query<Folder>('folders', {
      whereClause: { groupId },
    })

    files.forEach(file => useFilesStore.getState().addFile(file))
    folders.forEach(folder => useFilesStore.getState().addFolder(folder))
  }
}

export const fileManager = new FileManager()
