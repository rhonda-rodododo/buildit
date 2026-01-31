import { getPublicKey, finalizeEvent, type Event as NostrEvent } from 'nostr-tools';
import type { DBProposal, DBVote, VoteOption } from './schema';
import type {
  CreateProposalInput,
  CastVoteInput,
  VotingResults,
  SimpleResults,
  RankedChoiceResults,
  QuadraticResults,
  ConsensusResults,
} from './types';
import { useGovernanceStore } from './governanceStore';
import { db } from '@/core/storage/db';

// Custom event kinds for governance
export const PROPOSAL_KIND = 32000;
export const VOTE_KIND = 32001;

/**
 * Create VoteOption objects from text labels.
 * For simple majority, adds default Yes/No/Abstain options.
 */
function createVoteOptions(
  _votingSystem: DBProposal['votingSystem'],
  labels?: string[],
  allowAbstain = true
): VoteOption[] {
  if (labels && labels.length > 0) {
    return labels.map((label, i) => ({
      id: crypto.randomUUID(),
      label,
      order: i,
    }));
  }

  // Default options for simple voting systems
  const options: VoteOption[] = [
    { id: crypto.randomUUID(), label: 'Yes', order: 0 },
    { id: crypto.randomUUID(), label: 'No', order: 1 },
  ];

  if (allowAbstain) {
    options.push({ id: crypto.randomUUID(), label: 'Abstain', order: 2 });
  }

  return options;
}

class ProposalManager {
  /**
   * Create a new proposal
   */
  async createProposal(
    input: CreateProposalInput,
    authorPrivkey: Uint8Array
  ): Promise<DBProposal> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const createdBy = getPublicKey(authorPrivkey);

    const options = createVoteOptions(
      input.votingSystem,
      input.optionLabels,
      input.allowAbstain ?? true
    );

    const votingStartMs = input.votingDuration ? now : now;
    const votingEndMs = input.votingDuration ? now + input.votingDuration * 1000 : now + 7 * 24 * 60 * 60 * 1000;

    const proposal: DBProposal = {
      _v: '1.0.0',
      id,
      groupId: input.groupId,
      title: input.title,
      description: input.description,
      type: input.type ?? 'general',
      status: 'draft',
      votingSystem: input.votingSystem,
      options,
      quorum: input.quorumType ? {
        type: input.quorumType,
        value: input.quorumValue,
        countAbstentions: false,
      } : undefined,
      threshold: input.thresholdType ? {
        type: input.thresholdType,
        percentage: input.thresholdPercentage,
      } : undefined,
      votingPeriod: {
        startsAt: votingStartMs,
        endsAt: votingEndMs,
      },
      allowAbstain: input.allowAbstain ?? true,
      anonymousVoting: input.anonymousVoting ?? false,
      createdBy,
      createdAt: now,
      tags: input.tags,
    };

