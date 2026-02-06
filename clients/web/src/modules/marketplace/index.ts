/**
 * Marketplace Module Entry Point
 * Cooperative marketplace, skill exchange, resource sharing, and co-op directory
 */

import type { ModulePlugin } from '@/types/modules';
import { marketplaceSchema } from './schema';

import { Store } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import marketplaceTranslations from './i18n';

// Lazy load MarketplacePage to reduce initial bundle size
const MarketplacePage = lazy(() =>
  import('./components/MarketplacePage').then((m) => ({ default: m.MarketplacePage }))
);

// Types
export * from './types';
export * from './schema';

// Store
export { useMarketplaceStore } from './marketplaceStore';

// Components
export * from './components';

/**
 * Marketplace Module Plugin
 */
export const marketplaceModule: ModulePlugin = {
  metadata: {
    id: 'marketplace',
    type: 'marketplace',
    name: 'Marketplace',
    description: 'Cooperative marketplace with skill exchange, resource sharing, and co-op directory',
    version: '0.1.0',
    author: 'BuildIt Network',
    icon: Store,
    capabilities: [
      {
        id: 'listings',
        name: 'Marketplace Listings',
        description: 'Create and browse marketplace listings for goods, services, and more',
        requiresPermission: ['member'],
      },
      {
        id: 'coop-directory',
        name: 'Co-op Directory',
        description: 'Register and discover worker cooperatives',
        requiresPermission: ['member'],
      },
      {
        id: 'skill-exchange',
        name: 'Skill Exchange',
        description: 'Time-banking and skill exchange matching',
        requiresPermission: ['member'],
      },
      {
        id: 'resource-library',
        name: 'Resource Library',
        description: 'Share tools, spaces, and vehicles within the community',
        requiresPermission: ['member'],
      },
    ],
    configSchema: [
      {
        key: 'enableListings',
        label: 'Enable Marketplace Listings',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to create and browse marketplace listings',
      },
      {
        key: 'enableCoopDirectory',
        label: 'Enable Co-op Directory',
        type: 'boolean',
        defaultValue: true,
        description: 'Show the cooperative directory',
      },
      {
        key: 'enableSkillExchange',
        label: 'Enable Skill Exchange',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable time-banking and skill exchange',
      },
      {
        key: 'enableResourceLibrary',
        label: 'Enable Resource Library',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable tool, space, and vehicle sharing',
      },
      {
        key: 'requireApproval',
        label: 'Require Listing Approval',
        type: 'boolean',
        defaultValue: false,
        description: 'Require admin approval before listings go live',
      },
    ],
    dependencies: [
      {
        moduleId: 'custom-fields',
        relationship: 'optional',
        reason: 'Uses LocationValue type for privacy-aware location handling',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('marketplace', marketplaceTranslations);
      logger.info('Marketplace module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`Marketplace module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`Marketplace module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'marketplace',
      component: MarketplacePage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Marketplace',
    },
  ],

  schema: marketplaceSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial marketplace schema',
      migrate: async () => {
        logger.info('Marketplace migration v1: Initial schema (listings, co-ops, reviews, exchanges, resources)');
      },
    },
  ],

  seeds: [],

  getDefaultConfig: () => ({
    enableListings: true,
    enableCoopDirectory: true,
    enableSkillExchange: true,
    enableResourceLibrary: true,
    requireApproval: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableListings !== 'boolean') return false;
    if (typeof config.enableCoopDirectory !== 'boolean') return false;
    if (typeof config.enableSkillExchange !== 'boolean') return false;
    if (typeof config.enableResourceLibrary !== 'boolean') return false;
    if (typeof config.requireApproval !== 'boolean') return false;
    return true;
  },
};

export default marketplaceModule;
