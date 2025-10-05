/**
 * Custom Fields Module Seed Data
 * Provides example/template data for the custom fields module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBCustomField } from './schema';

/**
 * Seed data for custom fields module
 */
export const customFieldsSeeds: ModuleSeed[] = [
  {
    name: 'example-event-fields',
    description: 'Example custom fields for events',
    data: async (db, groupId, userPubkey) => {
      const exampleFields: DBCustomField[] = [
        {
          id: `field-dietary-${groupId}`,
          groupId,
          entityType: 'event',
          name: 'dietary_preferences',
          label: 'Dietary Preferences',
          schema: JSON.stringify({
            type: 'array',
            title: 'Dietary Preferences',
            description: 'Select any dietary restrictions or preferences',
            items: { type: 'string' },
            uniqueItems: true,
          }),
          widget: JSON.stringify({
            widget: 'multi-select',
            options: [
              { value: 'vegetarian', label: 'Vegetarian' },
              { value: 'vegan', label: 'Vegan' },
              { value: 'gluten-free', label: 'Gluten-Free' },
              { value: 'dairy-free', label: 'Dairy-Free' },
              { value: 'nut-allergy', label: 'Nut Allergy' },
              { value: 'none', label: 'None' },
            ],
            helpText: 'This helps us plan appropriate food options',
          }),
          order: 1,
          created: Date.now(),
          createdBy: userPubkey,
          updated: Date.now(),
        },
        {
          id: `field-skills-${groupId}`,
          groupId,
          entityType: 'event',
          name: 'skills_needed',
          label: 'Skills Needed',
          schema: JSON.stringify({
            type: 'array',
            title: 'Skills Needed',
            description: 'What skills are needed for this event',
            items: { type: 'string' },
          }),
          widget: JSON.stringify({
            widget: 'multi-select',
            options: [
              { value: 'organizing', label: 'Organizing' },
              { value: 'tech', label: 'Tech Support' },
              { value: 'legal', label: 'Legal' },
              { value: 'first-aid', label: 'First Aid' },
              { value: 'translation', label: 'Translation' },
              { value: 'media', label: 'Media' },
            ],
          }),
          order: 2,
          created: Date.now(),
          createdBy: userPubkey,
          updated: Date.now(),
        },
        {
          id: `field-transportation-${groupId}`,
          groupId,
          entityType: 'event',
          name: 'transportation_needed',
          label: 'Transportation Needed',
          schema: JSON.stringify({
            type: 'string',
            title: 'Transportation',
            enum: ['yes', 'no', 'can-provide'],
            enumLabels: ['Yes, I need a ride', 'No, I have transportation', 'I can provide rides'],
          }),
          widget: JSON.stringify({
            widget: 'radio',
            options: [
              { value: 'yes', label: 'Yes, I need a ride' },
              { value: 'no', label: 'No, I have transportation' },
              { value: 'can-provide', label: 'I can provide rides' },
            ],
          }),
          order: 3,
          created: Date.now(),
          createdBy: userPubkey,
          updated: Date.now(),
        },
      ];

      await db.customFields.bulkAdd(exampleFields);
      console.log(`Seeded ${exampleFields.length} example custom fields for group ${groupId}`);
    },
  },
];
