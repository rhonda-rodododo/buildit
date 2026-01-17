/**
 * Fundraising Module Entry Point
 * Fundraising campaigns, donation processing, and donor management
 * Can integrate with Forms module for donor data collection
 */

import type { ModulePlugin } from '@/types/modules';
import { fundraisingSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { DollarSign } from 'lucide-react';
import { lazy } from 'react';

// Lazy load FundraisingPage to reduce initial bundle size
const FundraisingPage = lazy(() => import('./components/FundraisingPage').then(m => ({ default: m.FundraisingPage })));

// Types
export * from './types';
export * from './schema';

// Store
export { useFundraisingStore } from './fundraisingStore';

// Components
export * from './components';

/**
 * Fundraising Module Plugin
 */
export const fundraisingModule: ModulePlugin = {
  metadata: {
    id: 'fundraising',
    type: 'fundraising',
    name: 'Fundraising & Campaigns',
    description: 'Fundraising campaigns with donation processing, tiers, and donor management',
    version: '0.1.0',
    author: 'BuildIt Network',
    icon: DollarSign,
    capabilities: [
      {
        id: 'campaigns',
        name: 'Fundraising Campaigns',
        description: 'Create and manage fundraising campaigns with donation tiers',
        requiresPermission: ['admin'],
      },
      {
        id: 'donations',
        name: 'Donation Processing',
        description: 'Process one-time and recurring donations via Stripe, PayPal, crypto',
        requiresPermission: ['admin'],
      },
      {
        id: 'donor-management',
        name: 'Donor Management',
        description: 'Manage donor relationships, thank you emails, tax receipts',
        requiresPermission: ['admin', 'moderator'],
      },
    ],
    configSchema: [
      {
        key: 'enableCampaigns',
        label: 'Enable Fundraising Campaigns',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable fundraising campaign creation and management',
      },
      {
        key: 'enableRecurringDonations',
        label: 'Enable Recurring Donations',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow donors to set up recurring monthly/quarterly/yearly donations',
      },
      {
        key: 'enableCrypto',
        label: 'Enable Cryptocurrency Donations',
        type: 'boolean',
        defaultValue: true,
        description: 'Accept Bitcoin, Ethereum, Monero donations',
      },
      {
        key: 'requireDonorVerification',
        label: 'Require Donor Verification',
        type: 'boolean',
        defaultValue: false,
        description: 'Require email verification for all donors',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.info('Fundraising module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.info(`Fundraising module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.info(`Fundraising module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'fundraising',
      component: FundraisingPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Fundraising',
    },
  ],

  schema: fundraisingSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial fundraising schema',
      migrate: async (_db: BuildItDB) => {
        console.info('Fundraising migration v1: Initial schema (campaigns, donations, tiers)');
      },
    },
  ],

  seeds: [], // Exported separately from seeds.ts file for lazy loading

  getDefaultConfig: () => ({
    enableCampaigns: true,
    enableRecurringDonations: true,
    enableCrypto: true,
    requireDonorVerification: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableCampaigns !== 'boolean') return false;
    if (typeof config.enableRecurringDonations !== 'boolean') return false;
    if (typeof config.enableCrypto !== 'boolean') return false;
    if (typeof config.requireDonorVerification !== 'boolean') return false;
    return true;
  },
};

export default fundraisingModule;
