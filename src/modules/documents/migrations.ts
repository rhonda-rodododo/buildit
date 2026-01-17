/**
 * Documents Module Migrations
 * Handles version upgrades for the documents module schema
 */

import type { ModuleMigration } from '@/types/modules';

/**
 * All migrations for the documents module
 */
export const documentsMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Documents module placeholder',
    migrate: async (_db) => {
      console.info('Documents module v1: Placeholder (implementation pending)');
    },
  },
];
