import type { ModulePlugin } from '@/types/modules';
import { eventsSchema } from './schema';
import { eventsMigrations } from './migrations';
import { eventsSeeds } from './seeds';

// Placeholder component - will be implemented in future epic
const EventsPlaceholder = () => <div>Events Module (Coming Soon)</div>;

/**
 * Events & Organizing Module
 * Event creation, RSVP system, campaign coordination
 */
export const EventsModule: ModulePlugin = {
  // Database schema
  schema: eventsSchema,
  migrations: eventsMigrations,
  seeds: eventsSeeds,

  metadata: {
    id: 'events',
    type: 'events',
    name: 'Events & Organizing',
    description: 'Create events, manage RSVPs, coordinate campaigns with task tracking',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'Calendar',
    capabilities: [
      {
        id: 'create-events',
        name: 'Create Events',
        description: 'Create events with different privacy levels',
      },
      {
        id: 'rsvp',
        name: 'RSVP Management',
        description: 'Manage event RSVPs with capacity limits',
      },
      {
        id: 'campaigns',
        name: 'Campaign Coordination',
        description: 'Coordinate multi-event campaigns',
      },
      {
        id: 'task-tracking',
        name: 'Task Tracking',
        description: 'Assign and track tasks for events',
      },
    ],
    configSchema: [
      {
        key: 'defaultPrivacy',
        label: 'Default Event Privacy',
        type: 'select',
        defaultValue: 'group',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Group Only', value: 'group' },
          { label: 'Private', value: 'private' },
          { label: 'Direct Action', value: 'direct-action' },
        ],
        description: 'Default privacy setting for new events',
      },
      {
        key: 'requireApproval',
        label: 'Require Admin Approval',
        type: 'boolean',
        defaultValue: false,
        description: 'Require admin approval for new events',
      },
      {
        key: 'enableCalendarExport',
        label: 'Enable iCal Export',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow exporting events to calendar apps',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Events module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Events module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/events',
      component: EventsPlaceholder,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    defaultPrivacy: 'group',
    requireApproval: false,
    enableCalendarExport: true,
  }),

  validateConfig: (config) => {
    const validPrivacy = ['public', 'group', 'private', 'direct-action'];
    if (!validPrivacy.includes(config.defaultPrivacy as string)) {
      return false;
    }
    if (typeof config.requireApproval !== 'boolean') {
      return false;
    }
    if (typeof config.enableCalendarExport !== 'boolean') {
      return false;
    }
    return true;
  },
};
