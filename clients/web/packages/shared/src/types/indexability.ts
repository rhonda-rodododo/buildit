/**
 * Indexability Types
 * Controls for search engine and AI crawler indexing
 *
 * Two-Level Control:
 * - Group/Publication Level: Set defaults for all content
 * - Per-Item Override: Each piece of content can override the defaults
 */

// ============================================================================
// Indexability Settings (Per-Item)
// ============================================================================

/**
 * Per-item indexability settings
 * Can override group/publication defaults
 */
export interface IndexabilitySettings {
  /**
   * Allow search engine crawlers (Google, Bing, DuckDuckGo, etc.)
   * When true: robots meta = "index, follow"
   * When false: robots meta = "noindex, nofollow"
   */
  isSearchIndexable: boolean;

  /**
   * Allow AI training crawlers (GPTBot, ChatGPT-User, Google-Extended, CCBot, anthropic-ai, etc.)
   * When true: no AI-specific robots directives
   * When false: robots meta includes "noai, noimageai" and specific bot blocks
   */
  isAiIndexable: boolean;

  /**
   * Prevent archive.org and other archival services from caching
   * When true: robots meta includes "noarchive"
   */
  noArchive?: boolean;
}

/**
 * Default indexability settings for new content
 */
export const DEFAULT_INDEXABILITY: IndexabilitySettings = {
  isSearchIndexable: true,
  isAiIndexable: false, // Opt-in for AI training
  noArchive: false,
};

// ============================================================================
// Indexability Defaults (Group/Publication Level)
// ============================================================================

/**
 * Group/publication-level indexability defaults
 * Applied to all content unless overridden at item level
 */
export interface IndexabilityDefaults {
  /** Default: allow search engines to index public content */
  defaultSearchIndexable: boolean;

  /** Default: opt-in for AI training (false by default for privacy) */
  defaultAiIndexable: boolean;

  /** Default: allow archival services */
  defaultNoArchive: boolean;
}

/**
 * Default indexability settings for new groups/publications
 */
export const DEFAULT_INDEXABILITY_DEFAULTS: IndexabilityDefaults = {
  defaultSearchIndexable: true,
  defaultAiIndexable: false,
  defaultNoArchive: false,
};

// ============================================================================
// Robot Directives Generation
// ============================================================================

/**
 * Known AI crawler user agents
 * These are blocked when isAiIndexable is false
 */
export const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'Claude-Web',
  'Bytespider',
  'PerplexityBot',
  'FacebookBot',
  'Omgilibot',
  'Applebot-Extended',
] as const;

export type AICrawlerUserAgent = (typeof AI_CRAWLER_USER_AGENTS)[number];

/**
 * Generate robots meta tag content from indexability settings
 */
export function generateRobotsMetaContent(settings: IndexabilitySettings): string {
  const directives: string[] = [];

  // Search indexing
  if (settings.isSearchIndexable) {
    directives.push('index', 'follow');
  } else {
    directives.push('noindex', 'nofollow');
  }

  // AI indexing (additional directives)
  if (!settings.isAiIndexable) {
    directives.push('noai', 'noimageai');
  }

  // Archive control
  if (settings.noArchive) {
    directives.push('noarchive');
  }

  return directives.join(', ');
}

/**
 * Generate robots.txt rules for AI crawlers
 * Used at the site level for the SSR app
 */
export function generateAiRobotsTxtRules(allowAi: boolean): string {
  if (allowAi) {
    return AI_CRAWLER_USER_AGENTS.map(
      (agent) => `User-agent: ${agent}\nAllow: /`
    ).join('\n\n');
  }

  return AI_CRAWLER_USER_AGENTS.map(
    (agent) => `User-agent: ${agent}\nDisallow: /`
  ).join('\n\n');
}

// ============================================================================
// Visibility + Indexability Combined Type
// ============================================================================

/**
 * Public content visibility settings
 * Combines public/private with indexability controls
 */
export interface PublicContentSettings {
  /** Is this content publicly accessible (without auth)? */
  isPublic: boolean;

  /** Indexability settings (only relevant when isPublic is true) */
  indexability: IndexabilitySettings;
}

/**
 * Default public content settings
 */
export const DEFAULT_PUBLIC_CONTENT_SETTINGS: PublicContentSettings = {
  isPublic: false,
  indexability: DEFAULT_INDEXABILITY,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if content is indexable by search engines
 */
export function isSearchIndexable(
  settings: PublicContentSettings | IndexabilitySettings
): boolean {
  if ('isPublic' in settings) {
    return settings.isPublic && settings.indexability.isSearchIndexable;
  }
  return settings.isSearchIndexable;
}

/**
 * Check if content is indexable by AI crawlers
 */
export function isAiIndexable(
  settings: PublicContentSettings | IndexabilitySettings
): boolean {
  if ('isPublic' in settings) {
    return (
      settings.isPublic &&
      settings.indexability.isSearchIndexable &&
      settings.indexability.isAiIndexable
    );
  }
  return settings.isSearchIndexable && settings.isAiIndexable;
}
