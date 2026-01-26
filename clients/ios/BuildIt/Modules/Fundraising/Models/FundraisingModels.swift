// FundraisingModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for fundraising campaigns, donations, and financial tracking.

import Foundation

// MARK: - Enums

/// Status of a fundraising campaign
public enum CampaignStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case active
    case paused
    case completed
    case cancelled

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

/// Visibility of a campaign
public enum CampaignVisibility: String, Codable, CaseIterable, Sendable {
    case `private`
    case group
    case `public`

    var displayName: String {
        switch self {
        case .private: return "Private"
        case .group: return "Group Only"
        case .public: return "Public"
        }
    }

    var icon: String {
        switch self {
        case .private: return "lock"
        case .group: return "person.2"
        case .public: return "globe"
        }
    }
}

/// Payment method for donations
public enum PaymentMethod: String, Codable, CaseIterable, Sendable {
    case card
    case bank
    case crypto
    case cash
    case check
    case other

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

/// Cryptocurrency type for crypto payments
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

/// Status of a donation
public enum DonationStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case completed
    case failed
    case refunded

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

// MARK: - Models

/// A donation tier with suggested amounts and perks
public struct DonationTier: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public var amount: Double
    public var name: String?
    public var description: String?
    public var perks: [String]

    public init(
        id: String = UUID().uuidString,
        amount: Double,
        name: String? = nil,
        description: String? = nil,
        perks: [String] = []
    ) {
        self.id = id
        self.amount = amount
        self.name = name
        self.description = description
        self.perks = perks
    }

    /// Default donation tiers
    public static var defaults: [DonationTier] {
        [
            DonationTier(amount: 10, name: "Supporter", description: "Every bit helps!"),
            DonationTier(amount: 25, name: "Friend", description: "Thank you for your support"),
            DonationTier(amount: 50, name: "Champion", description: "You're making a real difference"),
            DonationTier(amount: 100, name: "Hero", description: "Your generosity is incredible")
        ]
    }
}

/// A campaign update post
public struct CampaignUpdate: Identifiable, Codable, Sendable {
    public let id: String
    public var content: String
    public var postedAt: Date

    public init(
        id: String = UUID().uuidString,
        content: String,
        postedAt: Date = Date()
    ) {
        self.id = id
        self.content = content
        self.postedAt = postedAt
    }
}

/// Crypto payment addresses for a campaign
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

/// A fundraising campaign
public struct Campaign: Identifiable, Codable, Sendable {
    public let id: String
    public var title: String
    public var description: String?
    public var goal: Double
    public var raised: Double
    public var currency: String
    public var donorCount: Int
    public var startsAt: Date?
    public var endsAt: Date?
    public var status: CampaignStatus
    public var visibility: CampaignVisibility
    public var groupId: String?
    public var image: String?
    public var tiers: [DonationTier]
    public var updates: [CampaignUpdate]
    public var cryptoPayment: CryptoPaymentInfo?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?

    // Local-only properties
    public var creatorName: String?

    public init(
        id: String = UUID().uuidString,
        title: String,
        description: String? = nil,
        goal: Double,
        raised: Double = 0,
        currency: String = "USD",
        donorCount: Int = 0,
        startsAt: Date? = nil,
        endsAt: Date? = nil,
        status: CampaignStatus = .draft,
        visibility: CampaignVisibility = .group,
        groupId: String? = nil,
        image: String? = nil,
        tiers: [DonationTier] = [],
        updates: [CampaignUpdate] = [],
        cryptoPayment: CryptoPaymentInfo? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.goal = goal
        self.raised = raised
        self.currency = currency
        self.donorCount = donorCount
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
        self.visibility = visibility
        self.groupId = groupId
        self.image = image
        self.tiers = tiers
        self.updates = updates
        self.cryptoPayment = cryptoPayment
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Progress towards goal (0.0 - 1.0)
    public var progressPercentage: Double {
        guard goal > 0 else { return 0 }
        return min(raised / goal, 1.0)
    }

    /// Amount remaining to reach goal
    public var amountRemaining: Double {
        max(goal - raised, 0)
    }

    /// Whether campaign is currently accepting donations
    public var isAcceptingDonations: Bool {
        guard status == .active else { return false }
        if let endsAt = endsAt, endsAt < Date() { return false }
        if let startsAt = startsAt, startsAt > Date() { return false }
        return true
    }

    /// Whether the campaign has ended
    public var hasEnded: Bool {
        if let endsAt = endsAt, endsAt < Date() { return true }
        return status == .completed || status == .cancelled
    }

    /// Time remaining until deadline
    public var timeRemaining: TimeInterval? {
        guard let endsAt = endsAt else { return nil }
        return max(0, endsAt.timeIntervalSinceNow)
    }

    /// Days remaining until deadline
    public var daysRemaining: Int? {
        guard let remaining = timeRemaining else { return nil }
        return Int(remaining / 86400)
    }
}

/// A donation to a campaign
public struct Donation: Identifiable, Codable, Sendable {
    public let id: String
    public var campaignId: String
    public var amount: Double
    public var currency: String
    public var donorPubkey: String?
    public var donorName: String?
    public var anonymous: Bool
    public var message: String?
    public var tierId: String?
    public var paymentMethod: PaymentMethod
    public var cryptoType: CryptoType?
    public var transactionId: String?
    public var status: DonationStatus
    public var donatedAt: Date

    public init(
        id: String = UUID().uuidString,
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        donorPubkey: String? = nil,
        donorName: String? = nil,
        anonymous: Bool = false,
        message: String? = nil,
        tierId: String? = nil,
        paymentMethod: PaymentMethod = .crypto,
        cryptoType: CryptoType? = nil,
        transactionId: String? = nil,
        status: DonationStatus = .completed,
        donatedAt: Date = Date()
    ) {
        self.id = id
        self.campaignId = campaignId
        self.amount = amount
        self.currency = currency
        self.donorPubkey = donorPubkey
        self.donorName = donorName
        self.anonymous = anonymous
        self.message = message
        self.tierId = tierId
        self.paymentMethod = paymentMethod
        self.cryptoType = cryptoType
        self.transactionId = transactionId
        self.status = status
        self.donatedAt = donatedAt
    }

    /// Display name for the donor
    public var displayName: String {
        if anonymous {
            return "Anonymous"
        }
        return donorName ?? "A supporter"
    }
}

/// An expense recorded against campaign funds
public struct Expense: Identifiable, Codable, Sendable {
    public let id: String
    public var campaignId: String
    public var amount: Double
    public var currency: String
    public var description: String
    public var category: String?
    public var receipt: String?
    public var vendor: String?
    public var date: Date
    public var recordedBy: String
    public var recordedAt: Date

    public init(
        id: String = UUID().uuidString,
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        description: String,
        category: String? = nil,
        receipt: String? = nil,
        vendor: String? = nil,
        date: Date = Date(),
        recordedBy: String,
        recordedAt: Date = Date()
    ) {
        self.id = id
        self.campaignId = campaignId
        self.amount = amount
        self.currency = currency
        self.description = description
        self.category = category
        self.receipt = receipt
        self.vendor = vendor
        self.date = date
        self.recordedBy = recordedBy
        self.recordedAt = recordedAt
    }
}

/// Analytics data for a campaign
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
