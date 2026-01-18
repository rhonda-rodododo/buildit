/**
 * Mutual Aid Module
 * Resource requests, offers, and solidarity rideshare
 */

import type { ModulePlugin } from '@/types/modules';
import { mutualAidSchema } from './schema';
import { mutualAidSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Heart } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';

// Lazy load MutualAidView to reduce initial bundle size
const MutualAidView = lazy(() => import('./components/MutualAidView').then(m => ({ default: m.MutualAidView })));

/**
 * Mutual Aid Module Plugin
 */
export const mutualAidModule: ModulePlugin = {
  metadata: {
    id: 'mutual-aid',
    type: 'mutual-aid',
    name: 'Mutual Aid',
    description: 'Request and offer resources, coordinate rideshares',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Heart,
    capabilities: [
      {
        id: 'request-creation',
        name: 'Request Creation',
        description: 'Create mutual aid requests',
        requiresPermission: ['all'],
      },
      {
        id: 'offer-creation',
        name: 'Offer Creation',
        description: 'Create mutual aid offers',
        requiresPermission: ['all'],
      },
      {
        id: 'rideshare',
        name: 'Rideshare Network',
        description: 'Coordinate solidarity rideshares',
        requiresPermission: ['member'],
      },
    ],
    configSchema: [
      {
        key: 'allowAnonymousRequests',
        label: 'Allow Anonymous Requests',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to create anonymous requests',
      },
      {
        key: 'autoMatch',
        label: 'Auto-Match Requests',
        type: 'boolean',
        defaultValue: false,
        description: 'Automatically match requests with offers',
      },
      {
        key: 'categories',
        label: 'Request Categories',
        type: 'multiselect',
        defaultValue: ['food', 'housing', 'transport', 'skills', 'medical'],
        options: [
          { label: 'Food', value: 'food' },
          { label: 'Housing', value: 'housing' },
          { label: 'Transport', value: 'transport' },
          { label: 'Skills', value: 'skills' },
          { label: 'Medical', value: 'medical' },
          { label: 'Financial', value: 'financial' },
          { label: 'Childcare', value: 'childcare' },
          { label: 'Legal', value: 'legal' },
        ],
      },
    ],
    requiredPermission: 'all',
    // Enhanced dependencies
    dependencies: [
      {
        moduleId: 'custom-fields',
        relationship: 'optional',
        reason: 'Enables custom fields for requests like dietary restrictions, allergies, and specific needs',
        enhancementConfig: {
          featureFlags: ['custom-request-fields', 'custom-offer-fields'],
          uiSlots: ['request-form-fields', 'offer-form-fields'],
        },
      },
      {
        moduleId: 'public',
        relationship: 'optional',
        reason: 'Enables publishing mutual aid requests to public pages',
        enhancementConfig: {
          featureFlags: ['public-requests'],
          uiSlots: ['request-share-public'],
        },
      },
      {
        moduleId: 'events',
        relationship: 'recommendedWith',
        reason: 'Coordinate mutual aid with community events like food drives or resource fairs',
      },
      {
        moduleId: 'crm',
        relationship: 'recommendedWith',
        reason: 'Track volunteer availability and resource provider contacts with CRM',
      },
    ],
    providesCapabilities: ['resource-requests', 'resource-offers', 'rideshare-coordination'],
  },

  lifecycle: {
    onRegister: async () => {
      logger.info('💗 Mutual Aid module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`💗 Mutual Aid module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`💗 Mutual Aid module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'mutual-aid',
      component: MutualAidView,
      scope: 'app',
      label: 'Mutual Aid',
    },
    {
      path: 'mutual-aid',
      component: MutualAidView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Mutual Aid',
    },
  ],

  schema: mutualAidSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial mutual aid schema',
      migrate: async (_db: BuildItDB) => {
        console.info('Mutual Aid migration v1: Initial schema');
      },
    },
  ],

  seeds: mutualAidSeeds,

  getDefaultConfig: () => ({
    allowAnonymousRequests: true,
    autoMatch: false,
    categories: ['food', 'housing', 'transport', 'skills', 'medical'],
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowAnonymousRequests !== 'boolean') return false;
    if (typeof config.autoMatch !== 'boolean') return false;
    if (!Array.isArray(config.categories)) return false;
    return true;
  },
};

export default mutualAidModule;
