/**
 * Simple Group Template
 *
 * The simplest starting point - just messaging.
 * Good for small groups that want to start basic and add features later.
 */

import type { GroupTemplate } from '../types';

export const SIMPLE_GROUP_TEMPLATE: GroupTemplate = {
  id: 'simple-group',
  name: 'Simple Group',
  description: 'Just messaging - the simplest starting point. Add features as you grow.',
  icon: '💬',
  category: 'community',
  complexity: 1,
  tags: ['simple', 'minimal', 'chat', 'beginner'],
  defaultPrivacy: 'private',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true, // Core to any group
    },
  ],

  enhancements: [
    {
      id: 'events',
      name: 'Events',
      description: 'Add event scheduling and RSVPs',
      icon: '📅',
      modules: [{ moduleId: 'events', enabled: true }],
    },
    {
      id: 'wiki',
      name: 'Knowledge Base',
      description: 'Add collaborative wiki for documentation',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'governance',
      name: 'Governance',
      description: 'Add proposals and voting',
      icon: '🗳️',
      modules: [{ moduleId: 'governance', enabled: true }],
    },
    {
      id: 'public-pages',
      name: 'Public Pages',
      description: 'Enable public-facing pages for your group',
      icon: '🌐',
      modules: [{ moduleId: 'public', enabled: true }],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General discussion',
      type: 'chat',
      privacy: 'members',
    },
  ],

  demoData: {
    available: false, // Simple template has no demo data
    enabledByDefault: false,
  },

  defaultSettings: {
    discoverable: false,
    requireApproval: false,
    allowInvites: true,
  },

  i18nKey: 'templates.simpleGroup',
};

export default SIMPLE_GROUP_TEMPLATE;
