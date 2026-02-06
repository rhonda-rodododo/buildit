/**
 * Privacy-Preserving Link Tracking for Newsletters
 *
 * IMPORTANT: This module implements AGGREGATE-ONLY tracking.
 * - NO per-user tracking
 * - NO tracking pixels
 * - NO personally identifiable information stored
 * - Only aggregate click counts per link per issue
 *
 * Links in newsletters are replaced with redirect URLs containing
 * a Nostr event reference. On click, only the aggregate count is
 * incremented. No individual subscriber is identified.
 */

import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

/**
 * Aggregate link click data - stores only totals, never per-user data
 */
export interface LinkClickAggregate {
  /** Unique ID for this tracked link */
  linkId: string;
  /** The newsletter issue ID */
  issueId: string;
  /** The original destination URL */
  originalUrl: string;
  /** The display text used in the newsletter */
  linkText: string;
  /** Total aggregate click count */
  clickCount: number;
  /** First click timestamp */
  firstClickAt: number;
  /** Last click timestamp */
  lastClickAt: number;
}

/**
 * Link tracking configuration for a newsletter issue
 */
export interface LinkTrackingConfig {
  /** Whether link tracking is enabled */
  enabled: boolean;
  /** The newsletter issue ID */
  issueId: string;
  /** Base URL for redirect endpoints */
  redirectBaseUrl: string;
}

/**
 * Processed link with tracking URL
 */
interface ProcessedLink {
  linkId: string;
  originalUrl: string;
  trackingUrl: string;
  linkText: string;
}

/**
 * Click-through rate analytics for a newsletter issue
 */
export interface LinkAnalytics {
  issueId: string;
  /** Total links tracked */
  totalLinks: number;
  /** Total aggregate clicks across all links */
  totalClicks: number;
  /** Per-link breakdown */
  links: LinkClickAggregate[];
  /** Computed at timestamp */
  computedAt: number;
}

// ============================================================================
// In-Memory Aggregate Store
// ============================================================================

/**
 * In-memory store for aggregate link click data.
 * In production, this would be backed by a local database table.
 */
const aggregateStore = new Map<string, LinkClickAggregate>();

/**
 * Get all aggregates for a specific issue
 */
export function getIssueAggregates(issueId: string): LinkClickAggregate[] {
  return Array.from(aggregateStore.values())
    .filter((agg) => agg.issueId === issueId)
    .sort((a, b) => b.clickCount - a.clickCount);
}

/**
 * Get analytics summary for a newsletter issue
 */
export function getIssueLinkAnalytics(issueId: string): LinkAnalytics {
  const links = getIssueAggregates(issueId);
  const totalClicks = links.reduce((sum, link) => sum + link.clickCount, 0);

  return {
    issueId,
    totalLinks: links.length,
    totalClicks,
    links,
    computedAt: Date.now(),
  };
}

/**
 * Record a link click (aggregate only - NO user identification)
 */
export function recordLinkClick(linkId: string): void {
  const existing = aggregateStore.get(linkId);
  if (!existing) return;

  aggregateStore.set(linkId, {
    ...existing,
    clickCount: existing.clickCount + 1,
    lastClickAt: Date.now(),
  });
}

/**
 * Register a tracked link in the aggregate store
 */
function registerTrackedLink(
  linkId: string,
  issueId: string,
  originalUrl: string,
  linkText: string
): void {
  aggregateStore.set(linkId, {
    linkId,
    issueId,
    originalUrl,
    linkText,
    clickCount: 0,
    firstClickAt: 0,
    lastClickAt: 0,
  });
}

// ============================================================================
// Link Processing
// ============================================================================

/**
 * Process HTML content to replace links with tracking redirect URLs.
 *
 * Only replaces external links (http/https). Internal links and
 * anchor links are left untouched.
 *
 * @param htmlContent The newsletter HTML content
 * @param config Link tracking configuration
 * @returns Processed HTML with tracking URLs and list of tracked links
 */
export function processLinksForTracking(
  htmlContent: string,
  config: LinkTrackingConfig
): { html: string; trackedLinks: ProcessedLink[] } {
  if (!config.enabled) {
    return { html: htmlContent, trackedLinks: [] };
  }

  const trackedLinks: ProcessedLink[] = [];

  // Match <a> tags and replace href attributes
  const processed = htmlContent.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>(.*?)<\/a>/gi,
    (match, before, url, after, text) => {
      // Only track external links
      if (!isExternalUrl(url)) {
        return match;
      }

      const linkId = nanoid(12);
      const trackingUrl = buildTrackingUrl(config.redirectBaseUrl, linkId, config.issueId);

      // Register in aggregate store
      registerTrackedLink(linkId, config.issueId, url, stripHtml(text));

      trackedLinks.push({
        linkId,
        originalUrl: url,
        trackingUrl,
        linkText: stripHtml(text),
      });

      return `<a ${before}href="${trackingUrl}" data-original-url="${escapeAttr(url)}"${after}>${text}</a>`;
    }
  );

  return { html: processed, trackedLinks };
}

/**
 * Resolve a tracking URL back to the original destination URL.
 * Called by the redirect handler when a link is clicked.
 *
 * @param linkId The link tracking ID from the redirect URL
 * @returns The original URL or null if not found
 */
export function resolveTrackingLink(linkId: string): string | null {
  const aggregate = aggregateStore.get(linkId);
  if (!aggregate) return null;

  // Record the click (aggregate only)
  recordLinkClick(linkId);

  return aggregate.originalUrl;
}

/**
 * Clear all tracking data for a specific issue
 */
export function clearIssueTracking(issueId: string): void {
  for (const [linkId, aggregate] of aggregateStore) {
    if (aggregate.issueId === issueId) {
      aggregateStore.delete(linkId);
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a tracking redirect URL
 */
function buildTrackingUrl(baseUrl: string, linkId: string, issueId: string): string {
  // URL format: {baseUrl}/r/{issueId}/{linkId}
  // The redirect handler looks up the original URL and increments count
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/r/${issueId}/${linkId}`;
}

/**
 * Check if a URL is external (http/https)
 */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Escape a string for use in HTML attribute values
 */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
