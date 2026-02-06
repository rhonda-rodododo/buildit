/**
 * Publishing Flow E2E Test Stubs
 *
 * Tests the full article lifecycle:
 * Article create -> edit -> publish -> verify public visibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePublishingStore } from '@/modules/publishing/publishingStore';

describe('Publishing Flow', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = usePublishingStore.getState();
    store.publications.clear();
    store.articles.clear();
    store.articleDrafts.clear();
    store.subscriptions.clear();
  });

  describe('Article Creation', () => {
    it('should create a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Publication',
        description: 'A test publication for E2E testing',
      });

      expect(pub).toBeDefined();
      expect(pub.id).toBeTruthy();
      expect(pub.name).toBe('Test Publication');
      expect(pub.slug).toBe('test-publication');
      expect(pub.status).toBe('active');
    });

    it('should create an article within a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'My First Article',
        content: '<p>Hello world, this is a test article with enough words to calculate reading time.</p>',
        tags: ['organizing', 'test'],
      });

      expect(article).toBeDefined();
      expect(article.id).toBeTruthy();
      expect(article.title).toBe('My First Article');
      expect(article.status).toBe('draft');
      expect(article.slug).toBe('my-first-article');
      expect(article.tags).toContain('organizing');
    });

    it('should auto-generate excerpt from content', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const longContent = '<p>' + 'This is a test sentence. '.repeat(20) + '</p>';
      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Long Article',
        content: longContent,
      });

      expect(article.excerpt).toBeDefined();
      expect(article.excerpt!.length).toBeLessThanOrEqual(163); // 160 + '...'
    });

    it('should calculate reading time and word count', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      // ~400 words = ~2 minutes
      const words = Array(400).fill('word').join(' ');
      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Long Read',
        content: `<p>${words}</p>`,
      });

      expect(article.wordCount).toBe(400);
      expect(article.readingTimeMinutes).toBe(2);
    });
  });

  describe('Article Publishing', () => {
    it('should publish a draft article', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Draft to Publish',
      });

      expect(article.status).toBe('draft');
      expect(article.publishedAt).toBeUndefined();

      store.publishArticle(article.id);

      const published = store.getArticle(article.id);
      expect(published?.status).toBe('published');
      expect(published?.publishedAt).toBeDefined();
    });

    it('should unpublish a published article', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Will Unpublish',
      });

      store.publishArticle(article.id);
      store.unpublishArticle(article.id);

      const unpublished = store.getArticle(article.id);
      expect(unpublished?.status).toBe('draft');
    });

    it('should schedule an article for future publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Scheduled Article',
      });

      const futureDate = Date.now() + 86400000; // +1 day
      store.scheduleArticle(article.id, futureDate);

      const scheduled = store.getArticle(article.id);
      expect(scheduled?.status).toBe('scheduled');
      expect(scheduled?.scheduledAt).toBe(futureDate);
    });
  });

  describe('Article Verification', () => {
    it('should list published articles for a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      // Create 3 articles, publish 2
      const a1 = store.createArticle({ publicationId: pub.id, groupId: 'test-group', title: 'Article 1' });
      const a2 = store.createArticle({ publicationId: pub.id, groupId: 'test-group', title: 'Article 2' });
      store.createArticle({ publicationId: pub.id, groupId: 'test-group', title: 'Article 3 (draft)' });

      store.publishArticle(a1.id);
      store.publishArticle(a2.id);

      const published = store.getPublicationArticles(pub.id, 'published');
      expect(published.length).toBe(2);

      const drafts = store.getPublicationArticles(pub.id, 'draft');
      expect(drafts.length).toBe(1);
    });

    it('should update article content and recalculate metadata', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Original Title',
        content: '<p>Short content</p>',
      });

      const originalWordCount = article.wordCount;

      store.updateArticle(article.id, {
        title: 'Updated Title',
        content: '<p>' + 'Updated content with many more words. '.repeat(50) + '</p>',
      });

      const updated = store.getArticle(article.id);
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.slug).toBe('updated-title');
      expect(updated?.wordCount).toBeGreaterThan(originalWordCount!);
      expect(updated?.version).toBe(2);
    });

    it('should generate RSS feed for a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test RSS Publication',
        description: 'RSS test',
        settings: { enableRss: true, rssFullContent: false },
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'RSS Article',
        content: '<p>Content for RSS</p>',
        tags: ['test'],
      });

      store.publishArticle(article.id);

      const feed = store.generateRSSFeed(pub.id, 'https://buildit.network');
      expect(feed.title).toBe('Test RSS Publication');
      expect(feed.items.length).toBe(1);
      expect(feed.items[0].title).toBe('RSS Article');
      expect(feed.items[0].categories).toContain('test');
    });
  });

  describe('Article Deletion', () => {
    it('should delete an article', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'To Delete',
      });

      store.deleteArticle(article.id);

      expect(store.getArticle(article.id)).toBeUndefined();
    });

    it('should delete publication and cascade to articles', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      store.createArticle({ publicationId: pub.id, groupId: 'test-group', title: 'A1' });
      store.createArticle({ publicationId: pub.id, groupId: 'test-group', title: 'A2' });

      store.deletePublication(pub.id);

      expect(store.getPublication(pub.id)).toBeUndefined();
      expect(store.getPublicationArticles(pub.id).length).toBe(0);
    });
  });
});
