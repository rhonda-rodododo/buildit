/**
 * Custom Fields Module
 * Foundational module providing dynamic field capabilities to other modules
 */

import type { ModulePlugin } from '@/types/modules';
import { customFieldsSchema } from './schema';
import { customFieldsSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Settings } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Custom Fields Module Plugin
 */
export const customFieldsModule: ModulePlugin = {
  metadata: {
    id: 'custom-fields',
    type: 'custom-fields',
    name: 'Custom Fields',
    description: 'Foundational module providing dynamic field capabilities to other modules',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Settings,
    capabilities: [
      {
        id: 'field-management',
        name: 'Field Management',
        description: 'Create and manage custom field definitions',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'field-usage',
        name: 'Field Usage',
        description: 'Use custom fields in entities',
        requiresPermission: ['member', 'all'],
      },
    ],
    configSchema: [
      {
        key: 'allowUserFields',
        label: 'Allow User Fields',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow non-admin users to create custom fields',
      },
      {
        key: 'maxFieldsPerEntity',
        label: 'Max Fields Per Entity',
        type: 'number',
        defaultValue: 50,
        description: 'Maximum number of custom fields per entity type',
      },
    ],
    requiredPermission: 'all',
    // Custom Fields provides capabilities to other modules
    providesCapabilities: ['custom-fields', 'dynamic-forms', 'field-validation'],
    // This module enhances other modules when enabled
    enhances: ['events', 'mutual-aid', 'database', 'crm'],
  },

  lifecycle: {
    onRegister: async () => {
      logger.info('⚙️ Custom Fields module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`⚙️ Custom Fields module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`⚙️ Custom Fields module disabled for group ${groupId}`);
    },
  },

  schema: customFieldsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial custom fields schema',
      migrate: async (_db: BuildItDB) => {
        logger.info('Custom fields migration v1: Initial schema');
        // Initial schema is already defined in customFieldsSchema
      },
    },
  ],

  seeds: customFieldsSeeds,

  getDefaultConfig: () => ({
    allowUserFields: false,
    maxFieldsPerEntity: 50,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowUserFields !== 'boolean') return false;
    if (typeof config.maxFieldsPerEntity !== 'number') return false;
    if (config.maxFieldsPerEntity < 1 || config.maxFieldsPerEntity > 100) return false;
    return true;
  },
};

export default customFieldsModule;
