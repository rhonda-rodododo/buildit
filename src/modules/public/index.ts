/**
 * Public Module Entry Point
 * SEO-optimized public pages and privacy-preserving analytics
 * Shared infrastructure for Forms and Fundraising modules
 */

import type { ModulePlugin } from '@/types/modules';
import { publicSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { Globe } from 'lucide-react';

// Types
export * from './types';
export * from './schema';

// Store
export { usePublicStore } from './publicStore';

// Templates
export * from './templates';

// Components
export * from './components/PublicPages';
export * from './components/Analytics';

/**
 * Public Module Plugin
 */
export const publicModule: ModulePlugin = {
  metadata: {
    id: 'public',
    type: 'public',
    name: 'Public Pages & Analytics',
    description: 'SEO-optimized public pages and privacy-preserving analytics infrastructure',
    version: '0.1.0',
    author: 'BuildIt Network',
    icon: Globe,
    capabilities: [
      {
        id: 'public-pages',
        name: 'Public Pages',
        description: 'Create SEO-optimized public pages for group visibility',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'analytics',
        name: 'Privacy-Preserving Analytics',
        description: 'Track page views and engagement without user tracking',
        requiresPermission: ['admin', 'moderator'],
      },
    ],
    configSchema: [
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
        description: 'Track analytics (privacy-preserving, no user IDs)',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.info('Public module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.info(`Public module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.info(`Public module disabled for group ${groupId}`);
    },
  },

  routes: [
    // Routes will be added when UI components are built
  ],

  schema: publicSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial public schema',
      migrate: async (_db: BuildItDB) => {
        console.info('Public migration v1: Initial schema (public pages, analytics)');
      },
    },
  ],

  seeds: [], // Exported separately from seeds.ts file for lazy loading

  getDefaultConfig: () => ({
    enablePublicPages: true,
    enableAnalytics: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enablePublicPages !== 'boolean') return false;
    if (typeof config.enableAnalytics !== 'boolean') return false;
    return true;
  },
};

export default publicModule;
