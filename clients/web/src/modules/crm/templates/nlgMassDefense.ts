/**
 * NLG Mass Defense CRM Template
 * For legal support organizations coordinating mass arrest response
 *
 * Tables:
 * - Arrestees: Individuals arrested during actions
 * - Cases: Legal cases being tracked
 * - Lawyers: Volunteer attorneys and legal workers
 * - Court Dates: Scheduled court appearances
 * - Communications: Log of all contact with arrestees/lawyers
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const nlgMassDefenseTemplate: CRMMultiTableTemplate = {
  id: 'nlg-mass-defense',
  name: 'NLG Mass Defense',
  description:
    'Track arrestees, cases, lawyers, and court dates for mass arrest legal support',
  icon: '⚖️',
  category: 'legal',
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
      key: 'arrestees',
      name: 'Arrestees',
      description: 'Individuals arrested during actions',
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
          name: 'arrest_date',
          label: 'Arrest Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 3,
        },
        {
          name: 'arrest_location',
          label: 'Arrest Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Where arrested' },
          order: 4,
        },
        {
          name: 'charges',
          label: 'Charges',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'List all charges' },
          order: 5,
        },
        {
          name: 'release_status',
          label: 'Release Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'in_custody', label: 'In Custody' },
              { value: 'released_ror', label: 'Released ROR' },
              { value: 'released_bail', label: 'Released on Bail' },
              { value: 'released_bond', label: 'Released on Bond' },
              { value: 'pending', label: 'Pending' },
            ],
          },
          order: 6,
        },
        {
          name: 'jail_location',
          label: 'Jail Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Facility name if in custody' },
          order: 7,
        },
        {
          name: 'bond_amount',
          label: 'Bond Amount',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0.00' },
          order: 8,
        },
        {
          name: 'special_needs',
          label: 'Special Needs',
          schema: { type: 'string' },
          widget: {
            widget: 'textarea',
            placeholder: 'Medical, dietary, accessibility needs',
          },
          order: 9,
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
              { value: 'arabic', label: 'Arabic' },
              { value: 'french', label: 'French' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 10,
        },
        {
          name: 'emergency_contact',
          label: 'Emergency Contact',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Name and phone number' },
          order: 11,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 12,
        },
      ],
      defaultViews: [
        {
          name: 'All Arrestees',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'arrest_date',
              'charges',
              'release_status',
              'jail_location',
            ],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'release_status',
            boardCardTitleField: 'full_name',
            boardCardFields: ['arrest_date', 'charges'],
          },
        },
        {
          name: 'In Custody',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'jail_location',
              'bond_amount',
              'special_needs',
              'emergency_contact',
            ],
          },
          filters: [{ fieldName: 'release_status', operator: 'equals', value: 'in_custody' }],
        },
      ],
    },
    {
      key: 'cases',
      name: 'Cases',
      description: 'Legal cases being tracked',
      icon: '📋',
      fields: [
        {
          name: 'case_number',
          label: 'Case Number',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Court case number' },
          order: 0,
        },
        {
          name: 'case_name',
          label: 'Case Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'People v. Defendant' },
          order: 1,
        },
        {
          name: 'incident_date',
          label: 'Incident Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 2,
        },
        {
          ...CRM_FIELD_PRESETS.status,
          widget: {
            widget: 'select',
            options: [
              { value: 'intake', label: 'Intake' },
              { value: 'arraignment_pending', label: 'Arraignment Pending' },
              { value: 'pre_trial', label: 'Pre-Trial' },
              { value: 'trial', label: 'Trial' },
              { value: 'appeal', label: 'Appeal' },
              { value: 'dismissed', label: 'Dismissed' },
              { value: 'resolved', label: 'Resolved' },
            ],
          },
          order: 3,
        },
        {
          name: 'jurisdiction',
          label: 'Jurisdiction',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'City/County/State/Federal' },
          order: 4,
        },
        {
          name: 'court',
          label: 'Court',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Court name' },
          order: 5,
        },
        {
          name: 'next_court_date',
          label: 'Next Court Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          name: 'discovery_deadline',
          label: 'Discovery Deadline',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 7,
        },
        {
          name: 'bail_fund_needed',
          label: 'Bail Fund Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 8,
        },
        {
          name: 'case_type',
          label: 'Case Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'misdemeanor', label: 'Misdemeanor' },
              { value: 'felony', label: 'Felony' },
              { value: 'infraction', label: 'Infraction' },
              { value: 'federal', label: 'Federal' },
            ],
          },
          order: 9,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 10,
        },
      ],
      defaultViews: [
        {
          name: 'All Cases',
          type: 'table',
          config: {
            visibleFields: [
              'case_number',
              'case_name',
              'status',
              'next_court_date',
              'jurisdiction',
            ],
          },
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'case_name',
            boardCardFields: ['case_number', 'next_court_date'],
          },
        },
        {
          name: 'Court Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'next_court_date',
            calendarTitleField: 'case_name',
          },
        },
        {
          name: 'Urgent',
          type: 'table',
          config: {
            visibleFields: [
              'case_number',
              'case_name',
              'next_court_date',
              'bail_fund_needed',
            ],
          },
          filters: [{ fieldName: 'bail_fund_needed', operator: 'equals', value: true }],
          sorts: [{ fieldName: 'next_court_date', direction: 'asc' }],
        },
      ],
    },
    {
      key: 'lawyers',
      name: 'Lawyers',
      description: 'Volunteer attorneys and legal workers',
      icon: '👩‍⚖️',
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          name: 'firm',
          label: 'Firm/Organization',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Law firm or organization' },
          order: 1,
        },
        {
          name: 'bar_number',
          label: 'Bar Number',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'State bar number' },
          order: 2,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 3,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 4,
        },
        {
          name: 'specialties',
          label: 'Specialties',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'criminal_defense', label: 'Criminal Defense' },
              { value: 'civil_rights', label: 'Civil Rights' },
              { value: 'immigration', label: 'Immigration' },
              { value: 'appellate', label: 'Appellate' },
              { value: 'first_amendment', label: 'First Amendment' },
              { value: 'police_misconduct', label: 'Police Misconduct' },
            ],
          },
          order: 5,
        },
        {
          name: 'availability',
          label: 'Availability',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'available', label: 'Available' },
              { value: 'limited', label: 'Limited Availability' },
              { value: 'unavailable', label: 'Currently Unavailable' },
            ],
          },
          order: 6,
        },
        {
          name: 'pro_bono',
          label: 'Pro Bono',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 7,
        },
        {
          name: 'max_cases',
          label: 'Max Active Cases',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '5' },
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
          name: 'All Lawyers',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'firm',
              'specialties',
              'availability',
              'pro_bono',
            ],
          },
        },
        {
          name: 'Available',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'phone', 'email', 'specialties', 'max_cases'],
          },
          filters: [{ fieldName: 'availability', operator: 'equals', value: 'available' }],
        },
      ],
    },
    {
      key: 'court_dates',
      name: 'Court Dates',
      description: 'Scheduled court appearances',
      icon: '📅',
      fields: [
        {
          name: 'date',
          label: 'Date & Time',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 0,
        },
        {
          name: 'courthouse',
          label: 'Courthouse',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Courthouse name and address' },
          order: 1,
        },
        {
          name: 'courtroom',
          label: 'Courtroom',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Room number' },
          order: 2,
        },
        {
          name: 'hearing_type',
          label: 'Hearing Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'arraignment', label: 'Arraignment' },
              { value: 'bail_hearing', label: 'Bail Hearing' },
              { value: 'pretrial', label: 'Pre-Trial Conference' },
              { value: 'motion', label: 'Motion Hearing' },
              { value: 'trial', label: 'Trial' },
              { value: 'sentencing', label: 'Sentencing' },
              { value: 'appeal', label: 'Appeal' },
            ],
          },
          order: 3,
        },
        {
          name: 'support_needed',
          label: 'Court Support Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 4,
        },
        {
          name: 'transport_needed',
          label: 'Transport Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'hearing_type',
          },
        },
        {
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: [
              'date',
              'courthouse',
              'courtroom',
              'hearing_type',
              'support_needed',
            ],
          },
          sorts: [{ fieldName: 'date', direction: 'asc' }],
        },
      ],
    },
    {
      key: 'communications',
      name: 'Communications',
      description: 'Log of all contact with arrestees and lawyers',
      icon: '📞',
      fields: [
        {
          name: 'contact_type',
          label: 'Contact Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'phone', label: 'Phone Call' },
              { value: 'text', label: 'Text Message' },
              { value: 'email', label: 'Email' },
              { value: 'in_person', label: 'In Person' },
              { value: 'jail_visit', label: 'Jail Visit' },
              { value: 'court', label: 'Court Appearance' },
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
              { value: 'inbound', label: 'Inbound' },
              { value: 'outbound', label: 'Outbound' },
            ],
          },
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.date,
          name: 'date',
          label: 'Date',
          order: 2,
        },
        {
          name: 'summary',
          label: 'Summary',
          schema: { type: 'string', required: true },
          widget: { widget: 'textarea', placeholder: 'Brief summary of communication' },
          order: 3,
        },
        {
          name: 'follow_up_needed',
          label: 'Follow-up Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 4,
        },
        {
          name: 'follow_up_date',
          label: 'Follow-up Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'All Communications',
          type: 'table',
          config: {
            visibleFields: ['date', 'contact_type', 'direction', 'summary', 'follow_up_needed'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Needs Follow-up',
          type: 'table',
          config: {
            visibleFields: ['date', 'contact_type', 'summary', 'follow_up_date'],
          },
          filters: [{ fieldName: 'follow_up_needed', operator: 'equals', value: true }],
          sorts: [{ fieldName: 'follow_up_date', direction: 'asc' }],
        },
      ],
    },
  ],

  relationships: [
    // Arrestee -> Case (many-to-one: arrestee assigned to a case)
    {
      sourceTable: 'arrestees',
      sourceField: 'case_id',
      targetTable: 'cases',
      targetField: 'case_name',
      type: 'many-to-one',
      label: 'Case',
      required: false,
      onDelete: 'set-null',
    },
    // Arrestee -> Lawyer (many-to-one: arrestee assigned to a lawyer)
    {
      sourceTable: 'arrestees',
      sourceField: 'assigned_lawyer',
      targetTable: 'lawyers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Assigned Lawyer',
      required: false,
      onDelete: 'set-null',
    },
    // Case -> Lawyer (many-to-one: case assigned to lead lawyer)
    {
      sourceTable: 'cases',
      sourceField: 'assigned_lawyer',
      targetTable: 'lawyers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Lead Attorney',
      required: false,
      onDelete: 'set-null',
    },
    // Court Date -> Case
    {
      sourceTable: 'court_dates',
      sourceField: 'case_id',
      targetTable: 'cases',
      targetField: 'case_name',
      type: 'many-to-one',
      label: 'Case',
      required: true,
      onDelete: 'cascade',
    },
    // Communication -> Arrestee
    {
      sourceTable: 'communications',
      sourceField: 'arrestee_id',
      targetTable: 'arrestees',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Arrestee',
      required: false,
      onDelete: 'set-null',
    },
    // Communication -> Case
    {
      sourceTable: 'communications',
      sourceField: 'case_id',
      targetTable: 'cases',
      targetField: 'case_name',
      type: 'many-to-one',
      label: 'Case',
      required: false,
      onDelete: 'set-null',
    },
    // Communication -> Lawyer
    {
      sourceTable: 'communications',
      sourceField: 'lawyer_id',
      targetTable: 'lawyers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Lawyer',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'lawyers',
        records: [
          {
            full_name: 'Jane Smith',
            firm: 'NLG New York',
            bar_number: 'NY-123456',
            phone: '555-0101',
            email: 'jsmith@nlg.org',
            specialties: ['criminal_defense', 'civil_rights', 'first_amendment'],
            availability: 'available',
            pro_bono: true,
            max_cases: 5,
          },
          {
            full_name: 'Michael Chen',
            firm: 'Civil Liberties Union',
            bar_number: 'NY-789012',
            phone: '555-0102',
            email: 'mchen@clu.org',
            specialties: ['criminal_defense', 'police_misconduct'],
            availability: 'limited',
            pro_bono: true,
            max_cases: 3,
          },
        ],
      },
    ],
  },
};
