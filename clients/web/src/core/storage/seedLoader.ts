/**
 * Seed Data Loader
 * Loads demo/example data for all modules
 */

import { dal } from '@/core/storage/dal';
import { getAllModules } from '@/lib/modules/registry';
import type { TemplateSelection, ResolvedTemplate } from '@/core/groupTemplates/types';
import { templateRegistry } from '@/core/groupTemplates';

import { logger } from '@/lib/logger';
/**
 * Load seed data for all modules
 * @param groupId Group ID to seed data for
 * @param userPubkey User public key creating the seed data
 * @param options Seed loading options
 */
export async function loadAllSeeds(
  groupId: string,
  userPubkey: string,
  options: {
    moduleIds?: string[]; // Optional: only load seeds for specific modules
    seedNames?: string[]; // Optional: only load specific seed sets
  } = {}
): Promise<void> {
  logger.info('📦 Loading seed data...');

  const modules = getAllModules();
  const modulesToSeed = options.moduleIds
    ? modules.filter((m) => options.moduleIds?.includes(m.metadata.id))
    : modules;

  let totalSeeded = 0;

  for (const module of modulesToSeed) {
    if (!module.seeds || module.seeds.length === 0) {
      logger.info(`  ⏭️  Skipping ${module.metadata.name} (no seeds defined)`);
      continue;
    }

    logger.info(`  🌱 Seeding ${module.metadata.name}...`);

    const seedsToLoad = options.seedNames
      ? module.seeds.filter((s) => options.seedNames?.includes(s.name))
      : module.seeds;

    if (options.seedNames && seedsToLoad.length === 0) {
      const availableNames = module.seeds.map((s) => s.name).join(', ');
      logger.warn(
        `    ⚠️  No matching seeds for ${module.metadata.name}. ` +
        `Requested: [${options.seedNames.join(', ')}], ` +
        `Available: [${availableNames}]`
      );
    }

    for (const seed of seedsToLoad) {
      try {
        await seed.data(groupId, userPubkey);
        totalSeeded++;
        logger.info(`    ✓ Loaded: ${seed.description}`);
      } catch (error) {
        console.error(`    ✗ Failed to load ${seed.name}:`, error);
        // Continue with other seeds even if one fails
      }
    }
  }

  logger.info(`✅ Seed loading complete! Loaded ${totalSeeded} seed sets.`);
}

/**
 * Load seed data for a specific module
 * @param moduleId Module ID
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param seedName Optional: specific seed name to load
 */
export async function loadModuleSeeds(
  moduleId: string,
  groupId: string,
  userPubkey: string,
  seedName?: string
): Promise<void> {
  const modules = getAllModules();
  const module = modules.find((m) => m.metadata.id === moduleId);

  if (!module) {
    throw new Error(`Module ${moduleId} not found`);
  }

  if (!module.seeds || module.seeds.length === 0) {
    logger.info(`No seeds defined for ${module.metadata.name}`);
    return;
  }

  const seedsToLoad = seedName
    ? module.seeds.filter((s) => s.name === seedName)
    : module.seeds;

  if (seedsToLoad.length === 0) {
    logger.info(`No matching seeds found for ${module.metadata.name}`);
    return;
  }

  logger.info(`🌱 Seeding ${module.metadata.name}...`);

  for (const seed of seedsToLoad) {
    try {
      await seed.data(groupId, userPubkey);
      logger.info(`  ✓ Loaded: ${seed.description}`);
    } catch (error) {
      console.error(`  ✗ Failed to load ${seed.name}:`, error);
      throw error;
    }
  }
}

/**
 * Check if a group has demo data loaded
 * Checks for the presence of seed-loaded records across module tables.
 * @param groupId Group ID
 * @returns True if demo data exists
 */
export async function hasDemoData(groupId: string): Promise<boolean> {
  // Check module tables that are typically populated by seeds
  const tablesToCheck = [
    'events',
    'wikiPages',
    'proposals',
    'mutualAidRequests',
    'databaseTables',
    'campaigns',
    'publications',
    'newsletters',
    'articles',
  ];

  for (const tableName of tablesToCheck) {
    try {
      const records = await dal.query<{ id: string }>(tableName, {
        whereClause: { groupId },
        limit: 1,
      });
      if (records.length > 0) {
        return true;
      }
    } catch {
      // Table may not exist or not have groupId, skip
    }
  }

  return false;
}

/**
 * Clear all seed/demo data for a group
 * Clears records from all module tables for this group.
 * WARNING: This deletes ALL module data for the group, not just seeded data.
 * @param groupId Group ID
 */
export async function clearDemoData(groupId: string): Promise<void> {
  logger.info(`🧹 Clearing demo data for group ${groupId}...`);

  // Tables that seeds populate, grouped by module
  const groupIdTables = [
    'events',
    'mutualAidRequests',
    'proposals',
    'ballots',
    'votes',
    'wikiPages',
    'databaseTables',
    'databaseRecords',
    'databaseViews',
    'customFields',
    'contacts',
    'campaigns',
    'donationTiers',
    'publications',
    'articles',
    'newsletters',
    'newsletterIssues',
  ];

  for (const tableName of groupIdTables) {
    try {
      await dal.deleteWhere(tableName, { groupId });
    } catch {
      // Table may not exist or not have groupId, skip silently
    }
  }

  logger.info(`✅ Demo data cleared for group ${groupId}`);
}

/**
 * Load seed data based on a template selection
 * Uses the template's demoData.seeds configuration
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param templateSelection Template selection with enhancements
 */
export async function loadTemplateSeeds(
  groupId: string,
  userPubkey: string,
  templateSelection: TemplateSelection
): Promise<void> {
  logger.info('📦 Loading template seed data...');

  // Resolve the template to get the seed list
  const resolved = templateRegistry.resolveTemplate(templateSelection);

  if (resolved.seeds.length === 0) {
    logger.info('  ⏭️  No seeds defined for this template');
    return;
  }

  logger.info(`  🌱 Loading ${resolved.seeds.length} seed sets...`);

  // Load seeds that match the template's seed names
  await loadAllSeeds(groupId, userPubkey, {
    moduleIds: resolved.enabledModules,
    seedNames: resolved.seeds,
  });
}

/**
 * Load seed data based on a resolved template
 * Use this when you already have the resolved template from templateRegistry
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param resolved Already-resolved template
 */
export async function loadResolvedTemplateSeeds(
  groupId: string,
  userPubkey: string,
  resolved: ResolvedTemplate
): Promise<void> {
  logger.info('📦 Loading resolved template seed data...');

  if (resolved.seeds.length === 0) {
    logger.info('  ⏭️  No seeds defined for this template');
    return;
  }

  logger.info(`  🌱 Loading ${resolved.seeds.length} seed sets...`);

  // Load seeds that match the template's seed names
  await loadAllSeeds(groupId, userPubkey, {
    moduleIds: resolved.enabledModules,
    seedNames: resolved.seeds,
  });
}
