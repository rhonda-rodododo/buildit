// NewslettersStore.swift
// BuildIt - Decentralized Mesh Communication
//
// Local storage for newsletters, issues, subscribers, and delivery records.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Entities

/// SwiftData model for persisting newsletters
@Model
public final class NewsletterEntity {
    @Attribute(.unique) public var id: String
    public var name: String
    public var descriptionText: String?
    public var groupId: String?
    public var fromName: String?
    public var replyTo: String?
    public var logo: String?
    public var subscriberCount: Int
    public var visibility: String
    public var doubleOptIn: Bool
    public var ownerPubkey: String
    public var editorsJSON: Data?
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        name: String,
        descriptionText: String? = nil,
        groupId: String? = nil,
        fromName: String? = nil,
        replyTo: String? = nil,
        logo: String? = nil,
        subscriberCount: Int = 0,
        visibility: String = "group",
        doubleOptIn: Bool = true,
        ownerPubkey: String,
        editorsJSON: Data? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.descriptionText = descriptionText
        self.groupId = groupId
        self.fromName = fromName
        self.replyTo = replyTo
        self.logo = logo
        self.subscriberCount = subscriberCount
        self.visibility = visibility
        self.doubleOptIn = doubleOptIn
        self.ownerPubkey = ownerPubkey
        self.editorsJSON = editorsJSON
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// SwiftData model for persisting newsletter issues/campaigns
@Model
public final class NewsletterIssueEntity {
    @Attribute(.unique) public var id: String
    public var newsletterId: String
    public var subject: String
    public var preheader: String?
    public var content: String
    public var contentType: String
    public var status: String
    public var scheduledAt: Date?
    public var sentAt: Date?
    public var segmentsJSON: Data?
    public var statsJSON: Data?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        newsletterId: String,
        subject: String,
        preheader: String? = nil,
        content: String = "",
        contentType: String = "markdown",
        status: String = "draft",
        scheduledAt: Date? = nil,
        sentAt: Date? = nil,
        segmentsJSON: Data? = nil,
        statsJSON: Data? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.newsletterId = newsletterId
        self.subject = subject
        self.preheader = preheader
        self.content = content
        self.contentType = contentType
        self.status = status
        self.scheduledAt = scheduledAt
        self.sentAt = sentAt
        self.segmentsJSON = segmentsJSON
        self.statsJSON = statsJSON
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// SwiftData model for persisting subscribers
@Model
public final class NewsletterSubscriberEntity {
    @Attribute(.unique) public var id: String
    public var newsletterId: String
    public var pubkey: String?
    public var email: String?
    public var name: String?
    public var status: String
    public var segmentsJSON: Data?
    public var customFieldsJSON: Data?
    public var source: String?
    public var preferencesJSON: Data?
    public var subscribedAt: Date
    public var confirmedAt: Date?
    public var unsubscribedAt: Date?

    public init(
        id: String,
        newsletterId: String,
        pubkey: String? = nil,
        email: String? = nil,
        name: String? = nil,
        status: String = "pending",
        segmentsJSON: Data? = nil,
        customFieldsJSON: Data? = nil,
        source: String? = nil,
        preferencesJSON: Data? = nil,
        subscribedAt: Date = Date(),
        confirmedAt: Date? = nil,
        unsubscribedAt: Date? = nil
    ) {
        self.id = id
        self.newsletterId = newsletterId
        self.pubkey = pubkey
        self.email = email
        self.name = name
        self.status = status
        self.segmentsJSON = segmentsJSON
        self.customFieldsJSON = customFieldsJSON
        self.source = source
        self.preferencesJSON = preferencesJSON
        self.subscribedAt = subscribedAt
        self.confirmedAt = confirmedAt
        self.unsubscribedAt = unsubscribedAt
    }
}

/// SwiftData model for persisting delivery records
@Model
public final class DeliveryRecordEntity {
    @Attribute(.unique) public var id: String
    public var issueId: String
    public var subscriberId: String
    public var subscriberPubkey: String?
    public var subscriberEmail: String?
    public var status: String
    public var nostrEventId: String?
    public var errorMessage: String?
    public var sentAt: Date?
    public var deliveredAt: Date?
    public var openedAt: Date?
    public var clickedAt: Date?
    public var retryCount: Int

