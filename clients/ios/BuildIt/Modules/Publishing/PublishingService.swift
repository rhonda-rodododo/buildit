// PublishingService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for publishing operations.

import Foundation
import os.log

/// Service handling publishing business logic
@MainActor
public final class PublishingService: ObservableObject {
    // MARK: - Nostr Event Kinds (from schema)
    static let KIND_ARTICLE = 40071
    static let KIND_COMMENT = 40072
    static let KIND_PUBLICATION = 40073

    // MARK: - Properties
    private let store: PublishingStore
    private let logger = Logger(subsystem: "com.buildit", category: "PublishingService")
    private var scheduledPublishTimer: Timer?

    @Published public var articles: [Article] = []
    @Published public var drafts: [Article] = []
    @Published public var publications: [Publication] = []
    @Published public var currentPublication: Publication?
    @Published public var isLoading = false
    @Published public var error: PublishingError?

    // MARK: - Initialization

    public init(store: PublishingStore) {
        self.store = store
        startScheduledPublishTimer()
    }

    deinit {
        scheduledPublishTimer?.invalidate()
    }

    // MARK: - Articles

    /// Create a new article
    public func createArticle(
        title: String,
        content: String,
        authorPubkey: String,
        authorName: String? = nil,
        groupId: String? = nil
    ) async throws -> Article {
        let article = Article(
            title: title,
            content: content,
            groupId: groupId,
            authorPubkey: authorPubkey,
            authorName: authorName
        )

        try store.saveArticle(article)
        await refreshArticles(authorPubkey: authorPubkey)

        logger.info("Created article: \(article.id)")
        return article
    }

    /// Update an existing article
    public func updateArticle(_ article: Article) async throws -> Article {
        var updated = article
        updated.updatedAt = Date()

        // Re-generate slug if title changed significantly
        if Article.generateSlug(from: article.title) != article.slug {
            // Only update slug for drafts to avoid breaking links
            if article.status == .draft {
                updated.slug = Article.generateSlug(from: article.title)
            }
        }

        try store.saveArticle(updated)
        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Updated article: \(article.id)")
        return updated
    }

    /// Publish an article immediately
    public func publishArticle(_ article: Article) async throws -> Article {
        var published = article
        published.status = .published
        published.publishedAt = Date()
        published.updatedAt = Date()
        published.scheduledAt = nil

        try store.saveArticle(published)

        // Publish to Nostr
        try await publishToNostr(published)

        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Published article: \(article.id)")
        return published
    }

    /// Schedule an article for future publication
    public func scheduleArticle(_ article: Article, publishAt: Date) async throws -> Article {
        guard publishAt > Date() else {
            throw PublishingError.invalidScheduleDate
        }

        var scheduled = article
        scheduled.status = .scheduled
        scheduled.scheduledAt = publishAt
        scheduled.updatedAt = Date()

        try store.saveArticle(scheduled)
        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Scheduled article: \(article.id) for \(publishAt)")
        return scheduled
    }

    /// Archive an article
    public func archiveArticle(_ article: Article) async throws -> Article {
        var archived = article
        archived.status = .archived
        archived.updatedAt = Date()

        try store.saveArticle(archived)
        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Archived article: \(article.id)")
        return archived
    }

    /// Unarchive an article (back to draft)
    public func unarchiveArticle(_ article: Article) async throws -> Article {
        var unarchived = article
        unarchived.status = .draft
        unarchived.updatedAt = Date()

        try store.saveArticle(unarchived)
        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Unarchived article: \(article.id)")
        return unarchived
    }

    /// Delete an article
    public func deleteArticle(_ article: Article) async throws {
        try store.deleteArticle(id: article.id)
        await refreshArticles(authorPubkey: article.authorPubkey)

        logger.info("Deleted article: \(article.id)")
    }

    /// Get article by ID
    public func getArticle(id: String) async throws -> Article? {
        return try store.getArticle(id: id)
    }

    /// Get article by slug
    public func getArticleBySlug(slug: String, groupId: String? = nil) async throws -> Article? {
        return try store.getArticleBySlug(slug: slug, groupId: groupId)
    }

    /// Get published articles
    public func getPublishedArticles(groupId: String? = nil, limit: Int? = nil) async throws -> [Article] {
        return try store.getPublishedArticles(groupId: groupId, limit: limit)
    }

