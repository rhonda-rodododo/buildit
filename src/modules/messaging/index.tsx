import type { ModulePlugin } from '@/types/modules';

/**
 * Messaging Module
 * Provides DM and group messaging with E2E encryption
 */
export const MessagingModule: ModulePlugin = {
  metadata: {
    id: 'messaging',
    type: 'messaging',
    name: 'Messaging',
    description: 'Private messaging with end-to-end encryption for DMs and group threads',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'MessageSquare',
    capabilities: [
      {
        id: 'dm',
        name: 'Direct Messages',
        description: 'Send encrypted direct messages to other users',
      },
      {
        id: 'group-threads',
        name: 'Group Threads',
        description: 'Create encrypted group conversation threads',
      },
      {
        id: 'mentions',
        name: 'User Mentions',
        description: 'Mention users with @ syntax',
      },
    ],
    configSchema: [
      {
        key: 'enableNotifications',
        label: 'Enable Notifications',
        type: 'boolean',
        defaultValue: true,
        description: 'Show desktop notifications for new messages',
      },
      {
        key: 'messageRetention',
        label: 'Message Retention (days)',
        type: 'number',
        defaultValue: 30,
        description: 'How long to keep messages locally (0 = forever)',
      },
      {
        key: 'allowFileSharing',
        label: 'Allow File Sharing',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable file attachments in messages',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Messaging module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Messaging module disabled for group ${groupId}`);
    },

    onConfigUpdate: async (groupId, config) => {
      console.log(`Messaging module config updated for group ${groupId}`, config);
    },
  },

  // Routes are handled by the main app - messaging is integrated into groups
  routes: [],

  getDefaultConfig: () => ({
    enableNotifications: true,
    messageRetention: 30,
    allowFileSharing: true,
  }),

  validateConfig: (config) => {
    if (typeof config.enableNotifications !== 'boolean') {
      return false;
    }
    if (typeof config.messageRetention !== 'number' || config.messageRetention < 0) {
      return false;
    }
    if (typeof config.allowFileSharing !== 'boolean') {
      return false;
    }
    return true;
  },
};
