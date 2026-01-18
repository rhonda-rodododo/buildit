/**
 * Events Module Migrations
 * Handles version upgrades for the events module schema
 */

import type { ModuleMigration } from '@/types/modules';

import { logger } from '@/lib/logger';
/**
 * All migrations for the events module
 * Each migration upgrades from one version to the next
 */
export const eventsMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial events and RSVPs tables',
    migrate: async (_db) => {
      // No migration needed for v1 (initial schema)
      logger.info('Events module v1: Initial schema created');
    },
  },
  // Future migrations go here
  // {
  //   version: 2,
  //   description: 'Add custom fields support to events',
  //   migrate: async (_db) => {
  //     // Migration logic here
  //   },
  // },
];
