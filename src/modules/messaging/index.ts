/**
 * Messaging Module
 * Direct messages, group threads, and @mentions
 */

import type { ModulePlugin } from '@/types/modules';
import { messagingSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { MessageSquare } from 'lucide-react';

/**
 * Messaging Module Plugin
 */
export const messagingModule: ModulePlugin = {
  metadata: {
    id: 'messaging',
    type: 'messaging',
    name: 'Messaging',
    description: 'Encrypted direct messages and group threads with @mentions',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: MessageSquare,
    capabilities: [
      {
        id: 'direct-messages',
        name: 'Direct Messages',
        description: 'Send encrypted DMs to other users',
        requiresPermission: ['all'],
      },
      {
        id: 'group-threads',
        name: 'Group Threads',
        description: 'Create threaded discussions in groups',
        requiresPermission: ['member'],
      },
      {
        id: 'mentions',
        name: '@Mentions',
        description: 'Mention users with @ syntax',
        requiresPermission: ['all'],
      },
    ],
    configSchema: [
      {
        key: 'allowDMs',
        label: 'Allow Direct Messages',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to send DMs to each other',
      },
      {
        key: 'allowThreads',
        label: 'Allow Threads',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow threaded conversations',
      },
      {
        key: 'messageRetentionDays',
        label: 'Message Retention (Days)',
        type: 'number',
        defaultValue: 0,
        description: 'Automatically delete messages older than this (0 = never)',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.info('Messaging module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.info(`Messaging module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.info(`Messaging module disabled for group ${groupId}`);
    },
  },

  schema: messagingSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial messaging schema',
      migrate: async (_db: BuildItDB) => {
        console.info('Messaging migration v1: Initial schema (messages in core DB)');
      },
    },
  ],

  seeds: [],

  getDefaultConfig: () => ({
    allowDMs: true,
    allowThreads: true,
    messageRetentionDays: 0,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowDMs !== 'boolean') return false;
    if (typeof config.allowThreads !== 'boolean') return false;
    if (typeof config.messageRetentionDays !== 'number') return false;
    if (config.messageRetentionDays < 0) return false;
    return true;
  },
};

export default messagingModule;
