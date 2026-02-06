/**
 * Social Publishing Module Store
 *
 * Zustand store for managing scheduled content, share links,
 * social accounts, calendar entries, and outreach analytics.
 */

import { create } from 'zustand';
import type {
  ScheduledContent,
  ShareLink,
  SocialAccount,
  ContentCalendarEntry,
  OutreachAnalytics,
  OutreachSummary,
} from './types';

interface SocialPublishingState {
  // Data
  scheduledContent: ScheduledContent[];
  shareLinks: ShareLink[];
  socialAccounts: SocialAccount[];
  calendarEntries: ContentCalendarEntry[];
  analytics: OutreachAnalytics[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Scheduled Content Actions
  setScheduledContent: (items: ScheduledContent[]) => void;
  addScheduledContent: (item: ScheduledContent) => void;
  updateScheduledContent: (id: string, updates: Partial<ScheduledContent>) => void;
  removeScheduledContent: (id: string) => void;
  getScheduledContentById: (id: string) => ScheduledContent | undefined;
  getScheduledByModule: (sourceModule: string) => ScheduledContent[];
  getPendingScheduled: () => ScheduledContent[];
  getDueScheduledContent: () => ScheduledContent[];

  // Share Link Actions
  setShareLinks: (links: ShareLink[]) => void;
  addShareLink: (link: ShareLink) => void;
  updateShareLink: (id: string, updates: Partial<ShareLink>) => void;
  removeShareLink: (id: string) => void;
  getShareLinkBySlug: (slug: string) => ShareLink | undefined;
  getShareLinksByModule: (sourceModule: string) => ShareLink[];
  getActiveShareLinks: () => ShareLink[];

  // Social Account Actions
  setSocialAccounts: (accounts: SocialAccount[]) => void;
  addSocialAccount: (account: SocialAccount) => void;
  updateSocialAccount: (id: string, updates: Partial<SocialAccount>) => void;
  removeSocialAccount: (id: string) => void;
  getActiveAccounts: () => SocialAccount[];

  // Calendar Actions
  setCalendarEntries: (entries: ContentCalendarEntry[]) => void;
  addCalendarEntry: (entry: ContentCalendarEntry) => void;
  updateCalendarEntry: (id: string, updates: Partial<ContentCalendarEntry>) => void;
  getCalendarEntriesInRange: (startDate: number, endDate: number) => ContentCalendarEntry[];

  // Analytics Actions
  addAnalyticsEntry: (entry: OutreachAnalytics) => void;
  getAnalyticsForLink: (shareLinkId: string) => OutreachAnalytics[];
  getOutreachSummary: () => OutreachSummary;

  // General
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  scheduledContent: [] as ScheduledContent[],
  shareLinks: [] as ShareLink[],
  socialAccounts: [] as SocialAccount[],
  calendarEntries: [] as ContentCalendarEntry[],
  analytics: [] as OutreachAnalytics[],
  isLoading: false,
  error: null as string | null,
};

export const useSocialPublishingStore = create<SocialPublishingState>()((set, get) => ({
  ...initialState,

  // ── Scheduled Content ──────────────────────────────────────────

  setScheduledContent: (items) => set({ scheduledContent: items }),

  addScheduledContent: (item) =>
    set((state) => ({
      scheduledContent: [...state.scheduledContent, item],
    })),

  updateScheduledContent: (id, updates) =>
    set((state) => ({
      scheduledContent: state.scheduledContent.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: Math.floor(Date.now() / 1000) } : item
      ),
    })),

  removeScheduledContent: (id) =>
    set((state) => ({
      scheduledContent: state.scheduledContent.filter((item) => item.id !== id),
    })),

  getScheduledContentById: (id) =>
    get().scheduledContent.find((item) => item.id === id),

  getScheduledByModule: (sourceModule) =>
    get().scheduledContent.filter((item) => item.sourceModule === sourceModule),

  getPendingScheduled: () =>
    get().scheduledContent.filter((item) => item.status === 'pending'),

  getDueScheduledContent: () => {
    const now = Math.floor(Date.now() / 1000);
    return get().scheduledContent.filter(
      (item) => item.status === 'pending' && item.scheduledAt <= now
    );
  },

  // ── Share Links ────────────────────────────────────────────────

  setShareLinks: (links) => set({ shareLinks: links }),

  addShareLink: (link) =>
    set((state) => ({
      shareLinks: [...state.shareLinks, link],
    })),

  updateShareLink: (id, updates) =>
    set((state) => ({
      shareLinks: state.shareLinks.map((link) =>
        link.id === id ? { ...link, ...updates } : link
      ),
    })),

  removeShareLink: (id) =>
    set((state) => ({
      shareLinks: state.shareLinks.filter((link) => link.id !== id),
    })),

  getShareLinkBySlug: (slug) =>
    get().shareLinks.find((link) => link.slug === slug),

  getShareLinksByModule: (sourceModule) =>
    get().shareLinks.filter((link) => link.sourceModule === sourceModule),

  getActiveShareLinks: () =>
    get().shareLinks.filter((link) => {
      if (!link.isActive) return false;
      if (link.expiresAt && link.expiresAt < Math.floor(Date.now() / 1000)) return false;
      return true;
    }),

  // ── Social Accounts ────────────────────────────────────────────

  setSocialAccounts: (accounts) => set({ socialAccounts: accounts }),

  addSocialAccount: (account) =>
    set((state) => ({
      socialAccounts: [...state.socialAccounts, account],
    })),

  updateSocialAccount: (id, updates) =>
    set((state) => ({
      socialAccounts: state.socialAccounts.map((account) =>
        account.id === id ? { ...account, ...updates } : account
      ),
    })),

  removeSocialAccount: (id) =>
    set((state) => ({
      socialAccounts: state.socialAccounts.filter((account) => account.id !== id),
    })),

  getActiveAccounts: () =>
    get().socialAccounts.filter((account) => account.isActive),

  // ── Calendar Entries ───────────────────────────────────────────

  setCalendarEntries: (entries) => set({ calendarEntries: entries }),

  addCalendarEntry: (entry) =>
    set((state) => ({
      calendarEntries: [...state.calendarEntries, entry],
    })),

  updateCalendarEntry: (id, updates) =>
    set((state) => ({
      calendarEntries: state.calendarEntries.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      ),
    })),

