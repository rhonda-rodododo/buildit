// SearchViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// Observable view model for the search UI.
// Manages search state, debouncing, and result formatting.

import Foundation
import Combine
import SwiftUI
import os.log

// MARK: - SearchState

/// Current state of the search
public enum SearchState: Equatable {
    case idle
    case searching
    case results
    case empty
    case error(String)
}

// MARK: - SearchViewModel

/// Observable view model for search functionality
@MainActor
@Observable
public final class SearchViewModel {
    // MARK: - Published Properties

    /// Current search query
    public var query: String = "" {
        didSet {
            if query != oldValue {
                debouncedSearch()
            }
        }
    }

    /// Current search scope
    public var scope: SearchScope = .global

    /// Active facet filters
    public var filters: FacetFilters = FacetFilters()

    /// Search options
    public var options: SearchOptions = .default

    /// Formatted search results
    public private(set) var results: [FormattedSearchResult] = []

    /// Total result count
    public private(set) var totalCount: Int = 0

    /// Facet counts for filtering UI
    public private(set) var facetCounts: FacetCounts?

    /// Current search state
    public private(set) var state: SearchState = .idle

    /// Search suggestions
    public private(set) var suggestions: [String] = []

    /// Recent searches
    public private(set) var recentSearches: [RecentSearch] = []

    /// Saved searches
    public private(set) var savedSearches: [SavedSearch] = []

    /// Last search time in milliseconds
    public private(set) var searchTimeMs: Double = 0

    /// Whether filters are visible
    public var showFilters: Bool = false

    // MARK: - Private Properties

    private let coordinator: SearchCoordinator
    private let providerRegistry: SearchProviderRegistry
    private let logger = Logger(subsystem: "com.buildit", category: "SearchViewModel")

    private var searchTask: Task<Void, Never>?
    private var suggestionsTask: Task<Void, Never>?
    private let debounceDelay: TimeInterval = 0.3

    // MARK: - Initialization

    public init(
        coordinator: SearchCoordinator? = nil,
        providerRegistry: SearchProviderRegistry? = nil
    ) {
        self.coordinator = coordinator ?? SearchCoordinator()
        self.providerRegistry = providerRegistry ?? SearchProviderRegistry.shared

        Task {
            await initializeCoordinator()
        }
    }

    /// Initialize the search coordinator
    private func initializeCoordinator() async {
        do {
            try await coordinator.initialize()
            await loadRecentAndSavedSearches()
        } catch {
            logger.error("Failed to initialize search coordinator: \(error.localizedDescription)")
            state = .error(error.localizedDescription)
        }
    }

    // MARK: - Public API

    /// Perform a search with the current query and options
    public func search() {
        searchTask?.cancel()

        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            results = []
            totalCount = 0
            state = .idle
            return
        }

        state = .searching

