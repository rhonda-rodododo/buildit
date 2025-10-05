/**
 * CRM Module Templates
 * Pre-configured CRM templates extending database templates
 */

import { DatabaseTemplate } from '@/modules/database/types';
import type { CustomField } from '@/modules/custom-fields/types';
import { nanoid } from 'nanoid';

const now = Date.now();

/**
 * Helper to create a field
 */
function createField(
  name: string,
  label: string,
  widget: CustomField['widget']['widget'],
  options?: {
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    options?: Array<{ value: string; label: string }>
  }
): CustomField {
  const fieldDef: CustomField = {
    id: nanoid(),
    groupId: '',
    entityType: 'database-record',
    name,
    label,
    schema: {
      type: widget === 'multi-select' ? 'array' : widget === 'number' ? 'number' : widget === 'checkbox' ? 'boolean' : 'string',
      title: label,
      required: options?.required || false,
    },
    widget: {
      widget,
      placeholder: options?.placeholder,
      helpText: options?.helpText,
      options: options?.options,
    },
    order: 0,
    created: now,
    createdBy: 'system',
    updated: now,
  };

  if (options?.options) {
    fieldDef.schema.enum = options.options.map((o) => o.value);
    fieldDef.schema.enumLabels = options.options.map((o) => o.label);
  }

  return fieldDef;
}

/**
 * Union Organizing CRM Template
 */
