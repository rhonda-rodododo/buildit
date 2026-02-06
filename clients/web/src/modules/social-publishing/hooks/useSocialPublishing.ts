/**
 * Social Publishing Hooks
 *
 * Convenience hooks for accessing social publishing functionality.
 */

import { useCallback, useMemo } from 'react';
import { useSocialPublishingStore } from '../socialPublishingStore';
import { getSocialPublishingManager } from '../socialPublishingManager';
import { useAuthStore } from '@/stores/authStore';
import type {
  ScheduleContentInput,
  CreateShareLinkInput,
  ContentCalendarEntry,
  OutreachSummary,
} from '../types';

/**
 * Hook for scheduling content from any module.
 */
export function useScheduler() {
  const { currentIdentity } = useAuthStore();
  const store = useSocialPublishingStore();
  const manager = getSocialPublishingManager();

  const scheduleContent = useCallback(
    async (input: ScheduleContentInput, signedEventJson?: string) => {
      if (!currentIdentity?.publicKey) {
        throw new Error('Not authenticated');
      }
      return manager.scheduleContent(input, currentIdentity.publicKey, signedEventJson);
    },
    [currentIdentity?.publicKey, manager]
  );

  const cancelSchedule = useCallback(
    (id: string) => manager.cancelSchedule(id),
    [manager]
  );

  const pendingContent = useMemo(
    () => store.getPendingScheduled(),
    [store]
  );

  const dueContent = useMemo(
    () => store.getDueScheduledContent(),
    [store]
  );

  return {
    scheduleContent,
    cancelSchedule,
    pendingContent,
    dueContent,
    scheduledContent: store.scheduledContent,
    isLoading: store.isLoading,
  };
}

/**
 * Hook for creating and managing share links.
 */
export function useShareLinks(sourceModule?: string) {
  const { currentIdentity } = useAuthStore();
  const store = useSocialPublishingStore();
  const manager = getSocialPublishingManager();

  const createShareLink = useCallback(
    async (input: CreateShareLinkInput) => {
      if (!currentIdentity?.publicKey) {
        throw new Error('Not authenticated');
      }
      return manager.createShareLink(input, currentIdentity.publicKey);
    },
    [currentIdentity?.publicKey, manager]
  );

  const deactivateLink = useCallback(
    (id: string) => manager.deactivateShareLink(id),
    [manager]
  );

  const getShareUrl = useCallback(
    (slug: string) => manager.getShareUrl(slug),
    [manager]
  );

  const links = useMemo(
    () =>
      sourceModule
        ? store.getShareLinksByModule(sourceModule)
        : store.shareLinks,
    [store, sourceModule]
  );

  const activeLinks = useMemo(
    () => store.getActiveShareLinks(),
    [store]
  );

  return {
    createShareLink,
    deactivateLink,
    getShareUrl,
    links,
    activeLinks,
  };
}

/**
 * Hook for accessing the content calendar.
 */
export function useContentCalendar() {
  const store = useSocialPublishingStore();
  const manager = getSocialPublishingManager();

  const getEntries = useCallback(
    (start: Date, end: Date): ContentCalendarEntry[] =>
      manager.getCalendarEntries(start, end),
    [manager]
  );

  const reschedule = useCallback(
    (id: string, newDate: Date) => manager.rescheduleEntry(id, newDate),
    [manager]
  );

  return {
    getEntries,
    reschedule,
    calendarEntries: store.calendarEntries,
  };
}

/**
 * Hook for outreach analytics.
 */
export function useOutreachAnalytics() {
  const store = useSocialPublishingStore();

  const summary: OutreachSummary = useMemo(
    () => store.getOutreachSummary(),
    [store]
  );

  return {
    summary,
    analytics: store.analytics,
    getAnalyticsForLink: store.getAnalyticsForLink,
  };
}
