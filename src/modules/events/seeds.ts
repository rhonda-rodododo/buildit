/**
 * Events Module Seed Data
 * Provides example/template data for the events module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBEvent } from './schema';

/**
 * Seed data for events module
 * Can be used for demos, testing, or providing templates
 */
export const eventsSeeds: ModuleSeed[] = [
  {
    name: 'example-events',
    description: 'Example events for demonstration',
    data: async (db, groupId, userPubkey) => {
      const exampleEvents: DBEvent[] = [
        {
          id: `example-event-1-${groupId}`,
          groupId,
          title: 'Community Organizing Workshop',
          description: 'Learn the basics of community organizing and coalition building',
          startTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
          endTime: Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000, // 3 hours duration
          location: 'Community Center, Main St',
          privacy: 'group',
          capacity: 50,
          createdBy: userPubkey,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: 'workshop,organizing,education',
        },
        {
          id: `example-event-2-${groupId}`,
          groupId,
          title: 'Mutual Aid Network Meeting',
          description: 'Monthly meeting to coordinate mutual aid efforts',
          startTime: Date.now() + 14 * 24 * 60 * 60 * 1000, // 2 weeks from now
          endTime: Date.now() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000, // 2 hours duration
          location: 'Online (link will be shared)',
          privacy: 'group',
          createdBy: userPubkey,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: 'meeting,mutual-aid,coordination',
        },
      ];

      // Insert seed data
      await db.events.bulkAdd(exampleEvents);
      console.log(`Seeded ${exampleEvents.length} example events for group ${groupId}`);
    },
  },
];
