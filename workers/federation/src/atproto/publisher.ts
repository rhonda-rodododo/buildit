/**
 * Nostr → AT Protocol content conversion
 *
 * Converts Nostr events to ATProto records for Bluesky cross-posting.
 * Handles rich text facets with correct UTF-8 byte offsets.
 */

import type { NostrEvent } from '../types';
import { NOSTR_KINDS } from '../types';
import { AT_MAX_POST_GRAPHEMES } from '../config';

/** Bluesky post record */
export interface BSkyPost {
  $type: 'app.bsky.feed.post';
  text: string;
  createdAt: string;
  facets?: BSkyFacet[];
  embed?: BSkyEmbed;
  langs?: string[];
  reply?: BSkyReplyRef;
}

interface BSkyFacet {
  index: { byteStart: number; byteEnd: number };
  features: BSkyFacetFeature[];
}

type BSkyFacetFeature =
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
  | { $type: 'app.bsky.richtext.facet#mention'; did: string };

type BSkyEmbed =
  | { $type: 'app.bsky.embed.external'; external: BSkyExternal }
  | { $type: 'app.bsky.embed.images'; images: BSkyImage[] };

interface BSkyExternal {
  uri: string;
  title: string;
  description: string;
}

interface BSkyImage {
  alt: string;
  image: { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };
}

interface BSkyReplyRef {
  root: { uri: string; cid: string };
  parent: { uri: string; cid: string };
}

const encoder = new TextEncoder();

/**
 * Convert a Nostr kind:1 (short note) to a Bluesky post record
 */
export function nostrNoteToBlueskyPost(event: NostrEvent): BSkyPost {
  let text = event.content;

  // Truncate to Bluesky's grapheme limit
  const graphemes = [...text];
  if (graphemes.length > AT_MAX_POST_GRAPHEMES) {
    text = graphemes.slice(0, AT_MAX_POST_GRAPHEMES - 1).join('') + '\u2026';
  }

  const facets = extractFacets(text);

  // Detect language from Nostr 'L' or 'l' tags (NIP-32 labels), fall back to omitting
  const langs = detectLanguages(event);

  const post: BSkyPost = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date(event.created_at * 1000).toISOString(),
    langs: langs.length > 0 ? langs : undefined,
  };

  if (facets.length > 0) {
    post.facets = facets;
  }

  return post;
}

/**
 * Convert a Nostr kind:30023 (long-form article) to a Bluesky post
 * with an external embed linking back to the article
 */
export function nostrArticleToBlueskyPost(
  event: NostrEvent,
  domain: string,
  username: string,
): BSkyPost {
  const title = event.tags.find((t: string[]) => t[0] === 'title')?.[1] ?? 'Untitled';
  const summary = event.tags.find((t: string[]) => t[0] === 'summary')?.[1] ?? '';
  const dTag = event.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? event.id;

  const articleUrl = `https://${domain}/@${username}/articles/${dTag}`;

  // Create a short text with the title and link
  let text = title;
  const graphemes = [...text];
  if (graphemes.length > AT_MAX_POST_GRAPHEMES - 50) {
    text = graphemes.slice(0, AT_MAX_POST_GRAPHEMES - 53).join('') + '\u2026';
  }
  text += `\n\n${articleUrl}`;

  const facets = extractFacets(text);

  const langs = detectLanguages(event);

  return {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date(event.created_at * 1000).toISOString(),
    langs: langs.length > 0 ? langs : undefined,
    facets: facets.length > 0 ? facets : undefined,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: articleUrl,
        title,
        description: summary.slice(0, 300),
      },
    },
  };
}

/**
 * Extract rich text facets from post text.
 * Computes correct UTF-8 byte offsets for links, hashtags, and mentions.
 */
export function extractFacets(text: string): BSkyFacet[] {
  const facets: BSkyFacet[] = [];
  const textBytes = encoder.encode(text);

  // Extract URLs — strip trailing punctuation that's likely sentence-ending, not part of the URL.
  // Matches balanced parens but strips trailing .,;:!? and unmatched closing parens.
  const urlRegex = /https?:\/\/[^\s<\])"']+/g;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    // Strip trailing punctuation that is almost certainly not part of the URL
    url = url.replace(/[.,;:!?)]+$/, '');
    // But keep a single trailing ) if there's a matching ( in the URL (Wikipedia-style)
    if (match[0].endsWith(')') && url.includes('(') && !url.endsWith(')')) {
      url += ')';
    }
    const { byteStart, byteEnd } = getByteOffsets(text, match.index, url.length);
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    });
  }

  // Extract hashtags
  const hashtagRegex = /#([a-zA-Z][a-zA-Z0-9_]*)/g;
  while ((match = hashtagRegex.exec(text)) !== null) {
    const { byteStart, byteEnd } = getByteOffsets(text, match.index, match[0].length);
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[1] }],
    });
  }

  return facets;
}

/**
 * Convert character offset + length to UTF-8 byte offset + length.
 * Critical for correct facet rendering — Bluesky uses byte offsets, not char offsets.
 */
export function getByteOffsets(
  text: string,
  charStart: number,
  charLength: number,
): { byteStart: number; byteEnd: number } {
  const beforeBytes = encoder.encode(text.slice(0, charStart));
  const matchBytes = encoder.encode(text.slice(charStart, charStart + charLength));
  return {
    byteStart: beforeBytes.length,
    byteEnd: beforeBytes.length + matchBytes.length,
  };
}

/**
 * Detect languages from Nostr event tags.
 * Checks for NIP-32 language labels ('L'/'l' tags) or custom 'lang' tags.
 * Returns BCP-47 language codes suitable for Bluesky's langs field.
 */
function detectLanguages(event: NostrEvent): string[] {
  const langs: string[] = [];

  for (const tag of event.tags) {
    // NIP-32 label: ['l', 'en', 'ISO-639-1'] marks language
    if (tag[0] === 'l' && tag[2] === 'ISO-639-1' && tag[1]) {
      langs.push(tag[1]);
    }
    // Custom lang tag sometimes used: ['lang', 'en']
    if (tag[0] === 'lang' && tag[1]) {
      langs.push(tag[1]);
    }
  }

  return langs;
}
