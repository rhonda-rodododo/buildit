/**
 * Public Module Store
 * Zustand store for public pages and analytics
 *
 * This is a lightweight infrastructure module used by Forms and Fundraising
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PublicPage,
  Analytics,
  AnalyticsSummary,
  PublicState,
} from './types';

interface PublicStoreState extends PublicState {
  // ============================================================================
  // Public Pages Actions
  // ============================================================================

  // CRUD
  addPublicPage: (page: PublicPage) => void;
  updatePublicPage: (pageId: string, updates: Partial<PublicPage>) => void;
  deletePublicPage: (pageId: string) => void;
  getPublicPage: (pageId: string) => PublicPage | undefined;
  getPublicPageBySlug: (groupId: string, slug: string) => PublicPage | undefined;
  getPublicPages: (groupId: string) => PublicPage[];
  getPublishedPages: (groupId: string) => PublicPage[];

  // ============================================================================
  // Analytics Actions
  // ============================================================================

  // Events
  addAnalyticsEvent: (event: Analytics) => void;
  getAnalyticsEvents: (resourceType: string, resourceId: string) => Analytics[];

  // Summaries
  updateAnalyticsSummary: (summary: AnalyticsSummary) => void;
  getAnalyticsSummary: (
    resourceType: string,
    resourceId: string,
    timeframe: AnalyticsSummary['timeframe']
  ) => AnalyticsSummary | undefined;

  // ============================================================================
  // Utility Actions
  // ============================================================================

  clearAll: () => void;
  loadData: (data: Partial<PublicState>) => void;
}

export const usePublicStore = create<PublicStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      publicPages: new Map(),
      analytics: new Map(),
      analyticsSummaries: new Map(),
      loading: false,
      error: null,

      // ========================================================================
      // Public Pages Actions
      // ========================================================================

      addPublicPage: (page) => set((state) => {
        const newPages = new Map(state.publicPages);
        newPages.set(page.id, page);
        return { publicPages: newPages };
      }),

      updatePublicPage: (pageId, updates) => set((state) => {
        const newPages = new Map(state.publicPages);
        const existing = newPages.get(pageId);
        if (existing) {
          newPages.set(pageId, { ...existing, ...updates, updated: Date.now() });
        }
        return { publicPages: newPages };
      }),

      deletePublicPage: (pageId) => set((state) => {
        const newPages = new Map(state.publicPages);
        newPages.delete(pageId);
        return { publicPages: newPages };
      }),

      getPublicPage: (pageId) => {
        return get().publicPages.get(pageId);
      },

      getPublicPageBySlug: (groupId, slug) => {
        return Array.from(get().publicPages.values()).find(
          (p) => p.groupId === groupId && p.slug === slug && p.status === 'published'
        );
      },

      getPublicPages: (groupId) => {
        return Array.from(get().publicPages.values())
          .filter((p) => p.groupId === groupId)
          .sort((a, b) => b.created - a.created);
      },

      getPublishedPages: (groupId) => {
        return Array.from(get().publicPages.values())
          .filter((p) => p.groupId === groupId && p.status === 'published')
          .sort((a, b) => b.created - a.created);
      },

      // ========================================================================
      // Analytics Actions
      // ========================================================================

      addAnalyticsEvent: (event) => set((state) => {
        const newAnalytics = new Map(state.analytics);
        newAnalytics.set(event.id, event);
        return { analytics: newAnalytics };
      }),

      getAnalyticsEvents: (resourceType, resourceId) => {
        return Array.from(get().analytics.values())
          .filter((e) => e.resourceType === resourceType && e.resourceId === resourceId)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      updateAnalyticsSummary: (summary) => set((state) => {
        const newSummaries = new Map(state.analyticsSummaries);
        const key = `${summary.resourceType}-${summary.resourceId}-${summary.timeframe}`;
        newSummaries.set(key, summary);
        return { analyticsSummaries: newSummaries };
      }),

      getAnalyticsSummary: (resourceType, resourceId, timeframe) => {
        const key = `${resourceType}-${resourceId}-${timeframe}`;
        return get().analyticsSummaries.get(key);
      },

      // ========================================================================
      // Utility Actions
      // ========================================================================

      clearAll: () =>
        set({
          publicPages: new Map(),
          analytics: new Map(),
          analyticsSummaries: new Map(),
          loading: false,
          error: null,
        }),

      loadData: (data) =>
        set((state) => ({
          ...state,
          ...data,
        })),
    }),
    {
      name: 'public-storage',
      // Only persist essential data, not analytics
      partialize: (state) => ({
        publicPages: state.publicPages,
      }),
    }
  )
);
