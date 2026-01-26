// PublishingModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Publishing module for blogs, articles, and long-form content.

import Foundation
import SwiftUI
import os.log

/// Publishing module implementation
@MainActor
public final class PublishingModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "publishing"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: PublishingStore
    private let service: PublishingService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "PublishingModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try PublishingStore()
        self.service = PublishingService(store: store)
        logger.info("Publishing module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Publishing module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Publishing module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route publishing-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "publishing",
                title: "Publishing",
                icon: "doc.richtext",
                order: 40
            ) {
                ArticlesListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Publishing module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Publishing module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Publishing module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Get the publishing service
    public func getService() -> PublishingService {
        return service
    }

    /// Create a new article
    public func createArticle(
        title: String,
        content: String,
        authorPubkey: String,
        authorName: String? = nil,
        groupId: String? = nil
    ) async throws -> Article {
        return try await service.createArticle(
            title: title,
            content: content,
            authorPubkey: authorPubkey,
            authorName: authorName,
            groupId: groupId
        )
    }

    /// Get article by ID
    public func getArticle(id: String) async throws -> Article? {
        return try await service.getArticle(id: id)
    }

    /// Get article by slug
    public func getArticleBySlug(slug: String, groupId: String? = nil) async throws -> Article? {
        return try await service.getArticleBySlug(slug: slug, groupId: groupId)
    }

    /// Get published articles
    public func getPublishedArticles(groupId: String? = nil, limit: Int? = nil) async throws -> [Article] {
        return try await service.getPublishedArticles(groupId: groupId, limit: limit)
    }

    /// Search articles
    public func searchArticles(query: String, groupId: String? = nil) async throws -> [Article] {
        return try await service.searchArticles(query: query, groupId: groupId)
    }

    /// Publish an article
    public func publishArticle(_ article: Article) async throws -> Article {
        return try await service.publishArticle(article)
    }

    /// Schedule an article
    public func scheduleArticle(_ article: Article, publishAt: Date) async throws -> Article {
        return try await service.scheduleArticle(article, publishAt: publishAt)
    }

    /// Archive an article
    public func archiveArticle(_ article: Article) async throws -> Article {
        return try await service.archiveArticle(article)
    }

    /// Create a publication
    public func createPublication(
        name: String,
        description: String? = nil,
        ownerPubkey: String,
        groupId: String? = nil
    ) async throws -> Publication {
        return try await service.createPublication(
            name: name,
            description: description,
            ownerPubkey: ownerPubkey,
            groupId: groupId
        )
    }

    /// Get publication by ID
    public func getPublication(id: String) async throws -> Publication? {
        return try await service.getPublication(id: id)
    }

    /// Get publications
    public func getPublications(ownerPubkey: String? = nil) async throws -> [Publication] {
        await service.refreshPublications(ownerPubkey: ownerPubkey)
        return service.publications
    }

    /// Generate RSS feed
    public func generateRSS(
        for publication: Publication,
        articles: [Article],
        baseUrl: String
    ) -> String {
        return service.generateRSS(for: publication, articles: articles, baseUrl: baseUrl)
    }

    /// Get subscribers for a publication
    public func getSubscribers(publicationId: String) async throws -> [Subscriber] {
        return try await service.getSubscribers(publicationId: publicationId)
    }

    /// Get subscriber count
    public func getSubscriberCount(publicationId: String) async throws -> Int {
        return try await service.getSubscriberCount(publicationId: publicationId)
    }
}
