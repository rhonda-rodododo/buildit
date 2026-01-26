// MutualAidService.swift
// BuildIt - Decentralized Mesh Communication
//
// Service layer for mutual aid operations with Nostr integration.

import Foundation
import os.log

/// Service for managing mutual aid requests and offers
@MainActor
public final class MutualAidService {
    // MARK: - Nostr Event Kinds
    static let KIND_AID_REQUEST = 40101
    static let KIND_AID_OFFER = 40102
    static let KIND_FULFILLMENT = 40103

    // MARK: - Properties
    private let store: MutualAidStore
    private let logger = Logger(subsystem: "com.buildit", category: "MutualAidService")

    // Would be injected in production
    private var currentUserId: String {
        // Get from identity manager
        return UserDefaults.standard.string(forKey: "currentPubkey") ?? ""
    }

    public init(store: MutualAidStore) {
        self.store = store
    }

    // MARK: - Request Operations

    /// Create a new aid request
    public func createRequest(
        title: String,
        description: String?,
        category: AidCategory,
        urgency: UrgencyLevel,
        location: AidLocation? = nil,
        neededBy: Date? = nil,
        quantityNeeded: Double? = nil,
        unit: String? = nil,
        anonymousRequest: Bool = false,
        groupId: String? = nil,
        tags: [String] = []
    ) async throws -> AidRequest {
        let request = AidRequest(
            groupId: groupId,
            title: title,
            description: description,
            category: category,
            status: .open,
            urgency: urgency,
            requesterId: currentUserId,
            anonymousRequest: anonymousRequest,
            location: location,
            neededBy: neededBy,
            quantityNeeded: quantityNeeded,
            quantityFulfilled: 0,
            unit: unit,
            tags: tags,
            createdAt: Date()
        )

        // Save locally
        try store.saveRequest(request)

        // Publish to Nostr
        await publishRequest(request)

        logger.info("Created aid request: \(request.id)")
        return request
    }

    /// Update an existing request
    public func updateRequest(_ requestId: String, updates: RequestUpdates) async throws -> AidRequest {
        guard var request = try store.getRequest(id: requestId) else {
            throw MutualAidError.notFound
        }

        // Verify ownership
        guard request.requesterId == currentUserId else {
            throw MutualAidError.unauthorized
        }

        // Apply updates
        if let title = updates.title { request.title = title }
        if let description = updates.description { request.description = description }
        if let urgency = updates.urgency { request.urgency = urgency }
        if let location = updates.location { request.location = location }
        if let neededBy = updates.neededBy { request.neededBy = neededBy }
        if let status = updates.status { request.status = status }
        if let quantityNeeded = updates.quantityNeeded { request.quantityNeeded = quantityNeeded }

        request.updatedAt = Date()

        // Update in store
        try store.updateRequest(request)

        // Publish update to Nostr
        await publishRequest(request)

        logger.info("Updated aid request: \(requestId)")
        return request
    }

    /// Cancel/close a request
    public func closeRequest(_ requestId: String, reason: String? = nil) async throws {
        guard var request = try store.getRequest(id: requestId) else {
            throw MutualAidError.notFound
        }

        guard request.requesterId == currentUserId else {
            throw MutualAidError.unauthorized
        }

        request.status = .closed
        request.closedAt = Date()

        try store.updateRequest(request)

        // Publish deletion/close to Nostr
        await publishRequestClose(request.id)

        logger.info("Closed aid request: \(requestId)")
    }

    /// Get all requests (optionally filtered)
    public func getRequests(
        groupId: String? = nil,
        category: AidCategory? = nil,
        activeOnly: Bool = true
    ) async throws -> [AidRequest] {
        try store.getRequests(groupId: groupId, category: category, activeOnly: activeOnly)
    }

    /// Get a specific request
    public func getRequest(id: String) async throws -> AidRequest? {
        try store.getRequest(id: id)
    }

    // MARK: - Offer Operations

    /// Create a new aid offer
    public func createOffer(
        title: String,
        description: String?,
        category: AidCategory,
        location: AidLocation? = nil,
        availableFrom: Date? = nil,
        availableUntil: Date? = nil,
        quantity: Double? = nil,
        unit: String? = nil,
        groupId: String? = nil,
        tags: [String] = []
    ) async throws -> AidOffer {
        let offer = AidOffer(
            groupId: groupId,
            title: title,
            description: description,
            category: category,
            status: .active,
            offererId: currentUserId,
            location: location,
            availableFrom: availableFrom,
            availableUntil: availableUntil,
            quantity: quantity,
            unit: unit,
            tags: tags,
            createdAt: Date()
        )

        try store.saveOffer(offer)

        // Publish to Nostr
        await publishOffer(offer)

        logger.info("Created aid offer: \(offer.id)")
        return offer
    }

    /// Get all offers
    public func getOffers(
        groupId: String? = nil,
        category: AidCategory? = nil,
        activeOnly: Bool = true
    ) async throws -> [AidOffer] {
        try store.getOffers(groupId: groupId, category: category, activeOnly: activeOnly)
    }

    // MARK: - Fulfillment Operations

