/**
 * Newsletters Module
 * Newsletter management with Nostr DM delivery
 */

import { Mail } from 'lucide-react';
import type { ModulePlugin } from '@/types/modules';
import { newslettersSchema } from './schema';

/**
 * Newsletters module plugin definition
 */
export const NewslettersModule: ModulePlugin = {
  metadata: {
    id: 'newsletters',
    type: 'newsletters' as any, // Will be added to ModuleType
    name: 'Newsletters',
    description:
      'Send newsletters to subscribers via Nostr DMs. Privacy-preserving, fully encrypted, no email service required.',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Mail,
    capabilities: [
      {
        id: 'create-newsletter',
        name: 'Create Newsletters',
        description: 'Create and manage newsletters',
      },
      {
        id: 'compose-issues',
        name: 'Compose Issues',
        description: 'Write and schedule newsletter issues',
      },
      {
        id: 'manage-subscribers',
        name: 'Manage Subscribers',
        description: 'Add, import, and manage subscribers',
      },
      {
        id: 'nostr-delivery',
        name: 'Nostr DM Delivery',
        description: 'Send newsletters via NIP-17 encrypted DMs',
      },
      {
        id: 'delivery-tracking',
        name: 'Delivery Tracking',
        description: 'Track delivery status and relay confirmations',
      },
    ],
    configSchema: [
      {
        key: 'defaultRateLimit',
        label: 'Default Rate Limit',
        type: 'number',
        defaultValue: 30,
        description: 'Default rate limit per minute for sending',
      },
      {
        key: 'maxRetries',
        label: 'Max Retries',
        type: 'number',
        defaultValue: 3,
        description: 'Maximum retry attempts for failed sends',
      },
      {
        key: 'requireConfirmation',
        label: 'Require Confirmation',
        type: 'boolean',
        defaultValue: false,
        description: 'Require subscribers to confirm subscription',
      },
    ],
    requiredPermission: 'member',
  },

  schema: newslettersSchema,

  lifecycle: {
    onRegister: () => {
      console.info('📧 Newsletters module registered');
    },
    onEnable: async (groupId) => {
      console.info(`📧 Newsletters enabled for group ${groupId}`);
    },
    onDisable: async (groupId) => {
      console.info(`📧 Newsletters disabled for group ${groupId}`);
    },
  },

  getDefaultConfig: () => ({
    defaultRateLimit: 30,
    maxRetries: 3,
    requireConfirmation: false,
  }),

  validateConfig: (config) => {
    if (typeof config.defaultRateLimit === 'number' && config.defaultRateLimit < 1) {
      return false;
    }
    if (typeof config.maxRetries === 'number' && config.maxRetries < 0) {
      return false;
    }
    return true;
  },
};

export default NewslettersModule;
