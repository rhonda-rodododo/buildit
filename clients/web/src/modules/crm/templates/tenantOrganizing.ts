/**
 * Tenant Organizing CRM Template
 * For tenant unions and housing rights organizations
 *
 * Tables:
 * - Tenants: Individual tenants being organized
 * - Buildings: Properties being organized
 * - Cases: Repair issues, evictions, rent increases
 * - Organizers: Staff and volunteer organizers
 * - Actions: Collective actions and campaigns
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const tenantOrganizingTemplate: CRMMultiTableTemplate = {
  id: 'tenant-organizing',
  name: 'Tenant Organizing',
  description:
    'Track tenants, buildings, cases, and organizing campaigns for tenant unions',
  icon: '🏠',
  category: 'tenant',
  version: '1.0.0',
  author: 'BuildIt Network',

  integrations: {
    events: true,
    files: true,
    messaging: true,
    forms: true,
  },

  tables: [
    {
      key: 'tenants',
      name: 'Tenants',
      description: 'Individual tenants being organized',
      icon: '👤',
      isPrimary: true,
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 2,
        },
        {
          name: 'unit',
          label: 'Unit Number',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Apt/Unit number' },
          order: 3,
        },
        {
          name: 'move_in_date',
          label: 'Move-in Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 4,
        },
        {
          name: 'lease_end',
          label: 'Lease End Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 5,
        },
        {
          name: 'rent_amount',
          label: 'Monthly Rent',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0.00' },
          order: 6,
        },
        {
          name: 'support_level',
          label: 'Support Level',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'unknown', label: 'Unknown' },
              { value: 'strongly_supportive', label: 'Strongly Supportive' },
              { value: 'supportive', label: 'Supportive' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'opposed', label: 'Opposed' },
              { value: 'hostile', label: 'Hostile' },
            ],
          },
          order: 7,
        },
        {
          name: 'languages',
          label: 'Languages',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'english', label: 'English' },
              { value: 'spanish', label: 'Spanish' },
              { value: 'chinese', label: 'Chinese' },
              { value: 'russian', label: 'Russian' },
              { value: 'korean', label: 'Korean' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 8,
        },
        {
          name: 'issues',
          label: 'Current Issues',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'repairs', label: 'Repairs Needed' },
              { value: 'rent_increase', label: 'Rent Increase' },
              { value: 'eviction_threat', label: 'Eviction Threat' },
              { value: 'harassment', label: 'Landlord Harassment' },
              { value: 'utilities', label: 'Utility Issues' },
              { value: 'pests', label: 'Pest Infestation' },
              { value: 'mold', label: 'Mold' },
              { value: 'heat', label: 'Heat/Hot Water' },
              { value: 'safety', label: 'Safety Issues' },
            ],
          },
          order: 9,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          order: 10,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 11,
        },
      ],
      defaultViews: [
        {
          name: 'All Tenants',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'unit',
              'support_level',
              'issues',
              'phone',
            ],
          },
        },
        {
          name: 'By Support Level',
          type: 'board',
          config: {
            boardGroupBy: 'support_level',
            boardCardTitleField: 'full_name',
            boardCardFields: ['unit', 'issues'],
          },
        },
        {
          name: 'With Issues',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'unit', 'issues', 'phone'],
          },
          filters: [{ fieldName: 'issues', operator: 'is-not-empty', value: null }],
        },
      ],
    },
    {
      key: 'buildings',
      name: 'Buildings',
      description: 'Properties being organized',
      icon: '🏢',
      fields: [
        {
          name: 'address',
          label: 'Address',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Full street address' },
          order: 0,
        },
        {
          name: 'landlord',
          label: 'Landlord',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Landlord name' },
          order: 1,
        },
        {
          name: 'management_company',
          label: 'Management Company',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Property management company' },
          order: 2,
        },
        {
          name: 'total_units',
          label: 'Total Units',
          schema: { type: 'number', minimum: 1 },
          widget: { widget: 'number', placeholder: '0' },
          order: 3,
        },
        {
          name: 'organized_units',
          label: 'Organized Units',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 4,
        },
        {
          name: 'building_status',
          label: 'Building Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'prospecting', label: 'Prospecting' },
              { value: 'initial_contact', label: 'Initial Contact' },
              { value: 'organizing', label: 'Organizing' },
              { value: 'association_formed', label: 'Association Formed' },
              { value: 'negotiating', label: 'Negotiating' },
              { value: 'campaign_active', label: 'Campaign Active' },
              { value: 'win', label: 'Victory' },
              { value: 'dormant', label: 'Dormant' },
            ],
          },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Buildings',
          type: 'table',
          config: {
            visibleFields: [
              'address',
              'landlord',
              'total_units',
              'organized_units',
              'building_status',
            ],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'building_status',
            boardCardTitleField: 'address',
            boardCardFields: ['landlord', 'organized_units', 'total_units'],
          },
        },
      ],
    },
    {
      key: 'cases',
      name: 'Cases',
      description: 'Repair issues, evictions, rent increases',
      icon: '📋',
      fields: [
        {
          name: 'case_type',
          label: 'Case Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'repair', label: 'Repair Request' },
              { value: 'harassment', label: 'Landlord Harassment' },
              { value: 'eviction', label: 'Eviction' },
              { value: 'rent_increase', label: 'Rent Increase' },
              { value: 'lease_dispute', label: 'Lease Dispute' },
              { value: 'retaliation', label: 'Retaliation' },
              { value: 'discrimination', label: 'Discrimination' },
            ],
          },
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.status,
          widget: {
            widget: 'select',
            options: [
              { value: 'open', label: 'Open' },
              { value: 'documenting', label: 'Documenting' },
              { value: 'filed', label: 'Filed' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'escalated', label: 'Escalated' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          order: 1,
        },
        {
          name: 'filed_date',
          label: 'Date Filed',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 2,
        },
        {
          name: 'agency',
          label: 'Agency/Court',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'HPD, Housing Court, etc.' },
          order: 3,
        },
        {
          name: 'case_number',
          label: 'Case Number',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Agency case number' },
          order: 4,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Describe the issue' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Cases',
          type: 'table',
          config: {
            visibleFields: ['case_type', 'status', 'filed_date', 'agency'],
          },
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'case_type',
            boardCardTitleField: 'description',
            boardCardFields: ['status', 'filed_date'],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'case_type',
            boardCardFields: ['description', 'filed_date'],
          },
        },
      ],
    },
    {
      key: 'organizers',
      name: 'Organizers',
      description: 'Staff and volunteer organizers',
      icon: '✊',
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          label: 'Nostr Profile',
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 2,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 3,
        },
        {
          name: 'role',
          label: 'Role',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'staff', label: 'Staff Organizer' },
              { value: 'volunteer', label: 'Volunteer' },
              { value: 'tenant_leader', label: 'Tenant Leader' },
              { value: 'intern', label: 'Intern' },
            ],
          },
          order: 4,
        },
        {
          name: 'active',
          label: 'Active',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'languages',
          label: 'Languages',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'english', label: 'English' },
              { value: 'spanish', label: 'Spanish' },
              { value: 'chinese', label: 'Chinese' },
              { value: 'russian', label: 'Russian' },
              { value: 'korean', label: 'Korean' },
            ],
          },
          order: 6,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 7,
        },
      ],
      defaultViews: [
        {
          name: 'All Organizers',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'role', 'active', 'phone', 'languages'],
          },
        },
        {
          name: 'Active',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'role', 'phone', 'languages'],
          },
          filters: [{ fieldName: 'active', operator: 'equals', value: true }],
        },
      ],
    },
    {
      key: 'actions',
      name: 'Actions',
      description: 'Collective actions and campaigns',
      icon: '🎯',
      fields: [
        {
          name: 'action_type',
          label: 'Action Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'meeting', label: 'Building Meeting' },
              { value: 'rally', label: 'Rally' },
              { value: 'march', label: 'March' },
              { value: 'petition', label: 'Petition Delivery' },
              { value: 'press_conference', label: 'Press Conference' },
              { value: 'hearing', label: 'Public Hearing' },
              { value: 'direct_action', label: 'Direct Action' },
              { value: 'canvass', label: 'Door Canvass' },
            ],
          },
          order: 0,
        },
        {
          name: 'date',
          label: 'Date',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 1,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Action details' },
          order: 2,
        },
        {
          name: 'turnout',
          label: 'Turnout',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 3,
        },
        {
          name: 'outcome',
          label: 'Outcome',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'planned', label: 'Planned' },
              { value: 'success', label: 'Success' },
              { value: 'partial', label: 'Partial Success' },
              { value: 'setback', label: 'Setback' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          order: 4,
        },
        {
          name: 'next_steps',
          label: 'Next Steps',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Follow-up actions needed' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Actions',
          type: 'table',
          config: {
            visibleFields: ['date', 'action_type', 'description', 'turnout', 'outcome'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'action_type',
          },
        },
        {
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: ['date', 'action_type', 'description'],
          },
          filters: [{ fieldName: 'outcome', operator: 'equals', value: 'planned' }],
          sorts: [{ fieldName: 'date', direction: 'asc' }],
        },
      ],
    },
  ],

  relationships: [
    // Tenant -> Building
    {
      sourceTable: 'tenants',
      sourceField: 'building_id',
      targetTable: 'buildings',
      targetField: 'address',
      type: 'many-to-one',
      label: 'Building',
      required: false,
      onDelete: 'set-null',
    },
    // Tenant -> Organizer (assigned)
    {
      sourceTable: 'tenants',
      sourceField: 'organizer_id',
      targetTable: 'organizers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Assigned Organizer',
      required: false,
      onDelete: 'set-null',
    },
    // Building -> Tenant (lead tenant)
    {
      sourceTable: 'buildings',
      sourceField: 'lead_tenant',
      targetTable: 'tenants',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Lead Tenant',
      required: false,
      onDelete: 'set-null',
    },
    // Case -> Tenant
    {
      sourceTable: 'cases',
      sourceField: 'tenant_id',
      targetTable: 'tenants',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Tenant',
      required: false,
      onDelete: 'set-null',
    },
    // Case -> Building
    {
      sourceTable: 'cases',
      sourceField: 'building_id',
      targetTable: 'buildings',
      targetField: 'address',
      type: 'many-to-one',
      label: 'Building',
      required: false,
      onDelete: 'set-null',
    },
    // Case -> Organizer (assigned lawyer/advocate)
    {
      sourceTable: 'cases',
      sourceField: 'lawyer_id',
      targetTable: 'organizers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Assigned Advocate',
      required: false,
      onDelete: 'set-null',
    },
    // Action -> Building
    {
      sourceTable: 'actions',
      sourceField: 'building_id',
      targetTable: 'buildings',
      targetField: 'address',
      type: 'many-to-one',
      label: 'Building',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'organizers',
        records: [
          {
            full_name: 'Maria Garcia',
            phone: '555-0201',
            email: 'mgarcia@tenantunion.org',
            role: 'staff',
            active: true,
            languages: ['english', 'spanish'],
          },
          {
            full_name: 'James Wilson',
            phone: '555-0202',
            email: 'jwilson@tenantunion.org',
            role: 'staff',
            active: true,
            languages: ['english'],
          },
        ],
      },
    ],
  },
};
