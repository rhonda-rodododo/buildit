/**
 * CRM Module
 * Contact management with templates (uses Database module in future)
 */

import type { ModulePlugin } from '@/types/modules';
import { crmSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';

/**
 * CRM Module Plugin
 */
export const crmModule: ModulePlugin = {
  metadata: {
    id: 'crm',
    type: 'crm',
    name: 'CRM',
    description: 'Contact management with pre-built templates',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: 'Users',
    capabilities: [
      {
        id: 'contact-management',
        name: 'Contact Management',
        description: 'Create and manage contacts',
        requiresPermission: ['member'],
      },
      {
        id: 'templates',
        name: 'Templates',
        description: 'Pre-built CRM templates (Union, Fundraising, Legal, etc.)',
        requiresPermission: ['admin'],
      },
    ],
    configSchema: [
      {
        key: 'template',
        label: 'CRM Template',
        type: 'select',
        defaultValue: 'none',
        options: [
          { label: 'None (Custom)', value: 'none' },
          { label: 'Union Organizing', value: 'union' },
          { label: 'Fundraising', value: 'fundraising' },
          { label: 'Volunteer Management', value: 'volunteer' },
          { label: 'Legal/NLG Tracking', value: 'legal' },
          { label: 'Civil Defense', value: 'civil-defense' },
        ],
      },
      {
        key: 'allowContactSharing',
        label: 'Allow Contact Sharing',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow sharing contacts between groups',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('CRM module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`CRM module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`CRM module disabled for group ${groupId}`);
    },
  },

  schema: crmSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial CRM schema',
      migrate: async (_db: BuildItDB) => {
        console.log('CRM migration v1: Initial schema');
      },
    },
  ],

  seeds: [
    {
      name: 'example-contacts',
      description: 'Create example contacts',
      data: async (db: BuildItDB, groupId: string, _userPubkey: string) => {
        const now = Date.now();
        const exampleContacts = [
          {
            id: `contact-${groupId}-1`,
            groupId,
            name: 'Sample Contact',
            email: 'sample@example.com',
            notes: 'Interested in volunteering for events',
            customFields: {},
            tags: ['volunteer', 'active'],
            created: now,
            updated: now,
          },
        ];

        await db.table('contacts').bulkAdd(exampleContacts);
      },
    },
  ],

  getDefaultConfig: () => ({
    template: 'none',
    allowContactSharing: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (
      !['none', 'union', 'fundraising', 'volunteer', 'legal', 'civil-defense'].includes(config.template as string)
    )
      return false;
    if (typeof config.allowContactSharing !== 'boolean') return false;
    return true;
  },
};

export default crmModule;
