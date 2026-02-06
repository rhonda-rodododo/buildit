/**
 * Nostr → AT Protocol (Bluesky) content mapping tests
 */

import { describe, it, expect } from 'vitest';
import {
  nostrNoteToBlueskyPost,
  nostrArticleToBlueskyPost,
  extractFacets,
  getByteOffsets,
} from '../atproto/publisher';
import type { NostrEvent } from '../types';

describe('nostrNoteToBlueskyPost', () => {
  it('converts kind:1 to Bluesky post', () => {
    const event: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 1,
      tags: [['t', 'solidarity']],
      content: 'Standing together! #solidarity https://example.org',
      sig: 'test',
    };

    const post = nostrNoteToBlueskyPost(event);
    expect(post.$type).toBe('app.bsky.feed.post');
    expect(post.text).toBe(event.content);
    expect(post.facets).toBeDefined();
    expect(post.facets!.length).toBe(2); // hashtag + URL
  });

  it('truncates long posts to 300 graphemes with ellipsis', () => {
    const longContent = 'a'.repeat(400);
    const event: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 1,
      tags: [],
      content: longContent,
      sig: 'test',
    };

    const post = nostrNoteToBlueskyPost(event);
    const graphemes = [...post.text];
    expect(graphemes.length).toBeLessThanOrEqual(300);
    expect(post.text.endsWith('\u2026')).toBe(true);
  });
});

describe('nostrArticleToBlueskyPost', () => {
  it('creates post with external embed link card', () => {
    const event: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 30023,
      tags: [
        ['d', 'building-power'],
        ['title', 'Building Power Through Collective Action'],
        ['summary', 'A guide to grassroots organizing'],
      ],
      content: '# Article\n\nLong content...',
      sig: 'test',
    };

    const post = nostrArticleToBlueskyPost(event, 'buildit.network', 'alice');
    expect(post.$type).toBe('app.bsky.feed.post');
    expect(post.text).toContain('Building Power Through Collective Action');
    expect(post.embed?.$type).toBe('app.bsky.embed.external');

    if (post.embed?.$type === 'app.bsky.embed.external') {
      expect(post.embed.external.uri).toContain('buildit.network/@alice/articles/building-power');
      expect(post.embed.external.title).toBe('Building Power Through Collective Action');
    }
  });
});

describe('extractFacets', () => {
  it('extracts URLs as link facets', () => {
    const facets = extractFacets('Check https://example.org out!');
    expect(facets.length).toBe(1);
    expect(facets[0].features[0].$type).toBe('app.bsky.richtext.facet#link');
    expect((facets[0].features[0] as { uri: string }).uri).toBe('https://example.org');
  });

  it('extracts hashtags as tag facets', () => {
    const facets = extractFacets('Hello #world');
    expect(facets.length).toBe(1);
    expect(facets[0].features[0].$type).toBe('app.bsky.richtext.facet#tag');
    expect((facets[0].features[0] as { tag: string }).tag).toBe('world');
  });

  it('extracts multiple facets', () => {
    const facets = extractFacets('Visit https://example.org #solidarity #power');
    expect(facets.length).toBe(3); // 1 URL + 2 hashtags
  });

  it('returns empty array for plain text', () => {
    const facets = extractFacets('Just a plain text post.');
    expect(facets.length).toBe(0);
  });
});

describe('getByteOffsets', () => {
  it('handles ASCII text correctly', () => {
    const { byteStart, byteEnd } = getByteOffsets('Hello world', 6, 5);
    expect(byteStart).toBe(6);
    expect(byteEnd).toBe(11);
  });

  it('handles multi-byte UTF-8 characters (é, ö)', () => {
    // "Héllo" — é is 2 bytes in UTF-8
    const { byteStart, byteEnd } = getByteOffsets('Héllo test', 6, 4);
    expect(byteStart).toBe(7); // H(1) + é(2) + l(1) + l(1) + o(1) + space(1) = 7
    expect(byteEnd).toBe(11); // + test(4) = 11
  });

  it('handles emoji (4-byte UTF-8)', () => {
    // "🌍 test" — 🌍 is 4 bytes in UTF-8 but 2 JS chars (surrogate pair)
    // charStart=2 means after the emoji, byteStart = 4 bytes for the emoji
    const { byteStart, byteEnd } = getByteOffsets('🌍 test', 2, 4);
    expect(byteStart).toBe(4); // 🌍(4 bytes) = 4
    expect(byteEnd).toBe(8); // + " tes"(4 bytes) = 8
  });

  it('handles mixed multi-byte content from test vector', () => {
    const text = 'Héllo wörld! 🌍 Visit https://example.org';
    // Find "https://example.org" byte offsets
    const urlStart = text.indexOf('https://');
    const urlLength = 'https://example.org'.length;
    const { byteStart, byteEnd } = getByteOffsets(text, urlStart, urlLength);

    // Verify the encoded slice matches
    const encoder = new TextEncoder();
    const fullBytes = encoder.encode(text);
    const urlBytes = encoder.encode('https://example.org');
    const sliced = fullBytes.slice(byteStart, byteEnd);
    expect(sliced).toEqual(urlBytes);
  });
});
