/**
 * Subscription Flow E2E Test Stubs
 *
 * Tests the full subscription lifecycle:
 * Subscribe -> receive content -> unsubscribe
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock i18n config to avoid localStorage access at module init time
vi.mock('@/i18n/config', () => ({
  default: { t: (key: string) => key, language: 'en' },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
import { usePublishingStore } from '@/modules/publishing/publishingStore';
import { useNewslettersStore } from '@/modules/newsletters/newslettersStore';

describe('Subscription Flow', () => {
  beforeEach(() => {
    // Reset publishing store
    const pubStore = usePublishingStore.getState();
    pubStore.publications.clear();
    pubStore.articles.clear();
    pubStore.subscriptions.clear();

    // Reset newsletters store
    const nlStore = useNewslettersStore.getState();
    nlStore.newsletters.clear();
    nlStore.issues.clear();
    nlStore.subscribers.clear();
    nlStore.sends.clear();
  });

  describe('Publication Subscription', () => {
    it('should subscribe to a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Publication',
        description: 'Test',
      });

      const subscription = store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'subscriber-pubkey-123',
        tier: 'free',
      });

      expect(subscription).toBeDefined();
      expect(subscription.status).toBe('active');
      expect(subscription.tier).toBe('free');
      expect(subscription.subscriberPubkey).toBe('subscriber-pubkey-123');
    });

    it('should subscribe with preferences', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const subscription = store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'sub-key',
        tier: 'free',
        preferences: {
          emailNotifications: false,
          nostrNotifications: true,
          digestFrequency: 'weekly',
        },
      });

      expect(subscription.preferences.emailNotifications).toBe(false);
      expect(subscription.preferences.nostrNotifications).toBe(true);
      expect(subscription.preferences.digestFrequency).toBe('weekly');
    });

    it('should find a subscription by publication and pubkey', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'find-me-key',
        tier: 'free',
      });

      const found = store.getSubscription(pub.id, 'find-me-key');
      expect(found).toBeDefined();
      expect(found?.subscriberPubkey).toBe('find-me-key');
    });

    it('should not find a cancelled subscription', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const subscription = store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'cancel-me-key',
        tier: 'free',
      });

      store.unsubscribe(subscription.id);

      const found = store.getSubscription(pub.id, 'cancel-me-key');
      expect(found).toBeUndefined();
    });
  });

  describe('Content Delivery', () => {
    it('should list published articles for subscribers', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      // Subscribe
      store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'reader-key',
        tier: 'free',
      });

      // Create and publish articles
      const a1 = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Public Article',
        visibility: 'public',
      });
      store.publishArticle(a1.id);

      const a2 = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Subscriber Article',
        visibility: 'subscribers',
      });
      store.publishArticle(a2.id);

      const published = store.getPublicationArticles(pub.id, 'published');
      expect(published.length).toBe(2);

      // Public articles visible to everyone
      const publicArticles = published.filter((a) => a.visibility === 'public');
      expect(publicArticles.length).toBe(1);

      // Subscriber-only articles
      const subscriberArticles = published.filter((a) => a.visibility === 'subscribers');
      expect(subscriberArticles.length).toBe(1);
    });

    it('should record privacy-preserving article views', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const article = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Viewed Article',
      });
      store.publishArticle(article.id);

      // Record views with anonymous session IDs (not tied to user identity)
      store.recordView(article.id, pub.id, 'session-anon-1');
      store.recordView(article.id, pub.id, 'session-anon-2');
      store.recordView(article.id, pub.id, 'session-anon-1'); // Repeat visit

      const views = store.getArticleViews(article.id);
      expect(views.length).toBe(3);

      const analytics = store.computeArticleAnalytics(article.id);
      expect(analytics.totalViews).toBe(3);
      expect(analytics.uniqueViews).toBe(2); // 2 unique sessions
    });
  });

  describe('Unsubscribe', () => {
    it('should unsubscribe from a publication', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const subscription = store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'unsub-key',
        tier: 'free',
      });

      // Verify active
      expect(store.getSubscription(pub.id, 'unsub-key')).toBeDefined();

      // Unsubscribe
      store.unsubscribe(subscription.id);

      // Verify cancelled
      const found = store.getSubscription(pub.id, 'unsub-key');
      expect(found).toBeUndefined();

      // Verify subscription record still exists with cancelled status
      const allSubs = store.getPublicationSubscriptions(pub.id);
      const cancelled = allSubs.find((s) => s.subscriberPubkey === 'unsub-key');
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.cancelledAt).toBeDefined();
    });

    it('should update subscription preferences', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Test Pub',
        description: 'Test',
      });

      const subscription = store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'pref-key',
        tier: 'free',
      });

      store.updateSubscriptionPreferences(subscription.id, {
        emailNotifications: true,
        nostrNotifications: false,
        digestFrequency: 'never',
      });

      const allSubs = store.getPublicationSubscriptions(pub.id);
      const updated = allSubs.find((s) => s.id === subscription.id);
      expect(updated?.preferences.emailNotifications).toBe(true);
      expect(updated?.preferences.nostrNotifications).toBe(false);
      expect(updated?.preferences.digestFrequency).toBe('never');
    });
  });

  describe('Newsletter Subscription', () => {
    it('should add and manage newsletter subscribers', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test Newsletter',
        description: 'Test',
      });

      // Add subscribers
      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'nl-sub-1',
        skipConfirmation: true,
      });

      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'nl-sub-2',
        skipConfirmation: true,
      });

      const active = store.getActiveSubscribers(newsletter.id);
      expect(active.length).toBe(2);

      // Unsubscribe one
      store.unsubscribe(newsletter.id, 'nl-sub-1');

      const afterUnsub = store.getActiveSubscribers(newsletter.id);
      expect(afterUnsub.length).toBe(1);
      expect(afterUnsub[0].subscriberPubkey).toBe('nl-sub-2');
    });

    it('should reactivate a previously unsubscribed subscriber', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'reactivate-key',
        skipConfirmation: true,
      });

      // Unsubscribe
      store.unsubscribe(newsletter.id, 'reactivate-key');
      expect(store.getActiveSubscribers(newsletter.id).length).toBe(0);

      // Re-subscribe
      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'reactivate-key',
        skipConfirmation: true,
      });

      expect(store.getActiveSubscribers(newsletter.id).length).toBe(1);
    });
  });

  describe('Publication Analytics', () => {
    it('should compute publication-level analytics', () => {
      const store = usePublishingStore.getState();
      const pub = store.createPublication({
        groupId: 'test-group',
        name: 'Analytics Pub',
        description: 'Analytics test',
      });

      // Create articles
      const a1 = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Article 1',
      });
      store.publishArticle(a1.id);

      const a2 = store.createArticle({
        publicationId: pub.id,
        groupId: 'test-group',
        title: 'Article 2',
      });
      store.publishArticle(a2.id);

      // Add subscribers
      store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'analytics-sub-1',
        tier: 'free',
      });
      store.subscribe({
        publicationId: pub.id,
        subscriberPubkey: 'analytics-sub-2',
        tier: 'paid',
      });

      // Record views
      store.recordView(a1.id, pub.id, 'session-1');
      store.recordView(a1.id, pub.id, 'session-2');
      store.recordView(a2.id, pub.id, 'session-3');

      const analytics = store.computePublicationAnalytics(pub.id);
      expect(analytics.totalArticles).toBe(2);
      expect(analytics.publishedArticles).toBe(2);
      expect(analytics.totalViews).toBe(3);
      expect(analytics.totalSubscribers).toBe(2);
      expect(analytics.freeSubscribers).toBe(1);
      expect(analytics.paidSubscribers).toBe(1);
      expect(analytics.topArticles.length).toBe(2);
    });
  });
});
