// PublishingStore.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData persistence for publishing module.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Models

@Model
public final class ArticleEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var title: String
    public var slug: String
    public var subtitle: String?
    public var content: String
    public var excerpt: String?
    public var coverImage: String?
    public var tagsJson: String
    public var categoriesJson: String
    public var statusRaw: String
    public var visibilityRaw: String
    public var groupId: String?
    public var publishedAt: Date?
    public var scheduledAt: Date?
    public var authorPubkey: String
    public var authorName: String?
    public var coauthorsJson: String
    public var viewCount: Int
    public var canonicalUrl: String?
    public var seoJson: String
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        schemaVersion: String,
        title: String,
        slug: String,
        subtitle: String?,
        content: String,
        excerpt: String?,
        coverImage: String?,
        tagsJson: String,
        categoriesJson: String,
        statusRaw: String,
        visibilityRaw: String,
        groupId: String?,
        publishedAt: Date?,
        scheduledAt: Date?,
        authorPubkey: String,
        authorName: String?,
        coauthorsJson: String,
        viewCount: Int,
        canonicalUrl: String?,
        seoJson: String,
        createdAt: Date,
        updatedAt: Date?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.title = title
        self.slug = slug
        self.subtitle = subtitle
        self.content = content
        self.excerpt = excerpt
        self.coverImage = coverImage
        self.tagsJson = tagsJson
        self.categoriesJson = categoriesJson
        self.statusRaw = statusRaw
        self.visibilityRaw = visibilityRaw
        self.groupId = groupId
        self.publishedAt = publishedAt
        self.scheduledAt = scheduledAt
        self.authorPubkey = authorPubkey
        self.authorName = authorName
        self.coauthorsJson = coauthorsJson
        self.viewCount = viewCount
        self.canonicalUrl = canonicalUrl
        self.seoJson = seoJson
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
public final class PublicationEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var name: String
    public var descriptionText: String?
    public var logo: String?
    public var coverImage: String?
    public var groupId: String?
    public var visibilityRaw: String
    public var editorsJson: String
    public var ownerPubkey: String
    public var themeJson: String
    public var customDomain: String?
    public var rssEnabled: Bool
    public var commentsEnabled: Bool
    public var subscriptionEnabled: Bool
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        schemaVersion: String,
        name: String,
        descriptionText: String?,
        logo: String?,
        coverImage: String?,
        groupId: String?,
        visibilityRaw: String,
        editorsJson: String,
        ownerPubkey: String,
        themeJson: String,
        customDomain: String?,
        rssEnabled: Bool,
        commentsEnabled: Bool,
        subscriptionEnabled: Bool,
        createdAt: Date,
        updatedAt: Date?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.name = name
        self.descriptionText = descriptionText
        self.logo = logo
        self.coverImage = coverImage
        self.groupId = groupId
        self.visibilityRaw = visibilityRaw
        self.editorsJson = editorsJson
        self.ownerPubkey = ownerPubkey
        self.themeJson = themeJson
        self.customDomain = customDomain
        self.rssEnabled = rssEnabled
        self.commentsEnabled = commentsEnabled
        self.subscriptionEnabled = subscriptionEnabled
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
public final class ArticleCommentEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var articleId: String
    public var parentId: String?
    public var content: String
    public var authorPubkey: String
    public var authorName: String?
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        schemaVersion: String,
        articleId: String,
        parentId: String?,
        content: String,
        authorPubkey: String,
        authorName: String?,
        createdAt: Date,
        updatedAt: Date?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.articleId = articleId
        self.parentId = parentId
        self.content = content
        self.authorPubkey = authorPubkey
        self.authorName = authorName
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
public final class SubscriberEntity {
    @Attribute(.unique) public var id: String
    public var publicationId: String
    public var pubkey: String
    public var displayName: String?
    public var email: String?
    public var tierId: String?
    public var subscriptionStatusRaw: String
    public var subscribedAt: Date
    public var expiresAt: Date?

