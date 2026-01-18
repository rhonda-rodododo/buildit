/**
 * Shared Embed Providers Registry
 *
 * Single source of truth for all embed provider configurations.
 * Used by both frontend components and the oEmbed proxy worker.
 *
 * Security principles:
 * - Only trusted providers are embedded directly
 * - Privacy-enhanced URLs (no-cookie, dnt) where available
 * - Restrictive sandbox/allow attributes per provider
 */

import type { EmbedProvider } from './types'

/**
 * YouTube provider configuration
 * Uses privacy-enhanced youtube-nocookie.com domain
 */
export const youtubeProvider: EmbedProvider = {
  id: 'youtube',
  name: 'YouTube',
  domain: 'youtube.com',
  additionalDomains: ['youtu.be', 'www.youtube.com'],
  patterns: [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
  allow: [
    'accelerometer',
    'autoplay',
    'clipboard-write',
    'encrypted-media',
    'gyroscope',
    'picture-in-picture',
    'fullscreen',
  ],
  aspectRatio: '16/9',
  getEmbedUrl: (url: string) => {
    let videoId: string | null = null

    // Extract video ID from various YouTube URL formats
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/)

    videoId = watchMatch?.[1] || shortMatch?.[1] || embedMatch?.[1] || shortsMatch?.[1] || null

    if (!videoId) return null

    // Use privacy-enhanced embed URL (no cookies)
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
  },
}

/**
 * Vimeo provider configuration
 * Uses dnt=1 for do-not-track mode
 */
