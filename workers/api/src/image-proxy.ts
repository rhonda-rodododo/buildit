/**
 * Image Proxy API
 *
 * Proxies image fetches for link preview thumbnails and favicons.
 * - No CORS issues for client apps
 * - Only HTTPS URLs allowed
 * - Only image/* content types returned
 * - Size limited to 500KB
 * - 10 second timeout
 *
 * GET /api/image-proxy?url=https://example.com/image.jpg
 */

import type { Env } from './index';

const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
const FETCH_TIMEOUT = 10_000;

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
];

/**
 * SSRF protection: block requests to private/internal IP ranges.
 */
const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(lower)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some(s => lower.endsWith(s))) return true;
  if (/^10\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  if (/^0\./.test(lower)) return true;
  if (lower.startsWith('[fc') || lower.startsWith('[fd')) return true;
  return false;
}

function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return null;
    if (isBlockedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BuildIt-ImageProxy/1.0 (https://buildit.network)',
        'Accept': 'image/*',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleImageProxy(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing url parameter' }),
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!validateUrl(targetUrl)) {
    return new Response(
      JSON.stringify({ error: 'Invalid URL. Only HTTPS URLs are supported.' }),
      { status: 400, headers: jsonHeaders },
    );
  }

  // Check cache
  const cacheKey = `image-proxy:${targetUrl}`;
  if (env.CACHE) {
    try {
      const metadata = await env.CACHE.getWithMetadata<{ contentType: string }>(cacheKey, 'arrayBuffer');
      if (metadata.value) {
        const contentType = metadata.metadata?.contentType || 'image/jpeg';
        return new Response(metadata.value, {
          headers: {
            ...cors,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch { /* cache miss */ }
  }

  try {
    const response = await fetchWithTimeout(targetUrl, FETCH_TIMEOUT);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch: HTTP ${response.status}` }),
        { status: 502, headers: jsonHeaders },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const baseType = contentType.split(';')[0].trim();

    if (!ALLOWED_TYPES.includes(baseType)) {
      return new Response(
        JSON.stringify({ error: 'URL does not return an image' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image too large (max 500KB)' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image too large (max 500KB)' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Cache for 24 hours
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, arrayBuffer, {
          expirationTtl: 86400,
          metadata: { contentType: baseType },
        });
      } catch { /* cache write failed */ }
    }

    return new Response(arrayBuffer, {
      headers: {
        ...cors,
        'Content-Type': baseType,
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('aborted');
    return new Response(
      JSON.stringify({ error: isTimeout ? 'Request timed out' : `Failed to fetch: ${message}` }),
      { status: 502, headers: jsonHeaders },
    );
  }
}
