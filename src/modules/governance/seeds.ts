/**
 * Governance Module Seed Data
 * Provides example/template data for the governance module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBProposal } from './schema';
import { mediaCollectiveGovernanceSeeds } from './templates/mediaCollectiveSeeds';

import { logger } from '@/lib/logger';
/**
 * Seed data for governance module
 */
export const governanceSeeds: ModuleSeed[] = [
  ...mediaCollectiveGovernanceSeeds,
  {
    name: 'comprehensive-proposals',
    description: 'Example proposals demonstrating all voting methods and statuses',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const exampleProposals: DBProposal[] = [
        // DRAFT PROPOSALS
        {
          id: `proposal-draft-1-${groupId}`,
          groupId,
          title: 'Establish Conflict Resolution Committee',
          description: `## Proposal

Create a standing committee to handle internal conflicts and facilitate restorative justice processes.

## Committee Structure
- 5 rotating members
- 6-month terms
- Training in mediation and restorative practices required

## Responsibilities
- Mediate interpersonal conflicts
- Facilitate accountability processes
- Recommend policy changes to prevent future conflicts

Still gathering input before moving to discussion phase.`,
          status: 'draft',
          votingMethod: 'consensus',
          authorPubkey: userPubkey,
          created: now - 3 * day,
          updated: now - 3 * day,
        },

        // DISCUSSION PHASE
        {
          id: `proposal-discussion-simple-${groupId}`,
          groupId,
          title: 'Adopt Code of Conduct',
          description: `## Proposal

Formally adopt a code of conduct for all group spaces and events.

## Key Points
- Prohibits harassment, discrimination, oppressive behavior
- Establishes clear reporting procedures
- Outlines accountability processes
- Applies to online and offline spaces

## Discussion Period
Please review the full draft and provide feedback before we move to vote.`,
          status: 'discussion',
          votingMethod: 'simple',
          votingDeadline: now + 7 * day,
          authorPubkey: userPubkey,
          created: now - 5 * day,
          updated: now - 5 * day,
        },
        {
          id: `proposal-discussion-consensus-${groupId}`,
          groupId,
          title: 'Adopt Consensus Decision-Making Process',
          description: `## Proposal

Adopt consensus-based decision making for all major group decisions.

## Process Overview
1. Proposal introduced and clarified
2. Discussion and concerns raised
3. Amendments and modifications
4. Consensus test (stand-asides and blocks allowed)
5. Final decision

## Major Decisions Include
- Policy changes
- Budget allocations over $500
- Strategic direction
- Membership issues

## Minor Decisions
Can still use majority vote for routine/operational matters.`,
          status: 'discussion',
          votingMethod: 'consensus',
          votingDeadline: now + 10 * day,
          authorPubkey: userPubkey,
          created: now - 8 * day,
          updated: now - 8 * day,
        },

        // ACTIVE VOTING
        {
          id: `proposal-voting-simple-${groupId}`,
          groupId,
          title: 'Community Garden Project',
          description: `## Proposal

Establish a community garden on the vacant lot at 5th and Oak.

## Details
- Partner with land trust for lot access
- Initial setup: $2000 (from general fund)
- Ongoing maintenance: volunteer-run
- Produce distributed via mutual aid network

## Vote
Simple majority required. Voting ends in 5 days.`,
          status: 'voting',
          votingMethod: 'simple',
          votingDeadline: now + 5 * day,
          authorPubkey: userPubkey,
          created: now - 7 * day,
          updated: now - 7 * day,
        },
        {
          id: `proposal-voting-ranked-${groupId}`,
          groupId,
          title: 'Choose New Meeting Location',
          description: `## Proposal

Our current meeting space is no longer available. Rank your preferences for our new location.

## Options
1. **Community Center** - Free, but limited availability
2. **Public Library** - Convenient, but closes at 8pm
3. **Union Hall** - Great space, $50/meeting fee
4. **Rotating homes** - Free and flexible, less formal

Rank all options in order of preference. We'll use ranked-choice voting to determine the winner.`,
          status: 'voting',
          votingMethod: 'ranked-choice',
          votingDeadline: now + 4 * day,
          authorPubkey: userPubkey,
          created: now - 6 * day,
          updated: now - 6 * day,
        },
        {
          id: `proposal-voting-quadratic-${groupId}`,
          groupId,
          title: 'Budget Allocation for Quarter',
          description: `## Proposal

Allocate $5000 quarterly budget across these initiatives. Use quadratic voting to express preference intensity.

## Budget Categories
- **Mutual Aid Fund** - Direct assistance to community members
- **Campaign Materials** - Printing, supplies, outreach materials
- **Skill Shares & Training** - Workshops, security training, etc.
- **Solidarity Actions** - Support for other movements
- **Technology** - Website, tools, infrastructure

You have 100 vote credits. Cost per vote increases quadratically (1 vote = 1 credit, 2 votes = 4 credits, 3 votes = 9 credits, etc.)`,
          status: 'voting',
          votingMethod: 'quadratic',
          votingDeadline: now + 6 * day,
          authorPubkey: userPubkey,
          created: now - 4 * day,
          updated: now - 4 * day,
        },

        // DECIDED/COMPLETED
        {
          id: `proposal-decided-1-${groupId}`,
          groupId,
          title: 'Solidarity with Tenant Union',
          description: `## Proposal

Formally endorse and provide support to the Riverside Tenant Union in their ongoing rent strike.

## Support Includes
- Social media amplification
- Presence at actions
- Mutual aid coordination
- Resource sharing

## Result
**PASSED** - Consensus achieved with 2 stand-asides, no blocks.`,
          status: 'decided',
          votingMethod: 'consensus',
          votingDeadline: now - 2 * day,
          authorPubkey: userPubkey,
          created: now - 15 * day,
          updated: now - 15 * day,
        },
        {
          id: `proposal-decided-2-${groupId}`,
          groupId,
          title: 'Monthly Dues Structure',
          description: `## Proposal

Implement sliding-scale monthly dues to support group operations.

## Proposed Structure
- $0-10/month - Low income, students, unemployed
- $10-25/month - Standard contribution
- $25+/month - Solidarity rate for those who can pay more

All amounts voluntary, no one turned away for lack of funds.

## Result
**PASSED** - 87% in favor, 13% opposed.`,
          status: 'decided',
          votingMethod: 'simple',
          votingDeadline: now - 10 * day,
          authorPubkey: userPubkey,
          created: now - 25 * day,
          updated: now - 25 * day,
        },
        {
          id: `proposal-decided-dhondt-${groupId}`,
          groupId,
          title: 'Delegate Selection for Coalition',
          description: `## Proposal

Select 5 delegates to represent us in the Housing Justice Coalition using D'Hondt proportional method.

## Candidates
- Alice (Tenant Rights Caucus)
- Bob (Mutual Aid Caucus)
- Carol (Direct Action Caucus)
- David (Tenant Rights Caucus)
- Eve (Policy Caucus)

## Result
**COMPLETED** - Delegates selected proportionally based on caucus strength:
1. Alice
2. Bob
3. David
4. Carol
5. Eve`,
          status: 'decided',
          votingMethod: 'dhondt',
          votingDeadline: now - 20 * day,
          authorPubkey: userPubkey,
          created: now - 35 * day,
          updated: now - 35 * day,
        },
      ];

      await db.proposals?.bulkAdd(exampleProposals);
      logger.info(`Seeded ${exampleProposals.length} proposals demonstrating all voting methods for group ${groupId}`);
    },
  },
];
