/**
 * File Analytics Service
 * Epic 57: Storage analytics, activity tracking, and duplicate detection
 * Epic 78: PDF text extraction for search indexing
 */

import { dal } from '@/core/storage/dal'
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

    await dal.add('fileActivityLogs', log)
  }

  /**
   * Get recent activity for a group
   */
  async getRecentActivity(groupId: string, limit: number = 50): Promise<FileActivityLog[]> {
    try {
      const logs = await dal.query<FileActivityLog>('fileActivityLogs', {
        whereClause: { groupId },
        orderBy: 'timestamp',
        orderDir: 'desc',
        limit,
      })

      return logs
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
        content = await extractPdfText(blob)
      }

      // Store content index (truncate for storage efficiency)
      if (content) {
        const truncatedContent = content.substring(0, 100000) // Max 100KB of text

        // Check if index already exists
        const existingResults = await dal.query<{ id: string; fileId: string; content: string }>('fileContentIndex', {
          whereClause: { fileId },
          limit: 1,
        })
        const existing = existingResults[0]

        if (existing) {
          await dal.update('fileContentIndex', existing.id, {
            content: truncatedContent.toLowerCase(),
          })
        } else {
          await dal.add('fileContentIndex', {
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
      const existingResults = await dal.query<{ id: string; fileId: string; hash: string }>('fileHashes', {
        whereClause: { fileId },
        limit: 1,
      })
      const existing = existingResults[0]

      if (existing) {
        await dal.update('fileHashes', existing.id, { hash })
      } else {
        await dal.add('fileHashes', {
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
      const hashes = await dal.query<{ fileId: string; hash: string }>('fileHashes', {
        whereClause: { groupId },
      })

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
      const indexes = await dal.query<{ fileId: string; content: string }>('fileContentIndex', {
        whereClause: { groupId },
      })

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

    await dal.add('savedSearchFilters', savedFilter)
    return savedFilter
  }

  /**
   * Get saved search filters for a group
   */
  async getSavedFilters(groupId: string): Promise<SavedSearchFilter[]> {
    try {
      return await dal.query<SavedSearchFilter>('savedSearchFilters', {
        whereClause: { groupId },
      })
    } catch {
      return []
    }
  }

  /**
   * Delete a saved search filter
   */
  async deleteSavedFilter(filterId: string): Promise<void> {
    await dal.delete('savedSearchFilters', filterId)
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
    const existingResults = await dal.query<RecentSearch>('recentSearches', {
      whereClause: { groupId },
    })
    const existing = existingResults.find(s => s.query === query.trim())

    if (existing) {
      // Update timestamp
      await dal.update('recentSearches', existing.id, { timestamp: Date.now() })
    } else {
      await dal.add('recentSearches', recentSearch)
    }

    // Keep only last 20 recent searches
    const allRecent = await dal.query<RecentSearch>('recentSearches', {
      whereClause: { groupId },
      orderBy: 'timestamp',
      orderDir: 'desc',
    })

    if (allRecent.length > 20) {
      const toDelete = allRecent.slice(20)
      await Promise.all(toDelete.map(s => dal.delete('recentSearches', s.id)))
    }
  }

  /**
   * Get recent searches for a group
   */
  async getRecentSearches(groupId: string, limit: number = 10): Promise<RecentSearch[]> {
    try {
      return await dal.query<RecentSearch>('recentSearches', {
        whereClause: { groupId },
        orderBy: 'timestamp',
        orderDir: 'desc',
        limit,
      })
    } catch {
      return []
    }
  }

  /**
   * Clear recent searches for a group
   */
  async clearRecentSearches(groupId: string): Promise<void> {
    const searches = await dal.query<RecentSearch>('recentSearches', {
      whereClause: { groupId },
    })

    await Promise.all(searches.map(s => dal.delete('recentSearches', s.id)))
  }
}

/**
 * Extract text from a PDF file using pdf.js
 * Epic 78: PDF text extraction for full-text search indexing
 *
 * Uses the worker-less build of pdf.js to avoid worker configuration complexity.
 * Handles encrypted PDFs gracefully by returning empty string with a warning.
 */
async function extractPdfText(blob: Blob): Promise<string> {
  try {
    // Dynamic import to keep initial bundle size small
    const pdfjsLib = await import('pdfjs-dist')

    // Use fake worker to avoid needing to configure worker path
    // This runs pdf.js in the main thread which is acceptable for indexing
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const arrayBuffer = await blob.arrayBuffer()
    const typedArray = new Uint8Array(arrayBuffer)

    let pdf: import('pdfjs-dist').PDFDocumentProxy
    try {
      pdf = await pdfjsLib.getDocument({
        data: typedArray,
        // Disable worker to avoid configuration issues
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise
    } catch (loadError) {
      // Check if PDF is password-protected/encrypted
      const errorMessage = loadError instanceof Error ? loadError.message : String(loadError)
      if (
        errorMessage.includes('password') ||
        errorMessage.includes('encrypted') ||
        errorMessage.includes('PasswordRequired')
      ) {
        console.warn('PDF is encrypted/password-protected, skipping text extraction')
        return ''
      }
      throw loadError
    }

    const textParts: string[] = []
    const pageCount = pdf.numPages

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => {
            if ('str' in item) {
              return item.str
            }
            return ''
          })
          .join(' ')

        if (pageText.trim()) {
          textParts.push(pageText.trim())
        }
      } catch (pageError) {
        console.warn(`Failed to extract text from PDF page ${pageNum}:`, pageError)
        // Continue with other pages
      }
    }

    // Clean up
    await pdf.destroy()

    return textParts.join('\n\n')
  } catch (err) {
    console.error('Failed to extract PDF text:', err)
    return ''
  }
}

/**
 * Generate a thumbnail image from the first page of a PDF
 * Epic 78: PDF thumbnail generation for file previews
 *
 * Renders the first page of the PDF to a canvas and returns it as a Blob.
 * Returns null if thumbnail generation fails.
 */
async function generatePdfThumbnailBlob(
  blob: Blob,
  width: number = 400,
  height: number = 560
): Promise<Blob | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const arrayBuffer = await blob.arrayBuffer()
    const typedArray = new Uint8Array(arrayBuffer)

    let pdf: import('pdfjs-dist').PDFDocumentProxy
    try {
      pdf = await pdfjsLib.getDocument({
        data: typedArray,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise
    } catch (loadError) {
      const errorMessage = loadError instanceof Error ? loadError.message : String(loadError)
      if (
        errorMessage.includes('password') ||
        errorMessage.includes('encrypted') ||
        errorMessage.includes('PasswordRequired')
      ) {
        console.warn('PDF is encrypted, cannot generate thumbnail')
        return null
      }
      throw loadError
    }

    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.0 })

    // Calculate scale to fit within the target dimensions
    const scale = Math.min(width / viewport.width, height / viewport.height)
    const scaledViewport = page.getViewport({ scale })

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(scaledViewport.width)
    canvas.height = Math.floor(scaledViewport.height)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      await pdf.destroy()
      return null
    }

    // Render the page (pdfjs-dist v5 requires canvas parameter)
    await page.render({
      canvas,
      viewport: scaledViewport,
    }).promise

    // Convert to blob
    const thumbnailBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        'image/jpeg',
        0.8
      )
    })

    await pdf.destroy()
    return thumbnailBlob
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err)
    return null
  }
}

/**
 * Public API for PDF text extraction
 * Can be used by other modules that need to extract text from PDFs
 */
export async function extractTextFromPdf(blob: Blob): Promise<string> {
  return extractPdfText(blob)
}

/**
 * Public API for PDF thumbnail generation
 * Returns an object URL to the thumbnail, or null on failure
 */
export async function generatePdfThumbnail(
  blob: Blob,
  width?: number,
  height?: number
): Promise<string | null> {
  const thumbnailBlob = await generatePdfThumbnailBlob(blob, width, height)
  if (!thumbnailBlob) return null
  return URL.createObjectURL(thumbnailBlob)
}

export const fileAnalytics = new FileAnalyticsService()
