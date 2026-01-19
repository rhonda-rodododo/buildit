/**
 * Publishing Module Types
 * Long-form publishing with articles, publications, and subscriber management
 */

import type { SEOMetadata } from '../public/types';
import type {
  IndexabilitySettings,
  IndexabilityDefaults,
  DEFAULT_INDEXABILITY,
} from '@/types/indexability';

// ============================================================================
// Article Types
// ============================================================================

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type ArticleVisibility = 'public' | 'subscribers' | 'paid';

/**
 * Article - Long-form content
 */
export interface Article {
  id: string;
  publicationId: string;
  groupId: string;

  // Content
  title: string;
  subtitle?: string;
  slug: string; // URL-friendly identifier
  content: string; // HTML from TipTap editor
  excerpt?: string; // Short preview text
  coverImage?: string; // Cover image URL

  // Metadata
  authorPubkey: string;
  authorName?: string;
  tags: string[];

  // Status & Visibility
  status: ArticleStatus;
  visibility: ArticleVisibility;

  // Scheduling
  scheduledAt?: number; // For scheduled posts
  publishedAt?: number;

  // SEO
  seo: SEOMetadata;

  // Indexability (for public articles)
  indexability: IndexabilitySettings;

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Reading time (calculated from content)
  readingTimeMinutes?: number;

  // Word count
  wordCount?: number;

  // Version control
  version: number;
  lastSavedAt: number;
}

/**
 * Article draft for auto-save
 */
export interface ArticleDraft {
  id: string;
  articleId?: string; // Linked article if editing existing
  publicationId: string;
  groupId: string;

  // Draft content
  title: string;
  subtitle?: string;
  content: string;
  coverImage?: string;
  tags: string[];

  // Auto-save metadata
  savedAt: number;
  authorPubkey: string;
}

// ============================================================================
// Publication Types
// ============================================================================

export type PublicationStatus = 'active' | 'paused' | 'archived';

/**
 * Publication - Blog/Newsletter publication
 */
export interface Publication {
  id: string;
  groupId: string;

  // Basic info
  name: string;
  description: string;
  slug: string; // URL-friendly identifier

  // Branding
  logo?: string;
  favicon?: string;
  coverImage?: string;

  // Theme
  theme: PublicationTheme;

  // Navigation
  navigation: NavigationItem[];

  // Settings
  settings: PublicationSettings;

  // Status
  status: PublicationStatus;

  // SEO defaults
  defaultSeo: SEOMetadata;

  // Owner/admin
  ownerPubkey: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Publication theme settings
 */
export interface PublicationTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  headingFont?: string;
  bodyFont?: string;
  layout: 'default' | 'magazine' | 'minimal';
  darkMode: boolean;
}

/**
 * Publication settings
 */
export interface PublicationSettings {
  // Content settings
  defaultVisibility: ArticleVisibility;
  allowComments: boolean;
  requireSubscription: boolean;

  // RSS settings
  enableRss: boolean;
  rssFullContent: boolean; // Full article or excerpt in RSS

  // Email/notification settings
  enableEmailNotifications: boolean;
  welcomeMessage?: string;

  // Custom domain (future feature)
  customDomain?: string;

  // Monetization
  enablePaidSubscriptions: boolean;
  subscriptionPrice?: number; // Monthly price in cents

  // Social links
  socialLinks?: SocialLinks;

  // Indexability defaults for new articles
  indexabilityDefaults?: IndexabilityDefaults;
}

/**
 * Social links for publication
 */
export interface SocialLinks {
  twitter?: string;
  nostr?: string;
  mastodon?: string;
  bluesky?: string;
  website?: string;
  email?: string;
}

/**
 * Navigation item for publication
 */
export interface NavigationItem {
  id: string;
  label: string;
  url: string;
  type: 'link' | 'page' | 'category';
  order: number;
}

// ============================================================================
// Subscription Types
// ============================================================================

export type SubscriptionTier = 'free' | 'paid';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

/**
 * Subscription - Reader subscription to publication
 */
export interface Subscription {
  id: string;
  publicationId: string;
  groupId: string;

  // Subscriber info
  subscriberPubkey: string;
  subscriberEmail?: string; // Optional email for notifications

  // Subscription details
  tier: SubscriptionTier;
  status: SubscriptionStatus;

  // Timestamps
  subscribedAt: number;
  expiresAt?: number; // For paid subscriptions
  cancelledAt?: number;

  // Preferences
  preferences: SubscriptionPreferences;
}

