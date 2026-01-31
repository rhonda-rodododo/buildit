/**
 * Governance Module Seed Data
 * Provides example/template data for the governance module
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import type { DBProposal } from './schema';
import { mediaCollectiveGovernanceSeeds } from './templates/mediaCollectiveSeeds';

import { logger } from '@/lib/logger';

/** Helper to create default Yes/No/Abstain vote options */
function defaultOptions() {
  return [
    { id: crypto.randomUUID(), label: 'Yes', order: 0 },
    { id: crypto.randomUUID(), label: 'No', order: 1 },
    { id: crypto.randomUUID(), label: 'Abstain', order: 2 },
  ];
}

/** Helper to create consensus options */
function consensusOptions() {
  return [
    { id: crypto.randomUUID(), label: 'Support', order: 0 },
    { id: crypto.randomUUID(), label: 'Stand aside', order: 1 },
    { id: crypto.randomUUID(), label: 'Block', order: 2 },
  ];
}

/**
 * Generic governance demo seed for activist collective and union templates
 */
const governanceDemoSeed: ModuleSeed = {
  name: 'governance-demo',
  description: 'General governance proposals for activist collectives and organizing groups',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const proposals: DBProposal[] = [
      {
        _v: '1.0.0',
        id: `proposal-demo-coc-${groupId}`,
        groupId,
        title: 'Adopt Code of Conduct',
        description: `## Proposal\n\nFormally adopt a code of conduct for all group spaces and events.\n\n## Key Points\n- Prohibits harassment, discrimination, and oppressive behavior\n- Clear reporting procedures\n- Accountability processes with restorative justice approach\n- Applies to online and offline spaces\n\nPlease review and provide feedback.`,
        type: 'policy',
        status: 'discussion',
        votingSystem: 'consensus',
        options: consensusOptions(),
        votingPeriod: { startsAt: now, endsAt: now + 7 * day },
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * day,
      },
      {
        _v: '1.0.0',
        id: `proposal-demo-budget-${groupId}`,
        groupId,
        title: 'Quarterly Budget Allocation',
        description: `## Proposal\n\nAllocate $3,000 quarterly budget:\n\n- **Mutual Aid Fund**: $1,200\n- **Campaign Materials**: $600\n- **Skill Shares & Training**: $500\n- **Solidarity Actions**: $400\n- **Technology & Infrastructure**: $300\n\nUse quadratic voting to express preference intensity.`,
        type: 'budget',
        status: 'voting',
        votingSystem: 'quadratic',
        options: [
          { id: crypto.randomUUID(), label: 'Mutual Aid Fund', order: 0 },
          { id: crypto.randomUUID(), label: 'Campaign Materials', order: 1 },
          { id: crypto.randomUUID(), label: 'Skill Shares & Training', order: 2 },
          { id: crypto.randomUUID(), label: 'Solidarity Actions', order: 3 },
          { id: crypto.randomUUID(), label: 'Technology & Infrastructure', order: 4 },
        ],
        votingPeriod: { startsAt: now - 2 * day, endsAt: now + 5 * day },
        createdBy: userPubkey,
        createdAt: now - 4 * day,
        updatedAt: now - 4 * day,
      },
      {
        _v: '1.0.0',
        id: `proposal-demo-solidarity-${groupId}`,
        groupId,
        title: 'Solidarity Statement with Tenant Union',
        description: `## Proposal\n\nEndorse and support the Riverside Tenant Union in their rent strike.\n\n## Support Includes\n- Social media amplification\n- Presence at actions\n- Mutual aid coordination\n\n## Result\n**PASSED** - Consensus achieved.`,
        type: 'resolution',
        status: 'passed',
        votingSystem: 'consensus',
        options: consensusOptions(),
        votingPeriod: { startsAt: now - 10 * day, endsAt: now - 5 * day },
        createdBy: userPubkey,
        createdAt: now - 20 * day,
        updatedAt: now - 5 * day,
      },
    ];

    await dal.bulkPut('proposals', proposals);
    logger.info(`Seeded ${proposals.length} governance demo proposals for group ${groupId}`);
  },
};

