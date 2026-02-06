import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { fetchArticles, fetchPublicEvents, fetchWikiPages } from './lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';

/**
 * Security headers applied to all SSR responses.
 *
 * Content-Security-Policy restricts resource loading to prevent XSS and
 * data exfiltration. This is a public-facing SSR site for logged-out users
 * so the policy is relatively strict.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' wss://*.buildit.network https://*.buildit.network",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ============================================================================
// robots.txt and sitemap.xml generation
// ============================================================================

const SITE_URL = 'https://buildit.network';

function generateRobotsTxtContent(): string {
  return [
    '# BuildIt Network',
    '# https://buildit.network',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Public content pages',
    'Allow: /articles/',
    'Allow: /publications/',
    'Allow: /events/',
    'Allow: /wiki/',
    'Allow: /about',
    'Allow: /contact',
    'Allow: /privacy',
    'Allow: /docs',
    'Allow: /campaigns/',
    'Allow: /marketplace/',
    'Allow: /s/',
    '',
    '# Disallow internal/API paths',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /_internal/',
    '',
    '# Rate limiting for responsible crawling',
    'Crawl-delay: 1',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    `Host: ${SITE_URL}`,
    '',
  ].join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface SitemapEvent {
  id: string;
  title: string;
  createdAt: number;
}

interface SitemapWikiPage {
  slug: string;
  title: string;
  updatedAt: number;
}

function generateSitemapXml(
  articles: ArticleContent[],
  events: SitemapEvent[] = [],
  wikiPages: SitemapWikiPage[] = [],
): string {
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/articles', priority: '0.9', changefreq: 'daily' },
    { path: '/publications', priority: '0.8', changefreq: 'weekly' },
    { path: '/events', priority: '0.8', changefreq: 'daily' },
    { path: '/wiki', priority: '0.7', changefreq: 'weekly' },
    { path: '/about', priority: '0.6', changefreq: 'monthly' },
    { path: '/contact', priority: '0.5', changefreq: 'monthly' },
    { path: '/privacy', priority: '0.4', changefreq: 'monthly' },
    { path: '/docs', priority: '0.7', changefreq: 'weekly' },
  ];

  const staticEntries = staticPages
    .map(
      (page) => `
  <url>
    <loc>${escapeXml(`${SITE_URL}${page.path}`)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('');

  const articleEntries = articles
    .map((article) => {
      const lastmod = new Date(article.publishedAt).toISOString();
      return `
  <url>
    <loc>${escapeXml(`${SITE_URL}/articles/${article.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>${
      article.image
        ? `
    <image:image>
      <image:loc>${escapeXml(article.image)}</image:loc>
      <image:title>${escapeXml(article.title)}</image:title>
    </image:image>`
        : ''
    }
  </url>`;
    })
    .join('');

  // Unique tags for category pages
  const tagSet = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) {
      tagSet.add(tag.toLowerCase());
    }
  }

  const categoryEntries = Array.from(tagSet)
    .map(
      (tag) => `
  <url>
    <loc>${escapeXml(`${SITE_URL}/category/${tag.replace(/\s+/g, '-')}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`
    )
    .join('');

  // Unique year/month for archive pages
  const archiveMonths = new Set<string>();
  for (const article of articles) {
    const date = new Date(article.publishedAt);
    archiveMonths.add(
      `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  }

  const archiveEntries = Array.from(archiveMonths)
    .map(
      (monthPath) => `
  <url>
    <loc>${escapeXml(`${SITE_URL}/archive/${monthPath}`)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`
    )
    .join('');

  // Unique authors for publication pages
  const authorSet = new Set<string>();
  for (const article of articles) {
    if (article.authorPubkey) {
      authorSet.add(article.authorPubkey);
    }
  }

  const publicationEntries = Array.from(authorSet)
    .map(
      (pubkey) => `
  <url>
    <loc>${escapeXml(`${SITE_URL}/publications/${pubkey}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('');

  // Event entries
  const eventEntries = events
    .map((event) => {
      const lastmod = new Date(event.createdAt * 1000).toISOString();
      return `
  <url>
    <loc>${escapeXml(`${SITE_URL}/events/${event.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('');

  // Wiki page entries
  const wikiEntries = wikiPages
    .map((page) => {
      const lastmod = new Date(page.updatedAt).toISOString();
      return `
  <url>
    <loc>${escapeXml(`${SITE_URL}/wiki/${page.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
  <!-- Static pages -->${staticEntries}

  <!-- Articles -->${articleEntries}

  <!-- Publications -->${publicationEntries}

  <!-- Events -->${eventEntries}

  <!-- Wiki Pages -->${wikiEntries}

  <!-- Categories -->${categoryEntries}

  <!-- Archives -->${archiveEntries}
</urlset>`;
}

export default createServerEntry({
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Proxy WebFinger and NodeInfo to federation worker
    if (url.pathname === '/.well-known/webfinger' || url.pathname.startsWith('/.well-known/nodeinfo')) {
      try {
        const federationUrl = new URL(request.url);
        federationUrl.hostname = 'buildit-federation.rikki-schulte.workers.dev';
        const res = await fetch(federationUrl.toString(), {
          method: request.method,
          headers: request.headers,
        });
        return new Response(res.body, {
          status: res.status,
          headers: res.headers,
        });
      } catch (error) {
        console.error('Federation proxy error:', error);
        return new Response(JSON.stringify({ error: 'Federation service unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Intercept /robots.txt and serve with text/plain content type
    if (url.pathname === '/robots.txt') {
      const content = generateRobotsTxtContent();
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Intercept /sitemap.xml and serve with application/xml content type
    if (url.pathname === '/sitemap.xml') {
      try {
        const [articles, rawEvents, rawWikiPages] = await Promise.all([
          fetchArticles({ limit: 200 }),
          fetchPublicEvents({ limit: 200 }),
          fetchWikiPages({ limit: 200 }),
        ]);
        const sitemapEvents: SitemapEvent[] = rawEvents.map((e) => {
          const getTag = (name: string): string | undefined => {
            const tag = e.tags.find((t: string[]) => t[0] === name);
            return tag ? tag[1] : undefined;
          };
          return {
            id: e.id,
            title: getTag('title') || 'Event',
            createdAt: e.created_at,
          };
        });
        const sitemapWikiPages: SitemapWikiPage[] = rawWikiPages.map((e) => {
          const getTag = (name: string): string | undefined => {
            const tag = e.tags.find((t: string[]) => t[0] === name);
            return tag ? tag[1] : undefined;
          };
          return {
            slug: getTag('d') || e.id,
            title: getTag('title') || 'Untitled',
            updatedAt: e.created_at * 1000,
          };
        });
        const xml = generateSitemapXml(articles, sitemapEvents, sitemapWikiPages);
        return new Response(xml, {
          status: 200,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch (error) {
        console.error('Failed to generate sitemap:', error);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
          status: 500,
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        });
      }
    }

    // Default SSR handler for all other routes
    const response = await handler.fetch(request);

    // Clone the response to add security headers (Response headers may be immutable)
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
