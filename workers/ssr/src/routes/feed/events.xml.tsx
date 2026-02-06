/**
 * Events RSS Feed
 *
 * Provides an RSS 2.0 feed of public events for feed readers.
 * No tracking, no analytics — pure content syndication.
 */

import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchPublicEvents } from '../../lib/nostr';

const SITE_URL = 'https://buildit.network';
const SITE_NAME = 'BuildIt Network';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRFC822Date(timestamp: number): string {
  return new Date(timestamp).toUTCString();
}

function generateEventsRssXml(events: Array<{
  id: string;
  title: string;
  description: string;
  startTime?: number;
  location?: string;
  tags: string[];
  createdAt: number;
}>): string {
  const lastBuildDate = events.length > 0
    ? formatRFC822Date(events[0].createdAt * 1000)
    : formatRFC822Date(Date.now());

  const items = events
    .map((event) => `
    <item>
      <title>${escapeXml(event.title)}</title>
      <link>${SITE_URL}/events/${escapeXml(event.id)}</link>
      <guid isPermaLink="true">${SITE_URL}/events/${escapeXml(event.id)}</guid>
      <pubDate>${formatRFC822Date(event.createdAt * 1000)}</pubDate>
      <description>${escapeXml(event.description)}${event.startTime ? `\n\nDate: ${new Date(event.startTime * 1000).toISOString()}` : ''}${event.location ? `\nLocation: ${event.location}` : ''}</description>
      ${event.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Events</title>
    <link>${SITE_URL}/events</link>
    <description>Upcoming community events from ${escapeXml(SITE_NAME)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>BuildIt Network SSR</generator>
    <atom:link href="${SITE_URL}/feed/events.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}

const getEventsRssFeed = createServerFn({ method: 'GET' }).handler(async () => {
  const events = await fetchPublicEvents({ limit: 50 });
  const parsedEvents = events.map((event) => {
    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t: string[]) => t[0] === name);
      return tag ? tag[1] : undefined;
    };
    const startTag = getTag('start');
    return {
      id: event.id,
      title: getTag('title') || getTag('name') || 'Untitled Event',
      description: getTag('summary') || event.content.slice(0, 300),
      startTime: startTag ? parseInt(startTag) : undefined,
      location: getTag('location'),
      tags: event.tags.filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1]),
      createdAt: event.created_at,
    };
  });
  return generateEventsRssXml(parsedEvents);
});

export const Route = createFileRoute('/feed/events/xml')({
  loader: async () => {
    const xml = await getEventsRssFeed();
    return { xml };
  },
  component: EventsRssFeedPage,
});

function EventsRssFeedPage() {
  const { xml } = Route.useLoaderData() as { xml: string };
  return (
    <pre style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', padding: '1rem' }}>
      {xml}
    </pre>
  );
}
