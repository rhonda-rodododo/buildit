/**
 * oEmbed Proxy Worker for Cloudflare
 *
 * Securely fetches oEmbed data from providers, sanitizes HTML,
 * and returns safe embed content for use in sandboxed iframes.
 *
 * Deploy: wrangler deploy
 */

interface Env {
  // Add KV namespace for caching if needed
  OEMBED_CACHE?: KVNamespace
}

interface OEmbedResponse {
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
  // For photo type
  url?: string
  width?: number
  height?: number
  // For video/rich type
  html?: string
}

interface SafeEmbedResponse {
  success: boolean
  provider: string
  type: 'video' | 'photo' | 'rich' | 'link'
  title?: string
  author?: string
  thumbnail?: string
  // Sanitized embed options
  embedUrl?: string      // Direct iframe src (for trusted providers)
  embedHtml?: string     // Sanitized HTML for srcdoc
  width?: number
  height?: number
  aspectRatio?: string
  // Security metadata
  sandbox: string[]
  allow: string[]
}

// Trusted oEmbed providers with their endpoints
const OEMBED_PROVIDERS: Record<string, {
  endpoint: string
  trusted: boolean  // If true, use their embed URL directly
  sandbox: string[]
  allow: string[]
}> = {
  'youtube.com': {
    endpoint: 'https://www.youtube.com/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation', 'allow-popups'],
    allow: ['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'],
  },
  'youtu.be': {
    endpoint: 'https://www.youtube.com/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation', 'allow-popups'],
    allow: ['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'],
  },
  'vimeo.com': {
    endpoint: 'https://vimeo.com/api/oembed.json',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation', 'allow-popups'],
    allow: ['autoplay', 'fullscreen', 'picture-in-picture'],
  },
  'twitter.com': {
    endpoint: 'https://publish.twitter.com/oembed',
    trusted: false, // Twitter's HTML needs sanitization
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups'],
    allow: [],
  },
  'x.com': {
    endpoint: 'https://publish.twitter.com/oembed',
    trusted: false,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups'],
    allow: [],
  },
  'soundcloud.com': {
    endpoint: 'https://soundcloud.com/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: [],
  },
  'spotify.com': {
    endpoint: 'https://open.spotify.com/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: ['encrypted-media'],
  },
  'instagram.com': {
    endpoint: 'https://graph.facebook.com/v18.0/instagram_oembed',
    trusted: false,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: [],
  },
  'tiktok.com': {
    endpoint: 'https://www.tiktok.com/oembed',
    trusted: false,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: [],
  },
  'codepen.io': {
    endpoint: 'https://codepen.io/api/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
    allow: [],
  },
  'codesandbox.io': {
    endpoint: 'https://codesandbox.io/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-modals'],
    allow: [],
  },
}

// Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Handle subdomains like www.youtube.com -> youtube.com
    const parts = parsed.hostname.split('.')
    if (parts.length >= 2) {
      return parts.slice(-2).join('.')
    }
    return parsed.hostname
  } catch {
    return null
  }
}

// Sanitize HTML from oEmbed response
function sanitizeHtml(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

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

// Extract iframe src from oEmbed HTML for trusted providers
function extractIframeSrc(html: string): string | null {
  const match = html.match(/src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

// Enhance embed URL for privacy
function enhanceEmbedUrl(url: string, provider: string): string {
  try {
    const parsed = new URL(url)

    // YouTube: use privacy-enhanced domain
    if (provider === 'youtube.com' || provider === 'youtu.be') {
      parsed.hostname = 'www.youtube-nocookie.com'
      parsed.searchParams.set('rel', '0')
      parsed.searchParams.set('modestbranding', '1')
    }

    // Vimeo: add do-not-track
    if (provider === 'vimeo.com') {
      parsed.searchParams.set('dnt', '1')
    }

    return parsed.toString()
  } catch {
    return url
  }
}

// Calculate aspect ratio from dimensions
function calculateAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '16/9'

  // Common ratios
  const ratio = width / height
  if (Math.abs(ratio - 16/9) < 0.1) return '16/9'
  if (Math.abs(ratio - 4/3) < 0.1) return '4/3'
  if (Math.abs(ratio - 1) < 0.1) return '1/1'

  return `${width}/${height}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Restrict in production
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      )
    }

    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate URL
    let parsedTarget: URL
    try {
      parsedTarget = new URL(targetUrl)
      if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Find provider
    const domain = extractDomain(targetUrl)
    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Could not extract domain' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const providerConfig = OEMBED_PROVIDERS[domain]
    if (!providerConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unsupported provider',
          supported: Object.keys(OEMBED_PROVIDERS),
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Check cache first
    const cacheKey = `oembed:${targetUrl}`
    if (env.OEMBED_CACHE) {
      const cached = await env.OEMBED_CACHE.get(cacheKey)
      if (cached) {
        return new Response(cached, { headers: corsHeaders })
      }
    }

    // Fetch oEmbed data
    const oembedUrl = new URL(providerConfig.endpoint)
    oembedUrl.searchParams.set('url', targetUrl)
    oembedUrl.searchParams.set('format', 'json')

    try {
      const oembedResponse = await fetch(oembedUrl.toString(), {
        headers: {
          'User-Agent': 'BuildIt-oEmbed-Proxy/1.0',
          'Accept': 'application/json',
        },
      })

      if (!oembedResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `oEmbed request failed: ${oembedResponse.status}`,
          }),
          { status: oembedResponse.status, headers: corsHeaders }
        )
      }

      const oembed: OEmbedResponse = await oembedResponse.json()

      // Build safe response
      const response: SafeEmbedResponse = {
        success: true,
        provider: oembed.provider_name || domain,
        type: oembed.type,
        title: oembed.title,
        author: oembed.author_name,
        thumbnail: oembed.thumbnail_url,
        width: oembed.width,
        height: oembed.height,
        aspectRatio: calculateAspectRatio(oembed.width, oembed.height),
        sandbox: providerConfig.sandbox,
        allow: providerConfig.allow,
      }

      // Handle embed content
      if (oembed.html) {
        if (providerConfig.trusted) {
          // For trusted providers, extract and enhance the iframe src
          const iframeSrc = extractIframeSrc(oembed.html)
          if (iframeSrc) {
            response.embedUrl = enhanceEmbedUrl(iframeSrc, domain)
          } else {
            // Fallback to sanitized HTML
            response.embedHtml = sanitizeHtml(oembed.html)
          }
        } else {
          // For untrusted providers, always sanitize HTML
          response.embedHtml = sanitizeHtml(oembed.html)
        }
      } else if (oembed.type === 'photo' && oembed.url) {
        // For photo type, just use the image URL
        response.embedUrl = oembed.url
      }

      const responseJson = JSON.stringify(response)

      // Cache for 1 hour
      if (env.OEMBED_CACHE) {
        await env.OEMBED_CACHE.put(cacheKey, responseJson, { expirationTtl: 3600 })
      }

      return new Response(responseJson, { headers: corsHeaders })

    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch oEmbed data',
        }),
        { status: 500, headers: corsHeaders }
      )
    }
  },
}
