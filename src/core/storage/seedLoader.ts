/**
 * Seed Data Loader
 * Loads demo/example data for all modules
 */

import type { BuildItDB } from './db';
import { getAllModules } from '@/lib/modules/registry';

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
  console.log('📦 Loading seed data...');

  const modules = getAllModules();
  const modulesToSeed = options.moduleIds
    ? modules.filter((m) => options.moduleIds?.includes(m.metadata.id))
    : modules;

  let totalSeeded = 0;

  for (const module of modulesToSeed) {
    if (!module.seeds || module.seeds.length === 0) {
      console.log(`  ⏭️  Skipping ${module.metadata.name} (no seeds defined)`);
      continue;
    }

    console.log(`  🌱 Seeding ${module.metadata.name}...`);

    const seedsToLoad = options.seedNames
      ? module.seeds.filter((s) => options.seedNames?.includes(s.name))
      : module.seeds;

    for (const seed of seedsToLoad) {
      try {
        await seed.data(db, groupId, userPubkey);
        totalSeeded++;
        console.log(`    ✓ Loaded: ${seed.description}`);
      } catch (error) {
        console.error(`    ✗ Failed to load ${seed.name}:`, error);
        // Continue with other seeds even if one fails
      }
    }
  }

  console.log(`✅ Seed loading complete! Loaded ${totalSeeded} seed sets.`);
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
    console.log(`No seeds defined for ${module.metadata.name}`);
    return;
  }

  const seedsToLoad = seedName
    ? module.seeds.filter((s) => s.name === seedName)
    : module.seeds;

  if (seedsToLoad.length === 0) {
    console.log(`No matching seeds found for ${module.metadata.name}`);
    return;
  }

  console.log(`🌱 Seeding ${module.metadata.name}...`);

  for (const seed of seedsToLoad) {
    try {
      await seed.data(db, groupId, userPubkey);
      console.log(`  ✓ Loaded: ${seed.description}`);
    } catch (error) {
      console.error(`  ✗ Failed to load ${seed.name}:`, error);
      throw error;
    }
  }
}

/**
 * Check if a group has demo data loaded
 * This checks for the presence of seed data records
 * @param db Database instance
 * @param groupId Group ID
 * @returns True if demo data exists
 */
export async function hasDemoData(db: BuildItDB, groupId: string): Promise<boolean> {
  // Check if any events exist with seed IDs
  const events = await db.events.where('groupId').equals(groupId).limit(1).toArray();
  if (events.length > 0 && events[0].id.includes('event-')) {
    return true;
  }

  // Check wiki pages
  const wikiPages = await db.wikiPages.where('groupId').equals(groupId).limit(1).toArray();
  if (wikiPages.length > 0 && wikiPages[0].id.includes('wiki-')) {
    return true;
  }

  return false;
}

/**
 * Clear all seed data for a group
 * WARNING: This deletes all seeded data
 * @param db Database instance
 * @param groupId Group ID
 */
export async function clearDemoData(db: BuildItDB, groupId: string): Promise<void> {
  console.log(`🧹 Clearing demo data for group ${groupId}...`);

  // Clear events with seed IDs
  await db.events
    .where('groupId')
    .equals(groupId)
    .filter((e: { id: string }) => e.id.includes('event-') || e.id.includes('example-'))
    .delete();

  // Clear mutual aid with seed IDs
  await db.mutualAidRequests
    .where('groupId')
    .equals(groupId)
    .filter((r: { id: string }) => r.id.includes('ma-') || r.id.includes('aid-') || r.id.includes('example-'))
    .delete();

  // Clear proposals with seed IDs
  await db.proposals
    .where('groupId')
    .equals(groupId)
    .filter((p: { id: string }) => p.id.includes('proposal-'))
    .delete();

  // Clear wiki pages with seed IDs
  await db.wikiPages
    .where('groupId')
    .equals(groupId)
    .filter((p: { id: string }) => p.id.includes('wiki-'))
    .delete();

  // Clear database tables and records with seed IDs
  await db.databaseTables
    .where('groupId')
    .equals(groupId)
    .filter((t: { id: string }) => t.id.includes('table-'))
    .delete();

  await db.databaseRecords.where('groupId').equals(groupId).delete();

  await db.databaseViews.where('groupId').equals(groupId).delete();

  // Clear custom fields with seed IDs
  await db.customFields
    .where('groupId')
    .equals(groupId)
    .filter((f: { id: string }) => f.id.includes('field-'))
    .delete();

  console.log(`✅ Demo data cleared for group ${groupId}`);
}
