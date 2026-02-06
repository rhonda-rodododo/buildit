// GovernanceModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for governance, proposals, and voting.

import Foundation

// MARK: - Enums

/// Type of proposal
public enum ProposalType: String, Codable, CaseIterable, Sendable {
    case general
    case policy
    case budget
    case election
    case amendment
    case action
    case resolution

    var displayName: String {
        switch self {
        case .general: return "General"
        case .policy: return "Policy"
        case .budget: return "Budget"
        case .election: return "Election"
        case .amendment: return "Amendment"
        case .action: return "Action"
        case .resolution: return "Resolution"
        }
    }

    var icon: String {
        switch self {
        case .general: return "doc.text"
        case .policy: return "checkmark.shield"
        case .budget: return "dollarsign.circle"
        case .election: return "person.3"
        case .amendment: return "pencil.line"
        case .action: return "bolt.fill"
        case .resolution: return "flag"
        }
    }
}

/// Current status of a proposal
public enum ProposalStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case discussion
    case voting
    case passed
    case rejected
    case expired
    case withdrawn
    case implemented

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .discussion: return "Discussion"
        case .voting: return "Voting"
        case .passed: return "Passed"
        case .rejected: return "Rejected"
        case .expired: return "Expired"
        case .withdrawn: return "Withdrawn"
        case .implemented: return "Implemented"
        }
    }

    var isActive: Bool {
        switch self {
        case .draft, .discussion, .voting:
            return true
        default:
            return false
        }
    }

    var color: String {
        switch self {
        case .draft: return "gray"
        case .discussion: return "blue"
        case .voting: return "orange"
        case .passed: return "green"
        case .rejected: return "red"
        case .expired: return "gray"
        case .withdrawn: return "gray"
        case .implemented: return "purple"
        }
    }
}

/// Voting system types
public enum VotingSystem: String, Codable, CaseIterable, Sendable {
    case simpleMajority = "simple-majority"
    case supermajority = "supermajority"
    case rankedChoice = "ranked-choice"
    case approval
    case quadratic
    case dHondt = "d-hondt"
    case consensus
    case modifiedConsensus = "modified-consensus"

    var displayName: String {
        switch self {
        case .simpleMajority: return "Simple Majority"
        case .supermajority: return "Supermajority (2/3)"
        case .rankedChoice: return "Ranked Choice"
        case .approval: return "Approval Voting"
        case .quadratic: return "Quadratic Voting"
        case .dHondt: return "D'Hondt Method"
        case .consensus: return "Consensus"
        case .modifiedConsensus: return "Modified Consensus"
        }
    }

    var description: String {
        switch self {
        case .simpleMajority: return "More than 50% required to pass"
        case .supermajority: return "Two-thirds majority required"
        case .rankedChoice: return "Rank options in order of preference"
        case .approval: return "Vote for all acceptable options"
        case .quadratic: return "Vote power scales with stake"
        case .dHondt: return "Proportional representation method"
        case .consensus: return "Unanimous agreement required"
        case .modifiedConsensus: return "Consensus with blocking threshold"
        }
    }
}

/// Quorum requirement type
public enum QuorumType: String, Codable, Sendable {
    case percentage
    case absolute
    case none
}

/// Threshold type for passing
public enum ThresholdType: String, Codable, Sendable {
    case simpleMajority = "simple-majority"
    case supermajority
    case unanimous
    case custom
}

/// Proposal outcome
public enum ProposalOutcome: String, Codable, Sendable {
    case passed
    case rejected
    case noQuorum = "no-quorum"
    case tie
    case expired
}

// MARK: - Models

/// A voting option for a proposal
public struct VoteOption: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let description: String?
    public let color: String?
    public let order: Int

    public init(
        id: String = UUID().uuidString,
        label: String,
        description: String? = nil,
        color: String? = nil,
        order: Int = 0
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.color = color
        self.order = order
    }

    /// Default yes/no options
    public static var yesNo: [VoteOption] {
        [
            VoteOption(id: "yes", label: "Yes", description: "Vote in favor", color: "green", order: 0),
            VoteOption(id: "no", label: "No", description: "Vote against", color: "red", order: 1),
            VoteOption(id: "abstain", label: "Abstain", description: "Neither for nor against", color: "gray", order: 2)
        ]
    }
}

/// Quorum requirement configuration
public struct QuorumRequirement: Codable, Sendable {
    public let type: QuorumType
    public let value: Double?
    public let countAbstentions: Bool

    public init(type: QuorumType, value: Double? = nil, countAbstentions: Bool = true) {
        self.type = type
        self.value = value
        self.countAbstentions = countAbstentions
    }

    public static var none: QuorumRequirement {
        QuorumRequirement(type: .none)
    }

    public static func percentage(_ value: Double) -> QuorumRequirement {
        QuorumRequirement(type: .percentage, value: value)
    }
}

/// Passing threshold configuration
public struct PassingThreshold: Codable, Sendable {
    public let type: ThresholdType
    public let percentage: Double?

