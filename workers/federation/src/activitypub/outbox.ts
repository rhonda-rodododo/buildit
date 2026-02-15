/**
 * Nostr → ActivityPub content conversion
 *
 * Converts public Nostr events into ActivityPub activities for federation.
 */

import type { NostrEvent, Env } from '../types';
import { NOSTR_KINDS } from '../types';
import { AP_MAX_CONTENT_LENGTH } from '../config';

/** Represents a converted AP activity ready for delivery */
export interface APActivity {
  '@context': readonly string[];
  id: string;
  type: string;
  actor: string;
  published: string;
  to: string[];
  cc: string[];
  object?: APObject;
}

export interface APObject {
  id: string;
  type: string;
  attributedTo: string;
  content: string;
  published: string;
  to: string[];
  cc: string[];
  url?: string;
  inReplyTo?: string | null;
  tag?: APTag[];
  name?: string;
  summary?: string;
  mediaType?: string;
  source?: { content: string; mediaType: string };
}

interface APTag {
  type: string;
  href?: string;
  name: string;
}

const PUBLIC_ADDRESSING = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * Convert a Nostr kind:1 (short note) to an AP Note
 */
export function nostrNoteToAPNote(
  event: NostrEvent,
  username: string,
  domain: string,
): APObject {
  const actorUrl = `https://${domain}/ap/users/${username}`;
  const noteUrl = `${actorUrl}/posts/${event.id}`;

  // Extract hashtags from Nostr tags
  const hashtags = event.tags
    .filter((t: string[]) => t[0] === 't' && t[1])
    .map((t: string[]) => t[1].toLowerCase());

  // Convert content: Nostr uses plain text, AP uses HTML
  let htmlContent = escapeHtml(event.content);

  // Convert URLs to links — strip trailing punctuation before wrapping in <a> tags
  htmlContent = htmlContent.replace(
    /(https?:\/\/[^\s<]+)/g,
    (_match, url: string) => {
      // Strip trailing sentence punctuation
      const cleaned = url.replace(/[.,;:!?)]+$/, '');
      const trailing = url.slice(cleaned.length);
      return `<a href="${cleaned}" rel="nofollow noopener noreferrer" target="_blank">${cleaned}</a>${trailing}`;
    },
  );

  // Convert hashtags to links
  for (const tag of hashtags) {
    const regex = new RegExp(`#${escapeRegExp(tag)}\\b`, 'gi');
    htmlContent = htmlContent.replace(
      regex,
      `<a href="https://${domain}/tags/${tag}" class="hashtag" rel="tag">#${tag}</a>`,
    );
  }

  // Convert newlines to <br>
  htmlContent = htmlContent.replace(/\n/g, '<br>');

  // Truncate if needed
  if (htmlContent.length > AP_MAX_CONTENT_LENGTH) {
    htmlContent = htmlContent.slice(0, AP_MAX_CONTENT_LENGTH - 3) + '...';
  }

  const tags: APTag[] = hashtags.map((tag: string) => ({
    type: 'Hashtag',
    href: `https://${domain}/tags/${tag}`,
    name: `#${tag}`,
  }));

  // Check for reply
  const replyTag = event.tags.find((t: string[]) => t[0] === 'e' && t[3] === 'reply');
  const inReplyTo = replyTag
    ? `https://${domain}/ap/posts/${replyTag[1]}`
    : null;

  return {
    id: noteUrl,
    type: 'Note',
    attributedTo: actorUrl,
    content: htmlContent,
    published: new Date(event.created_at * 1000).toISOString(),
    to: [PUBLIC_ADDRESSING],
    cc: [`${actorUrl}/followers`],
    url: `https://${domain}/@${username}/posts/${event.id}`,
    inReplyTo,
    tag: tags.length > 0 ? tags : undefined,
    source: {
      content: event.content,
      mediaType: 'text/plain',
    },
  };
}

/**
 * Convert a Nostr kind:30023 (long-form article) to an AP Article
 */
export function nostrArticleToAPArticle(
  event: NostrEvent,
  username: string,
  domain: string,
): APObject {
  const actorUrl = `https://${domain}/ap/users/${username}`;

  // Extract article metadata from tags
  const title = event.tags.find((t: string[]) => t[0] === 'title')?.[1] ?? 'Untitled';
  const summary = event.tags.find((t: string[]) => t[0] === 'summary')?.[1];
  const dTag = event.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? event.id;
  const articleUrl = `${actorUrl}/articles/${dTag}`;

  const hashtags = event.tags
    .filter((t: string[]) => t[0] === 't' && t[1])
    .map((t: string[]) => t[1].toLowerCase());

  // Articles use markdown content converted to HTML
  const htmlContent = markdownToBasicHtml(event.content);

  const tags: APTag[] = hashtags.map((tag: string) => ({
    type: 'Hashtag',
    href: `https://${domain}/tags/${tag}`,
    name: `#${tag}`,
  }));

  return {
    id: articleUrl,
    type: 'Article',
    attributedTo: actorUrl,
    name: title,
    summary: summary ?? undefined,
    content: htmlContent,
    mediaType: 'text/html',
    published: new Date(event.created_at * 1000).toISOString(),
    to: [PUBLIC_ADDRESSING],
    cc: [`${actorUrl}/followers`],
    url: `https://${domain}/@${username}/articles/${dTag}`,
    tag: tags.length > 0 ? tags : undefined,
    source: {
      content: event.content,
      mediaType: 'text/markdown',
    },
  };
}

/**
 * Create a Create activity wrapping an object
 */
export function createActivity(
  object: APObject,
  actorUrl: string,
  activityId: string,
): APActivity {
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: activityId,
    type: 'Create',
    actor: actorUrl,
    published: object.published,
    to: object.to,
    cc: object.cc,
    object,
  };
}

/**
 * Create a Delete activity for a Nostr deletion event
 */
export function deleteActivity(
  objectUrl: string,
  actorUrl: string,
  domain: string,
): APActivity {
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: `${actorUrl}/activities/delete/${Date.now()}`,
    type: 'Delete',
    actor: actorUrl,
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actorUrl}/followers`],
    object: {
      id: objectUrl,
      type: 'Tombstone',
      attributedTo: actorUrl,
      content: '',
      published: new Date().toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorUrl}/followers`],
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Basic markdown to HTML conversion (paragraphs, bold, italic, links, headers) */
function markdownToBasicHtml(markdown: string): string {
  let html = escapeHtml(markdown);

  // Headers (h1-h3)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links (already escaped, so match escaped entities)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" rel="nofollow noopener noreferrer">$1</a>',
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}
