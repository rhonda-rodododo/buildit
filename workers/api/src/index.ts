/**
 * BuildIt Network API Worker
 *
 * Shared API services for all platforms (desktop, iOS, Android).
 * Provides link preview, image proxy, and oEmbed endpoints.
 *
 * These are cross-platform services - not tied to any specific client.
 */

import { handleLinkPreview } from './link-preview';
import { handleImageProxy } from './image-proxy';
import { handleOEmbed } from './oembed';

export interface Env {
  CACHE?: KVNamespace;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Simple per-IP rate limiter using in-memory token bucket.
 * Limits to 30 requests per minute per IP to prevent abuse.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;

  // Periodic cleanup of stale entries
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  const allowed = env.ALLOWED_ORIGINS || '*';

  // If allowed is *, allow all. Otherwise check if origin is in the list.
  const allowOrigin =
    allowed === '*'
      ? '*'
      : allowed.split(',').some((o) => o.trim() === origin)
        ? origin
        : '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function handleOptions(request: Request, env: Env): Response {
  return new Response(null, {
    headers: corsHeaders(request, env),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(request, env), 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting per IP
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429,
        headers: {
          ...corsHeaders(request, env),
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      });
    }

    const cors = corsHeaders(request, env);

    switch (url.pathname) {
      case '/api/link-preview':
        return handleLinkPreview(request, env, cors);

      case '/api/image-proxy':
        return handleImageProxy(request, env, cors);

      case '/api/oembed':
        return handleOEmbed(request, env, cors);

      case '/health':
        return new Response(
          JSON.stringify({ status: 'healthy', timestamp: Date.now() }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );

      default:
        return new Response(
          JSON.stringify({
            name: 'BuildIt Network API',
            endpoints: ['/api/link-preview', '/api/image-proxy', '/api/oembed', '/health'],
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );
    }
  },
};