    // Create Nostr event
    const event: NostrEvent = finalizeEvent({
      kind: PROPOSAL_KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', id],
        ['group', input.groupId],
        ['title', input.title],
        ['system', input.votingSystem],
        ['status', 'draft'],
      ],
      content: JSON.stringify({
        description: input.description,
        options,
        type: proposal.type,
        quorum: proposal.quorum,
        threshold: proposal.threshold,
      }),
    }, authorPrivkey);

    // Store in local DB
    await db.table('proposals').add({
      id: proposal.id,
      groupId: proposal.groupId,
      data: proposal,
      nostrEvent: event,
    });

    // Update store
    useGovernanceStore.getState().addProposal(proposal);

    return proposal;
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    proposalId: string,
    status: DBProposal['status']
  ): Promise<void> {
    const proposal = useGovernanceStore.getState().getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const now = Date.now();
    const updates: Partial<DBProposal> = {
      status,
      updatedAt: now,
    };

    // If moving to voting, ensure voting period is set
    if (status === 'voting' && proposal.votingPeriod.startsAt > now) {
      updates.votingPeriod = {
        ...proposal.votingPeriod,
        startsAt: now,
      };
    }

    // Update in store
    useGovernanceStore.getState().updateProposal(proposalId, updates);

    // Update in DB
    await db.table('proposals').update(proposalId, {
      data: { ...proposal, ...updates },
    });
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    input: CastVoteInput,
    voterPrivkey: Uint8Array
  ): Promise<DBVote> {
    const proposal = useGovernanceStore.getState().getProposal(input.proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'voting') {
      throw new Error('Proposal is not open for voting');
    }

    const now = Date.now();
    if (now > proposal.votingPeriod.endsAt) {
      throw new Error('Voting period has ended');
    }

    const voterId = getPublicKey(voterPrivkey);
    const voteId = crypto.randomUUID();

    // Create vote object
    const vote: DBVote = {
      _v: '1.0.0',
      id: voteId,
      proposalId: input.proposalId,
      voterId,
      choice: input.choice,
      castAt: now,
      comment: input.comment,
    };

    // Create Nostr event
    const event: NostrEvent = finalizeEvent({
      kind: VOTE_KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', voteId],
        ['proposal', input.proposalId],
        ['group', proposal.groupId],
      ],
      content: JSON.stringify({ choice: input.choice }),
    }, voterPrivkey);

    vote.signature = event.sig;

    // Store in DB
    await db.table('votes').add({
      id: voteId,
      proposalId: input.proposalId,
      data: vote,
      nostrEvent: event,
    });

    // Update store
    useGovernanceStore.getState().addVote(vote);

    return vote;
  }

  /**
   * Calculate voting results
   */
  calculateResults(proposalId: string, totalEligibleVoters: number): VotingResults {
    const proposal = useGovernanceStore.getState().getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const votes = useGovernanceStore.getState().getVotes(proposalId);
    const totalVotes = votes.length;
    const turnoutPercentage = (totalVotes / totalEligibleVoters) * 100;

    const quorumMet = !proposal.quorum ||
      proposal.quorum.type === 'none' ||
      (proposal.quorum.type === 'percentage' && turnoutPercentage >= (proposal.quorum.value ?? 50)) ||
      (proposal.quorum.type === 'absolute' && totalVotes >= (proposal.quorum.value ?? 1));

    let results: SimpleResults | RankedChoiceResults | QuadraticResults | ConsensusResults;
    let passed = false;

    switch (proposal.votingSystem) {
      case 'simple-majority':
      case 'supermajority':
      case 'approval': {
        results = this.calculateSimpleResults(votes, proposal);
        passed = results.thresholdMet && quorumMet;
        break;
      }

      case 'ranked-choice': {
        const optionIds = proposal.options.map(o => o.id);
        results = this.calculateRankedChoiceResults(votes, optionIds);
        passed = results.winner !== null && quorumMet;
        break;
      }

      case 'quadratic': {
        results = this.calculateQuadraticResults(votes);
        passed = results.winner !== null && quorumMet;
        break;
      }

      case 'consensus':
      case 'modified-consensus': {
        const thresholdPct = proposal.threshold?.percentage ?? 75;
        results = this.calculateConsensusResults(votes, proposal, thresholdPct);
        passed = results.consensusReached && quorumMet;
        break;
      }

      case 'd-hondt': {
        // D'Hondt uses ranked-choice style results
        const optionIds2 = proposal.options.map(o => o.id);
        results = this.calculateRankedChoiceResults(votes, optionIds2);
        passed = results.winner !== null && quorumMet;
        break;
      }
    }

    const votingResults: VotingResults = {
      proposalId,
      votingSystem: proposal.votingSystem,
      totalVotes,
      totalEligibleVoters,
      turnoutPercentage,
      results,
      passed,
      finalizedAt: Date.now(),
    };

    // Store results
    useGovernanceStore.getState().setResults(proposalId, votingResults);

    return votingResults;
  }

  private calculateSimpleResults(votes: DBVote[], proposal: DBProposal): SimpleResults {
    const voteCounts: Record<string, number> = {};

    // Initialize counts for all options
    for (const option of proposal.options) {
      voteCounts[option.id] = 0;
    }

    // Count votes
    for (const vote of votes) {
      const choiceId = typeof vote.choice === 'string' ? vote.choice : vote.choice[0];
      if (choiceId && voteCounts[choiceId] !== undefined) {
        voteCounts[choiceId]++;
      }
    }

    // Find winner (option with most votes, excluding abstain)
    const abstainOption = proposal.options.find(o => o.label === 'Abstain');
    const countableVotes = Object.entries(voteCounts)
      .filter(([id]) => id !== abstainOption?.id);

    const totalCountable = countableVotes.reduce((sum, [, count]) => sum + count, 0);
    const sorted = countableVotes.sort((a, b) => b[1] - a[1]);
    const winnerId = sorted[0]?.[0] ?? null;
    const winnerCount = sorted[0]?.[1] ?? 0;

    // Check threshold
    const requiredPct = proposal.threshold?.percentage ?? 50;
    const winnerPct = totalCountable > 0 ? (winnerCount / totalCountable) * 100 : 0;
    const thresholdMet = winnerPct > requiredPct;

    return { voteCounts, winnerId, thresholdMet };
  }

  private calculateRankedChoiceResults(votes: DBVote[], optionIds: string[]): RankedChoiceResults {
    if (!optionIds.length) {
      return { rounds: [], winner: null };
    }

    const rounds: RankedChoiceResults['rounds'] = [];
    let remainingOptions = [...optionIds];
    const currentVotes = votes.map(v => Array.isArray(v.choice) ? v.choice : []);

    while (remainingOptions.length > 1) {
      const counts: Record<string, number> = {};

      remainingOptions.forEach(opt => { counts[opt] = 0; });

      currentVotes.forEach(rankedVote => {
        const firstChoice = rankedVote.find(opt => remainingOptions.includes(opt));
        if (firstChoice) {
          counts[firstChoice] = (counts[firstChoice] || 0) + 1;
        }
      });

      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
      const majority = totalVotes / 2;

      // Check for majority winner
      const majorityWinner = Object.entries(counts).find(([, count]) => count > majority);
      if (majorityWinner) {
        rounds.push({ round: rounds.length + 1, counts });
        return { rounds, winner: majorityWinner[0] };
      }

      // Eliminate lowest
      const lowest = Object.entries(counts).sort((a, b) => a[1] - b[1])[0];
      rounds.push({ round: rounds.length + 1, counts, eliminated: lowest[0] });
      remainingOptions = remainingOptions.filter(opt => opt !== lowest[0]);
    }

    return { rounds, winner: remainingOptions[0] || null };
  }

  private calculateQuadraticResults(votes: DBVote[]): QuadraticResults {
    const options: QuadraticResults['options'] = {};

    votes.forEach(vote => {
      if (typeof vote.choice === 'object' && !Array.isArray(vote.choice)) {
        // Quadratic voting uses Record<optionId, tokenAllocation> in choice
        // Currently choice is string | string[], so this branch won't trigger
        // TODO: Extend protocol to support quadratic vote format
      }
    });

    const winner = Object.entries(options)
      .sort((a, b) => b[1].quadraticScore - a[1].quadraticScore)[0]?.[0] || null;

    return { options, winner };
  }

  private calculateConsensusResults(votes: DBVote[], proposal: DBProposal, threshold: number): ConsensusResults {
    let support = 0;
    let concerns = 0;
    let blocks = 0;

    // For consensus, options should have "Support", "Stand aside", "Block"
    const supportOption = proposal.options.find(o => o.label === 'Yes' || o.label === 'Support');
    const concernOption = proposal.options.find(o => o.label === 'Abstain' || o.label === 'Stand aside');
    const blockOption = proposal.options.find(o => o.label === 'No' || o.label === 'Block');

    for (const vote of votes) {
      const choiceId = typeof vote.choice === 'string' ? vote.choice : vote.choice[0];
      if (choiceId === supportOption?.id) support++;
      else if (choiceId === concernOption?.id) concerns++;
      else if (choiceId === blockOption?.id) blocks++;
    }

    const total = support + concerns + blocks;
    const supportPercentage = total > 0 ? (support / total) * 100 : 0;
    const consensusReached = supportPercentage >= threshold && blocks === 0;

    return { support, concerns, blocks, consensusReached, threshold };
  }
}

export const proposalManager = new ProposalManager();
