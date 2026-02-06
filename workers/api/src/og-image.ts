/**
 * OG Image Generation API
 *
 * Generates branded Open Graph images as SVG for social media sharing.
 * Supports multiple template types for different content types.
 *
 * GET /api/og-image?type=...&title=...&...
 *
 * Query parameters:
 * - type (required): article | event | listing | campaign | profile | default
 * - title (required): Main title text
 * - description (optional): Subtitle/description text
 * - author (optional): Author name
 * - date (optional): Date string (for events)
 * - location (optional): Location (for events)
 * - price (optional): Price (for listings)
 * - progress (optional): 0-100 (for campaigns)
 * - goal (optional): Goal amount (for campaigns)
 * - avatar (optional): URL for profile images
 * - brand (optional): Custom brand color hex (without #)
 */

import type { Env } from './index';

const CACHE_TTL = 86400; // 24 hours
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const DEFAULT_BRAND_COLOR = '#3b82f6'; // blue-500
const BACKGROUND_FROM = '#1e293b'; // slate-800
const BACKGROUND_TO = '#0f172a'; // slate-900
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#94a3b8'; // slate-400

type OgImageType = 'article' | 'event' | 'listing' | 'campaign' | 'profile' | 'default';

interface OgImageParams {
  type: OgImageType;
  title: string;
  description?: string;
  author?: string;
  date?: string;
  location?: string;
  price?: string;
  progress?: number;
  goal?: string;
  avatar?: string;
  brand?: string;
}

/**
 * XSS protection: escape text for SVG.
 * SVG text content must escape XML special chars.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate text to fit within specified character limit.
 * Adds ellipsis if truncated.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Word wrap text to fit within specified width.
 * Returns array of lines.
 */
function wordWrap(text: string, maxCharsPerLine: number, maxLines: number = 3): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;

      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Truncate last line if we hit max lines
  if (lines.length === maxLines) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], maxCharsPerLine);
  }

  return lines;
}

/**
 * Generate BuildIt logo SVG component
 */
function generateLogo(x: number, y: number, size: number = 24): string {
  return `
    <text
      x="${x}"
      y="${y}"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="${size}"
      font-weight="700"
      fill="${TEXT_PRIMARY}"
      opacity="0.8"
    >BuildIt</text>
  `;
}

/**
 * Generate article template OG image
 */
