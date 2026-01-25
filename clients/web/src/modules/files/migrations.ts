/**
 * Files Module Migrations
 * Handles version upgrades for the files module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the files module
 */
export const filesMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Files module placeholder',
    migrate: async (_db) => {
      logger.info('Files module v1: Placeholder (implementation pending)');
    },
  },
];