    /// Search articles
    public func searchArticles(query: String, groupId: String? = nil) async throws -> [Article] {
        return try store.searchArticles(query: query, groupId: groupId)
    }

    /// Refresh articles list
    public func refreshArticles(authorPubkey: String? = nil, groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let all = try store.getArticles(authorPubkey: authorPubkey, groupId: groupId)
            articles = all.filter { $0.status == .published }
            drafts = all.filter { $0.status == .draft || $0.status == .scheduled }
        } catch {
            logger.error("Failed to refresh articles: \(error)")
            self.error = .fetchFailed(error.localizedDescription)
        }
    }

    // MARK: - Slug Generation

    /// Generate a unique slug for an article
    public func generateUniqueSlug(from title: String, groupId: String? = nil) async throws -> String {
        var baseSlug = Article.generateSlug(from: title)

        // Check if slug exists
        var slug = baseSlug
        var counter = 1

        while try store.getArticleBySlug(slug: slug, groupId: groupId) != nil {
            slug = "\(baseSlug)-\(counter)"
            counter += 1

            if counter > 100 {
                // Fallback to UUID suffix
                slug = "\(baseSlug)-\(UUID().uuidString.prefix(8).lowercased())"
                break
            }
        }

        return slug
    }

    // MARK: - RSS Generation

    /// Generate RSS feed XML for a publication
    public func generateRSS(
        for publication: Publication,
        articles: [Article],
        baseUrl: String
    ) -> String {
        let feedItems = articles
            .filter { $0.isPublished }
            .prefix(20)
            .map { RSSFeedItem(from: $0, baseUrl: baseUrl) }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")

        var xml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
          <channel>
            <title>\(escapeXML(publication.name))</title>
            <link>\(baseUrl)</link>
            <description>\(escapeXML(publication.description ?? ""))</description>
            <language>en-us</language>
            <lastBuildDate>\(dateFormatter.string(from: Date()))</lastBuildDate>
            <atom:link href="\(baseUrl)/rss.xml" rel="self" type="application/rss+xml"/>

        """

        if let logo = publication.logo {
            xml += """
                <image>
                  <url>\(escapeXML(logo))</url>
                  <title>\(escapeXML(publication.name))</title>
                  <link>\(baseUrl)</link>
                </image>

            """
        }

        for item in feedItems {
            xml += """
                <item>
                  <title>\(escapeXML(item.title))</title>
                  <link>\(item.link)</link>
                  <description>\(escapeXML(item.description))</description>
                  <pubDate>\(dateFormatter.string(from: item.pubDate))</pubDate>
                  <guid isPermaLink="false">\(item.guid)</guid>

            """

            if let author = item.author {
                xml += "      <author>\(escapeXML(author))</author>\n"
            }

            for category in item.categories {
                xml += "      <category>\(escapeXML(category))</category>\n"
            }

            xml += "    </item>\n"
        }

        xml += """
          </channel>
        </rss>
        """

        return xml
    }

    private func escapeXML(_ string: String) -> String {
        string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    // MARK: - Publications

    /// Create a new publication
    public func createPublication(
        name: String,
        description: String? = nil,
        ownerPubkey: String,
        groupId: String? = nil
    ) async throws -> Publication {
        let publication = Publication(
            name: name,
            description: description,
            groupId: groupId,
            ownerPubkey: ownerPubkey
        )

        try store.savePublication(publication)
        await refreshPublications(ownerPubkey: ownerPubkey)

        // Publish to Nostr
        try await publishPublicationToNostr(publication)

        logger.info("Created publication: \(publication.id)")
        return publication
    }

    /// Update a publication
    public func updatePublication(_ publication: Publication) async throws -> Publication {
        var updated = publication
        updated.updatedAt = Date()

        try store.savePublication(updated)
        await refreshPublications(ownerPubkey: publication.ownerPubkey)

        logger.info("Updated publication: \(publication.id)")
        return updated
    }

    /// Delete a publication
    public func deletePublication(_ publication: Publication) async throws {
        try store.deletePublication(id: publication.id)
        await refreshPublications(ownerPubkey: publication.ownerPubkey)

        logger.info("Deleted publication: \(publication.id)")
    }

    /// Get publication by ID
    public func getPublication(id: String) async throws -> Publication? {
        return try store.getPublication(id: id)
    }

    /// Refresh publications list
    public func refreshPublications(ownerPubkey: String? = nil) async {
        do {
            publications = try store.getPublications(ownerPubkey: ownerPubkey)
            if currentPublication == nil, let first = publications.first {
                currentPublication = first
            }
        } catch {
            logger.error("Failed to refresh publications: \(error)")
        }
    }

    // MARK: - Comments

    /// Add a comment to an article
    public func addComment(
        articleId: String,
        content: String,
        authorPubkey: String,
        authorName: String? = nil,
        parentId: String? = nil
    ) async throws -> ArticleComment {
        let comment = ArticleComment(
            articleId: articleId,
            parentId: parentId,
            content: content,
            authorPubkey: authorPubkey,
            authorName: authorName
        )

        try store.saveComment(comment)

        // Publish to Nostr
        try await publishCommentToNostr(comment)

        logger.info("Added comment: \(comment.id)")
        return comment
    }

    /// Get comments for an article
    public func getComments(articleId: String) async throws -> [ArticleComment] {
        return try store.getComments(articleId: articleId)
    }

    /// Delete a comment
    public func deleteComment(_ comment: ArticleComment) async throws {
        try store.deleteComment(id: comment.id)
        logger.info("Deleted comment: \(comment.id)")
    }

    // MARK: - Subscribers

    /// Get subscribers for a publication
    public func getSubscribers(publicationId: String) async throws -> [Subscriber] {
        return try store.getSubscribers(publicationId: publicationId)
    }

    /// Get subscriber count
    public func getSubscriberCount(publicationId: String) async throws -> Int {
        return try store.getSubscriberCount(publicationId: publicationId)
    }

    /// Add a subscriber
    public func addSubscriber(
        publicationId: String,
        pubkey: String,
        displayName: String? = nil,
        email: String? = nil
    ) async throws -> Subscriber {
        let subscriber = Subscriber(
            publicationId: publicationId,
            pubkey: pubkey,
            displayName: displayName,
            email: email
        )

        try store.saveSubscriber(subscriber)
        logger.info("Added subscriber: \(subscriber.id)")
        return subscriber
    }

    /// Remove a subscriber
    public func removeSubscriber(_ subscriber: Subscriber) async throws {
        try store.deleteSubscriber(id: subscriber.id)
        logger.info("Removed subscriber: \(subscriber.id)")
    }

    // MARK: - Subscription Tiers

    /// Get subscription tiers for a publication
    public func getSubscriptionTiers(publicationId: String) async throws -> [SubscriptionTier] {
        return try store.getSubscriptionTiers(publicationId: publicationId)
    }

    /// Create a subscription tier
    public func createSubscriptionTier(
        publicationId: String,
        name: String,
        description: String? = nil,
        priceMonthly: Int,
        priceYearly: Int? = nil,
        benefits: [String] = []
    ) async throws -> SubscriptionTier {
        let tier = SubscriptionTier(
            publicationId: publicationId,
            name: name,
            description: description,
            priceMonthly: priceMonthly,
            priceYearly: priceYearly,
            benefits: benefits
        )

        try store.saveSubscriptionTier(tier)
        logger.info("Created subscription tier: \(tier.id)")
        return tier
    }

    // MARK: - Drafts (Local)

    /// Save a local draft
    public func saveDraft(_ draft: ArticleDraft) async throws {
        var updated = draft
        updated.lastModified = Date()
        try store.saveDraft(updated)
    }

    /// Get all local drafts
    public func getDrafts() async throws -> [ArticleDraft] {
        return try store.getDrafts()
    }

    /// Delete a local draft
    public func deleteDraft(_ draft: ArticleDraft) async throws {
        try store.deleteDraft(id: draft.id)
    }

    // MARK: - Scheduled Publishing

    private func startScheduledPublishTimer() {
        // Check every minute for articles that should be published
        scheduledPublishTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.checkScheduledArticles()
            }
        }
    }

    private func checkScheduledArticles() async {
        do {
            let scheduledArticles = try store.getScheduledArticles()
            for article in scheduledArticles where article.shouldPublish {
                _ = try await publishArticle(article)
                logger.info("Auto-published scheduled article: \(article.id)")
            }
        } catch {
            logger.error("Failed to check scheduled articles: \(error)")
        }
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr publishing events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_ARTICLE:
            await handleArticleEvent(event)
        case Self.KIND_COMMENT:
            await handleCommentEvent(event)
        case Self.KIND_PUBLICATION:
            await handlePublicationEvent(event)
        default:
            break
        }
    }

    private func handleArticleEvent(_ event: NostrEvent) async {
        logger.debug("Received article event: \(event.id)")

        // Parse article from event content
        guard let data = event.content.data(using: .utf8),
              var article = try? JSONDecoder().decode(Article.self, from: data) else {
            logger.warning("Failed to parse article from event")
            return
        }

        // Update author pubkey from event
        let updatedArticle = Article(
            id: article.id,
            title: article.title,
            slug: article.slug,
            subtitle: article.subtitle,
            content: article.content,
            excerpt: article.excerpt,
            coverImage: article.coverImage,
            tags: article.tags,
            categories: article.categories,
            status: article.status,
            visibility: article.visibility,
            groupId: article.groupId,
            publishedAt: article.publishedAt,
            scheduledAt: article.scheduledAt,
            authorPubkey: event.pubkey,
            authorName: article.authorName,
            coauthors: article.coauthors,
            viewCount: article.viewCount,
            canonicalUrl: article.canonicalUrl,
            seo: article.seo,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt
        )

        do {
            try store.saveArticle(updatedArticle)
        } catch {
            logger.error("Failed to save article from event: \(error)")
        }
    }

    private func handleCommentEvent(_ event: NostrEvent) async {
        logger.debug("Received comment event: \(event.id)")

        guard let data = event.content.data(using: .utf8),
              let comment = try? JSONDecoder().decode(ArticleComment.self, from: data) else {
            logger.warning("Failed to parse comment from event")
            return
        }

        do {
            try store.saveComment(comment)
        } catch {
            logger.error("Failed to save comment from event: \(error)")
        }
    }

    private func handlePublicationEvent(_ event: NostrEvent) async {
        logger.debug("Received publication event: \(event.id)")

        guard let data = event.content.data(using: .utf8),
              let publication = try? JSONDecoder().decode(Publication.self, from: data) else {
            logger.warning("Failed to parse publication from event")
            return
        }

        do {
            try store.savePublication(publication)
        } catch {
            logger.error("Failed to save publication from event: \(error)")
        }
    }

    // MARK: - Nostr Publishing

    private func publishToNostr(_ article: Article) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970

        let content = try String(data: encoder.encode(article), encoding: .utf8) ?? ""

        let tags: [[String]] = [
            ["d", article.id],
            ["module", "publishing"],
            ["title", article.title],
            ["slug", article.slug]
        ]

        // Note: This would integrate with NostrClient to actually publish
        logger.info("Would publish article to Nostr with kind \(Self.KIND_ARTICLE)")
    }

    private func publishCommentToNostr(_ comment: ArticleComment) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970

        let content = try String(data: encoder.encode(comment), encoding: .utf8) ?? ""

        let tags: [[String]] = [
            ["e", comment.articleId],
            ["module", "publishing"]
        ]

        logger.info("Would publish comment to Nostr with kind \(Self.KIND_COMMENT)")
    }

    private func publishPublicationToNostr(_ publication: Publication) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970

        let content = try String(data: encoder.encode(publication), encoding: .utf8) ?? ""

        let tags: [[String]] = [
            ["d", publication.id],
            ["module", "publishing"],
            ["name", publication.name]
        ]

        logger.info("Would publish publication to Nostr with kind \(Self.KIND_PUBLICATION)")
    }
}

// MARK: - Errors

public enum PublishingError: LocalizedError {
    case invalidScheduleDate
    case articleNotFound
    case publicationNotFound
    case unauthorized
    case fetchFailed(String)
    case saveFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidScheduleDate:
            return "Schedule date must be in the future"
        case .articleNotFound:
            return "Article not found"
        case .publicationNotFound:
            return "Publication not found"
        case .unauthorized:
            return "You are not authorized to perform this action"
        case .fetchFailed(let reason):
            return "Failed to fetch: \(reason)"
        case .saveFailed(let reason):
            return "Failed to save: \(reason)"
        }
    }
}
