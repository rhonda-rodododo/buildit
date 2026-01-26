// PublishingModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for publishing module - blogs, articles, and long-form content.

import Foundation

// MARK: - Schema Version

let PublishingSchemaVersion = "1.0.0"

// MARK: - Enums

/// Status of an article
public enum ArticleStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case published
    case scheduled
    case archived

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .published: return "Published"
        case .scheduled: return "Scheduled"
        case .archived: return "Archived"
        }
    }

    var icon: String {
        switch self {
        case .draft: return "doc"
        case .published: return "checkmark.circle"
        case .scheduled: return "clock"
        case .archived: return "archivebox"
        }
    }

    var color: String {
        switch self {
        case .draft: return "gray"
        case .published: return "green"
        case .scheduled: return "orange"
        case .archived: return "secondary"
        }
    }
}

/// Visibility of an article or publication
public enum ArticleVisibility: String, Codable, Sendable {
    case `private`
    case group
    case `public`

    var displayName: String {
        switch self {
        case .private: return "Private"
        case .group: return "Group Only"
        case .public: return "Public"
        }
    }

    var icon: String {
        switch self {
        case .private: return "lock"
        case .group: return "person.2"
        case .public: return "globe"
        }
    }
}

// MARK: - SEO Metadata

/// SEO metadata for an article
public struct SEOMetadata: Codable, Sendable, Equatable {
    public var metaTitle: String?
    public var metaDescription: String?
    public var ogImage: String?
    public var keywords: [String]

    public init(
        metaTitle: String? = nil,
        metaDescription: String? = nil,
        ogImage: String? = nil,
        keywords: [String] = []
    ) {
        self.metaTitle = metaTitle
        self.metaDescription = metaDescription
        self.ogImage = ogImage
        self.keywords = keywords
    }

    /// Check if SEO metadata is configured
    public var isConfigured: Bool {
        metaTitle != nil || metaDescription != nil || ogImage != nil || !keywords.isEmpty
    }

    /// Meta title with character count (max 60)
    public var metaTitleCharCount: Int {
        metaTitle?.count ?? 0
    }

    /// Meta description with character count (max 160)
    public var metaDescriptionCharCount: Int {
        metaDescription?.count ?? 0
    }
}

// MARK: - Article

/// An article or blog post
public struct Article: Identifiable, Codable, Sendable {
    public let id: String
    public let schemaVersion: String
    public var title: String
    public var slug: String
    public var subtitle: String?
    public var content: String
    public var excerpt: String?
    public var coverImage: String?
    public var tags: [String]
    public var categories: [String]
    public var status: ArticleStatus
    public var visibility: ArticleVisibility
    public var groupId: String?
    public var publishedAt: Date?
    public var scheduledAt: Date?
    public let authorPubkey: String
    public var authorName: String?
    public var coauthors: [String]
    public var viewCount: Int
    public var canonicalUrl: String?
    public var seo: SEOMetadata
    public let createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String = UUID().uuidString,
        schemaVersion: String = PublishingSchemaVersion,
        title: String,
        slug: String = "",
        subtitle: String? = nil,
        content: String = "",
        excerpt: String? = nil,
        coverImage: String? = nil,
        tags: [String] = [],
        categories: [String] = [],
        status: ArticleStatus = .draft,
        visibility: ArticleVisibility = .public,
        groupId: String? = nil,
        publishedAt: Date? = nil,
        scheduledAt: Date? = nil,
        authorPubkey: String,
        authorName: String? = nil,
        coauthors: [String] = [],
        viewCount: Int = 0,
        canonicalUrl: String? = nil,
        seo: SEOMetadata = SEOMetadata(),
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.title = title
        self.slug = slug.isEmpty ? Article.generateSlug(from: title) : slug
        self.subtitle = subtitle
        self.content = content
        self.excerpt = excerpt
        self.coverImage = coverImage
        self.tags = tags
        self.categories = categories
        self.status = status
        self.visibility = visibility
        self.groupId = groupId
        self.publishedAt = publishedAt
        self.scheduledAt = scheduledAt
        self.authorPubkey = authorPubkey
        self.authorName = authorName
        self.coauthors = coauthors
        self.viewCount = viewCount
        self.canonicalUrl = canonicalUrl
        self.seo = seo
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    // MARK: - Computed Properties

    /// Word count of content
    public var wordCount: Int {
        content.split(whereSeparator: { $0.isWhitespace }).count
    }

    /// Estimated reading time in minutes
    public var readingTime: Int {
        max(1, wordCount / 200)
    }

    /// Check if article is published
    public var isPublished: Bool {
        status == .published
    }

