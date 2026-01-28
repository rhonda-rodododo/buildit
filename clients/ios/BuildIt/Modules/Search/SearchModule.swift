// SearchModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Search module for client-side full-text search with semantic capabilities.
// All search operations are local - no server-side indexing.
// Content is encrypted at rest, only decrypted for local indexing.

import Foundation
import SwiftUI
import os.log

/// Search module implementation
@MainActor
public final class SearchModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "search"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let coordinator: SearchCoordinator
    private let providerRegistry: SearchProviderRegistry
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "SearchModule")

    /// Shared instance for access from other modules
    public static var shared: SearchModule?

    // MARK: - Initialization

    public init() throws {
        self.coordinator = SearchCoordinator()
        self.providerRegistry = SearchProviderRegistry.shared
        Self.shared = self
        logger.info("Search module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Search module")

        try await coordinator.initialize()

        // Enable by default for global scope
        try await enable(for: nil)

        // Register default providers
        await registerDefaultProviders()

        logger.info("Search module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Search module doesn't directly handle Nostr events
        // Content is indexed through providers when modules update their content
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "search-main",
                title: "Search",
                icon: "magnifyingglass",
                order: 5
            ) {
                SearchView()
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Search module")
        await coordinator.shutdown()
    }

    public func isEnabled(for groupId: String?) -> Bool {
        // Search is always enabled globally
        true
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Search module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        // Search cannot be disabled globally
        if groupId != nil {
            configManager.disableModule(Self.identifier, for: groupId)
            logger.info("Disabled Search module for group: \(groupId ?? "global")")
        }
    }

    // MARK: - Public API

    /// Get the search coordinator for direct access
    public var searchCoordinator: SearchCoordinator {
        coordinator
    }

    /// Register a search provider for a module
    /// - Parameter provider: The search provider to register
    public func registerProvider(_ provider: any SearchProvider) async {
        await providerRegistry.register(provider)
        logger.info("Registered search provider for module: \(provider.moduleType)")
    }

    /// Unregister a search provider
    /// - Parameter moduleType: The module type to unregister
    public func unregisterProvider(_ moduleType: String) async {
        await providerRegistry.unregister(moduleType)
        logger.info("Unregistered search provider for module: \(moduleType)")
    }

    /// Index an entity from a module
    /// - Parameters:
    ///   - entity: The entity to index
    ///   - moduleType: The module type
    ///   - groupId: The group this entity belongs to
    public func indexEntity(_ entity: Any, moduleType: String, groupId: String) async throws {
        try await coordinator.indexEntity(entity, moduleType: moduleType, groupId: groupId)
    }

    /// Remove an entity from the index
    /// - Parameters:
    ///   - entityId: The entity ID
    ///   - moduleType: The module type
    public func removeEntity(entityId: String, moduleType: String) async throws {
        try await coordinator.removeEntity(entityId: entityId, moduleType: moduleType)
    }

    /// Perform a full reindex
    /// - Parameter groupId: Optional group to reindex
    public func fullReindex(groupId: String? = nil) async throws {
        try await coordinator.fullReindex(groupId: groupId)
    }

    /// Get search statistics
    public func getStats() async throws -> IndexStats {
        try await coordinator.getStats()
    }

    // MARK: - Private Methods

    /// Register default search providers
    private func registerDefaultProviders() async {
        // Register a placeholder provider for common module types
        // In production, each module would register its own provider

        let defaultModules = ["events", "documents", "messaging", "wiki", "governance", "mutual-aid"]

        for moduleType in defaultModules {
            let provider = DefaultSearchProvider(moduleType: moduleType)
            await providerRegistry.register(provider)
        }

        logger.info("Registered default search providers")
    }
}

// MARK: - Default Search Provider

/// Default search provider for modules that haven't registered their own
private struct DefaultSearchProvider: SearchProvider {
    let moduleType: String

    var moduleIcon: String {
        switch moduleType {
        case "events": return "calendar"
        case "messaging", "messages": return "message"
        case "documents": return "doc.text"
        case "wiki": return "book"
        case "governance": return "checkmark.seal"
        case "mutual-aid", "mutualaid": return "hands.sparkles"
        case "fundraising": return "dollarsign.circle"
        case "forms": return "list.bullet.clipboard"
        case "contacts", "crm": return "person.crop.circle"
        default: return "square.grid.2x2"
        }
    }

