/**
 * Federation Module
 *
 * ActivityPub + AT Protocol federation bridge.
 * Enables cross-posting public content to Mastodon and Bluesky.
 */

import type { ModulePlugin } from '@/types/modules';
import { federationSchema, federationMigrations } from './schema';
import { Globe } from 'lucide-react';
import { lazy } from 'react';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import federationTranslations from './i18n';

const FederationSettings = lazy(() =>
  import('./components/FederationSettings').then((m) => ({ default: m.FederationSettings })),
);

export const federationModule: ModulePlugin = {
  metadata: {
    id: 'federation',
    type: 'federation',
    name: 'Federation',
    description: 'Bridge public posts to ActivityPub (Mastodon) and AT Protocol (Bluesky)',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Globe,
    capabilities: [
      {
        id: 'federation',
        name: 'Federation',
        description: 'Bridge public posts to ActivityPub and AT Protocol networks',
      },
      {
        id: 'cross-posting',
        name: 'Cross-posting',
        description: 'Cross-post content to Mastodon and Bluesky',
      },
    ],
    configSchema: [
      {
        key: 'apEnabled',
        type: 'boolean',
        label: 'Enable ActivityPub',
        description: 'Share public posts to the fediverse',
        defaultValue: false,
      },
      {
        key: 'atEnabled',
        type: 'boolean',
        label: 'Enable Bluesky',
        description: 'Cross-post to Bluesky',
        defaultValue: false,
      },
    ],
    requiredPermission: 'member',
    dependencies: [],
  },
  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('federation', federationTranslations);
    },
    onEnable: async (_groupId) => {
      // Federation is user-level, not group-level, but follows the module pattern
    },
    onDisable: async (_groupId) => {
      // Could trigger AP Delete activities when disabling
    },
    onConfigUpdate: async (_groupId, _config) => {
      // Config updates handled via federation worker API
    },
  },
  routes: [
    {
      path: 'federation',
      component: FederationSettings,
      scope: 'app',
      requiresEnabled: true,
      label: 'Federation',
    },
  ],
  schema: federationSchema,
  migrations: federationMigrations,
  seeds: [],
  getDefaultConfig: () => ({
    apEnabled: false,
    atEnabled: false,
  }),
  validateConfig: (config) => {
    if (typeof config.apEnabled !== 'boolean') return false;
    if (typeof config.atEnabled !== 'boolean') return false;
    return true;
  },
};
