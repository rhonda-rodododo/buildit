/**
 * CRM Module Migrations
 * Handles version upgrades for the CRM module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the CRM module
 */
export const crmMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial contacts table',
    migrate: async () => {
      logger.info('CRM module v1: Initial schema created');
    },
  },
];
