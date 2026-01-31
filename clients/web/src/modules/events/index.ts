/**
 * Events Module
 * Event creation, RSVPs, campaigns, and task management
 */

import type { ModulePlugin } from '@/types/modules';
import { eventsSchema } from './schema';
import { eventsSeeds } from './seeds';

import { Calendar } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import eventsTranslations from './i18n';

// Lazy load components to reduce initial bundle size
const EventsView = lazy(() => import('./components/EventsView').then(m => ({ default: m.EventsView })));
const CreateEventPage = lazy(() => import('./components/CreateEventPage').then(m => ({ default: m.CreateEventPage })));
const EditEventPage = lazy(() => import('./components/EditEventPage').then(m => ({ default: m.EditEventPage })));

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
    // Enhanced dependencies
    dependencies: [
      {
        moduleId: 'custom-fields',
        relationship: 'optional',
        reason: 'Enables custom RSVP fields like dietary preferences, skills, and accessibility needs',
        enhancementConfig: {
          featureFlags: ['custom-rsvp-fields', 'custom-event-fields'],
          uiSlots: ['event-form-fields', 'rsvp-form-fields'],
        },
      },
      {
        moduleId: 'public',
        relationship: 'optional',
        reason: 'Enables publishing events to public pages',
        enhancementConfig: {
          featureFlags: ['public-events'],
          uiSlots: ['event-share-public'],
        },
      },
      {
        moduleId: 'governance',
        relationship: 'recommendedWith',
        reason: 'Use governance for event approval workflows and voting on event proposals',
      },
    ],
    providesCapabilities: ['event-scheduling', 'rsvp-management', 'campaign-coordination'],
  },

  lifecycle: {
    onRegister: async () => {
      // Register module translations for lazy loading
      registerModuleTranslations('events', eventsTranslations);
      logger.info('📅 Events module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`📅 Events module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`📅 Events module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'events',
      component: EventsView,
      scope: 'app',
      label: 'Events',
    },
    {
      path: 'events',
      component: EventsView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Events',
    },
    {
      path: 'events/new',
      component: CreateEventPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Create Event',
    },
    {
      path: 'events/:eventId/edit',
      component: EditEventPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Edit Event',
    },
  ],

  schema: eventsSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial events schema',
      migrate: async () => {
        logger.info('Events migration v1: Initial schema');
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
