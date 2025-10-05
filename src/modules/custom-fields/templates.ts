/**
 * Custom Field Templates
 * Pre-built field sets for common use cases
 */

import type { CustomField, EntityType } from './types';

export interface FieldTemplate {
  id: string;
  name: string;
  description: string;
  entityType: EntityType;
  fields: Omit<CustomField, 'id' | 'groupId' | 'entityType' | 'created' | 'createdBy' | 'updated'>[];
}

/**
 * Event Templates
 */
export const EVENT_TEMPLATES: FieldTemplate[] = [
  {
    id: 'event-dietary',
    name: 'Dietary Preferences',
    description: 'Collect dietary needs for events with food',
    entityType: 'event',
    fields: [
      {
        name: 'dietary_restrictions',
        label: 'Dietary Restrictions',
        schema: {
          type: 'array',
          description: 'Select all that apply',
        },
        widget: {
          widget: 'multi-select',
          options: [
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'gluten-free', label: 'Gluten-Free' },
            { value: 'dairy-free', label: 'Dairy-Free' },
            { value: 'nut-allergy', label: 'Nut Allergy' },
            { value: 'halal', label: 'Halal' },
            { value: 'kosher', label: 'Kosher' },
          ],
          helpText: 'Help us accommodate your dietary needs',
        },
        order: 0,
      },
      {
        name: 'other_allergies',
        label: 'Other Allergies/Notes',
        schema: {
          type: 'string',
          maxLength: 200,
        },
        widget: {
          widget: 'textarea',
          placeholder: 'Any other allergies or dietary notes...',
        },
        order: 1,
      },
    ],
  },
  {
    id: 'event-accessibility',
    name: 'Accessibility Needs',
    description: 'Collect accessibility requirements',
    entityType: 'event',
    fields: [
      {
        name: 'mobility_needs',
        label: 'Mobility Needs',
        schema: {
          type: 'string',
        },
        widget: {
          widget: 'select',
          options: [
            { value: 'none', label: 'No specific needs' },
            { value: 'wheelchair', label: 'Wheelchair accessible required' },
            { value: 'limited-mobility', label: 'Limited mobility' },
            { value: 'assistance', label: 'May need assistance' },
          ],
        },
        order: 0,
      },
      {
        name: 'hearing_needs',
        label: 'Hearing Accommodation',
        schema: {
          type: 'boolean',
        },
        widget: {
          widget: 'checkbox',
          helpText: 'Check if you need ASL interpretation or captioning',
        },
        order: 1,
      },
      {
        name: 'other_accessibility',
        label: 'Other Accessibility Needs',
        schema: {
          type: 'string',
          maxLength: 200,
        },
        widget: {
          widget: 'textarea',
          placeholder: 'Any other accessibility requirements...',
        },
        order: 2,
      },
    ],
  },
  {
    id: 'event-skills',
    name: 'Skills & Experience',
    description: 'Collect participant skills for skill-sharing events',
    entityType: 'event',
    fields: [
      {
        name: 'skill_level',
        label: 'Experience Level',
        schema: {
          type: 'string',
        },
        widget: {
          widget: 'select',
          options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
            { value: 'expert', label: 'Expert/Can Teach' },
          ],
        },
        order: 0,
      },
      {
        name: 'skills_to_share',
        label: 'Skills You Can Share',
        schema: {
          type: 'string',
          maxLength: 300,
        },
        widget: {
          widget: 'textarea',
          placeholder: 'What skills or knowledge can you share with others?',
        },
        order: 1,
      },
    ],
  },
];

/**
 * Mutual Aid Templates
 */
export const MUTUAL_AID_TEMPLATES: FieldTemplate[] = [
  {
    id: 'aid-medical',
    name: 'Medical Support',
    description: 'For medical aid requests/offers',
    entityType: 'aid-request',
    fields: [
      {
        name: 'medical_urgency',
        label: 'Medical Urgency',
        schema: {
          type: 'string',
          required: true,
        },
        widget: {
          widget: 'select',
          options: [
            { value: 'routine', label: 'Routine/Non-urgent' },
            { value: 'soon', label: 'Needed soon (within week)' },
            { value: 'urgent', label: 'Urgent (within 48hrs)' },
            { value: 'emergency', label: 'Emergency' },
          ],
        },
        order: 0,
      },
      {
        name: 'insurance_status',
        label: 'Insurance Status',
        schema: {
          type: 'string',
        },
        widget: {
          widget: 'select',
          options: [
            { value: 'insured', label: 'Insured' },
            { value: 'uninsured', label: 'Uninsured' },
            { value: 'underinsured', label: 'Underinsured' },
            { value: 'prefer-not-say', label: 'Prefer not to say' },
          ],
        },
        order: 1,
      },
    ],
  },
  {
    id: 'aid-housing',
    name: 'Housing Support',
    description: 'For housing aid requests',
    entityType: 'aid-request',
    fields: [
      {
        name: 'household_size',
        label: 'Household Size',
        schema: {
          type: 'number',
          minimum: 1,
          maximum: 20,
        },
        widget: {
          widget: 'number',
          placeholder: 'Number of people',
        },
        order: 0,
      },
      {
        name: 'has_pets',
        label: 'Have Pets',
        schema: {
          type: 'boolean',
        },
        widget: {
          widget: 'checkbox',
        },
        order: 1,
      },
      {
        name: 'accessibility_requirements',
        label: 'Accessibility Requirements',
        schema: {
          type: 'string',
          maxLength: 200,
        },
        widget: {
          widget: 'textarea',
          placeholder: 'Any specific accessibility needs for housing...',
        },
        order: 2,
      },
    ],
  },
];

/**
 * Get templates by entity type
 */
export function getTemplatesByEntityType(entityType: EntityType): FieldTemplate[] {
  switch (entityType) {
    case 'event':
      return EVENT_TEMPLATES;
    case 'aid-request':
    case 'aid-offer':
      return MUTUAL_AID_TEMPLATES;
    default:
      return [];
  }
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): FieldTemplate | undefined {
  return [...EVENT_TEMPLATES, ...MUTUAL_AID_TEMPLATES].find(t => t.id === id);
}
