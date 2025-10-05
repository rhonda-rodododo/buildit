/**
 * Governance Module Seed Data
 * Provides example/template data for the governance module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBProposal } from './schema';

/**
 * Seed data for governance module
 */
export const governanceSeeds: ModuleSeed[] = [
  {
    name: 'example-proposals',
    description: 'Example proposals for demonstration',
    data: async (db, groupId, userPubkey) => {
      const exampleProposals: DBProposal[] = [
        {
          id: `example-proposal-1-${groupId}`,
          groupId,
          title: 'Adopt Consensus Decision-Making Process',
          description: 'Proposal to adopt consensus-based decision making for all major group decisions',
          status: 'discussion',
          votingMethod: 'consensus',
          votingDeadline: Date.now() + 14 * 24 * 60 * 60 * 1000,
          createdBy: userPubkey,
          created: Date.now(),
        },
        {
          id: `example-proposal-2-${groupId}`,
          groupId,
          title: 'Community Garden Project',
          description: 'Should we allocate resources to start a community garden?',
          status: 'draft',
          votingMethod: 'simple',
          createdBy: userPubkey,
          created: Date.now(),
        },
      ];

      await db.proposals.bulkAdd(exampleProposals);
      console.log(`Seeded ${exampleProposals.length} example proposals for group ${groupId}`);
    },
  },
];
