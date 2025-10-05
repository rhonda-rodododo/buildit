/**
 * Mutual Aid Module Seed Data
 * Provides example/template data for the mutual aid module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBMutualAidRequest } from './schema';

/**
 * Seed data for mutual aid module
 */
export const mutualAidSeeds: ModuleSeed[] = [
  {
    name: 'example-mutual-aid',
    description: 'Example requests and offers for demonstration',
    data: async (db, groupId, userPubkey) => {
      const exampleRequests: DBMutualAidRequest[] = [
        {
          id: `example-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'food',
          title: 'Food for Community Dinner',
          description: 'Looking for donations of non-perishable food items for our community dinner this weekend',
          status: 'open',
          createdBy: userPubkey,
          created: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        },
        {
          id: `example-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'transport',
          title: 'Ride Share to Rally',
          description: 'Can offer rides to the rally on Saturday, have 3 seats available',
          status: 'open',
          location: 'Downtown',
          createdBy: userPubkey,
          created: Date.now(),
          expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        },
      ];

      await db.mutualAidRequests.bulkAdd(exampleRequests);
      console.log(`Seeded ${exampleRequests.length} example mutual aid items for group ${groupId}`);
    },
  },
];
