// MutualAidStore.swift
// BuildIt - Decentralized Mesh Communication
//
// Local storage for mutual aid requests, offers, and fulfillments.

import Foundation
import SwiftData
import os.log

/// SwiftData model for persisting aid requests
@Model
public final class AidRequestEntity {
    @Attribute(.unique) public var id: String
    public var groupId: String?
    public var title: String
    public var descriptionText: String?
    public var category: String
    public var status: String
    public var urgency: String
    public var requesterId: String
    public var anonymousRequest: Bool
    public var locationJSON: Data?
    public var neededBy: Date?
    public var quantityNeeded: Double?
    public var quantityFulfilled: Double
    public var unit: String?
    public var tagsJSON: Data?
    public var createdAt: Date
    public var updatedAt: Date?
    public var closedAt: Date?

    public init(
        id: String,
        groupId: String? = nil,
        title: String,
        descriptionText: String? = nil,
        category: String,
        status: String,
        urgency: String,
        requesterId: String,
        anonymousRequest: Bool = false,
        locationJSON: Data? = nil,
        neededBy: Date? = nil,
        quantityNeeded: Double? = nil,
        quantityFulfilled: Double = 0,
        unit: String? = nil,
        tagsJSON: Data? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        closedAt: Date? = nil
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.descriptionText = descriptionText
        self.category = category
        self.status = status
        self.urgency = urgency
        self.requesterId = requesterId
        self.anonymousRequest = anonymousRequest
        self.locationJSON = locationJSON
        self.neededBy = neededBy
        self.quantityNeeded = quantityNeeded
        self.quantityFulfilled = quantityFulfilled
        self.unit = unit
        self.tagsJSON = tagsJSON
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.closedAt = closedAt
    }
}

/// SwiftData model for persisting aid offers
@Model
public final class AidOfferEntity {
    @Attribute(.unique) public var id: String
    public var groupId: String?
    public var title: String
    public var descriptionText: String?
    public var category: String
    public var status: String
    public var offererId: String
    public var locationJSON: Data?
    public var availableFrom: Date?
    public var availableUntil: Date?
    public var quantity: Double?
    public var unit: String?
    public var tagsJSON: Data?
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        groupId: String? = nil,
        title: String,
        descriptionText: String? = nil,
        category: String,
        status: String,
        offererId: String,
        locationJSON: Data? = nil,
        availableFrom: Date? = nil,
        availableUntil: Date? = nil,
        quantity: Double? = nil,
        unit: String? = nil,
        tagsJSON: Data? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.descriptionText = descriptionText
        self.category = category
        self.status = status
        self.offererId = offererId
        self.locationJSON = locationJSON
        self.availableFrom = availableFrom
        self.availableUntil = availableUntil
        self.quantity = quantity
        self.unit = unit
        self.tagsJSON = tagsJSON
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// SwiftData model for persisting fulfillments
@Model
public final class FulfillmentEntity {
    @Attribute(.unique) public var id: String
    public var requestId: String
    public var fulfillerId: String
    public var status: String
    public var quantity: Double?
    public var message: String?
    public var scheduledFor: Date?
    public var completedAt: Date?
    public var createdAt: Date

    public init(
        id: String,
        requestId: String,
        fulfillerId: String,
        status: String,
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

/// Local storage manager for mutual aid data
@MainActor
public final class MutualAidStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "MutualAidStore")