export const UNION_ORGANIZING_TEMPLATE: DatabaseTemplate = {
  id: 'template-crm-union-organizing',
  name: 'Union Organizing',
  description: 'Track workers, organizing campaigns, and bargaining units for union drives',
  category: 'crm',
  icon: 'Users',
  tables: [
    {
      name: 'Workers',
      description: 'Workers and potential union members',
      fields: [
        createField('first_name', 'First Name', 'text', { required: true }),
        createField('last_name', 'Last Name', 'text', { required: true }),
        createField('email', 'Email', 'text'),
        createField('phone', 'Phone', 'text'),
        createField('secondary_phone', 'Secondary Phone', 'text'),
        createField('workplace', 'Workplace', 'text', { required: true }),
        createField('department', 'Department', 'text'),
        createField('job_title', 'Job Title', 'text'),
        createField('shift', 'Shift', 'select', {
          options: [
            { value: 'day', label: 'Day' },
            { value: 'evening', label: 'Evening' },
            { value: 'night', label: 'Night' },
            { value: 'rotating', label: 'Rotating' },
          ],
        }),
        createField('hire_date', 'Hire Date', 'date'),
        createField('support_level', 'Support Level', 'select', {
          required: true,
          options: [
            { value: 'strong-yes', label: '💪 Strong Yes' },
            { value: 'yes', label: '✅ Yes' },
            { value: 'undecided', label: '🤔 Undecided' },
            { value: 'no', label: '❌ No' },
            { value: 'strong-no', label: '🚫 Strong No' },
            { value: 'unknown', label: '❓ Unknown' },
          ],
        }),
        createField('organizer', 'Assigned Organizer', 'relationship'),
        createField('is_leader', 'Organizing Committee Member', 'checkbox'),
        createField('concerns', 'Key Concerns/Issues', 'multi-select', {
          options: [
            { value: 'wages', label: 'Wages' },
            { value: 'benefits', label: 'Benefits' },
            { value: 'safety', label: 'Safety' },
            { value: 'hours', label: 'Hours/Scheduling' },
            { value: 'respect', label: 'Respect/Dignity' },
            { value: 'job-security', label: 'Job Security' },
            { value: 'pto', label: 'Paid Time Off' },
          ],
        }),
        createField('languages', 'Languages Spoken', 'multi-select', {
          options: [
            { value: 'english', label: 'English' },
            { value: 'spanish', label: 'Spanish' },
            { value: 'chinese', label: 'Chinese' },
            { value: 'tagalog', label: 'Tagalog' },
            { value: 'vietnamese', label: 'Vietnamese' },
            { value: 'arabic', label: 'Arabic' },
            { value: 'other', label: 'Other' },
          ],
        }),
        createField('last_contact', 'Last Contact', 'date'),
        createField('next_follow_up', 'Next Follow-up', 'date'),
        createField('notes', 'Notes', 'textarea'),
        createField('card_signed', 'Authorization Card Signed', 'checkbox'),
        createField('card_signed_date', 'Card Signed Date', 'date'),
      ],
    },
    {
      name: 'Organizers',
      description: 'Union organizers and staff',
      fields: [
        createField('name', 'Name', 'text', { required: true }),
        createField('email', 'Email', 'text', { required: true }),
        createField('phone', 'Phone', 'text', { required: true }),
        createField('role', 'Role', 'select', {
          options: [
            { value: 'lead-organizer', label: 'Lead Organizer' },
            { value: 'organizer', label: 'Organizer' },
            { value: 'volunteer', label: 'Volunteer' },
          ],
        }),
        createField('active', 'Active', 'checkbox'),
      ],
    },
    {
      name: 'Campaigns',
      description: 'Organizing campaigns and drives',
      fields: [
        createField('campaign_name', 'Campaign Name', 'text', { required: true }),
        createField('workplace', 'Workplace/Employer', 'text', { required: true }),
        createField('location', 'Location', 'text'),
        createField('bargaining_unit_size', 'Bargaining Unit Size', 'number'),
        createField('cards_signed', 'Cards Signed', 'number'),
        createField('status', 'Campaign Status', 'select', {
          required: true,
          options: [
            { value: 'initial-contact', label: 'Initial Contact' },
            { value: 'building-committee', label: 'Building Committee' },
            { value: 'mapping', label: 'Mapping Workplace' },
            { value: 'card-drive', label: 'Card Drive' },
            { value: 'filed-election', label: 'Filed for Election' },
            { value: 'election-won', label: 'Election Won' },
            { value: 'bargaining', label: 'First Contract Bargaining' },
            { value: 'contract-won', label: 'First Contract Won' },
            { value: 'on-hold', label: 'On Hold' },
            { value: 'lost', label: 'Lost' },
          ],
        }),
        createField('start_date', 'Start Date', 'date'),
        createField('election_date', 'Election Date', 'date'),
        createField('lead_organizer', 'Lead Organizer', 'relationship'),
        createField('goals', 'Campaign Goals', 'textarea'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
    {
      name: '1-on-1 Conversations',
      description: 'Track individual conversations with workers',
      fields: [
        createField('worker', 'Worker', 'relationship', { required: true }),
        createField('date', 'Date', 'datetime', { required: true }),
        createField('organizer', 'Organizer', 'relationship'),
        createField('conversation_type', 'Type', 'select', {
          options: [
            { value: 'initial', label: 'Initial Contact' },
            { value: 'follow-up', label: 'Follow-up' },
            { value: 'committee', label: 'Committee Recruitment' },
            { value: 'card-signing', label: 'Card Signing' },
            { value: 'house-visit', label: 'House Visit' },
          ],
        }),
        createField('duration_minutes', 'Duration (minutes)', 'number'),
        createField('support_level_after', 'Support Level After', 'select', {
          options: [
            { value: 'strong-yes', label: '💪 Strong Yes' },
            { value: 'yes', label: '✅ Yes' },
            { value: 'undecided', label: '🤔 Undecided' },
            { value: 'no', label: '❌ No' },
            { value: 'strong-no', label: '🚫 Strong No' },
          ],
        }),
        createField('key_issues_discussed', 'Key Issues Discussed', 'multi-select', {
          options: [
            { value: 'wages', label: 'Wages' },
            { value: 'benefits', label: 'Benefits' },
            { value: 'safety', label: 'Safety' },
            { value: 'hours', label: 'Hours/Scheduling' },
            { value: 'respect', label: 'Respect/Dignity' },
            { value: 'job-security', label: 'Job Security' },
          ],
        }),
        createField('action_items', 'Action Items', 'textarea'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Workers',
      sourceFieldName: 'organizer',
      targetTableName: 'Organizers',
      targetFieldName: 'name',
      type: 'many-to-one',
      onDelete: 'set-null',
    },
    {
      sourceTableName: 'Campaigns',
      sourceFieldName: 'lead_organizer',
      targetTableName: 'Organizers',
      targetFieldName: 'name',
      type: 'many-to-one',
      onDelete: 'set-null',
    },
    {
      sourceTableName: '1-on-1 Conversations',
      sourceFieldName: 'worker',
      targetTableName: 'Workers',
      targetFieldName: 'first_name',
      type: 'many-to-one',
      onDelete: 'cascade',
    },
    {
      sourceTableName: '1-on-1 Conversations',
      sourceFieldName: 'organizer',
      targetTableName: 'Organizers',
      targetFieldName: 'name',
      type: 'many-to-one',
      onDelete: 'set-null',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * Fundraising CRM Template
 */
export const FUNDRAISING_TEMPLATE: DatabaseTemplate = {
  id: 'template-crm-fundraising',
  name: 'Fundraising & Donor Management',
  description: 'Track donors, donations, campaigns, and engagement for fundraising',
  category: 'crm',
  icon: 'DollarSign',
  tables: [
    {
      name: 'Donors',
      description: 'Individual and organizational donors',
      fields: [
        createField('donor_name', 'Donor Name', 'text', { required: true }),
        createField('donor_type', 'Donor Type', 'select', {
          required: true,
          options: [
            { value: 'individual', label: 'Individual' },
            { value: 'organization', label: 'Organization' },
            { value: 'foundation', label: 'Foundation' },
          ],
        }),
        createField('email', 'Email', 'text'),
        createField('phone', 'Phone', 'text'),
        createField('address', 'Address', 'textarea'),
        createField('donor_tier', 'Donor Tier', 'select', {
          options: [
            { value: 'major', label: 'Major Donor ($1000+)' },
            { value: 'sustainer', label: 'Monthly Sustainer' },
            { value: 'regular', label: 'Regular Donor' },
            { value: 'one-time', label: 'One-Time' },
            { value: 'lapsed', label: 'Lapsed' },
          ],
        }),
        createField('total_lifetime_donations', 'Total Lifetime Donations', 'number'),
        createField('first_donation_date', 'First Donation Date', 'date'),
        createField('last_donation_date', 'Last Donation Date', 'date'),
        createField('preferred_contact_method', 'Preferred Contact Method', 'select', {
          options: [
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
            { value: 'mail', label: 'Mail' },
          ],
        }),
        createField('interests', 'Areas of Interest', 'multi-select', {
          options: [
            { value: 'labor', label: 'Labor Rights' },
            { value: 'environment', label: 'Environment' },
            { value: 'housing', label: 'Housing Justice' },
            { value: 'education', label: 'Education' },
            { value: 'healthcare', label: 'Healthcare' },
          ],
        }),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
    {
      name: 'Donations',
      description: 'Individual donation records',
      fields: [
        createField('donor', 'Donor', 'relationship', { required: true }),
        createField('amount', 'Amount', 'number', { required: true }),
        createField('date', 'Date', 'date', { required: true }),
        createField('campaign', 'Campaign', 'relationship'),
        createField('donation_type', 'Type', 'select', {
          required: true,
          options: [
            { value: 'one-time', label: 'One-Time' },
            { value: 'recurring', label: 'Recurring' },
            { value: 'pledge', label: 'Pledge' },
          ],
        }),
        createField('payment_method', 'Payment Method', 'select', {
          options: [
            { value: 'credit-card', label: 'Credit Card' },
            { value: 'check', label: 'Check' },
            { value: 'cash', label: 'Cash' },
            { value: 'paypal', label: 'PayPal' },
            { value: 'venmo', label: 'Venmo' },
          ],
        }),
        createField('acknowledged', 'Thank You Sent', 'checkbox'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
    {
      name: 'Fundraising Campaigns',
      description: 'Fundraising campaigns and appeals',
      fields: [
        createField('campaign_name', 'Campaign Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('goal', 'Fundraising Goal', 'number', { required: true }),
        createField('raised', 'Amount Raised', 'number'),
        createField('start_date', 'Start Date', 'date', { required: true }),
        createField('end_date', 'End Date', 'date'),
        createField('status', 'Status', 'select', {
          required: true,
          options: [
            { value: 'planning', label: 'Planning' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
          ],
        }),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Donations',
      sourceFieldName: 'donor',
      targetTableName: 'Donors',
      targetFieldName: 'donor_name',
      type: 'many-to-one',
      onDelete: 'restrict',
    },
    {
      sourceTableName: 'Donations',
      sourceFieldName: 'campaign',
      targetTableName: 'Fundraising Campaigns',
      targetFieldName: 'campaign_name',
      type: 'many-to-one',
      onDelete: 'set-null',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * Volunteer Management CRM Template
 */
export const VOLUNTEER_TEMPLATE: DatabaseTemplate = {
  id: 'template-crm-volunteer',
  name: 'Volunteer Management',
  description: 'Coordinate volunteers, shifts, and activities',
  category: 'crm',
  icon: 'Heart',
  tables: [
    {
      name: 'Volunteers',
      description: 'Volunteer information and skills',
      fields: [
        createField('first_name', 'First Name', 'text', { required: true }),
        createField('last_name', 'Last Name', 'text', { required: true }),
        createField('email', 'Email', 'text', { required: true }),
        createField('phone', 'Phone', 'text'),
        createField('emergency_contact', 'Emergency Contact', 'text'),
        createField('emergency_phone', 'Emergency Phone', 'text'),
        createField('skills', 'Skills', 'multi-select', {
          options: [
            { value: 'canvassing', label: 'Canvassing' },
            { value: 'phone-banking', label: 'Phone Banking' },
            { value: 'data-entry', label: 'Data Entry' },
            { value: 'event-planning', label: 'Event Planning' },
            { value: 'graphic-design', label: 'Graphic Design' },
            { value: 'writing', label: 'Writing' },
            { value: 'translation', label: 'Translation' },
            { value: 'legal', label: 'Legal' },
          ],
        }),
        createField('availability', 'Availability', 'multi-select', {
          options: [
            { value: 'weekday-morning', label: 'Weekday Morning' },
            { value: 'weekday-afternoon', label: 'Weekday Afternoon' },
            { value: 'weekday-evening', label: 'Weekday Evening' },
            { value: 'weekend', label: 'Weekend' },
          ],
        }),
        createField('status', 'Status', 'select', {
          required: true,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'on-break', label: 'On Break' },
          ],
        }),
        createField('total_hours', 'Total Hours Volunteered', 'number'),
        createField('sign_up_date', 'Sign-up Date', 'date'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
    {
      name: 'Volunteer Shifts',
      description: 'Shift assignments and tracking',
      fields: [
        createField('volunteer', 'Volunteer', 'relationship', { required: true }),
        createField('activity', 'Activity', 'relationship', { required: true }),
        createField('shift_date', 'Shift Date', 'date', { required: true }),
        createField('start_time', 'Start Time', 'datetime', { required: true }),
        createField('end_time', 'End Time', 'datetime'),
        createField('hours', 'Hours', 'number'),
        createField('checked_in', 'Checked In', 'checkbox'),
        createField('completed', 'Completed', 'checkbox'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
    {
      name: 'Activities',
      description: 'Volunteer activities and events',
      fields: [
        createField('activity_name', 'Activity Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('activity_type', 'Type', 'select', {
          required: true,
          options: [
            { value: 'canvassing', label: 'Canvassing' },
            { value: 'phone-banking', label: 'Phone Banking' },
            { value: 'event', label: 'Event' },
            { value: 'training', label: 'Training' },
            { value: 'admin', label: 'Administrative' },
          ],
        }),
        createField('date', 'Date', 'date', { required: true }),
        createField('volunteers_needed', 'Volunteers Needed', 'number'),
        createField('volunteers_signed_up', 'Volunteers Signed Up', 'number'),
        createField('location', 'Location', 'text'),
        createField('notes', 'Notes', 'textarea'),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Volunteer Shifts',
      sourceFieldName: 'volunteer',
      targetTableName: 'Volunteers',
      targetFieldName: 'first_name',
      type: 'many-to-one',
      onDelete: 'cascade',
    },
    {
      sourceTableName: 'Volunteer Shifts',
      sourceFieldName: 'activity',
      targetTableName: 'Activities',
      targetFieldName: 'activity_name',
      type: 'many-to-one',
      onDelete: 'cascade',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * All CRM templates
 */
export const CRM_TEMPLATES: DatabaseTemplate[] = [
  UNION_ORGANIZING_TEMPLATE,
  FUNDRAISING_TEMPLATE,
  VOLUNTEER_TEMPLATE,
];
