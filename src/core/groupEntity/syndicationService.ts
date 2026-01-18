/**
 * Coalition Syndication Service
 *
 * Manages content syndication between media collectives and coalitions.
 * Implements the Indymedia-style wire service model.
 */

import type {
  Coalition,
  CoalitionSyndicationConfig,
  ContentSyndicationSettings,
} from './types';

/**
 * Default syndication configuration for new coalitions
 */
export const DEFAULT_SYNDICATION_CONFIG: CoalitionSyndicationConfig = {
  enabled: false,
  mode: 'editorial-review',
  level: 'regional',
  approvedSources: [],
  autoPublishAfterApproval: false,
  attributionRequired: true,
  defaultSyndicationDelay: 24, // hours
  acceptedCategories: [],
  parentCoalitions: [],
};

/**
 * Default syndication settings for new content
 */
export const DEFAULT_CONTENT_SYNDICATION: ContentSyndicationSettings = {
  enabled: false,
  delay: 24, // hours
  targetCoalitions: [],
  level: 'local',
  requireReview: true,
};

/**
 * Syndication level hierarchy
 * Higher levels include content from lower levels
 */
export const SYNDICATION_LEVELS = ['local', 'regional', 'global'] as const;

/**
 * Check if a coalition is a valid syndication target for content
 */
export function isValidSyndicationTarget(
  sourceGroupId: string,
  coalition: Coalition
): boolean {
  if (!coalition.settings.syndication?.enabled) {
    return false;
  }

  const { approvedSources } = coalition.settings.syndication;

  // If no approved sources specified, allow all coalition members
  if (approvedSources.length === 0) {
    return coalition.groupIds.includes(sourceGroupId);
  }

  // Check if source is in approved list
  return approvedSources.includes(sourceGroupId);
}

/**
 * Get syndication delay in milliseconds
 */
export function getSyndicationDelayMs(
  contentSettings: ContentSyndicationSettings,
  coalitionConfig?: CoalitionSyndicationConfig
): number {
  // Content-level setting takes precedence
  const hours = contentSettings.delay || coalitionConfig?.defaultSyndicationDelay || 24;
  return hours * 60 * 60 * 1000;
}

/**
 * Check if content is ready for syndication based on delay
 */
export function isReadyForSyndication(
  publishedAt: number,
  contentSettings: ContentSyndicationSettings,
  coalitionConfig?: CoalitionSyndicationConfig
): boolean {
  if (!contentSettings.enabled) {
    return false;
  }

  const delayMs = getSyndicationDelayMs(contentSettings, coalitionConfig);
  const syndicationTime = publishedAt + delayMs;

  return Date.now() >= syndicationTime;
}

/**
 * Check if content requires editorial review before syndication
 */
export function requiresSyndicationReview(
  contentSettings: ContentSyndicationSettings,
  coalitionConfig?: CoalitionSyndicationConfig
): boolean {
  // Content-level setting takes precedence
  if (contentSettings.requireReview) {
    return true;
  }

  // Check coalition-level setting
  if (coalitionConfig?.mode === 'editorial-review') {
    return true;
  }

  if (coalitionConfig?.mode === 'member-vote') {
    return true;
  }

  return false;
}

/**
 * Get target coalitions for content syndication
 */
export function getTargetCoalitions(
  contentSettings: ContentSyndicationSettings,
  availableCoalitions: Coalition[],
  sourceGroupId: string
): Coalition[] {
  if (!contentSettings.enabled) {
    return [];
  }

  // If specific targets specified, filter to those
  if (contentSettings.targetCoalitions.length > 0) {
    return availableCoalitions.filter(
      (c) =>
        contentSettings.targetCoalitions.includes(c.id) &&
        isValidSyndicationTarget(sourceGroupId, c)
    );
  }

  // Otherwise, return all coalitions the group belongs to that accept syndication
  return availableCoalitions.filter(
    (c) =>
      c.groupIds.includes(sourceGroupId) &&
      c.settings.syndication?.enabled &&
      isValidSyndicationTarget(sourceGroupId, c)
  );
}

/**
 * Get parent coalitions for upward syndication
 */
export function getParentCoalitions(
  coalition: Coalition,
  allCoalitions: Coalition[]
): Coalition[] {
  const parentIds = coalition.settings.syndication?.parentCoalitions || [];

  if (parentIds.length === 0) {
    return [];
  }

  return allCoalitions.filter(
    (c) =>
      parentIds.includes(c.id) &&
      c.settings.syndication?.enabled &&
      c.settings.syndication.level !== 'local'
  );
}

