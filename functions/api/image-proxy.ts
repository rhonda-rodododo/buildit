/**
 * Image Proxy API - Cloudflare Pages Function
 *
 * Proxies image fetches for link preview thumbnails.
 * This allows the client to fetch cross-origin images without CORS issues.
 *
 * Security:
 * - Only HTTPS URLs allowed
 * - Only image/* content types returned
 * - Size limited to 500KB
 * - 10 second timeout
 *
 * Endpoint: GET /api/image-proxy?url=https://example.com/image.jpg
 *
 * Response: Image binary with appropriate Content-Type
 */

interface Env {
  CACHE?: KVNamespace
}

// Max image size: 500KB
const MAX_IMAGE_SIZE = 500 * 1024

// Request timeout: 10 seconds
const FETCH_TIMEOUT = 10000

// Allowed image types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

/**
 * Validate URL
 */
function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'https:') {
      return null
    }
    return url
  } catch {
    return null
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BuildIt-ImageProxy/1.0 (https://buildit.network)',
        'Accept': 'image/*',
      },
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

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  // Validate input
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing url parameter' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const parsedUrl = validateUrl(targetUrl)
  if (!parsedUrl) {
    return new Response(
      JSON.stringify({ error: 'Invalid URL. Only HTTPS URLs are supported.' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Check cache
  const cacheKey = `image-proxy:${targetUrl}`
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey, 'arrayBuffer')
      if (cached) {
        // Get content type from cache metadata
        const metadata = await env.CACHE.getWithMetadata(cacheKey)
        const contentType = (metadata?.metadata as Record<string, string> | null)?.contentType || 'image/jpeg'

        return new Response(cached, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'X-Cache': 'HIT',
          },
        })
      }
    } catch {
      // Cache miss, continue to fetch
    }
  }

  // Fetch the image
  try {
    const response = await fetchWithTimeout(targetUrl, FETCH_TIMEOUT)

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch: HTTP ${response.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    const baseType = contentType.split(';')[0].trim()

    if (!ALLOWED_TYPES.includes(baseType)) {
      return new Response(
        JSON.stringify({ error: 'URL does not return an image' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check content length
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image too large (max 500KB)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Read body as array buffer
    const arrayBuffer = await response.arrayBuffer()

    // Double check size after reading
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image too large (max 500KB)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Cache successful response for 24 hours
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, arrayBuffer, {
          expirationTtl: 86400, // 24 hours
          metadata: { contentType: baseType },
        })
      } catch {
        // Cache write failed, continue anyway
      }
    }

    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': baseType,
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('aborted')

    return new Response(
      JSON.stringify({
        error: isTimeout ? 'Request timed out' : `Failed to fetch: ${message}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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