export const vimeoProvider: EmbedProvider = {
  id: 'vimeo',
  name: 'Vimeo',
  domain: 'vimeo.com',
  additionalDomains: ['player.vimeo.com'],
  patterns: [
    /^https?:\/\/(www\.)?vimeo\.com\/(\d+)/,
    /^https?:\/\/player\.vimeo\.com\/video\/(\d+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
  allow: ['autoplay', 'fullscreen', 'picture-in-picture'],
  aspectRatio: '16/9',
  getEmbedUrl: (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/) || url.match(/player\.vimeo\.com\/video\/(\d+)/)
    if (!match) return null
    // dnt=1 for privacy (do not track)
    return `https://player.vimeo.com/video/${match[1]}?dnt=1`
  },
}

/**
 * PeerTube provider configuration
 * Supports any PeerTube instance
 */
export const peertubeProvider: EmbedProvider = {
  id: 'peertube',
  name: 'PeerTube',
  domain: 'peertube', // Generic - matches various instances
  patterns: [
    /^https?:\/\/([a-zA-Z0-9.-]+)\/videos\/watch\/([a-zA-Z0-9-]+)/,
    /^https?:\/\/([a-zA-Z0-9.-]+)\/w\/([a-zA-Z0-9-]+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
  allow: ['autoplay', 'fullscreen'],
  aspectRatio: '16/9',
  getEmbedUrl: (url: string) => {
    const watchMatch = url.match(/\/videos\/watch\/([a-zA-Z0-9-]+)/)
    const shortMatch = url.match(/\/w\/([a-zA-Z0-9-]+)/)
    const videoId = watchMatch?.[1] || shortMatch?.[1]
    if (!videoId) return null

    // Extract the host for the embed URL
    const hostMatch = url.match(/https?:\/\/([a-zA-Z0-9.-]+)/)
    if (!hostMatch) return null

    return `https://${hostMatch[1]}/videos/embed/${videoId}`
  },
}

/**
 * SoundCloud provider configuration
 */
export const soundcloudProvider: EmbedProvider = {
  id: 'soundcloud',
  name: 'SoundCloud',
  domain: 'soundcloud.com',
  patterns: [
    /^https?:\/\/(www\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin'],
  allow: [],
  aspectRatio: '1/0.3', // SoundCloud player is typically shorter
  getEmbedUrl: (url: string) => {
    // SoundCloud requires their widget API with the original URL
    const encodedUrl = encodeURIComponent(url)
    return `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`
  },
}

/**
 * Spotify provider configuration
 */
export const spotifyProvider: EmbedProvider = {
  id: 'spotify',
  name: 'Spotify',
  domain: 'spotify.com',
  additionalDomains: ['open.spotify.com'],
  patterns: [
    /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin'],
  allow: ['encrypted-media'],
  aspectRatio: '1/0.5',
  getEmbedUrl: (url: string) => {
    const match = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/)
    if (!match) return null
    // theme=0 for dark mode support
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`
  },
}

/**
 * Mastodon provider configuration
 * Note: Mastodon embeds are handled via oEmbed, not direct iframe
 */
export const mastodonProvider: EmbedProvider = {
  id: 'mastodon',
  name: 'Mastodon',
  domain: 'mastodon', // Generic - matches various instances
  patterns: [
    /^https?:\/\/([a-zA-Z0-9.-]+)\/@[a-zA-Z0-9_]+\/(\d+)/,
    /^https?:\/\/([a-zA-Z0-9.-]+)\/users\/[a-zA-Z0-9_]+\/statuses\/(\d+)/,
  ],
  priority: 'oembed', // Requires oEmbed lookup
  sandbox: [],
  allow: [],
  aspectRatio: '1/1',
  getEmbedUrl: () => null, // Mastodon uses oEmbed, not direct embed
}

/**
 * CodePen provider configuration
 */
export const codepenProvider: EmbedProvider = {
  id: 'codepen',
  name: 'CodePen',
  domain: 'codepen.io',
  patterns: [
    /^https?:\/\/codepen\.io\/[a-zA-Z0-9_-]+\/pen\/([a-zA-Z0-9]+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
  allow: [],
  aspectRatio: '16/9',
  getEmbedUrl: (url: string) => {
    const match = url.match(/codepen\.io\/([a-zA-Z0-9_-]+)\/pen\/([a-zA-Z0-9]+)/)
    if (!match) return null
    return `https://codepen.io/${match[1]}/embed/${match[2]}?default-tab=result&theme-id=dark`
  },
}

/**
 * CodeSandbox provider configuration
 */
export const codesandboxProvider: EmbedProvider = {
  id: 'codesandbox',
  name: 'CodeSandbox',
  domain: 'codesandbox.io',
  patterns: [
    /^https?:\/\/codesandbox\.io\/s\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/codesandbox\.io\/p\/sandbox\/([a-zA-Z0-9_-]+)/,
  ],
  priority: 'trusted',
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-modals'],
  allow: [],
  aspectRatio: '16/9',
  getEmbedUrl: (url: string) => {
    const match = url.match(/codesandbox\.io\/(?:s|p\/sandbox)\/([a-zA-Z0-9_-]+)/)
    if (!match) return null
    return `https://codesandbox.io/embed/${match[1]}?fontsize=14&hidenavigation=1&theme=dark`
  },
}

/**
 * All registered providers
 */
export const EMBED_PROVIDERS: Record<string, EmbedProvider> = {
  youtube: youtubeProvider,
  vimeo: vimeoProvider,
  peertube: peertubeProvider,
  soundcloud: soundcloudProvider,
  spotify: spotifyProvider,
  mastodon: mastodonProvider,
  codepen: codepenProvider,
  codesandbox: codesandboxProvider,
}

/**
 * Get all providers as an array
 */
export function getProviders(): EmbedProvider[] {
  return Object.values(EMBED_PROVIDERS)
}

/**
 * Get provider by ID
 */
export function getProviderById(id: string): EmbedProvider | undefined {
  return EMBED_PROVIDERS[id]
}

/**
 * Get provider by domain
 * Checks both primary domain and additional domains
 */
export function getProviderByDomain(domain: string): EmbedProvider | undefined {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '')

  return Object.values(EMBED_PROVIDERS).find((provider) => {
    if (provider.domain === normalizedDomain) return true
    if (provider.additionalDomains?.includes(normalizedDomain)) return true
    return false
  })
}

/**
 * Get list of supported provider names for UI display
 */
export function getSupportedProviderNames(): string[] {
  return Object.values(EMBED_PROVIDERS).map((p) => p.name)
}

/**
 * Get list of supported domains for documentation
 */
export function getSupportedDomains(): string[] {
  const domains: string[] = []
  for (const provider of Object.values(EMBED_PROVIDERS)) {
    domains.push(provider.domain)
    if (provider.additionalDomains) {
      domains.push(...provider.additionalDomains)
    }
  }
  return domains
}
