// FundraisingStore.swift
// BuildIt - Decentralized Mesh Communication
//
// Local storage for fundraising campaigns, donations, and expenses.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Entities

/// SwiftData model for persisting campaigns
@Model
public final class CampaignEntity {
    @Attribute(.unique) public var id: String
    public var title: String
    public var descriptionText: String?
    public var goal: Double
    public var raised: Double
    public var currency: String
    public var donorCount: Int
    public var startsAt: Date?
    public var endsAt: Date?
    public var status: String
    public var visibility: String
    public var groupId: String?
    public var image: String?
    public var tiersJSON: Data?
    public var updatesJSON: Data?
    public var cryptoPaymentJSON: Data?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        title: String,
        descriptionText: String? = nil,
        goal: Double,
        raised: Double = 0,
        currency: String = "USD",
        donorCount: Int = 0,
        startsAt: Date? = nil,
        endsAt: Date? = nil,
        status: String = "draft",
        visibility: String = "group",
        groupId: String? = nil,
        image: String? = nil,
        tiersJSON: Data? = nil,
        updatesJSON: Data? = nil,
        cryptoPaymentJSON: Data? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.descriptionText = descriptionText
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
        self.tiersJSON = tiersJSON
        self.updatesJSON = updatesJSON
        self.cryptoPaymentJSON = cryptoPaymentJSON
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// SwiftData model for persisting donations
@Model
public final class DonationEntity {
    @Attribute(.unique) public var id: String
    public var campaignId: String
    public var amount: Double
    public var currency: String
    public var donorPubkey: String?
    public var donorName: String?
    public var anonymous: Bool
    public var message: String?
    public var tierId: String?
    public var paymentMethod: String
    public var cryptoType: String?
    public var transactionId: String?
    public var status: String
    public var donatedAt: Date

    public init(
        id: String,
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        donorPubkey: String? = nil,
        donorName: String? = nil,
        anonymous: Bool = false,
        message: String? = nil,
        tierId: String? = nil,
        paymentMethod: String = "crypto",
        cryptoType: String? = nil,
        transactionId: String? = nil,
        status: String = "completed",
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
}

/// SwiftData model for persisting expenses
@Model
public final class ExpenseEntity {
    @Attribute(.unique) public var id: String
    public var campaignId: String
    public var amount: Double
    public var currency: String
    public var descriptionText: String
    public var category: String?
    public var receipt: String?
    public var vendor: String?
    public var date: Date
    public var recordedBy: String
    public var recordedAt: Date

    public init(
        id: String,
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        descriptionText: String,
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
        self.descriptionText = descriptionText
        self.category = category
        self.receipt = receipt
        self.vendor = vendor
        self.date = date
        self.recordedBy = recordedBy
        self.recordedAt = recordedAt
    }
}

// MARK: - Fundraising Store

/// Local storage manager for fundraising data
@MainActor
public final class FundraisingStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "FundraisingStore")

