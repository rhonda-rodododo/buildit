/**
 * Training Module Migrations
 * Database schema migrations for the training system
 */

import type { ModuleMigration } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { logger } from '@/lib/logger';

/**
 * Training module migrations
 */
export const trainingMigrations: ModuleMigration[] = [
  {
    version: 1,
    description: 'Initial training schema with courses, modules, lessons, progress, and certifications',
    migrate: async (_db: BuildItDB) => {
      logger.info('Training migration v1: Initial schema created');
      // Initial schema is created by the schema definition
      // This migration serves as the baseline
    },
  },
  {
    version: 2,
    description: 'Add quiz questions and attempts tables',
    migrate: async (_db: BuildItDB) => {
      logger.info('Training migration v2: Quiz tables added');
      // Quiz tables added to schema
    },
  },
  {
    version: 3,
    description: 'Add live session attendance and RSVP tables',
    migrate: async (_db: BuildItDB) => {
      logger.info('Training migration v3: Live session tables added');
      // Live session tables added to schema
    },
  },
  {
    version: 4,
    description: 'Add assignment submissions table',
    migrate: async (_db: BuildItDB) => {
      logger.info('Training migration v4: Assignment submissions table added');
      // Assignment table added to schema
    },
  },
  {
    version: 5,
    description: 'Add course enrollment tracking table',
    migrate: async (_db: BuildItDB) => {
      logger.info('Training migration v5: Course enrollment table added');
      // Enrollment table added to schema
    },
  },
];
