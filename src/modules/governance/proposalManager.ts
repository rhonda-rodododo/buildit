import { getPublicKey, finalizeEvent, type Event as NostrEvent } from 'nostr-tools'
import type { Proposal, Vote, CreateProposalInput, CastVoteInput, VotingResults, SimpleResults, RankedChoiceResults, QuadraticResults, ConsensusResults } from './types'
import { useGovernanceStore } from './governanceStore'
import { db } from '@/core/storage/db'

// Custom event kinds for governance
export const PROPOSAL_KIND = 32000
export const VOTE_KIND = 32001

class ProposalManager {
  /**
   * Create a new proposal
   */
  async createProposal(
    input: CreateProposalInput,
    authorPrivkey: Uint8Array
  ): Promise<Proposal> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const authorPubkey = getPublicKey(authorPrivkey)

    const proposal: Proposal = {
      id,
      groupId: input.groupId,
      title: input.title,
      description: input.description,
      authorPubkey,
      status: 'draft',
      votingMethod: input.votingMethod,
      options: input.options,
      votingStartTime: input.votingDuration ? now : undefined,
      votingEndTime: input.votingDuration ? now + input.votingDuration * 1000 : undefined,
      quorum: input.quorum || 50,
      threshold: input.threshold || 50,
      created: now,
      updated: now,
    }

