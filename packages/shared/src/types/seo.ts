/**
 * SEO Types
 * Shared SEO metadata types used by both SPA and SSR apps
 */

/**
 * SEO Metadata for pages and content
 */
export interface SEOMetadata {
  title?: string; // page title (overrides content title)
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

/**
 * Default SEO metadata
 */
export const DEFAULT_SEO: SEOMetadata = {
  robots: 'index, follow',
};

/**
 * Generate full page title with site name
 */
export function generatePageTitle(pageTitle: string, siteName: string = 'BuildIt Network'): string {
  if (!pageTitle) return siteName;
  return `${pageTitle} | ${siteName}`;
}
