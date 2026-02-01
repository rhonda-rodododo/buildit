/**
 * Link Preview Types
 *
 * Protocol type (`LinkPreview`, `FetchedBy`) comes from the generated content module.
 * Service/hook types below are web-only implementation details.
 *
 * @module lib/linkPreview/types
 */

// Re-export protocol types from generated content module
export type { LinkPreview } from '@/generated/schemas/content'
export { FetchedBy } from '@/generated/schemas/content'

/**
 * Open Graph metadata extracted from a URL
 */
export interface OpenGraphData {
  /** og:title */
  title?: string

  /** og:description or meta description */
  description?: string

  /** og:image URL */
  imageUrl?: string

  /** og:site_name */
  siteName?: string

  /** og:type (article, website, video, etc.) */
  type?: string

  /** og:url (canonical URL) */
  canonicalUrl?: string

  /** Favicon URL */
  faviconUrl?: string
}

/**
 * Options for generating link previews
 */
export interface LinkPreviewOptions {
  /** Maximum width for thumbnail (default: 400) */
  maxWidth?: number

  /** Maximum height for thumbnail (default: 400) */
  maxHeight?: number

  /** Maximum size in bytes for the image (default: 50KB) */
  maxImageBytes?: number

  /** Timeout for fetch in milliseconds (default: 5000) */
  timeout?: number

  /** Whether to fetch favicon (default: true) */
  fetchFavicon?: boolean

  /** Image quality for JPEG compression (1-100, default: 80) */
  imageQuality?: number
}

/**
 * Result of a link preview fetch operation
 */
export interface LinkPreviewResult {
  /** Whether the fetch was successful */
  success: boolean

  /** The generated preview (if successful) */
  preview?: import('@/generated/schemas/content').LinkPreview

  /** Error message (if failed) */
  error?: string

  /** HTTP status code (if applicable) */
  statusCode?: number
}

/**
 * Cache entry for link previews
 */
export interface LinkPreviewCacheEntry {
  /** The preview data */
  preview: import('@/generated/schemas/content').LinkPreview

  /** When the cache entry was created */
  cachedAt: number

  /** Cache TTL in milliseconds */
  ttl: number
}

/**
 * State for useLinkPreview hook
 */
export interface LinkPreviewState {
  /** Whether we're currently fetching */
  loading: boolean

  /** Error message if fetch failed */
  error: string | null

  /** Generated previews (keyed by URL) */
  previews: Map<string, import('@/generated/schemas/content').LinkPreview>
}

/**
 * Hook result for useLinkPreview
 */
export interface UseLinkPreviewResult {
  /** Loading state */
  loading: boolean

  /** Error message */
  error: string | null

  /** Generated previews */
  previews: import('@/generated/schemas/content').LinkPreview[]

  /** Manually trigger preview generation for URLs */
  generatePreviews: (urls: string[]) => Promise<void>

  /** Remove a preview by URL */
  removePreview: (url: string) => void

  /** Clear all previews */
  clearPreviews: () => void
}
