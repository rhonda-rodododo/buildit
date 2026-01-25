/**
 * Link Preview Infrastructure
 *
 * Signal-style privacy-preserving link previews.
 *
 * Key Features:
 * - Sender fetches Open Graph metadata when composing
 * - Preview (title, image) encrypted into post with NIP-17
 * - Recipients see static preview without third-party requests
 * - Maintains zero-knowledge E2EE pattern
 *
 * @module lib/linkPreview
 */

// Types
export type {
  LinkPreview,
  LinkPreviewOptions,
  LinkPreviewResult,
  OpenGraphData,
  LinkPreviewCacheEntry,
  LinkPreviewState,
  UseLinkPreviewResult,
} from './types'

// Service
export {
  generatePreview,
  generatePreviews,
  clearPreviewCache,
  getPreviewCacheSize,
  calculatePreviewSize,
  default as LinkPreviewService,
} from './LinkPreviewService'

// Hooks
export {
  useLinkPreview,
  useLinkPreviewFromText,
  useSingleLinkPreview,
  default as useLinkPreviewDefault,
} from './useLinkPreview'

// Components
export {
  LinkPreviewCard,
  LinkPreviewCardCompact,
  LinkPreviewSkeleton,
  default as LinkPreviewCardDefault,
} from './LinkPreviewCard'
