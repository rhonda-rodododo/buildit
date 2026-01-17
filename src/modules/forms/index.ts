/**
 * Forms Module Entry Point
 * Public-facing forms for data collection
 * Forms submit directly to Database module tables
 */

import type { ModulePlugin } from '@/types/modules';
import { formsSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { FileText } from 'lucide-react';
import { lazy } from 'react';

// Lazy load FormsPage to reduce initial bundle size
const FormsPage = lazy(() => import('./components/FormsPage').then(m => ({ default: m.FormsPage })));

// Types
export * from './types';
export * from './schema';

// Store
export { useFormsStore } from './formsStore';

// Components
export * from './components';

/**
 * Forms Module Plugin
 */
export const formsModule: ModulePlugin = {
  metadata: {
    id: 'forms',
    type: 'forms',
    name: 'Forms',
    description: 'Public-facing forms for data collection (volunteer signup, event registration, surveys)',
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
        id: 'form-submissions',
        name: 'Form Submissions',
        description: 'Manage form submissions and spam filtering',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'form-templates',
        name: 'Form Templates',
        description: 'Pre-built templates for common use cases',
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
        key: 'enableAntiSpam',
        label: 'Enable Anti-Spam Protection',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable honeypot, rate limiting, and CAPTCHA for spam prevention',
      },
      {
        key: 'enableWebhooks',
        label: 'Enable Webhooks',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow forms to send data to external webhooks',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.info('Forms module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.info(`Forms module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.info(`Forms module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'forms',
      component: FormsPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Forms',
    },
  ],

  schema: formsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial forms schema',
      migrate: async (_db: BuildItDB) => {
        console.info('Forms migration v1: Initial schema (forms, submissions)');
      },
    },
  ],

  seeds: [], // Exported separately from seeds.ts file for lazy loading

  getDefaultConfig: () => ({
    allowAnonymousSubmissions: true,
    enableAntiSpam: true,
    enableWebhooks: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowAnonymousSubmissions !== 'boolean') return false;
    if (typeof config.enableAntiSpam !== 'boolean') return false;
    if (typeof config.enableWebhooks !== 'boolean') return false;
    return true;
  },
};

export default formsModule;
