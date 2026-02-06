// MarketplaceModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for the cooperative marketplace module.

import Foundation

// MARK: - Enums

/// Type of marketplace listing
public enum ListingType: String, Codable, CaseIterable, Sendable {
    case product
    case service
    case coop = "co-op"
    case initiative
    case resource

    var displayName: String {
        switch self {
        case .product: return "Product"
        case .service: return "Service"
        case .coop: return "Co-op"
        case .initiative: return "Initiative"
        case .resource: return "Resource"
        }
    }

    var icon: String {
        switch self {
        case .product: return "shippingbox"
        case .service: return "wrench.and.screwdriver"
        case .coop: return "person.3"
        case .initiative: return "flag"
        case .resource: return "square.grid.3x3"
        }
    }
}

/// Status of a marketplace listing
public enum ListingStatus: String, Codable, CaseIterable, Sendable {
    case active
    case sold
    case expired
    case removed

    var displayName: String {
        switch self {
        case .active: return "Active"
        case .sold: return "Sold"
        case .expired: return "Expired"
        case .removed: return "Removed"
        }
    }

    var color: String {
        switch self {
        case .active: return "green"
        case .sold: return "blue"
        case .expired: return "gray"
        case .removed: return "red"
        }
    }
}

/// Governance model for co-ops
public enum GovernanceModel: String, Codable, CaseIterable, Sendable {
    case consensus
    case democratic
    case sociocracy
    case holacracy
    case hybrid
    case other

    var displayName: String {
        switch self {
        case .consensus: return "Consensus"
        case .democratic: return "Democratic"
        case .sociocracy: return "Sociocracy"
        case .holacracy: return "Holacracy"
        case .hybrid: return "Hybrid"
        case .other: return "Other"
        }
    }
}

/// Status of a skill exchange
public enum SkillExchangeStatus: String, Codable, CaseIterable, Sendable {
    case active
    case matched
    case completed
    case cancelled
}

/// Type of shared resource
public enum ResourceShareType: String, Codable, CaseIterable, Sendable {
    case tool
    case space
    case vehicle

    var displayName: String {
        switch self {
        case .tool: return "Tool"
        case .space: return "Space"
        case .vehicle: return "Vehicle"
        }
    }

    var icon: String {
        switch self {
        case .tool: return "wrench"
        case .space: return "building.2"
        case .vehicle: return "car"
        }
    }
}

/// Status of a shared resource
public enum ResourceShareStatus: String, Codable, CaseIterable, Sendable {
    case available
    case borrowed
    case unavailable
}

// MARK: - Location

/// Privacy-aware location value (matches custom-fields LocationValue)
public struct LocationValue: Codable, Sendable, Hashable {
    public var lat: Double
    public var lng: Double
    public var label: String
    public var precision: String // exact, neighborhood, city, region

    public init(lat: Double, lng: Double, label: String, precision: String = "neighborhood") {
        self.lat = lat
        self.lng = lng
        self.label = label
        self.precision = precision
    }
}

// MARK: - Models

/// A marketplace listing
public struct Listing: Identifiable, Codable, Sendable {
    public let id: String
    public var type: ListingType
    public var title: String
    public var description: String?
    public var price: Double? // in cents
    public var currency: String
    public var images: [String]
    public var location: LocationValue?
    public var availability: String?
    public var tags: [String]
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var expiresAt: Date?
    public var status: ListingStatus
    public var groupId: String?
    public var coopId: String?
    public var contactMethod: String

    public init(
        id: String = UUID().uuidString,
        type: ListingType,
        title: String,
        description: String? = nil,
        price: Double? = nil,
        currency: String = "USD",
        images: [String] = [],
        location: LocationValue? = nil,
        availability: String? = nil,
        tags: [String] = [],
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        expiresAt: Date? = nil,
        status: ListingStatus = .active,
        groupId: String? = nil,
        coopId: String? = nil,
        contactMethod: String = "dm"
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.description = description
        self.price = price
        self.currency = currency
        self.images = images
        self.location = location
        self.availability = availability
        self.tags = tags
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.expiresAt = expiresAt
        self.status = status
        self.groupId = groupId
        self.coopId = coopId
        self.contactMethod = contactMethod
    }

