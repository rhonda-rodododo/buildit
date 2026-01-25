/**
 * Community Hub Template
 *
 * General-purpose space for community organizing and connection.
 * Balanced feature set for neighborhoods, social clubs, and interest groups.
 */

import type { GroupTemplate } from '../types';

export const COMMUNITY_HUB_TEMPLATE: GroupTemplate = {
  id: 'community-hub',
  name: 'Community Hub',
  description: 'A general-purpose space for community organizing and connection. Perfect for neighborhoods and social groups.',
  icon: '🏘️',
  category: 'community',
  complexity: 3,
  tags: ['neighborhood', 'local', 'social', 'community', 'general'],
  defaultPrivacy: 'public',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'events',
      enabled: true,
      config: {
        allowPublicEvents: true,
      },
    },
    {
      moduleId: 'mutual-aid',
      enabled: true,
      config: {
        allowAnonymousRequests: true,
        autoMatch: false,
        categories: ['food', 'housing', 'transport', 'skills', 'childcare'],
      },
    },
    {
      moduleId: 'wiki',
      enabled: true,
    },
    {
      moduleId: 'public',
      enabled: true,
    },
    {
      moduleId: 'microblogging',
      enabled: true,
    },
  ],

  enhancements: [
    {
      id: 'governance',
      name: 'Collective Decisions',
      description: 'Add proposals and voting for community decisions',
      icon: '🗳️',
      modules: [{ moduleId: 'governance', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for meeting notes and planning',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'files',
      name: 'File Sharing',
      description: 'Shared file storage for community resources',
      icon: '📁',
      modules: [{ moduleId: 'files', enabled: true }],
    },
    {
      id: 'crm',
      name: 'Contact Directory',
      description: 'Manage community contacts and local businesses',
      icon: '📇',
      modules: [
        { moduleId: 'crm', enabled: true },
        { moduleId: 'database', enabled: true },
        { moduleId: 'custom-fields', enabled: true },
      ],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General community discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'introductions',
      description: 'New member introductions',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'events',
      description: 'Discuss upcoming community events',
      type: 'chat',
      privacy: 'public',
    },
    {
      name: 'mutual-aid',
      description: 'Resource sharing and requests',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'local-news',
      description: 'Local news and updates',
      type: 'announcement',
      privacy: 'public',
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description: 'Includes sample community events, mutual aid requests, and wiki pages',
    seeds: ['events-community-demo', 'mutual-aid-demo', 'wiki-demo'],
  },

  defaultSettings: {
    discoverable: true,
    requireApproval: false,
    allowInvites: true,
  },

  i18nKey: 'templates.communityHub',
};

export default COMMUNITY_HUB_TEMPLATE;