/**
 * Build syndication chain for content
 * Returns the path content will take: local -> regional -> global
 */
export function buildSyndicationChain(
  sourceGroupId: string,
  contentSettings: ContentSyndicationSettings,
  allCoalitions: Coalition[]
): {
  level: typeof SYNDICATION_LEVELS[number];
  coalitions: Coalition[];
}[] {
  const chain: {
    level: typeof SYNDICATION_LEVELS[number];
    coalitions: Coalition[];
  }[] = [];

  // Get initial targets
  const directTargets = getTargetCoalitions(contentSettings, allCoalitions, sourceGroupId);

  // Group by level
  const byLevel = new Map<typeof SYNDICATION_LEVELS[number], Coalition[]>();

  for (const level of SYNDICATION_LEVELS) {
    byLevel.set(level, []);
  }

  for (const coalition of directTargets) {
    const level = coalition.settings.syndication?.level || 'local';
    byLevel.get(level)?.push(coalition);
  }

  // Add upward syndication through parent coalitions
  const processedCoalitions = new Set<string>();

  const addParents = (coalition: Coalition) => {
    if (processedCoalitions.has(coalition.id)) {
      return;
    }
    processedCoalitions.add(coalition.id);

    const parents = getParentCoalitions(coalition, allCoalitions);
    for (const parent of parents) {
      const level = parent.settings.syndication?.level || 'regional';
      byLevel.get(level)?.push(parent);
      addParents(parent);
    }
  };

  for (const coalition of directTargets) {
    addParents(coalition);
  }

  // Build chain in order
  for (const level of SYNDICATION_LEVELS) {
    const coalitions = byLevel.get(level) || [];
    if (coalitions.length > 0) {
      // Dedupe
      const unique = Array.from(new Map(coalitions.map((c) => [c.id, c])).values());
      chain.push({ level, coalitions: unique });
    }
  }

  return chain;
}

/**
 * Create syndication attribution
 */
export function createAttribution(
  originalGroupName: string,
  originalGroupId: string,
  publishedAt: number
): {
  sourceGroup: { id: string; name: string };
  originalPublishDate: number;
  syndicatedAt: number;
} {
  return {
    sourceGroup: {
      id: originalGroupId,
      name: originalGroupName,
    },
    originalPublishDate: publishedAt,
    syndicatedAt: Date.now(),
  };
}

/**
 * Merge syndication configs (child inherits from parent where not specified)
 */
export function mergeSyndicationConfigs(
  childConfig: Partial<CoalitionSyndicationConfig>,
  parentConfig: CoalitionSyndicationConfig
): CoalitionSyndicationConfig {
  return {
    enabled: childConfig.enabled ?? parentConfig.enabled,
    mode: childConfig.mode ?? parentConfig.mode,
    level: childConfig.level ?? parentConfig.level,
    approvedSources: childConfig.approvedSources ?? parentConfig.approvedSources,
    autoPublishAfterApproval:
      childConfig.autoPublishAfterApproval ?? parentConfig.autoPublishAfterApproval,
    attributionRequired: childConfig.attributionRequired ?? parentConfig.attributionRequired,
    defaultSyndicationDelay:
      childConfig.defaultSyndicationDelay ?? parentConfig.defaultSyndicationDelay,
    acceptedCategories: childConfig.acceptedCategories ?? parentConfig.acceptedCategories,
    parentCoalitions: childConfig.parentCoalitions ?? parentConfig.parentCoalitions,
  };
}

/**
 * Validate syndication configuration
 */
export function validateSyndicationConfig(
  config: CoalitionSyndicationConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.defaultSyndicationDelay < 0) {
    errors.push('Syndication delay cannot be negative');
  }

  if (config.defaultSyndicationDelay > 168) {
    // 1 week
    errors.push('Syndication delay cannot exceed 168 hours (1 week)');
  }

  if (!SYNDICATION_LEVELS.includes(config.level)) {
    errors.push(`Invalid syndication level: ${config.level}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  DEFAULT_SYNDICATION_CONFIG,
  DEFAULT_CONTENT_SYNDICATION,
  SYNDICATION_LEVELS,
  isValidSyndicationTarget,
  getSyndicationDelayMs,
  isReadyForSyndication,
  requiresSyndicationReview,
  getTargetCoalitions,
  getParentCoalitions,
  buildSyndicationChain,
  createAttribution,
  mergeSyndicationConfigs,
  validateSyndicationConfig,
};
