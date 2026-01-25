import { z } from 'zod'

export type ProposalStatus = 'draft' | 'discussion' | 'voting' | 'decided' | 'cancelled'

export type VotingMethod = 'simple' | 'ranked-choice' | 'quadratic' | 'consensus'

export type VoteOption = 'yes' | 'no' | 'abstain'

export const ProposalSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  authorPubkey: z.string(),
  status: z.enum(['draft', 'discussion', 'voting', 'decided', 'cancelled']),
  votingMethod: z.enum(['simple', 'ranked-choice', 'quadratic', 'consensus']),
  options: z.array(z.string()).optional(), // For ranked-choice or multiple options
  votingStartTime: z.number().optional(),
  votingEndTime: z.number().optional(),
  quorum: z.number().min(0).max(100).optional(), // Percentage required
  threshold: z.number().min(0).max(100).optional(), // Percentage to pass
  created: z.number(),
  updated: z.number(),
})

export type Proposal = z.infer<typeof ProposalSchema>

export const VoteSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  voterPubkey: z.string(),
  vote: z.union([
    z.enum(['yes', 'no', 'abstain']), // Simple
    z.array(z.string()), // Ranked choice (ordered options)
    z.record(z.string(), z.number()), // Quadratic (option -> token allocation)
  ]),
  weight: z.number().optional(), // For weighted voting
  timestamp: z.number(),
  signature: z.string(),
})

export type Vote = z.infer<typeof VoteSchema>

export interface VotingResults {
  proposalId: string
  method: VotingMethod
  totalVotes: number
  totalEligibleVoters: number
  turnoutPercentage: number
  results: SimpleResults | RankedChoiceResults | QuadraticResults | ConsensusResults
  passed: boolean
  finalizedAt: number
}

export interface SimpleResults {
  yes: number
  no: number
  abstain: number
  yesPercentage: number
  noPercentage: number
}

export interface RankedChoiceResults {
  rounds: Array<{
    round: number
    counts: Record<string, number>
    eliminated?: string
  }>
  winner: string | null
}

export interface QuadraticResults {
  options: Record<string, {
    votes: number
    quadraticScore: number
  }>
  winner: string | null
}

export interface ConsensusResults {
  support: number
  concerns: number
  blocks: number
  consensusReached: boolean
  threshold: number
}

export interface CreateProposalInput {
  groupId: string
  title: string
  description: string
  votingMethod: VotingMethod
  options?: string[]
  votingDuration?: number // in seconds
  quorum?: number
  threshold?: number
}

export interface CastVoteInput {
  proposalId: string
  vote: VoteOption | string[] | Record<string, number>
}
