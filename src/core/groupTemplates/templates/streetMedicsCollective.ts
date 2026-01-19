/**
 * Street Medics Collective Template
 *
 * Template for organizing and mobilizing street medics for protests,
 * community events, and direct actions. Includes training coordination,
 * deployment scheduling, and supply inventory management.
 */

import type { GroupTemplate } from '../types';

export const STREET_MEDICS_COLLECTIVE_TEMPLATE: GroupTemplate = {
  id: 'street-medics-collective',
  name: 'Street Medics Collective',
  description:
    'Train and mobilize street medics for protests and community events. Track certifications, coordinate deployments, and manage medical supplies.',
  icon: '🏥',
  category: 'movement-defense',
  complexity: 4,
  tags: [
    'medics',
    'street-medic',
    'first-aid',
    'protest',
    'direct-action',
    'training',
    'health',
    'community-care',
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
      subTemplate: 'street-medics',
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
        allowPublicEvents: false, // Medic deployments are typically private
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
        defaultCategories: ['Medical Protocols', 'Know Your Rights', 'Safety', 'Training'],
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
      description: 'Collaborative documents for protocols, training materials, and debriefs',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'hotlines',
      name: 'Medical Dispatch',
      description: 'Add dispatch hotline for emergency medical coordination',
      icon: '📞',
      modules: [
        {
          moduleId: 'hotlines',
          enabled: true,
          config: {
            defaultType: 'dispatch',
            preCreateHotlines: [{ name: 'Medic Dispatch', type: 'dispatch' }],
          },
        },
      ],
    },
    {
      id: 'fundraising',
      name: 'Supply Fund',
      description: 'Track donations for medical supplies and equipment',
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
      name: 'supply-coordination',
      description: 'Medical supply inventory and needs',
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
      name: 'Lead Medic',
      description: 'Experienced medic with leadership responsibilities',
      color: '#DC2626',
      permissions: ['invite_members', 'create_events', 'manage_events', 'create_proposals'],
    },
    {
      name: 'Trainer',
      description: 'Certified to train new medics',
      color: '#7C3AED',
      permissions: ['invite_members', 'create_events', 'manage_events'],
    },
    {
      name: 'Street Medic',
      description: 'Trained street medic ready for deployment',
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
      'Includes sample medics, training sessions, upcoming deployments, and supply inventory',
    seeds: ['crm-street-medics-demo'],
  },

  defaultSettings: {
    discoverable: false, // Medic operations require privacy
    requireApproval: true, // Verify training/experience
    allowInvites: true,
  },

  i18nKey: 'templates.streetMedicsCollective',
};

export default STREET_MEDICS_COLLECTIVE_TEMPLATE;
