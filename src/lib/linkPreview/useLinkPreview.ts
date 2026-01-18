/**
 * useLinkPreview Hook
 *
 * React hook for generating link previews in the PostComposer.
 * Provides debounced URL detection and preview generation.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { LinkPreview, UseLinkPreviewResult, LinkPreviewOptions } from './types'
import { generatePreview, generatePreviews } from './LinkPreviewService'

/**
 * URL regex for detecting URLs in text
 * Matches http/https URLs with various TLDs and paths
 */
const URL_REGEX = /https?:\/\/(?:[-\w@:%.+~#=]+\.)+[a-z]{2,}(?:\/[-\w@:%+.~#?&/=]*)?/gi

/**
 * Extract URLs from text content
 */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || []
  // Filter to unique URLs
  return [...new Set(matches)]
}

/**
 * Hook options
 */
interface UseLinkPreviewOptions extends LinkPreviewOptions {
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number

  /** Maximum number of previews to generate (default: 3) */
  maxPreviews?: number

  /** Automatically generate previews when URLs are detected (default: true) */
  autoGenerate?: boolean

  /** Callback when preview generation starts */
  onGenerateStart?: () => void

  /** Callback when preview generation completes */
  onGenerateComplete?: (previews: LinkPreview[]) => void

  /** Callback when preview generation fails */
  onGenerateError?: (error: string) => void
}

const DEFAULT_HOOK_OPTIONS: Required<Omit<UseLinkPreviewOptions, keyof LinkPreviewOptions>> = {
  debounceMs: 500,
  maxPreviews: 3,
  autoGenerate: true,
  onGenerateStart: () => {},
  onGenerateComplete: () => {},
  onGenerateError: () => {},
}

/**
 * Hook for generating link previews from text content
 *
 * @example
 * ```tsx
 * const { loading, previews, generatePreviews, removePreview } = useLinkPreview()
 *
 * // In PostComposer:
 * useEffect(() => {
 *   const urls = extractUrlsFromText(content)
 *   if (urls.length > 0) {
 *     generatePreviews(urls)
 *   }
 * }, [content])
 * ```
 */
export function useLinkPreview(
  options: UseLinkPreviewOptions = {}
): UseLinkPreviewResult {
  const opts = {
    ...DEFAULT_HOOK_OPTIONS,
    ...options,
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewMap, setPreviewMap] = useState<Map<string, LinkPreview>>(new Map())

  // Track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Generate previews for URLs
  const generatePreviewsForUrls = useCallback(
    async (urls: string[]) => {
      // Cancel any pending generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Skip if no URLs
      if (urls.length === 0) {
        return
      }

      // Limit to max previews
      const limitedUrls = urls.slice(0, opts.maxPreviews)

      // Skip URLs we already have previews for
      const newUrls = limitedUrls.filter((url) => !previewMap.has(url))

      if (newUrls.length === 0) {
        return
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      setLoading(true)
      setError(null)
      opts.onGenerateStart?.()

      try {
        // Generate previews
        const newPreviews = await generatePreviews(newUrls, {
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          maxImageBytes: options.maxImageBytes,
          timeout: options.timeout,
          fetchFavicon: options.fetchFavicon,
          imageQuality: options.imageQuality,
        })

        // Update preview map
        setPreviewMap((prev) => {
          const next = new Map(prev)
          for (const preview of newPreviews) {
            next.set(preview.url, preview)
          }
          return next
        })

        opts.onGenerateComplete?.(newPreviews)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate previews'
        setError(message)
        opts.onGenerateError?.(message)
      } finally {
        setLoading(false)
        abortControllerRef.current = null
      }
    },
    [previewMap, opts, options]
  )

  // Remove a preview by URL
  const removePreview = useCallback((url: string) => {
    setPreviewMap((prev) => {
      const next = new Map(prev)
      next.delete(url)
      return next
    })
  }, [])

  // Clear all previews
  const clearPreviews = useCallback(() => {
    setPreviewMap(new Map())
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Convert map to array
  const previews = Array.from(previewMap.values())

  return {
    loading,
    error,
    previews,
    generatePreviews: generatePreviewsForUrls,
    removePreview,
    clearPreviews,
  }
}

/**
 * Hook for auto-detecting URLs in text and generating previews
 *
 * @example
 * ```tsx
 * const [content, setContent] = useState('')
 * const { loading, previews, removePreview } = useLinkPreviewFromText(content)
 * ```
 */
export function useLinkPreviewFromText(
  text: string,
  options: UseLinkPreviewOptions = {}
): UseLinkPreviewResult {
  const opts = {
    ...DEFAULT_HOOK_OPTIONS,
    ...options,
  }

  const {
    loading,
    error,
    previews,
    generatePreviews: generatePreviewsForUrls,
    removePreview,
    clearPreviews,
  } = useLinkPreview(options)

  // Track previously seen URLs to avoid re-fetching
  const previousUrlsRef = useRef<Set<string>>(new Set())
  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect URLs and generate previews with debounce
  useEffect(() => {
    if (!opts.autoGenerate) {
      return
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce
    debounceTimerRef.current = setTimeout(() => {
      const urls = extractUrls(text)

      // Check for new URLs
      const newUrls = urls.filter((url) => !previousUrlsRef.current.has(url))

      if (newUrls.length > 0) {
        // Add to seen URLs
        for (const url of newUrls) {
          previousUrlsRef.current.add(url)
        }

        // Generate previews for new URLs
        generatePreviewsForUrls(newUrls)
      }
    }, opts.debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [text, opts.autoGenerate, opts.debounceMs, generatePreviewsForUrls])

  // Extended clearPreviews that also clears the URL tracking
  const clearPreviewsAndTracking = useCallback(() => {
    clearPreviews()
    previousUrlsRef.current.clear()
  }, [clearPreviews])

  return {
    loading,
    error,
    previews,
    generatePreviews: generatePreviewsForUrls,
    removePreview,
    clearPreviews: clearPreviewsAndTracking,
  }
}

/**
 * Hook to generate a single preview
 *
 * @example
 * ```tsx
 * const { loading, preview, generate } = useSingleLinkPreview()
 * await generate('https://example.com')
 * ```
 */
export function useSingleLinkPreview(
  options: LinkPreviewOptions = {}
): {
  loading: boolean
  error: string | null
  preview: LinkPreview | null
  generate: (url: string) => Promise<LinkPreview | null>
  clear: () => void
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<LinkPreview | null>(null)

  const generate = useCallback(
    async (url: string): Promise<LinkPreview | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await generatePreview(url, options)

        if (result.success && result.preview) {
          setPreview(result.preview)
          return result.preview
        } else {
          setError(result.error || 'Failed to generate preview')
          return null
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate preview'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [options]
  )

  const clear = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  return {
    loading,
    error,
    preview,
    generate,
    clear,
  }
}

export default useLinkPreview