    public init(type: ThresholdType, percentage: Double? = nil) {
        self.type = type
        self.percentage = percentage
    }

    public static var simpleMajority: PassingThreshold {
        PassingThreshold(type: .simpleMajority, percentage: 50.01)
    }

    public static var supermajority: PassingThreshold {
        PassingThreshold(type: .supermajority, percentage: 66.67)
    }
}

/// Configuration for quadratic voting on a proposal
public struct QuadraticVotingConfig: Codable, Sendable {
    /// Total token budget each voter receives to allocate across options
    public let tokenBudget: Int
    /// Maximum tokens a voter can allocate to a single option (defaults to tokenBudget)
    public let maxTokensPerOption: Int?

    public init(tokenBudget: Int, maxTokensPerOption: Int? = nil) {
        self.tokenBudget = tokenBudget
        self.maxTokensPerOption = maxTokensPerOption
    }

    public static var `default`: QuadraticVotingConfig {
        QuadraticVotingConfig(tokenBudget: 100)
    }
}

/// A quadratic voting ballot with token allocations across options
public struct QuadraticBallot: Codable, Sendable {
    /// Map of option ID to number of tokens allocated
    public let allocations: [String: Int]
    /// Total tokens used in this ballot (sum of all allocations, must not exceed budget)
    public let totalTokens: Int

    public init(allocations: [String: Int]) {
        self.allocations = allocations
        self.totalTokens = allocations.values.reduce(0, +)
    }

    /// Calculate effective votes for each option: sqrt(tokens)
    public var effectiveVotes: [String: Double] {
        allocations.mapValues { tokens in
            tokens > 0 ? sqrt(Double(tokens)) : 0
        }
    }

    /// Validate that the ballot doesn't exceed the token budget
    public func validate(config: QuadraticVotingConfig, validOptionIds: Set<String>) -> Bool {
        guard totalTokens <= config.tokenBudget else { return false }
        for (optionId, tokens) in allocations {
            guard tokens >= 0 else { return false }
            guard validOptionIds.contains(optionId) else { return false }
            if let maxPerOption = config.maxTokensPerOption, tokens > maxPerOption {
                return false
            }
        }
        return true
    }
}

/// Result for a single option in quadratic voting
public struct QuadraticOptionResult: Codable, Sendable {
    /// Total tokens allocated to this option across all voters
    public let totalTokens: Int
    /// Sum of sqrt(tokens) across all voters
    public let effectiveVotes: Double
    /// Number of voters who allocated tokens to this option
    public let voterCount: Int

    public init(totalTokens: Int, effectiveVotes: Double, voterCount: Int) {
        self.totalTokens = totalTokens
        self.effectiveVotes = effectiveVotes
        self.voterCount = voterCount
    }
}

/// Time period for discussion or voting
public struct TimePeriod: Codable, Sendable {
    public let startsAt: Date
    public let endsAt: Date

    public init(startsAt: Date, endsAt: Date) {
        self.startsAt = startsAt
        self.endsAt = endsAt
    }

    public var isActive: Bool {
        let now = Date()
        return now >= startsAt && now <= endsAt
    }

    public var hasEnded: Bool {
        Date() > endsAt
    }

    public var hasStarted: Bool {
        Date() >= startsAt
    }

    public var remainingTime: TimeInterval {
        max(0, endsAt.timeIntervalSinceNow)
    }
}

/// Attachment type for proposals
public enum AttachmentType: String, Codable, Sendable {
    case file
    case url
    case document
}

/// Supporting document for a proposal
public struct ProposalAttachment: Codable, Sendable {
    public let type: AttachmentType
    public let name: String
    public let url: String?
    public let mimeType: String?
    public let size: Int?

    public init(
        type: AttachmentType,
        name: String,
        url: String? = nil,
        mimeType: String? = nil,
        size: Int? = nil
    ) {
        self.type = type
        self.name = name
        self.url = url
        self.mimeType = mimeType
        self.size = size
    }
}