        searchTask = Task {
            do {
                let searchResults = try await coordinator.search(
                    query: query,
                    scope: scope,
                    filters: filters.isEmpty ? nil : filters,
                    options: options
                )

                if Task.isCancelled { return }

                await MainActor.run {
                    self.totalCount = searchResults.totalCount
                    self.facetCounts = searchResults.facetCounts
                    self.searchTimeMs = searchResults.searchTimeMs
                    self.state = searchResults.results.isEmpty ? .empty : .results
                }

                // Format results using providers
                let formatted = await formatResults(searchResults.results)

                if Task.isCancelled { return }

                await MainActor.run {
                    self.results = formatted
                }

                // Refresh recent searches
                await loadRecentAndSavedSearches()

            } catch {
                if Task.isCancelled { return }

                await MainActor.run {
                    self.state = .error(error.localizedDescription)
                    self.logger.error("Search failed: \(error.localizedDescription)")
                }
            }
        }
    }

    /// Load more results (pagination)
    public func loadMore() {
        guard state == .results, results.count < totalCount else { return }

        let currentCount = results.count
        options.offset = currentCount

        Task {
            do {
                let searchResults = try await coordinator.search(
                    query: query,
                    scope: scope,
                    filters: filters.isEmpty ? nil : filters,
                    options: options
                )

                let formatted = await formatResults(searchResults.results)

                await MainActor.run {
                    self.results.append(contentsOf: formatted)
                }
            } catch {
                logger.error("Load more failed: \(error.localizedDescription)")
            }
        }
    }

    /// Clear the current search
    public func clear() {
        query = ""
        results = []
        totalCount = 0
        facetCounts = nil
        state = .idle
        filters = FacetFilters()
        options = .default
    }

    /// Save the current search
    public func saveCurrentSearch(name: String) async throws {
        guard !query.isEmpty else { return }

        // Get current user pubkey
        let userPubkey = "current_user" // Replace with actual user pubkey

        let savedSearch = SavedSearch(
            userPubkey: userPubkey,
            name: name,
            query: query,
            scope: scope,
            filters: filters.isEmpty ? nil : filters
        )

        try await coordinator.saveSearch(savedSearch)
        await loadRecentAndSavedSearches()

        logger.info("Saved search: \(name)")
    }

    /// Execute a saved search
    public func executeSavedSearch(_ saved: SavedSearch) {
        query = saved.query
        scope = saved.scope
        if let savedFilters = saved.filters {
            filters = savedFilters
        }
        search()
    }

    /// Execute a recent search
    public func executeRecentSearch(_ recent: RecentSearch) {
        query = recent.query
        scope = recent.scope
        search()
    }

    /// Update suggestions for the current query
    public func updateSuggestions() {
        suggestionsTask?.cancel()

        guard !query.isEmpty else {
            suggestions = []
            return
        }

        suggestionsTask = Task {
            do {
                let newSuggestions = try await coordinator.getSuggestions(for: query)

                if Task.isCancelled { return }

                await MainActor.run {
                    self.suggestions = newSuggestions
                }
            } catch {
                logger.error("Failed to get suggestions: \(error.localizedDescription)")
            }
        }
    }

    /// Toggle a module type filter
    public func toggleModuleFilter(_ moduleType: String) {
        var moduleTypes = filters.moduleTypes ?? []
        if let index = moduleTypes.firstIndex(of: moduleType) {
            moduleTypes.remove(at: index)
        } else {
            moduleTypes.append(moduleType)
        }
        filters.moduleTypes = moduleTypes.isEmpty ? nil : moduleTypes
        search()
    }

    /// Toggle a tag filter
    public func toggleTagFilter(_ tag: String) {
        var tags = filters.tags ?? []
        if let index = tags.firstIndex(of: tag) {
            tags.remove(at: index)
        } else {
            tags.append(tag)
        }
        filters.tags = tags.isEmpty ? nil : tags
        search()
    }

    /// Set date range filter
    public func setDateRangeFilter(start: Date?, end: Date?) {
        if let start = start, let end = end {
            filters.dateRange = DateRangeFilter(start: start, end: end)
        } else {
            filters.dateRange = nil
        }
        search()
    }

    /// Clear all filters
    public func clearFilters() {
        filters = FacetFilters()
        search()
    }

    /// Get available module types for filtering
    public func getAvailableModuleTypes() async -> [String] {
        await providerRegistry.getRegisteredModuleTypes()
    }

    // MARK: - Private Methods

    /// Debounced search trigger
    private func debouncedSearch() {
        searchTask?.cancel()

        searchTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(debounceDelay * 1_000_000_000))

            if Task.isCancelled { return }

            await MainActor.run {
                self.search()
            }
        }
    }

    /// Load recent and saved searches
    private func loadRecentAndSavedSearches() async {
        do {
            let recent = try await coordinator.getRecentSearches(limit: 10)
            let saved = try await coordinator.getSavedSearches()

            await MainActor.run {
                self.recentSearches = recent
                self.savedSearches = saved
            }
        } catch {
            logger.error("Failed to load recent/saved searches: \(error.localizedDescription)")
        }
    }

    /// Format search results using providers
    private func formatResults(_ results: [SearchResult]) async -> [FormattedSearchResult] {
        var formatted: [FormattedSearchResult] = []

        for result in results {
            if let provider = await providerRegistry.getProvider(for: result.document.moduleType) {
                let formattedResult = await provider.formatResult(result)
                formatted.append(formattedResult)
            } else {
                // Default formatting
                formatted.append(defaultFormatResult(result))
            }
        }

        return formatted
    }

    /// Default result formatting when no provider is available
    private func defaultFormatResult(_ result: SearchResult) -> FormattedSearchResult {
        FormattedSearchResult(
            id: result.document.id,
            title: result.document.title,
            excerpt: result.highlightedExcerpt ?? result.document.excerpt ?? String(result.document.content.prefix(150)),
            moduleType: result.document.moduleType,
            moduleIcon: getDefaultModuleIcon(result.document.moduleType),
            groupId: result.document.groupId,
            score: result.score,
            matchedTerms: result.matchedTerms,
            createdAt: Date(timeIntervalSince1970: Double(result.document.createdAt) / 1000),
            entityId: result.document.entityId
        )
    }

    /// Get default icon for a module type
    private func getDefaultModuleIcon(_ moduleType: String) -> String {
        switch moduleType {
        case "events":
            return "calendar"
        case "messaging", "messages":
            return "message"
        case "documents":
            return "doc.text"
        case "wiki":
            return "book"
        case "governance":
            return "checkmark.seal"
        case "mutual-aid", "mutualaid":
            return "hands.sparkles"
        case "fundraising":
            return "dollarsign.circle"
        case "forms":
            return "list.bullet.clipboard"
        case "contacts", "crm":
            return "person.crop.circle"
        default:
            return "magnifyingglass"
        }
    }
}

// MARK: - Convenience Extensions

extension SearchViewModel {
    /// Check if there are active filters
    public var hasActiveFilters: Bool {
        !filters.isEmpty
    }

    /// Number of active filters
    public var activeFilterCount: Int {
        var count = 0
        if let types = filters.moduleTypes { count += types.count }
        if let groups = filters.groupIds { count += groups.count }
        if let tags = filters.tags { count += tags.count }
        if filters.dateRange != nil { count += 1 }
        if let authors = filters.authors { count += authors.count }
        return count
    }

    /// Get scope display name
    public var scopeDisplayName: String {
        switch scope {
        case .global:
            return "Everywhere"
        case .group(let groupId):
            return "Group: \(groupId)"
        case .module(let moduleType):
            return "Module: \(moduleType)"
        case .moduleInGroup(let moduleType, let groupId):
            return "\(moduleType) in \(groupId)"
        }
    }
}