/**
 * Subscription preferences
 */
export interface SubscriptionPreferences {
  emailNotifications: boolean;
  nostrNotifications: boolean;
  digestFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Article view - Privacy-preserving page view tracking
 */
export interface ArticleView {
  id: string;
  articleId: string;
  publicationId: string;

  // Privacy-preserving metadata
  sessionId: string; // Random session ID (not tied to user)
  viewedAt: number;

  // Optional metadata
  referrer?: string;
  readTimeSeconds?: number; // Time spent reading
  scrollDepthPercent?: number; // How far they scrolled
}

/**
 * Article analytics summary
 */
export interface ArticleAnalytics {
  articleId: string;

  // Metrics
  totalViews: number;
  uniqueViews: number;
  avgReadTimeSeconds: number;
  avgScrollDepthPercent: number;

  // Engagement
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;

  // Top referrers
  topReferrers: Array<{ referrer: string; count: number }>;

  // Time series (last 30 days)
  viewsByDay: Array<{ date: string; views: number }>;

  // Computed at
  computedAt: number;
}

/**
 * Publication analytics summary
 */
export interface PublicationAnalytics {
  publicationId: string;

  // Overview
  totalArticles: number;
  publishedArticles: number;
  totalViews: number;
  totalSubscribers: number;

  // Growth
  newSubscribersThisMonth: number;
  viewsThisMonth: number;

  // Top articles
  topArticles: Array<{
    articleId: string;
    title: string;
    views: number;
  }>;

  // Subscriber breakdown
  freeSubscribers: number;
  paidSubscribers: number;

  // Computed at
  computedAt: number;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateArticleInput {
  publicationId: string;
  groupId: string;
  title: string;
  subtitle?: string;
  content?: string;
  coverImage?: string;
  tags?: string[];
  visibility?: ArticleVisibility;
  seo?: Partial<SEOMetadata>;
  indexability?: Partial<IndexabilitySettings>;
}

export interface UpdateArticleInput {
  title?: string;
  subtitle?: string;
  content?: string;
  coverImage?: string;
  tags?: string[];
  visibility?: ArticleVisibility;
  status?: ArticleStatus;
  scheduledAt?: number;
  seo?: Partial<SEOMetadata>;
  indexability?: Partial<IndexabilitySettings>;
}

export interface CreatePublicationInput {
  groupId: string;
  name: string;
  description: string;
  slug?: string;
  logo?: string;
  theme?: Partial<PublicationTheme>;
  settings?: Partial<PublicationSettings>;
}

export interface UpdatePublicationInput {
  name?: string;
  description?: string;
  logo?: string;
  favicon?: string;
  coverImage?: string;
  theme?: Partial<PublicationTheme>;
  settings?: Partial<PublicationSettings>;
  navigation?: NavigationItem[];
  defaultSeo?: Partial<SEOMetadata>;
  status?: PublicationStatus;
}

// Re-export indexability types for convenience
export type { IndexabilitySettings, IndexabilityDefaults };
export { DEFAULT_INDEXABILITY };

export interface SubscribeInput {
  publicationId: string;
  subscriberPubkey: string;
  subscriberEmail?: string;
  tier: SubscriptionTier;
  preferences?: Partial<SubscriptionPreferences>;
}

// ============================================================================
// RSS Types
// ============================================================================

/**
 * RSS Feed item
 */
export interface RSSFeedItem {
  title: string;
  link: string;
  pubDate: string; // RFC 822 date
  description: string;
  content?: string; // Full HTML content
  author?: string;
  guid: string;
  categories?: string[];
  enclosure?: {
    url: string;
    type: string;
    length?: number;
  };
}

/**
 * RSS Feed metadata
 */
export interface RSSFeed {
  title: string;
  description: string;
  link: string;
  language?: string;
  lastBuildDate: string;
  generator: string;
  items: RSSFeedItem[];
}

// ============================================================================
// Store State Types
// ============================================================================

export interface PublishingState {
  // Publications
  publications: Map<string, Publication>;
  currentPublication: Publication | null;

  // Articles
  articles: Map<string, Article>;
  articleDrafts: Map<string, ArticleDraft>;
  currentArticle: Article | null;

  // Subscriptions
  subscriptions: Map<string, Subscription>;

  // Analytics
  articleAnalytics: Map<string, ArticleAnalytics>;
  publicationAnalytics: Map<string, PublicationAnalytics>;

  // Loading state
  loading: boolean;
  error: string | null;
}