/// A proposal for group decision-making
public struct Proposal: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let groupId: String
    public let title: String
    public let description: String?
    public let type: ProposalType
    public var status: ProposalStatus
    public let votingSystem: VotingSystem
    public let options: [VoteOption]
    public let quorum: QuorumRequirement?
    public let threshold: PassingThreshold?
    public let discussionPeriod: TimePeriod?
    public let votingPeriod: TimePeriod
    public let allowAbstain: Bool
    public let anonymousVoting: Bool
    public let allowDelegation: Bool
    public let createdBy: String
    public let createdAt: Date
    public var updatedAt: Date?
    public let attachments: [ProposalAttachment]?
    public let tags: [String]
    public let quadraticConfig: QuadraticVotingConfig?
    public let customFields: [String: AnyCodable]?

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, groupId, title, description, type, status
        case votingSystem, options, quorum, threshold
        case discussionPeriod, votingPeriod
        case allowAbstain, anonymousVoting, allowDelegation
        case createdBy, createdAt, updatedAt
        case attachments, tags, quadraticConfig, customFields
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        groupId: String,
        title: String,
        description: String? = nil,
        type: ProposalType = .general,
        status: ProposalStatus = .draft,
        votingSystem: VotingSystem = .simpleMajority,
        options: [VoteOption] = VoteOption.yesNo,
        quorum: QuorumRequirement? = nil,
        threshold: PassingThreshold? = .simpleMajority,
        discussionPeriod: TimePeriod? = nil,
        votingPeriod: TimePeriod,
        allowAbstain: Bool = true,
        anonymousVoting: Bool = false,
        allowDelegation: Bool = false,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        attachments: [ProposalAttachment]? = nil,
        tags: [String] = [],
        quadraticConfig: QuadraticVotingConfig? = nil,
        customFields: [String: AnyCodable]? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.groupId = groupId
        self.title = title
        self.description = description
        self.type = type
        self.status = status
        self.votingSystem = votingSystem
        self.options = options
        self.quorum = quorum
        self.threshold = threshold
        self.discussionPeriod = discussionPeriod
        self.votingPeriod = votingPeriod
        self.allowAbstain = allowAbstain
        self.anonymousVoting = anonymousVoting
        self.allowDelegation = allowDelegation
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.attachments = attachments
        self.tags = tags
        self.quadraticConfig = quadraticConfig
        self.customFields = customFields
    }

    public var canVote: Bool {
        status == .voting && votingPeriod.isActive
    }

    public var isInDiscussion: Bool {
        status == .discussion && (discussionPeriod?.isActive ?? false)
    }
}

/// A vote cast on a proposal
public struct Vote: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let proposalId: String
    public let voterId: String
    public let choice: [String] // Option IDs - single for simple, multiple for ranked/approval
    public let weight: Double
    public let delegatedFrom: [String]?
    public let comment: String?
    public let castAt: Date
    public let signature: String?

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, proposalId, voterId, choice
        case weight, delegatedFrom, comment, castAt, signature
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        proposalId: String,
        voterId: String,
        choice: [String],
        weight: Double = 1.0,
        delegatedFrom: [String]? = nil,
        comment: String? = nil,
        castAt: Date = Date(),
        signature: String? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.proposalId = proposalId
        self.voterId = voterId
        self.choice = choice
        self.weight = weight
        self.delegatedFrom = delegatedFrom
        self.comment = comment
        self.castAt = castAt
        self.signature = signature
    }
}

/// Vote delegation for liquid democracy
public struct Delegation: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let delegatorId: String
    public let delegateId: String
    public let scope: DelegationScope
    public let categoryTags: [String]?
    public let proposalId: String?
    public let validFrom: Date
    public let validUntil: Date?
    public var revoked: Bool
    public let createdAt: Date

    public enum DelegationScope: String, Codable, Sendable {
        case all
        case category
        case proposal
    }

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, delegatorId, delegateId, scope
        case categoryTags, proposalId, validFrom, validUntil
        case revoked, createdAt
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        delegatorId: String,
        delegateId: String,
        scope: DelegationScope = .all,
        categoryTags: [String]? = nil,
        proposalId: String? = nil,
        validFrom: Date = Date(),
        validUntil: Date? = nil,
        revoked: Bool = false,
        createdAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.delegatorId = delegatorId
        self.delegateId = delegateId
        self.scope = scope
        self.categoryTags = categoryTags
        self.proposalId = proposalId
        self.validFrom = validFrom
        self.validUntil = validUntil
        self.revoked = revoked
        self.createdAt = createdAt
    }

    public var isActive: Bool {
        guard !revoked else { return false }
        let now = Date()
        guard now >= validFrom else { return false }
        if let until = validUntil, now > until { return false }
        return true
    }
}

/// Result of a completed proposal vote
public struct ProposalResult: Codable, Sendable {
    public let schemaVersion: String
    public let proposalId: String
    public let outcome: ProposalOutcome
    public let winningOptions: [String]
    public let voteCounts: [String: Int]
    public let totalVotes: Int
    public let totalEligible: Int
    public let participation: Double
    public let quorumMet: Bool
    public let thresholdMet: Bool
    public let calculatedAt: Date

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case proposalId, outcome, winningOptions, voteCounts
        case totalVotes, totalEligible, participation
        case quorumMet, thresholdMet, calculatedAt
    }

    public init(
        schemaVersion: String = "1.0.0",
        proposalId: String,
        outcome: ProposalOutcome,
        winningOptions: [String] = [],
        voteCounts: [String: Int] = [:],
        totalVotes: Int,
        totalEligible: Int,
        participation: Double,
        quorumMet: Bool,
        thresholdMet: Bool,
        calculatedAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.proposalId = proposalId
        self.outcome = outcome
        self.winningOptions = winningOptions
        self.voteCounts = voteCounts
        self.totalVotes = totalVotes
        self.totalEligible = totalEligible
        self.participation = participation
        self.quorumMet = quorumMet
        self.thresholdMet = thresholdMet
        self.calculatedAt = calculatedAt
    }
}
