/**
 * Nostr Client for SSR
 * Fetches public content from Nostr relays
 */

import { SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';
import {
  EVENT_KINDS,
  parseArticleFromEvent,
  type ArticleContent,
} from '@buildit/shared/nostr';
import { DEFAULT_RELAYS } from '@buildit/shared/nostr';

// Singleton pool instance
let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

/**
 * Fetch articles from Nostr relays
 */
export async function fetchArticles(
  options: {
    limit?: number;
    since?: number;
    until?: number;
    authors?: string[];
  } = {}
): Promise<ArticleContent[]> {
  const { limit = 20, since, until, authors } = options;
  const pool = getPool();

  const filter: Filter = {
    kinds: [EVENT_KINDS.LONG_FORM],
    limit,
    ...(since && { since }),
    ...(until && { until }),
    ...(authors && { authors }),
  };

  try {
    const events = await pool.querySync(DEFAULT_RELAYS as unknown as string[], filter);
    return events
      .map((event) => parseArticleFromEvent(event as NostrEvent))
      .filter((article): article is ArticleContent => article !== null)
      .sort((a, b) => b.publishedAt - a.publishedAt);
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return [];
  }
}

/**
 * Fetch a single article by slug
 */
export async function fetchArticleBySlug(
  slug: string
): Promise<ArticleContent | null> {
  const pool = getPool();

  const filter: Filter = {
    kinds: [EVENT_KINDS.LONG_FORM],
    '#d': [slug],
    limit: 1,
  };

  try {
    const events = await pool.querySync(DEFAULT_RELAYS as unknown as string[], filter);
    if (events.length === 0) return null;
    return parseArticleFromEvent(events[0] as NostrEvent);
  } catch (error) {
    console.error(`Failed to fetch article ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch public events from Nostr
 */
export async function fetchPublicEvents(
  options: {
    limit?: number;
    since?: number;
  } = {}
): Promise<NostrEvent[]> {
  const { limit = 50, since } = options;
  const pool = getPool();

  const filter: Filter = {
    kinds: [EVENT_KINDS.TIME_BASED_EVENT, EVENT_KINDS.DATE_BASED_EVENT],
    limit,
    ...(since && { since }),
  };

  try {
    return await pool.querySync(DEFAULT_RELAYS as unknown as string[], filter);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
}

/**
 * Fetch wiki pages from Nostr
 */
export async function fetchWikiPages(
  options: {
    limit?: number;
    groupId?: string;
  } = {}
): Promise<NostrEvent[]> {
  const { limit = 50, groupId } = options;
  const pool = getPool();

  const filter: Filter = {
    kinds: [EVENT_KINDS.WIKI_PAGE],
    limit,
    ...(groupId && { '#g': [groupId] }),
  };

  try {
    return await pool.querySync(DEFAULT_RELAYS as unknown as string[], filter);
  } catch (error) {
    console.error('Failed to fetch wiki pages:', error);
    return [];
  }
}

/**
 * Fetch wiki page by slug
 */
export async function fetchWikiPageBySlug(
  slug: string
): Promise<NostrEvent | null> {
  const pool = getPool();

  const filter: Filter = {
    kinds: [EVENT_KINDS.WIKI_PAGE],
    '#d': [slug],
    limit: 1,
  };

  try {
    const events = await pool.querySync(DEFAULT_RELAYS as unknown as string[], filter);
    return events[0] || null;
  } catch (error) {
    console.error(`Failed to fetch wiki page ${slug}:`, error);
    return null;
  }
}
