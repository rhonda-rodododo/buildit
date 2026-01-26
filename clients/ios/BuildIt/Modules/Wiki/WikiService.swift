// WikiService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for wiki operations.

import Foundation
import os.log

/// Service handling wiki business logic
@MainActor
public final class WikiService: ObservableObject {
    // MARK: - Nostr Event Kinds
    static let KIND_WIKI_PAGE = 40301
    static let KIND_WIKI_CATEGORY = 40302
    static let KIND_PAGE_REVISION = 40303

    // MARK: - Properties
    private let store: WikiStore
    private let logger = Logger(subsystem: "com.buildit", category: "WikiService")

    @Published public var pages: [WikiPage] = []
    @Published public var categories: [WikiCategory] = []
    @Published public var recentPages: [WikiPage] = []
    @Published public var isLoading = false

    // MARK: - Initialization

    public init(store: WikiStore) {
        self.store = store
    }

    // MARK: - Pages

    /// Get all published pages
    public func getPublishedPages(groupId: String? = nil, categoryId: String? = nil) async throws -> [WikiPage] {
        return try store.getPublishedPages(groupId: groupId, categoryId: categoryId)
    }

    /// Get a page by ID
    public func getPage(id: String) async throws -> WikiPage? {
        return try store.getPage(id: id)
    }

    /// Get a page by slug
    public func getPageBySlug(slug: String, groupId: String) async throws -> WikiPage? {
        return try store.getPageBySlug(slug: slug, groupId: groupId)
    }

    /// Get recently updated pages
    public func getRecentPages(limit: Int = 10) async throws -> [WikiPage] {
        return try store.getRecentPages(limit: limit)
    }

    /// Search pages
    public func searchPages(query: String, groupId: String? = nil) async throws -> [WikiSearchResult] {
        let pages = try store.searchPages(query: query, groupId: groupId)
        let lowercaseQuery = query.lowercased()

        return pages.map { page in
            // Create excerpt from content containing the query
            let excerpt = createExcerpt(from: page.content, matching: lowercaseQuery)

            // Simple scoring based on where match is found
            var score = 0.0
            if page.title.lowercased().contains(lowercaseQuery) { score += 10 }
            if page.summary?.lowercased().contains(lowercaseQuery) ?? false { score += 5 }
            if page.content.lowercased().contains(lowercaseQuery) { score += 1 }

            let matchedTags = page.tags.filter { $0.lowercased().contains(lowercaseQuery) }
            score += Double(matchedTags.count) * 3

            return WikiSearchResult(
                pageId: page.id,
                title: page.title,
                slug: page.slug,
                summary: page.summary,
                excerpt: excerpt,
                score: score,
                matchedTags: matchedTags,
                updatedAt: page.updatedAt
            )
        }.sorted { $0.score > $1.score }
    }

    private func createExcerpt(from content: String, matching query: String, contextLength: Int = 100) -> String? {
        guard let range = content.lowercased().range(of: query) else { return nil }

        let startIndex = content.index(range.lowerBound, offsetBy: -contextLength, limitedBy: content.startIndex) ?? content.startIndex
        let endIndex = content.index(range.upperBound, offsetBy: contextLength, limitedBy: content.endIndex) ?? content.endIndex

        var excerpt = String(content[startIndex..<endIndex])
        if startIndex != content.startIndex { excerpt = "..." + excerpt }
        if endIndex != content.endIndex { excerpt = excerpt + "..." }

        return excerpt
    }

    /// Refresh pages list
    public func refreshPages(groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            pages = try store.getPublishedPages(groupId: groupId)
            recentPages = try store.getRecentPages(limit: 5)
        } catch {
            logger.error("Failed to refresh pages: \(error)")
        }
    }

    // MARK: - Categories

    /// Get all categories
    public func getCategories(groupId: String) async throws -> [WikiCategory] {
        return try store.getCategories(groupId: groupId)
    }

    /// Refresh categories
    public func refreshCategories(groupId: String) async {
        do {
            categories = try store.getCategories(groupId: groupId)
        } catch {
            logger.error("Failed to refresh categories: \(error)")
        }
    }

    // MARK: - Revisions

    /// Get revision history for a page
    public func getRevisions(pageId: String) async throws -> [PageRevision] {
        return try store.getRevisions(pageId: pageId)
    }

    // MARK: - Table of Contents

    /// Extract table of contents from markdown content
    public func extractTableOfContents(from content: String) -> [TableOfContentsEntry] {
        var entries: [TableOfContentsEntry] = []
        let lines = content.components(separatedBy: .newlines)

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Check for markdown headers
            if trimmed.hasPrefix("#") {
                var level = 0
                var title = trimmed

                while title.hasPrefix("#") {
                    level += 1
                    title = String(title.dropFirst())
                }

                title = title.trimmingCharacters(in: .whitespaces)

                if !title.isEmpty && level >= 1 && level <= 6 {
                    let anchor = title
                        .lowercased()
                        .replacingOccurrences(of: " ", with: "-")
                        .filter { $0.isLetter || $0.isNumber || $0 == "-" }

                    entries.append(TableOfContentsEntry(
                        title: title,
                        level: level,
                        anchor: anchor
                    ))
                }
            }
        }

        return entries
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr wiki events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_WIKI_PAGE:
            await handlePageEvent(event)
        case Self.KIND_WIKI_CATEGORY:
            await handleCategoryEvent(event)
        case Self.KIND_PAGE_REVISION:
            await handleRevisionEvent(event)
        default:
            break
        }
    }

    private func handlePageEvent(_ event: NostrEvent) async {
        logger.debug("Received wiki page event: \(event.id)")
    }

    private func handleCategoryEvent(_ event: NostrEvent) async {
        logger.debug("Received wiki category event: \(event.id)")
    }

    private func handleRevisionEvent(_ event: NostrEvent) async {
        logger.debug("Received page revision event: \(event.id)")
    }
}
