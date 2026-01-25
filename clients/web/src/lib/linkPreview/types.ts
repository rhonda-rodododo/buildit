/**
 * Link Preview Types
 *
 * Types for Signal-style encrypted link previews.
 * Sender fetches Open Graph metadata, encrypts it into the post,
 * and recipients view static previews without third-party requests.
 */

/**
 * Link preview data structure
 * Encrypted with the post content using NIP-17
 */
export interface LinkPreview {
  /** Original URL */
  url: string

  /** Open Graph og:title */
  title?: string

  /** Open Graph og:description */
  description?: string

  /** Open Graph og:site_name */
  siteName?: string

  /** Base64-encoded thumbnail image data (stored encrypted with post) */
  imageData?: string

  /** MIME type of the image (image/jpeg, image/png, image/webp) */
  imageType?: string

  /** Image width in pixels */
  imageWidth?: number

  /** Image height in pixels */
  imageHeight?: number

  /** Favicon data as base64 (optional, small) */
  faviconData?: string

  /** Favicon MIME type */
  faviconType?: string

  /** Timestamp when preview was generated */
  fetchedAt: number

  /** Who fetched the preview */
  fetchedBy: 'sender' | 'proxy'
}

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
  preview?: LinkPreview

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
  preview: LinkPreview

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
  previews: Map<string, LinkPreview>
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
  previews: LinkPreview[]

  /** Manually trigger preview generation for URLs */
  generatePreviews: (urls: string[]) => Promise<void>

  /** Remove a preview by URL */
  removePreview: (url: string) => void

  /** Clear all previews */
  clearPreviews: () => void
}