    public init(
        id: String,
        issueId: String,
        subscriberId: String,
        subscriberPubkey: String? = nil,
        subscriberEmail: String? = nil,
        status: String = "pending",
        nostrEventId: String? = nil,
        errorMessage: String? = nil,
        sentAt: Date? = nil,
        deliveredAt: Date? = nil,
        openedAt: Date? = nil,
        clickedAt: Date? = nil,
        retryCount: Int = 0
    ) {
        self.id = id
        self.issueId = issueId
        self.subscriberId = subscriberId
        self.subscriberPubkey = subscriberPubkey
        self.subscriberEmail = subscriberEmail
        self.status = status
        self.nostrEventId = nostrEventId
        self.errorMessage = errorMessage
        self.sentAt = sentAt
        self.deliveredAt = deliveredAt
        self.openedAt = openedAt
        self.clickedAt = clickedAt
        self.retryCount = retryCount
    }
}

// MARK: - Store

/// Local storage manager for newsletter data
@MainActor
public final class NewslettersStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "NewslettersStore")

    public init() throws {
        let schema = Schema([
            NewsletterEntity.self,
            NewsletterIssueEntity.self,
            NewsletterSubscriberEntity.self,
            DeliveryRecordEntity.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        modelContainer = try ModelContainer(for: schema, configurations: [config])
        modelContext = ModelContext(modelContainer)
        logger.info("NewslettersStore initialized")
    }

    // MARK: - Newsletter CRUD

    public func saveNewsletter(_ newsletter: Newsletter) throws {
        // Check if exists and update, or insert new
        let predicate = #Predicate<NewsletterEntity> { entity in
            entity.id == newsletter.id
        }
        let descriptor = FetchDescriptor<NewsletterEntity>(predicate: predicate)

        if let existing = try modelContext.fetch(descriptor).first {
            // Update existing
            existing.name = newsletter.name
            existing.descriptionText = newsletter.description
            existing.groupId = newsletter.groupId
            existing.fromName = newsletter.fromName
            existing.replyTo = newsletter.replyTo
            existing.logo = newsletter.logo
            existing.subscriberCount = newsletter.subscriberCount
            existing.visibility = newsletter.visibility.rawValue
            existing.doubleOptIn = newsletter.doubleOptIn
            existing.editorsJSON = try? JSONEncoder().encode(newsletter.editors)
            existing.updatedAt = Date()
        } else {
            // Insert new
            let entity = NewsletterEntity(
                id: newsletter.id,
                name: newsletter.name,
                descriptionText: newsletter.description,
                groupId: newsletter.groupId,
                fromName: newsletter.fromName,
                replyTo: newsletter.replyTo,
                logo: newsletter.logo,
                subscriberCount: newsletter.subscriberCount,
                visibility: newsletter.visibility.rawValue,
                doubleOptIn: newsletter.doubleOptIn,
                ownerPubkey: newsletter.ownerPubkey,
                editorsJSON: try? JSONEncoder().encode(newsletter.editors),
                createdAt: newsletter.createdAt,
                updatedAt: newsletter.updatedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved newsletter: \(newsletter.id)")
    }

    public func getNewsletter(id: String) throws -> Newsletter? {
        let predicate = #Predicate<NewsletterEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<NewsletterEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToNewsletter(entity)
    }

    public func getNewsletters(groupId: String? = nil, ownerPubkey: String? = nil) throws -> [Newsletter] {
        let descriptor = FetchDescriptor<NewsletterEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            // Filter by groupId if specified
            if let groupId = groupId, entity.groupId != groupId {
                return nil
            }

            // Filter by owner if specified
            if let ownerPubkey = ownerPubkey, entity.ownerPubkey != ownerPubkey {
                return nil
            }

            return entityToNewsletter(entity)
        }
    }

    public func deleteNewsletter(_ newsletterId: String) throws {
        let predicate = #Predicate<NewsletterEntity> { entity in
            entity.id == newsletterId
        }
        let descriptor = FetchDescriptor<NewsletterEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted newsletter: \(newsletterId)")
        }
    }

