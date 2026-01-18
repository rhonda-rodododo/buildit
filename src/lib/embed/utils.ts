/**
 * Shared Embed Utilities
 *
 * Helper functions for URL detection, domain extraction,
 * and provider matching used across the application.
 */

import type { EmbedProvider, ExtractedUrl } from './types'
import { EMBED_PROVIDERS } from './providers'

/**
 * URL regex pattern for extracting URLs from text
 * Matches http/https URLs with various TLDs and paths
 */
const URL_REGEX = /https?:\/\/(?:[-\w@:%.+~#=]+\.)+[a-z]{2,}(?:\/[-\w@:%+.~#?&/=]*)?/gi

/**
 * Extract domain from a URL string
 * Normalizes www. prefix and returns base domain
 *
 * @example extractDomain('https://www.youtube.com/watch?v=abc') → 'youtube.com'
 * @example extractDomain('https://youtu.be/abc') → 'youtu.be'
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Get the base domain (last two parts) from a hostname
 * Useful for matching subdomains to a provider
 *
 * @example getBaseDomain('player.vimeo.com') → 'vimeo.com'
 * @example getBaseDomain('some.instance.mastodon.social') → 'mastodon.social'
 */
export function getBaseDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return hostname.toLowerCase()
}

/**
 * Detect which provider matches a URL
 * Returns the provider and provider ID if found
 *
 * @example detectProvider('https://youtube.com/watch?v=abc')
 *   → { provider: youtubeProvider, providerId: 'youtube' }
 */
export function detectProvider(url: string): { provider: EmbedProvider; providerId: string } | null {
  for (const [id, provider] of Object.entries(EMBED_PROVIDERS)) {
    for (const pattern of provider.patterns) {
      if (pattern.test(url)) {
        return { provider, providerId: id }
      }
    }
  }
  return null
}

/**
 * Check if a URL is embeddable (matches any known provider)
 */
export function isEmbeddableUrl(url: string): boolean {
  return detectProvider(url) !== null
}

/**
 * Extract all URLs from text content
 * Returns array of ExtractedUrl with position info and embeddability
 *
 * @example extractUrlsFromText('Check out https://youtube.com/watch?v=abc and https://google.com')
 *   → [
 *       { url: 'https://youtube.com/watch?v=abc', startIndex: 10, endIndex: 42, isEmbeddable: true, providerId: 'youtube' },
 *       { url: 'https://google.com', startIndex: 47, endIndex: 65, isEmbeddable: false }
 *     ]
 */
export function extractUrlsFromText(text: string): ExtractedUrl[] {
  const urls: ExtractedUrl[] = []
  let match: RegExpExecArray | null

  // Reset regex lastIndex for safety
  const regex = new RegExp(URL_REGEX.source, 'gi')

  while ((match = regex.exec(text)) !== null) {
    const url = match[0]
    const detected = detectProvider(url)

    urls.push({
      url,
      startIndex: match.index,
      endIndex: match.index + url.length,
      isEmbeddable: detected !== null,
      providerId: detected?.providerId,
    })
  }

  return urls
}

/**
 * Get the first embeddable URL from text
 * Useful for post previews where we only show one embed
 */
export function getFirstEmbeddableUrl(text: string): ExtractedUrl | null {
  const urls = extractUrlsFromText(text)
  return urls.find((u) => u.isEmbeddable) || null
}

/**
 * Calculate aspect ratio from width and height
 * Returns common ratios like "16/9" or custom "width/height"
 */
export function calculateAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '16/9'

  const ratio = width / height

  // Check common ratios with some tolerance
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16/9'
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4/3'
  if (Math.abs(ratio - 1) < 0.1) return '1/1'
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9/16' // Vertical video

  return `${width}/${height}`
}

/**
 * Enhance embed URL for privacy
 * Applies provider-specific privacy enhancements
 */
export function enhanceEmbedUrl(url: string, providerId: string): string {
  try {
    const parsed = new URL(url)

    switch (providerId) {
      case 'youtube':
        // Use privacy-enhanced domain
        parsed.hostname = 'www.youtube-nocookie.com'
        parsed.searchParams.set('rel', '0')
        parsed.searchParams.set('modestbranding', '1')
        break

      case 'vimeo':
        // Add do-not-track parameter
        parsed.searchParams.set('dnt', '1')
        break

      // Other providers can be added here
    }

    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Sanitize HTML content from oEmbed responses
 * Removes potentially dangerous elements and attributes
 */
export function sanitizeEmbedHtml(html: string): string {
  let sanitized = html

  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove on* event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')

  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '')

  // Remove data: URLs (potential XSS vector)
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, '')

  // Add security attributes to iframes within the HTML
  sanitized = sanitized.replace(
    /<iframe([^>]*)>/gi,
    '<iframe$1 sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer">'
  )

  return sanitized
}

/**
 * Extract iframe src from oEmbed HTML
 * Used to get direct embed URL from oEmbed responses
 */
export function extractIframeSrc(html: string): string | null {
  const match = html.match(/src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

/**
 * Get embed URL for a given URL
 * Uses the provider's getEmbedUrl function if available
 */
export function getEmbedUrl(url: string): string | null {
  const detected = detectProvider(url)
  if (!detected) return null

  const { provider } = detected
  if (provider.getEmbedUrl) {
    return provider.getEmbedUrl(url)
  }

  return null
}

/**
 * Check if a provider requires oEmbed lookup
 * (as opposed to direct embed URL construction)
 */
export function requiresOembed(providerId: string): boolean {
  const provider = EMBED_PROVIDERS[providerId]
  if (!provider) return true

  return provider.priority === 'oembed' || !provider.getEmbedUrl
}

/**
 * Format embed URL for display (shortened version)
 *
 * @example formatEmbedUrlForDisplay('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
 *   → 'youtube.com/watch?v=dQw4...'
 */
export function formatEmbedUrlForDisplay(url: string, maxLength: number = 40): string {
  try {
    const parsed = new URL(url)
    const display = parsed.hostname.replace(/^www\./, '') + parsed.pathname + parsed.search

    if (display.length <= maxLength) return display
    return display.slice(0, maxLength - 3) + '...'
  } catch {
    if (url.length <= maxLength) return url
    return url.slice(0, maxLength - 3) + '...'
  }
}
