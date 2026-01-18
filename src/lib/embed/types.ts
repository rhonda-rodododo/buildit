/**
 * Shared Embed Types
 *
 * Unified type definitions for social media embeds across:
 * - TipTap document editor (SecureEmbed)
 * - Microblogging posts (PostCard)
 * - Long-form posts and other content types
 */

/**
 * Embed provider configuration
 */
export interface EmbedProvider {
  /** Unique provider identifier */
  id: string
  /** Display name (e.g., "YouTube", "Vimeo") */
  name: string
  /** Primary domain (e.g., "youtube.com") */
  domain: string
  /** Additional domains that match this provider (e.g., "youtu.be") */
  additionalDomains?: string[]
  /** Regex patterns for URL matching */
  patterns: RegExp[]
  /** How to handle this provider */
  priority: 'trusted' | 'oembed' | 'preview'
  /** Iframe sandbox attributes */
  sandbox: string[]
  /** Iframe allow attributes */
  allow: string[]
  /** Default aspect ratio (e.g., "16/9") */
  aspectRatio: string
  /** Transform URL to direct embed URL (for trusted providers) */
  getEmbedUrl?: (url: string) => string | null
}

/**
 * oEmbed response from proxy
 */
export interface OEmbedResponse {
  type: 'photo' | 'video' | 'link' | 'rich'
  version: string
  title?: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  cache_age?: number
  thumbnail_url?: string
  thumbnail_width?: number
  thumbnail_height?: number
  /** For photo type */
  url?: string
  width?: number
  height?: number
  /** For video/rich type */
  html?: string
}

/**
 * Processed embed data ready for rendering
 */
export interface EmbedData {
  /** Whether the embed was successfully processed */
  success: boolean
  /** Provider name */
  provider: string
  /** Provider ID */
  providerId: string
  /** Embed type */
  type: 'video' | 'photo' | 'rich' | 'link'
  /** Content title */
  title?: string
  /** Content author */
  author?: string
  /** Thumbnail image URL */
  thumbnail?: string
  /** Direct embed URL for iframe src */
  embedUrl?: string
  /** Sanitized HTML for srcdoc (untrusted providers) */
  embedHtml?: string
  /** Original URL */
  originalUrl: string
  /** Embed width */
  width?: number
  /** Embed height */
  height?: number
  /** Aspect ratio (e.g., "16/9") */
  aspectRatio?: string
  /** Iframe sandbox attributes */
  sandbox: string[]
  /** Iframe allow attributes */
  allow: string[]
  /** Error message if success is false */
  error?: string
}

/**
 * Hook options for useEmbed
 */
export interface UseEmbedOptions {
  /** oEmbed proxy endpoint URL */
  proxyUrl?: string
  /** Whether to load immediately (default: false for privacy) */
  autoLoad?: boolean
  /** Callback when embed data is loaded */
  onLoad?: (data: EmbedData) => void
  /** Callback when loading fails */
  onError?: (error: string) => void
}

/**
 * Hook result for useEmbed
 */
export interface UseEmbedResult {
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Processed embed data */
  embedData: EmbedData | null
  /** Detected provider (available before loading) */
  provider: EmbedProvider | null
  /** Manual load trigger */
  load: () => Promise<void>
  /** Whether embed has been loaded */
  isLoaded: boolean
  /** Whether the URL is embeddable */
  isEmbeddable: boolean
}

/**
 * EmbedCard component props
 */
export interface EmbedCardProps {
  /** URL to embed */
  url: string
  /** Additional CSS classes */
  className?: string
  /** Whether to load immediately (default: false for privacy) */
  autoLoad?: boolean
  /** Compact mode for feed view */
  compact?: boolean
  /** Callback when load button is clicked */
  onLoadClick?: () => void
  /** Callback when embed is loaded */
  onLoaded?: (data: EmbedData) => void
}

/**
 * Extracted URL from text
 */
export interface ExtractedUrl {
  /** The URL string */
  url: string
  /** Start index in the text */
  startIndex: number
  /** End index in the text */
  endIndex: number
  /** Whether this URL is embeddable */
  isEmbeddable: boolean
  /** Provider ID if embeddable */
  providerId?: string
}
