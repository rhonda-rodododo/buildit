/**
 * Nostr → ActivityPub content mapping tests
 */

import { describe, it, expect } from 'vitest';
import { nostrNoteToAPNote, nostrArticleToAPArticle } from '../activitypub/outbox';
import type { NostrEvent } from '../types';
import testVectors from '../../../../protocol/test-vectors/federation/nostr-to-ap.json';

const domain = 'buildit.network';

describe('nostrNoteToAPNote', () => {
  it('converts kind:1 to AP Note with correct structure', () => {
    const vector = testVectors.vectors[0];
    const event = vector.input as NostrEvent;
    const note = nostrNoteToAPNote(event, vector.username, domain);

    expect(note.type).toBe(vector.expected.type);
    expect(note.id).toBe(vector.expected.id);
    expect(note.attributedTo).toBe(vector.expected.attributedTo);
    expect(note.to).toEqual(vector.expected.to);
    expect(note.cc).toEqual(vector.expected.cc);
    expect(note.source?.mediaType).toBe(vector.expected.source_mediaType);
  });

  it('includes hashtags as AP tags', () => {
    const vector = testVectors.vectors[0];
    const event = vector.input as NostrEvent;
    const note = nostrNoteToAPNote(event, vector.username, domain);

    expect(note.tag).toHaveLength(vector.expected.tag_count!);
    expect(note.tag?.every((t) => t.type === 'Hashtag')).toBe(true);
  });

  it('converts URLs to HTML links', () => {
    const vector = testVectors.vectors[2];
    const event = vector.input as NostrEvent;
    const note = nostrNoteToAPNote(event, vector.username!, domain);

    for (const expected of vector.expected.content_contains!) {
      expect(note.content).toContain(expected);
    }
  });

  it('HTML-escapes content to prevent XSS', () => {
    const maliciousEvent: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 1,
      tags: [],
      content: '<script>alert("xss")</script> Hello',
      sig: 'test',
    };

    const note = nostrNoteToAPNote(maliciousEvent, 'alice', domain);
    expect(note.content).not.toContain('<script>');
    expect(note.content).toContain('&lt;script&gt;');
  });

  it('preserves source content in plain text', () => {
    const event: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 1,
      tags: [],
      content: 'Original plain text content',
      sig: 'test',
    };

    const note = nostrNoteToAPNote(event, 'alice', domain);
    expect(note.source?.content).toBe('Original plain text content');
    expect(note.source?.mediaType).toBe('text/plain');
  });
});

describe('nostrArticleToAPArticle', () => {
  it('converts kind:30023 to AP Article', () => {
    const vector = testVectors.vectors[1];
    const event = vector.input as NostrEvent;
    const article = nostrArticleToAPArticle(event, vector.username, domain);

    expect(article.type).toBe(vector.expected.type);
    expect(article.id).toBe(vector.expected.id);
    expect(article.name).toBe(vector.expected.name);
    expect(article.summary).toBe(vector.expected.summary);
    expect(article.source?.mediaType).toBe(vector.expected.source_mediaType);
  });

  it('uses d-tag for article URL', () => {
    const event: NostrEvent = {
      id: 'test',
      pubkey: 'test',
      created_at: 1706745600,
      kind: 30023,
      tags: [
        ['d', 'my-slug'],
        ['title', 'My Article'],
      ],
      content: '# Article\n\nContent here.',
      sig: 'test',
    };

    const article = nostrArticleToAPArticle(event, 'bob', domain);
    expect(article.id).toContain('/articles/my-slug');
    expect(article.url).toContain('/articles/my-slug');
  });
});
