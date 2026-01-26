// WikiModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Wiki module for collaborative knowledge base.

import Foundation
import SwiftUI
import os.log

/// Wiki module implementation
@MainActor
public final class WikiModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "wiki"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: WikiStore
    private let service: WikiService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "WikiModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try WikiStore()
        self.service = WikiService(store: store)
        logger.info("Wiki module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Wiki module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Wiki module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route wiki-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "wiki",
                title: "Knowledge Base",
                icon: "books.vertical",
                order: 35
            ) {
                WikiListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Wiki module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Wiki module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Wiki module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Get all published pages
    public func getPages(groupId: String? = nil, categoryId: String? = nil) async throws -> [WikiPage] {
        return try await service.getPublishedPages(groupId: groupId, categoryId: categoryId)
    }

    /// Get a page by ID
    public func getPage(id: String) async throws -> WikiPage? {
        return try await service.getPage(id: id)
    }

    /// Get a page by slug
    public func getPageBySlug(slug: String, groupId: String) async throws -> WikiPage? {
        return try await service.getPageBySlug(slug: slug, groupId: groupId)
    }

    /// Search pages
    public func searchPages(query: String, groupId: String? = nil) async throws -> [WikiSearchResult] {
        return try await service.searchPages(query: query, groupId: groupId)
    }

    /// Get categories
    public func getCategories(groupId: String) async throws -> [WikiCategory] {
        return try await service.getCategories(groupId: groupId)
    }

    /// Get revision history
    public func getRevisions(pageId: String) async throws -> [PageRevision] {
        return try await service.getRevisions(pageId: pageId)
    }
}
