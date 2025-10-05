/**
 * Messaging Module Migrations
 * Handles version upgrades for the messaging module schema
 */

import type { ModuleMigration } from '@/types/modules';

/**
 * All migrations for the messaging module
 */
export const messagingMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Messaging module initial setup (no tables yet)',
    migrate: async (_db) => {
      console.log('Messaging module v1: Module initialized (uses core messages table)');
    },
  },
];
