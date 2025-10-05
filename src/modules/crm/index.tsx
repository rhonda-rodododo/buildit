import type { ModulePlugin } from '@/types/modules';
import CRMDashboard from '@/components/crm/CRMDashboard';
import { crmSchema } from './schema';
import { crmMigrations } from './migrations';
import { crmSeeds } from './seeds';

/**
 * CRM / Contact Database Module
 * Airtable-style contact management with custom fields
 */
export const CRMModule: ModulePlugin = {
  schema: crmSchema,
  migrations: crmMigrations,
  seeds: crmSeeds,

  metadata: {
    id: 'crm',
    type: 'crm',
    name: 'CRM / Contact Database',
    description: 'Airtable-style contact management with custom fields, views, and templates',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'Database',
    capabilities: [
      {
        id: 'contacts',
        name: 'Contact Management',
        description: 'Store and manage contacts with custom fields',
      },
      {
        id: 'custom-fields',
        name: 'Custom Fields',
        description: 'Add custom fields to contacts',
      },
      {
        id: 'views',
        name: 'Custom Views',
        description: 'Create filtered and sorted views of contacts',
      },
      {
        id: 'templates',
        name: 'Templates',
        description: 'Pre-built templates for organizing, fundraising, etc.',
      },
    ],
    configSchema: [
      {
        key: 'template',
        label: 'CRM Template',
        type: 'select',
        defaultValue: 'general',
        options: [
          { label: 'General Organizing', value: 'general' },
          { label: 'Union Organizing', value: 'union' },
          { label: 'Fundraising', value: 'fundraising' },
          { label: 'Volunteer Management', value: 'volunteer' },
          { label: 'Legal/Human Rights', value: 'legal' },
          { label: 'Custom', value: 'custom' },
        ],
        description: 'Starting template for contact fields',
      },
      {
        key: 'enableExport',
        label: 'Enable Export',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow exporting contacts to CSV',
      },
      {
        key: 'fieldPrivacy',
        label: 'Field-Level Privacy',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable privacy controls per field',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`CRM module enabled for group ${groupId}`, config);
      // TODO: Initialize template fields based on config.template
    },

    onDisable: async (groupId) => {
      console.log(`CRM module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/crm',
      component: CRMDashboard,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    template: 'general',
    enableExport: true,
    fieldPrivacy: true,
  }),

  validateConfig: (config) => {
    const validTemplates = ['general', 'union', 'fundraising', 'volunteer', 'legal', 'custom'];
    if (!validTemplates.includes(config.template as string)) {
      return false;
    }
    if (typeof config.enableExport !== 'boolean') {
      return false;
    }
    if (typeof config.fieldPrivacy !== 'boolean') {
      return false;
    }
    return true;
  },
};
