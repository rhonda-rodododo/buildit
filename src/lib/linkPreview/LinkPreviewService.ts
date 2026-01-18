/**
 * Link Preview Service
 *
 * Signal-style privacy-preserving link previews.
 * Fetches Open Graph metadata and downloads thumbnails,
 * converting them to base64 for encrypted storage.
 *
 * Note: This runs on the sender's device. The image data
 * is encrypted with the post content using NIP-17.
 */

import type {
  LinkPreview,
  LinkPreviewOptions,
  LinkPreviewResult,
  OpenGraphData,
  LinkPreviewCacheEntry,
} from './types'

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
 * CORS proxy for development
 * In production, this should be a server-side function
 */
const CORS_PROXY = 'https://corsproxy.io/?'

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
 * Fetch HTML and parse Open Graph metadata
 */
async function fetchOpenGraphData(
  url: string,
  timeout: number
): Promise<OpenGraphData> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // Use CORS proxy for cross-origin requests
    const fetchUrl = `${CORS_PROXY}${encodeURIComponent(url)}`

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'BuildIt-LinkPreview/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    return parseOpenGraphFromHtml(html, url)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Parse Open Graph metadata from HTML
 */
function parseOpenGraphFromHtml(html: string, baseUrl: string): OpenGraphData {
  const data: OpenGraphData = {}

  // Create a DOM parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Extract Open Graph meta tags
  const metaTags = doc.querySelectorAll('meta')

  for (const meta of metaTags) {
    const property = meta.getAttribute('property') || meta.getAttribute('name')
    const content = meta.getAttribute('content')

    if (!property || !content) continue

    switch (property.toLowerCase()) {
      case 'og:title':
        data.title = content
        break
      case 'og:description':
        data.description = content
        break
      case 'og:image':
        data.imageUrl = resolveUrl(content, baseUrl)
        break
      case 'og:site_name':
        data.siteName = content
        break
      case 'og:type':
        data.type = content
        break
      case 'og:url':
        data.canonicalUrl = content
        break
      case 'description':
        // Fallback to meta description if no OG description
        if (!data.description) {
          data.description = content
        }
        break
    }
  }

  // Fallback to title tag if no OG title
  if (!data.title) {
    const titleTag = doc.querySelector('title')
    if (titleTag) {
      data.title = titleTag.textContent || undefined
    }
  }

  // Try to find favicon
  const faviconLinks = doc.querySelectorAll('link[rel*="icon"]')
  for (const link of faviconLinks) {
    const href = link.getAttribute('href')
    if (href) {
      data.faviconUrl = resolveUrl(href, baseUrl)
      break
    }
  }

  // Default favicon path
  if (!data.faviconUrl) {
    try {
      const parsed = new URL(baseUrl)
      data.faviconUrl = `${parsed.origin}/favicon.ico`
    } catch {
      // Ignore
    }
  }

  return data
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`
    }
    // Handle absolute URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // Handle relative URLs
    const base = new URL(baseUrl)
    return new URL(url, base).toString()
  } catch {
    return url
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
      // Use CORS proxy
      const fetchUrl = `${CORS_PROXY}${encodeURIComponent(imageUrl)}`

      const response = await fetch(fetchUrl, {
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
      const fetchUrl = `${CORS_PROXY}${encodeURIComponent(faviconUrl)}`

      const response = await fetch(fetchUrl, {
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
      fetchedBy: 'sender',
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
