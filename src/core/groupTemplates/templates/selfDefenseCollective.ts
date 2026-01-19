/**
 * Community Self-Defense Collective Template
 *
 * Template for training and mobilizing safety marshals and de-escalation
 * teams for demonstrations and community events. Includes volunteer tracking,
 * training coordination, deployment scheduling, and incident documentation.
 */

import type { GroupTemplate } from '../types';

export const SELF_DEFENSE_COLLECTIVE_TEMPLATE: GroupTemplate = {
  id: 'self-defense-collective',
  name: 'Community Self-Defense Collective',
  description:
    'Train and coordinate safety marshals and de-escalation teams for demonstrations and community events. Track volunteers, manage trainings, and document incidents.',
  icon: '🛡️',
  category: 'movement-defense',
  complexity: 4,
  tags: [
    'security',
    'safety',
    'self-defense',
    'de-escalation',
    'marshal',
    'protest',
    'direct-action',
    'training',
    'community-safety',
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
      subTemplate: 'self-defense',
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
      required: true,
      config: {
        allowPublicEvents: false, // Security operations are private
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'files',
      enabled: true,
      config: {
        defaultPrivacy: 'members',
        allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png', 'mp4'],
      },
    },
    {
      moduleId: 'wiki',
      enabled: true,
      config: {
        defaultCategories: [
          'De-escalation Protocols',
          'Know Your Rights',
          'Safety Guidelines',
          'Training Materials',
        ],
      },
    },
  ],

  enhancements: [
    {
      id: 'governance',
      name: 'Collective Governance',
      description: 'Add proposals and voting for collective decisions',
      icon: '🗳️',
      modules: [{ moduleId: 'governance', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description:
        'Collaborative documents for protocols, incident reports, and training materials',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'hotlines',
      name: 'Security Dispatch',
      description: 'Add dispatch hotline for security coordination',
      icon: '📞',
      modules: [
        {
          moduleId: 'hotlines',
          enabled: true,
          config: {
            defaultType: 'dispatch',
            preCreateHotlines: [{ name: 'Security Dispatch', type: 'dispatch' }],
          },
        },
      ],
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
      name: 'trainings',
      description: 'Training announcements and coordination',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'deployments',
      description: 'Deployment coordination and signups',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'coordination',
      description: 'Real-time coordination during events',
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
      name: 'announcements',
      description: 'Important announcements',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Lead Coordinator',
      description: 'Experienced coordinator with leadership responsibilities',
      color: '#DC2626',
      permissions: ['invite_members', 'create_events', 'manage_events', 'create_proposals'],
    },
    {
      name: 'Trainer',
      description: 'Certified to train new volunteers',
      color: '#7C3AED',
      permissions: ['invite_members', 'create_events', 'manage_events'],
    },
    {
      name: 'Safety Marshal',
      description: 'Trained safety marshal ready for deployment',
      color: '#059669',
      permissions: ['create_events'],
    },
    {
      name: 'Trainee',
      description: 'Currently in training',
      color: '#6B7280',
      permissions: [],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample volunteers, training sessions, upcoming deployments, and incident records',
    seeds: ['crm-self-defense-demo'],
  },

  defaultSettings: {
    discoverable: false, // Security operations require privacy
    requireApproval: true, // Verify trust/training
    allowInvites: true,
  },

  i18nKey: 'templates.selfDefenseCollective',
};

export default SELF_DEFENSE_COLLECTIVE_TEMPLATE;