    public init(
        id: String,
        publicationId: String,
        pubkey: String,
        displayName: String?,
        email: String?,
        tierId: String?,
        subscriptionStatusRaw: String,
        subscribedAt: Date,
        expiresAt: Date?
    ) {
        self.id = id
        self.publicationId = publicationId
        self.pubkey = pubkey
        self.displayName = displayName
        self.email = email
        self.tierId = tierId
        self.subscriptionStatusRaw = subscriptionStatusRaw
        self.subscribedAt = subscribedAt
        self.expiresAt = expiresAt
    }
}

@Model
public final class SubscriptionTierEntity {
    @Attribute(.unique) public var id: String
    public var publicationId: String
    public var name: String
    public var descriptionText: String?
    public var priceMonthly: Int
    public var priceYearly: Int?
    public var benefitsJson: String
    public var isActive: Bool
    public var createdAt: Date

    public init(
        id: String,
        publicationId: String,
        name: String,
        descriptionText: String?,
        priceMonthly: Int,
        priceYearly: Int?,
        benefitsJson: String,
        isActive: Bool,
        createdAt: Date
    ) {
        self.id = id
        self.publicationId = publicationId
        self.name = name
        self.descriptionText = descriptionText
        self.priceMonthly = priceMonthly
        self.priceYearly = priceYearly
        self.benefitsJson = benefitsJson
        self.isActive = isActive
        self.createdAt = createdAt
    }
}

@Model
public final class ArticleDraftEntity {
    @Attribute(.unique) public var id: String
    public var title: String
    public var content: String
    public var lastModified: Date
    public var articleId: String?

    public init(
        id: String,
        title: String,
        content: String,
        lastModified: Date,
        articleId: String?
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.lastModified = lastModified
        self.articleId = articleId
    }
}

// MARK: - PublishingStore