    /// Offer to fulfill a request
    public func offerFulfillment(
        requestId: String,
        quantity: Double? = nil,
        message: String? = nil,
        scheduledFor: Date? = nil
    ) async throws -> Fulfillment {
        guard try store.getRequest(id: requestId) != nil else {
            throw MutualAidError.notFound
        }

        let fulfillment = Fulfillment(
            requestId: requestId,
            fulfillerId: currentUserId,
            status: .offered,
            quantity: quantity,
            message: message,
            scheduledFor: scheduledFor,
            createdAt: Date()
        )

        try store.saveFulfillment(fulfillment)

        // Publish to Nostr
        await publishFulfillment(fulfillment)

        logger.info("Offered fulfillment for request: \(requestId)")
        return fulfillment
    }

    /// Accept a fulfillment offer
    public func acceptFulfillment(_ fulfillmentId: String, requestId: String) async throws {
        guard var request = try store.getRequest(id: requestId) else {
            throw MutualAidError.notFound
        }

        guard request.requesterId == currentUserId else {
            throw MutualAidError.unauthorized
        }

        var fulfillments = try store.getFulfillments(requestId: requestId)
        guard var fulfillment = fulfillments.first(where: { $0.id == fulfillmentId }) else {
            throw MutualAidError.notFound
        }

        fulfillment.status = .accepted
        try store.updateFulfillment(fulfillment)

        // Update request status
        request.status = .inProgress
        try store.updateRequest(request)

        await publishFulfillment(fulfillment)

        logger.info("Accepted fulfillment: \(fulfillmentId)")
    }

    /// Mark a fulfillment as complete
    public func completeFulfillment(_ fulfillmentId: String, requestId: String) async throws {
        guard var request = try store.getRequest(id: requestId) else {
            throw MutualAidError.notFound
        }

        var fulfillments = try store.getFulfillments(requestId: requestId)
        guard var fulfillment = fulfillments.first(where: { $0.id == fulfillmentId }) else {
            throw MutualAidError.notFound
        }

        fulfillment.status = .completed
        fulfillment.completedAt = Date()
        try store.updateFulfillment(fulfillment)

        // Update quantities
        if let qty = fulfillment.quantity {
            request.quantityFulfilled += qty
        }

        // Check if fully fulfilled
        if let needed = request.quantityNeeded, request.quantityFulfilled >= needed {
            request.status = .fulfilled
        } else if request.quantityFulfilled > 0 {
            request.status = .partiallyFulfilled
        }

        try store.updateRequest(request)

        await publishFulfillment(fulfillment)

        logger.info("Completed fulfillment: \(fulfillmentId)")
    }

    /// Get fulfillments for a request
    public func getFulfillments(requestId: String) async throws -> [Fulfillment] {
        try store.getFulfillments(requestId: requestId)
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_AID_REQUEST:
            await handleIncomingRequest(event)
        case Self.KIND_AID_OFFER:
            await handleIncomingOffer(event)
        case Self.KIND_FULFILLMENT:
            await handleIncomingFulfillment(event)
        default:
            break
        }
    }

    private func handleIncomingRequest(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  var request = try? decoder.decode(AidRequest.self, from: data) else {
                logger.warning("Failed to decode incoming request")
                return
            }

            // Don't save our own requests again
            if request.requesterId == currentUserId {
                return
            }

            try store.saveRequest(request)
            logger.debug("Saved incoming request: \(request.id)")
        } catch {
            logger.error("Failed to handle incoming request: \(error.localizedDescription)")
        }
    }

    private func handleIncomingOffer(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let offer = try? decoder.decode(AidOffer.self, from: data) else {
                logger.warning("Failed to decode incoming offer")
                return
            }

            if offer.offererId == currentUserId {
                return
            }

            try store.saveOffer(offer)
            logger.debug("Saved incoming offer: \(offer.id)")
        } catch {
            logger.error("Failed to handle incoming offer: \(error.localizedDescription)")
        }
    }

    private func handleIncomingFulfillment(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let fulfillment = try? decoder.decode(Fulfillment.self, from: data) else {
                logger.warning("Failed to decode incoming fulfillment")
                return
            }

            if fulfillment.fulfillerId == currentUserId {
                return
            }

            try store.saveFulfillment(fulfillment)
            logger.debug("Saved incoming fulfillment: \(fulfillment.id)")
        } catch {
            logger.error("Failed to handle incoming fulfillment: \(error.localizedDescription)")
        }
    }

    // MARK: - Publishing

    private func publishRequest(_ request: AidRequest) async {
        // In production, this would use NostrClient to publish
        logger.debug("Would publish request to Nostr: \(request.id)")
    }

    private func publishRequestClose(_ requestId: String) async {
        logger.debug("Would publish request close to Nostr: \(requestId)")
    }

    private func publishOffer(_ offer: AidOffer) async {
        logger.debug("Would publish offer to Nostr: \(offer.id)")
    }

    private func publishFulfillment(_ fulfillment: Fulfillment) async {
        logger.debug("Would publish fulfillment to Nostr: \(fulfillment.id)")
    }
}

/// Updates that can be applied to a request
public struct RequestUpdates {
    public var title: String?
    public var description: String?
    public var urgency: UrgencyLevel?
    public var location: AidLocation?
    public var neededBy: Date?
    public var status: RequestStatus?
    public var quantityNeeded: Double?

    public init(
        title: String? = nil,
        description: String? = nil,
        urgency: UrgencyLevel? = nil,
        location: AidLocation? = nil,
        neededBy: Date? = nil,
        status: RequestStatus? = nil,
        quantityNeeded: Double? = nil
    ) {
        self.title = title
        self.description = description
        self.urgency = urgency
        self.location = location
        self.neededBy = neededBy
        self.status = status
        self.quantityNeeded = quantityNeeded
    }
}