    public init() throws {
        let schema = Schema([
            CampaignEntity.self,
            DonationEntity.self,
            ExpenseEntity.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        modelContainer = try ModelContainer(for: schema, configurations: [config])
        modelContext = ModelContext(modelContainer)
        logger.info("FundraisingStore initialized")
    }

    // MARK: - Campaign Operations

    public func saveCampaign(_ campaign: Campaign) throws {
        let entity = CampaignEntity(
            id: campaign.id,
            title: campaign.title,
            descriptionText: campaign.description,
            goal: campaign.goal,
            raised: campaign.raised,
            currency: campaign.currency,
            donorCount: campaign.donorCount,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
            status: campaign.status.rawValue,
            visibility: campaign.visibility.rawValue,
            groupId: campaign.groupId,
            image: campaign.image,
            tiersJSON: try? JSONEncoder().encode(campaign.tiers),
            updatesJSON: try? JSONEncoder().encode(campaign.updates),
            cryptoPaymentJSON: try? JSONEncoder().encode(campaign.cryptoPayment),
            createdBy: campaign.createdBy,
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved campaign: \(campaign.id)")
    }

    public func getCampaigns(
        groupId: String? = nil,
        status: CampaignStatus? = nil,
        activeOnly: Bool = false
    ) throws -> [Campaign] {
        var predicate: Predicate<CampaignEntity>?

        if activeOnly {
            predicate = #Predicate<CampaignEntity> { entity in
                entity.status == "active"
            }
        }

        let descriptor = FetchDescriptor<CampaignEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let campaign = entityToCampaign(entity)

            // Filter by groupId if specified
            if let groupId = groupId, campaign.groupId != groupId {
                return nil
            }

            // Filter by status if specified
            if let status = status, campaign.status != status {
                return nil
            }

            return campaign
        }
    }

    public func getCampaign(id: String) throws -> Campaign? {
        let predicate = #Predicate<CampaignEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<CampaignEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToCampaign(entity)
    }

    public func updateCampaign(_ campaign: Campaign) throws {
        let predicate = #Predicate<CampaignEntity> { entity in
            entity.id == campaign.id
        }
        let descriptor = FetchDescriptor<CampaignEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            throw FundraisingError.notFound
        }

        entity.title = campaign.title
        entity.descriptionText = campaign.description
        entity.goal = campaign.goal
        entity.raised = campaign.raised
        entity.currency = campaign.currency
        entity.donorCount = campaign.donorCount
        entity.startsAt = campaign.startsAt
        entity.endsAt = campaign.endsAt
        entity.status = campaign.status.rawValue
        entity.visibility = campaign.visibility.rawValue
        entity.image = campaign.image
        entity.tiersJSON = try? JSONEncoder().encode(campaign.tiers)
        entity.updatesJSON = try? JSONEncoder().encode(campaign.updates)
        entity.cryptoPaymentJSON = try? JSONEncoder().encode(campaign.cryptoPayment)
        entity.updatedAt = Date()

