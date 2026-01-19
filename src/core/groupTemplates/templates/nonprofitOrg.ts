/**
 * Nonprofit Organization Template
 *
 * Template for nonprofit organizations, charities, and community organizations.
 * Includes donor management, volunteer coordination, campaign tracking,
 * and communication tools.
 */

import type { GroupTemplate } from '../types';

export const NONPROFIT_ORG_TEMPLATE: GroupTemplate = {
  id: 'nonprofit-org',
  name: 'Nonprofit Organization',
  description:
    'Manage donors, volunteers, campaigns, and communications. Built for nonprofits, charities, and community organizations.',
  icon: '❤️',
  category: 'community',
  complexity: 4,
  tags: ['nonprofit', 'charity', 'donors', 'volunteers', 'fundraising', 'community', 'ngo'],
  defaultPrivacy: 'private',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'crm',
      enabled: true,
      required: true,
      subTemplate: 'nonprofit-crm',
    },
    {
      moduleId: 'database',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'custom-fields',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'events',
      enabled: true,
      config: {
        allowPublicEvents: true,
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'fundraising',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'governance',
      enabled: true,
      config: {
        defaultVotingSystem: 'simple-majority',
        quorumRequired: true,
        quorumPercentage: 50,
        anonymousVoting: false,
      },
    },
  ],

  enhancements: [
    {
      id: 'public-presence',
      name: 'Public Presence',
      description: 'Add public pages for mission, impact stories, and donation links',
      icon: '📢',
      modules: [
        { moduleId: 'public', enabled: true },
        { moduleId: 'microblogging', enabled: true },
      ],
    },
    {
      id: 'wiki',
      name: 'Knowledge Base',
      description: 'Document policies, procedures, and organizational knowledge',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for reports, grants, and board materials',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'files',
      name: 'File Storage',
      description: 'Store documents, media, and organizational files',
      icon: '📁',
      modules: [
        {
          moduleId: 'files',
          enabled: true,
          config: {
            defaultPrivacy: 'members',
          },
        },
      ],
    },
    {
      id: 'newsletters',
      name: 'Newsletters',
      description: 'Send email newsletters to supporters and donors',
      icon: '📨',
      modules: [{ moduleId: 'newsletters', enabled: true }],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General team discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'fundraising',
      description: 'Fundraising strategy and campaigns',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'programs',
      description: 'Program coordination and updates',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'volunteers',
      description: 'Volunteer coordination and scheduling',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'board',
      description: 'Board member discussions',
      type: 'chat',
      privacy: 'admin',
    },
    {
      name: 'announcements',
      description: 'Organization-wide announcements',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Board Member',
      description: 'Board of directors member',
      color: '#1D4ED8',
      permissions: ['invite_members', 'create_events', 'create_proposals', 'manage_events'],
    },
    {
      name: 'Staff',
      description: 'Paid staff member',
      color: '#059669',
      permissions: ['invite_members', 'create_events', 'create_proposals'],
    },
    {
      name: 'Volunteer Coordinator',
      description: 'Manages volunteer recruitment and scheduling',
      color: '#7C3AED',
      permissions: ['invite_members', 'create_events'],
    },
    {
      name: 'Volunteer',
      description: 'Active volunteer',
      color: '#6B7280',
      permissions: [],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample contacts, donations, campaigns, volunteer event, and board meeting',
    seeds: ['crm-nonprofit-demo', 'events-nonprofit-demo', 'fundraising-demo'],
  },

  defaultSettings: {
    discoverable: true, // Nonprofits want visibility
    requireApproval: true, // But control membership
    allowInvites: true,
  },

  i18nKey: 'templates.nonprofitOrg',
};

export default NONPROFIT_ORG_TEMPLATE;