export const governanceSeeds: ModuleSeed[] = [
  governanceDemoSeed,
  ...mediaCollectiveGovernanceSeeds,
  {
    name: 'comprehensive-proposals',
    description: 'Example proposals demonstrating all voting methods and statuses',
    data: async (groupId, userPubkey) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const exampleProposals: DBProposal[] = [
        // DRAFT PROPOSALS
        {
          _v: '1.0.0',
          id: `proposal-draft-1-${groupId}`,
          groupId,
          title: 'Establish Conflict Resolution Committee',
          description: `## Proposal\n\nCreate a standing committee to handle internal conflicts and facilitate restorative justice processes.\n\n## Committee Structure\n- 5 rotating members\n- 6-month terms\n- Training in mediation and restorative practices required\n\n## Responsibilities\n- Mediate interpersonal conflicts\n- Facilitate accountability processes\n- Recommend policy changes to prevent future conflicts\n\nStill gathering input before moving to discussion phase.`,
          type: 'policy',
          status: 'draft',
          votingSystem: 'consensus',
          options: consensusOptions(),
          votingPeriod: { startsAt: now + 7 * day, endsAt: now + 14 * day },
          createdBy: userPubkey,
          createdAt: now - 3 * day,
        },

        // DISCUSSION PHASE
        {
          _v: '1.0.0',
          id: `proposal-discussion-simple-${groupId}`,
          groupId,
          title: 'Adopt Code of Conduct',
          description: `## Proposal\n\nFormally adopt a code of conduct for all group spaces and events.\n\n## Key Points\n- Prohibits harassment, discrimination, oppressive behavior\n- Establishes clear reporting procedures\n- Outlines accountability processes\n- Applies to online and offline spaces\n\n## Discussion Period\nPlease review the full draft and provide feedback before we move to vote.`,
          type: 'policy',
          status: 'discussion',
          votingSystem: 'simple-majority',
          options: defaultOptions(),
          votingPeriod: { startsAt: now + 2 * day, endsAt: now + 7 * day },
          createdBy: userPubkey,
          createdAt: now - 5 * day,
          updatedAt: now - 5 * day,
        },

        // ACTIVE VOTING
        {
          _v: '1.0.0',
          id: `proposal-voting-simple-${groupId}`,
          groupId,
          title: 'Community Garden Project',
          description: `## Proposal\n\nEstablish a community garden on the vacant lot at 5th and Oak.\n\n## Details\n- Partner with land trust for lot access\n- Initial setup: $2000 (from general fund)\n- Ongoing maintenance: volunteer-run\n- Produce distributed via mutual aid network\n\n## Vote\nSimple majority required. Voting ends in 5 days.`,
          type: 'action',
          status: 'voting',
          votingSystem: 'simple-majority',
          options: defaultOptions(),
          votingPeriod: { startsAt: now - 2 * day, endsAt: now + 5 * day },
          createdBy: userPubkey,
          createdAt: now - 7 * day,
          updatedAt: now - 7 * day,
        },
        {
          _v: '1.0.0',
          id: `proposal-voting-ranked-${groupId}`,
          groupId,
          title: 'Choose New Meeting Location',
          description: `## Proposal\n\nOur current meeting space is no longer available. Rank your preferences.\n\n## Options\n1. **Community Center** - Free, limited availability\n2. **Public Library** - Convenient, closes at 8pm\n3. **Union Hall** - Great space, $50/meeting\n4. **Rotating homes** - Free, flexible, less formal`,
          type: 'general',
          status: 'voting',
          votingSystem: 'ranked-choice',
          options: [
            { id: crypto.randomUUID(), label: 'Community Center', order: 0 },
            { id: crypto.randomUUID(), label: 'Public Library', order: 1 },
            { id: crypto.randomUUID(), label: 'Union Hall', order: 2 },
            { id: crypto.randomUUID(), label: 'Rotating homes', order: 3 },
          ],
          votingPeriod: { startsAt: now - 2 * day, endsAt: now + 4 * day },
          createdBy: userPubkey,
          createdAt: now - 6 * day,
          updatedAt: now - 6 * day,
        },

        // DECIDED/COMPLETED
        {
          _v: '1.0.0',
          id: `proposal-decided-1-${groupId}`,
          groupId,
          title: 'Solidarity with Tenant Union',
          description: `## Proposal\n\nFormally endorse and provide support to the Riverside Tenant Union.\n\n## Result\n**PASSED** - Consensus achieved with 2 stand-asides, no blocks.`,
          type: 'resolution',
          status: 'passed',
          votingSystem: 'consensus',
          options: consensusOptions(),
          votingPeriod: { startsAt: now - 10 * day, endsAt: now - 2 * day },
          createdBy: userPubkey,
          createdAt: now - 15 * day,
          updatedAt: now - 15 * day,
        },
        {
          _v: '1.0.0',
          id: `proposal-decided-2-${groupId}`,
          groupId,
          title: 'Monthly Dues Structure',
          description: `## Proposal\n\nImplement sliding-scale monthly dues to support group operations.\n\n## Result\n**PASSED** - 87% in favor, 13% opposed.`,
          type: 'budget',
          status: 'passed',
          votingSystem: 'simple-majority',
          options: defaultOptions(),
          votingPeriod: { startsAt: now - 15 * day, endsAt: now - 10 * day },
          createdBy: userPubkey,
          createdAt: now - 25 * day,
          updatedAt: now - 25 * day,
        },
        {
          _v: '1.0.0',
          id: `proposal-decided-dhondt-${groupId}`,
          groupId,
          title: 'Delegate Selection for Coalition',
          description: `## Proposal\n\nSelect 5 delegates to represent us in the Housing Justice Coalition using D'Hondt proportional method.\n\n## Result\n**COMPLETED** - Delegates selected proportionally based on caucus strength.`,
          type: 'election',
          status: 'passed',
          votingSystem: 'd-hondt',
          options: [
            { id: crypto.randomUUID(), label: 'Alice (Tenant Rights Caucus)', order: 0 },
            { id: crypto.randomUUID(), label: 'Bob (Mutual Aid Caucus)', order: 1 },
            { id: crypto.randomUUID(), label: 'Carol (Direct Action Caucus)', order: 2 },
            { id: crypto.randomUUID(), label: 'David (Tenant Rights Caucus)', order: 3 },
            { id: crypto.randomUUID(), label: 'Eve (Policy Caucus)', order: 4 },
          ],
          votingPeriod: { startsAt: now - 25 * day, endsAt: now - 20 * day },
          createdBy: userPubkey,
          createdAt: now - 35 * day,
          updatedAt: now - 35 * day,
        },
      ];

      await dal.bulkPut('proposals', exampleProposals);
      logger.info(`Seeded ${exampleProposals.length} proposals demonstrating all voting methods for group ${groupId}`);
    },
  },
];
