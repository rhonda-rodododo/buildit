/**
 * SEO Utilities for BuildIt SSR Worker
 *
 * Generates robots.txt, sitemap.xml, Schema.org structured data,
 * Open Graph meta tags, and Twitter Card meta tags for publication content.
 */

// ============================================================================
// Types
// ============================================================================

interface SeoArticle {
  slug: string;
  title: string;
  summary?: string;
  content: string;
  image?: string;
  authorName?: string;
  authorPubkey?: string;
  publishedAt: number;
  updatedAt?: number;
  tags: string[];
  wordCount?: number;
}

interface SeoPublication {
  slug: string;
  name: string;
  description: string;
  logo?: string;
  coverImage?: string;
  ownerName?: string;
  ownerPubkey?: string;
  customDomain?: string;
}

interface SeoAuthor {
  name: string;
  pubkey: string;
  avatar?: string;
  bio?: string;
  website?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SITE_URL = 'https://buildit.network';
const SITE_NAME = 'BuildIt Network';

// ============================================================================
// robots.txt Generation
// ============================================================================

/**
 * Generate robots.txt for a publication domain.
 *
 * @param publication The publication data
 * @param baseUrl Optional custom base URL (for custom domains)
 * @returns robots.txt content string
 */
export function generateRobotsTxt(
  publication: SeoPublication,
  baseUrl?: string
): string {
  const url = baseUrl || `${SITE_URL}/publications/${publication.slug}`;

  return [
    '# BuildIt Network Publication',
    `# Publication: ${publication.name}`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Disallow admin/internal paths',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /_internal/',
    '',
    '# Rate limiting for responsible crawling',
    'Crawl-delay: 1',
    '',
    `Sitemap: ${url}/sitemap.xml`,
    '',
  ].join('\n');
}

// ============================================================================
// sitemap.xml Generation
// ============================================================================

/**
 * Generate sitemap.xml for a publication and its articles.
 *
 * @param publication The publication data
 * @param articles Array of published articles
 * @param baseUrl Optional custom base URL
 * @returns sitemap.xml content string
 */
export function generateSitemap(
  publication: SeoPublication,
  articles: SeoArticle[],
  baseUrl?: string
): string {
  const url = baseUrl || SITE_URL;

  const articleEntries = articles
    .map((article) => {
      const lastmod = article.updatedAt
        ? new Date(article.updatedAt).toISOString()
        : new Date(article.publishedAt).toISOString();

      return `
  <url>
    <loc>${escapeXml(`${url}/articles/${article.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    ${article.image ? `<image:image>
      <image:loc>${escapeXml(article.image)}</image:loc>
      <image:title>${escapeXml(article.title)}</image:title>
    </image:image>` : ''}
  </url>`;
    })
    .join('');

  // Collect unique tags for category pages
  const tagSet = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) {
      tagSet.add(tag.toLowerCase());
    }
  }

  const categoryEntries = Array.from(tagSet)
    .map((tag) => `
  <url>
    <loc>${escapeXml(`${url}/category/${tag.replace(/\s+/g, '-')}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`)
    .join('');

  // Collect unique month/year for archive pages
  const archiveMonths = new Set<string>();
  for (const article of articles) {
    const date = new Date(article.publishedAt);
    archiveMonths.add(
      `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  }

  const archiveEntries = Array.from(archiveMonths)
    .map((monthPath) => `
  <url>
    <loc>${escapeXml(`${url}/archive/${monthPath}`)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
  <!-- Publication home -->
  <url>
    <loc>${escapeXml(`${url}/publications/${publication.slug}`)}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Articles -->
  ${articleEntries}

  <!-- Categories -->
  ${categoryEntries}

  <!-- Archives -->
  ${archiveEntries}
</urlset>`;
}

// ============================================================================
// Schema.org Structured Data
// ============================================================================

/**
 * Generate Schema.org Article structured data (JSON-LD).
 *
 * @param article The article data
 * @param publication The publication data
 * @param baseUrl Optional custom base URL
 * @returns JSON-LD script tag content
 */
export function generateStructuredData(
  article: SeoArticle,
  publication: SeoPublication,
  baseUrl?: string
): string {
  const url = baseUrl || SITE_URL;
  const articleUrl = `${url}/articles/${article.slug}`;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary || article.content.slice(0, 160),
    url: articleUrl,
    datePublished: new Date(article.publishedAt).toISOString(),
    ...(article.updatedAt && {
      dateModified: new Date(article.updatedAt).toISOString(),
    }),
    ...(article.image && {
      image: {
        '@type': 'ImageObject',
        url: article.image,
      },
    }),
    ...(article.wordCount && { wordCount: article.wordCount }),
    keywords: article.tags.join(', '),
    inLanguage: 'en',
    isAccessibleForFree: true,
    author: {
      '@type': 'Person',
      name: article.authorName || 'Anonymous',
      ...(article.authorPubkey && {
        identifier: article.authorPubkey,
      }),
    },
    publisher: {
      '@type': 'Organization',
      name: publication.name,
      description: publication.description,
      ...(publication.logo && {
        logo: {
          '@type': 'ImageObject',
          url: publication.logo,
        },
      }),
      url: `${url}/publications/${publication.slug}`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  };

  return JSON.stringify(structuredData, null, 2);
}

/**
 * Generate Schema.org Person structured data for author pages.
 *
 * @param author The author data
 * @param articles Articles by this author
 * @param baseUrl Optional custom base URL
 * @returns JSON-LD script tag content
 */
export function generateAuthorStructuredData(
  author: SeoAuthor,
  articles: SeoArticle[],
  baseUrl?: string
): string {
  const url = baseUrl || SITE_URL;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    identifier: author.pubkey,
    ...(author.avatar && { image: author.avatar }),
    ...(author.bio && { description: author.bio }),
    ...(author.website && { url: author.website }),
    mainEntityOfPage: {
      '@type': 'ProfilePage',
      '@id': `${url}/author/${author.pubkey.slice(0, 16)}`,
    },
    // Include article count and most recent article info
    ...(articles.length > 0 && {
      knowsAbout: Array.from(
        new Set(articles.flatMap((a) => a.tags))
      ).slice(0, 10),
    }),
  };

  return JSON.stringify(structuredData, null, 2);
}

/**
 * Generate Schema.org Organization structured data for a publication.
 *
 * @param publication The publication data
 * @param baseUrl Optional custom base URL
 * @returns JSON-LD script tag content
 */
export function generatePublicationStructuredData(
  publication: SeoPublication,
  baseUrl?: string
): string {
  const url = baseUrl || SITE_URL;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: publication.name,
    description: publication.description,
    url: `${url}/publications/${publication.slug}`,
    ...(publication.logo && {
      logo: {
        '@type': 'ImageObject',
        url: publication.logo,
      },
    }),
    ...(publication.coverImage && {
      image: publication.coverImage,
    }),
  };

  return JSON.stringify(structuredData, null, 2);
}

// ============================================================================
// Open Graph Meta Tags
// ============================================================================

/**
 * Generate Open Graph meta tags for an article.
 *
 * @param article The article data
 * @param publication The publication data
 * @param baseUrl Optional custom base URL
 * @returns Array of { property, content } objects for meta tags
 */
export function generateOpenGraphMeta(
  article: SeoArticle,
  publication: SeoPublication,
  baseUrl?: string
): Array<{ property: string; content: string }> {
  const url = baseUrl || SITE_URL;
  const articleUrl = `${url}/articles/${article.slug}`;
  const description = article.summary || article.content.replace(/<[^>]+>/g, '').slice(0, 200);

  const meta: Array<{ property: string; content: string }> = [
    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: article.title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: articleUrl },
    { property: 'og:site_name', content: publication.name },
    { property: 'og:locale', content: 'en_US' },
    {
      property: 'article:published_time',
      content: new Date(article.publishedAt).toISOString(),
    },
  ];

  if (article.updatedAt) {
    meta.push({
      property: 'article:modified_time',
      content: new Date(article.updatedAt).toISOString(),
    });
  }

  if (article.image) {
    meta.push(
      { property: 'og:image', content: article.image },
      { property: 'og:image:alt', content: article.title }
    );
  } else if (publication.coverImage) {
    meta.push(
      { property: 'og:image', content: publication.coverImage },
      { property: 'og:image:alt', content: publication.name }
    );
  }

  if (article.authorName) {
    meta.push({ property: 'article:author', content: article.authorName });
  }

  for (const tag of article.tags) {
    meta.push({ property: 'article:tag', content: tag });
  }

  return meta;
}

/**
 * Generate Open Graph meta tags for a publication page.
 */
export function generatePublicationOpenGraphMeta(
  publication: SeoPublication,
  baseUrl?: string
): Array<{ property: string; content: string }> {
  const url = baseUrl || SITE_URL;
  const pubUrl = `${url}/publications/${publication.slug}`;

  const meta: Array<{ property: string; content: string }> = [
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: publication.name },
    { property: 'og:description', content: publication.description },
    { property: 'og:url', content: pubUrl },
    { property: 'og:site_name', content: SITE_NAME },
  ];

  if (publication.logo) {
    meta.push(
      { property: 'og:image', content: publication.logo },
      { property: 'og:image:alt', content: publication.name }
    );
  }

  return meta;
}

// ============================================================================
// Twitter Card Meta Tags
// ============================================================================

/**
 * Generate Twitter Card meta tags for an article.
 *
 * @param article The article data
 * @param publication The publication data
 * @returns Array of { name, content } objects for meta tags
 */
export function generateTwitterCardMeta(
  article: SeoArticle,
  publication: SeoPublication
): Array<{ name: string; content: string }> {
  const description = article.summary || article.content.replace(/<[^>]+>/g, '').slice(0, 200);
  const siteName = publication.name || SITE_NAME;

  const meta: Array<{ name: string; content: string }> = [
    {
      name: 'twitter:card',
      content: article.image ? 'summary_large_image' : 'summary',
    },
    { name: 'twitter:title', content: article.title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:site', content: `@${siteName.replace(/\s+/g, '')}` },
  ];

  if (article.image) {
    meta.push(
      { name: 'twitter:image', content: article.image },
      { name: 'twitter:image:alt', content: article.title }
    );
  }

  if (article.authorName) {
    meta.push({ name: 'twitter:creator', content: article.authorName });
  }

  return meta;
}

/**
 * Generate Twitter Card meta tags for a publication page.
 */
export function generatePublicationTwitterCardMeta(
  publication: SeoPublication
): Array<{ name: string; content: string }> {
  const meta: Array<{ name: string; content: string }> = [
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: publication.name },
    { name: 'twitter:description', content: publication.description },
    { name: 'twitter:site', content: `@${SITE_NAME.replace(/\s+/g, '')}` },
  ];

  if (publication.logo) {
    meta.push(
      { name: 'twitter:image', content: publication.logo },
      { name: 'twitter:image:alt', content: publication.name }
    );
  }

  return meta;
}

// ============================================================================
// Combined Meta Tag Generation
// ============================================================================

/**
 * Generate all SEO meta tags for an article page.
 * Combines Open Graph, Twitter Card, and standard meta tags.
 *
 * @returns Object with arrays of meta tags, link tags, and script content
 */
export function generateArticleSeoMeta(
  article: SeoArticle,
  publication: SeoPublication,
  baseUrl?: string
): {
  meta: Array<{ name?: string; property?: string; content: string }>;
  links: Array<{ rel: string; href?: string; type?: string; title?: string }>;
  structuredData: string;
} {
  const url = baseUrl || SITE_URL;
  const articleUrl = `${url}/articles/${article.slug}`;
  const description = article.summary || article.content.replace(/<[^>]+>/g, '').slice(0, 160);

  const ogMeta = generateOpenGraphMeta(article, publication, baseUrl);
  const twitterMeta = generateTwitterCardMeta(article, publication);

  const meta: Array<{ name?: string; property?: string; content: string }> = [
    // Standard meta
    { name: 'description', content: description },
    { name: 'author', content: article.authorName || 'Anonymous' },
    { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large' },

    // Open Graph
    ...ogMeta.map((m) => ({ property: m.property, content: m.content })),

    // Twitter Cards
    ...twitterMeta.map((m) => ({ name: m.name, content: m.content })),
  ];

  const links: Array<{ rel: string; href?: string; type?: string; title?: string }> = [
    { rel: 'canonical', href: articleUrl },
  ];

  // Add RSS feed link if publication has RSS
  if (publication.slug) {
    links.push({
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${publication.name} RSS Feed`,
      href: `${url}/publications/${publication.slug}/feed.xml`,
    });
  }

  const structuredData = generateStructuredData(article, publication, baseUrl);

  return { meta, links, structuredData };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape XML entities
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
