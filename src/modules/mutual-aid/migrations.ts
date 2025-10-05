/**
 * Mutual Aid Module Migrations
 * Handles version upgrades for the mutual aid module schema
 */

import type { ModuleMigration } from '@/types/modules';

/**
 * All migrations for the mutual aid module
 */
export const mutualAidMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial mutual aid requests table',
    migrate: async (_db) => {
      console.log('Mutual Aid module v1: Initial schema created');
    },
  },
];