    private func entityToNewsletter(_ entity: NewsletterEntity) -> Newsletter {
        Newsletter(
            id: entity.id,
            name: entity.name,
            description: entity.descriptionText,
            groupId: entity.groupId,
            fromName: entity.fromName,
            replyTo: entity.replyTo,
            logo: entity.logo,
            subscriberCount: entity.subscriberCount,
            visibility: NewsletterVisibility(rawValue: entity.visibility) ?? .group,
            doubleOptIn: entity.doubleOptIn,
            ownerPubkey: entity.ownerPubkey,
            editors: entity.editorsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Issue CRUD

    public func saveIssue(_ issue: NewsletterIssue) throws {
        let predicate = #Predicate<NewsletterIssueEntity> { entity in
            entity.id == issue.id
        }
        let descriptor = FetchDescriptor<NewsletterIssueEntity>(predicate: predicate)

        if let existing = try modelContext.fetch(descriptor).first {
            existing.subject = issue.subject
            existing.preheader = issue.preheader
            existing.content = issue.content
            existing.contentType = issue.contentType.rawValue
            existing.status = issue.status.rawValue
            existing.scheduledAt = issue.scheduledAt
            existing.sentAt = issue.sentAt
            existing.segmentsJSON = try? JSONEncoder().encode(issue.segments)
            existing.statsJSON = try? JSONEncoder().encode(issue.stats)
            existing.updatedAt = Date()
        } else {
            let entity = NewsletterIssueEntity(
                id: issue.id,
                newsletterId: issue.newsletterId,
                subject: issue.subject,
                preheader: issue.preheader,
                content: issue.content,
                contentType: issue.contentType.rawValue,
                status: issue.status.rawValue,
                scheduledAt: issue.scheduledAt,
                sentAt: issue.sentAt,
                segmentsJSON: try? JSONEncoder().encode(issue.segments),
                statsJSON: try? JSONEncoder().encode(issue.stats),
                createdBy: issue.createdBy,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved issue: \(issue.id)")
    }

    public func getIssue(id: String) throws -> NewsletterIssue? {
        let predicate = #Predicate<NewsletterIssueEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<NewsletterIssueEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToIssue(entity)
    }

    public func getIssues(newsletterId: String, status: CampaignStatus? = nil) throws -> [NewsletterIssue] {
        let predicate = #Predicate<NewsletterIssueEntity> { entity in
            entity.newsletterId == newsletterId
        }
        let descriptor = FetchDescriptor<NewsletterIssueEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let issue = entityToIssue(entity)

            // Filter by status if specified
            if let status = status, issue.status != status {
                return nil
            }

            return issue
        }
    }

    public func deleteIssue(_ issueId: String) throws {
        let predicate = #Predicate<NewsletterIssueEntity> { entity in
            entity.id == issueId
        }
        let descriptor = FetchDescriptor<NewsletterIssueEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted issue: \(issueId)")
        }
    }

    private func entityToIssue(_ entity: NewsletterIssueEntity) -> NewsletterIssue {
        NewsletterIssue(
            id: entity.id,
            newsletterId: entity.newsletterId,
            subject: entity.subject,
            preheader: entity.preheader,
            content: entity.content,
            contentType: ContentType(rawValue: entity.contentType) ?? .markdown,
            status: CampaignStatus(rawValue: entity.status) ?? .draft,
            scheduledAt: entity.scheduledAt,
            sentAt: entity.sentAt,
            segments: entity.segmentsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            stats: entity.statsJSON.flatMap { try? JSONDecoder().decode(CampaignStats.self, from: $0) } ?? CampaignStats(),
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Subscriber CRUD

    public func saveSubscriber(_ subscriber: NewsletterSubscriber) throws {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.id == subscriber.id
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)

        if let existing = try modelContext.fetch(descriptor).first {
            existing.pubkey = subscriber.pubkey
            existing.email = subscriber.email
            existing.name = subscriber.name
            existing.status = subscriber.status.rawValue
            existing.segmentsJSON = try? JSONEncoder().encode(subscriber.segments)
            existing.customFieldsJSON = try? JSONEncoder().encode(subscriber.customFields)
            existing.source = subscriber.source
            existing.preferencesJSON = try? JSONEncoder().encode(subscriber.preferences)
            existing.confirmedAt = subscriber.confirmedAt
            existing.unsubscribedAt = subscriber.unsubscribedAt
        } else {
            let entity = NewsletterSubscriberEntity(
                id: subscriber.id,
                newsletterId: subscriber.newsletterId,
                pubkey: subscriber.pubkey,
                email: subscriber.email,
                name: subscriber.name,
                status: subscriber.status.rawValue,
                segmentsJSON: try? JSONEncoder().encode(subscriber.segments),
                customFieldsJSON: try? JSONEncoder().encode(subscriber.customFields),
                source: subscriber.source,
                preferencesJSON: try? JSONEncoder().encode(subscriber.preferences),
                subscribedAt: subscriber.subscribedAt,
                confirmedAt: subscriber.confirmedAt,
                unsubscribedAt: subscriber.unsubscribedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved subscriber: \(subscriber.id)")
    }

    public func getSubscriber(id: String) throws -> NewsletterSubscriber? {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.id == id
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToSubscriber(entity)
    }

    public func getSubscribers(newsletterId: String, status: SubscriberStatus? = nil, activeOnly: Bool = false) throws -> [NewsletterSubscriber] {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.newsletterId == newsletterId
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.subscribedAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let subscriber = entityToSubscriber(entity)

            // Filter by status if specified
            if let status = status, subscriber.status != status {
                return nil
            }

            // Filter active only
            if activeOnly && !subscriber.isActive {
                return nil
            }

            return subscriber
        }
    }

    public func getSubscriberByPubkey(newsletterId: String, pubkey: String) throws -> NewsletterSubscriber? {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.newsletterId == newsletterId && entity.pubkey == pubkey
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToSubscriber(entity)
    }

    public func getSubscriberByEmail(newsletterId: String, email: String) throws -> NewsletterSubscriber? {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.newsletterId == newsletterId && entity.email == email
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }

        return entityToSubscriber(entity)
    }

    public func deleteSubscriber(_ subscriberId: String) throws {
        let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
            entity.id == subscriberId
        }
        let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted subscriber: \(subscriberId)")
        }
    }

    public func getSubscriberCount(newsletterId: String, activeOnly: Bool = true) throws -> Int {
        if activeOnly {
            let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
                entity.newsletterId == newsletterId && entity.status == "active"
            }
            let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)
            return try modelContext.fetchCount(descriptor)
        } else {
            let predicate = #Predicate<NewsletterSubscriberEntity> { entity in
                entity.newsletterId == newsletterId
            }
            let descriptor = FetchDescriptor<NewsletterSubscriberEntity>(predicate: predicate)
            return try modelContext.fetchCount(descriptor)
        }
    }

    private func entityToSubscriber(_ entity: NewsletterSubscriberEntity) -> NewsletterSubscriber {
        NewsletterSubscriber(
            id: entity.id,
            newsletterId: entity.newsletterId,
            pubkey: entity.pubkey,
            email: entity.email,
            name: entity.name,
            status: SubscriberStatus(rawValue: entity.status) ?? .pending,
            segments: entity.segmentsJSON.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? [],
            customFields: entity.customFieldsJSON.flatMap { try? JSONDecoder().decode([String: String].self, from: $0) } ?? [:],
            source: entity.source,
            preferences: entity.preferencesJSON.flatMap { try? JSONDecoder().decode(SubscriberPreferences.self, from: $0) },
            subscribedAt: entity.subscribedAt,
            confirmedAt: entity.confirmedAt,
            unsubscribedAt: entity.unsubscribedAt
        )
    }

    // MARK: - Delivery Records

    public func saveDeliveryRecord(_ record: DeliveryRecord) throws {
        let predicate = #Predicate<DeliveryRecordEntity> { entity in
            entity.id == record.id
        }
        let descriptor = FetchDescriptor<DeliveryRecordEntity>(predicate: predicate)

        if let existing = try modelContext.fetch(descriptor).first {
            existing.status = record.status.rawValue
            existing.nostrEventId = record.nostrEventId
            existing.errorMessage = record.errorMessage
            existing.sentAt = record.sentAt
            existing.deliveredAt = record.deliveredAt
            existing.openedAt = record.openedAt
            existing.clickedAt = record.clickedAt
            existing.retryCount = record.retryCount
        } else {
            let entity = DeliveryRecordEntity(
                id: record.id,
                issueId: record.issueId,
                subscriberId: record.subscriberId,
                subscriberPubkey: record.subscriberPubkey,
                subscriberEmail: record.subscriberEmail,
                status: record.status.rawValue,
                nostrEventId: record.nostrEventId,
                errorMessage: record.errorMessage,
                sentAt: record.sentAt,
                deliveredAt: record.deliveredAt,
                openedAt: record.openedAt,
                clickedAt: record.clickedAt,
                retryCount: record.retryCount
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
    }

    public func getDeliveryRecords(issueId: String, status: DeliveryStatus? = nil) throws -> [DeliveryRecord] {
        let predicate = #Predicate<DeliveryRecordEntity> { entity in
            entity.issueId == issueId
        }
        let descriptor = FetchDescriptor<DeliveryRecordEntity>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.sentAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)

        return entities.compactMap { entity in
            let record = entityToDeliveryRecord(entity)

            if let status = status, record.status != status {
                return nil
            }

            return record
        }
    }

    public func getDeliveryStats(issueId: String) throws -> CampaignStats {
        let records = try getDeliveryRecords(issueId: issueId)

        var stats = CampaignStats()
        stats.recipientCount = records.count

        for record in records {
            switch record.status {
            case .delivered, .opened, .clicked:
                stats.deliveredCount += 1
            case .failed, .bounced:
                stats.failedCount += 1
            default:
                break
            }

            if record.status == .opened || record.status == .clicked {
                stats.openCount += 1
            }
            if record.status == .clicked {
                stats.clickCount += 1
            }
        }

        return stats
    }

    private func entityToDeliveryRecord(_ entity: DeliveryRecordEntity) -> DeliveryRecord {
        DeliveryRecord(
            id: entity.id,
            issueId: entity.issueId,
            subscriberId: entity.subscriberId,
            subscriberPubkey: entity.subscriberPubkey,
            subscriberEmail: entity.subscriberEmail,
            status: DeliveryStatus(rawValue: entity.status) ?? .pending,
            nostrEventId: entity.nostrEventId,
            errorMessage: entity.errorMessage,
            sentAt: entity.sentAt,
            deliveredAt: entity.deliveredAt,
            openedAt: entity.openedAt,
            clickedAt: entity.clickedAt,
            retryCount: entity.retryCount
        )
    }
}

// MARK: - Errors

public enum NewslettersError: Error, LocalizedError {
    case notFound
    case unauthorized
    case invalidData
    case duplicateSubscriber
    case sendingInProgress
    case rateLimited
    case networkError(Error)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Newsletter or subscriber not found"
        case .unauthorized:
            return "You don't have permission to perform this action"
        case .invalidData:
            return "Invalid data provided"
        case .duplicateSubscriber:
            return "This subscriber already exists"
        case .sendingInProgress:
            return "A send operation is already in progress"
        case .rateLimited:
            return "Rate limited - please wait before sending more messages"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
