/**
 * Nostr Event Types for Public Content
 * NIP-compliant event kinds for BuildIt Network
 */

/**
 * Nostr event kinds used for public content
 * Based on NIPs (Nostr Implementation Possibilities)
 */
export const EVENT_KINDS = {
  // NIP-01: Basic protocol
  METADATA: 0, // User profile metadata
  TEXT_NOTE: 1, // Short text note

  // NIP-23: Long-form content
  LONG_FORM: 30023, // Long-form article

  // NIP-52: Calendar events
  DATE_BASED_EVENT: 31922, // Date-based calendar event
  TIME_BASED_EVENT: 31923, // Time-based calendar event
  CALENDAR: 31924, // Calendar metadata

  // Custom kinds for BuildIt (using parameterized replaceable range 30000-39999)
  WIKI_PAGE: 30078, // Wiki page content
  PUBLIC_PAGE: 30079, // Public page content
  CAMPAIGN: 30080, // Campaign/fundraising page
} as const;

export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];

/**
 * Base Nostr event structure
 */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Filter for querying events
 */
export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  '#d'?: string[]; // d-tag (identifier for replaceable events)
  '#t'?: string[]; // t-tag (hashtags)
  '#p'?: string[]; // p-tag (mentioned pubkeys)
  '#e'?: string[]; // e-tag (referenced events)
}

/**
 * Article content from NIP-23 long-form event
 */
export interface ArticleContent {
  id: string;
  pubkey: string;
  slug: string;
  title: string;
  summary?: string;
  image?: string;
  content: string;
  publishedAt: number;
  tags: string[];
}

/**
 * Parse NIP-23 long-form article from Nostr event
 */
export function parseArticleFromEvent(event: NostrEvent): ArticleContent | null {
  if (event.kind !== EVENT_KINDS.LONG_FORM) return null;

  const getTag = (name: string): string | undefined => {
    const tag = event.tags.find((t) => t[0] === name);
    return tag ? tag[1] : undefined;
  };

  const getAllTags = (name: string): string[] => {
    return event.tags.filter((t) => t[0] === name).map((t) => t[1]);
  };

  const slug = getTag('d');
  const title = getTag('title');

  if (!slug || !title) return null;

  return {
    id: event.id,
    pubkey: event.pubkey,
    slug,
    title,
    summary: getTag('summary'),
    image: getTag('image'),
    content: event.content,
    publishedAt: event.created_at * 1000,
    tags: getAllTags('t'),
  };
}
