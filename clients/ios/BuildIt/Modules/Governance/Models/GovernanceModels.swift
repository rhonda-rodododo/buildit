// GovernanceModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for governance, proposals, and voting.
// Protocol types imported from generated schemas; UI-only extensions defined locally.

import Foundation

// Re-export protocol types from generated schema.
// The following types come from Sources/Generated/Schemas/governance.swift:
//   Proposal, ProposalType, ProposalStatus, VotingSystem, QuorumType, ThresholdType,
//   VoteOption, OptionElement, QuorumRequirement, QuorumClass, PassingThreshold, ThresholdClass,
//   QuadraticVotingConfig, QuadraticConfigClass, QuadraticBallot, QuadraticBallotClass,
//   QuadraticOptionResult, QuadraticResultValue, AttachmentType, AttachmentElement,
//   ProposalAttachment, Vote, Choice, Delegation, Scope, ProposalResult, Outcome,
//   DiscussionPeriod, VotingPeriod, GovernanceSchema

// MARK: - UI Extensions for ProposalType

extension ProposalType: CaseIterable {
    public static var allCases: [ProposalType] {
        [.general, .policy, .budget, .election, .amendment, .action, .resolution]
    }

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

// MARK: - UI Extensions for ProposalStatus

extension ProposalStatus: CaseIterable {
    public static var allCases: [ProposalStatus] {
        [.draft, .discussion, .voting, .passed, .rejected, .expired, .withdrawn, .implemented]
    }

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
        case .passed, .rejected, .expired, .withdrawn, .implemented:
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

// MARK: - UI Extensions for VotingSystem

extension VotingSystem: CaseIterable {
    public static var allCases: [VotingSystem] {
        [.simpleMajority, .supermajority, .rankedChoice, .approval,
         .quadratic, .dHondt, .consensus, .modifiedConsensus]
    }

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

    var detailedDescription: String {
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

// MARK: - UI Extensions for Outcome

extension Outcome: CaseIterable {
    public static var allCases: [Outcome] {
        [.passed, .rejected, .noQuorum, .tie, .expired]
    }

    var displayName: String {
        switch self {
        case .passed: return "Passed"
        case .rejected: return "Rejected"
        case .noQuorum: return "No Quorum"
        case .tie: return "Tie"
        case .expired: return "Expired"
        }
    }
}

// MARK: - UI Extensions for AttachmentType

extension AttachmentType: CaseIterable {
    public static var allCases: [AttachmentType] {
        [.file, .url, .document]
    }
}

// MARK: - UI View Helpers for VoteOption

extension VoteOption {
    /// Default yes/no options
    public static var yesNo: [VoteOption] {
        [
            VoteOption(color: "green", description: "Vote in favor", id: "yes", label: "Yes", order: 0),
            VoteOption(color: "red", description: "Vote against", id: "no", label: "No", order: 1),
            VoteOption(color: "gray", description: "Neither for nor against", id: "abstain", label: "Abstain", order: 2)
        ]
    }
}

// MARK: - UI View Helpers for QuorumRequirement

extension QuorumRequirement {
    public static var none: QuorumRequirement {
        QuorumRequirement(countAbstentions: nil, type: .none, value: nil)
    }

    public static func percentage(_ value: Double) -> QuorumRequirement {
        QuorumRequirement(countAbstentions: true, type: .percentage, value: value)
    }
}

// MARK: - UI View Helpers for PassingThreshold

extension PassingThreshold {
    public static var simpleMajority: PassingThreshold {
        PassingThreshold(percentage: 50.01, type: .simpleMajority)
    }

    public static var supermajority: PassingThreshold {
        PassingThreshold(percentage: 66.67, type: .supermajority)
    }
}

// MARK: - UI View Helpers for QuadraticVotingConfig

extension QuadraticVotingConfig {
    public static var `default`: QuadraticVotingConfig {
        QuadraticVotingConfig(maxTokensPerOption: nil, tokenBudget: 100)
    }
}

// MARK: - UI View Helpers for QuadraticBallot

extension QuadraticBallot {
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

// MARK: - UI-Only Types

/// Time period for discussion or voting (UI-only, uses Date instead of Int timestamps)
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
