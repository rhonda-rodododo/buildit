// GovernanceService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for governance and voting.

import Foundation
import os.log

/// Service handling governance business logic
@MainActor
public final class GovernanceService: ObservableObject {
    // MARK: - Nostr Event Kinds
    static let KIND_PROPOSAL = 40201
    static let KIND_VOTE = 40202
    static let KIND_DELEGATION = 40203
    static let KIND_RESULT = 40204

    // MARK: - Properties
    private let store: GovernanceStore
    private let logger = Logger(subsystem: "com.buildit", category: "GovernanceService")

    @Published public var activeProposals: [Proposal] = []
    @Published public var completedProposals: [Proposal] = []
    @Published public var isLoading = false

    // MARK: - Initialization

    public init(store: GovernanceStore) {
        self.store = store
    }

    // MARK: - Proposals

    /// Create a new proposal
    public func createProposal(
        groupId: String,
        title: String,
        description: String?,
        type: ProposalType,
        votingSystem: VotingSystem = .simpleMajority,
        options: [VoteOption]? = nil,
        quorum: QuorumRequirement? = nil,
        threshold: PassingThreshold? = nil,
        discussionPeriod: TimePeriod? = nil,
        votingPeriod: TimePeriod,
        allowAbstain: Bool = true,
        anonymousVoting: Bool = false,
        allowDelegation: Bool = false,
        createdBy: String,
        tags: [String] = []
    ) async throws -> Proposal {
        let proposal = Proposal(
            id: UUID().uuidString,
            groupId: groupId,
            title: title,
            description: description,
            type: type,
            status: discussionPeriod != nil ? .discussion : .voting,
            votingSystem: votingSystem,
            options: options ?? VoteOption.yesNo,
            quorum: quorum,
            threshold: threshold ?? .simpleMajority,
            discussionPeriod: discussionPeriod,
            votingPeriod: votingPeriod,
            allowAbstain: allowAbstain,
            anonymousVoting: anonymousVoting,
            allowDelegation: allowDelegation,
            createdBy: createdBy,
            tags: tags
        )

        try store.saveProposal(proposal)
        await publishProposal(proposal)
        await refreshProposals(groupId: groupId)

        logger.info("Created proposal: \(proposal.id)")
        return proposal
    }

    /// Get all proposals for a group
    public func getProposals(groupId: String? = nil, activeOnly: Bool = false) async throws -> [Proposal] {
        if activeOnly {
            return try store.getActiveProposals(groupId: groupId)
        }
        return try store.getProposals(groupId: groupId)
    }

    /// Get a specific proposal
    public func getProposal(id: String) async throws -> Proposal? {
        return try store.getProposal(id: id)
    }

