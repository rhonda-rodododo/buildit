/**
 * Social Publishing Module
 * Centralized scheduling, cross-posting, share links, and outreach analytics
 */

import type { ModulePlugin } from '@/types/modules';
import { socialPublishingSchema } from './schema';

import { Share2 } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import socialPublishingTranslations from './i18n';

const SocialPublishingView = lazy(() =>
  import('./components/SocialPublishingView').then((m) => ({
    default: m.SocialPublishingView,
  }))
);

/**
 * Social Publishing Module Plugin
 */
export const socialPublishingModule: ModulePlugin = {
  metadata: {
    id: 'social-publishing',
    type: 'social-publishing',
    name: 'Social Publishing',
    description: 'Schedule, share, and cross-post content across platforms',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Share2,
    capabilities: [
      {
        id: 'content-scheduling',
        name: 'Content Scheduling',
        description: 'Schedule content for future publishing with server-side reliability',
        requiresPermission: ['member'],
      },
      {
        id: 'cross-posting',
        name: 'Cross-Posting',
        description: 'Post to Nostr, ActivityPub, AT Protocol, and RSS simultaneously',
        requiresPermission: ['member'],
      },
      {
        id: 'share-links',
        name: 'Share Links',
        description: 'Generate short share URLs with QR codes and analytics',
        requiresPermission: ['member'],
      },
      {
        id: 'content-calendar',
        name: 'Content Calendar',
        description: 'Visual calendar of scheduled and published content',
        requiresPermission: ['member'],
      },
      {
        id: 'outreach-analytics',
        name: 'Outreach Analytics',
        description: 'Privacy-preserving click analytics for share links',
        requiresPermission: ['admin'],
      },
    ],
    configSchema: [
      {
        key: 'enableServerScheduling',
        label: 'Server-Side Scheduling',
        type: 'boolean',
        defaultValue: true,
        description: 'Use server-side scheduler for reliable publishing (recommended)',
      },
      {
        key: 'defaultPlatforms',
        label: 'Default Platforms',
        type: 'select',
        defaultValue: 'nostr',
        description: 'Default platforms for new scheduled content',
        options: [
          { label: 'Nostr Only', value: 'nostr' },
          { label: 'Nostr + ActivityPub', value: 'nostr,activitypub' },
          { label: 'All Platforms', value: 'nostr,activitypub,atproto' },
        ],
      },
      {
        key: 'trackShareClicks',
        label: 'Track Share Link Clicks',
        type: 'boolean',
        defaultValue: true,
        description: 'Privacy-preserving click counting (no user identification)',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('social-publishing', socialPublishingTranslations);
      logger.info('Social Publishing module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`Social Publishing module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`Social Publishing module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'social-publishing',
      component: SocialPublishingView,
      scope: 'app',
      label: 'Social Publishing',
    },
    {
      path: 'social-publishing',
      component: SocialPublishingView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Social Publishing',
    },
  ],

  schema: socialPublishingSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial social publishing schema',
      migrate: async () => {
        logger.info('Social Publishing migration v1: Initial schema');
      },
    },
  ],

  getDefaultConfig: () => ({
    enableServerScheduling: true,
    defaultPlatforms: 'nostr',
    trackShareClicks: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableServerScheduling !== 'boolean') return false;
    if (typeof config.trackShareClicks !== 'boolean') return false;
    const validPlatforms = ['nostr', 'nostr,activitypub', 'nostr,activitypub,atproto'];
    if (!validPlatforms.includes(config.defaultPlatforms as string)) return false;
    return true;
  },
};

export default socialPublishingModule;
