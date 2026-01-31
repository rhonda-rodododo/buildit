/**
 * Governance Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (CreateProposalInput, CastVoteInput, VotingResults) are defined here.
 */

// Re-export all generated Zod schemas and types
export {
  ProposalTypeSchema,
  type ProposalType,
  ProposalStatusSchema,
  type ProposalStatus,
  VotingSystemSchema,
  type VotingSystem,
  VoteOptionSchema,
  type VoteOption,
  QuorumRequirementSchema,
  type QuorumRequirement,
  PassingThresholdSchema,
  type PassingThreshold,
  ProposalAttachmentSchema,
  type ProposalAttachment,
  ProposalSchema,
  type Proposal,
  VoteSchema,
  type Vote,
  DelegationSchema,
  type Delegation,
  ProposalResultSchema,
  type ProposalResult,
  GOVERNANCE_SCHEMA_VERSION,
} from '@/generated/validation/governance.zod';

// ── UI-Only Types ──────────────────────────────────────────────────

import type { VotingSystem } from '@/generated/validation/governance.zod';

/**
 * Input for creating a new proposal (form data — UI-only type)
 */
export interface CreateProposalInput {
  groupId: string;
  title: string;
  description: string;
  votingSystem: VotingSystem;
  /** Text options (converted to VoteOption objects by the manager) */
  optionLabels?: string[];
  /** Voting duration in seconds */
  votingDuration?: number;
  /** Discussion period in seconds before voting starts */
  discussionDuration?: number;
  quorumType?: 'percentage' | 'absolute' | 'none';
  quorumValue?: number;
  thresholdType?: 'simple-majority' | 'supermajority' | 'unanimous' | 'custom';
  thresholdPercentage?: number;
  type?: 'general' | 'policy' | 'budget' | 'election' | 'amendment' | 'action' | 'resolution';
  allowAbstain?: boolean;
  anonymousVoting?: boolean;
  tags?: string[];
}

/**
 * Input for casting a vote (form data — UI-only type)
 */
export interface CastVoteInput {
  proposalId: string;
  /** Option ID(s): single string for simple, array for ranked-choice */
  choice: string | string[];
  comment?: string;
}

/**
 * Voting results (computed at runtime — UI-only type)
 */
export interface VotingResults {
  proposalId: string;
  votingSystem: VotingSystem;
  totalVotes: number;
  totalEligibleVoters: number;
  turnoutPercentage: number;
  results: SimpleResults | RankedChoiceResults | QuadraticResults | ConsensusResults;
  passed: boolean;
  finalizedAt: number;
}

export interface SimpleResults {
  /** Vote counts per option ID */
  voteCounts: Record<string, number>;
  /** The winning option ID */
  winnerId: string | null;
  /** Whether the winning percentage meets the threshold */
  thresholdMet: boolean;
}

export interface RankedChoiceResults {
  rounds: Array<{
    round: number;
    counts: Record<string, number>;
    eliminated?: string;
  }>;
  winner: string | null;
}

export interface QuadraticResults {
  options: Record<string, {
    votes: number;
    quadraticScore: number;
  }>;
  winner: string | null;
}

export interface ConsensusResults {
  support: number;
  concerns: number;
  blocks: number;
  consensusReached: boolean;
  threshold: number;
}
