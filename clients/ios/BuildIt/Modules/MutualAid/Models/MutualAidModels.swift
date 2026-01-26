// MutualAidModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for mutual aid requests, offers, and fulfillments.

import Foundation

/// Category of mutual aid
public enum AidCategory: String, Codable, CaseIterable, Sendable {
    case food
    case housing
    case transportation
    case rideshare
    case medical
    case mentalHealth = "mental-health"
    case childcare
    case petCare = "pet-care"
    case legal
    case financial
    case employment
    case education
    case technology
    case translation
    case supplies
    case clothing
    case furniture
    case household
    case safety
    case other

    var displayName: String {
        switch self {
        case .food: return "Food"
        case .housing: return "Housing"
        case .transportation: return "Transportation"
        case .rideshare: return "Rideshare"
        case .medical: return "Medical"
        case .mentalHealth: return "Mental Health"
        case .childcare: return "Childcare"
        case .petCare: return "Pet Care"
        case .legal: return "Legal"
        case .financial: return "Financial"
        case .employment: return "Employment"
        case .education: return "Education"
        case .technology: return "Technology"
        case .translation: return "Translation"
        case .supplies: return "Supplies"
        case .clothing: return "Clothing"
        case .furniture: return "Furniture"
        case .household: return "Household"
        case .safety: return "Safety"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .food: return "fork.knife"
        case .housing: return "house"
        case .transportation: return "bus"
        case .rideshare: return "car"
        case .medical: return "cross.case"
        case .mentalHealth: return "brain.head.profile"
        case .childcare: return "figure.and.child.holdinghands"
        case .petCare: return "pawprint"
        case .legal: return "book.closed"
        case .financial: return "dollarsign.circle"
        case .employment: return "briefcase"
        case .education: return "graduationcap"
        case .technology: return "laptopcomputer"
        case .translation: return "globe"
        case .supplies: return "shippingbox"
        case .clothing: return "tshirt"
        case .furniture: return "sofa"
        case .household: return "house.lodge"
        case .safety: return "shield"
        case .other: return "questionmark.circle"
        }
    }
}

/// Status of an aid request
public enum RequestStatus: String, Codable, CaseIterable, Sendable {
    case open
    case inProgress = "in-progress"
    case partiallyFulfilled = "partially-fulfilled"
    case fulfilled
    case closed
    case expired
    case cancelled

    var displayName: String {
        switch self {
        case .open: return "Open"
        case .inProgress: return "In Progress"
        case .partiallyFulfilled: return "Partially Fulfilled"
        case .fulfilled: return "Fulfilled"
        case .closed: return "Closed"
        case .expired: return "Expired"
        case .cancelled: return "Cancelled"
        }
    }
}

/// Urgency level of a request
public enum UrgencyLevel: String, Codable, CaseIterable, Sendable {
    case low
    case medium
    case high
    case critical

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }

    var color: String {
        switch self {
        case .low: return "green"
        case .medium: return "yellow"
        case .high: return "orange"
        case .critical: return "red"
        }
    }
}

/// Location for aid requests/offers
public struct AidLocation: Codable, Sendable {
    public enum LocationType: String, Codable, Sendable {
        case point
        case area
        case flexible
        case remote
    }

    public enum PrivacyLevel: String, Codable, Sendable {
        case exact
        case approximate
        case cityOnly = "city-only"
        case hidden
    }

    public var type: LocationType
    public var address: String?
    public var city: String?
    public var region: String?
    public var postalCode: String?
    public var country: String?
    public var latitude: Double?
    public var longitude: Double?
    public var radius: Double?
    public var privacyLevel: PrivacyLevel

    public init(
        type: LocationType = .flexible,
        address: String? = nil,
        city: String? = nil,
        region: String? = nil,
        postalCode: String? = nil,
        country: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        radius: Double? = nil,
        privacyLevel: PrivacyLevel = .approximate
    ) {
        self.type = type
        self.address = address
        self.city = city
        self.region = region
        self.postalCode = postalCode
        self.country = country
        self.latitude = latitude
        self.longitude = longitude
        self.radius = radius
        self.privacyLevel = privacyLevel
    }

    public var displayString: String {
        if let city = city {
            if let region = region {
                return "\(city), \(region)"
            }
            return city
        }
        if type == .remote {
            return "Remote"
        }
        if type == .flexible {
            return "Flexible"
        }
        return "Location not specified"
    }
}

