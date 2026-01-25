/**
 * GovernanceStore Tests
 * Tests for proposals, votes, and voting results management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGovernanceStore } from '../governanceStore';
import type { Proposal, Vote, VotingResults } from '../types';

describe('governanceStore', () => {
  beforeEach(() => {
    // Reset store state
    useGovernanceStore.setState({
      proposals: {},
      votes: {},
      results: {},
    });
  });

  const createMockProposal = (overrides: Partial<Proposal> = {}): Proposal => ({
    id: `proposal-${Date.now()}-${Math.random()}`,
    groupId: 'group-1',
    title: 'Test Proposal',
    description: 'A test proposal',
    authorPubkey: 'user-1',
    status: 'discussion',
    votingMethod: 'simple',
    created: Date.now(),
    updated: Date.now(),
    ...overrides,
  });

  const createMockVote = (overrides: Partial<Vote> = {}): Vote => ({
    id: `vote-${Date.now()}-${Math.random()}`,
    proposalId: 'proposal-1',
    voterPubkey: 'user-1',
    vote: 'yes',
    timestamp: Date.now(),
    signature: 'sig-123',
    ...overrides,
  });

  const createMockResults = (overrides: Partial<VotingResults> = {}): VotingResults => ({
    proposalId: 'proposal-1',
    method: 'simple',
    totalVotes: 10,
    totalEligibleVoters: 20,
    turnoutPercentage: 50,
    results: {
      yes: 6,
      no: 3,
      abstain: 1,
      yesPercentage: 60,
      noPercentage: 30,
    },
    passed: true,
    finalizedAt: Date.now(),
    ...overrides,
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useGovernanceStore.getState();
      expect(state.proposals).toEqual({});
      expect(state.votes).toEqual({});
      expect(state.results).toEqual({});
    });
  });

  describe('Proposals', () => {
    describe('addProposal', () => {
      it('should add a proposal', () => {
        const { addProposal } = useGovernanceStore.getState();
        const proposal = createMockProposal({ id: 'proposal-1' });

        addProposal(proposal);

        const { proposals } = useGovernanceStore.getState();
        expect(proposals['proposal-1']).toBeDefined();
        expect(proposals['proposal-1'].title).toBe('Test Proposal');
      });

      it('should add multiple proposals', () => {
        const { addProposal } = useGovernanceStore.getState();

        addProposal(createMockProposal({ id: 'proposal-1' }));
        addProposal(createMockProposal({ id: 'proposal-2' }));

        const { proposals } = useGovernanceStore.getState();
        expect(Object.keys(proposals)).toHaveLength(2);
      });
    });

    describe('updateProposal', () => {
      it('should update an existing proposal', () => {
        const { addProposal, updateProposal } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'proposal-1', title: 'Original' }));

        updateProposal('proposal-1', { title: 'Updated' });

        const { proposals } = useGovernanceStore.getState();
        expect(proposals['proposal-1'].title).toBe('Updated');
      });

      it('should update the updated timestamp', () => {
        const { addProposal, updateProposal } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'proposal-1', updated: 1000 }));

        updateProposal('proposal-1', { title: 'Updated' });

        const { proposals } = useGovernanceStore.getState();
        expect(proposals['proposal-1'].updated).toBeGreaterThan(1000);
      });

      it('should not modify state for non-existent proposal', () => {
        const { updateProposal } = useGovernanceStore.getState();

        updateProposal('non-existent', { title: 'Updated' });

        const { proposals } = useGovernanceStore.getState();
        expect(Object.keys(proposals)).toHaveLength(0);
      });
    });

    describe('removeProposal', () => {
      it('should remove a proposal', () => {
        const { addProposal, removeProposal } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'proposal-1' }));
        addProposal(createMockProposal({ id: 'proposal-2' }));

        removeProposal('proposal-1');

        const { proposals } = useGovernanceStore.getState();
        expect(proposals['proposal-1']).toBeUndefined();
        expect(proposals['proposal-2']).toBeDefined();
      });
    });
  });

  describe('Votes', () => {
    describe('addVote', () => {
      it('should add a vote', () => {
        const { addVote } = useGovernanceStore.getState();
        const vote = createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1' });

        addVote(vote);

        const { votes } = useGovernanceStore.getState();
        expect(votes['proposal-1']).toHaveLength(1);
      });

      it('should replace existing vote from same user', () => {
        const { addVote } = useGovernanceStore.getState();

        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1', vote: 'yes' }));
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1', vote: 'no' }));

        const { votes } = useGovernanceStore.getState();
        expect(votes['proposal-1']).toHaveLength(1);
        expect(votes['proposal-1'][0].vote).toBe('no');
      });

      it('should allow multiple users to vote on same proposal', () => {
        const { addVote } = useGovernanceStore.getState();

        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1' }));
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-2' }));
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-3' }));

        const { votes } = useGovernanceStore.getState();
        expect(votes['proposal-1']).toHaveLength(3);
      });
    });
  });

  describe('Results', () => {
    describe('setResults', () => {
      it('should set voting results', () => {
        const { setResults } = useGovernanceStore.getState();
        const results = createMockResults({ proposalId: 'proposal-1' });

        setResults('proposal-1', results);

        const { results: storedResults } = useGovernanceStore.getState();
        expect(storedResults['proposal-1']).toBeDefined();
        expect(storedResults['proposal-1'].passed).toBe(true);
      });
    });
  });

  describe('Getters', () => {
    describe('getProposal', () => {
      it('should return proposal by id', () => {
        const { addProposal, getProposal } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'proposal-1', title: 'Test' }));

        const proposal = getProposal('proposal-1');

        expect(proposal?.title).toBe('Test');
      });

      it('should return undefined for non-existent proposal', () => {
        const { getProposal } = useGovernanceStore.getState();

        expect(getProposal('non-existent')).toBeUndefined();
      });
    });

    describe('getProposalsByGroup', () => {
      it('should filter proposals by group', () => {
        const { addProposal, getProposalsByGroup } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'p1', groupId: 'group-1', created: 1000 }));
        addProposal(createMockProposal({ id: 'p2', groupId: 'group-2', created: 2000 }));
        addProposal(createMockProposal({ id: 'p3', groupId: 'group-1', created: 3000 }));

        const proposals = getProposalsByGroup('group-1');

        expect(proposals).toHaveLength(2);
        expect(proposals.every((p) => p.groupId === 'group-1')).toBe(true);
      });

      it('should sort proposals by created date descending', () => {
        const { addProposal, getProposalsByGroup } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'p1', groupId: 'group-1', created: 1000 }));
        addProposal(createMockProposal({ id: 'p2', groupId: 'group-1', created: 3000 }));
        addProposal(createMockProposal({ id: 'p3', groupId: 'group-1', created: 2000 }));

        const proposals = getProposalsByGroup('group-1');

        expect(proposals[0].id).toBe('p2');
        expect(proposals[1].id).toBe('p3');
        expect(proposals[2].id).toBe('p1');
      });
    });

    describe('getProposalsByStatus', () => {
      it('should filter proposals by group and status', () => {
        const { addProposal, getProposalsByStatus } = useGovernanceStore.getState();
        addProposal(createMockProposal({ id: 'p1', groupId: 'group-1', status: 'voting' }));
        addProposal(createMockProposal({ id: 'p2', groupId: 'group-1', status: 'discussion' }));
        addProposal(createMockProposal({ id: 'p3', groupId: 'group-1', status: 'voting' }));
        addProposal(createMockProposal({ id: 'p4', groupId: 'group-2', status: 'voting' }));

        const votingProposals = getProposalsByStatus('group-1', 'voting');

        expect(votingProposals).toHaveLength(2);
        expect(votingProposals.every((p) => p.status === 'voting')).toBe(true);
        expect(votingProposals.every((p) => p.groupId === 'group-1')).toBe(true);
      });
    });

    describe('getVotes', () => {
      it('should return votes for a proposal', () => {
        const { addVote, getVotes } = useGovernanceStore.getState();
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1' }));
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-2' }));

        const votes = getVotes('proposal-1');

        expect(votes).toHaveLength(2);
      });

      it('should return empty array for proposal with no votes', () => {
        const { getVotes } = useGovernanceStore.getState();

        expect(getVotes('non-existent')).toEqual([]);
      });
    });

    describe('getUserVote', () => {
      it('should return user vote for a proposal', () => {
        const { addVote, getUserVote } = useGovernanceStore.getState();
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1', vote: 'yes' }));
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-2', vote: 'no' }));

        const vote = getUserVote('proposal-1', 'user-1');

        expect(vote?.vote).toBe('yes');
      });

      it('should return undefined if user has not voted', () => {
        const { addVote, getUserVote } = useGovernanceStore.getState();
        addVote(createMockVote({ proposalId: 'proposal-1', voterPubkey: 'user-1' }));

        expect(getUserVote('proposal-1', 'user-2')).toBeUndefined();
      });
    });

    describe('getResults', () => {
      it('should return results for a proposal', () => {
        const { setResults, getResults } = useGovernanceStore.getState();
        setResults('proposal-1', createMockResults({ proposalId: 'proposal-1', passed: true }));

        const results = getResults('proposal-1');

        expect(results?.passed).toBe(true);
      });

      it('should return undefined for proposal with no results', () => {
        const { getResults } = useGovernanceStore.getState();

        expect(getResults('non-existent')).toBeUndefined();
      });
    });
  });
});
