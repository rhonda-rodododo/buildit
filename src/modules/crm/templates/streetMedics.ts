/**
 * Street Medics CRM Template
 * For organizing and tracking street medics, trainings, deployments, and supplies
 *
 * Tables:
 * - Medics: Personnel with certifications and availability
 * - Trainings: Training sessions and workshops
 * - Training_Attendance: Track who attended which trainings
 * - Deployments: Event deployments and assignments
 * - Supply_Inventory: Medical supplies and equipment tracking
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const streetMedicsTemplate: CRMMultiTableTemplate = {
  id: 'street-medics',
  name: 'Street Medics',
  description:
    'Track medics, certifications, trainings, deployments, and medical supplies for street medic collectives',
  icon: '🏥',
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
      key: 'medics',
      name: 'Medics',
      description: 'Street medics and their certifications',
      icon: '👩‍⚕️',
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
          name: 'certification_level',
          label: 'Certification Level',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'trainee', label: 'Trainee' },
              { value: 'basic', label: 'Basic First Aid' },
              { value: 'street_medic', label: 'Street Medic' },
              { value: 'emt', label: 'EMT' },
              { value: 'paramedic', label: 'Paramedic' },
              { value: 'nurse', label: 'Nurse' },
              { value: 'doctor', label: 'Doctor' },
            ],
          },
          order: 4,
        },
        {
          name: 'certifications',
          label: 'Certifications',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'cpr', label: 'CPR' },
              { value: 'aed', label: 'AED' },
              { value: 'first_aid', label: 'First Aid' },
              { value: 'wilderness_first_aid', label: 'Wilderness First Aid' },
              { value: 'street_medic_basic', label: 'Street Medic Basic' },
              { value: 'street_medic_advanced', label: 'Street Medic Advanced' },
              { value: 'trauma', label: 'Trauma Care' },
              { value: 'pepper_spray', label: 'Chemical Agent Treatment' },
              { value: 'mental_health', label: 'Mental Health First Aid' },
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
          name: 'specialties',
          label: 'Specialties',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'trauma', label: 'Trauma' },
              { value: 'chemical_exposure', label: 'Chemical Exposure' },
              { value: 'mental_health', label: 'Mental Health' },
              { value: 'pediatric', label: 'Pediatric' },
              { value: 'chronic_conditions', label: 'Chronic Conditions' },
              { value: 'harm_reduction', label: 'Harm Reduction' },
            ],
          },
          order: 8,
        },
        {
          name: 'training_status',
          label: 'Training Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'needs_training', label: 'Needs Training' },
              { value: 'in_training', label: 'In Training' },
              { value: 'trained', label: 'Fully Trained' },
              { value: 'trainer', label: 'Can Train Others' },
            ],
          },
          order: 9,
        },
        {
          name: 'deployed_events',
          label: 'Deployments Count',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 10,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 11,
        },
      ],
      defaultViews: [
        {
          name: 'All Medics',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'certification_level',
              'certifications',
              'availability',
              'training_status',
            ],
          },
        },
        {
          name: 'By Certification',
          type: 'board',
          config: {
            boardGroupBy: 'certification_level',
            boardCardTitleField: 'full_name',
            boardCardFields: ['certifications', 'availability'],
          },
        },
        {
          name: 'Available',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'phone',
              'certification_level',
              'specialties',
              'languages',
            ],
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
              { value: 'first_aid_basic', label: 'First Aid Basic' },
              { value: 'first_aid_advanced', label: 'First Aid Advanced' },
              { value: 'street_medic_basic', label: 'Street Medic Basic' },
              { value: 'street_medic_advanced', label: 'Street Medic Advanced' },
              { value: 'cpr_aed', label: 'CPR/AED' },
              { value: 'chemical_agents', label: 'Chemical Agent Response' },
              { value: 'trauma', label: 'Trauma Care' },
              { value: 'mental_health', label: 'Mental Health First Aid' },
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
      description: 'Track attendance and certifications earned',
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
          name: 'certification_earned',
          label: 'Certification Earned',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'cpr', label: 'CPR' },
              { value: 'first_aid', label: 'First Aid' },
              { value: 'street_medic_basic', label: 'Street Medic Basic' },
              { value: 'street_medic_advanced', label: 'Street Medic Advanced' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 2,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 3,
        },
      ],
      defaultViews: [
        {
          name: 'All Attendance',
          type: 'table',
          config: {
            visibleFields: ['attended', 'passed', 'certification_earned', 'notes'],
          },
        },
      ],
    },
    {
      key: 'deployments',
      name: 'Deployments',
      description: 'Event deployments and medic assignments',
      icon: '🚑',
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
              { value: 'encampment', label: 'Encampment' },
              { value: 'training', label: 'Training Event' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 3,
        },
        {
          name: 'medics_needed',
          label: 'Medics Needed',
          schema: { type: 'number', minimum: 1 },
          widget: { widget: 'number', placeholder: '5' },
          order: 4,
        },
        {
          name: 'medics_assigned_count',
          label: 'Medics Assigned',
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
              { value: 'needs_medics', label: 'Needs Medics' },
              { value: 'staffed', label: 'Fully Staffed' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          order: 6,
        },
        {
          name: 'debrief_notes',
          label: 'Debrief Notes',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Post-event debrief and lessons learned' },
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
              'medics_needed',
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
          name: 'Needs Medics',
          type: 'table',
          config: {
            visibleFields: ['event_name', 'date', 'medics_needed', 'medics_assigned_count'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'needs_medics' }],
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'status',
            boardCardTitleField: 'event_name',
            boardCardFields: ['date', 'medics_needed'],
          },
        },
      ],
    },
    {
      key: 'supply_inventory',
      name: 'Supply Inventory',
      description: 'Medical supplies and equipment tracking',
      icon: '📦',
      fields: [
        {
          name: 'item',
          label: 'Item Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Supply item name' },
          order: 0,
        },
        {
          name: 'category',
          label: 'Category',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'bandages', label: 'Bandages & Dressings' },
              { value: 'medications', label: 'Medications' },
              { value: 'tools', label: 'Tools & Equipment' },
              { value: 'ppe', label: 'PPE' },
              { value: 'chemical_treatment', label: 'Chemical Treatment' },
              { value: 'trauma', label: 'Trauma Supplies' },
              { value: 'general', label: 'General Supplies' },
            ],
          },
          order: 1,
        },
        {
          name: 'quantity',
          label: 'Quantity',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '0' },
          order: 2,
        },
        {
          name: 'location',
          label: 'Storage Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Where is this stored?' },
          order: 3,
        },
        {
          name: 'expiration_date',
          label: 'Expiration Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 4,
        },
        {
          name: 'reorder_level',
          label: 'Reorder Level',
          schema: { type: 'number', minimum: 0 },
          widget: { widget: 'number', placeholder: '10' },
          order: 5,
        },
        {
          name: 'needs_reorder',
          label: 'Needs Reorder',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 6,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 7,
        },
      ],
      defaultViews: [
        {
          name: 'All Supplies',
          type: 'table',
          config: {
            visibleFields: [
              'item',
              'category',
              'quantity',
              'location',
              'expiration_date',
              'needs_reorder',
            ],
          },
        },
        {
          name: 'By Category',
          type: 'board',
          config: {
            boardGroupBy: 'category',
            boardCardTitleField: 'item',
            boardCardFields: ['quantity', 'needs_reorder'],
          },
        },
        {
          name: 'Low Stock',
          type: 'table',
          config: {
            visibleFields: ['item', 'category', 'quantity', 'reorder_level', 'location'],
          },
          filters: [{ fieldName: 'needs_reorder', operator: 'equals', value: true }],
        },
        {
          name: 'Expiring Soon',
          type: 'table',
          config: {
            visibleFields: ['item', 'category', 'expiration_date', 'quantity'],
          },
          sorts: [{ fieldName: 'expiration_date', direction: 'asc' }],
        },
      ],
    },
  ],

  relationships: [
    // Training Attendance -> Medic
    {
      sourceTable: 'training_attendance',
      sourceField: 'medic_id',
      targetTable: 'medics',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Medic',
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
    // Training -> Trainer (medic who leads the training)
    {
      sourceTable: 'trainings',
      sourceField: 'trainer_id',
      targetTable: 'medics',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Trainer',
      required: false,
      onDelete: 'set-null',
    },
    // Deployment -> Medics assigned (tracked via deployment_assignments join or count)
    // Note: For simplicity, we track count in the deployment record
    // A more complex implementation would have a deployment_assignments table
  ],

  seedData: {
    items: [
      {
        tableKey: 'medics',
        records: [
          {
            full_name: 'Alex Rivera',
            phone: '555-0201',
            email: 'alex@medics.org',
            certification_level: 'street_medic',
            certifications: ['cpr', 'first_aid', 'street_medic_basic', 'chemical_agents'],
            availability: 'available',
            languages: ['english', 'spanish'],
            specialties: ['trauma', 'chemical_exposure'],
            training_status: 'trainer',
            deployed_events: 12,
          },
          {
            full_name: 'Jordan Chen',
            phone: '555-0202',
            email: 'jordan@medics.org',
            certification_level: 'emt',
            certifications: ['cpr', 'aed', 'first_aid', 'trauma'],
            availability: 'available',
            languages: ['english', 'chinese'],
            specialties: ['trauma', 'chronic_conditions'],
            training_status: 'trained',
            deployed_events: 8,
          },
        ],
      },
      {
        tableKey: 'supply_inventory',
        records: [
          {
            item: 'Gauze Pads (4x4)',
            category: 'bandages',
            quantity: 100,
            location: 'Main Supply Closet',
            reorder_level: 50,
            needs_reorder: false,
          },
          {
            item: 'Saline Solution (bottles)',
            category: 'chemical_treatment',
            quantity: 20,
            location: 'Main Supply Closet',
            reorder_level: 10,
            needs_reorder: false,
          },
          {
            item: 'Nitrile Gloves (boxes)',
            category: 'ppe',
            quantity: 5,
            location: 'Main Supply Closet',
            reorder_level: 10,
            needs_reorder: true,
          },
        ],
      },
    ],
  },
};