  getCalendarEntriesInRange: (startDate, endDate) =>
    get().calendarEntries.filter(
      (entry) => entry.scheduledAt >= startDate && entry.scheduledAt <= endDate
    ),

  // ── Analytics ──────────────────────────────────────────────────

  addAnalyticsEntry: (entry) =>
    set((state) => ({
      analytics: [...state.analytics, entry],
    })),

  getAnalyticsForLink: (shareLinkId) =>
    get().analytics.filter((entry) => entry.shareLinkId === shareLinkId),

  getOutreachSummary: () => {
    const { shareLinks, scheduledContent } = get();
    const activeLinks = shareLinks.filter((link) => {
      if (!link.isActive) return false;
      if (link.expiresAt && link.expiresAt < Math.floor(Date.now() / 1000)) return false;
      return true;
    });

    const totalClicks = shareLinks.reduce(
      (sum, link) => sum + (link.clickCount ?? 0),
      0
    );

    const topLinks = [...shareLinks]
      .sort((a, b) => (b.clickCount ?? 0) - (a.clickCount ?? 0))
      .slice(0, 10)
      .map((link) => ({
        slug: link.slug,
        title: link.seoOverrides?.title || link.slug,
        clickCount: link.clickCount ?? 0,
      }));

    return {
      totalShareLinks: shareLinks.length,
      activeShareLinks: activeLinks.length,
      totalClicks,
      scheduledPending: scheduledContent.filter((s) => s.status === 'pending').length,
      scheduledPublished: scheduledContent.filter((s) => s.status === 'published').length,
      scheduledFailed: scheduledContent.filter((s) => s.status === 'failed').length,
      topLinks,
    };
  },

  // ── General ────────────────────────────────────────────────────

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
