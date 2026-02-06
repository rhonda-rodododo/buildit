// FundraisingModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for fundraising campaigns, donations, and financial tracking.
// Protocol types imported from generated schemas; UI-only extensions defined locally.

import Foundation

// Re-export protocol types from generated schema.
// The following types come from Sources/Generated/Schemas/fundraising.swift:
//   Campaign, CampaignStatus, Donation, DonationStatus, DonationTier,
//   CampaignUpdate, Expense, PaymentMethod, TierElement, UpdateElement,
//   Visibility, FundraisingSchema

// MARK: - UI Extensions for CampaignStatus

extension CampaignStatus: CaseIterable {
    public static var allCases: [CampaignStatus] {
        [.draft, .active, .paused, .completed, .cancelled]
    }

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .active: return "Active"
        case .paused: return "Paused"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }

    var isActive: Bool {
        self == .active
    }

    var color: String {
        switch self {
        case .draft: return "gray"
        case .active: return "green"
        case .paused: return "yellow"
        case .completed: return "blue"
        case .cancelled: return "red"
        }
    }
}

// MARK: - UI Extensions for Visibility (Fundraising)

extension Visibility: CaseIterable {
    public static var allCases: [Visibility] {
        [.visibilityPrivate, .group, .visibilityPublic]
    }

    var displayName: String {
        switch self {
        case .visibilityPrivate: return "Private"
        case .group: return "Group Only"
        case .visibilityPublic: return "Public"
        }
    }

    var icon: String {
        switch self {
        case .visibilityPrivate: return "lock"
        case .group: return "person.2"
        case .visibilityPublic: return "globe"
        }
    }
}

// MARK: - UI Extensions for PaymentMethod

extension PaymentMethod: CaseIterable {
    public static var allCases: [PaymentMethod] {
        [.card, .bank, .crypto, .cash, .check, .other]
    }

    var displayName: String {
        switch self {
        case .card: return "Card"
        case .bank: return "Bank Transfer"
        case .crypto: return "Cryptocurrency"
        case .cash: return "Cash"
        case .check: return "Check"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .card: return "creditcard"
        case .bank: return "building.columns"
        case .crypto: return "bitcoinsign.circle"
        case .cash: return "banknote"
        case .check: return "doc.text"
        case .other: return "questionmark.circle"
        }
    }
}

// MARK: - UI Extensions for DonationStatus

extension DonationStatus: CaseIterable {
    public static var allCases: [DonationStatus] {
        [.pending, .completed, .failed, .refunded]
    }

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .refunded: return "Refunded"
        }
    }

    var color: String {
        switch self {
        case .pending: return "yellow"
        case .completed: return "green"
        case .failed: return "red"
        case .refunded: return "gray"
        }
    }
}

// MARK: - UI-Only Types

/// Cryptocurrency type for crypto payments (UI-only, not in protocol schema)
public enum CryptoType: String, Codable, CaseIterable, Sendable {
    case bitcoin
    case ethereum
    case lightning

    var displayName: String {
        switch self {
        case .bitcoin: return "Bitcoin"
        case .ethereum: return "Ethereum"
        case .lightning: return "Lightning"
        }
    }

    var icon: String {
        switch self {
        case .bitcoin: return "bitcoinsign.circle"
        case .ethereum: return "diamond"
        case .lightning: return "bolt.circle"
        }
    }

    var symbol: String {
        switch self {
        case .bitcoin: return "BTC"
        case .ethereum: return "ETH"
        case .lightning: return "SAT"
        }
    }
}

/// Crypto payment addresses for a campaign (UI-only, not in protocol schema)
public struct CryptoPaymentInfo: Codable, Sendable {
    public var bitcoinAddress: String?
    public var ethereumAddress: String?
    public var lightningInvoice: String?
    public var lightningAddress: String?

    public init(
        bitcoinAddress: String? = nil,
        ethereumAddress: String? = nil,
        lightningInvoice: String? = nil,
        lightningAddress: String? = nil
    ) {
        self.bitcoinAddress = bitcoinAddress
        self.ethereumAddress = ethereumAddress
        self.lightningInvoice = lightningInvoice
        self.lightningAddress = lightningAddress
    }

    public var hasAnyAddress: Bool {
        bitcoinAddress != nil || ethereumAddress != nil || lightningInvoice != nil || lightningAddress != nil
    }
}

// MARK: - UI View Helpers for Campaign

extension Campaign {
    /// Progress towards goal (0.0 - 1.0)
    public var progressPercentage: Double {
        guard goal > 0 else { return 0 }
        return min((raised ?? 0) / goal, 1.0)
    }

    /// Amount remaining to reach goal
    public var amountRemaining: Double {
        max(goal - (raised ?? 0), 0)
    }
}

// MARK: - UI View Helpers for Donation

extension Donation {
    /// Display name for the donor
    public var displayName: String {
        if anonymous == true {
            return "Anonymous"
        }
        return donorName ?? "A supporter"
    }
}

// MARK: - UI View Helpers for DonationTier

extension DonationTier {
    /// Default donation tiers
    public static var defaults: [DonationTier] {
        [
            DonationTier(amount: 10, description: "Every bit helps!", name: "Supporter", perks: nil),
            DonationTier(amount: 25, description: "Thank you for your support", name: "Friend", perks: nil),
            DonationTier(amount: 50, description: "You're making a real difference", name: "Champion", perks: nil),
            DonationTier(amount: 100, description: "Your generosity is incredible", name: "Hero", perks: nil)
        ]
    }
}

// MARK: - Analytics (UI-only)

/// Analytics data for a campaign (UI-only, not in protocol schema)
public struct CampaignAnalytics: Sendable {
    public let campaignId: String
    public let totalRaised: Double
    public let totalDonors: Int
    public let averageDonation: Double
    public let largestDonation: Double
    public let donationsPerDay: [Date: Double]
    public let topDonors: [(name: String, amount: Double)]
    public let paymentMethodBreakdown: [PaymentMethod: Double]
    public let calculatedAt: Date

    public init(
        campaignId: String,
        totalRaised: Double,
        totalDonors: Int,
        averageDonation: Double,
        largestDonation: Double,
        donationsPerDay: [Date: Double] = [:],
        topDonors: [(name: String, amount: Double)] = [],
        paymentMethodBreakdown: [PaymentMethod: Double] = [:],
        calculatedAt: Date = Date()
    ) {
        self.campaignId = campaignId
        self.totalRaised = totalRaised
        self.totalDonors = totalDonors
        self.averageDonation = averageDonation
        self.largestDonation = largestDonation
        self.donationsPerDay = donationsPerDay
        self.topDonors = topDonors
        self.paymentMethodBreakdown = paymentMethodBreakdown
        self.calculatedAt = calculatedAt
    }
}
