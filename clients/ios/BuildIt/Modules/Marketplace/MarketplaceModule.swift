// MarketplaceModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Marketplace module for listings, co-ops, skill exchanges, and resource sharing.

import Foundation
import SwiftUI
import os.log

/// Marketplace module implementation
@MainActor
public final class MarketplaceModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "marketplace"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: MarketplaceStore
    private let service: MarketplaceService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "MarketplaceModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try MarketplaceStore()
        self.service = MarketplaceService(store: store)
        logger.info("Marketplace module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Marketplace module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Marketplace module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route marketplace-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "marketplace",
                title: "Marketplace",
                icon: "storefront",
                order: 35
            ) {
                MarketplaceListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Marketplace module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Marketplace module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Marketplace module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Create a new listing
    public func createListing(
        type: ListingType,
        title: String,
        description: String? = nil,
        price: Double? = nil,
        currency: String = "USD",
        images: [String] = [],
        location: LocationValue? = nil,
        availability: String? = nil,
        tags: [String] = [],
        expiresAt: Date? = nil,
        groupId: String? = nil,
        coopId: String? = nil,
        contactMethod: String = "dm"
    ) async throws -> Listing {
        try await service.createListing(
            type: type,
            title: title,
            description: description,
            price: price,
            currency: currency,
            images: images,
            location: location,
            availability: availability,
            tags: tags,
            expiresAt: expiresAt,
            groupId: groupId,
            coopId: coopId,
            contactMethod: contactMethod
        )
    }

    /// Get all listings
    public func getListings(
        groupId: String? = nil,
        type: ListingType? = nil,
        activeOnly: Bool = false
    ) async throws -> [Listing] {
        try store.getListings(groupId: groupId, type: type, activeOnly: activeOnly)
    }

    /// Delete a listing
    public func deleteListing(_ listingId: String) async throws {
        try store.deleteListing(listingId)
    }

    /// Register a co-op profile
    public func registerCoop(
        name: String,
        description: String? = nil,
        memberCount: Int = 1,
        governanceModel: GovernanceModel = .consensus,
        industry: String = "",
        location: LocationValue? = nil,
        website: String? = nil,
        nostrPubkey: String,
        groupId: String? = nil
    ) async throws -> CoopProfile {
        try await service.registerCoop(
            name: name,
            description: description,
            memberCount: memberCount,
            governanceModel: governanceModel,
            industry: industry,
            location: location,
            website: website,
            nostrPubkey: nostrPubkey,
            groupId: groupId
        )
    }

    /// Get all co-op profiles
    public func getCoopProfiles(groupId: String? = nil) async throws -> [CoopProfile] {
        try store.getCoopProfiles(groupId: groupId)
    }
}

// MARK: - Marketplace Service

/// Service layer for marketplace business logic
@MainActor
public final class MarketplaceService {
    private let store: MarketplaceStore
    private let logger = Logger(subsystem: "com.buildit", category: "MarketplaceService")

    public init(store: MarketplaceStore) {
        self.store = store
    }

    /// Process an incoming Nostr event
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case MarketplaceNostrKinds.listing:
            await handleListingEvent(event)
        case MarketplaceNostrKinds.coopProfile:
            await handleCoopEvent(event)
        case MarketplaceNostrKinds.review:
            await handleReviewEvent(event)
        case MarketplaceNostrKinds.skillExchange:
            await handleSkillExchangeEvent(event)
        case MarketplaceNostrKinds.resourceShare:
            await handleResourceShareEvent(event)
        default:
            break
        }
    }

    /// Create a new listing
    public func createListing(
        type: ListingType,
        title: String,
        description: String?,
        price: Double?,
        currency: String,
        images: [String],
        location: LocationValue?,
        availability: String?,
        tags: [String],
        expiresAt: Date?,
        groupId: String?,
        coopId: String?,
        contactMethod: String
    ) async throws -> Listing {
        let listing = Listing(
            type: type,
            title: title,
            description: description,
            price: price,
            currency: currency,
            images: images,
            location: location,
            availability: availability,
            tags: tags,
            createdBy: "current-user", // Would come from identity manager
            expiresAt: expiresAt,
            groupId: groupId,
            coopId: coopId,
            contactMethod: contactMethod
        )

        try store.saveListing(listing)
        logger.info("Created listing: \(listing.id)")
        return listing
    }

    /// Register a co-op profile
    public func registerCoop(
        name: String,
        description: String?,
        memberCount: Int,
        governanceModel: GovernanceModel,
        industry: String,
        location: LocationValue?,
        website: String?,
        nostrPubkey: String,
        groupId: String?
    ) async throws -> CoopProfile {
        let coop = CoopProfile(
            name: name,
            description: description,
            memberCount: memberCount,
            governanceModel: governanceModel,
            industry: industry,
            location: location,
            website: website,
            nostrPubkey: nostrPubkey,
            groupId: groupId
        )

        try store.saveCoopProfile(coop)
        logger.info("Registered co-op: \(coop.id)")
        return coop
    }

    /// Get listings from the store
    public func getListings(
        groupId: String? = nil,
        type: ListingType? = nil,
        activeOnly: Bool = true
    ) throws -> [Listing] {
        try store.getListings(groupId: groupId, type: type, activeOnly: activeOnly)
    }

    /// Get co-op profiles from the store
    public func getCoopProfiles(groupId: String? = nil) throws -> [CoopProfile] {
        try store.getCoopProfiles(groupId: groupId)
    }

    // MARK: - Nostr Event Handlers (private)

    private func handleListingEvent(_ event: NostrEvent) async {
        logger.debug("Received listing event: \(event.id ?? "unknown")")
        // Parse and store the listing from the event content
    }

    private func handleCoopEvent(_ event: NostrEvent) async {
        logger.debug("Received co-op event: \(event.id ?? "unknown")")
    }

    private func handleReviewEvent(_ event: NostrEvent) async {
        logger.debug("Received review event: \(event.id ?? "unknown")")
    }

    private func handleSkillExchangeEvent(_ event: NostrEvent) async {
        logger.debug("Received skill exchange event: \(event.id ?? "unknown")")
    }

    private func handleResourceShareEvent(_ event: NostrEvent) async {
        logger.debug("Received resource share event: \(event.id ?? "unknown")")
    }
}

// MARK: - Nostr Event Kinds

/// Nostr event kinds for marketplace (40131-40139)
public enum MarketplaceNostrKinds {
    public static let listing = 40131
    public static let coopProfile = 40132
    public static let review = 40133
    public static let skillExchange = 40134
    public static let resourceShare = 40135
}
