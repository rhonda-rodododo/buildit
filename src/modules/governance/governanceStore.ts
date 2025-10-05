import { create } from 'zustand'
import type { Proposal, Vote, VotingResults } from './types'

interface GovernanceState {
  proposals: Map<string, Proposal>
  votes: Map<string, Vote[]> // proposalId -> votes
  results: Map<string, VotingResults> // proposalId -> results

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
  proposals: new Map(),
  votes: new Map(),
  results: new Map(),

  addProposal: (proposal) => set((state) => {
    const newProposals = new Map(state.proposals)
    newProposals.set(proposal.id, proposal)
    return { proposals: newProposals }
  }),

  updateProposal: (id, updates) => set((state) => {
    const newProposals = new Map(state.proposals)
    const existing = newProposals.get(id)
    if (existing) {
      newProposals.set(id, { ...existing, ...updates, updated: Date.now() })
    }
    return { proposals: newProposals }
  }),

  removeProposal: (id) => set((state) => {
    const newProposals = new Map(state.proposals)
    newProposals.delete(id)
    return { proposals: newProposals }
  }),

  addVote: (vote) => set((state) => {
    const newVotes = new Map(state.votes)
    const proposalVotes = newVotes.get(vote.proposalId) || []

    // Replace existing vote from same user or add new
    const filteredVotes = proposalVotes.filter(v => v.voterPubkey !== vote.voterPubkey)
    newVotes.set(vote.proposalId, [...filteredVotes, vote])

    return { votes: newVotes }
  }),

  setResults: (proposalId, results) => set((state) => {
    const newResults = new Map(state.results)
    newResults.set(proposalId, results)
    return { results: newResults }
  }),

  getProposal: (id) => get().proposals.get(id),

  getProposalsByGroup: (groupId) => {
    return Array.from(get().proposals.values())
      .filter(p => p.groupId === groupId)
      .sort((a, b) => b.created - a.created)
  },

  getProposalsByStatus: (groupId, status) => {
    return Array.from(get().proposals.values())
      .filter(p => p.groupId === groupId && p.status === status)
      .sort((a, b) => b.created - a.created)
  },

  getVotes: (proposalId) => {
    return get().votes.get(proposalId) || []
  },

  getUserVote: (proposalId, userPubkey) => {
    const votes = get().votes.get(proposalId) || []
    return votes.find(v => v.voterPubkey === userPubkey)
  },

  getResults: (proposalId) => {
    return get().results.get(proposalId)
  },
}))
