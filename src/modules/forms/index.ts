/**
 * Forms Module Entry Point
 * Public-facing forms, fundraising campaigns, and public pages
 */

import type { ModulePlugin } from '@/types/modules';
import { formsSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { FileText } from 'lucide-react';

// Types
export * from './types';
export * from './schema';

// Store
export { useFormsStore } from './formsStore';

// Manager
export { formsManager, FormsManager } from './formsManager';

/**
 * Forms Module Plugin
 */
export const formsModule: ModulePlugin = {
  metadata: {
    id: 'forms',
    type: 'forms',
    name: 'Forms & Fundraising',
    description: 'Public-facing forms, fundraising campaigns, and public pages for outreach',
    version: '0.1.0',
    author: 'BuildIt Network',
    icon: FileText,
    capabilities: [
      {
        id: 'form-builder',
        name: 'Form Builder',
        description: 'Create public forms for data collection',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'fundraising',
        name: 'Fundraising Campaigns',
        description: 'Create and manage fundraising campaigns with donation tiers',
        requiresPermission: ['admin'],
      },
      {
        id: 'public-pages',
        name: 'Public Pages',
        description: 'Create SEO-optimized public pages for group visibility',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'analytics',
        name: 'Privacy-Preserving Analytics',
        description: 'Track form submissions and campaign performance',
        requiresPermission: ['admin', 'moderator'],
      },
    ],
    configSchema: [
      {
        key: 'allowAnonymousSubmissions',
        label: 'Allow Anonymous Submissions',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow form submissions without login',
      },
      {
        key: 'enableFundraising',
        label: 'Enable Fundraising',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable fundraising campaign features',
      },
      {
        key: 'enablePublicPages',
        label: 'Enable Public Pages',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable public page creation and management',
      },
      {
        key: 'enableAnalytics',
        label: 'Enable Analytics',
        type: 'boolean',
        defaultValue: true,
        description: 'Track form and campaign analytics (privacy-preserving)',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Forms module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Forms module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Forms module disabled for group ${groupId}`);
    },
  },

  routes: [
    // Routes will be added when UI components are built
    // {
    //   path: 'forms',
    //   component: FormsView,
    //   scope: 'group',
    //   requiresEnabled: true,
    //   label: 'Forms',
    // },
  ],

  schema: formsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial forms schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Forms migration v1: Initial schema (forms, campaigns, public pages, analytics)');
      },
    },
  ],

  seeds: [], // Exported separately from seeds.ts file for lazy loading

  getDefaultConfig: () => ({
    allowAnonymousSubmissions: true,
    enableFundraising: true,
    enablePublicPages: true,
    enableAnalytics: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowAnonymousSubmissions !== 'boolean') return false;
    if (typeof config.enableFundraising !== 'boolean') return false;
    if (typeof config.enablePublicPages !== 'boolean') return false;
    if (typeof config.enableAnalytics !== 'boolean') return false;
    return true;
  },
};

export default formsModule;
