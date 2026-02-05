import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchArticles } from '../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';

const SITE_URL = 'https://buildit.network';
const SITE_NAME = 'BuildIt Network';
const SITE_DESCRIPTION =
  'A privacy-first organizing platform for activist groups, co-ops, unions, and community organizers.';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRFC822Date(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toUTCString();
}

function generateRssXml(articles: ArticleContent[]): string {
  const lastBuildDate = articles.length > 0
    ? formatRFC822Date(articles[0].publishedAt)
    : formatRFC822Date(Date.now());

  const items = articles
    .map(
      (article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${SITE_URL}/articles/${escapeXml(article.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/articles/${escapeXml(article.slug)}</guid>
      <pubDate>${formatRFC822Date(article.publishedAt)}</pubDate>
      <description>${escapeXml(article.summary || article.content.slice(0, 200))}</description>
      ${article.authorName ? `<author>${escapeXml(article.authorName)}</author>` : ''}
      ${article.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
      ${article.image ? `<enclosure url="${escapeXml(article.image)}" type="image/jpeg" />` : ''}
    </item>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>BuildIt Network SSR</generator>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}

const getRssFeed = createServerFn({ method: 'GET' }).handler(async () => {
  const articles = await fetchArticles({ limit: 50 });
  return generateRssXml(articles);
});

export const Route = createFileRoute('/feed/xml')({
  loader: async () => {
    const xml = await getRssFeed();
    return { xml };
  },
  component: RssFeedPage,
});

// This component won't actually render - the route is intercepted
// and serves XML directly via the loader
function RssFeedPage() {
  const { xml } = Route.useLoaderData() as { xml: string };

  // In TanStack Start, we'd ideally use a Response object
  // For now, display the XML as preformatted text
  return (
    <pre
      style={{
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        whiteSpace: 'pre-wrap',
        padding: '1rem',
      }}
    >
      {xml}
    </pre>
  );
}
