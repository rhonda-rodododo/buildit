/**
 * Member Management CRM Template
 * For membership organizations, unions, and cooperatives
 *
 * Tables:
 * - Members: Organization members
 * - Dues Payments: Membership dues tracking
 * - Committees: Committees and working groups
 * - Meetings: Committee and general meetings
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const memberManagementTemplate: CRMMultiTableTemplate = {
  id: 'member-management',
  name: 'Member Management',
  description:
    'Track members, dues, committees, and meetings for membership organizations',
  icon: '👥',
  category: 'member',
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
      key: 'members',
      name: 'Members',
      description: 'Organization members',
      icon: '👤',
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
          ...CRM_FIELD_PRESETS.pubkey,
          label: 'Nostr Profile',
          order: 3,
        },
        {
          name: 'member_since',
          label: 'Member Since',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 4,
        },
        {
          name: 'membership_type',
          label: 'Membership Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'full', label: 'Full Member' },
              { value: 'associate', label: 'Associate Member' },
              { value: 'student', label: 'Student Member' },
              { value: 'senior', label: 'Senior Member' },
              { value: 'lifetime', label: 'Lifetime Member' },
              { value: 'honorary', label: 'Honorary Member' },
            ],
          },
          order: 5,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'pending', label: 'Pending' },
              { value: 'former', label: 'Former' },
            ],
          },
          order: 6,
        },
        {
          name: 'dues_status',
          label: 'Dues Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'current', label: 'Current' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'exempt', label: 'Exempt' },
              { value: 'pending', label: 'Pending' },
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
          name: 'employer',
          label: 'Employer',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Employer name' },
          order: 9,
        },
        {
          name: 'job_title',
          label: 'Job Title',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Job title' },
          order: 10,
        },
        {
          name: 'skills',
          label: 'Skills',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'facilitation', label: 'Facilitation' },
              { value: 'writing', label: 'Writing' },
              { value: 'graphic_design', label: 'Graphic Design' },
              { value: 'web_development', label: 'Web Development' },
              { value: 'legal', label: 'Legal' },
              { value: 'accounting', label: 'Accounting' },
              { value: 'organizing', label: 'Organizing' },
              { value: 'translation', label: 'Translation' },
              { value: 'media', label: 'Media/PR' },
            ],
          },
          order: 11,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 12,
        },
      ],
      defaultViews: [
        {
          name: 'All Members',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'membership_type',
              'status',
              'dues_status',
              'member_since',
            ],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'full_name',
            boardCardFields: ['membership_type', 'dues_status'],
          },
        },
        {
          name: 'Active Members',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'email', 'phone', 'membership_type'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'active' }],
        },
        {
          name: 'Dues Overdue',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'email', 'phone', 'dues_status'],
          },
          filters: [{ fieldName: 'dues_status', operator: 'equals', value: 'overdue' }],
        },
      ],
    },
    {
      key: 'dues_payments',
      name: 'Dues Payments',
      description: 'Membership dues tracking',
      icon: '💵',
      fields: [
        {
          ...CRM_FIELD_PRESETS.amount,
          schema: { type: 'number', minimum: 0, required: true },
          order: 0,
        },
        {
          name: 'date',
          label: 'Payment Date',
          schema: { type: 'string', format: 'date', required: true },
          widget: { widget: 'date' },
          order: 1,
        },
        {
          name: 'period',
          label: 'Period',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'e.g., 2025 Q1, 2025 Annual' },
          order: 2,
        },
        {
          name: 'payment_method',
          label: 'Payment Method',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'check', label: 'Check' },
              { value: 'cash', label: 'Cash' },
              { value: 'credit_card', label: 'Credit Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'payroll', label: 'Payroll Deduction' },
              { value: 'crypto', label: 'Cryptocurrency' },
            ],
          },
          order: 3,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
            ],
          },
          order: 4,
        },
        {
          name: 'receipt_number',
          label: 'Receipt Number',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Receipt #' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Payments',
          type: 'table',
          config: {
            visibleFields: ['date', 'amount', 'period', 'payment_method', 'status'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Pending',
          type: 'table',
          config: {
            visibleFields: ['date', 'amount', 'period', 'payment_method'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'pending' }],
        },
      ],
    },
    {
      key: 'committees',
      name: 'Committees',
      description: 'Committees and working groups',
      icon: '🏛️',
      fields: [
        {
          name: 'name',
          label: 'Committee Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Committee name' },
          order: 0,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Committee purpose and scope' },
          order: 1,
        },
        {
          name: 'committee_type',
          label: 'Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'standing', label: 'Standing Committee' },
              { value: 'working_group', label: 'Working Group' },
              { value: 'task_force', label: 'Task Force' },
              { value: 'board', label: 'Board/Executive' },
              { value: 'ad_hoc', label: 'Ad Hoc' },
            ],
          },
          order: 2,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'forming', label: 'Forming' },
              { value: 'dissolved', label: 'Dissolved' },
            ],
          },
          order: 3,
        },
        {
          name: 'meeting_schedule',
          label: 'Meeting Schedule',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'e.g., First Monday, 7pm' },
          order: 4,
        },
        {
          name: 'meeting_location',
          label: 'Meeting Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Location or virtual link' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Committees',
          type: 'table',
          config: {
            visibleFields: ['name', 'committee_type', 'status', 'meeting_schedule'],
          },
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'committee_type',
            boardCardTitleField: 'name',
            boardCardFields: ['status', 'meeting_schedule'],
          },
        },
        {
          name: 'Active',
          type: 'table',
          config: {
            visibleFields: ['name', 'committee_type', 'meeting_schedule'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'active' }],
        },
      ],
    },
    {
      key: 'meetings',
      name: 'Meetings',
      description: 'Committee and general meetings',
      icon: '📅',
      fields: [
        {
          name: 'title',
          label: 'Meeting Title',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Meeting title' },
          order: 0,
        },
        {
          name: 'date',
          label: 'Date & Time',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 1,
        },
        {
          name: 'location',
          label: 'Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Meeting location or link' },
          order: 2,
        },
        {
          name: 'meeting_type',
          label: 'Meeting Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'general', label: 'General Meeting' },
              { value: 'committee', label: 'Committee Meeting' },
              { value: 'board', label: 'Board Meeting' },
              { value: 'special', label: 'Special Meeting' },
              { value: 'annual', label: 'Annual Meeting' },
            ],
          },
          order: 3,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'rescheduled', label: 'Rescheduled' },
            ],
          },
          order: 4,
        },
        {
          name: 'agenda',
          label: 'Agenda',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Meeting agenda' },
          order: 5,
        },
        {
          name: 'attendance_count',
          label: 'Attendance',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 6,
        },
        {
          name: 'minutes_summary',
          label: 'Minutes Summary',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Key decisions and action items' },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Meetings',
          type: 'table',
          config: {
            visibleFields: ['date', 'title', 'meeting_type', 'status', 'attendance_count'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'title',
          },
        },
        {
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: ['date', 'title', 'location', 'meeting_type'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'scheduled' }],
          sorts: [{ fieldName: 'date', direction: 'asc' }],
        },
      ],
    },
  ],

  relationships: [
    // Dues Payment -> Member
    {
      sourceTable: 'dues_payments',
      sourceField: 'member_id',
      targetTable: 'members',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Member',
      required: true,
      onDelete: 'cascade',
    },
    // Committee -> Chair (Member)
    {
      sourceTable: 'committees',
      sourceField: 'chair_id',
      targetTable: 'members',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Chair',
      required: false,
      onDelete: 'set-null',
    },
    // Member -> Committees (many-to-many)
    {
      sourceTable: 'members',
      sourceField: 'committees',
      targetTable: 'committees',
      targetField: 'name',
      type: 'many-to-many',
      label: 'Committees',
      required: false,
      onDelete: 'set-null',
    },
    // Meeting -> Committee
    {
      sourceTable: 'meetings',
      sourceField: 'committee_id',
      targetTable: 'committees',
      targetField: 'name',
      type: 'many-to-one',
      label: 'Committee',
      required: false,
      onDelete: 'set-null',
    },
    // Meeting -> Minutes Document (file reference)
    {
      sourceTable: 'meetings',
      sourceField: 'minutes_doc_id',
      targetTable: 'meetings', // Self-reference placeholder - actual file will be an attachment
      targetField: 'title',
      type: 'many-to-one',
      label: 'Minutes Document',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'committees',
        records: [
          {
            name: 'Executive Committee',
            description: 'Leadership and strategic decisions',
            committee_type: 'board',
            status: 'active',
            meeting_schedule: 'First Monday, 6pm',
          },
          {
            name: 'Membership Committee',
            description: 'Recruitment and member engagement',
            committee_type: 'standing',
            status: 'active',
            meeting_schedule: 'Second Wednesday, 7pm',
          },
          {
            name: 'Communications Committee',
            description: 'Newsletter, social media, and outreach',
            committee_type: 'standing',
            status: 'active',
            meeting_schedule: 'Third Thursday, 6pm',
          },
        ],
      },
    ],
  },
};
