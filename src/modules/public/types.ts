/**
 * Public Module Types
 * SEO-optimized public pages and privacy-preserving analytics
 * Shared by Forms and Fundraising modules
 */

import type { IndexabilitySettings } from '@/types/indexability';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

// ============================================================================
// Public Pages Types
// ============================================================================

export type PageType = 'landing' | 'about' | 'events' | 'contact' | 'custom';
export type PageStatus = 'draft' | 'published';

/**
 * Public Page
 * SEO-optimized public pages for groups
 */
export interface PublicPage {
  id: string;
  groupId: string;
  slug: string; // URL-friendly identifier (e.g., "about-us")
  title: string;
  type: PageType;
  content: string; // HTML content (from rich text editor)

  // SEO
  seo: SEOMetadata;

  // Indexability controls
  indexability: IndexabilitySettings;

  // Status
  status: PageStatus;

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
  publishedAt?: number;
}

/**
 * SEO Metadata
 */
export interface SEOMetadata {
  title?: string; // page title (overrides PublicPage.title)
  description?: string;
  keywords?: string[];

  // Open Graph (Facebook, LinkedIn)
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string; // website, article, etc.

  // Twitter Card
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string; // @username
  twitterCreator?: string; // @username

  // Technical SEO
  canonicalUrl?: string;
  robots?: string; // e.g., "index, follow" or "noindex, nofollow"

  // Schema.org structured data
  schemaOrgType?: string; // Organization, Event, Article, etc.
  schemaOrgJson?: string; // JSON-LD string
}

// ============================================================================
// Analytics Types
// ============================================================================

export type AnalyticsEvent = 'view' | 'submit' | 'donate' | 'click' | 'share';
export type AnalyticsResource = 'form' | 'campaign' | 'page';

/**
 * Analytics Event
 * Privacy-preserving analytics without tracking individual users
 */
export interface Analytics {
  id: string;
  groupId: string;

  // Resource
  resourceType: AnalyticsResource;
  resourceId: string;

  // Event
  event: AnalyticsEvent;
  eventData?: Record<string, unknown>; // additional event data

  // Timestamp
  timestamp: number;

  // Privacy-preserving metadata (no user identification)
  sessionId: string; // random session ID (not tied to user)
  userAgent?: string;
  referrer?: string;
  country?: string; // from IP geolocation (no precise location)

  // No IP addresses, no cookies, no user IDs
}

/**
 * Analytics Summary
 * Aggregated stats for dashboards
 */
export interface AnalyticsSummary {
  resourceType: AnalyticsResource;
  resourceId: string;
  timeframe: 'day' | 'week' | 'month' | 'year' | 'all';

  // Metrics
  views: number;
  submissions?: number; // for forms
  donations?: number; // for campaigns
  totalRaised?: number; // for campaigns (in cents)
  clicks?: number;
  shares?: number;

  // Conversion rate (views → submissions/donations)
  conversionRate?: number; // percentage

  // Top referrers
  topReferrers?: Array<{ referrer: string; count: number }>;

  // Computed at
  computedAt: number;
}

// ============================================================================
// Store State Types
// ============================================================================

export interface PublicState {
  // Public Pages
  publicPages: Map<string, PublicPage>;

  // Analytics
  analytics: Map<string, Analytics>;
  analyticsSummaries: Map<string, AnalyticsSummary>;

  // Loading state
  loading: boolean;
  error: string | null;
}

// Re-export indexability types for convenience
export type { IndexabilitySettings };
export { DEFAULT_INDEXABILITY };