    /// Refresh proposals list
    public func refreshProposals(groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let all = try store.getProposals(groupId: groupId)
            activeProposals = all.filter { $0.status.isActive }
            completedProposals = all.filter { !$0.status.isActive }
        } catch {
            logger.error("Failed to refresh proposals: \(error)")
        }
    }

    /// Start voting period for a proposal in discussion
    public func startVoting(proposalId: String) async throws {
        try store.updateProposalStatus(id: proposalId, status: .voting)
        if let proposal = try store.getProposal(id: proposalId) {
            await publishProposal(proposal)
        }
    }

    /// Withdraw a proposal (only by creator)
    public func withdrawProposal(proposalId: String, userId: String) async throws {
        guard let proposal = try store.getProposal(id: proposalId) else {
            throw GovernanceError.proposalNotFound
        }

        guard proposal.createdBy == userId else {
            throw GovernanceError.notAuthorized
        }

        try store.updateProposalStatus(id: proposalId, status: .withdrawn)
        await publishProposalDeletion(proposalId)
    }

    // MARK: - Voting

    /// Cast a vote on a proposal
    public func castVote(
        proposalId: String,
        voterId: String,
        choice: [String],
        comment: String? = nil
    ) async throws -> Vote {
        // Validate proposal is in voting period
        guard let proposal = try store.getProposal(id: proposalId) else {
            throw GovernanceError.proposalNotFound
        }

        guard proposal.canVote else {
            throw GovernanceError.votingNotOpen
        }

        // Check if already voted
        if try store.hasVoted(proposalId: proposalId, voterId: voterId) {
            throw GovernanceError.alreadyVoted
        }

        // Validate choices
        let validOptionIds = Set(proposal.options.map { $0.id })
        for optionId in choice {
            guard validOptionIds.contains(optionId) else {
                throw GovernanceError.invalidVote
            }
        }

        // Create and save vote
        let vote = Vote(
            proposalId: proposalId,
            voterId: voterId,
            choice: choice,
            weight: 1.0,
            comment: comment
        )

        try store.saveVote(vote)
        await publishVote(vote)

        logger.info("Vote cast on proposal \(proposalId) by \(voterId)")
        return vote
    }

    /// Get user's vote on a proposal
    public func getUserVote(proposalId: String, userId: String) async throws -> Vote? {
        return try store.getUserVote(proposalId: proposalId, voterId: userId)
    }

    /// Get all votes for a proposal
    public func getVotes(proposalId: String) async throws -> [Vote] {
        return try store.getVotesForProposal(proposalId: proposalId)
    }

    /// Check if user has voted
    public func hasVoted(proposalId: String, userId: String) async throws -> Bool {
        return try store.hasVoted(proposalId: proposalId, voterId: userId)
    }

    // MARK: - Vote Counting

    /// Calculate current vote counts for a proposal
    public func getVoteCounts(proposalId: String) async throws -> [String: Int] {
        let votes = try store.getVotesForProposal(proposalId: proposalId)
        var counts: [String: Int] = [:]

        for vote in votes {
            for optionId in vote.choice {
                counts[optionId, default: 0] += Int(vote.weight)
            }
        }

        return counts
    }

    /// Finalize voting and calculate result
    public func finalizeProposal(proposalId: String, totalEligible: Int) async throws -> ProposalResult {
        guard let proposal = try store.getProposal(id: proposalId) else {
            throw GovernanceError.proposalNotFound
        }

        let votes = try store.getVotesForProposal(proposalId: proposalId)
        let voteCounts = try await getVoteCounts(proposalId: proposalId)
        let totalVotes = votes.count

        // Check quorum
        let quorumMet: Bool
        if let quorum = proposal.quorum {
            switch quorum.type {
            case .percentage:
                let required = Int(Double(totalEligible) * (quorum.value ?? 0) / 100)
                quorumMet = totalVotes >= required
            case .absolute:
                quorumMet = totalVotes >= Int(quorum.value ?? 0)
            case .none:
                quorumMet = true
            }
        } else {
            quorumMet = true
        }

        // Determine outcome
        let outcome: ProposalOutcome
        let winningOptions: [String]
        var thresholdMet = false

        if !quorumMet {
            outcome = .noQuorum
            winningOptions = []
        } else {
            // Simple majority calculation
            let sortedOptions = voteCounts.sorted { $0.value > $1.value }
            if let winner = sortedOptions.first {
                let totalVotesForOptions = voteCounts.values.reduce(0, +)
                let winnerPercentage = Double(winner.value) / Double(max(1, totalVotesForOptions)) * 100

                if let threshold = proposal.threshold {
                    let requiredPercentage = threshold.percentage ?? 50.01
                    thresholdMet = winnerPercentage >= requiredPercentage
                } else {
                    thresholdMet = winnerPercentage > 50
                }

                // Check for tie
                let topCount = winner.value
                let ties = sortedOptions.filter { $0.value == topCount }
                if ties.count > 1 {
                    outcome = .tie
                    winningOptions = ties.map { $0.key }
                } else if thresholdMet && winner.key == "yes" {
                    outcome = .passed
                    winningOptions = [winner.key]
                } else if thresholdMet && winner.key == "no" {
                    outcome = .rejected
                    winningOptions = [winner.key]
                } else if thresholdMet {
                    outcome = .passed
                    winningOptions = [winner.key]
                } else {
                    outcome = .rejected
                    winningOptions = []
                }
            } else {
                outcome = .noQuorum
                winningOptions = []
            }
        }

        let participation = totalEligible > 0 ? Double(totalVotes) / Double(totalEligible) * 100 : 0

        let result = ProposalResult(
            proposalId: proposalId,
            outcome: outcome,
            winningOptions: winningOptions,
            voteCounts: voteCounts,
            totalVotes: totalVotes,
            totalEligible: totalEligible,
            participation: participation,
            quorumMet: quorumMet,
            thresholdMet: thresholdMet
        )

        try store.saveResult(result)

        // Update proposal status
        let newStatus: ProposalStatus = outcome == .passed ? .passed : .rejected
        try store.updateProposalStatus(id: proposalId, status: newStatus)

        await publishResult(result)

        logger.info("Finalized proposal \(proposalId): \(outcome.rawValue)")
        return result
    }

    /// Get result for a completed proposal
    public func getResult(proposalId: String) async throws -> ProposalResult? {
        return try store.getResult(proposalId: proposalId)
    }

    // MARK: - Delegations

    /// Delegate voting power to another member
    public func createDelegation(
        delegatorId: String,
        delegateId: String,
        scope: Delegation.DelegationScope = .all,
        categoryTags: [String]? = nil,
        proposalId: String? = nil,
        validUntil: Date? = nil
    ) async throws -> Delegation {
        let delegation = Delegation(
            delegatorId: delegatorId,
            delegateId: delegateId,
            scope: scope,
            categoryTags: categoryTags,
            proposalId: proposalId,
            validUntil: validUntil
        )

        try store.saveDelegation(delegation)
        await publishDelegation(delegation)

        logger.info("Created delegation from \(delegatorId) to \(delegateId)")
        return delegation
    }

    /// Revoke a delegation
    public func revokeDelegation(id: String) async throws {
        try store.revokeDelegation(id: id)
        await publishDelegationRevocation(id)
    }

    /// Get active delegations for a user
    public func getActiveDelegations(userId: String) async throws -> [Delegation] {
        return try store.getActiveDelegations(delegatorId: userId)
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr governance events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_PROPOSAL:
            await handleProposalEvent(event)
        case Self.KIND_VOTE:
            await handleVoteEvent(event)
        case Self.KIND_DELEGATION:
            await handleDelegationEvent(event)
        case Self.KIND_RESULT:
            await handleResultEvent(event)
        default:
            break
        }
    }

    private func handleProposalEvent(_ event: NostrEvent) async {
        // In production: decode and save proposal from event
        logger.debug("Received proposal event: \(event.id)")
    }

    private func handleVoteEvent(_ event: NostrEvent) async {
        logger.debug("Received vote event: \(event.id)")
    }

    private func handleDelegationEvent(_ event: NostrEvent) async {
        logger.debug("Received delegation event: \(event.id)")
    }

    private func handleResultEvent(_ event: NostrEvent) async {
        logger.debug("Received result event: \(event.id)")
    }

    // MARK: - Nostr Publishing

    private func publishProposal(_ proposal: Proposal) async {
        logger.debug("Would publish proposal: \(proposal.id)")
    }

    private func publishProposalDeletion(_ proposalId: String) async {
        logger.debug("Would publish proposal deletion: \(proposalId)")
    }

    private func publishVote(_ vote: Vote) async {
        logger.debug("Would publish vote: \(vote.id)")
    }

    private func publishDelegation(_ delegation: Delegation) async {
        logger.debug("Would publish delegation: \(delegation.id)")
    }

    private func publishDelegationRevocation(_ delegationId: String) async {
        logger.debug("Would publish delegation revocation: \(delegationId)")
    }

    private func publishResult(_ result: ProposalResult) async {
        logger.debug("Would publish result for proposal: \(result.proposalId)")
    }
}
