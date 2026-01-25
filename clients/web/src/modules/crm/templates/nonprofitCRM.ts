/**
 * Nonprofit CRM Template
 * For nonprofit organizations managing donors, volunteers, and campaigns
 *
 * Tables:
 * - Contacts: All organizational contacts
 * - Donations: Financial contributions
 * - Campaigns: Fundraising campaigns
 * - Communications: Outreach and follow-up tracking
 * - Tags: Organization and categorization
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const nonprofitCRMTemplate: CRMMultiTableTemplate = {
  id: 'nonprofit-crm',
  name: 'Nonprofit CRM',
  description:
    'Manage donors, volunteers, campaigns, and communications for nonprofit organizations',
  icon: '💝',
  category: 'nonprofit',
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
      key: 'contacts',
      name: 'Contacts',
      description: 'All organizational contacts',
      icon: '👥',
      isPrimary: true,
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 2,
        },
        {
          name: 'organization',
          label: 'Organization',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Company/Organization' },
          order: 3,
        },
        {
          name: 'title',
          label: 'Title',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Job title' },
          order: 4,
        },
        {
          name: 'contact_type',
          label: 'Contact Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'individual', label: 'Individual' },
              { value: 'major_donor', label: 'Major Donor' },
              { value: 'foundation', label: 'Foundation' },
              { value: 'corporate', label: 'Corporate' },
              { value: 'government', label: 'Government' },
              { value: 'media', label: 'Media' },
              { value: 'partner', label: 'Partner Org' },
            ],
          },
          order: 5,
        },
        {
          name: 'donor_status',
          label: 'Donor Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'prospect', label: 'Prospect' },
              { value: 'first_time', label: 'First-Time Donor' },
              { value: 'repeat', label: 'Repeat Donor' },
              { value: 'major', label: 'Major Donor' },
              { value: 'lapsed', label: 'Lapsed' },
              { value: 'non_donor', label: 'Non-Donor' },
            ],
          },
          order: 6,
        },
        {
          name: 'volunteer_status',
          label: 'Volunteer Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'none', label: 'Not a Volunteer' },
              { value: 'prospect', label: 'Volunteer Prospect' },
              { value: 'active', label: 'Active Volunteer' },
              { value: 'inactive', label: 'Inactive Volunteer' },
              { value: 'board', label: 'Board Member' },
            ],
          },
          order: 7,
        },
        {
          name: 'address',
          label: 'Address',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Mailing address' },
          order: 8,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          order: 9,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 10,
        },
      ],
      defaultViews: [
        {
          name: 'All Contacts',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'email',
              'organization',
              'contact_type',
              'donor_status',
            ],
          },
        },
        {
          name: 'Donors',
          type: 'board',
          config: {
            boardGroupBy: 'donor_status',
            boardCardTitleField: 'full_name',
            boardCardFields: ['organization', 'email'],
          },
        },
        {
          name: 'Volunteers',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'phone', 'email', 'volunteer_status'],
          },
          filters: [{ fieldName: 'volunteer_status', operator: 'not-equals', value: 'none' }],
        },
        {
          name: 'Major Donors',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'organization', 'email', 'phone'],
          },
          filters: [{ fieldName: 'donor_status', operator: 'equals', value: 'major' }],
        },
      ],
    },
    {
      key: 'donations',
      name: 'Donations',
      description: 'Financial contributions',
      icon: '💰',
      fields: [
        {
          ...CRM_FIELD_PRESETS.amount,
          schema: { type: 'number', minimum: 0, required: true },
          order: 0,
        },
        {
          name: 'date',
          label: 'Date',
          schema: { type: 'string', format: 'date', required: true },
          widget: { widget: 'date' },
          order: 1,
        },
        {
          name: 'payment_method',
          label: 'Payment Method',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'check', label: 'Check' },
              { value: 'credit_card', label: 'Credit Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cash', label: 'Cash' },
              { value: 'stock', label: 'Stock' },
              { value: 'crypto', label: 'Cryptocurrency' },
              { value: 'in_kind', label: 'In-Kind' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 2,
        },
        {
          name: 'recurring',
          label: 'Recurring',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 3,
        },
        {
          name: 'recurring_frequency',
          label: 'Frequency',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
            ],
          },
          order: 4,
        },
        {
          name: 'acknowledged',
          label: 'Acknowledged',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'acknowledgment_date',
          label: 'Acknowledgment Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          name: 'designation',
          label: 'Designation',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'unrestricted', label: 'Unrestricted' },
              { value: 'program', label: 'Program Specific' },
              { value: 'endowment', label: 'Endowment' },
              { value: 'capital', label: 'Capital Campaign' },
            ],
          },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Donations',
          type: 'table',
          config: {
            visibleFields: ['date', 'amount', 'payment_method', 'recurring', 'acknowledged'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Pending Acknowledgment',
          type: 'table',
          config: {
            visibleFields: ['date', 'amount', 'payment_method'],
          },
          filters: [{ fieldName: 'acknowledged', operator: 'equals', value: false }],
        },
        {
          name: 'Recurring',
          type: 'table',
          config: {
            visibleFields: ['amount', 'recurring_frequency', 'date'],
          },
          filters: [{ fieldName: 'recurring', operator: 'equals', value: true }],
        },
      ],
    },
    {
      key: 'campaigns',
      name: 'Campaigns',
      description: 'Fundraising campaigns',
      icon: '🎯',
      fields: [
        {
          name: 'name',
          label: 'Campaign Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Campaign name' },
          order: 0,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Campaign description' },
          order: 1,
        },
        {
          name: 'goal',
          label: 'Goal',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0.00' },
          order: 2,
        },
        {
          name: 'raised',
          label: 'Raised',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0.00' },
          order: 3,
        },
        {
          name: 'start_date',
          label: 'Start Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 4,
        },
        {
          name: 'end_date',
          label: 'End Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.status,
          widget: {
            widget: 'select',
            options: [
              { value: 'planning', label: 'Planning' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'exceeded', label: 'Goal Exceeded' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          order: 6,
        },
        {
          name: 'campaign_type',
          label: 'Campaign Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'annual', label: 'Annual Fund' },
              { value: 'capital', label: 'Capital Campaign' },
              { value: 'event', label: 'Event-Based' },
              { value: 'emergency', label: 'Emergency Appeal' },
              { value: 'matching', label: 'Matching Gift' },
              { value: 'crowdfunding', label: 'Crowdfunding' },
            ],
          },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Campaigns',
          type: 'table',
          config: {
            visibleFields: ['name', 'goal', 'raised', 'status', 'end_date'],
          },
        },
        {
          name: 'Active Campaigns',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'name',
            boardCardFields: ['goal', 'raised'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'active' }],
        },
      ],
    },
    {
      key: 'communications',
      name: 'Communications',
      description: 'Outreach and follow-up tracking',
      icon: '📧',
      fields: [
        {
          name: 'type',
          label: 'Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'Phone Call' },
              { value: 'meeting', label: 'Meeting' },
              { value: 'letter', label: 'Letter' },
              { value: 'text', label: 'Text Message' },
              { value: 'event', label: 'Event Attendance' },
              { value: 'social', label: 'Social Media' },
            ],
          },
          order: 0,
        },
        {
          name: 'direction',
          label: 'Direction',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'outbound', label: 'Outbound' },
              { value: 'inbound', label: 'Inbound' },
            ],
          },
          order: 1,
        },
        {
          name: 'date',
          label: 'Date',
          schema: { type: 'string', format: 'date', required: true },
          widget: { widget: 'date' },
          order: 2,
        },
        {
          name: 'subject',
          label: 'Subject',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Subject or topic' },
          order: 3,
        },
        {
          name: 'content',
          label: 'Content/Notes',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Summary of communication' },
          order: 4,
        },
        {
          name: 'follow_up',
          label: 'Follow-up Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'follow_up_date',
          label: 'Follow-up Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 7,
        },
      ],
      defaultViews: [
        {
          name: 'All Communications',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'direction', 'subject', 'follow_up'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Needs Follow-up',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'subject', 'follow_up_date'],
          },
          filters: [{ fieldName: 'follow_up', operator: 'equals', value: true }],
          sorts: [{ fieldName: 'follow_up_date', direction: 'asc' }],
        },
      ],
    },
    {
      key: 'tags',
      name: 'Tags',
      description: 'Organization and categorization',
      icon: '🏷️',
      fields: [
        {
          name: 'name',
          label: 'Tag Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Tag name' },
          order: 0,
        },
        {
          name: 'color',
          label: 'Color',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'red', label: '🔴 Red' },
              { value: 'orange', label: '🟠 Orange' },
              { value: 'yellow', label: '🟡 Yellow' },
              { value: 'green', label: '🟢 Green' },
              { value: 'blue', label: '🔵 Blue' },
              { value: 'purple', label: '🟣 Purple' },
              { value: 'gray', label: '⚪ Gray' },
            ],
          },
          order: 1,
        },
        {
          name: 'category',
          label: 'Category',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'interest', label: 'Interest' },
              { value: 'source', label: 'Source' },
              { value: 'program', label: 'Program' },
              { value: 'relationship', label: 'Relationship' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 2,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Tag description' },
          order: 3,
        },
      ],
      defaultViews: [
        {
          name: 'All Tags',
          type: 'table',
          config: {
            visibleFields: ['name', 'color', 'category'],
          },
          sorts: [{ fieldName: 'name', direction: 'asc' }],
        },
        {
          name: 'By Category',
          type: 'board',
          config: {
            boardGroupBy: 'category',
            boardCardTitleField: 'name',
            boardCardFields: ['color'],
          },
        },
      ],
    },
  ],

  relationships: [
    // Donation -> Contact
    {
      sourceTable: 'donations',
      sourceField: 'contact_id',
      targetTable: 'contacts',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Donor',
      required: true,
      onDelete: 'cascade',
    },
    // Donation -> Campaign
    {
      sourceTable: 'donations',
      sourceField: 'campaign_id',
      targetTable: 'campaigns',
      targetField: 'name',
      type: 'many-to-one',
      label: 'Campaign',
      required: false,
      onDelete: 'set-null',
    },
    // Communication -> Contact
    {
      sourceTable: 'communications',
      sourceField: 'contact_id',
      targetTable: 'contacts',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Contact',
      required: true,
      onDelete: 'cascade',
    },
    // Communication -> Campaign
    {
      sourceTable: 'communications',
      sourceField: 'campaign_id',
      targetTable: 'campaigns',
      targetField: 'name',
      type: 'many-to-one',
      label: 'Related Campaign',
      required: false,
      onDelete: 'set-null',
    },
    // Contact -> Tags (many-to-many)
    {
      sourceTable: 'contacts',
      sourceField: 'tags',
      targetTable: 'tags',
      targetField: 'name',
      type: 'many-to-many',
      label: 'Tags',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'tags',
        records: [
          { name: 'Board Member', color: 'purple', category: 'relationship' },
          { name: 'Major Donor', color: 'green', category: 'relationship' },
          { name: 'Volunteer', color: 'blue', category: 'relationship' },
          { name: 'Email Newsletter', color: 'gray', category: 'interest' },
          { name: 'Annual Gala', color: 'orange', category: 'source' },
          { name: 'Website', color: 'gray', category: 'source' },
        ],
      },
      {
        tableKey: 'campaigns',
        records: [
          {
            name: 'Annual Fund 2025',
            description: 'General operating support campaign',
            goal: 100000,
            raised: 0,
            status: 'planning',
            campaign_type: 'annual',
          },
        ],
      },
    ],
  },
};
