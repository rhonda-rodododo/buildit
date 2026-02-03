/**
 * oEmbed Proxy API
 *
 * Fetches oEmbed data from trusted providers, sanitizes HTML,
 * and returns safe embed content for sandboxed iframes.
 *
 * Used for PUBLIC posts where iframe embeds are acceptable.
 * For private/encrypted posts, use link-preview instead.
 *
 * GET /api/oembed?url=https://youtube.com/watch?v=...
 */

import type { Env } from './index';

interface OEmbedResponse {
  type: 'photo' | 'video' | 'link' | 'rich';
  version: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  cache_age?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  url?: string;
  width?: number;
  height?: number;
  html?: string;
}

interface SafeEmbedResponse {
  success: boolean;
  provider: string;
  type: 'video' | 'photo' | 'rich' | 'link';
  title?: string;
  author?: string;
  thumbnail?: string;
  embedUrl?: string;
  embedHtml?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  sandbox: string[];
  allow: string[];
  error?: string;
  supported?: string[];
}

interface ProviderConfig {
  endpoint: string;
  trusted: boolean;
  sandbox: string[];
  allow: string[];
}

const OEMBED_PROVIDERS: Record<string, ProviderConfig> = {
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
    trusted: false,
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
  'dailymotion.com': {
    endpoint: 'https://www.dailymotion.com/services/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
    allow: ['autoplay', 'fullscreen'],
  },
  'twitch.tv': {
    endpoint: 'https://api.twitch.tv/v5/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: ['autoplay', 'fullscreen'],
  },
  'reddit.com': {
    endpoint: 'https://www.reddit.com/oembed',
    trusted: false,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: [],
  },
  'giphy.com': {
    endpoint: 'https://giphy.com/services/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin'],
    allow: [],
  },
  'loom.com': {
    endpoint: 'https://www.loom.com/v1/oembed',
    trusted: true,
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
    allow: ['autoplay', 'fullscreen'],
  },
};

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.replace(/^www\./, '').split('.');
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return parsed.hostname;
  } catch {
    return null;
  }
}

function sanitizeHtml(html: string): string {
  let sanitized = html;
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');
  sanitized = sanitized.replace(
    /<iframe([^>]*)>/gi,
    '<iframe$1 sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer">',
  );
  return sanitized;
}

function extractIframeSrc(html: string): string | null {
  const match = html.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function enhanceEmbedUrl(url: string, provider: string): string {
  try {
    const parsed = new URL(url);
    if (provider === 'youtube.com' || provider === 'youtu.be') {
      parsed.hostname = 'www.youtube-nocookie.com';
      parsed.searchParams.set('rel', '0');
      parsed.searchParams.set('modestbranding', '1');
    }
    if (provider === 'vimeo.com') {
      parsed.searchParams.set('dnt', '1');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function calculateAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '16/9';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16/9';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4/3';
  if (Math.abs(ratio - 1) < 0.1) return '1/1';
  return `${width}/${height}`;
}

export async function handleOEmbed(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing url parameter' }),
      { status: 400, headers },
    );
  }

  // Validate URL
  try {
    const parsedTarget = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid URL' }),
      { status: 400, headers },
    );
  }

  const domain = extractDomain(targetUrl);
  if (!domain) {
    return new Response(
      JSON.stringify({ success: false, error: 'Could not extract domain' }),
      { status: 400, headers },
    );
  }

  const providerConfig = OEMBED_PROVIDERS[domain];
  if (!providerConfig) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unsupported provider',
        supported: Object.keys(OEMBED_PROVIDERS),
      }),
      { status: 400, headers },
    );
  }

  // Check cache
  const cacheKey = `oembed:${targetUrl}`;
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, { headers });
      }
    } catch { /* cache miss */ }
  }

  // Fetch oEmbed data
  const oembedUrl = new URL(providerConfig.endpoint);
  oembedUrl.searchParams.set('url', targetUrl);
  oembedUrl.searchParams.set('format', 'json');

  try {
    const oembedResponse = await fetch(oembedUrl.toString(), {
      headers: {
        'User-Agent': 'BuildIt-oEmbed-Proxy/1.0',
        'Accept': 'application/json',
      },
    });

    if (!oembedResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `oEmbed request failed: ${oembedResponse.status}` }),
        { status: oembedResponse.status, headers },
      );
    }

    const oembed: OEmbedResponse = await oembedResponse.json();

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
    };

    if (oembed.html) {
      if (providerConfig.trusted) {
        const iframeSrc = extractIframeSrc(oembed.html);
        if (iframeSrc) {
          response.embedUrl = enhanceEmbedUrl(iframeSrc, domain);
        } else {
          response.embedHtml = sanitizeHtml(oembed.html);
        }
      } else {
        response.embedHtml = sanitizeHtml(oembed.html);
      }
    } else if (oembed.type === 'photo' && oembed.url) {
      response.embedUrl = oembed.url;
    }

    const responseJson = JSON.stringify(response);

    // Cache for 1 hour
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, responseJson, { expirationTtl: 3600 });
      } catch { /* cache write failed */ }
    }

    return new Response(responseJson, { headers });
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch oEmbed data' }),
      { status: 500, headers },
    );
  }
}
