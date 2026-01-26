// GovernanceModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Governance module for proposals, voting, and decision-making.

import Foundation
import SwiftUI
import os.log

/// Governance module implementation
@MainActor
public final class GovernanceModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "governance"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: GovernanceStore
    private let service: GovernanceService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "GovernanceModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try GovernanceStore()
        self.service = GovernanceService(store: store)
        logger.info("Governance module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Governance module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Governance module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route governance-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "governance",
                title: "Governance",
                icon: "checkmark.seal",
                order: 30
            ) {
                GovernanceListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Governance module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Governance module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Governance module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Create a new proposal
    public func createProposal(
        groupId: String,
        title: String,
        description: String?,
        type: ProposalType = .general,
        votingSystem: VotingSystem = .simpleMajority,
        options: [VoteOption]? = nil,
        votingDurationDays: Int = 7,
        discussionDurationDays: Int? = nil,
        createdBy: String,
        tags: [String] = []
    ) async throws -> Proposal {
        let now = Date()

        var discussionPeriod: TimePeriod?
        let votingStart: Date
        if let discussionDays = discussionDurationDays, discussionDays > 0 {
            let discussionEnd = Calendar.current.date(byAdding: .day, value: discussionDays, to: now)!
            discussionPeriod = TimePeriod(startsAt: now, endsAt: discussionEnd)
            votingStart = discussionEnd
        } else {
            votingStart = now
        }

        let votingEnd = Calendar.current.date(byAdding: .day, value: votingDurationDays, to: votingStart)!
        let votingPeriod = TimePeriod(startsAt: votingStart, endsAt: votingEnd)

        return try await service.createProposal(
            groupId: groupId,
            title: title,
            description: description,
            type: type,
            votingSystem: votingSystem,
            options: options,
            discussionPeriod: discussionPeriod,
            votingPeriod: votingPeriod,
            createdBy: createdBy,
            tags: tags
        )
    }

    /// Cast a vote on a proposal
    public func castVote(
        proposalId: String,
        choice: [String],
        voterId: String,
        comment: String? = nil
    ) async throws -> Vote {
        return try await service.castVote(
            proposalId: proposalId,
            voterId: voterId,
            choice: choice,
            comment: comment
        )
    }

    /// Get proposals for a group
    public func getProposals(groupId: String? = nil, activeOnly: Bool = false) async throws -> [Proposal] {
        return try await service.getProposals(groupId: groupId, activeOnly: activeOnly)
    }

    /// Get vote counts for a proposal
    public func getVoteCounts(proposalId: String) async throws -> [String: Int] {
        return try await service.getVoteCounts(proposalId: proposalId)
    }

    /// Get a specific proposal
    public func getProposal(id: String) async throws -> Proposal? {
        return try await service.getProposal(id: id)
    }

    /// Check if user has voted
    public func hasVoted(proposalId: String, userId: String) async throws -> Bool {
        return try await service.hasVoted(proposalId: proposalId, userId: userId)
    }
}
