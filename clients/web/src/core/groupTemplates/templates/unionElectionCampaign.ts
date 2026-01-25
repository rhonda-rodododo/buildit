/**
 * Union Election Campaign Template
 *
 * Template for union organizing drives and NLRB election campaigns.
 * Focused on pre-recognition organizing: tracking workers, house visits,
 * authorization cards, and documenting employer anti-union activity.
 *
 * Different from Union Chapter which is for established unions.
 */

import type { GroupTemplate } from '../types';

export const UNION_ELECTION_CAMPAIGN_TEMPLATE: GroupTemplate = {
  id: 'union-election-campaign',
  name: 'Union Election Campaign',
  description:
    'Organize a union election campaign with worker tracking, house visits, authorization cards, and NLRB coordination. For pre-recognition organizing drives.',
  icon: '🗳️',
  category: 'organizing',
  complexity: 4,
  tags: ['labor', 'union', 'organizing', 'nlrb', 'election', 'workers', 'campaign'],
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
      subTemplate: 'union-election-campaign',
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
        allowPublicEvents: false, // Keep organizing private
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'files',
      enabled: true,
      config: {
        // For storing signed cards, evidence documents
        maxFileSize: 50 * 1024 * 1024, // 50MB
      },
    },
    {
      moduleId: 'governance',
      enabled: true,
      config: {
        defaultVotingSystem: 'simple-majority',
        anonymousVoting: true,
        quorumRequired: false, // Organizing committee may be small
      },
    },
  ],

  enhancements: [
    {
      id: 'wiki',
      name: 'Knowledge Base',
      description: 'Document NLRB rules, anti-union tactics, and organizing resources',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for planning and ULP documentation',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'public-presence',
      name: 'Public Campaign',
      description: 'Add public pages for worker outreach (use with caution)',
      icon: '📢',
      modules: [
        { moduleId: 'public', enabled: true },
        { moduleId: 'microblogging', enabled: true },
      ],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General organizing discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'organizing-committee',
      description: 'OC-only strategy and planning',
      type: 'chat',
      privacy: 'admin',
    },
    {
      name: 'house-visits',
      description: 'Coordinate and debrief house visits',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'cards',
      description: 'Authorization card collection coordination',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'ulp-tracking',
      description: 'Document employer anti-union activity',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'announcements',
      description: 'Campaign announcements and updates',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Lead Organizer',
      description: 'Campaign lead with full permissions',
      color: '#DC2626',
      permissions: [
        'manage_members',
        'invite_members',
        'create_events',
        'manage_events',
        'create_proposals',
        'manage_crm',
      ],
    },
    {
      name: 'Organizer',
      description: 'Staff or volunteer organizer',
      color: '#EA580C',
      permissions: ['invite_members', 'create_events', 'create_proposals', 'manage_crm'],
    },
    {
      name: 'OC Member',
      description: 'Organizing Committee member (worker leader)',
      color: '#16A34A',
      permissions: ['invite_members', 'create_events'],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample workers, house visit records, authorization cards, and campaign milestones',
    seeds: ['crm-union-election-demo', 'events-meeting-demo'],
  },

  defaultSettings: {
    discoverable: false, // Keep campaign private
    requireApproval: true, // Careful membership vetting
    allowInvites: true, // OC can invite trusted workers
  },

  i18nKey: 'templates.unionElectionCampaign',
};

export default UNION_ELECTION_CAMPAIGN_TEMPLATE;
