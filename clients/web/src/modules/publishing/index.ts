/**
 * Publishing Module
 * Long-form publishing platform for articles, blogs, and newsletters
 */

import type { ModulePlugin } from '@/types/modules';
import { publishingSchema } from './schema';
import { BookOpen } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import publishingTranslations from './i18n';

// Lazy load PublishingPage to reduce initial bundle size
const PublishingPage = lazy(() => import('./components/PublishingPage').then(m => ({ default: m.PublishingPage })));

/**
 * Publishing Module Plugin
 */
export const publishingModule: ModulePlugin = {
  metadata: {
    id: 'publishing',
    type: 'publishing',
    name: 'Publishing',
    description: 'Long-form publishing for articles, blogs, and newsletters with subscriber management',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: BookOpen,
    capabilities: [
      {
        id: 'article-creation',
        name: 'Article Creation',
        description: 'Create and publish long-form articles with rich formatting',
        requiresPermission: ['member'],
      },
      {
        id: 'publication-management',
        name: 'Publication Management',
        description: 'Manage publication settings, branding, and configuration',
        requiresPermission: ['admin'],
      },
      {
        id: 'subscriber-management',
        name: 'Subscriber Management',
        description: 'Manage subscriber list and subscription tiers',
        requiresPermission: ['admin'],
      },
      {
        id: 'rss-feeds',
        name: 'RSS Feeds',
        description: 'Generate RSS feeds for articles',
        requiresPermission: ['member'],
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'View article and publication analytics',
        requiresPermission: ['member'],
      },
    ],
    configSchema: [
      {
        key: 'enableRss',
        label: 'Enable RSS Feed',
        type: 'boolean',
        defaultValue: true,
        description: 'Generate RSS feed for published articles',
      },
      {
        key: 'defaultVisibility',
        label: 'Default Article Visibility',
        type: 'select',
        defaultValue: 'public',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'subscribers', label: 'Subscribers Only' },
          { value: 'paid', label: 'Paid Subscribers Only' },
        ],
        description: 'Default visibility for new articles',
      },
      {
        key: 'enableSubscriptions',
        label: 'Enable Subscriptions',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow readers to subscribe to the publication',
      },
      {
        key: 'enablePaidTier',
        label: 'Enable Paid Subscriptions',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow paid subscription tier for premium content',
      },
      {
        key: 'allowComments',
        label: 'Allow Comments',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow readers to comment on articles',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('publishing', publishingTranslations);
      logger.info('📚 Publishing module registered');
    },
    onEnable: async (groupId: string) => {
      logger.info(`📚 Publishing module enabled for group ${groupId}`);
    },
    onDisable: async (groupId: string) => {
      logger.info(`📚 Publishing module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'publishing',
      component: PublishingPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Publishing',
    },
  ],

  schema: publishingSchema,

  migrations: [],
  seeds: [],

  getDefaultConfig: () => ({
    enableRss: true,
    defaultVisibility: 'public',
    enableSubscriptions: true,
    enablePaidTier: false,
    allowComments: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableRss !== 'boolean') return false;
    if (!['public', 'subscribers', 'paid'].includes(config.defaultVisibility as string)) return false;
    if (typeof config.enableSubscriptions !== 'boolean') return false;
    if (typeof config.enablePaidTier !== 'boolean') return false;
    if (typeof config.allowComments !== 'boolean') return false;
    return true;
  },
};

export default publishingModule;
