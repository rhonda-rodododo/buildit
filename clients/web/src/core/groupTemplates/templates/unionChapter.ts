/**
 * Union Chapter Template
 *
 * Full-featured template for labor unions and worker organizing.
 * Includes governance, CRM for organizing contacts, and event coordination.
 */

import type { GroupTemplate } from '../types';

export const UNION_CHAPTER_TEMPLATE: GroupTemplate = {
  id: 'union-chapter',
  name: 'Union Chapter',
  description: 'Organize workers with voting, events, and contact management. Built for labor unions and workplace organizing.',
  icon: '✊',
  category: 'organizing',
  complexity: 4,
  tags: ['labor', 'workers', 'organizing', 'union', 'workplace'],
  defaultPrivacy: 'private',

  modules: [
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
    {
      moduleId: 'governance',
      enabled: true,
      required: true,
      config: {
        defaultVotingSystem: 'simple-majority',
        quorumRequired: true,
        quorumPercentage: 50,
        anonymousVoting: true,
      },
    },
    {
      moduleId: 'events',
      enabled: true,
      config: {
        allowPublicEvents: false, // Union events are typically private
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'crm',
      enabled: true,
      subTemplate: 'union-organizing',
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

  enhancements: [
    {
      id: 'public-presence',
      name: 'Public Presence',
      description: 'Add public pages and microblogging for outreach',
      icon: '📢',
      modules: [
        { moduleId: 'public', enabled: true },
        { moduleId: 'microblogging', enabled: true },
      ],
    },
    {
      id: 'fundraising',
      name: 'Fundraising',
      description: 'Add fundraising tools and donor management',
      icon: '💰',
      modules: [
        { moduleId: 'fundraising', enabled: true },
      ],
    },
    {
      id: 'wiki',
      name: 'Knowledge Base',
      description: 'Document contracts, grievance procedures, and resources',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for meeting minutes and contracts',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General union discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'organizing',
      description: 'Organizing campaigns and strategy',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'grievances',
      description: 'Discuss workplace grievances (sensitive)',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'leadership',
      description: 'Union leadership discussions',
      type: 'chat',
      privacy: 'admin',
    },
    {
      name: 'announcements',
      description: 'Official union announcements',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Steward',
      description: 'Shop steward with organizing responsibilities',
      color: '#3B82F6',
      permissions: ['invite_members', 'create_events', 'create_proposals'],
    },
    {
      name: 'Organizer',
      description: 'Lead organizer with expanded permissions',
      color: '#8B5CF6',
      permissions: ['invite_members', 'create_events', 'create_proposals', 'manage_events'],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description: 'Includes sample organizing contacts, a contract vote proposal, and a union meeting event',
    seeds: ['crm-union-demo', 'governance-demo', 'events-meeting-demo'],
  },

  defaultSettings: {
    discoverable: false, // Unions often need to be private
    requireApproval: true, // Careful membership vetting
    allowInvites: true,
  },

  i18nKey: 'templates.unionChapter',
};

export default UNION_CHAPTER_TEMPLATE;
