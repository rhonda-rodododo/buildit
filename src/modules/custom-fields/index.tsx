import type { ModulePlugin } from '@/types/modules';
import { customFieldsSchema } from './schema';
import { customFieldsMigrations } from './migrations';
import { customFieldsSeeds } from './seeds';

// Placeholder component
const CustomFieldsPlaceholder = () => <div>Custom Fields Module (Foundational)</div>;

/**
 * Custom Fields Module
 * Foundational module providing dynamic field capabilities to other modules
 */
export const CustomFieldsModule: ModulePlugin = {
  schema: customFieldsSchema,
  migrations: customFieldsMigrations,
  seeds: customFieldsSeeds,

  metadata: {
    id: 'custom-fields',
    type: 'custom-fields',
    name: 'Custom Fields',
    description: 'Dynamic field system for extending other modules with custom data fields',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'ListTree',
    capabilities: [
      {
        id: 'field-definitions',
        name: 'Field Definitions',
        description: 'Create and manage custom field definitions',
      },
      {
        id: 'field-validation',
        name: 'Field Validation',
        description: 'JSON Schema-based field validation',
      },
      {
        id: 'field-widgets',
        name: 'Field Widgets',
        description: 'UI widgets for different field types',
      },
      {
        id: 'form-rendering',
        name: 'Dynamic Forms',
        description: 'Render dynamic forms based on field definitions',
      },
    ],
    configSchema: [],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Custom Fields module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Custom Fields module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/custom-fields',
      component: CustomFieldsPlaceholder,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({}),

  validateConfig: () => true,
};

/**
 * Export utilities for other modules to use
 */
export { CustomFieldsManager } from './customFieldsManager';
export { useCustomFieldsStore } from './customFieldsStore';
export * from './types';
