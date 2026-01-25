/**
 * Documents Module Migrations
 * Handles version upgrades for the documents module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the documents module
 */
export const documentsMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Documents module placeholder',
    migrate: async (_db) => {
      logger.info('Documents module v1: Placeholder (implementation pending)');
    },
  },
  {
    version: 2,
    description: 'Epic 56: Advanced document features - comments, suggestions, folders, permissions',
    migrate: async (_db) => {
      logger.info('Documents module v2: Adding comments, suggestions, folders, and sharing features');
      // Schema changes are handled automatically by Dexie via documentsSchema
      // This migration ensures proper upgrade path
    },
  },
];
