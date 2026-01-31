/**
 * Media Collective Governance Seed Data
 * Demo proposals specific to media collective governance
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import type { DBProposal } from '../schema';

import { logger } from '@/lib/logger';

/** Helper to create Yes/No/Abstain vote options */
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
 * Media Collective Governance Seeds
 * Demonstrates proposal templates specific to journalism collectives
 */
export const mediaCollectiveGovernanceSeeds: ModuleSeed[] = [
  {
    name: 'governance-media-demo',
    description: 'Media collective governance proposals demonstrating editorial and operational decisions',
    data: async (groupId, userPubkey) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const mediaProposals: DBProposal[] = [
        // ACTIVE: Editorial Policy Proposal
        {
          _v: '1.0.0',
          id: `proposal-editorial-policy-${groupId}`,
          groupId,
          title: 'Update Sourcing Requirements Policy',
          description: `## Proposal

Update our editorial policy to require at least two independent sources for all factual claims in news articles.

## Current Policy
Single source verification for most stories.

## Proposed Changes
1. **Breaking News**: Minimum one on-record source, with update when second source available
2. **Investigation**: Minimum three independent sources for key claims
3. **Opinion/Analysis**: Clear attribution to author's analysis, with facts sourced
4. **Community Stories**: Direct quotes verified with subjects

## Rationale
Recent incidents of misinformation spreading on social media have reinforced the need for rigorous sourcing. This protects our credibility and our community.

## Implementation
- Editors will check sourcing before publication
- Training session for all writers on verification techniques
- Updated style guide section on sourcing

**Discussion Period**: 7 days
**Voting Method**: Consensus`,
          type: 'policy',
          status: 'discussion',
          votingSystem: 'consensus',
          options: consensusOptions(),
          votingPeriod: { startsAt: now + 7 * day, endsAt: now + 10 * day },
          createdBy: userPubkey,
          createdAt: now - 3 * day,
          updatedAt: now - 3 * day,
        },

        // ACTIVE: Coverage Priority Vote
        {
          _v: '1.0.0',
          id: `proposal-coverage-priority-${groupId}`,
          groupId,
          title: 'Q1 2026 Coverage Priorities',
          description: `## Proposal

Set our coverage priorities for Q1 2026. Rank these topics in order of importance to guide editorial decisions.

## Topics for Ranking

1. **Housing Justice** - Rent strikes, tenant organizing, eviction defense
2. **Labor Movement** - Union drives, strikes, worker actions
3. **Police Accountability** - Cop watch, protest coverage, policy changes
4. **Climate/Environment** - Local environmental justice, climate actions
5. **Mutual Aid Networks** - Community support systems, resource sharing
6. **Immigration** - ICE activity, sanctuary policies, community defense

## Process
Use ranked-choice voting. Top 3 will be priority beats, others covered as capacity allows.

**Voting Period**: 3 days`,
          type: 'general',
          status: 'voting',
          votingSystem: 'ranked-choice',
          options: [
            { id: crypto.randomUUID(), label: 'Housing Justice', order: 0 },
            { id: crypto.randomUUID(), label: 'Labor Movement', order: 1 },
            { id: crypto.randomUUID(), label: 'Police Accountability', order: 2 },
            { id: crypto.randomUUID(), label: 'Climate/Environment', order: 3 },
            { id: crypto.randomUUID(), label: 'Mutual Aid Networks', order: 4 },
            { id: crypto.randomUUID(), label: 'Immigration', order: 5 },
          ],
          votingPeriod: { startsAt: now - 1 * day, endsAt: now + 3 * day },
          createdBy: userPubkey,
          createdAt: now - 4 * day,
          updatedAt: now - 4 * day,
        },

        // ACTIVE: New Member Approval
        {
          _v: '1.0.0',
          id: `proposal-new-member-${groupId}`,
          groupId,
          title: 'New Member: Sarah Chen',
          description: `## Nomination

Sarah Chen has applied to join our collective as a writer.

## Background
- 5 years community journalism experience
- Former contributor to Street Roots
- Strong connections to labor community
- Portfolio: https://example.com/sarah-portfolio

## Skills
- Investigative reporting
- Photography
- Spanish fluency
- Audio editing

## Collective Participation Plan
- Attend monthly collective meetings
- Commit to one story per week minimum
- Participate in editorial review rotation after 3-month onboarding

## Sponsor Statement
"I've worked with Sarah on several labor stories and she brings both skill and genuine commitment to community journalism." - Alex Martinez

**Vote Required**: 66% approval
**Voting Period**: 3 days`,
          type: 'general',
          status: 'voting',
          votingSystem: 'simple-majority',
          options: defaultOptions(),
          votingPeriod: { startsAt: now - 1 * day, endsAt: now + 3 * day },
          createdBy: userPubkey,
          createdAt: now - 2 * day,
          updatedAt: now - 2 * day,
        },

        // ACTIVE: Join Coalition Vote
        {
          _v: '1.0.0',
          id: `proposal-join-coalition-${groupId}`,
          groupId,
          title: 'Join Pacific Northwest Media Coalition',
          description: `## Proposal

Join the Pacific Northwest Media Coalition for content syndication and mutual support.

## About the Coalition
- 7 existing members (Seattle, Vancouver, Tacoma, Olympia, Bellingham, Eugene, Bend)
- Shared wire service for regional stories
- Mutual aid for coverage (photographers, translators)
- Joint training programs

## Benefits
1. **Syndication**: Our stories reach regional audience
2. **Resources**: Access to coalition's equipment pool
3. **Training**: Quarterly skill-shares with other collectives
4. **Mutual Aid**: Support during major actions

## Obligations
1. Contribute minimum 2 stories/month to wire
2. Attend quarterly coalition meetings
3. Respond to mutual aid requests when able
4. Maintain editorial independence (no editorial control by coalition)

## Concerns Raised in Discussion
- Q: "Will we lose local focus?"
- A: Coalition explicitly protects local autonomy. No editorial pressure.

- Q: "What about security?"
- A: Stories are opt-in syndication. Sensitive local stories stay local.

**Vote Required**: Consensus (75% quorum)
**Voting Period**: 5 days`,
          type: 'resolution',
          status: 'voting',
          votingSystem: 'consensus',
          options: consensusOptions(),
          votingPeriod: { startsAt: now - 2 * day, endsAt: now + 5 * day },
          createdBy: userPubkey,
          createdAt: now - 7 * day,
          updatedAt: now - 2 * day,
        },

        // COMPLETED: Editorial Board Election
        {
          _v: '1.0.0',
          id: `proposal-editorial-board-${groupId}`,
          groupId,
          title: 'Editorial Board Election - December 2025',
          description: `## Election

Elect 3 members to serve on the editorial board for 6-month term (Dec 2025 - May 2026).

## Candidates
1. **Maria Santos** - 2 years with collective, investigative focus
2. **James Wright** - 1 year with collective, breaking news focus
3. **Kim Nguyen** - 3 years with collective, community stories focus
4. **Alex Martinez** - 2 years with collective, labor beat
5. **Jordan Taylor** - 6 months with collective, multimedia focus

## Role Description
- Review articles for publication
- Assign stories and manage editorial calendar
- Mentor new writers
- Represent collective in coalition meetings

## Results
**Elected by ranked-choice vote:**
1. Maria Santos (47 points)
2. Kim Nguyen (42 points)
3. Alex Martinez (38 points)

Term begins January 1, 2026.`,
          type: 'election',
          status: 'passed',
          votingSystem: 'ranked-choice',
          options: [
            { id: crypto.randomUUID(), label: 'Maria Santos', order: 0 },
            { id: crypto.randomUUID(), label: 'James Wright', order: 1 },
            { id: crypto.randomUUID(), label: 'Kim Nguyen', order: 2 },
            { id: crypto.randomUUID(), label: 'Alex Martinez', order: 3 },
            { id: crypto.randomUUID(), label: 'Jordan Taylor', order: 4 },
          ],
          votingPeriod: { startsAt: now - 30 * day, endsAt: now - 18 * day },
          createdBy: userPubkey,
          createdAt: now - 30 * day,
          updatedAt: now - 18 * day,
        },

        // COMPLETED: Content Dispute Resolution
        {
          _v: '1.0.0',
          id: `proposal-content-dispute-${groupId}`,
          groupId,
          title: 'Content Dispute: Coverage of City Council Meeting',
          description: `## Dispute

Conflicting perspectives on how to frame our coverage of the November 15th City Council housing vote.

## Background
Article by James Wright characterized certain council members as "landlord-friendly." Several collective members felt this was editorializing in a news piece vs. appropriate framing.

## Perspectives
**Position A (James)**:
- Voting records justify characterization
- Context important for readers
- Similar framing used by other outlets

**Position B (concerned members)**:
- Let readers draw conclusions from facts
- Reserve opinion for clearly-labeled editorials
- Maintain strict news/opinion separation

## Resolution Process
After 3-day discussion period, collective voted on how to proceed.

## Result
**Consensus reached with modifications:**
- Article stands but moves characterization to clearly-labeled analysis section
- Add sidebar with voting records so readers can judge
- Update style guide to clarify news vs. analysis framing
- No corrective action needed for writer; learning experience for all`,
          type: 'resolution',
          status: 'passed',
          votingSystem: 'consensus',
          options: consensusOptions(),
          votingPeriod: { startsAt: now - 30 * day, endsAt: now - 25 * day },
          createdBy: userPubkey,
          createdAt: now - 35 * day,
          updatedAt: now - 25 * day,
        },

        // DRAFT: Syndication Policy
        {
          _v: '1.0.0',
          id: `proposal-syndication-policy-${groupId}`,
          groupId,
          title: 'Syndication Approval Policy',
          description: `## Draft Proposal

Establish criteria for which stories automatically syndicate to coalition vs. require approval.

## Proposed Categories

**Auto-Syndicate (after 24hr local exclusivity)**
- General news
- Event coverage
- Community features
- Arts & culture

**Requires Approval**
- Stories identifying activists or sensitive sources
- Direct action coverage
- Stories about ongoing legal cases
- Any story at author's request

**Never Syndicate**
- Stories involving police investigation
- Stories with sealed legal documents
- Stories that could endanger sources

## Process
Authors flag at submission. Editors review before syndication.

*Still gathering input - discussion opens next week*`,
          type: 'policy',
          status: 'draft',
          votingSystem: 'simple-majority',
          options: defaultOptions(),
          votingPeriod: { startsAt: now + 7 * day, endsAt: now + 14 * day },
          createdBy: userPubkey,
          createdAt: now - 1 * day,
          updatedAt: now - 1 * day,
        },
      ];

      await dal.bulkPut('proposals', mediaProposals);
      logger.info(
        `Seeded ${mediaProposals.length} media collective governance proposals for group ${groupId}`
      );
    },
  },
];

export default mediaCollectiveGovernanceSeeds;
