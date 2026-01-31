/**
 * Governance Module Migrations
 * Handles version upgrades for the governance module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the governance module
 */
export const governanceMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial proposals and votes tables',
    migrate: async () => {
      logger.info('Governance module v1: Initial schema created');
    },
  },
];