    func indexEntity(_ entity: Any, groupId: String) async -> SearchDocument? {
        // Default implementation - returns nil
        // Each module should implement its own provider
        nil
    }

    func getFacetDefinitions() -> [FacetDefinition] {
        // Default facets for all modules
        [
            FacetDefinition(key: "date", label: "Date", type: .date, multiSelect: false),
            FacetDefinition(key: "author", label: "Author", type: .keyword, multiSelect: true)
        ]
    }

    func formatResult(_ result: SearchResult) async -> FormattedSearchResult {
        FormattedSearchResult(
            id: result.document.id,
            title: result.document.title,
            excerpt: result.highlightedExcerpt ?? result.document.excerpt ?? String(result.document.content.prefix(150)),
            moduleType: result.document.moduleType,
            moduleIcon: moduleIcon,
            groupId: result.document.groupId,
            score: result.score,
            matchedTerms: result.matchedTerms,
            createdAt: Date(timeIntervalSince1970: Double(result.document.createdAt) / 1000),
            entityId: result.document.entityId
        )
    }

    func getIndexableEntities(groupId: String) async -> [Any] {
        // Default implementation - returns empty
        []
    }

    func getEntitiesUpdatedSince(_ timestamp: Int64, groupId: String) async -> [Any] {
        []
    }
}

// MARK: - Module Configuration

extension SearchModule {
    /// Search module configuration
    public struct Configuration {
        /// Enable semantic search (TF-IDF)
        public var semanticSearchEnabled: Bool = true

        /// Semantic search weight (0-1)
        public var semanticWeight: Double = 0.3

        /// Enable fuzzy matching
        public var fuzzyMatchingEnabled: Bool = true

        /// Fuzzy match threshold
        public var fuzzyThreshold: Double = 0.8

        /// Enable concept expansion
        public var conceptExpansionEnabled: Bool = true

        /// Maximum search results
        public var maxResults: Int = 100

        /// Background indexing interval (seconds)
        public var indexingInterval: TimeInterval = 300

        public init() {}
    }
}

// MARK: - Events Search Provider Example

/// Example of how a module would implement its search provider
public struct EventsSearchProvider: SearchProvider {
    public let moduleType = "events"
    public let moduleIcon = "calendar"

    public init() {}

    public func indexEntity(_ entity: Any, groupId: String) async -> SearchDocument? {
        // In production, cast entity to Event type and extract fields
        guard let eventDict = entity as? [String: Any],
              let id = eventDict["id"] as? String,
              let title = eventDict["title"] as? String,
              let description = eventDict["description"] as? String else {
            return nil
        }

        let createdAt = (eventDict["createdAt"] as? Int64) ?? Int64(Date().timeIntervalSince1970 * 1000)
        let updatedAt = (eventDict["updatedAt"] as? Int64) ?? createdAt

        return SearchDocument(
            moduleType: moduleType,
            entityId: id,
            groupId: groupId,
            title: title,
            content: description,
            tags: eventDict["tags"] as? [String],
            excerpt: String(description.prefix(200)),
            authorPubkey: eventDict["createdBy"] as? String,
            facets: [
                "eventType": .string("meeting"),
                "hasRSVP": .boolean(true)
            ],
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    public func getFacetDefinitions() -> [FacetDefinition] {
        [
            FacetDefinition(key: "eventType", label: "Event Type", type: .keyword, multiSelect: true),
            FacetDefinition(key: "hasRSVP", label: "Has RSVP", type: .boolean, multiSelect: false),
            FacetDefinition(key: "date", label: "Event Date", type: .date, multiSelect: false),
            FacetDefinition(key: "location", label: "Location", type: .keyword, multiSelect: true)
        ]
    }

    public func formatResult(_ result: SearchResult) async -> FormattedSearchResult {
        // Extract event-specific formatting
        let eventDate = Date(timeIntervalSince1970: Double(result.document.createdAt) / 1000)

        return FormattedSearchResult(
            id: result.document.id,
            title: result.document.title,
            excerpt: result.highlightedExcerpt ?? result.document.excerpt ?? "",
            moduleType: moduleType,
            moduleIcon: moduleIcon,
            groupId: result.document.groupId,
            score: result.score,
            matchedTerms: result.matchedTerms,
            createdAt: eventDate,
            entityId: result.document.entityId
        )
    }

    public func getIndexableEntities(groupId: String) async -> [Any] {
        // In production, fetch events from EventsStore
        []
    }
}