    /// Check if article is scheduled for future
    public var isScheduled: Bool {
        status == .scheduled && scheduledAt != nil
    }

    /// Check if scheduled article should be published
    public var shouldPublish: Bool {
        guard isScheduled, let scheduledAt = scheduledAt else { return false }
        return scheduledAt <= Date()
    }

    /// Auto-generate excerpt from content if not set
    public var displayExcerpt: String {
        if let excerpt = excerpt, !excerpt.isEmpty {
            return excerpt
        }
        // Strip markdown and take first 150 chars
        let stripped = content
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: "`", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if stripped.count <= 150 {
            return stripped
        }
        let index = stripped.index(stripped.startIndex, offsetBy: 150)
        return String(stripped[..<index]) + "..."
    }

    // MARK: - Static Methods

    /// Generate URL-friendly slug from title
    public static func generateSlug(from title: String) -> String {
        title
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
            .replacingOccurrences(of: "-+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case id, title, slug, subtitle, content, excerpt, coverImage
        case tags, categories, status, visibility, groupId
        case publishedAt, scheduledAt, authorPubkey, authorName
        case coauthors, viewCount, canonicalUrl, seo
        case createdAt, updatedAt
        case schemaVersion = "_v"
    }
}

// MARK: - Publication

/// A publication or blog collection
public struct Publication: Identifiable, Codable, Sendable {
    public let id: String
    public let schemaVersion: String
    public var name: String
    public var description: String?
    public var logo: String?
    public var coverImage: String?
    public var groupId: String?
    public var visibility: ArticleVisibility
    public var editors: [String]
    public let ownerPubkey: String
    public var theme: PublicationTheme
    public var customDomain: String?
    public var rssEnabled: Bool
    public var commentsEnabled: Bool
    public var subscriptionEnabled: Bool
    public let createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String = UUID().uuidString,
        schemaVersion: String = PublishingSchemaVersion,
        name: String,
        description: String? = nil,
        logo: String? = nil,
        coverImage: String? = nil,
        groupId: String? = nil,
        visibility: ArticleVisibility = .public,
        editors: [String] = [],
        ownerPubkey: String,
        theme: PublicationTheme = PublicationTheme(),
        customDomain: String? = nil,
        rssEnabled: Bool = true,
        commentsEnabled: Bool = true,
        subscriptionEnabled: Bool = false,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.name = name
        self.description = description
        self.logo = logo
        self.coverImage = coverImage
        self.groupId = groupId
        self.visibility = visibility
        self.editors = editors
        self.ownerPubkey = ownerPubkey
        self.theme = theme
        self.customDomain = customDomain
        self.rssEnabled = rssEnabled
        self.commentsEnabled = commentsEnabled
        self.subscriptionEnabled = subscriptionEnabled
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Check if user can edit this publication
    public func canEdit(pubkey: String) -> Bool {
        ownerPubkey == pubkey || editors.contains(pubkey)
    }

    enum CodingKeys: String, CodingKey {
        case id, name, description, logo, coverImage, groupId
        case visibility, editors, ownerPubkey, theme
        case customDomain, rssEnabled, commentsEnabled, subscriptionEnabled
        case createdAt, updatedAt
        case schemaVersion = "_v"
    }
}

// MARK: - Publication Theme

/// Theme settings for a publication
public struct PublicationTheme: Codable, Sendable, Equatable {
    public var primaryColor: String
    public var accentColor: String
    public var fontFamily: String
    public var headerStyle: HeaderStyle
    public var layoutStyle: LayoutStyle

    public init(
        primaryColor: String = "#000000",
        accentColor: String = "#007AFF",
        fontFamily: String = "system",
        headerStyle: HeaderStyle = .centered,
        layoutStyle: LayoutStyle = .modern
    ) {
        self.primaryColor = primaryColor
        self.accentColor = accentColor
        self.fontFamily = fontFamily
        self.headerStyle = headerStyle
        self.layoutStyle = layoutStyle
    }

    public enum HeaderStyle: String, Codable, CaseIterable, Sendable {
        case centered
        case leftAligned = "left-aligned"
        case minimal

        var displayName: String {
            switch self {
            case .centered: return "Centered"
            case .leftAligned: return "Left Aligned"
            case .minimal: return "Minimal"
            }
        }
    }

    public enum LayoutStyle: String, Codable, CaseIterable, Sendable {
        case modern
        case classic
        case magazine
        case minimal

