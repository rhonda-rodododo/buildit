/**
 * CRM Module
 * Contact management with pre-built templates using Database module
 */

import type { ModulePlugin } from '@/types/modules';
import { crmSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { CRM_TEMPLATES } from './templates';
import { Users } from 'lucide-react';
import { lazy } from 'react';

// Lazy load CRMView to reduce initial bundle size
const CRMView = lazy(() => import('./components/CRMView').then(m => ({ default: m.CRMView })));

/**
 * CRM Module Plugin
 */
export const crmModule: ModulePlugin = {
  metadata: {
    id: 'crm',
    type: 'crm',
    name: 'CRM',
    description: 'Contact management with pre-built templates (Union, Fundraising, Legal, Volunteer, Civil Defense)',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Users,
    capabilities: [
      {
        id: 'template-management',
        name: 'Template Management',
        description: 'Apply and customize CRM templates',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'contact-management',
        name: 'Contact Management',
        description: 'Manage contacts and records',
        requiresPermission: ['member', 'all'],
      },
    ],
    configSchema: [
      {
        key: 'enabledTemplates',
        label: 'Enabled Templates',
        type: 'string',
        defaultValue: 'all',
        description: 'Which CRM templates to enable (all, union, fundraising, legal, volunteer, civil-defense)',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      console.info('CRM module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.info(`CRM module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.info(`CRM module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'crm',
      component: CRMView,
      scope: 'group',
      requiresEnabled: true,
      label: 'CRM',
    },
  ],

  schema: crmSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial CRM schema',
      migrate: async (_db: BuildItDB) => {
        console.info('CRM migration v1: Initial schema');
      },
    },
  ],

  seeds: [
    {
      name: 'crm-templates',
      description: 'Seed CRM templates',
      data: async (db: BuildItDB) => {
        const now = Date.now();
        const dbTemplates = CRM_TEMPLATES.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          icon: template.icon,
          category: template.category,
          fieldConfig: JSON.stringify(template.fields),
          viewConfig: JSON.stringify(template.defaultViews),
          created: now,
        }));

        await db.table('crmTemplates').bulkAdd(dbTemplates);
      },
    },
  ],

  getDefaultConfig: () => ({
    enabledTemplates: 'all',
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enabledTemplates !== 'string') return false;
    return true;
  },
};

export default crmModule;
