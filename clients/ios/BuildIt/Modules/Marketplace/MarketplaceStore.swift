// MarketplaceStore.swift
// BuildIt - Decentralized Mesh Communication
//
// Local storage for marketplace listings, co-ops, reviews, exchanges, and resources.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Entities

/// SwiftData model for persisting marketplace listings
@Model
public final class ListingEntity {
    @Attribute(.unique) public var id: String
    public var type: String
    public var title: String
    public var descriptionText: String?
    public var price: Double?
    public var currency: String
    public var imagesJSON: Data?
    public var locationJSON: Data?
    public var availability: String?
    public var tagsJSON: Data?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var expiresAt: Date?
    public var status: String
    public var groupId: String?
    public var coopId: String?
    public var contactMethod: String

    public init(
        id: String,
        type: String,
        title: String,
        descriptionText: String? = nil,
        price: Double? = nil,
        currency: String = "USD",
        imagesJSON: Data? = nil,
        locationJSON: Data? = nil,
        availability: String? = nil,
        tagsJSON: Data? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        expiresAt: Date? = nil,
        status: String = "active",
        groupId: String? = nil,
        coopId: String? = nil,
        contactMethod: String = "dm"
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.descriptionText = descriptionText
        self.price = price
        self.currency = currency
        self.imagesJSON = imagesJSON
        self.locationJSON = locationJSON
        self.availability = availability
        self.tagsJSON = tagsJSON
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.expiresAt = expiresAt
        self.status = status
        self.groupId = groupId
        self.coopId = coopId
        self.contactMethod = contactMethod
    }
}

/// SwiftData model for persisting co-op profiles
@Model
public final class CoopProfileEntity {
    @Attribute(.unique) public var id: String
    public var name: String
    public var descriptionText: String?
    public var memberCount: Int
    public var governanceModel: String
    public var industry: String
    public var locationJSON: Data?
    public var website: String?
    public var nostrPubkey: String
    public var verifiedByJSON: Data?
    public var image: String?
    public var createdAt: Date
    public var updatedAt: Date?
    public var groupId: String?

    public init(
        id: String,
        name: String,
        descriptionText: String? = nil,
        memberCount: Int = 1,
        governanceModel: String = "consensus",
        industry: String = "",
        locationJSON: Data? = nil,
        website: String? = nil,
        nostrPubkey: String,
        verifiedByJSON: Data? = nil,
        image: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        groupId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.descriptionText = descriptionText
        self.memberCount = memberCount
        self.governanceModel = governanceModel
        self.industry = industry
        self.locationJSON = locationJSON
        self.website = website
        self.nostrPubkey = nostrPubkey
        self.verifiedByJSON = verifiedByJSON
        self.image = image
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.groupId = groupId
    }
}

// MARK: - Marketplace Store

/// Local storage manager for marketplace data
@MainActor
public final class MarketplaceStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "MarketplaceStore")

    public init() throws {
        let schema = Schema([
            ListingEntity.self,
            CoopProfileEntity.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        modelContainer = try ModelContainer(for: schema, configurations: [config])
        modelContext = ModelContext(modelContainer)
        logger.info("MarketplaceStore initialized")
    }

    // MARK: - Listing Operations

    public func saveListing(_ listing: Listing) throws {
        let entity = ListingEntity(
            id: listing.id,
            type: listing.type.rawValue,
            title: listing.title,
            descriptionText: listing.description,
            price: listing.price,
            currency: listing.currency,
            imagesJSON: try? JSONEncoder().encode(listing.images),
            locationJSON: try? JSONEncoder().encode(listing.location),
            availability: listing.availability,
            tagsJSON: try? JSONEncoder().encode(listing.tags),
            createdBy: listing.createdBy,
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
            expiresAt: listing.expiresAt,
            status: listing.status.rawValue,
            groupId: listing.groupId,
            coopId: listing.coopId,
            contactMethod: listing.contactMethod
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved listing: \(listing.id)")
    }

    public func getListings(
        groupId: String? = nil,
        type: ListingType? = nil,
        activeOnly: Bool = false
    ) throws -> [Listing] {
        var predicate: Predicate<ListingEntity>?

        if activeOnly {
            predicate = #Predicate<ListingEntity> { entity in
                entity.status == "active"
            }
        }

        let descriptor = FetchDescriptor<ListingEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let listing = entityToListing(entity)

            if let groupId = groupId, listing.groupId != groupId {
                return nil
            }
            if let type = type, listing.type != type {
                return nil
            }

            return listing
        }
    }

    public func deleteListing(_ listingId: String) throws {
        let predicate = #Predicate<ListingEntity> { entity in
            entity.id == listingId
        }
        let descriptor = FetchDescriptor<ListingEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted listing: \(listingId)")
        }
    }

    private func entityToListing(_ entity: ListingEntity) -> Listing {
        Listing(
            id: entity.id,
            type: ListingType(rawValue: entity.type) ?? .product,
            title: entity.title,
            description: entity.descriptionText,
            price: entity.price,
            currency: entity.currency,
            images: entity.imagesJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            location: entity.locationJSON.flatMap { try? JSONDecoder().decode(LocationValue.self, from: $0) },
            availability: entity.availability,
            tags: entity.tagsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            expiresAt: entity.expiresAt,
            status: ListingStatus(rawValue: entity.status) ?? .active,
            groupId: entity.groupId,
            coopId: entity.coopId,
            contactMethod: entity.contactMethod
        )
    }

    // MARK: - Co-op Operations

    public func saveCoopProfile(_ coop: CoopProfile) throws {
        let entity = CoopProfileEntity(
            id: coop.id,
            name: coop.name,
            descriptionText: coop.description,
            memberCount: coop.memberCount,
            governanceModel: coop.governanceModel.rawValue,
            industry: coop.industry,
            locationJSON: try? JSONEncoder().encode(coop.location),
            website: coop.website,
            nostrPubkey: coop.nostrPubkey,
            verifiedByJSON: try? JSONEncoder().encode(coop.verifiedBy),
            image: coop.image,
            createdAt: coop.createdAt,
            updatedAt: coop.updatedAt,
            groupId: coop.groupId
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved co-op profile: \(coop.id)")
    }

    public func getCoopProfiles(groupId: String? = nil) throws -> [CoopProfile] {
        let descriptor = FetchDescriptor<CoopProfileEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let coop = entityToCoop(entity)
            if let groupId = groupId, coop.groupId != groupId {
                return nil
            }
            return coop
        }
    }

    private func entityToCoop(_ entity: CoopProfileEntity) -> CoopProfile {
        CoopProfile(
            id: entity.id,
            name: entity.name,
            description: entity.descriptionText,
            memberCount: entity.memberCount,
            governanceModel: GovernanceModel(rawValue: entity.governanceModel) ?? .consensus,
            industry: entity.industry,
            location: entity.locationJSON.flatMap { try? JSONDecoder().decode(LocationValue.self, from: $0) },
            website: entity.website,
            nostrPubkey: entity.nostrPubkey,
            verifiedBy: entity.verifiedByJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            image: entity.image,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            groupId: entity.groupId
        )
    }
}

// MARK: - Errors

public enum MarketplaceError: Error, LocalizedError {
    case notFound
    case unauthorized
    case invalidData
    case listingExpired
    case networkError(Error)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Item not found"
        case .unauthorized:
            return "You don't have permission to perform this action"
        case .invalidData:
            return "Invalid data provided"
        case .listingExpired:
            return "This listing has expired"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
