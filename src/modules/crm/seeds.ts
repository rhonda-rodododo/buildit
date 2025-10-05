/**
 * CRM Module Seed Data
 * Provides example/template data for the CRM module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBContact } from './schema';

/**
 * Seed data for CRM module
 */
export const crmSeeds: ModuleSeed[] = [
  {
    name: 'example-contacts',
    description: 'Example contacts for demonstration',
    data: async (db, groupId, _userPubkey) => {
      const exampleContacts: DBContact[] = [
        {
          id: `example-contact-1-${groupId}`,
          groupId,
          name: 'Jane Organizer',
          email: 'jane@example.com',
          phone: '555-0100',
          notes: 'Experienced union organizer, contact for labor campaigns',
          customFields: {
            role: 'Organizer',
            availability: 'Weekends',
            skills: ['Public Speaking', 'Strategy', 'Training'],
          },
          tags: ['organizer', 'labor', 'volunteer'],
          created: Date.now(),
          updated: Date.now(),
        },
        {
          id: `example-contact-2-${groupId}`,
          groupId,
          name: 'Alex Coordinator',
          email: 'alex@example.com',
          notes: 'Handles event logistics and mutual aid coordination',
          customFields: {
            role: 'Coordinator',
            availability: 'Flexible',
            skills: ['Logistics', 'Communication', 'Problem Solving'],
          },
          tags: ['coordinator', 'events', 'mutual-aid'],
          created: Date.now(),
          updated: Date.now(),
        },
      ];

      await db.contacts.bulkAdd(exampleContacts);
      console.log(`Seeded ${exampleContacts.length} example contacts for group ${groupId}`);
    },
  },
];
