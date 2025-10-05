/**
 * Wiki Module Migrations
 * Handles version upgrades for the wiki module schema
 */

import type { ModuleMigration } from '@/types/modules';

/**
 * All migrations for the wiki module
 */
export const wikiMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial wiki pages table',
    migrate: async (_db) => {
      console.log('Wiki module v1: Initial schema created');
    },
  },
];
