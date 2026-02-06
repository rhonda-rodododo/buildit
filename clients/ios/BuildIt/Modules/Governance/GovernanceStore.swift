// GovernanceStore.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData persistence for governance data.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Models

@Model
public final class ProposalEntity {
    @Attribute(.unique) public var id: String
    public var groupId: String
    public var title: String
    public var descriptionText: String?
    public var typeRaw: String
    public var statusRaw: String
    public var votingSystemRaw: String
    public var optionsJson: String // JSON encoded VoteOption array
    public var quorumJson: String? // JSON encoded QuorumRequirement
    public var thresholdJson: String? // JSON encoded PassingThreshold
    public var discussionStartsAt: Date?
    public var discussionEndsAt: Date?
    public var votingStartsAt: Date
    public var votingEndsAt: Date
    public var allowAbstain: Bool
    public var anonymousVoting: Bool
    public var allowDelegation: Bool
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var tagsJson: String // JSON encoded tags array
    public var quadraticConfigJson: String? // JSON encoded QuadraticVotingConfig

    public init(
        id: String,
        groupId: String,
        title: String,
        descriptionText: String?,
        typeRaw: String,
        statusRaw: String,
        votingSystemRaw: String,
        optionsJson: String,
        quorumJson: String?,
        thresholdJson: String?,
        discussionStartsAt: Date?,
        discussionEndsAt: Date?,
        votingStartsAt: Date,
        votingEndsAt: Date,
        allowAbstain: Bool,
        anonymousVoting: Bool,
        allowDelegation: Bool,
        createdBy: String,
        createdAt: Date,
        updatedAt: Date?,
        tagsJson: String,
        quadraticConfigJson: String? = nil
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.descriptionText = descriptionText
        self.typeRaw = typeRaw
        self.statusRaw = statusRaw
        self.votingSystemRaw = votingSystemRaw
        self.optionsJson = optionsJson
        self.quorumJson = quorumJson
        self.thresholdJson = thresholdJson
        self.discussionStartsAt = discussionStartsAt
        self.discussionEndsAt = discussionEndsAt
        self.votingStartsAt = votingStartsAt
        self.votingEndsAt = votingEndsAt
        self.allowAbstain = allowAbstain
        self.anonymousVoting = anonymousVoting
        self.allowDelegation = allowDelegation
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.tagsJson = tagsJson
        self.quadraticConfigJson = quadraticConfigJson
    }
}

@Model
public final class VoteEntity {
    @Attribute(.unique) public var id: String
    public var proposalId: String
    public var voterId: String
    public var choiceJson: String // JSON encoded choice array
    public var weight: Double
    public var delegatedFromJson: String? // JSON encoded delegators array
    public var comment: String?
    public var castAt: Date

    public init(
        id: String,
        proposalId: String,
        voterId: String,
        choiceJson: String,
        weight: Double,
        delegatedFromJson: String?,
        comment: String?,
        castAt: Date
    ) {
        self.id = id
        self.proposalId = proposalId
        self.voterId = voterId
        self.choiceJson = choiceJson
        self.weight = weight
        self.delegatedFromJson = delegatedFromJson
        self.comment = comment
        self.castAt = castAt
    }
}

@Model
public final class DelegationEntity {
    @Attribute(.unique) public var id: String
    public var delegatorId: String
    public var delegateId: String
    public var scopeRaw: String
    public var categoryTagsJson: String?
    public var proposalId: String?
    public var validFrom: Date
    public var validUntil: Date?
    public var revoked: Bool
    public var createdAt: Date

    public init(
        id: String,
        delegatorId: String,
        delegateId: String,
        scopeRaw: String,
        categoryTagsJson: String?,
        proposalId: String?,
        validFrom: Date,
        validUntil: Date?,
        revoked: Bool,
        createdAt: Date
    ) {
        self.id = id
        self.delegatorId = delegatorId
        self.delegateId = delegateId
        self.scopeRaw = scopeRaw
        self.categoryTagsJson = categoryTagsJson
        self.proposalId = proposalId
        self.validFrom = validFrom
        self.validUntil = validUntil
        self.revoked = revoked
        self.createdAt = createdAt
    }
}

@Model
public final class ProposalResultEntity {
    @Attribute(.unique) public var proposalId: String
    public var outcomeRaw: String
    public var winningOptionsJson: String
    public var voteCountsJson: String
    public var totalVotes: Int
    public var totalEligible: Int
    public var participation: Double
    public var quorumMet: Bool
    public var thresholdMet: Bool
    public var calculatedAt: Date

