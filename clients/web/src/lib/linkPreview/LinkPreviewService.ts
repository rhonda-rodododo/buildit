/**
 * Link Preview Service
 *
 * Signal-style privacy-preserving link previews.
 * Fetches Open Graph metadata and downloads thumbnails,
 * converting them to base64 for encrypted storage.
 *
 * Note: This runs on the sender's device. The image data
 * is encrypted with the post content using NIP-17.
 *
 * Uses BuildIt API Worker (Cloudflare Workers) endpoints:
 * - /api/link-preview - Fetches Open Graph metadata
 * - /api/image-proxy - Proxies image fetches for CORS
 */

import type {
  LinkPreview,
  LinkPreviewOptions,
  LinkPreviewResult,
  OpenGraphData,
  LinkPreviewCacheEntry,
} from './types'
import { FetchedBy } from './types'

// Default options
const DEFAULT_OPTIONS: Required<LinkPreviewOptions> = {
  maxWidth: 400,
  maxHeight: 400,
  maxImageBytes: 50 * 1024, // 50KB
  timeout: 5000, // 5 seconds
  fetchFavicon: true,
  imageQuality: 80,
}

// In-memory cache for previews (15 minute TTL)
const previewCache = new Map<string, LinkPreviewCacheEntry>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Get base URL for API calls
 * Points to the BuildIt API Worker (shared across all platforms)
 */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'https://api.buildit.network'
}

/**
 * Check if URL is HTTPS (we only fetch secure URLs)
 */
function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Normalize URL for caching
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove tracking params
    const cleanParams = new URLSearchParams()
    for (const [key, value] of parsed.searchParams) {
      // Skip common tracking params
      if (!['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'].includes(key.toLowerCase())) {
        cleanParams.set(key, value)
      }
    }
    parsed.search = cleanParams.toString()
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Get from cache if valid
 */
function getFromCache(url: string): LinkPreview | null {
  const normalized = normalizeUrl(url)
  const entry = previewCache.get(normalized)

  if (entry && Date.now() - entry.cachedAt < entry.ttl) {
    return entry.preview
  }

  // Remove stale entry
  if (entry) {
    previewCache.delete(normalized)
  }

  return null
}

/**
 * Store in cache
 */
function storeInCache(url: string, preview: LinkPreview): void {
  const normalized = normalizeUrl(url)
  previewCache.set(normalized, {
    preview,
    cachedAt: Date.now(),
    ttl: CACHE_TTL,
  })

  // Clean up old entries (keep max 100)
  if (previewCache.size > 100) {
    const oldestKey = previewCache.keys().next().value
    if (oldestKey) {
      previewCache.delete(oldestKey)
    }
  }
}

/**
 * Fetch Open Graph metadata via our API
 */
async function fetchOpenGraphData(
  url: string,
  timeout: number
): Promise<OpenGraphData> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // Use our Cloudflare Pages Function
    const apiUrl = `${getApiBaseUrl()}/api/link-preview?url=${encodeURIComponent(url)}`

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json() as {
      success: boolean
      data?: {
        url: string
        title?: string
        description?: string
        imageUrl?: string
        siteName?: string
        faviconUrl?: string
      }
      error?: string
    }

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch preview')
    }

    return {
      title: result.data.title,
      description: result.data.description,
      imageUrl: result.data.imageUrl,
      siteName: result.data.siteName,
      faviconUrl: result.data.faviconUrl,
      canonicalUrl: result.data.url,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}


/**
 * Fetch and compress an image to base64
 */
