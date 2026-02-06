// MutualAidModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for mutual aid requests, offers, and fulfillments.
// Protocol types imported from generated schemas; UI-only extensions defined locally.

import Foundation

// Re-export protocol types from generated schema.
// The following types come from Sources/Generated/Schemas/mutual-aid.swift:
//   AidRequest, AidOffer, AidCategory, RequestStatus, UrgencyLevel,
//   AidRequestLocation, AidOfferLocation, Location, LocationType, PrivacyLevel,
//   RecurringNeed, RecurringNeedClass, RecurringAvailabilityClass, RecurringClass,
//   Fulfillment, FulfillmentElement, FulfillmentStatus,
//   OfferClaim, ClaimedByElement, ClaimedByStatus,
//   RideShare, RideShareType, RideShareStatus, Passenger, PassengerStatus,
//   Preferences, LuggageSpace, Frequency,
//   ResourceDirectory, Contact, AidOfferStatus,
//   MutualAidSchema

// MARK: - UI Extensions for AidCategory

extension AidCategory: CaseIterable {
    public static var allCases: [AidCategory] {
        [.food, .housing, .transportation, .rideshare, .medical, .mentalHealth,
         .childcare, .petCare, .legal, .financial, .employment, .education,
         .technology, .translation, .supplies, .clothing, .furniture,
         .household, .safety, .other]
    }

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

// MARK: - UI Extensions for RequestStatus

extension RequestStatus: CaseIterable {
    public static var allCases: [RequestStatus] {
        [.requestStatusOpen, .inProgress, .partiallyFulfilled, .fulfilled, .closed, .expired, .cancelled]
    }

    var displayName: String {
        switch self {
        case .requestStatusOpen: return "Open"
        case .inProgress: return "In Progress"
        case .partiallyFulfilled: return "Partially Fulfilled"
        case .fulfilled: return "Fulfilled"
        case .closed: return "Closed"
        case .expired: return "Expired"
        case .cancelled: return "Cancelled"
        }
    }
}

// MARK: - UI Extensions for UrgencyLevel

extension UrgencyLevel: CaseIterable {
    public static var allCases: [UrgencyLevel] {
        [.low, .medium, .high, .critical]
    }

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

// MARK: - UI View Helpers for AidRequest

extension AidRequest {
    public var isActive: Bool {
        status == .requestStatusOpen || status == .inProgress || status == .partiallyFulfilled
    }

    public var progressPercentage: Double {
        guard let needed = quantityNeeded, needed > 0 else { return 0 }
        return min((quantityFulfilled ?? 0) / needed, 1.0)
    }
}

// MARK: - UI View Helpers for AidOffer

extension AidOffer {
    public var isActive: Bool {
        status == .active
    }
}

// MARK: - UI View Helpers for AidRequestLocation

extension AidRequestLocation {
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

// MARK: - UI View Helpers for AidOfferLocation

extension AidOfferLocation {
    public var displayString: String {
        if let city = city {
            if let region = region {
                return "\(city), \(region)"
            }
            return city
        }
        return "Location not specified"
    }
}