    public init(
        proposalId: String,
        outcomeRaw: String,
        winningOptionsJson: String,
        voteCountsJson: String,
        totalVotes: Int,
        totalEligible: Int,
        participation: Double,
        quorumMet: Bool,
        thresholdMet: Bool,
        calculatedAt: Date
    ) {
        self.proposalId = proposalId
        self.outcomeRaw = outcomeRaw
        self.winningOptionsJson = winningOptionsJson
        self.voteCountsJson = voteCountsJson
        self.totalVotes = totalVotes
        self.totalEligible = totalEligible
        self.participation = participation
        self.quorumMet = quorumMet
        self.thresholdMet = thresholdMet
        self.calculatedAt = calculatedAt
    }
}

// MARK: - GovernanceStore

@MainActor
public final class GovernanceStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "GovernanceStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init() throws {
        let schema = Schema([
            ProposalEntity.self,
            VoteEntity.self,
            DelegationEntity.self,
            ProposalResultEntity.self
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [config])
        self.modelContext = modelContainer.mainContext
    }

    // MARK: - Proposals

    public func saveProposal(_ proposal: Proposal) throws {
        let optionsData = try encoder.encode(proposal.options)
        let optionsJson = String(data: optionsData, encoding: .utf8) ?? "[]"

        var quorumJson: String?
        if let quorum = proposal.quorum {
            let data = try encoder.encode(quorum)
            quorumJson = String(data: data, encoding: .utf8)
        }

        var thresholdJson: String?
        if let threshold = proposal.threshold {
            let data = try encoder.encode(threshold)
            thresholdJson = String(data: data, encoding: .utf8)
        }

        let tagsData = try encoder.encode(proposal.tags)
        let tagsJson = String(data: tagsData, encoding: .utf8) ?? "[]"

        var quadraticConfigJson: String?
        if let qConfig = proposal.quadraticConfig {
            let data = try encoder.encode(qConfig)
            quadraticConfigJson = String(data: data, encoding: .utf8)
        }

        let entity = ProposalEntity(
            id: proposal.id,
            groupId: proposal.groupId,
            title: proposal.title,
            descriptionText: proposal.description,
            typeRaw: proposal.type.rawValue,
            statusRaw: proposal.status.rawValue,
            votingSystemRaw: proposal.votingSystem.rawValue,
            optionsJson: optionsJson,
            quorumJson: quorumJson,
            thresholdJson: thresholdJson,
            discussionStartsAt: proposal.discussionPeriod?.startsAt,
            discussionEndsAt: proposal.discussionPeriod?.endsAt,
            votingStartsAt: proposal.votingPeriod.startsAt,
            votingEndsAt: proposal.votingPeriod.endsAt,
            allowAbstain: proposal.allowAbstain,
            anonymousVoting: proposal.anonymousVoting,
            allowDelegation: proposal.allowDelegation,
            createdBy: proposal.createdBy,
            createdAt: proposal.createdAt,
            updatedAt: proposal.updatedAt,
            tagsJson: tagsJson,
            quadraticConfigJson: quadraticConfigJson
        )

        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved proposal: \(proposal.id)")
    }

    public func getProposal(id: String) throws -> Proposal? {
        let descriptor = FetchDescriptor<ProposalEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToProposal(entity)
    }

    public func getProposals(groupId: String? = nil, status: ProposalStatus? = nil) throws -> [Proposal] {
        var descriptor = FetchDescriptor<ProposalEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        if let groupId = groupId, let status = status {
            let statusRaw = status.rawValue
            descriptor.predicate = #Predicate { $0.groupId == groupId && $0.statusRaw == statusRaw }
        } else if let groupId = groupId {
            descriptor.predicate = #Predicate { $0.groupId == groupId }
        } else if let status = status {
            let statusRaw = status.rawValue
            descriptor.predicate = #Predicate { $0.statusRaw == statusRaw }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToProposal($0) }
    }

    public func getActiveProposals(groupId: String? = nil) throws -> [Proposal] {
        let activeStatuses = ["draft", "discussion", "voting"]
        var descriptor = FetchDescriptor<ProposalEntity>(
            predicate: #Predicate { activeStatuses.contains($0.statusRaw) },
            sortBy: [SortDescriptor(\.votingEndsAt, order: .forward)]
        )

        if let groupId = groupId {
            descriptor.predicate = #Predicate {
                activeStatuses.contains($0.statusRaw) && $0.groupId == groupId
            }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToProposal($0) }
    }

    public func updateProposalStatus(id: String, status: ProposalStatus) throws {
        let descriptor = FetchDescriptor<ProposalEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            throw GovernanceError.proposalNotFound
        }

        entity.statusRaw = status.rawValue
        entity.updatedAt = Date()
        try modelContext.save()
    }

    public func deleteProposal(id: String) throws {
        let descriptor = FetchDescriptor<ProposalEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToProposal(_ entity: ProposalEntity) throws -> Proposal {
        let options: [VoteOption] = try decoder.decode([VoteOption].self, from: entity.optionsJson.data(using: .utf8) ?? Data())

        var quorum: QuorumRequirement?
        if let quorumJson = entity.quorumJson, let data = quorumJson.data(using: .utf8) {
            quorum = try decoder.decode(QuorumRequirement.self, from: data)
        }

        var threshold: PassingThreshold?
        if let thresholdJson = entity.thresholdJson, let data = thresholdJson.data(using: .utf8) {
            threshold = try decoder.decode(PassingThreshold.self, from: data)
        }

        var discussionPeriod: TimePeriod?
        if let start = entity.discussionStartsAt, let end = entity.discussionEndsAt {
            discussionPeriod = TimePeriod(startsAt: start, endsAt: end)
        }

        let tags: [String] = (try? decoder.decode([String].self, from: entity.tagsJson.data(using: .utf8) ?? Data())) ?? []

        var quadraticConfig: QuadraticVotingConfig?
        if let qJson = entity.quadraticConfigJson, let data = qJson.data(using: .utf8) {
            quadraticConfig = try? decoder.decode(QuadraticVotingConfig.self, from: data)
        }

        return Proposal(
            id: entity.id,
            groupId: entity.groupId,
            title: entity.title,
            description: entity.descriptionText,
            type: ProposalType(rawValue: entity.typeRaw) ?? .general,
            status: ProposalStatus(rawValue: entity.statusRaw) ?? .draft,
            votingSystem: VotingSystem(rawValue: entity.votingSystemRaw) ?? .simpleMajority,
            options: options,
            quorum: quorum,
            threshold: threshold,
            discussionPeriod: discussionPeriod,
            votingPeriod: TimePeriod(startsAt: entity.votingStartsAt, endsAt: entity.votingEndsAt),
            allowAbstain: entity.allowAbstain,
            anonymousVoting: entity.anonymousVoting,
            allowDelegation: entity.allowDelegation,
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            tags: tags,
            quadraticConfig: quadraticConfig
        )
    }

    // MARK: - Votes

    public func saveVote(_ vote: Vote) throws {
        let choiceData = try encoder.encode(vote.choice)
        let choiceJson = String(data: choiceData, encoding: .utf8) ?? "[]"

        var delegatedFromJson: String?
        if let delegatedFrom = vote.delegatedFrom {
            let data = try encoder.encode(delegatedFrom)
            delegatedFromJson = String(data: data, encoding: .utf8)
        }

        let entity = VoteEntity(
            id: vote.id,
            proposalId: vote.proposalId,
            voterId: vote.voterId,
            choiceJson: choiceJson,
            weight: vote.weight,
            delegatedFromJson: delegatedFromJson,
            comment: vote.comment,
            castAt: vote.castAt
        )

        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved vote: \(vote.id)")
    }

    public func getVotesForProposal(proposalId: String) throws -> [Vote] {
        let descriptor = FetchDescriptor<VoteEntity>(
            predicate: #Predicate { $0.proposalId == proposalId },
            sortBy: [SortDescriptor(\.castAt, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)
        return try entities.map { try entityToVote($0) }
    }

    public func getUserVote(proposalId: String, voterId: String) throws -> Vote? {
        let descriptor = FetchDescriptor<VoteEntity>(
            predicate: #Predicate { $0.proposalId == proposalId && $0.voterId == voterId }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToVote(entity)
    }

    public func hasVoted(proposalId: String, voterId: String) throws -> Bool {
        let descriptor = FetchDescriptor<VoteEntity>(
            predicate: #Predicate { $0.proposalId == proposalId && $0.voterId == voterId }
        )
        return try modelContext.fetchCount(descriptor) > 0
    }

    private func entityToVote(_ entity: VoteEntity) throws -> Vote {
        let choice: [String] = try decoder.decode([String].self, from: entity.choiceJson.data(using: .utf8) ?? Data())

        var delegatedFrom: [String]?
        if let json = entity.delegatedFromJson, let data = json.data(using: .utf8) {
            delegatedFrom = try decoder.decode([String].self, from: data)
        }

        return Vote(
            id: entity.id,
            proposalId: entity.proposalId,
            voterId: entity.voterId,
            choice: choice,
            weight: entity.weight,
            delegatedFrom: delegatedFrom,
            comment: entity.comment,
            castAt: entity.castAt
        )
    }

    // MARK: - Delegations

    public func saveDelegation(_ delegation: Delegation) throws {
        var categoryTagsJson: String?
        if let tags = delegation.categoryTags {
            let data = try encoder.encode(tags)
            categoryTagsJson = String(data: data, encoding: .utf8)
        }

        let entity = DelegationEntity(
            id: delegation.id,
            delegatorId: delegation.delegatorId,
            delegateId: delegation.delegateId,
            scopeRaw: delegation.scope.rawValue,
            categoryTagsJson: categoryTagsJson,
            proposalId: delegation.proposalId,
            validFrom: delegation.validFrom,
            validUntil: delegation.validUntil,
            revoked: delegation.revoked,
            createdAt: delegation.createdAt
        )

        modelContext.insert(entity)
        try modelContext.save()
    }

    public func getActiveDelegations(delegatorId: String) throws -> [Delegation] {
        let descriptor = FetchDescriptor<DelegationEntity>(
            predicate: #Predicate { $0.delegatorId == delegatorId && $0.revoked == false }
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.compactMap { entityToDelegation($0) }.filter { $0.isActive }
    }

    public func revokeDelegation(id: String) throws {
        let descriptor = FetchDescriptor<DelegationEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            throw GovernanceError.delegationNotFound
        }

        entity.revoked = true
        try modelContext.save()
    }

    private func entityToDelegation(_ entity: DelegationEntity) -> Delegation {
        var categoryTags: [String]?
        if let json = entity.categoryTagsJson, let data = json.data(using: .utf8) {
            categoryTags = try? decoder.decode([String].self, from: data)
        }

        return Delegation(
            id: entity.id,
            delegatorId: entity.delegatorId,
            delegateId: entity.delegateId,
            scope: Delegation.DelegationScope(rawValue: entity.scopeRaw) ?? .all,
            categoryTags: categoryTags,
            proposalId: entity.proposalId,
            validFrom: entity.validFrom,
            validUntil: entity.validUntil,
            revoked: entity.revoked,
            createdAt: entity.createdAt
        )
    }

    // MARK: - Results

    public func saveResult(_ result: ProposalResult) throws {
        let winningOptionsData = try encoder.encode(result.winningOptions)
        let winningOptionsJson = String(data: winningOptionsData, encoding: .utf8) ?? "[]"

        let voteCountsData = try encoder.encode(result.voteCounts)
        let voteCountsJson = String(data: voteCountsData, encoding: .utf8) ?? "{}"

        let entity = ProposalResultEntity(
            proposalId: result.proposalId,
            outcomeRaw: result.outcome.rawValue,
            winningOptionsJson: winningOptionsJson,
            voteCountsJson: voteCountsJson,
            totalVotes: result.totalVotes,
            totalEligible: result.totalEligible,
            participation: result.participation,
            quorumMet: result.quorumMet,
            thresholdMet: result.thresholdMet,
            calculatedAt: result.calculatedAt
        )

        modelContext.insert(entity)
        try modelContext.save()
    }

    public func getResult(proposalId: String) throws -> ProposalResult? {
        let descriptor = FetchDescriptor<ProposalResultEntity>(
            predicate: #Predicate { $0.proposalId == proposalId }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToResult(entity)
    }

    private func entityToResult(_ entity: ProposalResultEntity) throws -> ProposalResult {
        let winningOptions: [String] = try decoder.decode([String].self, from: entity.winningOptionsJson.data(using: .utf8) ?? Data())
        let voteCounts: [String: Int] = try decoder.decode([String: Int].self, from: entity.voteCountsJson.data(using: .utf8) ?? Data())

        return ProposalResult(
            proposalId: entity.proposalId,
            outcome: ProposalOutcome(rawValue: entity.outcomeRaw) ?? .expired,
            winningOptions: winningOptions,
            voteCounts: voteCounts,
            totalVotes: entity.totalVotes,
            totalEligible: entity.totalEligible,
            participation: entity.participation,
            quorumMet: entity.quorumMet,
            thresholdMet: entity.thresholdMet,
            calculatedAt: entity.calculatedAt
        )
    }
}

// MARK: - Errors

public enum GovernanceError: Error {
    case proposalNotFound
    case voteNotFound
    case delegationNotFound
    case alreadyVoted
    case votingNotOpen
    case notAuthorized
    case invalidVote
}
