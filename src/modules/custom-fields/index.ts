/**
 * Custom Fields Module
 * Foundational module providing dynamic field capabilities to other modules
 */

import type { ModulePlugin } from '@/types/modules';
import { customFieldsSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';

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
    icon: 'Settings',
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
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Custom Fields module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Custom Fields module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Custom Fields module disabled for group ${groupId}`);
    },
  },

  schema: customFieldsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial custom fields schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Custom fields migration v1: Initial schema');
        // Initial schema is already defined in customFieldsSchema
      },
    },
  ],

  seeds: [
    {
      name: 'event-templates',
      description: 'Example custom fields for events',
      data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
        const now = Date.now();
        const eventFields = [
          {
            id: `${groupId}-event-dietary`,
            groupId,
            entityType: 'event',
            name: 'dietary_preferences',
            label: 'Dietary Preferences',
            schema: JSON.stringify({
              type: 'array',
              items: { type: 'string' },
              uniqueItems: true,
            }),
            widget: JSON.stringify({
              type: 'multi-select',
              options: ['Vegan', 'Vegetarian', 'Gluten-free', 'Halal', 'Kosher', 'No restrictions'],
            }),
            order: 0,
            created: now,
            createdBy: userPubkey,
            updated: now,
          },
          {
            id: `${groupId}-event-accessibility`,
            groupId,
            entityType: 'event',
            name: 'accessibility_needs',
            label: 'Accessibility Needs',
            schema: JSON.stringify({
              type: 'string',
            }),
            widget: JSON.stringify({
              type: 'textarea',
              placeholder: 'Describe any accessibility requirements...',
            }),
            order: 1,
            created: now,
            createdBy: userPubkey,
            updated: now,
          },
          {
            id: `${groupId}-event-skills`,
            groupId,
            entityType: 'event',
            name: 'skills_needed',
            label: 'Skills Needed',
            schema: JSON.stringify({
              type: 'array',
              items: { type: 'string' },
            }),
            widget: JSON.stringify({
              type: 'multi-select',
              options: [
                'First Aid',
                'Legal Observer',
                'Medic',
                'Communications',
                'De-escalation',
                'Sign Language',
                'Translation',
              ],
            }),
            order: 2,
            created: now,
            createdBy: userPubkey,
            updated: now,
          },
        ];

        await db.table('customFields').bulkAdd(eventFields);
      },
    },
    {
      name: 'mutual-aid-templates',
      description: 'Example custom fields for mutual aid',
      data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
        const now = Date.now();
        const aidFields = [
          {
            id: `${groupId}-aid-medical`,
            groupId,
            entityType: 'aid-request',
            name: 'medical_needs',
            label: 'Medical Needs',
            schema: JSON.stringify({
              type: 'string',
            }),
            widget: JSON.stringify({
              type: 'textarea',
              placeholder: 'Describe medical needs, allergies, medications...',
            }),
            order: 0,
            created: now,
            createdBy: userPubkey,
            updated: now,
          },
          {
            id: `${groupId}-aid-housing`,
            groupId,
            entityType: 'aid-request',
            name: 'housing_type',
            label: 'Housing Type Needed',
            schema: JSON.stringify({
              type: 'string',
              enum: ['Emergency', 'Short-term', 'Long-term', 'Transitional'],
            }),
            widget: JSON.stringify({
              type: 'select',
              options: ['Emergency', 'Short-term', 'Long-term', 'Transitional'],
            }),
            order: 1,
            created: now,
            createdBy: userPubkey,
            updated: now,
          },
        ];

        await db.table('customFields').bulkAdd(aidFields);
      },
    },
  ],

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