        try modelContext.save()
        logger.debug("Updated campaign: \(campaign.id)")
    }

    public func deleteCampaign(_ campaignId: String) throws {
        let predicate = #Predicate<CampaignEntity> { entity in
            entity.id == campaignId
        }
        let descriptor = FetchDescriptor<CampaignEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted campaign: \(campaignId)")
        }
    }

    private func entityToCampaign(_ entity: CampaignEntity) -> Campaign {
        Campaign(
            id: entity.id,
            title: entity.title,
            description: entity.descriptionText,
            goal: entity.goal,
            raised: entity.raised,
            currency: entity.currency,
            donorCount: entity.donorCount,
            startsAt: entity.startsAt,
            endsAt: entity.endsAt,
            status: CampaignStatus(rawValue: entity.status) ?? .draft,
            visibility: CampaignVisibility(rawValue: entity.visibility) ?? .group,
            groupId: entity.groupId,
            image: entity.image,
            tiers: entity.tiersJSON.flatMap { try? JSONDecoder().decode([DonationTier].self, from: $0) } ?? [],
            updates: entity.updatesJSON.flatMap { try? JSONDecoder().decode([CampaignUpdate].self, from: $0) } ?? [],
            cryptoPayment: entity.cryptoPaymentJSON.flatMap { try? JSONDecoder().decode(CryptoPaymentInfo.self, from: $0) },
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Donation Operations

    public func saveDonation(_ donation: Donation) throws {
        let entity = DonationEntity(
            id: donation.id,
            campaignId: donation.campaignId,
            amount: donation.amount,
            currency: donation.currency,
            donorPubkey: donation.donorPubkey,
            donorName: donation.donorName,
            anonymous: donation.anonymous,
            message: donation.message,
            tierId: donation.tierId,
            paymentMethod: donation.paymentMethod.rawValue,
            cryptoType: donation.cryptoType?.rawValue,
            transactionId: donation.transactionId,
            status: donation.status.rawValue,
            donatedAt: donation.donatedAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved donation: \(donation.id)")
    }

    public func getDonations(
        campaignId: String? = nil,
        status: DonationStatus? = nil,
        limit: Int? = nil
    ) throws -> [Donation] {
        var descriptor = FetchDescriptor<DonationEntity>(
            sortBy: [SortDescriptor(\.donatedAt, order: .reverse)]
        )

        if let limit = limit {
            descriptor.fetchLimit = limit
        }

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let donation = entityToDonation(entity)

            // Filter by campaignId if specified
            if let campaignId = campaignId, donation.campaignId != campaignId {
                return nil
            }

            // Filter by status if specified
            if let status = status, donation.status != status {
                return nil
            }

            return donation
        }
    }

    public func getDonation(id: String) throws -> Donation? {
        let predicate = #Predicate<DonationEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<DonationEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToDonation(entity)
    }

    public func updateDonation(_ donation: Donation) throws {
        let predicate = #Predicate<DonationEntity> { entity in
            entity.id == donation.id
        }
        let descriptor = FetchDescriptor<DonationEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            throw FundraisingError.notFound
        }

        entity.amount = donation.amount
        entity.currency = donation.currency
        entity.donorName = donation.donorName
        entity.anonymous = donation.anonymous
        entity.message = donation.message
        entity.status = donation.status.rawValue
        entity.transactionId = donation.transactionId

        try modelContext.save()
        logger.debug("Updated donation: \(donation.id)")
    }

    private func entityToDonation(_ entity: DonationEntity) -> Donation {
        Donation(
            id: entity.id,
            campaignId: entity.campaignId,
            amount: entity.amount,
            currency: entity.currency,
            donorPubkey: entity.donorPubkey,
            donorName: entity.donorName,
            anonymous: entity.anonymous,
            message: entity.message,
            tierId: entity.tierId,
            paymentMethod: PaymentMethod(rawValue: entity.paymentMethod) ?? .other,
            cryptoType: entity.cryptoType.flatMap { CryptoType(rawValue: $0) },
            transactionId: entity.transactionId,
            status: DonationStatus(rawValue: entity.status) ?? .completed,
            donatedAt: entity.donatedAt
        )
    }

    // MARK: - Expense Operations

    public func saveExpense(_ expense: Expense) throws {
        let entity = ExpenseEntity(
            id: expense.id,
            campaignId: expense.campaignId,
            amount: expense.amount,
            currency: expense.currency,
            descriptionText: expense.description,
            category: expense.category,
            receipt: expense.receipt,
            vendor: expense.vendor,
            date: expense.date,
            recordedBy: expense.recordedBy,
            recordedAt: expense.recordedAt
        )
        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved expense: \(expense.id)")
    }

    public func getExpenses(campaignId: String) throws -> [Expense] {
        let descriptor = FetchDescriptor<ExpenseEntity>(
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            guard entity.campaignId == campaignId else { return nil }

            return Expense(
                id: entity.id,
                campaignId: entity.campaignId,
                amount: entity.amount,
                currency: entity.currency,
                description: entity.descriptionText,
                category: entity.category,
                receipt: entity.receipt,
                vendor: entity.vendor,
                date: entity.date,
                recordedBy: entity.recordedBy,
                recordedAt: entity.recordedAt
            )
        }
    }
}

// MARK: - Errors

/// Errors for fundraising operations
public enum FundraisingError: Error, LocalizedError {
    case notFound
    case unauthorized
    case invalidData
    case campaignNotActive
    case goalNotSet
    case networkError(Error)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Campaign or donation not found"
        case .unauthorized:
            return "You don't have permission to perform this action"
        case .invalidData:
            return "Invalid data provided"
        case .campaignNotActive:
            return "This campaign is not currently accepting donations"
        case .goalNotSet:
            return "Campaign goal must be set"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