    // Create Nostr event
    const event: NostrEvent = finalizeEvent({
      kind: PROPOSAL_KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', id],
        ['group', input.groupId],
        ['title', input.title],
        ['method', input.votingMethod],
        ['status', 'draft'],
      ],
      content: JSON.stringify({
        description: input.description,
        options: input.options,
        quorum: proposal.quorum,
        threshold: proposal.threshold,
      }),
    }, authorPrivkey)

    // Store in local DB
    await db.table('proposals').add({
      id: proposal.id,
      groupId: proposal.groupId,
      data: proposal,
      nostrEvent: event,
    })

    // Update store
    useGovernanceStore.getState().addProposal(proposal)

    return proposal
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    proposalId: string,
    status: Proposal['status']
  ): Promise<void> {
    const proposal = useGovernanceStore.getState().getProposal(proposalId)
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    const now = Date.now()

    // If moving to voting, set start time
    if (status === 'voting' && !proposal.votingStartTime) {
      proposal.votingStartTime = now
    }

    const updates: Partial<Proposal> = {
      status,
      updated: now,
    }

    if (status === 'voting' && !proposal.votingStartTime) {
      updates.votingStartTime = now
    }

    // Update in store
    useGovernanceStore.getState().updateProposal(proposalId, updates)

    // Update in DB
    await db.table('proposals').update(proposalId, {
      data: { ...proposal, ...updates },
    })
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    input: CastVoteInput,
    voterPrivkey: Uint8Array
  ): Promise<Vote> {
    const proposal = useGovernanceStore.getState().getProposal(input.proposalId)
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    if (proposal.status !== 'voting') {
      throw new Error('Proposal is not open for voting')
    }

    const now = Date.now()
    if (proposal.votingEndTime && now > proposal.votingEndTime) {
      throw new Error('Voting period has ended')
    }

    const voterPubkey = getPublicKey(voterPrivkey)
    const voteId = crypto.randomUUID()

    // Create vote object
    const vote: Vote = {
      id: voteId,
      proposalId: input.proposalId,
      voterPubkey,
      vote: input.vote,
      timestamp: now,
      signature: '', // Will be filled by event signature
    }

    // Create Nostr event
    const event: NostrEvent = finalizeEvent({
      kind: VOTE_KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', voteId],
        ['proposal', input.proposalId],
        ['group', proposal.groupId],
      ],
      content: JSON.stringify({ vote: input.vote }),
    }, voterPrivkey)

    vote.signature = event.sig

    // Store in DB
    await db.table('votes').add({
      id: voteId,
      proposalId: input.proposalId,
      data: vote,
      nostrEvent: event,
    })

    // Update store
    useGovernanceStore.getState().addVote(vote)

    return vote
  }

  /**
   * Calculate voting results
   */
  calculateResults(proposalId: string, totalEligibleVoters: number): VotingResults {
    const proposal = useGovernanceStore.getState().getProposal(proposalId)
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    const votes = useGovernanceStore.getState().getVotes(proposalId)
    const totalVotes = votes.length
    const turnoutPercentage = (totalVotes / totalEligibleVoters) * 100

    let results: SimpleResults | RankedChoiceResults | QuadraticResults | ConsensusResults
    let passed = false

    switch (proposal.votingMethod) {
      case 'simple':
        results = this.calculateSimpleResults(votes)
        passed = results.yesPercentage >= (proposal.threshold || 50) &&
                 turnoutPercentage >= (proposal.quorum || 50)
        break

      case 'ranked-choice':
        results = this.calculateRankedChoiceResults(votes, proposal.options || [])
        passed = results.winner !== null &&
                 turnoutPercentage >= (proposal.quorum || 50)
        break

      case 'quadratic':
        results = this.calculateQuadraticResults(votes)
        passed = results.winner !== null &&
                 turnoutPercentage >= (proposal.quorum || 50)
        break

      case 'consensus':
        results = this.calculateConsensusResults(votes, proposal.threshold || 75)
        passed = results.consensusReached &&
                 turnoutPercentage >= (proposal.quorum || 50)
        break
    }

    const votingResults: VotingResults = {
      proposalId,
      method: proposal.votingMethod,
      totalVotes,
      totalEligibleVoters,
      turnoutPercentage,
      results,
      passed,
      finalizedAt: Date.now(),
    }

    // Store results
    useGovernanceStore.getState().setResults(proposalId, votingResults)

    return votingResults
  }

  private calculateSimpleResults(votes: Vote[]): SimpleResults {
    let yes = 0
    let no = 0
    let abstain = 0

    votes.forEach(vote => {
      if (vote.vote === 'yes') yes++
      else if (vote.vote === 'no') no++
      else if (vote.vote === 'abstain') abstain++
    })

    const total = yes + no
    const yesPercentage = total > 0 ? (yes / total) * 100 : 0
    const noPercentage = total > 0 ? (no / total) * 100 : 0

    return { yes, no, abstain, yesPercentage, noPercentage }
  }

  private calculateRankedChoiceResults(votes: Vote[], options: string[]): RankedChoiceResults {
    if (!options.length) {
      return { rounds: [], winner: null }
    }

    const rounds: RankedChoiceResults['rounds'] = []
    let remainingOptions = [...options]
    let currentVotes = votes.map(v => Array.isArray(v.vote) ? v.vote : [])

    while (remainingOptions.length > 1) {
      const counts: Record<string, number> = {}

      remainingOptions.forEach(opt => { counts[opt] = 0 })

      currentVotes.forEach(rankedVote => {
        const firstChoice = rankedVote.find(opt => remainingOptions.includes(opt))
        if (firstChoice) {
          counts[firstChoice] = (counts[firstChoice] || 0) + 1
        }
      })

      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0)
      const majority = totalVotes / 2

      // Check for majority winner
      const majorityWinner = Object.entries(counts).find(([_, count]) => count > majority)
      if (majorityWinner) {
        rounds.push({ round: rounds.length + 1, counts })
        return { rounds, winner: majorityWinner[0] }
      }

      // Eliminate lowest
      const lowest = Object.entries(counts).sort((a, b) => a[1] - b[1])[0]
      rounds.push({ round: rounds.length + 1, counts, eliminated: lowest[0] })
      remainingOptions = remainingOptions.filter(opt => opt !== lowest[0])
    }

    return { rounds, winner: remainingOptions[0] || null }
  }

  private calculateQuadraticResults(votes: Vote[]): QuadraticResults {
    const options: QuadraticResults['options'] = {}

    votes.forEach(vote => {
      if (typeof vote.vote === 'object' && !Array.isArray(vote.vote)) {
        Object.entries(vote.vote).forEach(([option, tokens]) => {
          if (!options[option]) {
            options[option] = { votes: 0, quadraticScore: 0 }
          }
          options[option].votes++
          options[option].quadraticScore += Math.sqrt(tokens)
        })
      }
    })

    const winner = Object.entries(options)
      .sort((a, b) => b[1].quadraticScore - a[1].quadraticScore)[0]?.[0] || null

    return { options, winner }
  }

  private calculateConsensusResults(votes: Vote[], threshold: number): ConsensusResults {
    let support = 0
    let concerns = 0
    let blocks = 0

    votes.forEach(vote => {
      if (vote.vote === 'yes') support++
      else if (vote.vote === 'abstain') concerns++
      else if (vote.vote === 'no') blocks++
    })

    const total = support + concerns + blocks
    const supportPercentage = total > 0 ? (support / total) * 100 : 0
    const consensusReached = supportPercentage >= threshold && blocks === 0

    return { support, concerns, blocks, consensusReached, threshold }
  }
}

export const proposalManager = new ProposalManager()
