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
  QuadraticVotingConfigSchema,
  type QuadraticVotingConfig,
  QuadraticBallotSchema,
  type QuadraticBallot,
  QuadraticOptionResultSchema,
  type QuadraticOptionResult,
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

import type { VotingSystem, QuadraticBallot } from '@/generated/validation/governance.zod';

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
  /** Token budget for quadratic voting (required when votingSystem is 'quadratic') */
  quadraticTokenBudget?: number;
  /** Max tokens per option for quadratic voting (optional) */
  quadraticMaxTokensPerOption?: number;
}

/**
 * Input for casting a vote (form data — UI-only type)
 */
export interface CastVoteInput {
  proposalId: string;
  /** Option ID(s): single string for simple, array for ranked-choice, QuadraticBallot for quadratic */
  choice: string | string[] | QuadraticBallot;
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
  /** Per-option quadratic results with token totals, effective votes, and voter counts */
  options: Record<string, {
    /** Total tokens allocated to this option across all voters */
    totalTokens: number;
    /** Sum of sqrt(tokens) across all voters — the effective vote count */
    effectiveVotes: number;
    /** Number of voters who allocated tokens to this option */
    voterCount: number;
  }>;
  /** The option ID with the highest effective votes */
  winner: string | null;
}

export interface ConsensusResults {
  support: number;
  concerns: number;
  blocks: number;
  consensusReached: boolean;
  threshold: number;
}
