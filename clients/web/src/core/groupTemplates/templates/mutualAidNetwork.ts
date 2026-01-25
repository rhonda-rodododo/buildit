/**
 * Mutual Aid Network Template
 *
 * For community mutual aid networks - resource sharing, requests, and offers.
 * Popular for neighborhood groups, disaster relief, and community solidarity.
 */

import type { GroupTemplate } from '../types';

export const MUTUAL_AID_NETWORK_TEMPLATE: GroupTemplate = {
  id: 'mutual-aid-network',
  name: 'Mutual Aid Network',
  description: 'Coordinate resource sharing, requests, and offers in your community. Perfect for neighborhood mutual aid.',
  icon: '🤝',
  category: 'mutual-aid',
  complexity: 2,
  tags: ['grassroots', 'community', 'resources', 'solidarity', 'neighborhood'],
  defaultPrivacy: 'public',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'mutual-aid',
      enabled: true,
      required: true,
      config: {
        allowAnonymousRequests: true,
        autoMatch: false,
        categories: ['food', 'housing', 'transport', 'skills', 'medical', 'financial'],
      },
    },
    {
      moduleId: 'events',
      enabled: true,
      config: {
        allowPublicEvents: true,
      },
    },
    {
      moduleId: 'public',
      enabled: true,
    },
  ],

  enhancements: [
    {
      id: 'civil-defense',
      name: 'Civil Defense Mode',
      description: 'Add emergency contacts and resource tracking for crisis response',
      icon: '🚨',
      modules: [
        {
          moduleId: 'crm',
          enabled: true,
          subTemplate: 'civil-defense',
        },
        {
          moduleId: 'database',
          enabled: true,
        },
        {
          moduleId: 'custom-fields',
          enabled: true,
        },
      ],
    },
    {
      id: 'wiki',
      name: 'Resource Directory',
      description: 'Document community resources, services, and procedures',
      icon: '📖',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'governance',
      name: 'Community Decisions',
      description: 'Add proposals and voting for collective decisions',
      icon: '🗳️',
      modules: [{ moduleId: 'governance', enabled: true }],
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
      name: 'requests',
      description: 'Post and discuss mutual aid requests',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'offers',
      description: 'Post and coordinate resource offers',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'announcements',
      description: 'Important community announcements',
      type: 'announcement',
      privacy: 'public',
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description: 'Includes sample requests, offers, and a community resource event',
    seeds: ['mutual-aid-demo', 'events-community-demo'],
  },

  defaultSettings: {
    discoverable: true,
    requireApproval: false,
    allowInvites: true,
  },

  i18nKey: 'templates.mutualAidNetwork',
};

export default MUTUAL_AID_NETWORK_TEMPLATE;
