// MutualAidModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Mutual aid module for resource sharing, requests, offers, and community support.

import Foundation
import SwiftUI
import os.log

/// Mutual Aid module implementation
@MainActor
public final class MutualAidModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "mutual-aid"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: MutualAidStore
    private let service: MutualAidService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "MutualAidModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try MutualAidStore()
        self.service = MutualAidService(store: store)
        logger.info("Mutual Aid module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Mutual Aid module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Mutual Aid module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route mutual-aid-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "mutual-aid",
                title: "Mutual Aid",
                icon: "hands.sparkles",
                order: 25
            ) {
                MutualAidListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Mutual Aid module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Mutual Aid module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Mutual Aid module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

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
        try await service.createRequest(
            title: title,
            description: description,
            category: category,
            urgency: urgency,
            location: location,
            neededBy: neededBy,
            quantityNeeded: quantityNeeded,
            unit: unit,
            anonymousRequest: anonymousRequest,
            groupId: groupId,
            tags: tags
        )
    }

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
        try await service.createOffer(
            title: title,
            description: description,
            category: category,
            location: location,
            availableFrom: availableFrom,
            availableUntil: availableUntil,
            quantity: quantity,
            unit: unit,
            groupId: groupId,
            tags: tags
        )
    }

    /// Offer to fulfill a request
    public func offerFulfillment(
        requestId: String,
        quantity: Double? = nil,
        message: String? = nil,
        scheduledFor: Date? = nil
    ) async throws -> Fulfillment {
        try await service.offerFulfillment(
            requestId: requestId,
            quantity: quantity,
            message: message,
            scheduledFor: scheduledFor
        )
    }

    /// Get all requests
    public func getRequests(groupId: String? = nil, category: AidCategory? = nil, activeOnly: Bool = true) async throws -> [AidRequest] {
        try await service.getRequests(groupId: groupId, category: category, activeOnly: activeOnly)
    }

    /// Get all offers
    public func getOffers(groupId: String? = nil, category: AidCategory? = nil, activeOnly: Bool = true) async throws -> [AidOffer] {
        try await service.getOffers(groupId: groupId, category: category, activeOnly: activeOnly)
    }
}