    public init() throws {
        let schema = Schema([
            AidRequestEntity.self,
            AidOfferEntity.self,
            FulfillmentEntity.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        modelContainer = try ModelContainer(for: schema, configurations: [config])
        modelContext = ModelContext(modelContainer)
        logger.info("MutualAidStore initialized")
    }

    // MARK: - Requests

    public func saveRequest(_ request: AidRequest) throws {
        let entity = AidRequestEntity(
            id: request.id,
            groupId: request.groupId,
            title: request.title,
            descriptionText: request.description,
            category: request.category.rawValue,
            status: request.status.rawValue,
            urgency: request.urgency.rawValue,
            requesterId: request.requesterId,
            anonymousRequest: request.anonymousRequest,
            locationJSON: try? JSONEncoder().encode(request.location),
            neededBy: request.neededBy,
            quantityNeeded: request.quantityNeeded,
            quantityFulfilled: request.quantityFulfilled,
            unit: request.unit,
            tagsJSON: try? JSONEncoder().encode(request.tags),
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            closedAt: request.closedAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved request: \(request.id)")
    }

    public func getRequests(groupId: String? = nil, category: AidCategory? = nil, activeOnly: Bool = true) throws -> [AidRequest] {
        var predicate: Predicate<AidRequestEntity>?

        if activeOnly {
            let activeStatuses = ["open", "in-progress", "partially-fulfilled"]
            predicate = #Predicate<AidRequestEntity> { entity in
                activeStatuses.contains(entity.status)
            }
        }

        let descriptor = FetchDescriptor<AidRequestEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            var request = AidRequest(
                id: entity.id,
                groupId: entity.groupId,
                title: entity.title,
                description: entity.descriptionText,
                category: AidCategory(rawValue: entity.category) ?? .other,
                status: RequestStatus(rawValue: entity.status) ?? .open,
                urgency: UrgencyLevel(rawValue: entity.urgency) ?? .medium,
                requesterId: entity.requesterId,
                anonymousRequest: entity.anonymousRequest,
                location: entity.locationJSON.flatMap { try? JSONDecoder().decode(AidLocation.self, from: $0) },
                neededBy: entity.neededBy,
                quantityNeeded: entity.quantityNeeded,
                quantityFulfilled: entity.quantityFulfilled,
                unit: entity.unit,
                tags: entity.tagsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
                createdAt: entity.createdAt,
                updatedAt: entity.updatedAt,
                closedAt: entity.closedAt
            )

            // Filter by groupId if specified
            if let groupId = groupId, request.groupId != groupId {
                return nil
            }

            // Filter by category if specified
            if let category = category, request.category != category {
                return nil
            }

            return request
        }
    }

    public func getRequest(id: String) throws -> AidRequest? {
        let predicate = #Predicate<AidRequestEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<AidRequestEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return AidRequest(
            id: entity.id,
            groupId: entity.groupId,
            title: entity.title,
            description: entity.descriptionText,
            category: AidCategory(rawValue: entity.category) ?? .other,
            status: RequestStatus(rawValue: entity.status) ?? .open,
            urgency: UrgencyLevel(rawValue: entity.urgency) ?? .medium,
            requesterId: entity.requesterId,
            anonymousRequest: entity.anonymousRequest,
            location: entity.locationJSON.flatMap { try? JSONDecoder().decode(AidLocation.self, from: $0) },
            neededBy: entity.neededBy,
            quantityNeeded: entity.quantityNeeded,
            quantityFulfilled: entity.quantityFulfilled,
            unit: entity.unit,
            tags: entity.tagsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            closedAt: entity.closedAt
        )
    }

    public func updateRequest(_ request: AidRequest) throws {
        let predicate = #Predicate<AidRequestEntity> { entity in
            entity.id == request.id
        }
        let descriptor = FetchDescriptor<AidRequestEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            throw MutualAidError.notFound
        }

        entity.title = request.title
        entity.descriptionText = request.description
        entity.category = request.category.rawValue
        entity.status = request.status.rawValue
        entity.urgency = request.urgency.rawValue
        entity.anonymousRequest = request.anonymousRequest
        entity.locationJSON = try? JSONEncoder().encode(request.location)
        entity.neededBy = request.neededBy
        entity.quantityNeeded = request.quantityNeeded
        entity.quantityFulfilled = request.quantityFulfilled
        entity.unit = request.unit
        entity.tagsJSON = try? JSONEncoder().encode(request.tags)
        entity.updatedAt = Date()
        entity.closedAt = request.closedAt