@MainActor
public final class PublishingStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "PublishingStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init() throws {
        let schema = Schema([
            ArticleEntity.self,
            PublicationEntity.self,
            ArticleCommentEntity.self,
            SubscriberEntity.self,
            SubscriptionTierEntity.self,
            ArticleDraftEntity.self
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [config])
        self.modelContext = modelContainer.mainContext
    }

    // MARK: - Articles

    public func saveArticle(_ article: Article) throws {
        let tagsData = try encoder.encode(article.tags)
        let tagsJson = String(data: tagsData, encoding: .utf8) ?? "[]"

        let categoriesData = try encoder.encode(article.categories)
        let categoriesJson = String(data: categoriesData, encoding: .utf8) ?? "[]"

        let coauthorsData = try encoder.encode(article.coauthors)
        let coauthorsJson = String(data: coauthorsData, encoding: .utf8) ?? "[]"

        let seoData = try encoder.encode(article.seo)
        let seoJson = String(data: seoData, encoding: .utf8) ?? "{}"

        // Check if article exists
        let descriptor = FetchDescriptor<ArticleEntity>(
            predicate: #Predicate { $0.id == article.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            // Update existing
            existing.title = article.title
            existing.slug = article.slug
            existing.subtitle = article.subtitle
            existing.content = article.content
            existing.excerpt = article.excerpt
            existing.coverImage = article.coverImage
            existing.tagsJson = tagsJson
            existing.categoriesJson = categoriesJson
            existing.statusRaw = article.status.rawValue
            existing.visibilityRaw = article.visibility.rawValue
            existing.groupId = article.groupId
            existing.publishedAt = article.publishedAt
            existing.scheduledAt = article.scheduledAt
            existing.authorName = article.authorName
            existing.coauthorsJson = coauthorsJson
            existing.viewCount = article.viewCount
            existing.canonicalUrl = article.canonicalUrl
            existing.seoJson = seoJson
            existing.updatedAt = article.updatedAt ?? Date()
        } else {
            // Insert new
            let entity = ArticleEntity(
                id: article.id,
                schemaVersion: article.schemaVersion,
                title: article.title,
                slug: article.slug,
                subtitle: article.subtitle,
                content: article.content,
                excerpt: article.excerpt,
                coverImage: article.coverImage,
                tagsJson: tagsJson,
                categoriesJson: categoriesJson,
                statusRaw: article.status.rawValue,
                visibilityRaw: article.visibility.rawValue,
                groupId: article.groupId,
                publishedAt: article.publishedAt,
                scheduledAt: article.scheduledAt,
                authorPubkey: article.authorPubkey,
                authorName: article.authorName,
                coauthorsJson: coauthorsJson,
                viewCount: article.viewCount,
                canonicalUrl: article.canonicalUrl,
                seoJson: seoJson,
                createdAt: article.createdAt,
                updatedAt: article.updatedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved article: \(article.id)")
    }

    public func getArticle(id: String) throws -> Article? {
        let descriptor = FetchDescriptor<ArticleEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToArticle(entity)
    }

    public func getArticleBySlug(slug: String, groupId: String?) throws -> Article? {
        var descriptor: FetchDescriptor<ArticleEntity>

        if let groupId = groupId {
            descriptor = FetchDescriptor<ArticleEntity>(
                predicate: #Predicate { $0.slug == slug && $0.groupId == groupId }
            )
        } else {
            descriptor = FetchDescriptor<ArticleEntity>(
                predicate: #Predicate { $0.slug == slug }
            )
        }

        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToArticle(entity)
    }

    public func getArticles(
        status: ArticleStatus? = nil,
        authorPubkey: String? = nil,
        groupId: String? = nil
    ) throws -> [Article] {
        var descriptor = FetchDescriptor<ArticleEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        if let status = status {
            let statusRaw = status.rawValue
            if let authorPubkey = authorPubkey {
                if let groupId = groupId {
                    descriptor.predicate = #Predicate {
                        $0.statusRaw == statusRaw && $0.authorPubkey == authorPubkey && $0.groupId == groupId
                    }
                } else {
                    descriptor.predicate = #Predicate {
                        $0.statusRaw == statusRaw && $0.authorPubkey == authorPubkey
                    }
                }
            } else if let groupId = groupId {
                descriptor.predicate = #Predicate {
                    $0.statusRaw == statusRaw && $0.groupId == groupId
                }
            } else {
                descriptor.predicate = #Predicate { $0.statusRaw == statusRaw }
            }
        } else if let authorPubkey = authorPubkey {
            if let groupId = groupId {
                descriptor.predicate = #Predicate {
                    $0.authorPubkey == authorPubkey && $0.groupId == groupId
                }
            } else {
                descriptor.predicate = #Predicate { $0.authorPubkey == authorPubkey }
            }
        } else if let groupId = groupId {
            descriptor.predicate = #Predicate { $0.groupId == groupId }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToArticle($0) }
    }

    public func getPublishedArticles(groupId: String? = nil, limit: Int? = nil) throws -> [Article] {
        let publishedStatus = ArticleStatus.published.rawValue
        var descriptor = FetchDescriptor<ArticleEntity>(
            sortBy: [SortDescriptor(\.publishedAt, order: .reverse)]
        )

        if let groupId = groupId {
            descriptor.predicate = #Predicate {
                $0.statusRaw == publishedStatus && $0.groupId == groupId
            }
        } else {
            descriptor.predicate = #Predicate { $0.statusRaw == publishedStatus }
        }

        if let limit = limit {
            descriptor.fetchLimit = limit
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToArticle($0) }
    }

    public func getScheduledArticles() throws -> [Article] {
        let scheduledStatus = ArticleStatus.scheduled.rawValue
        let descriptor = FetchDescriptor<ArticleEntity>(
            predicate: #Predicate { $0.statusRaw == scheduledStatus },
            sortBy: [SortDescriptor(\.scheduledAt, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToArticle($0) }
    }

    public func searchArticles(query: String, groupId: String? = nil) throws -> [Article] {
        let publishedStatus = ArticleStatus.published.rawValue
        var descriptor = FetchDescriptor<ArticleEntity>(
            predicate: #Predicate { $0.statusRaw == publishedStatus },
            sortBy: [SortDescriptor(\.publishedAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        let lowercaseQuery = query.lowercased()

        let filtered = entities.filter { entity in
            if let gId = groupId, entity.groupId != gId { return false }
            return entity.title.lowercased().contains(lowercaseQuery) ||
                   entity.content.lowercased().contains(lowercaseQuery) ||
                   (entity.excerpt?.lowercased().contains(lowercaseQuery) ?? false) ||
                   entity.tagsJson.lowercased().contains(lowercaseQuery)
        }

        return try filtered.compactMap { try entityToArticle($0) }
    }

    public func deleteArticle(id: String) throws {
        let descriptor = FetchDescriptor<ArticleEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
            logger.debug("Deleted article: \(id)")
        }
    }

    private func entityToArticle(_ entity: ArticleEntity) throws -> Article {
        let tags: [String] = (try? decoder.decode([String].self, from: entity.tagsJson.data(using: .utf8) ?? Data())) ?? []
        let categories: [String] = (try? decoder.decode([String].self, from: entity.categoriesJson.data(using: .utf8) ?? Data())) ?? []
        let coauthors: [String] = (try? decoder.decode([String].self, from: entity.coauthorsJson.data(using: .utf8) ?? Data())) ?? []
        let seo: SEOMetadata = (try? decoder.decode(SEOMetadata.self, from: entity.seoJson.data(using: .utf8) ?? Data())) ?? SEOMetadata()

        return Article(
            id: entity.id,
            schemaVersion: entity.schemaVersion,
            title: entity.title,
            slug: entity.slug,
            subtitle: entity.subtitle,
            content: entity.content,
            excerpt: entity.excerpt,
            coverImage: entity.coverImage,
            tags: tags,
            categories: categories,
            status: ArticleStatus(rawValue: entity.statusRaw) ?? .draft,
            visibility: ArticleVisibility(rawValue: entity.visibilityRaw) ?? .public,
            groupId: entity.groupId,
            publishedAt: entity.publishedAt,
            scheduledAt: entity.scheduledAt,
            authorPubkey: entity.authorPubkey,
            authorName: entity.authorName,
            coauthors: coauthors,
            viewCount: entity.viewCount,
            canonicalUrl: entity.canonicalUrl,
            seo: seo,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Publications

    public func savePublication(_ publication: Publication) throws {
        let editorsData = try encoder.encode(publication.editors)
        let editorsJson = String(data: editorsData, encoding: .utf8) ?? "[]"

        let themeData = try encoder.encode(publication.theme)
        let themeJson = String(data: themeData, encoding: .utf8) ?? "{}"

        let descriptor = FetchDescriptor<PublicationEntity>(
            predicate: #Predicate { $0.id == publication.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.name = publication.name
            existing.descriptionText = publication.description
            existing.logo = publication.logo
            existing.coverImage = publication.coverImage
            existing.groupId = publication.groupId
            existing.visibilityRaw = publication.visibility.rawValue
            existing.editorsJson = editorsJson
            existing.themeJson = themeJson
            existing.customDomain = publication.customDomain
            existing.rssEnabled = publication.rssEnabled
            existing.commentsEnabled = publication.commentsEnabled
            existing.subscriptionEnabled = publication.subscriptionEnabled
            existing.updatedAt = publication.updatedAt ?? Date()
        } else {
            let entity = PublicationEntity(
                id: publication.id,
                schemaVersion: publication.schemaVersion,
                name: publication.name,
                descriptionText: publication.description,
                logo: publication.logo,
                coverImage: publication.coverImage,
                groupId: publication.groupId,
                visibilityRaw: publication.visibility.rawValue,
                editorsJson: editorsJson,
                ownerPubkey: publication.ownerPubkey,
                themeJson: themeJson,
                customDomain: publication.customDomain,
                rssEnabled: publication.rssEnabled,
                commentsEnabled: publication.commentsEnabled,
                subscriptionEnabled: publication.subscriptionEnabled,
                createdAt: publication.createdAt,
                updatedAt: publication.updatedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved publication: \(publication.id)")
    }

    public func getPublication(id: String) throws -> Publication? {
        let descriptor = FetchDescriptor<PublicationEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToPublication(entity)
    }

    public func getPublications(ownerPubkey: String? = nil) throws -> [Publication] {
        var descriptor: FetchDescriptor<PublicationEntity>

        if let ownerPubkey = ownerPubkey {
            descriptor = FetchDescriptor<PublicationEntity>(
                predicate: #Predicate { $0.ownerPubkey == ownerPubkey },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        } else {
            descriptor = FetchDescriptor<PublicationEntity>(
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToPublication($0) }
    }

    public func deletePublication(id: String) throws {
        let descriptor = FetchDescriptor<PublicationEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToPublication(_ entity: PublicationEntity) throws -> Publication {
        let editors: [String] = (try? decoder.decode([String].self, from: entity.editorsJson.data(using: .utf8) ?? Data())) ?? []
        let theme: PublicationTheme = (try? decoder.decode(PublicationTheme.self, from: entity.themeJson.data(using: .utf8) ?? Data())) ?? PublicationTheme()

        return Publication(
            id: entity.id,
            schemaVersion: entity.schemaVersion,
            name: entity.name,
            description: entity.descriptionText,
            logo: entity.logo,
            coverImage: entity.coverImage,
            groupId: entity.groupId,
            visibility: ArticleVisibility(rawValue: entity.visibilityRaw) ?? .public,
            editors: editors,
            ownerPubkey: entity.ownerPubkey,
            theme: theme,
            customDomain: entity.customDomain,
            rssEnabled: entity.rssEnabled,
            commentsEnabled: entity.commentsEnabled,
            subscriptionEnabled: entity.subscriptionEnabled,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Comments

    public func saveComment(_ comment: ArticleComment) throws {
        let descriptor = FetchDescriptor<ArticleCommentEntity>(
            predicate: #Predicate { $0.id == comment.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.content = comment.content
            existing.authorName = comment.authorName
            existing.updatedAt = comment.updatedAt ?? Date()
        } else {
            let entity = ArticleCommentEntity(
                id: comment.id,
                schemaVersion: comment.schemaVersion,
                articleId: comment.articleId,
                parentId: comment.parentId,
                content: comment.content,
                authorPubkey: comment.authorPubkey,
                authorName: comment.authorName,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
    }

    public func getComments(articleId: String) throws -> [ArticleComment] {
        let descriptor = FetchDescriptor<ArticleCommentEntity>(
            predicate: #Predicate { $0.articleId == articleId },
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToComment($0) }
    }

    public func deleteComment(id: String) throws {
        let descriptor = FetchDescriptor<ArticleCommentEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToComment(_ entity: ArticleCommentEntity) -> ArticleComment {
        ArticleComment(
            id: entity.id,
            schemaVersion: entity.schemaVersion,
            articleId: entity.articleId,
            parentId: entity.parentId,
            content: entity.content,
            authorPubkey: entity.authorPubkey,
            authorName: entity.authorName,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Subscribers

    public func saveSubscriber(_ subscriber: Subscriber) throws {
        let descriptor = FetchDescriptor<SubscriberEntity>(
            predicate: #Predicate { $0.id == subscriber.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.displayName = subscriber.displayName
            existing.email = subscriber.email
            existing.tierId = subscriber.tierId
            existing.subscriptionStatusRaw = subscriber.subscriptionStatus.rawValue
            existing.expiresAt = subscriber.expiresAt
        } else {
            let entity = SubscriberEntity(
                id: subscriber.id,
                publicationId: subscriber.publicationId,
                pubkey: subscriber.pubkey,
                displayName: subscriber.displayName,
                email: subscriber.email,
                tierId: subscriber.tierId,
                subscriptionStatusRaw: subscriber.subscriptionStatus.rawValue,
                subscribedAt: subscriber.subscribedAt,
                expiresAt: subscriber.expiresAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
    }

    public func getSubscribers(publicationId: String) throws -> [Subscriber] {
        let descriptor = FetchDescriptor<SubscriberEntity>(
            predicate: #Predicate { $0.publicationId == publicationId },
            sortBy: [SortDescriptor(\.subscribedAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToSubscriber($0) }
    }

    public func getSubscriberCount(publicationId: String) throws -> Int {
        let descriptor = FetchDescriptor<SubscriberEntity>(
            predicate: #Predicate { $0.publicationId == publicationId }
        )
        return try modelContext.fetchCount(descriptor)
    }

    public func deleteSubscriber(id: String) throws {
        let descriptor = FetchDescriptor<SubscriberEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToSubscriber(_ entity: SubscriberEntity) -> Subscriber {
        Subscriber(
            id: entity.id,
            publicationId: entity.publicationId,
            pubkey: entity.pubkey,
            displayName: entity.displayName,
            email: entity.email,
            tierId: entity.tierId,
            subscriptionStatus: Subscriber.SubscriptionStatus(rawValue: entity.subscriptionStatusRaw) ?? .free,
            subscribedAt: entity.subscribedAt,
            expiresAt: entity.expiresAt
        )
    }

    // MARK: - Subscription Tiers

    public func saveSubscriptionTier(_ tier: SubscriptionTier) throws {
        let benefitsData = try encoder.encode(tier.benefits)
        let benefitsJson = String(data: benefitsData, encoding: .utf8) ?? "[]"

        let descriptor = FetchDescriptor<SubscriptionTierEntity>(
            predicate: #Predicate { $0.id == tier.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.name = tier.name
            existing.descriptionText = tier.description
            existing.priceMonthly = tier.priceMonthly
            existing.priceYearly = tier.priceYearly
            existing.benefitsJson = benefitsJson
            existing.isActive = tier.isActive
        } else {
            let entity = SubscriptionTierEntity(
                id: tier.id,
                publicationId: tier.publicationId,
                name: tier.name,
                descriptionText: tier.description,
                priceMonthly: tier.priceMonthly,
                priceYearly: tier.priceYearly,
                benefitsJson: benefitsJson,
                isActive: tier.isActive,
                createdAt: tier.createdAt
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
    }

    public func getSubscriptionTiers(publicationId: String) throws -> [SubscriptionTier] {
        let descriptor = FetchDescriptor<SubscriptionTierEntity>(
            predicate: #Predicate { $0.publicationId == publicationId },
            sortBy: [SortDescriptor(\.priceMonthly, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToSubscriptionTier($0) }
    }

    private func entityToSubscriptionTier(_ entity: SubscriptionTierEntity) -> SubscriptionTier {
        let benefits: [String] = (try? decoder.decode([String].self, from: entity.benefitsJson.data(using: .utf8) ?? Data())) ?? []

        return SubscriptionTier(
            id: entity.id,
            publicationId: entity.publicationId,
            name: entity.name,
            description: entity.descriptionText,
            priceMonthly: entity.priceMonthly,
            priceYearly: entity.priceYearly,
            benefits: benefits,
            isActive: entity.isActive,
            createdAt: entity.createdAt
        )
    }

    // MARK: - Drafts

    public func saveDraft(_ draft: ArticleDraft) throws {
        let descriptor = FetchDescriptor<ArticleDraftEntity>(
            predicate: #Predicate { $0.id == draft.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.title = draft.title
            existing.content = draft.content
            existing.lastModified = draft.lastModified
            existing.articleId = draft.articleId
        } else {
            let entity = ArticleDraftEntity(
                id: draft.id,
                title: draft.title,
                content: draft.content,
                lastModified: draft.lastModified,
                articleId: draft.articleId
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
    }

    public func getDrafts() throws -> [ArticleDraft] {
        let descriptor = FetchDescriptor<ArticleDraftEntity>(
            sortBy: [SortDescriptor(\.lastModified, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToDraft($0) }
    }

    public func getDraft(id: String) throws -> ArticleDraft? {
        let descriptor = FetchDescriptor<ArticleDraftEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return entityToDraft(entity)
    }

    public func deleteDraft(id: String) throws {
        let descriptor = FetchDescriptor<ArticleDraftEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToDraft(_ entity: ArticleDraftEntity) -> ArticleDraft {
        ArticleDraft(
            id: entity.id,
            title: entity.title,
            content: entity.content,
            lastModified: entity.lastModified,
            articleId: entity.articleId
        )
    }
}
