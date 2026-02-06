/**
 * Marketplace Module Migrations
 * Database schema version upgrades
 */

import type { ModuleMigration } from '@/types/modules';
import { logger } from '@/lib/logger';

export const marketplaceMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial marketplace schema with listings, co-ops, reviews, skill exchanges, and resource shares',
    migrate: async () => {
      logger.info('Marketplace migration v1: Initial schema');
    },
  },
];
