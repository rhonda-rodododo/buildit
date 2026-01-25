/**
 * Community Self-Defense CRM Template
 * For organizing safety marshals and de-escalation teams
 *
 * Tables:
 * - Volunteers: Personnel with training and availability
 * - Trainings: Training sessions and workshops
 * - Training_Attendance: Track who attended which trainings
 * - Deployments: Event deployments and assignments
 * - Incidents: Incident reports and documentation
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const selfDefenseTemplate: CRMMultiTableTemplate = {
  id: 'self-defense',
  name: 'Community Self-Defense',
  description:
    'Track safety volunteers, de-escalation training, deployments, and incident documentation for community self-defense collectives',
  icon: '🛡️',
  category: 'volunteer',
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
      key: 'volunteers',
      name: 'Volunteers',
      description: 'Safety volunteers and their training status',
      icon: '👤',
      isPrimary: true,
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
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
          name: 'training_level',
          label: 'Training Level',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'new', label: 'New Volunteer' },
              { value: 'basic', label: 'Basic Training' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
              { value: 'trainer', label: 'Trainer' },
            ],
          },
          order: 4,
        },
        {
          name: 'trainings_completed',
          label: 'Trainings Completed',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'orientation', label: 'Orientation' },
              { value: 'de_escalation_basic', label: 'De-escalation Basic' },
              { value: 'de_escalation_advanced', label: 'De-escalation Advanced' },
              { value: 'safety_marshal', label: 'Safety Marshal' },
              { value: 'crowd_management', label: 'Crowd Management' },
              { value: 'legal_rights', label: 'Know Your Rights' },
              { value: 'trauma_informed', label: 'Trauma-Informed Response' },
              { value: 'conflict_resolution', label: 'Conflict Resolution' },
              { value: 'community_defense', label: 'Community Defense' },
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
              { value: 'on_call', label: 'On Call' },
            ],
          },
          order: 6,
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
              { value: 'asl', label: 'ASL' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 7,
        },
        {
          name: 'deployments_count',
          label: 'Deployments',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 8,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 9,
        },
      ],
      defaultViews: [
        {
          name: 'All Volunteers',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'training_level',
              'trainings_completed',
              'availability',
              'deployments_count',
            ],
          },
        },
        {
          name: 'By Training Level',
          type: 'board',
          config: {
            boardGroupBy: 'training_level',
            boardCardTitleField: 'full_name',
            boardCardFields: ['trainings_completed', 'availability'],
          },
        },
        {
          name: 'Available',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'phone', 'training_level', 'languages'],
          },
          filters: [{ fieldName: 'availability', operator: 'equals', value: 'available' }],
        },
        {
          name: 'Contact Directory',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'phone', 'email', 'languages'],
          },
        },
      ],
    },
    {
      key: 'trainings',
      name: 'Trainings',
      description: 'Training sessions and workshops',
      icon: '📚',
      fields: [
        {
          name: 'name',
          label: 'Training Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Training title' },
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
          name: 'location',
          label: 'Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Training location' },
          order: 2,
        },
        {
          name: 'type',
          label: 'Training Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'orientation', label: 'New Volunteer Orientation' },
              { value: 'de_escalation_basic', label: 'De-escalation Basic' },
              { value: 'de_escalation_advanced', label: 'De-escalation Advanced' },
              { value: 'safety_marshal', label: 'Safety Marshal Training' },
              { value: 'crowd_management', label: 'Crowd Management' },
              { value: 'legal_rights', label: 'Know Your Rights' },
              { value: 'trauma_informed', label: 'Trauma-Informed Response' },
              { value: 'conflict_resolution', label: 'Conflict Resolution' },
              { value: 'refresher', label: 'Refresher Course' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 3,
        },
        {
          name: 'capacity',
          label: 'Capacity',
          schema: { type: 'number', minimum: 1 },
          widget: { widget: 'number', placeholder: '20' },
          order: 4,
        },
        {
          name: 'registered_count',
          label: 'Registered',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 5,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
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
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: ['name', 'date', 'type', 'location', 'capacity', 'registered_count'],
          },
          sorts: [{ fieldName: 'date', direction: 'asc' }],
          filters: [{ fieldName: 'status', operator: 'equals', value: 'scheduled' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'name',
          },
        },
        {
          name: 'All Trainings',
          type: 'table',
          config: {
            visibleFields: ['name', 'date', 'type', 'status', 'location'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
      ],
    },
    {
      key: 'training_attendance',
      name: 'Training Attendance',
      description: 'Track attendance at trainings',
      icon: '✅',
      fields: [
        {
          name: 'attended',
          label: 'Attended',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 0,
        },
        {
          name: 'passed',
          label: 'Passed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 2,
        },
      ],
      defaultViews: [
        {
          name: 'All Attendance',
          type: 'table',
          config: {
            visibleFields: ['attended', 'passed', 'notes'],
          },
        },
      ],
    },
    {
      key: 'deployments',
      name: 'Deployments',
      description: 'Event deployments and volunteer assignments',
      icon: '📋',
      fields: [
        {
          name: 'event_name',
          label: 'Event Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Event or action name' },
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
          name: 'location',
          label: 'Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Event location' },
          order: 2,
        },
        {
          name: 'event_type',
          label: 'Event Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'march', label: 'March/Rally' },
              { value: 'direct_action', label: 'Direct Action' },
              { value: 'community_event', label: 'Community Event' },
              { value: 'counter_protest', label: 'Counter-Protest' },
              { value: 'encampment', label: 'Encampment' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 3,
        },
        {
          name: 'volunteers_needed',
          label: 'Volunteers Needed',
          schema: { type: 'number', minimum: 1 },
          widget: { widget: 'number', placeholder: '10' },
          order: 4,
        },
        {
          name: 'volunteers_assigned_count',
          label: 'Volunteers Assigned',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 5,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'planning', label: 'Planning' },
              { value: 'needs_volunteers', label: 'Needs Volunteers' },
              { value: 'staffed', label: 'Fully Staffed' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
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
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: [
              'event_name',
              'date',
              'location',
              'event_type',
              'volunteers_needed',
              'status',
            ],
          },
          sorts: [{ fieldName: 'date', direction: 'asc' }],
          filters: [{ fieldName: 'status', operator: 'not_equals', value: 'completed' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'event_name',
          },
        },
        {
          name: 'Needs Volunteers',
          type: 'table',
          config: {
            visibleFields: [
              'event_name',
              'date',
              'volunteers_needed',
              'volunteers_assigned_count',
            ],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'needs_volunteers' }],
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'event_name',
            boardCardFields: ['date', 'volunteers_needed'],
          },
        },
      ],
    },
    {
      key: 'incidents',
      name: 'Incidents',
      description: 'Incident reports and documentation',
      icon: '⚠️',
      fields: [
        {
          name: 'date',
          label: 'Date & Time',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 0,
        },
        {
          name: 'type',
          label: 'Incident Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'confrontation', label: 'Confrontation' },
              { value: 'de_escalation', label: 'De-escalation Situation' },
              { value: 'police_interaction', label: 'Police Interaction' },
              { value: 'medical', label: 'Medical Emergency' },
              { value: 'safety_concern', label: 'Safety Concern' },
              { value: 'threat', label: 'Threat' },
              { value: 'assault', label: 'Assault' },
              { value: 'property_damage', label: 'Property Damage' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 1,
        },
        {
          name: 'severity',
          label: 'Severity',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'low', label: 'Low - Minor Issue' },
              { value: 'medium', label: 'Medium - Significant' },
              { value: 'high', label: 'High - Serious' },
              { value: 'critical', label: 'Critical - Emergency' },
            ],
          },
          order: 2,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string', required: true },
          widget: { widget: 'textarea', placeholder: 'Describe what happened' },
          order: 3,
        },
        {
          name: 'response',
          label: 'Response Taken',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'What actions were taken?' },
          order: 4,
        },
        {
          name: 'follow_up_needed',
          label: 'Follow-up Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'follow_up_notes',
          label: 'Follow-up Notes',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'What follow-up is needed?' },
          order: 6,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'reported', label: 'Reported' },
              { value: 'under_review', label: 'Under Review' },
              { value: 'follow_up', label: 'Follow-up Required' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          order: 7,
        },
      ],
      defaultViews: [
        {
          name: 'All Incidents',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'severity', 'description', 'status'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'type',
            boardCardTitleField: 'description',
            boardCardFields: ['date', 'severity'],
          },
        },
        {
          name: 'Needs Follow-up',
          type: 'table',
          config: {
            visibleFields: ['date', 'type', 'description', 'follow_up_notes'],
          },
          filters: [{ fieldName: 'follow_up_needed', operator: 'equals', value: true }],
        },
        {
          name: 'By Severity',
          type: 'board',
          config: {
            boardGroupBy: 'severity',
            boardCardTitleField: 'type',
            boardCardFields: ['date', 'status'],
          },
        },
      ],
    },
  ],

  relationships: [
    // Training Attendance -> Volunteer
    {
      sourceTable: 'training_attendance',
      sourceField: 'volunteer_id',
      targetTable: 'volunteers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Volunteer',
      required: true,
      onDelete: 'cascade',
    },
    // Training Attendance -> Training
    {
      sourceTable: 'training_attendance',
      sourceField: 'training_id',
      targetTable: 'trainings',
      targetField: 'name',
      type: 'many-to-one',
      label: 'Training',
      required: true,
      onDelete: 'cascade',
    },
    // Training -> Trainer (volunteer who leads the training)
    {
      sourceTable: 'trainings',
      sourceField: 'trainer_id',
      targetTable: 'volunteers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Trainer',
      required: false,
      onDelete: 'set-null',
    },
    // Incident -> Deployment (which event did this occur at)
    {
      sourceTable: 'incidents',
      sourceField: 'event_id',
      targetTable: 'deployments',
      targetField: 'event_name',
      type: 'many-to-one',
      label: 'Related Event',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'volunteers',
        records: [
          {
            full_name: 'Sam Martinez',
            phone: '555-0301',
            email: 'sam@safety.org',
            training_level: 'advanced',
            trainings_completed: [
              'orientation',
              'de_escalation_basic',
              'de_escalation_advanced',
              'safety_marshal',
              'legal_rights',
            ],
            availability: 'available',
            languages: ['english', 'spanish'],
            deployments_count: 15,
          },
          {
            full_name: 'Taylor Kim',
            phone: '555-0302',
            email: 'taylor@safety.org',
            training_level: 'trainer',
            trainings_completed: [
              'orientation',
              'de_escalation_basic',
              'de_escalation_advanced',
              'safety_marshal',
              'crowd_management',
              'conflict_resolution',
            ],
            availability: 'available',
            languages: ['english'],
            deployments_count: 25,
          },
        ],
      },
    ],
  },
};
