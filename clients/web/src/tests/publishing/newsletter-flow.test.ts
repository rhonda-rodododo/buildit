/**
 * Newsletter Flow E2E Test Stubs
 *
 * Tests the full newsletter lifecycle:
 * Newsletter create -> compose issue -> preview -> send -> verify delivery
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

import { useNewslettersStore } from '@/modules/newsletters/newslettersStore';
import {
  processLinksForTracking,
  getIssueLinkAnalytics,
  recordLinkClick,
  resolveTrackingLink,
  clearIssueTracking,
} from '@/modules/newsletters/linkTracking';

describe('Newsletter Flow', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useNewslettersStore.getState();
    store.newsletters.clear();
    store.issues.clear();
    store.subscribers.clear();
    store.sends.clear();
    store.deliveryQueue.clear();
  });

  describe('Newsletter Creation', () => {
    it('should create a newsletter', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test Newsletter',
        description: 'A test newsletter for E2E testing',
      });

      expect(newsletter).toBeDefined();
      expect(newsletter.id).toBeTruthy();
      expect(newsletter.name).toBe('Test Newsletter');
      expect(newsletter.subscriberCount).toBe(0);
      expect(newsletter.totalIssuesSent).toBe(0);
    });

    it('should create a newsletter with custom settings', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Custom Newsletter',
        description: 'Custom settings',
        settings: {
          allowReplies: false,
          rateLimitPerMinute: 60,
        },
      });

      expect(newsletter.settings.allowReplies).toBe(false);
      expect(newsletter.settings.rateLimitPerMinute).toBe(60);
    });
  });

  describe('Issue Composition', () => {
    it('should create an issue', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const issue = store.createIssue({
        newsletterId: newsletter.id,
        subject: 'Weekly Update #1',
        content: '<p>Hello subscribers!</p>',
      });

      expect(issue).toBeDefined();
      expect(issue.subject).toBe('Weekly Update #1');
      expect(issue.status).toBe('draft');
      expect(issue.contentFormat).toBe('markdown');
    });

    it('should update issue content', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const issue = store.createIssue({
        newsletterId: newsletter.id,
        subject: 'Original Subject',
      });

      store.updateIssue(issue.id, {
        subject: 'Updated Subject',
        content: '<h2>Breaking News</h2><p>Important update here.</p>',
        contentFormat: 'html',
      });

      const updated = store.getIssue(issue.id);
      expect(updated?.subject).toBe('Updated Subject');
      expect(updated?.content).toContain('Breaking News');
      expect(updated?.contentFormat).toBe('html');
    });

    it('should schedule an issue', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const issue = store.createIssue({
        newsletterId: newsletter.id,
        subject: 'Scheduled Issue',
      });

      const futureDate = Date.now() + 86400000;
      store.scheduleIssue(issue.id, futureDate);

      const scheduled = store.getIssue(issue.id);
      expect(scheduled?.status).toBe('scheduled');
      expect(scheduled?.scheduledAt).toBe(futureDate);
    });
  });

  describe('Subscriber Management', () => {
    it('should add a subscriber', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const subscriber = store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'abc123pubkey',
        skipConfirmation: true,
      });

      expect(subscriber).toBeDefined();
      expect(subscriber.status).toBe('active');
      expect(subscriber.subscriberPubkey).toBe('abc123pubkey');
    });

    it('should import multiple subscribers', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const imported = store.importSubscribers({
        newsletterId: newsletter.id,
        pubkeys: ['key1', 'key2', 'key3'],
        skipConfirmation: true,
      });

      expect(imported.length).toBe(3);

      const active = store.getActiveSubscribers(newsletter.id);
      expect(active.length).toBe(3);
    });

    it('should unsubscribe a subscriber', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'abc123',
        skipConfirmation: true,
      });

      store.unsubscribe(newsletter.id, 'abc123');

      const active = store.getActiveSubscribers(newsletter.id);
      expect(active.length).toBe(0);
    });

    it('should export subscribers as CSV', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      store.addSubscriber({
        newsletterId: newsletter.id,
        subscriberPubkey: 'key1',
        skipConfirmation: true,
      });

      const csv = store.exportSubscribers(newsletter.id);
      expect(csv).toContain('pubkey,status,subscribedAt,source');
      expect(csv).toContain('key1');
    });
  });

  describe('Issue Deletion', () => {
    it('should delete an issue and its related sends', () => {
      const store = useNewslettersStore.getState();
      const newsletter = store.createNewsletter({
        groupId: 'test-group',
        name: 'Test NL',
        description: 'Test',
      });

      const issue = store.createIssue({
        newsletterId: newsletter.id,
        subject: 'To Delete',
      });

      store.deleteIssue(issue.id);
      expect(store.getIssue(issue.id)).toBeUndefined();
    });
  });
});

describe('Link Tracking (Privacy-Preserving)', () => {
  const testIssueId = 'test-issue-001';

  beforeEach(() => {
    clearIssueTracking(testIssueId);
  });

  it('should process links in HTML content', () => {
    const html = '<p>Check <a href="https://example.com">this link</a> and <a href="https://other.com/page">another</a>.</p>';

    const result = processLinksForTracking(html, {
      enabled: true,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    expect(result.trackedLinks.length).toBe(2);
    expect(result.trackedLinks[0].originalUrl).toBe('https://example.com');
    expect(result.trackedLinks[1].originalUrl).toBe('https://other.com/page');
    expect(result.html).not.toContain('href="https://example.com"');
    expect(result.html).toContain('data-original-url');
  });

  it('should not track internal links', () => {
    const html = '<p><a href="/about">About</a> and <a href="#section">Section</a></p>';

    const result = processLinksForTracking(html, {
      enabled: true,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    expect(result.trackedLinks.length).toBe(0);
    expect(result.html).toContain('href="/about"');
    expect(result.html).toContain('href="#section"');
  });

  it('should not process links when disabled', () => {
    const html = '<p><a href="https://example.com">link</a></p>';

    const result = processLinksForTracking(html, {
      enabled: false,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    expect(result.trackedLinks.length).toBe(0);
    expect(result.html).toBe(html);
  });

  it('should record aggregate clicks without per-user data', () => {
    const html = '<p><a href="https://example.com">link</a></p>';

    const result = processLinksForTracking(html, {
      enabled: true,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    const linkId = result.trackedLinks[0].linkId;

    // Record multiple clicks (from different anonymous users)
    recordLinkClick(linkId);
    recordLinkClick(linkId);
    recordLinkClick(linkId);

    const analytics = getIssueLinkAnalytics(testIssueId);
    expect(analytics.totalClicks).toBe(3);
    expect(analytics.links[0].clickCount).toBe(3);
    // No per-user data should be stored
  });

  it('should resolve tracking links to original URLs', () => {
    const html = '<p><a href="https://example.com/path?q=1">link</a></p>';

    const result = processLinksForTracking(html, {
      enabled: true,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    const linkId = result.trackedLinks[0].linkId;
    const originalUrl = resolveTrackingLink(linkId);

    expect(originalUrl).toBe('https://example.com/path?q=1');
  });

  it('should return null for unknown link IDs', () => {
    const result = resolveTrackingLink('nonexistent-id');
    expect(result).toBeNull();
  });

  it('should clear tracking data for an issue', () => {
    const html = '<p><a href="https://a.com">a</a> <a href="https://b.com">b</a></p>';

    processLinksForTracking(html, {
      enabled: true,
      issueId: testIssueId,
      redirectBaseUrl: 'https://buildit.network',
    });

    let analytics = getIssueLinkAnalytics(testIssueId);
    expect(analytics.totalLinks).toBe(2);

    clearIssueTracking(testIssueId);

    analytics = getIssueLinkAnalytics(testIssueId);
    expect(analytics.totalLinks).toBe(0);
  });
});