/// A mutual aid request
public struct AidRequest: Codable, Identifiable, Sendable {
    public let id: String
    public var groupId: String?
    public var title: String
    public var description: String?
    public var category: AidCategory
    public var status: RequestStatus
    public var urgency: UrgencyLevel
    public var requesterId: String
    public var anonymousRequest: Bool
    public var location: AidLocation?
    public var neededBy: Date?
    public var quantityNeeded: Double?
    public var quantityFulfilled: Double
    public var unit: String?
    public var tags: [String]
    public var createdAt: Date
    public var updatedAt: Date?
    public var closedAt: Date?

    // Local-only properties
    public var requesterName: String?
    public var fulfillmentCount: Int = 0

    public init(
        id: String = UUID().uuidString,
        groupId: String? = nil,
        title: String,
        description: String? = nil,
        category: AidCategory,
        status: RequestStatus = .open,
        urgency: UrgencyLevel = .medium,
        requesterId: String,
        anonymousRequest: Bool = false,
        location: AidLocation? = nil,
        neededBy: Date? = nil,
        quantityNeeded: Double? = nil,
        quantityFulfilled: Double = 0,
        unit: String? = nil,
        tags: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        closedAt: Date? = nil
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.description = description
        self.category = category
        self.status = status
        self.urgency = urgency
        self.requesterId = requesterId
        self.anonymousRequest = anonymousRequest
        self.location = location
        self.neededBy = neededBy
        self.quantityNeeded = quantityNeeded
        self.quantityFulfilled = quantityFulfilled
        self.unit = unit
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.closedAt = closedAt
    }

    public var isActive: Bool {
        status == .open || status == .inProgress || status == .partiallyFulfilled
    }

    public var progressPercentage: Double {
        guard let needed = quantityNeeded, needed > 0 else { return 0 }
        return min(quantityFulfilled / needed, 1.0)
    }
}

/// A mutual aid offer
public struct AidOffer: Codable, Identifiable, Sendable {
    public enum OfferStatus: String, Codable, Sendable {
        case active
        case claimed
        case expired
        case withdrawn
    }

    public let id: String
    public var groupId: String?
    public var title: String
    public var description: String?
    public var category: AidCategory
    public var status: OfferStatus
    public var offererId: String
    public var location: AidLocation?
    public var availableFrom: Date?
    public var availableUntil: Date?
    public var quantity: Double?
    public var unit: String?
    public var tags: [String]
    public var createdAt: Date
    public var updatedAt: Date?

    // Local-only
    public var offererName: String?

    public init(
        id: String = UUID().uuidString,
        groupId: String? = nil,
        title: String,
        description: String? = nil,
        category: AidCategory,
        status: OfferStatus = .active,
        offererId: String,
        location: AidLocation? = nil,
        availableFrom: Date? = nil,
        availableUntil: Date? = nil,
        quantity: Double? = nil,
        unit: String? = nil,
        tags: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.description = description
        self.category = category
        self.status = status
        self.offererId = offererId
        self.location = location
        self.availableFrom = availableFrom
        self.availableUntil = availableUntil
        self.quantity = quantity
        self.unit = unit
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var isActive: Bool {
        guard status == .active else { return false }
        if let until = availableUntil, until < Date() { return false }
        return true
    }
}

/// A response to an aid request
public struct Fulfillment: Codable, Identifiable, Sendable {
    public enum FulfillmentStatus: String, Codable, Sendable {
        case offered
        case accepted
        case inProgress = "in-progress"
        case completed
        case cancelled
        case declined
    }

    public let id: String
    public var requestId: String
    public var fulfillerId: String
    public var status: FulfillmentStatus
    public var quantity: Double?
    public var message: String?
    public var scheduledFor: Date?
    public var completedAt: Date?
    public var createdAt: Date

    // Local-only
    public var fulfillerName: String?

    public init(
        id: String = UUID().uuidString,
        requestId: String,
        fulfillerId: String,
        status: FulfillmentStatus = .offered,
        quantity: Double? = nil,
        message: String? = nil,
        scheduledFor: Date? = nil,
        completedAt: Date? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.requestId = requestId
        self.fulfillerId = fulfillerId
        self.status = status
        self.quantity = quantity
        self.message = message
        self.scheduledFor = scheduledFor
        self.completedAt = completedAt
        self.createdAt = createdAt
    }
}
