/**
 * Events Module
 * Event creation, RSVPs, campaigns, and task management
 */

import type { ModulePlugin } from '@/types/modules';
import { eventsSchema } from './schema';
import { eventsSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Calendar } from 'lucide-react';
import { EventsView } from './components/EventsView';

/**
 * Events Module Plugin
 */
export const eventsModule: ModulePlugin = {
  metadata: {
    id: 'events',
    type: 'events',
    name: 'Events & Organizing',
    description: 'Create events, manage RSVPs, and coordinate campaigns',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Calendar,
    capabilities: [
      {
        id: 'event-creation',
        name: 'Event Creation',
        description: 'Create and manage events',
        requiresPermission: ['member'],
      },
      {
        id: 'rsvp-management',
        name: 'RSVP Management',
        description: 'RSVP to events and track attendance',
        requiresPermission: ['all'],
      },
      {
        id: 'campaign-coordination',
        name: 'Campaign Coordination',
        description: 'Coordinate multiple events as campaigns',
        requiresPermission: ['moderator', 'admin'],
      },
    ],
    configSchema: [
      {
        key: 'allowPublicEvents',
        label: 'Allow Public Events',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to create public events',
      },
      {
        key: 'requireRSVPApproval',
        label: 'Require RSVP Approval',
        type: 'boolean',
        defaultValue: false,
        description: 'Require admin approval for event RSVPs',
      },
      {
        key: 'defaultCapacity',
        label: 'Default Capacity',
        type: 'number',
        defaultValue: 100,
        description: 'Default maximum capacity for events',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Events module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Events module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Events module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'events',
      component: EventsView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Events',
    },
  ],

  schema: eventsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial events schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Events migration v1: Initial schema');
      },
    },
  ],

  seeds: eventsSeeds,

  getDefaultConfig: () => ({
    allowPublicEvents: true,
    requireRSVPApproval: false,
    defaultCapacity: 100,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowPublicEvents !== 'boolean') return false;
    if (typeof config.requireRSVPApproval !== 'boolean') return false;
    if (typeof config.defaultCapacity !== 'number') return false;
    if (config.defaultCapacity < 1) return false;
    return true;
  },
};

export default eventsModule;
