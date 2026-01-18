/**
 * Link Preview API - Cloudflare Pages Function
 *
 * Fetches Open Graph metadata from URLs for Signal-style encrypted link previews.
 * This runs at the edge, so:
 * - No CORS issues (same origin as the app)
 * - Fast response times globally
 * - Sender's IP is hidden from target sites (Cloudflare's IP is seen instead)
 *
 * Endpoint: GET /api/link-preview?url=https://example.com
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     url: "https://example.com",
 *     title: "Example",
 *     description: "...",
 *     imageUrl: "https://...",
 *     siteName: "Example",
 *     faviconUrl: "https://..."
 *   }
 * }
 */

interface Env {
  CACHE?: KVNamespace
  ENVIRONMENT?: string
}

interface OpenGraphData {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
  type?: string
  faviconUrl?: string
}

interface LinkPreviewResponse {
  success: boolean
  data?: OpenGraphData
  error?: string
  cached?: boolean
}

// Cache TTL: 1 hour for successful responses
const CACHE_TTL = 60 * 60

// Request timeout: 5 seconds
const FETCH_TIMEOUT = 5000

// Allowed protocols
const ALLOWED_PROTOCOLS = ['https:']

// User agent for fetching
const USER_AGENT = 'BuildIt-LinkPreview/1.0 (https://buildit.network)'

/**
 * Validate and normalize URL
 */
function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString)
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return null
    }
    return url
  } catch {
    return null
  }
}

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  // Normalize URL for caching (remove tracking params)
  try {
    const parsed = new URL(url)
    const cleanParams = new URLSearchParams()

    // Keep only non-tracking params
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'fbclid', 'gclid', 'msclkid', 'twclid',
    ])

    for (const [key, value] of parsed.searchParams) {
      if (!trackingParams.has(key.toLowerCase())) {
        cleanParams.set(key, value)
      }
    }

    parsed.search = cleanParams.toString()
    return `link-preview:${parsed.toString()}`
  } catch {
    return `link-preview:${url}`
  }
}

/**
 * Parse Open Graph metadata from HTML
 */
function parseOpenGraph(html: string, baseUrl: string): OpenGraphData {
  const data: OpenGraphData = { url: baseUrl }

  // Helper to extract meta content
  const getMeta = (property: string): string | undefined => {
    // Try property attribute first (Open Graph style)
    const propertyMatch = html.match(
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
    )
    if (propertyMatch) return propertyMatch[1]

    // Try content before property
    const reverseMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
    )
    if (reverseMatch) return reverseMatch[1]

    // Try name attribute (standard meta style)
    const nameMatch = html.match(
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
    )
    if (nameMatch) return nameMatch[1]

    // Try content before name
    const reverseNameMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
    )
    if (reverseNameMatch) return reverseNameMatch[1]

    return undefined
  }

  // Extract Open Graph properties
  data.title = getMeta('og:title')
  data.description = getMeta('og:description')
  data.imageUrl = getMeta('og:image')
  data.siteName = getMeta('og:site_name')
  data.type = getMeta('og:type')

  // Fallbacks
  if (!data.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      data.title = titleMatch[1].trim()
    }
  }

  if (!data.description) {
    data.description = getMeta('description')
  }

  // Resolve relative image URL
  if (data.imageUrl) {
    data.imageUrl = resolveUrl(data.imageUrl, baseUrl)
  }

  // Extract favicon
  const faviconPatterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ]

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern)
    if (match) {
      data.faviconUrl = resolveUrl(match[1], baseUrl)
      break
    }
  }

  // Default favicon
  if (!data.faviconUrl) {
    try {
      const parsed = new URL(baseUrl)
      data.faviconUrl = `${parsed.origin}/favicon.ico`
    } catch {
      // Ignore
    }
  }

  // Truncate description to reasonable length
  if (data.description && data.description.length > 300) {
    data.description = data.description.slice(0, 297) + '...'
  }

  // Decode HTML entities in title and description
  data.title = decodeHtmlEntities(data.title)
  data.description = decodeHtmlEntities(data.description)
  data.siteName = decodeHtmlEntities(data.siteName)

  return data
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('//')) {
      return `https:${url}`
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return new URL(url, baseUrl).toString()
  } catch {
    return url
  }
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text?: string): string | undefined {
  if (!text) return text

  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#60;': '<',
    '&#62;': '>',
  }

  let decoded = text
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char)
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  )
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  )

  return decoded
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Main handler
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // CORS headers (same origin, but allow for local dev)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  // Validate input
  if (!targetUrl) {
    const response: LinkPreviewResponse = {
      success: false,
      error: 'Missing url parameter',
    }
    return new Response(JSON.stringify(response), {
      status: 400,
      headers: corsHeaders,
    })
  }

  const parsedUrl = validateUrl(targetUrl)
  if (!parsedUrl) {
    const response: LinkPreviewResponse = {
      success: false,
      error: 'Invalid URL. Only HTTPS URLs are supported.',
    }
    return new Response(JSON.stringify(response), {
      status: 400,
      headers: corsHeaders,
    })
  }

  // Check cache
  const cacheKey = getCacheKey(targetUrl)
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey)
      if (cached) {
        const response: LinkPreviewResponse = JSON.parse(cached)
        response.cached = true
        return new Response(JSON.stringify(response), {
          headers: corsHeaders,
        })
      }
    } catch {
      // Cache miss or error, continue to fetch
    }
  }

  // Fetch the page
  try {
    const response = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    )

    if (!response.ok) {
      const errorResponse: LinkPreviewResponse = {
        success: false,
        error: `Failed to fetch: HTTP ${response.status}`,
      }
      return new Response(JSON.stringify(errorResponse), {
        status: 502,
        headers: corsHeaders,
      })
    }

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const errorResponse: LinkPreviewResponse = {
        success: false,
        error: 'URL does not return HTML content',
      }
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Parse HTML (limit to first 100KB for performance)
    const html = await response.text()
    const truncatedHtml = html.slice(0, 100000)

    // Extract Open Graph data
    const ogData = parseOpenGraph(truncatedHtml, targetUrl)

    const successResponse: LinkPreviewResponse = {
      success: true,
      data: ogData,
    }

    // Cache successful response
    if (env.CACHE && ogData.title) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify(successResponse), {
          expirationTtl: CACHE_TTL,
        })
      } catch {
        // Cache write failed, continue anyway
      }
    }

    return new Response(JSON.stringify(successResponse), {
      headers: corsHeaders,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('aborted')

    const errorResponse: LinkPreviewResponse = {
      success: false,
      error: isTimeout ? 'Request timed out' : `Failed to fetch: ${message}`,
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 502,
      headers: corsHeaders,
    })
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
