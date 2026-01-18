/**
 * Shared Embed Infrastructure
 *
 * Unified, privacy-respecting embed system for:
 * - TipTap document editor (SecureEmbed extension)
 * - Microblogging posts (PostCard)
 * - Long-form posts and other content types
 *
 * Key Features:
 * - Click-to-load pattern for privacy (no third-party requests until user clicks)
 * - Trusted provider allowlist with security configurations
 * - Privacy-enhanced URLs (youtube-nocookie.com, Vimeo dnt=1)
 * - Sandboxed iframes with restrictive permissions
 * - Shared utilities for URL detection and processing
 *
 * @module lib/embed
 */

// Types
export type {
  EmbedProvider,
  OEmbedResponse,
  EmbedData,
  UseEmbedOptions,
  UseEmbedResult,
  EmbedCardProps,
  ExtractedUrl,
} from './types'

// Providers
export {
  EMBED_PROVIDERS,
  getProviders,
  getProviderById,
  getProviderByDomain,
  getSupportedProviderNames,
  getSupportedDomains,
  youtubeProvider,
  vimeoProvider,
  peertubeProvider,
  soundcloudProvider,
  spotifyProvider,
  mastodonProvider,
  codepenProvider,
  codesandboxProvider,
} from './providers'

// Utilities
export {
  extractDomain,
  getBaseDomain,
  detectProvider,
  isEmbeddableUrl,
  extractUrlsFromText,
  getFirstEmbeddableUrl,
  calculateAspectRatio,
  enhanceEmbedUrl,
  sanitizeEmbedHtml,
  extractIframeSrc,
  getEmbedUrl,
  requiresOembed,
  formatEmbedUrlForDisplay,
} from './utils'

// Hooks
export { useEmbed, useEmbedCheck, useEmbedCheckBatch } from './useEmbed'

// Components
export { EmbedCard, EmbedCardCompact, default as EmbedCardDefault } from './EmbedCard'
