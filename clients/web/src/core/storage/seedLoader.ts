/**
 * Seed Data Loader
 * Loads demo/example data for all modules
 */

import type { BuildItDB } from './db';
import { getAllModules } from '@/lib/modules/registry';
import type { TemplateSelection, ResolvedTemplate } from '@/core/groupTemplates/types';
import { templateRegistry } from '@/core/groupTemplates';

import { logger } from '@/lib/logger';
/**
 * Load seed data for all modules
 * @param db Database instance
 * @param groupId Group ID to seed data for
 * @param userPubkey User public key creating the seed data
 * @param options Seed loading options
 */
export async function loadAllSeeds(
  db: BuildItDB,
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
        await seed.data(db, groupId, userPubkey);
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
 * @param db Database instance
 * @param moduleId Module ID
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param seedName Optional: specific seed name to load
 */
export async function loadModuleSeeds(
  db: BuildItDB,
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
      await seed.data(db, groupId, userPubkey);
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
 * Since seeds use generateEventId() (random hex), we check for any records
 * in seed-populated tables rather than relying on ID prefixes.
 * @param db Database instance
 * @param groupId Group ID
 * @returns True if demo data exists
 */
export async function hasDemoData(db: BuildItDB, groupId: string): Promise<boolean> {
  // Check module tables that are typically populated by seeds
  const tablesToCheck = [
    db.events,
    db.wikiPages,
    db.proposals,
    db.mutualAidRequests,
    db.databaseTables,
    db.campaigns,
    db.publications,
    db.newsletters,
    db.articles,
  ];

  for (const table of tablesToCheck) {
    if (table) {
      try {
        const records = await table.where('groupId').equals(groupId).limit(1).toArray();
        if (records.length > 0) {
          return true;
        }
      } catch {
        // Table may not have groupId index, skip
      }
    }
  }

  return false;
}

/**
 * Clear all seed/demo data for a group
 * Clears records from all module tables for this group.
 * Since seeds use generateEventId() (random hex IDs), we cannot filter
 * by ID prefix. Instead, we clear all group records from seed-populated tables.
 * WARNING: This deletes ALL module data for the group, not just seeded data.
 * @param db Database instance
 * @param groupId Group ID
 */
export async function clearDemoData(db: BuildItDB, groupId: string): Promise<void> {
  logger.info(`🧹 Clearing demo data for group ${groupId}...`);

  // Tables that seeds populate, grouped by module
  const groupIdTables = [
    // Events module
    db.events,
    // Mutual aid module
    db.mutualAidRequests,
    // Governance module
    db.proposals,
    db.ballots,
    db.votes,
    // Wiki module
    db.wikiPages,
    // Database module
    db.databaseTables,
    db.databaseRecords,
    db.databaseViews,
    // Custom fields module
    db.customFields,
    // CRM module (uses database tables, but also contacts)
    db.contacts,
    // Fundraising module
    db.campaigns,
    db.donationTiers,
    // Publishing module
    db.publications,
    db.articles,
    // Newsletters module
    db.newsletters,
    db.newsletterIssues,
  ];

  for (const table of groupIdTables) {
    if (table) {
      try {
        await table.where('groupId').equals(groupId).delete();
      } catch {
        // Table may not have groupId index, skip silently
      }
    }
  }

  logger.info(`✅ Demo data cleared for group ${groupId}`);
}

/**
 * Load seed data based on a template selection
 * Uses the template's demoData.seeds configuration
 * @param db Database instance
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param templateSelection Template selection with enhancements
 */
export async function loadTemplateSeeds(
  db: BuildItDB,
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
  await loadAllSeeds(db, groupId, userPubkey, {
    moduleIds: resolved.enabledModules,
    seedNames: resolved.seeds,
  });
}

/**
 * Load seed data based on a resolved template
 * Use this when you already have the resolved template from templateRegistry
 * @param db Database instance
 * @param groupId Group ID
 * @param userPubkey User public key
 * @param resolved Already-resolved template
 */
export async function loadResolvedTemplateSeeds(
  db: BuildItDB,
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
  await loadAllSeeds(db, groupId, userPubkey, {
    moduleIds: resolved.enabledModules,
    seedNames: resolved.seeds,
  });
}