function generateArticleTemplate(params: OgImageParams, brandColor: string): string {
  const titleLines = wordWrap(params.title, 45, 3);
  const description = params.description || '';
  const author = params.author || 'BuildIt Network';
  const readingTime = description ? `${Math.ceil(description.split(' ').length / 200)} min read` : '';

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Accent bar -->
      <rect x="80" y="120" width="6" height="390" fill="${brandColor}" rx="3" />

      <!-- Title -->
      ${titleLines.map((line, i) => `
        <text
          x="120"
          y="${180 + i * 75}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="64"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Metadata -->
      <text
        x="120"
        y="${470}"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="28"
        font-weight="500"
        fill="${TEXT_SECONDARY}"
      >${escapeXml(author)}${readingTime ? ' • ' + readingTime : ''}</text>

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate event template OG image
 */
function generateEventTemplate(params: OgImageParams, brandColor: string): string {
  const titleLines = wordWrap(params.title, 40, 2);
  const date = params.date || '';
  const location = params.location || '';

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Calendar icon -->
      <rect x="80" y="140" width="120" height="120" fill="${brandColor}" rx="12" />
      <rect x="90" y="160" width="100" height="80" fill="${TEXT_PRIMARY}" rx="8" />
      <rect x="100" y="150" width="25" height="30" fill="${brandColor}" rx="4" />
      <rect x="155" y="150" width="25" height="30" fill="${brandColor}" rx="4" />

      <!-- Title -->
      ${titleLines.map((line, i) => `
        <text
          x="240"
          y="${200 + i * 75}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="64"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Date -->
      ${date ? `
        <text
          x="240"
          y="420"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="32"
          font-weight="600"
          fill="${brandColor}"
        >${escapeXml(truncate(date, 50))}</text>
      ` : ''}

      <!-- Location -->
      ${location ? `
        <text
          x="240"
          y="470"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="28"
          font-weight="500"
          fill="${TEXT_SECONDARY}"
        >📍 ${escapeXml(truncate(location, 60))}</text>
      ` : ''}

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate listing template OG image
 */
function generateListingTemplate(params: OgImageParams, brandColor: string): string {
  const titleLines = wordWrap(params.title, 40, 2);
  const price = params.price || '';
  const description = params.description || '';

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Price badge -->
      ${price ? `
        <rect x="80" y="140" width="auto" height="70" fill="${brandColor}" rx="12" />
        <text
          x="110"
          y="190"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="42"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(price)}</text>
      ` : ''}

      <!-- Title -->
      ${titleLines.map((line, i) => `
        <text
          x="80"
          y="${280 + i * 75}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="64"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Description -->
      ${description ? `
        <text
          x="80"
          y="480"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="28"
          font-weight="500"
          fill="${TEXT_SECONDARY}"
        >${escapeXml(truncate(description, 80))}</text>
      ` : ''}

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate campaign template OG image with progress bar
 */
function generateCampaignTemplate(params: OgImageParams, brandColor: string): string {
  const titleLines = wordWrap(params.title, 40, 2);
  const progress = Math.min(100, Math.max(0, params.progress || 0));
  const goal = params.goal || '';

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Title -->
      ${titleLines.map((line, i) => `
        <text
          x="80"
          y="${180 + i * 75}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="64"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Progress bar background -->
      <rect x="80" y="380" width="1040" height="40" fill="${BACKGROUND_TO}" rx="20" />

      <!-- Progress bar fill -->
      <rect x="80" y="380" width="${(1040 * progress) / 100}" height="40" fill="${brandColor}" rx="20" />

      <!-- Progress text -->
      <text
        x="600"
        y="470"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="36"
        font-weight="600"
        fill="${TEXT_PRIMARY}"
        text-anchor="middle"
      >${progress}%${goal ? ` of ${escapeXml(goal)}` : ''}</text>

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate profile template OG image
 */
function generateProfileTemplate(params: OgImageParams, brandColor: string): string {
  const name = params.title;
  const bio = params.description || '';
  const bioLines = wordWrap(bio, 60, 3);

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Avatar placeholder (circle) -->
      <circle cx="180" cy="240" r="100" fill="${brandColor}" />
      <text
        x="180"
        y="265"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="72"
        font-weight="600"
        fill="${TEXT_PRIMARY}"
        text-anchor="middle"
      >${escapeXml(name.charAt(0).toUpperCase())}</text>

      <!-- Name -->
      <text
        x="340"
        y="240"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="56"
        font-weight="700"
        fill="${TEXT_PRIMARY}"
      >${escapeXml(truncate(name, 30))}</text>

      <!-- Bio -->
      ${bioLines.map((line, i) => `
        <text
          x="340"
          y="${310 + i * 40}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="28"
          font-weight="500"
          fill="${TEXT_SECONDARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate default template OG image
 */
function generateDefaultTemplate(params: OgImageParams, brandColor: string): string {
  const titleLines = wordWrap(params.title, 40, 3);
  const description = params.description || '';
  const descLines = wordWrap(description, 60, 2);

  return `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BACKGROUND_FROM};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BACKGROUND_TO};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

      <!-- Decorative element -->
      <rect x="80" y="120" width="120" height="120" fill="${brandColor}" rx="20" opacity="0.8" />

      <!-- Title -->
      ${titleLines.map((line, i) => `
        <text
          x="240"
          y="${200 + i * 75}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="64"
          font-weight="700"
          fill="${TEXT_PRIMARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Description -->
      ${descLines.map((line, i) => `
        <text
          x="240"
          y="${430 + i * 40}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="28"
          font-weight="500"
          fill="${TEXT_SECONDARY}"
        >${escapeXml(line)}</text>
      `).join('')}

      <!-- Logo -->
      ${generateLogo(1020, 580, 32)}
    </svg>
  `;
}

/**
 * Generate OG image SVG based on type
 */
function generateOgImage(params: OgImageParams): string {
  const brandColor = params.brand ? `#${params.brand.replace('#', '')}` : DEFAULT_BRAND_COLOR;

  switch (params.type) {
    case 'article':
      return generateArticleTemplate(params, brandColor);
    case 'event':
      return generateEventTemplate(params, brandColor);
    case 'listing':
      return generateListingTemplate(params, brandColor);
    case 'campaign':
      return generateCampaignTemplate(params, brandColor);
    case 'profile':
      return generateProfileTemplate(params, brandColor);
    case 'default':
    default:
      return generateDefaultTemplate(params, brandColor);
  }
}

/**
 * Generate cache key from params
 */
function getCacheKey(params: OgImageParams): string {
  const parts = [
    params.type,
    params.title,
    params.description || '',
    params.author || '',
    params.date || '',
    params.location || '',
    params.price || '',
    params.progress?.toString() || '',
    params.goal || '',
    params.avatar || '',
    params.brand || '',
  ];

  // Simple hash function for cache key
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `og-image:${hash.toString(36)}`;
}

/**
 * Parse and validate query parameters
 */
function parseParams(url: URL): { params: OgImageParams | null; error: string | null } {
  const type = url.searchParams.get('type') as OgImageType;
  const title = url.searchParams.get('title');

  if (!type) {
    return { params: null, error: 'Missing type parameter' };
  }

  if (!['article', 'event', 'listing', 'campaign', 'profile', 'default'].includes(type)) {
    return { params: null, error: 'Invalid type. Must be: article, event, listing, campaign, profile, or default' };
  }

  if (!title) {
    return { params: null, error: 'Missing title parameter' };
  }

  const progressStr = url.searchParams.get('progress');
  const progress = progressStr ? parseFloat(progressStr) : undefined;

  const params: OgImageParams = {
    type,
    title,
    description: url.searchParams.get('description') || undefined,
    author: url.searchParams.get('author') || undefined,
    date: url.searchParams.get('date') || undefined,
    location: url.searchParams.get('location') || undefined,
    price: url.searchParams.get('price') || undefined,
    progress,
    goal: url.searchParams.get('goal') || undefined,
    avatar: url.searchParams.get('avatar') || undefined,
    brand: url.searchParams.get('brand') || undefined,
  };

  return { params, error: null };
}

export async function handleOgImage(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const { params, error } = parseParams(url);

  if (error || !params) {
    return new Response(
      JSON.stringify({ error }),
      {
        status: 400,
        headers: {
          ...cors,
          'Content-Type': 'application/json'
        }
      },
    );
  }

  // Check cache
  const cacheKey = getCacheKey(params);
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            ...cors,
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch { /* cache miss */ }
  }

  // Generate SVG
  const svg = generateOgImage(params);

  // Cache the result
  if (env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, svg, { expirationTtl: CACHE_TTL });
    } catch { /* cache write failed */ }
  }

  return new Response(svg, {
    headers: {
      ...cors,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS',
    },
  });
}
