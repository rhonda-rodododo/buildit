/**
 * Social Publishing Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSocialPublishingStore } from '../socialPublishingStore';
import type {
  ScheduledContent,
  ShareLink,
  SocialAccount,
  ContentCalendarEntry,
  OutreachAnalytics,
} from '../types';

const SCHEMA_VERSION = '1.0.0';

function makeScheduledContent(overrides: Partial<ScheduledContent> = {}): ScheduledContent {
  return {
    _v: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    sourceModule: 'publishing',
    sourceContentId: 'article-1',
    scheduledAt: Math.floor(Date.now() / 1000) + 3600,
    status: 'pending',
    retryCount: 0,
    createdBy: 'pubkey123',
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function makeShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    _v: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    slug: 'test-slug',
    sourceModule: 'publishing',
    sourceContentId: 'article-1',
    targetUrl: 'https://buildit.network/publishing/article-1',
    trackClicks: true,
    clickCount: 0,
    isActive: true,
    createdBy: 'pubkey123',
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function makeCalendarEntry(overrides: Partial<ContentCalendarEntry> = {}): ContentCalendarEntry {
  return {
    _v: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    sourceModule: 'publishing',
    sourceContentId: 'article-1',
    title: 'Test Article',
    scheduledAt: Math.floor(Date.now() / 1000) + 3600,
    status: 'pending',
    ...overrides,
  };
}

describe('Social Publishing Store', () => {
  beforeEach(() => {
    useSocialPublishingStore.getState().reset();
  });

  describe('Scheduled Content', () => {
    it('should add scheduled content', () => {
      const store = useSocialPublishingStore.getState();
      const content = makeScheduledContent();

      store.addScheduledContent(content);
      expect(useSocialPublishingStore.getState().scheduledContent).toHaveLength(1);
      expect(useSocialPublishingStore.getState().scheduledContent[0].id).toBe(content.id);
    });

    it('should update scheduled content', () => {
      const store = useSocialPublishingStore.getState();
      const content = makeScheduledContent();
      store.addScheduledContent(content);

      useSocialPublishingStore.getState().updateScheduledContent(content.id, {
        status: 'published',
      });
      const updated = useSocialPublishingStore.getState().scheduledContent[0];
      expect(updated.status).toBe('published');
      expect(updated.updatedAt).toBeDefined();
    });

    it('should remove scheduled content', () => {
      const store = useSocialPublishingStore.getState();
      const content = makeScheduledContent();
      store.addScheduledContent(content);

      useSocialPublishingStore.getState().removeScheduledContent(content.id);
      expect(useSocialPublishingStore.getState().scheduledContent).toHaveLength(0);
    });

    it('should get scheduled content by id', () => {
      const store = useSocialPublishingStore.getState();
      const content = makeScheduledContent();
      store.addScheduledContent(content);

      const found = useSocialPublishingStore.getState().getScheduledContentById(content.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(content.id);
    });

    it('should get scheduled by module', () => {
      const store = useSocialPublishingStore.getState();
      store.addScheduledContent(makeScheduledContent({ sourceModule: 'publishing' }));
      store.addScheduledContent(makeScheduledContent({ sourceModule: 'events' }));

      const publishingItems = useSocialPublishingStore
        .getState()
        .getScheduledByModule('publishing');
      expect(publishingItems).toHaveLength(1);
    });

    it('should get pending scheduled', () => {
      const store = useSocialPublishingStore.getState();
      store.addScheduledContent(makeScheduledContent({ status: 'pending' }));
      store.addScheduledContent(makeScheduledContent({ status: 'published' }));

      const pending = useSocialPublishingStore.getState().getPendingScheduled();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should get due scheduled content', () => {
      const store = useSocialPublishingStore.getState();
      const pastTime = Math.floor(Date.now() / 1000) - 60;
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      store.addScheduledContent(
        makeScheduledContent({ scheduledAt: pastTime, status: 'pending' })
      );
      store.addScheduledContent(
        makeScheduledContent({ scheduledAt: futureTime, status: 'pending' })
      );

      const due = useSocialPublishingStore.getState().getDueScheduledContent();
      expect(due).toHaveLength(1);
    });
  });

  describe('Share Links', () => {
    it('should add share link', () => {
      const store = useSocialPublishingStore.getState();
      const link = makeShareLink();
      store.addShareLink(link);

      expect(useSocialPublishingStore.getState().shareLinks).toHaveLength(1);
    });

    it('should update share link', () => {
      const store = useSocialPublishingStore.getState();
      const link = makeShareLink();
      store.addShareLink(link);

      useSocialPublishingStore.getState().updateShareLink(link.id, {
        isActive: false,
      });
      expect(useSocialPublishingStore.getState().shareLinks[0].isActive).toBe(false);
    });

    it('should get share link by slug', () => {
      const store = useSocialPublishingStore.getState();
      store.addShareLink(makeShareLink({ slug: 'my-slug' }));

      const found = useSocialPublishingStore.getState().getShareLinkBySlug('my-slug');
      expect(found).toBeDefined();
      expect(found!.slug).toBe('my-slug');
    });

    it('should get active share links excluding expired', () => {
      const store = useSocialPublishingStore.getState();
      // Active link
      store.addShareLink(makeShareLink({ slug: 'active-1', isActive: true }));
      // Inactive link
      store.addShareLink(makeShareLink({ slug: 'inactive', isActive: false }));
      // Expired link
      store.addShareLink(
        makeShareLink({
          slug: 'expired',
          isActive: true,
          expiresAt: Math.floor(Date.now() / 1000) - 3600,
        })
      );

      const active = useSocialPublishingStore.getState().getActiveShareLinks();
      expect(active).toHaveLength(1);
      expect(active[0].slug).toBe('active-1');
    });
  });

  describe('Calendar Entries', () => {
    it('should add calendar entry', () => {
      const store = useSocialPublishingStore.getState();
      const entry = makeCalendarEntry();
      store.addCalendarEntry(entry);

      expect(useSocialPublishingStore.getState().calendarEntries).toHaveLength(1);
    });

    it('should get entries in range', () => {
      const store = useSocialPublishingStore.getState();
      const now = Math.floor(Date.now() / 1000);

      store.addCalendarEntry(makeCalendarEntry({ scheduledAt: now + 100 }));
      store.addCalendarEntry(makeCalendarEntry({ scheduledAt: now + 500 }));
      store.addCalendarEntry(makeCalendarEntry({ scheduledAt: now + 10000 }));

      const entries = useSocialPublishingStore
        .getState()
        .getCalendarEntriesInRange(now, now + 600);
      expect(entries).toHaveLength(2);
    });

    it('should update calendar entry', () => {
      const store = useSocialPublishingStore.getState();
      const entry = makeCalendarEntry();
      store.addCalendarEntry(entry);

      useSocialPublishingStore.getState().updateCalendarEntry(entry.id, {
        status: 'published',
      });
      expect(useSocialPublishingStore.getState().calendarEntries[0].status).toBe(
        'published'
      );
    });
  });

  describe('Outreach Summary', () => {
    it('should compute outreach summary', () => {
      const store = useSocialPublishingStore.getState();

      store.addScheduledContent(makeScheduledContent({ status: 'pending' }));
      store.addScheduledContent(makeScheduledContent({ status: 'published' }));
      store.addScheduledContent(makeScheduledContent({ status: 'failed' }));
      store.addShareLink(makeShareLink({ clickCount: 10, isActive: true }));
      store.addShareLink(makeShareLink({ clickCount: 5, isActive: true }));
      store.addShareLink(makeShareLink({ clickCount: 0, isActive: false }));

      const summary = useSocialPublishingStore.getState().getOutreachSummary();
      expect(summary.totalShareLinks).toBe(3);
      expect(summary.activeShareLinks).toBe(2);
      expect(summary.totalClicks).toBe(15);
      expect(summary.scheduledPending).toBe(1);
      expect(summary.scheduledPublished).toBe(1);
      expect(summary.scheduledFailed).toBe(1);
      expect(summary.topLinks).toHaveLength(3);
      expect(summary.topLinks[0].clickCount).toBe(10);
    });

    it('should return empty summary when no data', () => {
      const summary = useSocialPublishingStore.getState().getOutreachSummary();
      expect(summary.totalShareLinks).toBe(0);
      expect(summary.totalClicks).toBe(0);
      expect(summary.scheduledPending).toBe(0);
    });
  });

  describe('Social Accounts', () => {
    it('should add and remove social accounts', () => {
      const store = useSocialPublishingStore.getState();
      const account: SocialAccount = {
        _v: SCHEMA_VERSION,
        id: crypto.randomUUID(),
        platform: 'activitypub',
        handle: '@test@mastodon.social',
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000),
      };

      store.addSocialAccount(account);
      expect(useSocialPublishingStore.getState().socialAccounts).toHaveLength(1);

      useSocialPublishingStore.getState().removeSocialAccount(account.id);
      expect(useSocialPublishingStore.getState().socialAccounts).toHaveLength(0);
    });

    it('should get active accounts', () => {
      const store = useSocialPublishingStore.getState();
      store.addSocialAccount({
        _v: SCHEMA_VERSION,
        id: '1',
        platform: 'activitypub',
        handle: '@active@mastodon.social',
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000),
      });
      store.addSocialAccount({
        _v: SCHEMA_VERSION,
        id: '2',
        platform: 'atproto',
        handle: 'inactive.bsky.social',
        isActive: false,
        createdAt: Math.floor(Date.now() / 1000),
      });

      const active = useSocialPublishingStore.getState().getActiveAccounts();
      expect(active).toHaveLength(1);
      expect(active[0].handle).toBe('@active@mastodon.social');
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      const store = useSocialPublishingStore.getState();
      store.addScheduledContent(makeScheduledContent());
      store.addShareLink(makeShareLink());
      store.addCalendarEntry(makeCalendarEntry());
      store.setError('test error');

      useSocialPublishingStore.getState().reset();

      const state = useSocialPublishingStore.getState();
      expect(state.scheduledContent).toHaveLength(0);
      expect(state.shareLinks).toHaveLength(0);
      expect(state.calendarEntries).toHaveLength(0);
      expect(state.error).toBeNull();
    });
  });
});