        try modelContext.save()
        logger.debug("Updated request: \(request.id)")
    }

    public func deleteRequest(_ requestId: String) throws {
        let predicate = #Predicate<AidRequestEntity> { entity in
            entity.id == requestId
        }
        let descriptor = FetchDescriptor<AidRequestEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted request: \(requestId)")
        }
    }

    // MARK: - Offers

    public func saveOffer(_ offer: AidOffer) throws {
        let entity = AidOfferEntity(
            id: offer.id,
            groupId: offer.groupId,
            title: offer.title,
            descriptionText: offer.description,
            category: offer.category.rawValue,
            status: offer.status.rawValue,
            offererId: offer.offererId,
            locationJSON: try? JSONEncoder().encode(offer.location),
            availableFrom: offer.availableFrom,
            availableUntil: offer.availableUntil,
            quantity: offer.quantity,
            unit: offer.unit,
            tagsJSON: try? JSONEncoder().encode(offer.tags),
            createdAt: offer.createdAt,
            updatedAt: offer.updatedAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved offer: \(offer.id)")
    }

    public func getOffers(groupId: String? = nil, category: AidCategory? = nil, activeOnly: Bool = true) throws -> [AidOffer] {
        var predicate: Predicate<AidOfferEntity>?

        if activeOnly {
            predicate = #Predicate<AidOfferEntity> { entity in
                entity.status == "active"
            }
        }

        let descriptor = FetchDescriptor<AidOfferEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let offer = AidOffer(
                id: entity.id,
                groupId: entity.groupId,
                title: entity.title,
                description: entity.descriptionText,
                category: AidCategory(rawValue: entity.category) ?? .other,
                status: AidOffer.OfferStatus(rawValue: entity.status) ?? .active,
                offererId: entity.offererId,
                location: entity.locationJSON.flatMap { try? JSONDecoder().decode(AidLocation.self, from: $0) },
                availableFrom: entity.availableFrom,
                availableUntil: entity.availableUntil,
                quantity: entity.quantity,
                unit: entity.unit,
                tags: entity.tagsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
                createdAt: entity.createdAt,
                updatedAt: entity.updatedAt
            )

            // Filter by groupId if specified
            if let groupId = groupId, offer.groupId != groupId {
                return nil
            }

            // Filter by category if specified
            if let category = category, offer.category != category {
                return nil
            }

            return offer
        }
    }

    // MARK: - Fulfillments

    public func saveFulfillment(_ fulfillment: Fulfillment) throws {
        let entity = FulfillmentEntity(
            id: fulfillment.id,
            requestId: fulfillment.requestId,
            fulfillerId: fulfillment.fulfillerId,
            status: fulfillment.status.rawValue,
            quantity: fulfillment.quantity,
            message: fulfillment.message,
            scheduledFor: fulfillment.scheduledFor,
            completedAt: fulfillment.completedAt,
            createdAt: fulfillment.createdAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved fulfillment: \(fulfillment.id)")
    }

    public func getFulfillments(requestId: String) throws -> [Fulfillment] {
        let predicate = #Predicate<FulfillmentEntity> { entity in
            entity.requestId == requestId
        }
        let descriptor = FetchDescriptor<FulfillmentEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        return try modelContext.fetch(descriptor).map { entity in
            Fulfillment(
                id: entity.id,
                requestId: entity.requestId,
                fulfillerId: entity.fulfillerId,
                status: Fulfillment.FulfillmentStatus(rawValue: entity.status) ?? .offered,
                quantity: entity.quantity,
                message: entity.message,
                scheduledFor: entity.scheduledFor,
                completedAt: entity.completedAt,
                createdAt: entity.createdAt
            )
        }
    }

    public func updateFulfillment(_ fulfillment: Fulfillment) throws {
        let predicate = #Predicate<FulfillmentEntity> { entity in
            entity.id == fulfillment.id
        }
        let descriptor = FetchDescriptor<FulfillmentEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            throw MutualAidError.notFound
        }

        entity.status = fulfillment.status.rawValue
        entity.quantity = fulfillment.quantity
        entity.message = fulfillment.message
        entity.scheduledFor = fulfillment.scheduledFor
        entity.completedAt = fulfillment.completedAt

        try modelContext.save()
    }
}

/// Errors for mutual aid operations
public enum MutualAidError: Error, LocalizedError {
    case notFound
    case unauthorized
    case invalidData
    case networkError(Error)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Request or offer not found"
        case .unauthorized:
            return "You don't have permission to perform this action"
        case .invalidData:
            return "Invalid data provided"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
