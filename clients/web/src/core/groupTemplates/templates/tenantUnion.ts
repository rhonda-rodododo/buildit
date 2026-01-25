/**
 * Tenant Union Template
 *
 * Template for tenant unions, tenant organizing, and housing rights groups.
 * Includes tenant tracking, building organizing, case management,
 * and action coordination.
 */

import type { GroupTemplate } from '../types';

export const TENANT_UNION_TEMPLATE: GroupTemplate = {
  id: 'tenant-union',
  name: 'Tenant Union',
  description:
    'Organize tenants for housing rights with building tracking, case management, and action coordination. Built for tenant unions and housing organizers.',
  icon: '🏠',
  category: 'organizing',
  complexity: 4,
  tags: ['housing', 'tenants', 'rent', 'landlord', 'organizing', 'eviction', 'union'],
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
      subTemplate: 'tenant-organizing',
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
        allowPublicEvents: true, // Tenant actions can be public
        requireRSVPApproval: false,
      },
    },
    {
      moduleId: 'governance',
      enabled: true,
      config: {
        defaultVotingSystem: 'simple-majority',
        quorumRequired: true,
        quorumPercentage: 25,
        anonymousVoting: false,
      },
    },
  ],

  enhancements: [
    {
      id: 'public-presence',
      name: 'Public Presence',
      description: 'Add public pages for tenant resources and how to join',
      icon: '📢',
      modules: [
        { moduleId: 'public', enabled: true },
        { moduleId: 'microblogging', enabled: true },
      ],
    },
    {
      id: 'wiki',
      name: 'Tenant Resources',
      description: 'Document tenant rights, resources, and how-to guides',
      icon: '📚',
      modules: [{ moduleId: 'wiki', enabled: true }],
    },
    {
      id: 'documents',
      name: 'Document Suite',
      description: 'Templates for demand letters, lease reviews, and meeting notes',
      icon: '📝',
      modules: [{ moduleId: 'documents', enabled: true }],
    },
    {
      id: 'files',
      name: 'File Storage',
      description: 'Store evidence photos, lease documents, and court filings',
      icon: '📁',
      modules: [
        {
          moduleId: 'files',
          enabled: true,
          config: {
            defaultPrivacy: 'private',
          },
        },
      ],
    },
    {
      id: 'fundraising',
      name: 'Fundraising',
      description: 'Add emergency rent fund and legal defense fundraising',
      icon: '💰',
      modules: [{ moduleId: 'fundraising', enabled: true }],
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
      description: 'Organizing strategy and building campaigns',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'cases',
      description: 'Active tenant cases and legal support',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'actions',
      description: 'Coordinate direct actions and building actions',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'leadership',
      description: 'Organizer and leadership discussions',
      type: 'chat',
      privacy: 'admin',
    },
    {
      name: 'announcements',
      description: 'Important announcements for all members',
      type: 'announcement',
      privacy: 'members',
    },
  ],

  defaultRoles: [
    {
      name: 'Lead Tenant',
      description: 'Building lead who organizes their building',
      color: '#DC2626',
      permissions: ['invite_members', 'create_events', 'create_proposals'],
    },
    {
      name: 'Organizer',
      description: 'Staff or experienced organizer',
      color: '#7C3AED',
      permissions: ['invite_members', 'create_events', 'create_proposals', 'manage_events'],
    },
    {
      name: 'Legal Support',
      description: 'Attorney or paralegal providing legal support',
      color: '#1D4ED8',
      permissions: ['create_events'],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample tenants, buildings, cases, organizers, and a tenant meeting event',
    seeds: ['crm-tenant-demo', 'events-tenant-demo'],
  },

  defaultSettings: {
    discoverable: true, // Tenant unions often want to be found
    requireApproval: true, // But still vet members
    allowInvites: true,
  },

  i18nKey: 'templates.tenantUnion',
};

export default TENANT_UNION_TEMPLATE;
