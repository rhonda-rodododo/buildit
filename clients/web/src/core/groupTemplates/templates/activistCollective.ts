/**
 * Activist Collective Template
 *
 * For activist groups focused on campaigns and direct action.
 * Includes governance, events, wiki, and public outreach.
 */

import type { GroupTemplate } from '../types';

export const ACTIVIST_COLLECTIVE_TEMPLATE: GroupTemplate = {
  id: 'activist-collective',
  name: 'Activist Collective',
  description: 'Coordinate actions with democratic decision-making. Built for campaign work and direct action.',
  icon: '📢',
  category: 'civic',
  complexity: 3,
  tags: ['activism', 'direct-action', 'campaigns', 'civic', 'organizing'],
  defaultPrivacy: 'private',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'events',
      enabled: true,
      required: true,
      config: {
        allowPublicEvents: true,
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'governance',
      enabled: true,
      config: {
        defaultVotingSystem: 'consensus',
        quorumRequired: false,
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
  ],

  enhancements: [
    {
      id: 'legal-support',
      name: 'Legal Support',
      description: 'Track legal cases, arrestees, and legal observer contacts',
      icon: '⚖️',
      modules: [
        {
          moduleId: 'crm',
          enabled: true,
          subTemplate: 'legal-tracking',
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
      id: 'volunteer-mgmt',
      name: 'Volunteer Management',
      description: 'Coordinate volunteer skills, availability, and assignments',
      icon: '🙋',
      modules: [
        {
          moduleId: 'crm',
          enabled: true,
          subTemplate: 'volunteer-management',
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
      id: 'microblogging',
      name: 'Social Updates',
      description: 'Share updates and news via microblogging',
      icon: '📣',
      modules: [{ moduleId: 'microblogging', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for press releases and materials',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General collective discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'campaigns',
      description: 'Active campaign coordination',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'actions',
      description: 'Direct action planning (sensitive)',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'media-comms',
      description: 'Media relations and communications',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'announcements',
      description: 'Public announcements',
      type: 'announcement',
      privacy: 'public',
    },
  ],

  defaultRoles: [
    {
      name: 'Facilitator',
      description: 'Meeting facilitator with governance permissions',
      color: '#10B981',
      permissions: ['create_proposals', 'create_events', 'manage_events'],
    },
    {
      name: 'Media Lead',
      description: 'Handles press and public communications',
      color: '#F59E0B',
      permissions: ['create_events', 'post_messages'],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description: 'Includes sample campaign event, a consensus proposal, and wiki documentation',
    seeds: ['events-action-demo', 'governance-demo', 'wiki-demo'],
  },

  defaultSettings: {
    discoverable: false, // Privacy for action planning
    requireApproval: true,
    allowInvites: true,
  },

  i18nKey: 'templates.activistCollective',
};

export default ACTIVIST_COLLECTIVE_TEMPLATE;
