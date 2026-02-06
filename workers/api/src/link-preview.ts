/**
 * Link Preview API
 *
 * Fetches Open Graph metadata from URLs for Signal-style encrypted link previews.
 * Runs at the edge so:
 * - No CORS issues for client apps
 * - Sender's IP is hidden from target sites (Cloudflare's IP is seen)
 * - Fast response times globally
 *
 * GET /api/link-preview?url=https://example.com
 */

import type { Env } from './index';

interface OpenGraphData {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  type?: string;
  faviconUrl?: string;
}

interface LinkPreviewResponse {
  success: boolean;
  data?: OpenGraphData;
  error?: string;
  cached?: boolean;
}

const CACHE_TTL = 60 * 60; // 1 hour
const FETCH_TIMEOUT = 5000;
const MAX_REDIRECTS = 3;
const ALLOWED_PROTOCOLS = ['https:'];
const USER_AGENT = 'BuildIt-LinkPreview/1.0 (https://buildit.network)';

/**
 * SSRF protection: block requests to private/internal IP ranges.
 * Prevents attackers from using the link preview worker to scan internal networks.
 */
const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(lower)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some(s => lower.endsWith(s))) return true;
  // Block private IP ranges
  if (/^10\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // Link-local / cloud metadata
  if (/^0\./.test(lower)) return true;
  if (lower.startsWith('[fc') || lower.startsWith('[fd')) return true; // IPv6 private
  return false;
}

function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;
    if (isBlockedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    const cleanParams = new URLSearchParams();
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'fbclid', 'gclid', 'msclkid', 'twclid',
    ]);
    for (const [key, value] of parsed.searchParams) {
      if (!trackingParams.has(key.toLowerCase())) {
        cleanParams.set(key, value);
      }
    }
    parsed.search = cleanParams.toString();
    return `link-preview:${parsed.toString()}`;
  } catch {
    return `link-preview:${url}`;
  }
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function decodeHtmlEntities(text?: string): string | undefined {
  if (!text) return text;

  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&#x27;': "'", '&#x2F;': '/',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10)),
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16)),
  );

  return decoded;
}

function parseOpenGraph(html: string, baseUrl: string): OpenGraphData {
  const data: OpenGraphData = { url: baseUrl };

  const getMeta = (property: string): string | undefined => {
    const propertyMatch = html.match(
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    );
    if (propertyMatch) return propertyMatch[1];

    const reverseMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    );
    if (reverseMatch) return reverseMatch[1];

    const nameMatch = html.match(
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    );
    if (nameMatch) return nameMatch[1];

    const reverseNameMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
    );
    if (reverseNameMatch) return reverseNameMatch[1];

    return undefined;
  };

  data.title = getMeta('og:title');
  data.description = getMeta('og:description');
  data.imageUrl = getMeta('og:image');
  data.siteName = getMeta('og:site_name');
  data.type = getMeta('og:type');

  if (!data.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) data.title = titleMatch[1].trim();
  }

  if (!data.description) {
    data.description = getMeta('description');
  }

  if (data.imageUrl) {
    data.imageUrl = resolveUrl(data.imageUrl, baseUrl);
  }

  const faviconPatterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern);
    if (match) {
      data.faviconUrl = resolveUrl(match[1], baseUrl);
      break;
    }
  }

  if (!data.faviconUrl) {
    try {
      const parsed = new URL(baseUrl);
      data.faviconUrl = `${parsed.origin}/favicon.ico`;
    } catch { /* ignore */ }
  }

  if (data.description && data.description.length > 300) {
    data.description = data.description.slice(0, 297) + '...';
  }

  data.title = decodeHtmlEntities(data.title);
  data.description = decodeHtmlEntities(data.description);
  data.siteName = decodeHtmlEntities(data.siteName);

  return data;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleLinkPreview(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing url parameter' } satisfies LinkPreviewResponse),
      { status: 400, headers },
    );
  }

  if (!validateUrl(targetUrl)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid URL. Only HTTPS URLs are supported.' } satisfies LinkPreviewResponse),
      { status: 400, headers },
    );
  }

  // Check cache
  const cacheKey = getCacheKey(targetUrl);
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        const response: LinkPreviewResponse = JSON.parse(cached);
        response.cached = true;
        return new Response(JSON.stringify(response), { headers });
      }
    } catch { /* cache miss */ }
  }

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
      FETCH_TIMEOUT,
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch: HTTP ${response.status}` } satisfies LinkPreviewResponse),
        { status: 502, headers },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL does not return HTML content' } satisfies LinkPreviewResponse),
        { status: 400, headers },
      );
    }

    const html = await response.text();
    const ogData = parseOpenGraph(html.slice(0, 100_000), targetUrl);

    const successResponse: LinkPreviewResponse = { success: true, data: ogData };

    if (env.CACHE && ogData.title) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify(successResponse), { expirationTtl: CACHE_TTL });
      } catch { /* cache write failed */ }
    }

    return new Response(JSON.stringify(successResponse), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('aborted');
    return new Response(
      JSON.stringify({
        success: false,
        error: isTimeout ? 'Request timed out' : `Failed to fetch: ${message}`,
      } satisfies LinkPreviewResponse),
      { status: 502, headers },
    );
  }
}
