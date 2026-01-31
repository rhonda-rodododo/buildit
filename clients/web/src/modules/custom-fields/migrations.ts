/**
 * Custom Fields Module Migrations
 * Handles version upgrades for the custom fields module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the custom fields module
 */
export const customFieldsMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial custom fields and values tables',
    migrate: async () => {
      logger.info('Custom Fields module v1: Initial schema created');
    },
  },
];