async function fetchAndCompressImage(
  imageUrl: string,
  options: Required<LinkPreviewOptions>
): Promise<{ data: string; type: string; width: number; height: number } | null> {
  try {
    // Skip non-HTTPS images
    if (!isSecureUrl(imageUrl)) {
      return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    try {
      // Use our image proxy API
      const apiUrl = `${getApiBaseUrl()}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`

      const response = await fetch(apiUrl, {
        signal: controller.signal,
      })

      if (!response.ok) {
        return null
      }

      const blob = await response.blob()

      // Check if it's an image
      if (!blob.type.startsWith('image/')) {
        return null
      }

      // Load into canvas for resizing
      const imageBitmap = await createImageBitmap(blob)

      // Calculate dimensions
      let width = imageBitmap.width
      let height = imageBitmap.height

      // Scale down if needed
      if (width > options.maxWidth || height > options.maxHeight) {
        const widthRatio = options.maxWidth / width
        const heightRatio = options.maxHeight / height
        const ratio = Math.min(widthRatio, heightRatio)

        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // Draw to canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return null
      }

      ctx.drawImage(imageBitmap, 0, 0, width, height)

      // Convert to base64 JPEG with quality compression
      let quality = options.imageQuality / 100
      let dataUrl = canvas.toDataURL('image/jpeg', quality)

      // If still too large, reduce quality
      while (dataUrl.length > options.maxImageBytes * 1.37 && quality > 0.3) { // 1.37 is base64 overhead
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      // Extract base64 data without the prefix
      const base64Data = dataUrl.split(',')[1]

      return {
        data: base64Data,
        type: 'image/jpeg',
        width,
        height,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch {
    return null
  }
}

/**
 * Fetch favicon and convert to base64
 */
async function fetchFavicon(
  faviconUrl: string,
  timeout: number
): Promise<{ data: string; type: string } | null> {
  try {
    if (!isSecureUrl(faviconUrl)) {
      return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Use our image proxy API
      const apiUrl = `${getApiBaseUrl()}/api/image-proxy?url=${encodeURIComponent(faviconUrl)}`

      const response = await fetch(apiUrl, {
        signal: controller.signal,
      })

      if (!response.ok) {
        return null
      }

      const blob = await response.blob()

      // Check if it's an image and not too large (max 10KB for favicon)
      if (!blob.type.startsWith('image/') || blob.size > 10 * 1024) {
        return null
      }

      // Convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve({
            data: base64Data,
            type: blob.type,
          })
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch {
    return null
  }
}

/**
 * Generate a link preview for a URL
 */
export async function generatePreview(
  url: string,
  options: LinkPreviewOptions = {}
): Promise<LinkPreviewResult> {
  const opts: Required<LinkPreviewOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  // Validate URL
  if (!isSecureUrl(url)) {
    return {
      success: false,
      error: 'Only HTTPS URLs are supported for security',
    }
  }

  // Check cache
  const cached = getFromCache(url)
  if (cached) {
    return {
      success: true,
      preview: cached,
    }
  }

  try {
    // Fetch Open Graph metadata
    const ogData = await fetchOpenGraphData(url, opts.timeout)

    // Build preview
    const preview: LinkPreview = {
      url,
      title: ogData.title,
      description: ogData.description?.slice(0, 300), // Limit description length
      siteName: ogData.siteName,
      fetchedAt: Date.now(),
      fetchedBy: FetchedBy.Sender,
    }

    // Fetch and compress thumbnail if available
    if (ogData.imageUrl) {
      const imageResult = await fetchAndCompressImage(ogData.imageUrl, opts)
      if (imageResult) {
        preview.imageData = imageResult.data
        preview.imageType = imageResult.type
        preview.imageWidth = imageResult.width
        preview.imageHeight = imageResult.height
      }
    }

    // Fetch favicon if enabled
    if (opts.fetchFavicon && ogData.faviconUrl) {
      const faviconResult = await fetchFavicon(ogData.faviconUrl, opts.timeout)
      if (faviconResult) {
        preview.faviconData = faviconResult.data
        preview.faviconType = faviconResult.type
      }
    }

    // Store in cache
    storeInCache(url, preview)

    return {
      success: true,
      preview,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch preview'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Generate previews for multiple URLs
 */
export async function generatePreviews(
  urls: string[],
  options: LinkPreviewOptions = {}
): Promise<LinkPreview[]> {
  // Filter to unique HTTPS URLs
  const uniqueUrls = [...new Set(urls.filter(isSecureUrl))]

  // Limit to first 3 URLs for performance
  const limitedUrls = uniqueUrls.slice(0, 3)

  // Generate previews in parallel
  const results = await Promise.all(
    limitedUrls.map((url) => generatePreview(url, options))
  )

  // Return successful previews
  return results
    .filter((r) => r.success && r.preview)
    .map((r) => r.preview!)
}

/**
 * Clear the preview cache
 */
export function clearPreviewCache(): void {
  previewCache.clear()
}

/**
 * Get the size of the preview cache
 */
export function getPreviewCacheSize(): number {
  return previewCache.size
}

/**
 * Calculate approximate size of a preview in bytes
 */
export function calculatePreviewSize(preview: LinkPreview): number {
  let size = 0

  // Text fields (approximate UTF-8 encoding)
  size += (preview.url?.length || 0) * 2
  size += (preview.title?.length || 0) * 2
  size += (preview.description?.length || 0) * 2
  size += (preview.siteName?.length || 0) * 2

  // Base64 image data (actual bytes = base64 length * 0.75)
  if (preview.imageData) {
    size += Math.ceil(preview.imageData.length * 0.75)
  }
  if (preview.faviconData) {
    size += Math.ceil(preview.faviconData.length * 0.75)
  }

  // Metadata
  size += 50 // timestamps, types, dimensions

  return size
}

export default {
  generatePreview,
  generatePreviews,
  clearPreviewCache,
  getPreviewCacheSize,
  calculatePreviewSize,
}
