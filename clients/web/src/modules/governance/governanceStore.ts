import { create } from 'zustand';
import type { DBProposal, DBVote } from './schema';
import type { VotingResults } from './types';

interface GovernanceState {
  proposals: Record<string, DBProposal>;
  votes: Record<string, DBVote[]>; // proposalId -> votes
  results: Record<string, VotingResults>; // proposalId -> results

  // Actions
  addProposal: (proposal: DBProposal) => void;
  updateProposal: (id: string, updates: Partial<DBProposal>) => void;
  removeProposal: (id: string) => void;
  addVote: (vote: DBVote) => void;
  setResults: (proposalId: string, results: VotingResults) => void;

  // Getters
  getProposal: (id: string) => DBProposal | undefined;
  getProposalsByGroup: (groupId: string) => DBProposal[];
  getProposalsByStatus: (groupId: string, status: DBProposal['status']) => DBProposal[];
  getVotes: (proposalId: string) => DBVote[];
  getUserVote: (proposalId: string, voterId: string) => DBVote | undefined;
  getResults: (proposalId: string) => VotingResults | undefined;
}

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
  proposals: {},
  votes: {},
  results: {},

  addProposal: (proposal) => set((state) => ({
    proposals: {
      ...state.proposals,
      [proposal.id]: proposal,
    },
  })),

  updateProposal: (id, updates) => set((state) => {
    const existing = state.proposals[id];
    if (!existing) return state;

    return {
      proposals: {
        ...state.proposals,
        [id]: { ...existing, ...updates, updatedAt: Date.now() },
      },
    };
  }),

  removeProposal: (id) => set((state) => {
    const { [id]: _removed, ...rest } = state.proposals;
    return { proposals: rest };
  }),

  addVote: (vote) => set((state) => {
    const proposalVotes = state.votes[vote.proposalId] || [];

    // Replace existing vote from same user or add new
    const filteredVotes = proposalVotes.filter(v => v.voterId !== vote.voterId);

    return {
      votes: {
        ...state.votes,
        [vote.proposalId]: [...filteredVotes, vote],
      },
    };
  }),

  setResults: (proposalId, results) => set((state) => ({
    results: {
      ...state.results,
      [proposalId]: results,
    },
  })),

  getProposal: (id) => get().proposals[id],

  getProposalsByGroup: (groupId) => {
    return Object.values(get().proposals)
      .filter(p => p.groupId === groupId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getProposalsByStatus: (groupId, status) => {
    return Object.values(get().proposals)
      .filter(p => p.groupId === groupId && p.status === status)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getVotes: (proposalId) => {
    return get().votes[proposalId] || [];
  },

  getUserVote: (proposalId, voterId) => {
    const votes = get().votes[proposalId] || [];
    return votes.find(v => v.voterId === voterId);
  },

  getResults: (proposalId) => {
    return get().results[proposalId];
  },
}));
