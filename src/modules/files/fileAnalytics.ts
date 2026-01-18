/**
 * File Analytics Service
 * Epic 57: Storage analytics, activity tracking, and duplicate detection
 */

import { db } from '@/core/storage/db'
import { useFilesStore } from './filesStore'
import type {
  FileAnalytics,
  FileActivityLog,
  DuplicateFileGroup,
  SavedSearchFilter,
  RecentSearch,
  FileType,
} from './types'

class FileAnalyticsService {
  /**
   * Get storage analytics for a group
   */
  async getAnalytics(groupId: string): Promise<FileAnalytics> {
    const { files, shares } = useFilesStore.getState()

    // Get all files for this group
    const groupFiles = Array.from(files.values()).filter(f => f.groupId === groupId)

    // Calculate totals
    const totalFiles = groupFiles.length
    const totalSize = groupFiles.reduce((sum, f) => sum + f.size, 0)

    // Storage by type
    const storageByType: Record<FileType, { count: number; size: number }> = {
      image: { count: 0, size: 0 },
      document: { count: 0, size: 0 },
      video: { count: 0, size: 0 },
      audio: { count: 0, size: 0 },
      archive: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
    }

    groupFiles.forEach(file => {
      storageByType[file.type].count++
      storageByType[file.type].size += file.size
    })

    // Get shared files count
    const groupShares = Array.from(shares.values()).filter(s => s.groupId === groupId)
    const sharedFileIds = new Set(groupShares.map(s => s.fileId))
    const sharedFilesCount = sharedFileIds.size

    // Get most accessed files (from shares)
    const accessCounts = new Map<string, number>()
    groupShares.forEach(share => {
      const current = accessCounts.get(share.fileId) || 0
      accessCounts.set(share.fileId, current + share.accessCount)
    })

    const mostAccessedFiles = Array.from(accessCounts.entries())
      .map(([fileId, accessCount]) => ({ fileId, accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)

    // Get recent activity
    const recentActivity = await this.getRecentActivity(groupId, 20)

    // Get duplicates
    const duplicates = await this.detectDuplicates(groupId)

    return {
      groupId,
      totalFiles,
      totalSize,
      storageByType,
      mostAccessedFiles,
      sharedFilesCount,
      recentActivity,
      duplicates,
    }
  }

  /**
   * Log file activity
   */
  async logActivity(
    groupId: string,
    fileId: string,
    fileName: string,
    action: FileActivityLog['action'],
    userPubkey: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const log: FileActivityLog = {
      id: crypto.randomUUID(),
      groupId,
      fileId,
      fileName,
      action,
      userPubkey,
      timestamp: Date.now(),
      metadata,
    }

    await db.table('fileActivityLogs').add(log)
  }

  /**
   * Get recent activity for a group
   */
  async getRecentActivity(groupId: string, limit: number = 50): Promise<FileActivityLog[]> {
    try {
      const logs = await db.table('fileActivityLogs')
        .where('groupId')
        .equals(groupId)
        .reverse()
        .sortBy('timestamp') as FileActivityLog[]

      return logs.slice(0, limit)
    } catch {
      return []
    }
  }

  /**
   * Compute file hash for duplicate detection
   */
  private async computeFileHash(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Index a file's content for full-text search
   */
  async indexFileContent(fileId: string, groupId: string, blob: Blob, mimeType: string): Promise<void> {
    let content = ''

    try {
      // Extract text content based on file type
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        content = await blob.text()
      } else if (mimeType === 'application/pdf') {
        // For PDFs, we'd need pdf.js - for now, store empty
        // TODO: Add PDF text extraction with pdf.js
        content = ''
      }

      // Store content index (truncate for storage efficiency)
      if (content) {
        const truncatedContent = content.substring(0, 100000) // Max 100KB of text

        // Check if index already exists
        const existing = await db.table('fileContentIndex')
          .where('fileId')
          .equals(fileId)
          .first()

        if (existing) {
          await db.table('fileContentIndex').update(existing.id, {
            content: truncatedContent.toLowerCase(),
          })
        } else {
          await db.table('fileContentIndex').add({
            id: crypto.randomUUID(),
            fileId,
            groupId,
            content: truncatedContent.toLowerCase(),
          })
        }
      }
    } catch (err) {
      console.error('Failed to index file content:', err)
    }
  }

  /**
   * Store file hash for duplicate detection
   */
  async storeFileHash(fileId: string, groupId: string, blob: Blob): Promise<void> {
    try {
      const hash = await this.computeFileHash(blob)

      // Check if hash record exists
      const existing = await db.table('fileHashes')
        .where('fileId')
        .equals(fileId)
        .first()

      if (existing) {
        await db.table('fileHashes').update(existing.id, { hash })
      } else {
        await db.table('fileHashes').add({
          id: crypto.randomUUID(),
          fileId,
          groupId,
          hash,
        })
      }
    } catch (err) {
      console.error('Failed to store file hash:', err)
    }
  }

  /**
   * Detect duplicate files in a group
   */
  async detectDuplicates(groupId: string): Promise<DuplicateFileGroup[]> {
    try {
      const hashes = await db.table('fileHashes')
        .where('groupId')
        .equals(groupId)
        .toArray() as { fileId: string; hash: string }[]

      // Group by hash
      const hashGroups = new Map<string, string[]>()
      hashes.forEach(h => {
        const files = hashGroups.get(h.hash) || []
        files.push(h.fileId)
        hashGroups.set(h.hash, files)
      })

      // Find duplicates (more than one file with same hash)
      const duplicates: DuplicateFileGroup[] = []
      const { files, folders } = useFilesStore.getState()

      for (const [hash, fileIds] of hashGroups.entries()) {
        if (fileIds.length > 1) {
          const fileDetails = fileIds.map(id => {
            const file = files.get(id)
            if (!file) return null

            // Build path
            let path = file.name
            let currentFolderId = file.folderId
            while (currentFolderId) {
              const folder = folders.get(currentFolderId)
              if (folder) {
                path = `${folder.name}/${path}`
                currentFolderId = folder.parentId
              } else {
                break
              }
            }

            return {
              id,
              name: file.name,
              path,
              size: file.size,
              createdAt: file.createdAt,
            }
          }).filter((f): f is NonNullable<typeof f> => f !== null)

          if (fileDetails.length > 1) {
            duplicates.push({ hash, files: fileDetails })
          }
        }
      }

      return duplicates
    } catch (err) {
      console.error('Failed to detect duplicates:', err)
      return []
    }
  }

  /**
   * Full-text search in file contents
   */
  async searchFileContents(groupId: string, query: string): Promise<string[]> {
    if (!query.trim()) return []

    try {
      const normalizedQuery = query.toLowerCase()
      const indexes = await db.table('fileContentIndex')
        .where('groupId')
        .equals(groupId)
        .toArray() as { fileId: string; content: string }[]

      // Simple contains search (could be improved with fuzzy matching)
      const matchingFileIds = indexes
        .filter(idx => idx.content.includes(normalizedQuery))
        .map(idx => idx.fileId)

      return matchingFileIds
    } catch (err) {
      console.error('Failed to search file contents:', err)
      return []
    }
  }

  /**
   * Save a search filter
   */
  async saveSearchFilter(filter: Omit<SavedSearchFilter, 'id' | 'createdAt'>): Promise<SavedSearchFilter> {
    const savedFilter: SavedSearchFilter = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...filter,
    }

    await db.table('savedSearchFilters').add(savedFilter)
    return savedFilter
  }

  /**
   * Get saved search filters for a group
   */
  async getSavedFilters(groupId: string): Promise<SavedSearchFilter[]> {
    try {
      return await db.table('savedSearchFilters')
        .where('groupId')
        .equals(groupId)
        .toArray() as SavedSearchFilter[]
    } catch {
      return []
    }
  }

  /**
   * Delete a saved search filter
   */
  async deleteSavedFilter(filterId: string): Promise<void> {
    await db.table('savedSearchFilters').delete(filterId)
  }

  /**
   * Add a recent search
   */
  async addRecentSearch(groupId: string, query: string): Promise<void> {
    if (!query.trim()) return

    const recentSearch: RecentSearch = {
      id: crypto.randomUUID(),
      groupId,
      query: query.trim(),
      timestamp: Date.now(),
    }

    // Check for duplicate recent search
    const existing = await db.table('recentSearches')
      .where('groupId')
      .equals(groupId)
      .filter(s => s.query === query.trim())
      .first()

    if (existing) {
      // Update timestamp
      await db.table('recentSearches').update(existing.id, { timestamp: Date.now() })
    } else {
      await db.table('recentSearches').add(recentSearch)
    }

    // Keep only last 20 recent searches
    const allRecent = await db.table('recentSearches')
      .where('groupId')
      .equals(groupId)
      .reverse()
      .sortBy('timestamp') as RecentSearch[]

    if (allRecent.length > 20) {
      const toDelete = allRecent.slice(20)
      await Promise.all(toDelete.map(s => db.table('recentSearches').delete(s.id)))
    }
  }

  /**
   * Get recent searches for a group
   */
  async getRecentSearches(groupId: string, limit: number = 10): Promise<RecentSearch[]> {
    try {
      const searches = await db.table('recentSearches')
        .where('groupId')
        .equals(groupId)
        .reverse()
        .sortBy('timestamp') as RecentSearch[]

      return searches.slice(0, limit)
    } catch {
      return []
    }
  }

  /**
   * Clear recent searches for a group
   */
  async clearRecentSearches(groupId: string): Promise<void> {
    const searches = await db.table('recentSearches')
      .where('groupId')
      .equals(groupId)
      .toArray()

    await Promise.all(searches.map(s => db.table('recentSearches').delete(s.id)))
  }
}

export const fileAnalytics = new FileAnalyticsService()
