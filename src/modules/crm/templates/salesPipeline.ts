/**
 * Sales Pipeline CRM Template
 * For organizations managing sales opportunities and accounts
 *
 * Tables:
 * - Accounts: Companies and organizations
 * - Contacts: Individual contacts at accounts
 * - Opportunities: Sales opportunities/deals
 * - Activities: Sales activities and follow-ups
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const salesPipelineTemplate: CRMMultiTableTemplate = {
  id: 'sales-pipeline',
  name: 'Sales Pipeline',
  description:
    'Track accounts, contacts, opportunities, and sales activities',
  icon: '📈',
  category: 'sales',
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
      key: 'accounts',
      name: 'Accounts',
      description: 'Companies and organizations',
      icon: '🏢',
      isPrimary: true,
      fields: [
        {
          name: 'company_name',
          label: 'Company Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Company name' },
          order: 0,
        },
        {
          name: 'industry',
          label: 'Industry',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'technology', label: 'Technology' },
              { value: 'healthcare', label: 'Healthcare' },
              { value: 'finance', label: 'Finance' },
              { value: 'manufacturing', label: 'Manufacturing' },
              { value: 'retail', label: 'Retail' },
              { value: 'education', label: 'Education' },
              { value: 'nonprofit', label: 'Nonprofit' },
              { value: 'government', label: 'Government' },
              { value: 'professional_services', label: 'Professional Services' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 1,
        },
        {
          name: 'website',
          label: 'Website',
          schema: { type: 'string', format: 'uri' },
          widget: { widget: 'text', placeholder: 'https://example.com' },
          order: 2,
        },
        {
          name: 'phone',
          label: 'Phone',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Main phone number' },
          order: 3,
        },
        {
          name: 'address',
          label: 'Address',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Full address' },
          order: 4,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'prospect', label: 'Prospect' },
              { value: 'active', label: 'Active Customer' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'churned', label: 'Churned' },
              { value: 'partner', label: 'Partner' },
            ],
          },
          order: 5,
        },
        {
          name: 'annual_revenue',
          label: 'Annual Revenue',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 6,
        },
        {
          name: 'employee_count',
          label: 'Employee Count',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: '1-10', label: '1-10' },
              { value: '11-50', label: '11-50' },
              { value: '51-200', label: '51-200' },
              { value: '201-500', label: '201-500' },
              { value: '501-1000', label: '501-1000' },
              { value: '1001+', label: '1000+' },
            ],
          },
          order: 7,
        },
        {
          name: 'source',
          label: 'Lead Source',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'referral', label: 'Referral' },
              { value: 'website', label: 'Website' },
              { value: 'cold_outreach', label: 'Cold Outreach' },
              { value: 'event', label: 'Event' },
              { value: 'advertising', label: 'Advertising' },
              { value: 'partner', label: 'Partner' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 8,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 9,
        },
      ],
      defaultViews: [
        {
          name: 'All Accounts',
          type: 'table',
          config: {
            visibleFields: ['company_name', 'industry', 'status', 'website'],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'company_name',
            boardCardFields: ['industry', 'website'],
          },
        },
        {
          name: 'By Industry',
          type: 'board',
          config: {
            boardGroupBy: 'industry',
            boardCardTitleField: 'company_name',
            boardCardFields: ['status'],
          },
        },
        {
          name: 'Active Customers',
          type: 'table',
          config: {
            visibleFields: ['company_name', 'industry', 'phone', 'annual_revenue'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'active' }],
        },
      ],
    },
    {
      key: 'contacts',
      name: 'Contacts',
      description: 'Individual contacts at accounts',
      icon: '👤',
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
          name: 'title',
          label: 'Title',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Job title' },
          order: 3,
        },
        {
          name: 'department',
          label: 'Department',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'executive', label: 'Executive' },
              { value: 'sales', label: 'Sales' },
              { value: 'marketing', label: 'Marketing' },
              { value: 'engineering', label: 'Engineering' },
              { value: 'operations', label: 'Operations' },
              { value: 'finance', label: 'Finance' },
              { value: 'hr', label: 'Human Resources' },
              { value: 'legal', label: 'Legal' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 4,
        },
        {
          name: 'is_primary',
          label: 'Primary Contact',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'is_decision_maker',
          label: 'Decision Maker',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 6,
        },
        {
          name: 'linkedin',
          label: 'LinkedIn',
          schema: { type: 'string', format: 'uri' },
          widget: { widget: 'text', placeholder: 'LinkedIn profile URL' },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          order: 8,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 9,
        },
      ],
      defaultViews: [
        {
          name: 'All Contacts',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'title', 'email', 'phone', 'is_primary'],
          },
        },
        {
          name: 'Decision Makers',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'title', 'email', 'phone'],
          },
          filters: [{ fieldName: 'is_decision_maker', operator: 'equals', value: true }],
        },
        {
          name: 'By Department',
          type: 'board',
          config: {
            boardGroupBy: 'department',
            boardCardTitleField: 'full_name',
            boardCardFields: ['title', 'email'],
          },
        },
      ],
    },
    {
      key: 'opportunities',
      name: 'Opportunities',
      description: 'Sales opportunities and deals',
      icon: '💼',
      fields: [
        {
          name: 'name',
          label: 'Opportunity Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Deal name' },
          order: 0,
        },
        {
          name: 'stage',
          label: 'Stage',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'prospecting', label: 'Prospecting' },
              { value: 'qualification', label: 'Qualification' },
              { value: 'needs_analysis', label: 'Needs Analysis' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'closed_won', label: 'Closed Won' },
              { value: 'closed_lost', label: 'Closed Lost' },
            ],
          },
          order: 1,
        },
        {
          name: 'amount',
          label: 'Amount',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0.00' },
          order: 2,
        },
        {
          name: 'probability',
          label: 'Probability (%)',
          schema: { type: 'number', minimum: 0, maximum: 100 },
          widget: { widget: 'number', placeholder: '50' },
          order: 3,
        },
        {
          name: 'close_date',
          label: 'Expected Close Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 4,
        },
        {
          name: 'type',
          label: 'Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'new_business', label: 'New Business' },
              { value: 'expansion', label: 'Expansion' },
              { value: 'renewal', label: 'Renewal' },
              { value: 'upsell', label: 'Upsell' },
              { value: 'cross_sell', label: 'Cross-Sell' },
            ],
          },
          order: 5,
        },
        {
          name: 'next_step',
          label: 'Next Step',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Next action to take' },
          order: 6,
        },
        {
          name: 'competition',
          label: 'Competition',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Competitors in deal' },
          order: 7,
        },
        {
          name: 'loss_reason',
          label: 'Loss Reason',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'price', label: 'Price' },
              { value: 'competition', label: 'Competition' },
              { value: 'no_decision', label: 'No Decision' },
              { value: 'timing', label: 'Timing' },
              { value: 'fit', label: 'Product Fit' },
              { value: 'champion_left', label: 'Champion Left' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 8,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 9,
        },
      ],
      defaultViews: [
        {
          name: 'All Opportunities',
          type: 'table',
          config: {
            visibleFields: ['name', 'stage', 'amount', 'close_date', 'probability'],
          },
        },
        {
          name: 'Pipeline',
          type: 'board',
          config: {
            boardGroupBy: 'stage',
            boardCardTitleField: 'name',
            boardCardFields: ['amount', 'close_date'],
          },
        },
        {
          name: 'Closing This Month',
          type: 'table',
          config: {
            visibleFields: ['name', 'stage', 'amount', 'close_date', 'next_step'],
          },
          sorts: [{ fieldName: 'close_date', direction: 'asc' }],
        },
        {
          name: 'Won Deals',
          type: 'table',
          config: {
            visibleFields: ['name', 'amount', 'close_date', 'type'],
          },
          filters: [{ fieldName: 'stage', operator: 'equals', value: 'closed_won' }],
        },
        {
          name: 'Lost Analysis',
          type: 'board',
          config: {
            boardGroupBy: 'loss_reason',
            boardCardTitleField: 'name',
            boardCardFields: ['amount'],
          },
          filters: [{ fieldName: 'stage', operator: 'equals', value: 'closed_lost' }],
        },
      ],
    },
    {
      key: 'activities',
      name: 'Activities',
      description: 'Sales activities and follow-ups',
      icon: '📋',
      fields: [
        {
          name: 'type',
          label: 'Activity Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'call', label: 'Call' },
              { value: 'email', label: 'Email' },
              { value: 'meeting', label: 'Meeting' },
              { value: 'demo', label: 'Demo' },
              { value: 'proposal', label: 'Proposal Sent' },
              { value: 'follow_up', label: 'Follow-up' },
              { value: 'task', label: 'Task' },
              { value: 'note', label: 'Note' },
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
          name: 'subject',
          label: 'Subject',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Activity subject' },
          order: 2,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Activity details' },
          order: 3,
        },
        {
          name: 'outcome',
          label: 'Outcome',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'completed', label: 'Completed' },
              { value: 'no_answer', label: 'No Answer' },
              { value: 'left_message', label: 'Left Message' },
              { value: 'rescheduled', label: 'Rescheduled' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'pending', label: 'Pending' },
            ],
          },
          order: 4,
        },
        {
          name: 'next_action',
          label: 'Next Action',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Follow-up action' },
          order: 5,
        },
        {
          name: 'next_action_date',
          label: 'Next Action Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          name: 'duration_minutes',
          label: 'Duration (min)',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '30' },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Activities',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'subject', 'outcome', 'next_action'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'subject',
          },
        },
        {
          name: 'Pending Follow-ups',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'subject', 'next_action', 'next_action_date'],
          },
          filters: [{ fieldName: 'next_action', operator: 'is-not-empty', value: null }],
          sorts: [{ fieldName: 'next_action_date', direction: 'asc' }],
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'type',
            boardCardTitleField: 'subject',
            boardCardFields: ['date', 'outcome'],
          },
        },
      ],
    },
  ],

  relationships: [
    // Contact -> Account
    {
      sourceTable: 'contacts',
      sourceField: 'account_id',
      targetTable: 'accounts',
      targetField: 'company_name',
      type: 'many-to-one',
      label: 'Account',
      required: false,
      onDelete: 'set-null',
    },
    // Account -> Owner (pubkey field for account owner)
    {
      sourceTable: 'accounts',
      sourceField: 'account_owner',
      targetTable: 'contacts', // Reference to salesperson contact
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Account Owner',
      required: false,
      onDelete: 'set-null',
    },
    // Opportunity -> Account
    {
      sourceTable: 'opportunities',
      sourceField: 'account_id',
      targetTable: 'accounts',
      targetField: 'company_name',
      type: 'many-to-one',
      label: 'Account',
      required: true,
      onDelete: 'cascade',
    },
    // Opportunity -> Primary Contact
    {
      sourceTable: 'opportunities',
      sourceField: 'contact_id',
      targetTable: 'contacts',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Primary Contact',
      required: false,
      onDelete: 'set-null',
    },
    // Opportunity -> Owner (pubkey field for deal owner)
    {
      sourceTable: 'opportunities',
      sourceField: 'owner',
      targetTable: 'contacts',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Owner',
      required: false,
      onDelete: 'set-null',
    },
    // Activity -> Opportunity
    {
      sourceTable: 'activities',
      sourceField: 'opportunity_id',
      targetTable: 'opportunities',
      targetField: 'name',
      type: 'many-to-one',
      label: 'Opportunity',
      required: false,
      onDelete: 'set-null',
    },
    // Activity -> Contact
    {
      sourceTable: 'activities',
      sourceField: 'contact_id',
      targetTable: 'contacts',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Contact',
      required: false,
      onDelete: 'set-null',
    },
    // Activity -> Account
    {
      sourceTable: 'activities',
      sourceField: 'account_id',
      targetTable: 'accounts',
      targetField: 'company_name',
      type: 'many-to-one',
      label: 'Account',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'accounts',
        records: [
          {
            company_name: 'Acme Corporation',
            industry: 'technology',
            website: 'https://acme.example.com',
            status: 'prospect',
            employee_count: '51-200',
            source: 'website',
          },
          {
            company_name: 'GlobalTech Inc',
            industry: 'technology',
            website: 'https://globaltech.example.com',
            status: 'active',
            employee_count: '201-500',
            source: 'referral',
          },
        ],
      },
    ],
  },
};
