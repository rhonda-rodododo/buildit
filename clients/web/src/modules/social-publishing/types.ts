/**
 * Social Publishing Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (form inputs, computed results) are defined here.
 */

// Re-export all generated Zod schemas and types
export {
  ScheduledContentSchema,
  type ScheduledContent,
  CrossPostConfigSchema,
  type CrossPostConfig,
  PlatformPostSchema,
  type PlatformPost,
  RecurrenceRuleSchema,
  type RecurrenceRule,
  SocialAccountSchema,
  type SocialAccount,
  ShareLinkSchema,
  type ShareLink,
  SEOOverridesSchema,
  type SEOOverrides,
  ContentCalendarEntrySchema,
  type ContentCalendarEntry,
  OutreachAnalyticsSchema,
  type OutreachAnalytics,
  SOCIAL_PUBLISHING_SCHEMA_VERSION,
} from '@/generated/validation/social-publishing.zod';

// ── UI-Only Types ──────────────────────────────────────────────────

/**
 * Input for scheduling content (form data — UI-only type)
 */
export interface ScheduleContentInput {
  sourceModule: string;
  sourceContentId: string;
  scheduledAt: Date;
  timezone: string;
  platforms: {
    platform: 'nostr' | 'activitypub' | 'atproto' | 'rss';
    enabled: boolean;
    customContent?: string;
  }[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    count?: number;
    until?: Date;
    byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
  };
}

/**
 * Input for creating a share link (form data — UI-only type)
 */
export interface CreateShareLinkInput {
  sourceModule: string;
  sourceContentId: string;
  customSlug?: string;
  expiresAt?: Date;
  password?: string;
  trackClicks?: boolean;
  seoOverrides?: {
    title?: string;
    description?: string;
    ogImageUrl?: string;
    keywords?: string[];
  };
}

/**
 * Platform share target for the SocialShareDialog.
 * These are simple URL-based share links — no third-party SDKs or tracking scripts.
 */
export interface ShareTarget {
  id: string;
  name: string;
  /** URL template with {url} and {text} placeholders */
  urlTemplate: string;
  icon: string;
}

/**
 * Calendar view mode
 */
export type CalendarViewMode = 'month' | 'week' | 'day';

/**
 * Outreach dashboard summary (computed at runtime — UI-only type)
 */
export interface OutreachSummary {
  totalShareLinks: number;
  activeShareLinks: number;
  totalClicks: number;
  scheduledPending: number;
  scheduledPublished: number;
  scheduledFailed: number;
  topLinks: Array<{
    slug: string;
    title: string;
    clickCount: number;
  }>;
}
