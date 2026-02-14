/**
 * useEmbed Hook
 *
 * React hook for fetching and managing embed data for URLs.
 * Supports click-to-load pattern for privacy by default.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { EmbedData, UseEmbedOptions, UseEmbedResult, EmbedProvider } from './types'
import { detectProvider, getEmbedUrl, requiresOembed, enhanceEmbedUrl, calculateAspectRatio } from './utils'

/**
 * Default oEmbed proxy URL
 * Points to the BuildIt API Worker (shared across all platforms)
 */
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.buildit.network'
const DEFAULT_PROXY_URL = import.meta.env.VITE_OEMBED_PROXY_URL || `${API_BASE}/api/oembed`

/**
 * Hook for loading embed data from URLs
 *
 * @param url - The URL to embed
 * @param options - Hook options (proxyUrl, autoLoad, callbacks)
 * @returns Hook result with loading state, embed data, and load function
 *
 * @example
 * ```tsx
 * const { embedData, loading, load, isEmbeddable } = useEmbed('https://youtube.com/watch?v=abc')
 *
 * if (!isEmbeddable) return <Link>{url}</Link>
 *
 * if (!embedData) {
 *   return <Button onClick={load}>Load YouTube Video</Button>
 * }
 *
 * return <iframe src={embedData.embedUrl} />
 * ```
 */
export function useEmbed(url: string, options: UseEmbedOptions = {}): UseEmbedResult {
  const { proxyUrl = DEFAULT_PROXY_URL, autoLoad = false, onLoad, onError } = options

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [embedData, setEmbedData] = useState<EmbedData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Detect provider from URL (memoized, doesn't require loading)
  const detected = useMemo(() => detectProvider(url), [url])
  const provider = detected?.provider || null
  const isEmbeddable = detected !== null

  // Load embed data
  const load = useCallback(async (): Promise<void> => {
    if (!detected || loading) return

    setLoading(true)
    setError(null)

    try {
      const { provider, providerId } = detected

      // For trusted providers with direct embed URL construction
      if (provider.priority === 'trusted' && provider.getEmbedUrl) {
        const embedUrl = provider.getEmbedUrl(url)

        if (embedUrl) {
          const data: EmbedData = {
            success: true,
            provider: provider.name,
            providerId,
            type: 'video', // Assume video for direct embeds
            embedUrl: enhanceEmbedUrl(embedUrl, providerId),
            originalUrl: url,
            aspectRatio: provider.aspectRatio,
            sandbox: provider.sandbox,
            allow: provider.allow,
          }

          setEmbedData(data)
          setIsLoaded(true)
          onLoad?.(data)
          return
        }
      }

      // For providers requiring oEmbed lookup
      if (requiresOembed(providerId)) {
        const response = await fetch(`${proxyUrl}?url=${encodeURIComponent(url)}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch embed: ${response.status}`)
        }

        const proxyData = await response.json()

        if (!proxyData.success) {
          throw new Error(proxyData.error || 'Failed to load embed')
        }

        const data: EmbedData = {
          success: true,
          provider: proxyData.provider || provider.name,
          providerId,
          type: proxyData.type || 'rich',
          title: proxyData.title,
          author: proxyData.author,
          thumbnail: proxyData.thumbnail,
          embedUrl: proxyData.embedUrl ? enhanceEmbedUrl(proxyData.embedUrl, providerId) : undefined,
          embedHtml: proxyData.embedHtml,
          originalUrl: url,
          width: proxyData.width,
          height: proxyData.height,
          aspectRatio: proxyData.aspectRatio || calculateAspectRatio(proxyData.width, proxyData.height),
          sandbox: proxyData.sandbox || provider.sandbox,
          allow: proxyData.allow || provider.allow,
        }

        setEmbedData(data)
        setIsLoaded(true)
        onLoad?.(data)
        return
      }

      // Fallback: Try to use getEmbedUrl
      const embedUrl = getEmbedUrl(url)

      if (embedUrl) {
        const data: EmbedData = {
          success: true,
          provider: provider.name,
          providerId,
          type: 'video',
          embedUrl: enhanceEmbedUrl(embedUrl, providerId),
          originalUrl: url,
          aspectRatio: provider.aspectRatio,
          sandbox: provider.sandbox,
          allow: provider.allow,
        }

        setEmbedData(data)
        setIsLoaded(true)
        onLoad?.(data)
      } else {
        throw new Error('Unable to generate embed URL')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load embed'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [url, detected, loading, proxyUrl, onLoad, onError])

  // Auto-load if enabled and URL is embeddable
  useEffect(() => {
    if (autoLoad && isEmbeddable && !isLoaded && !loading) {
      load()
    }
  }, [autoLoad, isEmbeddable, isLoaded, loading, load])

  // Reset state when URL changes
  useEffect(() => {
    setEmbedData(null)
    setIsLoaded(false)
    setError(null)
    setLoading(false)
  }, [url])

  return {
    loading,
    error,
    embedData,
    provider,
    load,
    isLoaded,
    isEmbeddable,
  }
}

/**
 * Simple hook to check if a URL is embeddable without loading data
 *
 * @param url - The URL to check
 * @returns Object with isEmbeddable boolean and provider info
 */
export function useEmbedCheck(url: string): { isEmbeddable: boolean; provider: EmbedProvider | null } {
  const detected = useMemo(() => detectProvider(url), [url])

  return {
    isEmbeddable: detected !== null,
    provider: detected?.provider || null,
  }
}

/**
 * Hook for batch checking multiple URLs for embeddability
 *
 * @param urls - Array of URLs to check
 * @returns Array of results with URL and embeddability info
 */
export function useEmbedCheckBatch(
  urls: string[]
): Array<{ url: string; isEmbeddable: boolean; provider: EmbedProvider | null }> {
  return useMemo(() => {
    return urls.map((url) => {
      const detected = detectProvider(url)
      return {
        url,
        isEmbeddable: detected !== null,
        provider: detected?.provider || null,
      }
    })
  }, [urls])
}
