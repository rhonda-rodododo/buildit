/**
 * Wiki Module Migrations
 * Handles version upgrades for the wiki module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the wiki module
 */
export const wikiMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial wiki pages table',
    migrate: async (_db) => {
      logger.info('Wiki module v1: Initial schema created');
    },
  },
];
