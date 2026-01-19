/**
 * Movement Legal Defense Collective Template
 *
 * Comprehensive template for movement legal defense, legal observers,
 * mass defense coordination, jail support, and NLG-style legal support networks.
 * Includes case management, court calendars, lawyer coordination, and hotlines.
 */

import type { GroupTemplate } from '../types';

export const MOVEMENT_LEGAL_DEFENSE_TEMPLATE: GroupTemplate = {
  id: 'movement-legal-defense',
  name: 'Movement Legal Defense Collective',
  description:
    'Full-featured mass defense coordination with case management, court calendars, lawyer coordination, and jail support hotlines. Built for NLG-style legal observers and legal defense networks.',
  icon: '⚖️',
  category: 'movement-defense',
  complexity: 5,
  tags: [
    'legal',
    'legal-defense',
    'mass-defense',
    'nlg',
    'court',
    'lawyers',
    'legal-observers',
    'civil-rights',
    'jail-support',
    'hotline',
  ],
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
      subTemplate: 'nlg-mass-defense',
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
      moduleId: 'hotlines',
      enabled: true,
      required: true,
      config: {
        defaultType: 'jail-support',
        preCreateHotlines: [{ name: 'Jail Support Hotline', type: 'jail-support' }],
      },
    },
    {
      moduleId: 'events',
      enabled: true,
      config: {
        allowPublicEvents: false, // Legal matters are typically private
        requireRSVPApproval: true,
      },
    },
    {
      moduleId: 'files',
      enabled: true,
      config: {
        defaultPrivacy: 'private',
        allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png', 'mp3', 'mp4'],
      },
    },
    {
      moduleId: 'governance',
      enabled: true,
      config: {
        defaultVotingSystem: 'simple-majority',
        quorumRequired: false,
        anonymousVoting: true,
      },
    },
  ],

  enhancements: [
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Collaborative documents for legal briefs, templates, and case notes',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'wiki',
      name: 'Knowledge Base',
      description: 'Document know-your-rights guides, legal procedures, and resources',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'public-presence',
      name: 'Public Resources',
      description: 'Add public pages for know-your-rights info and how to get help',
      icon: '📢',
      modules: [
        { moduleId: 'public', enabled: true },
        { moduleId: 'microblogging', enabled: true },
      ],
    },
    {
      id: 'fundraising',
      name: 'Bail Fund & Donations',
      description: 'Add bail fund management and donation tracking',
      icon: '💰',
      modules: [{ moduleId: 'fundraising', enabled: true }],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'intake',
      description: 'New cases and intake coordination',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'cases',
      description: 'Active case discussions',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'legal-observers',
      description: 'Legal observer coordination and reports',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'jail-support',
      description: 'Jail support hotline coordination',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'urgent',
      description: 'Urgent matters requiring immediate attention',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'lawyers',
      description: 'Attorney-only discussions (privileged)',
      type: 'chat',
      privacy: 'admin',
    },
    {
      name: 'announcements',
      description: 'Important announcements',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Attorney',
      description: 'Licensed attorney providing legal representation',
      color: '#1D4ED8',
      permissions: ['invite_members', 'create_events', 'create_proposals', 'manage_events'],
    },
    {
      name: 'Legal Observer',
      description: 'Trained legal observer for protests and actions',
      color: '#059669',
      permissions: ['invite_members', 'create_events'],
    },
    {
      name: 'Intake Coordinator',
      description: 'Handles intake and case assignment',
      color: '#7C3AED',
      permissions: ['invite_members', 'create_events', 'create_proposals'],
    },
    {
      name: 'Hotline Operator',
      description: 'Operates jail support hotline',
      color: '#DC2626',
      permissions: ['create_events'],
    },
    {
      name: 'Volunteer',
      description: 'General volunteer support',
      color: '#6B7280',
      permissions: [],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample arrestees, cases, lawyers, court dates, and an upcoming court support event',
    seeds: ['crm-nlg-demo', 'events-court-demo'],
  },

  defaultSettings: {
    discoverable: false, // Legal matters require privacy
    requireApproval: true, // Careful vetting of members
    allowInvites: true,
  },

  i18nKey: 'templates.movementLegalDefense',
};

export default MOVEMENT_LEGAL_DEFENSE_TEMPLATE;
