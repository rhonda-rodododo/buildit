import { create } from 'zustand'
import type { Proposal, Vote, VotingResults } from './types'

interface GovernanceState {
  // Use objects/arrays instead of Maps for proper Zustand reactivity
  proposals: Record<string, Proposal>
  votes: Record<string, Vote[]> // proposalId -> votes
  results: Record<string, VotingResults> // proposalId -> results

  // Actions
  addProposal: (proposal: Proposal) => void
  updateProposal: (id: string, updates: Partial<Proposal>) => void
  removeProposal: (id: string) => void
  addVote: (vote: Vote) => void
  setResults: (proposalId: string, results: VotingResults) => void

  // Getters
  getProposal: (id: string) => Proposal | undefined
  getProposalsByGroup: (groupId: string) => Proposal[]
  getProposalsByStatus: (groupId: string, status: Proposal['status']) => Proposal[]
  getVotes: (proposalId: string) => Vote[]
  getUserVote: (proposalId: string, userPubkey: string) => Vote | undefined
  getResults: (proposalId: string) => VotingResults | undefined
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
    const existing = state.proposals[id]
    if (!existing) return state

    return {
      proposals: {
        ...state.proposals,
        [id]: { ...existing, ...updates, updated: Date.now() },
      },
    }
  }),

  removeProposal: (id) => set((state) => {
    const { [id]: _removed, ...rest } = state.proposals
    return { proposals: rest }
  }),

  addVote: (vote) => set((state) => {
    const proposalVotes = state.votes[vote.proposalId] || []

    // Replace existing vote from same user or add new
    const filteredVotes = proposalVotes.filter(v => v.voterPubkey !== vote.voterPubkey)

    return {
      votes: {
        ...state.votes,
        [vote.proposalId]: [...filteredVotes, vote],
      },
    }
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
      .sort((a, b) => b.created - a.created)
  },

  getProposalsByStatus: (groupId, status) => {
    return Object.values(get().proposals)
      .filter(p => p.groupId === groupId && p.status === status)
      .sort((a, b) => b.created - a.created)
  },

  getVotes: (proposalId) => {
    return get().votes[proposalId] || []
  },

  getUserVote: (proposalId, userPubkey) => {
    const votes = get().votes[proposalId] || []
    return votes.find(v => v.voterPubkey === userPubkey)
  },

  getResults: (proposalId) => {
    return get().results[proposalId]
  },
}))
