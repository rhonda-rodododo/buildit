/**
 * Mutual Aid Module
 * Resource requests, offers, and solidarity rideshare
 */

import type { ModulePlugin } from '@/types/modules';
import { mutualAidSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';

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
    icon: 'Heart',
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
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Mutual Aid module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Mutual Aid module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Mutual Aid module disabled for group ${groupId}`);
    },
  },

  schema: mutualAidSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial mutual aid schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Mutual Aid migration v1: Initial schema');
      },
    },
  ],

  seeds: [
    {
      name: 'example-requests',
      description: 'Create example mutual aid requests',
      data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
        const now = Date.now();
        const exampleRequests = [
          {
            id: `aid-${groupId}-food-1`,
            groupId,
            type: 'request' as const,
            category: 'food',
            title: 'Food for Community Kitchen',
            description: 'Looking for donations of non-perishable food items for our community kitchen',
            status: 'open' as const,
            createdBy: userPubkey,
            created: now,
          },
          {
            id: `aid-${groupId}-transport-1`,
            groupId,
            type: 'offer' as const,
            category: 'transport',
            title: 'Rides to Protest',
            description: 'Offering rides to Saturday protest. Can fit 4 people.',
            status: 'open' as const,
            createdBy: userPubkey,
            created: now,
          },
        ];

        await db.table('mutualAidRequests').bulkAdd(exampleRequests);
      },
    },
  ],

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