        var displayName: String {
            switch self {
            case .modern: return "Modern"
            case .classic: return "Classic"
            case .magazine: return "Magazine"
            case .minimal: return "Minimal"
            }
        }
    }
}

// MARK: - Comment

/// A comment on an article
public struct ArticleComment: Identifiable, Codable, Sendable {
    public let id: String
    public let schemaVersion: String
    public let articleId: String
    public let parentId: String?
    public var content: String
    public let authorPubkey: String
    public var authorName: String?
    public let createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String = UUID().uuidString,
        schemaVersion: String = PublishingSchemaVersion,
        articleId: String,
        parentId: String? = nil,
        content: String,
        authorPubkey: String,
        authorName: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
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

    /// Check if this is a reply to another comment
    public var isReply: Bool {
        parentId != nil
    }

    enum CodingKeys: String, CodingKey {
        case id, articleId, parentId, content, authorPubkey, authorName
        case createdAt, updatedAt
        case schemaVersion = "_v"
    }
}

// MARK: - Subscription Tier

/// A subscription tier for a publication
public struct SubscriptionTier: Identifiable, Codable, Sendable {
    public let id: String
    public let publicationId: String
    public var name: String
    public var description: String?
    public var priceMonthly: Int // In sats
    public var priceYearly: Int? // In sats
    public var benefits: [String]
    public var isActive: Bool
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString,
        publicationId: String,
        name: String,
        description: String? = nil,
        priceMonthly: Int,
        priceYearly: Int? = nil,
        benefits: [String] = [],
        isActive: Bool = true,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.publicationId = publicationId
        self.name = name
        self.description = description
        self.priceMonthly = priceMonthly
        self.priceYearly = priceYearly
        self.benefits = benefits
        self.isActive = isActive
        self.createdAt = createdAt
    }

    /// Price formatted in sats
    public var formattedMonthlyPrice: String {
        "\(priceMonthly) sats/mo"
    }

    /// Price formatted in sats (yearly)
    public var formattedYearlyPrice: String? {
        guard let yearly = priceYearly else { return nil }
        return "\(yearly) sats/yr"
    }
}

// MARK: - Subscriber

/// A subscriber to a publication
public struct Subscriber: Identifiable, Codable, Sendable {
    public let id: String
    public let publicationId: String
    public let pubkey: String
    public var displayName: String?
    public var email: String?
    public var tierId: String?
    public var subscriptionStatus: SubscriptionStatus
    public let subscribedAt: Date
    public var expiresAt: Date?

    public init(
        id: String = UUID().uuidString,
        publicationId: String,
        pubkey: String,
        displayName: String? = nil,
        email: String? = nil,
        tierId: String? = nil,
        subscriptionStatus: SubscriptionStatus = .free,
        subscribedAt: Date = Date(),
        expiresAt: Date? = nil
    ) {
        self.id = id
        self.publicationId = publicationId
        self.pubkey = pubkey
        self.displayName = displayName
        self.email = email
        self.tierId = tierId
        self.subscriptionStatus = subscriptionStatus
        self.subscribedAt = subscribedAt
        self.expiresAt = expiresAt
    }

    /// Check if subscription is active
    public var isActive: Bool {
        switch subscriptionStatus {
        case .free, .active:
            return true
        case .expired, .cancelled:
            return false
        }
    }

    public enum SubscriptionStatus: String, Codable, Sendable {
        case free
        case active
        case expired
        case cancelled

        var displayName: String {
            switch self {
            case .free: return "Free"
            case .active: return "Active"
            case .expired: return "Expired"
            case .cancelled: return "Cancelled"
            }
        }
    }
}

// MARK: - RSS Feed Item

/// An RSS feed item representation
public struct RSSFeedItem: Sendable {
    public let title: String
    public let link: String
    public let description: String
    public let author: String?
    public let pubDate: Date
    public let guid: String
    public let categories: [String]

    public init(from article: Article, baseUrl: String) {
        self.title = article.title
        self.link = "\(baseUrl)/\(article.slug)"
        self.description = article.displayExcerpt
        self.author = article.authorName
        self.pubDate = article.publishedAt ?? article.createdAt
        self.guid = article.id
        self.categories = article.categories
    }
}

// MARK: - Article Draft

/// A local draft for an article (not synced)
public struct ArticleDraft: Identifiable, Codable, Sendable {
    public let id: String
    public var title: String
    public var content: String
    public var lastModified: Date
    public var articleId: String?

    public init(
        id: String = UUID().uuidString,
        title: String = "",
        content: String = "",
        lastModified: Date = Date(),
        articleId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.lastModified = lastModified
        self.articleId = articleId
    }

    /// Check if draft has unsaved changes
    public var hasContent: Bool {
        !title.isEmpty || !content.isEmpty
    }
}