    /// Formatted price for display
    public var formattedPrice: String {
        guard let price = price, price > 0 else {
            return "Free / Negotiable"
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: price / 100)) ?? "\(price / 100) \(currency)"
    }

    /// Whether the listing has expired
    public var isExpired: Bool {
        if let expiresAt = expiresAt, expiresAt < Date() { return true }
        return status == .expired
    }
}

/// A worker co-op profile
public struct CoopProfile: Identifiable, Codable, Sendable {
    public let id: String
    public var name: String
    public var description: String?
    public var memberCount: Int
    public var governanceModel: GovernanceModel
    public var industry: String
    public var location: LocationValue?
    public var website: String?
    public var nostrPubkey: String
    public var verifiedBy: [String]
    public var image: String?
    public var createdAt: Date
    public var updatedAt: Date?
    public var groupId: String?

    public init(
        id: String = UUID().uuidString,
        name: String,
        description: String? = nil,
        memberCount: Int = 1,
        governanceModel: GovernanceModel = .consensus,
        industry: String = "",
        location: LocationValue? = nil,
        website: String? = nil,
        nostrPubkey: String,
        verifiedBy: [String] = [],
        image: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        groupId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.memberCount = memberCount
        self.governanceModel = governanceModel
        self.industry = industry
        self.location = location
        self.website = website
        self.nostrPubkey = nostrPubkey
        self.verifiedBy = verifiedBy
        self.image = image
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.groupId = groupId
    }

    /// Number of vouchers
    public var vouchCount: Int {
        verifiedBy.count
    }
}

/// A review for a listing or co-op
public struct MarketplaceReview: Identifiable, Codable, Sendable {
    public let id: String
    public var listingId: String
    public var reviewerPubkey: String
    public var rating: Int // 1-5
    public var text: String
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        listingId: String,
        reviewerPubkey: String,
        rating: Int,
        text: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.listingId = listingId
        self.reviewerPubkey = reviewerPubkey
        self.rating = min(5, max(1, rating))
        self.text = text
        self.createdAt = createdAt
    }
}

/// A skill exchange offer
public struct SkillExchange: Identifiable, Codable, Sendable {
    public let id: String
    public var offeredSkill: String
    public var requestedSkill: String
    public var availableHours: Double
    public var hourlyTimebank: Double
    public var location: LocationValue?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var status: SkillExchangeStatus
    public var groupId: String?

    public init(
        id: String = UUID().uuidString,
        offeredSkill: String,
        requestedSkill: String,
        availableHours: Double = 0,
        hourlyTimebank: Double = 0,
        location: LocationValue? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        status: SkillExchangeStatus = .active,
        groupId: String? = nil
    ) {
        self.id = id
        self.offeredSkill = offeredSkill
        self.requestedSkill = requestedSkill
        self.availableHours = availableHours
        self.hourlyTimebank = hourlyTimebank
        self.location = location
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.status = status
        self.groupId = groupId
    }
}

/// A shared resource (tool, space, vehicle)
public struct ResourceShare: Identifiable, Codable, Sendable {
    public let id: String
    public var resourceType: ResourceShareType
    public var name: String
    public var description: String?
    public var images: [String]
    public var location: LocationValue?
    public var depositRequired: Bool
    public var depositAmount: Double?
    public var depositCurrency: String?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var status: ResourceShareStatus
    public var groupId: String?

    public init(
        id: String = UUID().uuidString,
        resourceType: ResourceShareType,
        name: String,
        description: String? = nil,
        images: [String] = [],
        location: LocationValue? = nil,
        depositRequired: Bool = false,
        depositAmount: Double? = nil,
        depositCurrency: String? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        status: ResourceShareStatus = .available,
        groupId: String? = nil
    ) {
        self.id = id
        self.resourceType = resourceType
        self.name = name
        self.description = description
        self.images = images
        self.location = location
        self.depositRequired = depositRequired
        self.depositAmount = depositAmount
        self.depositCurrency = depositCurrency
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.status = status
        self.groupId = groupId
    }
}
