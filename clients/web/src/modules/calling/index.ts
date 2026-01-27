/**
 * Calling Module
 * E2EE voice/video calling with WebRTC and NIP-17 signaling
 */

import type { ModulePlugin } from '@/types/modules';
import { callingSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { Phone } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import callingTranslations from './i18n';
import { getCallingManager } from './callingManager';

// Lazy load components to reduce initial bundle size
const CallingView = lazy(() => import('./components/CallingView').then(m => ({ default: m.CallingView })));
const CallHistoryView = lazy(() => import('./components/CallHistoryView').then(m => ({ default: m.CallHistoryView })));
const CallSettingsView = lazy(() => import('./components/CallSettingsView').then(m => ({ default: m.CallSettingsView })));
const HotlineView = lazy(() => import('./components/HotlineView').then(m => ({ default: m.HotlineView })));
const BroadcastsView = lazy(() => import('./components/BroadcastsView').then(m => ({ default: m.BroadcastsView })));

/**
 * Calling Module Plugin
 */
export const callingModule: ModulePlugin = {
  metadata: {
    id: 'calling',
    type: 'calling',
    name: 'Voice & Video Calling',
    description: 'End-to-end encrypted voice and video calls with WebRTC',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Phone,
    capabilities: [
      {
        id: 'voice-calls',
        name: 'Voice Calls',
        description: '1:1 E2EE voice calls',
        requiresPermission: ['all'],
      },
      {
        id: 'video-calls',
        name: 'Video Calls',
        description: '1:1 E2EE video calls',
        requiresPermission: ['all'],
      },
      {
        id: 'group-calls',
        name: 'Group Calls',
        description: 'Small group calls (up to 8 participants)',
        requiresPermission: ['member'],
      },
      {
        id: 'conferences',
        name: 'Conferences',
        description: 'Large scale video conferences with SFU',
        requiresPermission: ['moderator', 'admin'],
      },
      {
        id: 'hotline-calling',
        name: 'Hotline Calling',
        description: 'Operate hotlines with queue management',
        requiresPermission: ['moderator', 'admin'],
      },
      {
        id: 'broadcasts',
        name: 'Message Broadcasts',
        description: 'Send broadcast messages to groups or contact lists',
        requiresPermission: ['moderator', 'admin'],
      },
    ],
    configSchema: [
      {
        key: 'enableVoiceCalls',
        label: 'Enable Voice Calls',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to make voice calls',
      },
      {
        key: 'enableVideoCalls',
        label: 'Enable Video Calls',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to make video calls',
      },
      {
        key: 'enableGroupCalls',
        label: 'Enable Group Calls',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to start group calls',
      },
      {
        key: 'maxGroupCallSize',
        label: 'Max Group Call Size',
        type: 'number',
        defaultValue: 8,
        description: 'Maximum participants in a mesh group call',
      },
      {
        key: 'enableConferences',
        label: 'Enable Conferences',
        type: 'boolean',
        defaultValue: false,
        description: 'Enable large-scale SFU conferences (requires server)',
      },
      {
        key: 'relayOnlyMode',
        label: 'Relay Only Mode',
        type: 'boolean',
        defaultValue: false,
        description: 'Always use TURN relay (enhanced privacy, hides IP)',
      },
    ],
    requiredPermission: 'all',
    dependencies: [
      {
        moduleId: 'messaging',
        relationship: 'requires',
        reason: 'Call signaling uses the messaging protocol for metadata-protected communication',
      },
      {
        moduleId: 'crm',
        relationship: 'optional',
        reason: 'Contact lookup for caller identification',
        enhancementConfig: {
          featureFlags: ['caller-id-lookup'],
          uiSlots: ['call-contact-info'],
        },
      },
      {
        moduleId: 'hotlines',
        relationship: 'optional',
        reason: 'Integrates real calling into existing hotline module',
        enhancementConfig: {
          featureFlags: ['hotline-voice-calls'],
          uiSlots: ['hotline-call-controls'],
        },
      },
    ],
    providesCapabilities: [
      'voice-calls',
      'video-calls',
      'group-calls',
      'conferences',
      'hotline-calling',
      'broadcasts',
    ],
  },

  lifecycle: {
    onRegister: async () => {
      // Register module translations
      registerModuleTranslations('calling', callingTranslations);
      logger.info('📞 Calling module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      // Initialize calling manager when module is enabled
      try {
        const manager = getCallingManager();
        await manager.initialize();
        logger.info(`📞 Calling module enabled for group ${groupId}`, config);
      } catch (error) {
        logger.error('Failed to initialize calling manager', error);
      }
    },
    onDisable: async (groupId: string) => {
      logger.info(`📞 Calling module disabled for group ${groupId}`);
    },
  },

  routes: [
    // App-level routes (available without group context)
    {
      path: 'calls',
      component: CallingView,
      scope: 'app',
      label: 'Calls',
    },
    {
      path: 'calls/history',
      component: CallHistoryView,
      scope: 'app',
      label: 'Call History',
    },
    {
      path: 'calls/settings',
      component: CallSettingsView,
      scope: 'app',
      label: 'Call Settings',
    },
    // Group-level routes
    {
      path: 'calls',
      component: CallingView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Calls',
    },
    {
      path: 'hotline',
      component: HotlineView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Hotline',
    },
    {
      path: 'broadcasts',
      component: BroadcastsView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Broadcasts',
    },
  ],

  schema: callingSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial calling schema',
      migrate: async (_db: BuildItDB) => {
        logger.info('Calling migration v1: Initial schema');
      },
    },
  ],

  seeds: [], // No default seeds for calling

  getDefaultConfig: () => ({
    enableVoiceCalls: true,
    enableVideoCalls: true,
    enableGroupCalls: true,
    maxGroupCallSize: 8,
    enableConferences: false,
    relayOnlyMode: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableVoiceCalls !== 'boolean') return false;
    if (typeof config.enableVideoCalls !== 'boolean') return false;
    if (typeof config.enableGroupCalls !== 'boolean') return false;
    if (typeof config.maxGroupCallSize !== 'number') return false;
    if (config.maxGroupCallSize < 2 || config.maxGroupCallSize > 50) return false;
    if (typeof config.enableConferences !== 'boolean') return false;
    if (typeof config.relayOnlyMode !== 'boolean') return false;
    return true;
  },
};

export default callingModule;

// Re-export types and utilities
export * from './types';
export * from './callingStore';
export { getCallingManager, closeCallingManager } from './callingManager';
