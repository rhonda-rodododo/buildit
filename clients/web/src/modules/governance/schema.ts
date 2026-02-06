/**
 * Governance Module Database Schema
 *
 * Re-exports generated types from protocol schemas.
 * All types are generated directly from protocol/schemas/modules/governance/v1.json
 */

export {
  GOVERNANCE_TABLE_SCHEMAS,
  GOVERNANCE_TABLES,
  type DBProposal,
  type DBVote,
  type DBDelegation,
  type VoteOption,
  type QuorumRequirement,
  type PassingThreshold,
  type ProposalAttachment,
  type QuadraticVotingConfig,
  type QuadraticBallot,
} from '@/generated/db/governance.db';

// Re-export table schemas under legacy name
export { GOVERNANCE_TABLE_SCHEMAS as governanceSchema } from '@/generated/db/governance.db';
