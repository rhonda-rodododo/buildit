// SearchCoordinator.swift
// BuildIt - Decentralized Mesh Communication
//
// Main orchestrator for search operations.
// Thread-safe Swift Actor for coordinating indexing and search.

import Foundation
import Combine
import os.log

// MARK: - SearchCoordinatorError

/// Errors that can occur during search operations
public enum SearchCoordinatorError: LocalizedError {
    case notInitialized
    case indexingFailed(String)
    case searchFailed(String)
    case providerNotFound(String)
    case databaseError(String)

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Search coordinator not initialized"
        case .indexingFailed(let message):
            return "Indexing failed: \(message)"
        case .searchFailed(let message):
            return "Search failed: \(message)"
        case .providerNotFound(let moduleType):
            return "Search provider not found for module: \(moduleType)"
        case .databaseError(let message):
            return "Database error: \(message)"
        }
    }
}

// MARK: - SearchCoordinator

/// Main coordinator for search operations
/// Thread-safe actor that orchestrates indexing and search
public actor SearchCoordinator {
    // MARK: - Properties

    private let database: SearchDatabase
    private let queryParser: QueryParser
    private let tfidfEngine: TFIDFEngine
    private let providerRegistry: SearchProviderRegistry
    private let logger = Logger(subsystem: "com.buildit", category: "SearchCoordinator")

    private var isInitialized = false
    private var isIndexing = false
    private var lastIndexTime: Date?

    /// Current indexing progress (0-1)
    private var indexingProgress: Double = 0

    /// Background indexing task
    private var backgroundIndexTask: Task<Void, Never>?

    // MARK: - Initialization

    public init(
        database: SearchDatabase? = nil,
        providerRegistry: SearchProviderRegistry? = nil
    ) {
        self.database = database ?? SearchDatabase()
        self.queryParser = QueryParser()
        self.tfidfEngine = TFIDFEngine()
        self.providerRegistry = providerRegistry ?? SearchProviderRegistry.shared
    }

    // MARK: - Lifecycle

    /// Initialize the search coordinator
    public func initialize() async throws {
        guard !isInitialized else { return }

        do {
            try await database.open()
            isInitialized = true
            logger.info("Search coordinator initialized")

            // Start background indexing
            startBackgroundIndexing()
        } catch {
            logger.error("Failed to initialize search coordinator: \(error.localizedDescription)")
            throw SearchCoordinatorError.databaseError(error.localizedDescription)
        }
    }

    /// Shutdown the search coordinator
    public func shutdown() async {
        backgroundIndexTask?.cancel()
        backgroundIndexTask = nil
        await database.close()
        isInitialized = false
        logger.info("Search coordinator shutdown")
    }

    // MARK: - Search Operations

    /// Perform a search
    /// - Parameters:
    ///   - query: The search query string
    ///   - scope: Search scope
    ///   - filters: Optional facet filters
    ///   - options: Search options
    /// - Returns: Search results
    public func search(
        query: String,
        scope: SearchScope = .global,
        filters: FacetFilters? = nil,
        options: SearchOptions = .default
    ) async throws -> SearchResults {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        let startTime = Date()

        // Parse the query
        let parsedQuery = queryParser.parse(query, scope: scope)

        do {
            // Execute database search
            let (documents, totalCount) = try await database.search(
                query: query,
                scope: scope,
                filters: filters,
                options: options
            )

            // Convert to SearchResults
            var results = documents.enumerated().map { index, doc in
                SearchResult(
                    document: doc,
                    score: 1.0 - Double(index) * 0.01, // Approximate score from FTS ranking
                    matchedTerms: parsedQuery.keywords,
                    matchedFields: determineMatchedFields(doc, query: parsedQuery),
                    highlightedExcerpt: options.highlight ? highlightExcerpt(doc, query: parsedQuery) : nil
                )
            }

            // Apply semantic re-ranking if enabled
            if options.semantic && !results.isEmpty {
                results = await tfidfEngine.rerank(
                    results: results,
                    query: parsedQuery,
                    semanticWeight: options.semanticWeight
                )
            }

            // Calculate facet counts
            let facetCounts = calculateFacetCounts(from: documents)

            let searchTimeMs = Date().timeIntervalSince(startTime) * 1000

            // Record search in history
            if let userPubkey = await getCurrentUserPubkey(), !query.isEmpty {
                let recentSearch = RecentSearch(
                    userPubkey: userPubkey,
                    query: query,
                    scope: scope,
                    resultCount: totalCount
                )
                try? await database.addRecentSearch(recentSearch)
            }

            logger.info("Search completed: '\(query)' -> \(totalCount) results in \(searchTimeMs)ms")

            return SearchResults(
                results: results,
                totalCount: totalCount,
                searchTimeMs: searchTimeMs,
                query: parsedQuery,
                facetCounts: facetCounts
            )
        } catch {
            logger.error("Search failed: \(error.localizedDescription)")
            throw SearchCoordinatorError.searchFailed(error.localizedDescription)
        }
    }

    /// Get search suggestions for partial query
    /// - Parameter prefix: Partial query string
    /// - Returns: Array of suggestions
    public func getSuggestions(for prefix: String) async throws -> [String] {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard let userPubkey = await getCurrentUserPubkey() else {
            return []
        }

        let recentSearches = try await database.getRecentSearches(userPubkey: userPubkey)
        let savedSearches = try await database.getSavedSearches(userPubkey: userPubkey)

        let suggester = QuerySuggester(
            recentSearches: recentSearches,
            savedSearches: savedSearches
        )

        return suggester.suggest(for: prefix)
    }

    // MARK: - Indexing Operations

    /// Index a single entity from a module
    /// - Parameters:
    ///   - entity: The entity to index
    ///   - moduleType: The module type
    ///   - groupId: The group this entity belongs to
    public func indexEntity(_ entity: Any, moduleType: String, groupId: String) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard let provider = await providerRegistry.getProvider(for: moduleType) else {
            throw SearchCoordinatorError.providerNotFound(moduleType)
        }

        if let document = await provider.indexEntity(entity, groupId: groupId) {
            // Calculate TF-IDF vector
            var documentWithVector = document
            documentWithVector.vector = await tfidfEngine.vectorize(document)

            try await database.indexDocument(documentWithVector)
            await tfidfEngine.addDocument(documentWithVector)

            logger.debug("Indexed entity: \(document.id)")
        }
    }

    /// Remove an entity from the index
    /// - Parameters:
    ///   - entityId: The entity ID
    ///   - moduleType: The module type
    public func removeEntity(entityId: String, moduleType: String) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        let documentId = "\(moduleType):\(entityId)"
        try await database.deleteDocument(id: documentId)

        logger.debug("Removed entity from index: \(documentId)")
    }

    /// Perform a full reindex of all content
    /// - Parameter groupId: Optional group to reindex (nil for all groups)
    public func fullReindex(groupId: String? = nil) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard !isIndexing else {
            logger.warning("Indexing already in progress")
            return
        }

        isIndexing = true
        indexingProgress = 0
        defer { isIndexing = false }

        logger.info("Starting full reindex...")

        let providers = await providerRegistry.getEnabledProviders()
        var allDocuments: [SearchDocument] = []

        for (providerIndex, provider) in providers.enumerated() {
            let groups = groupId != nil ? [groupId!] : await getAccessibleGroupIds()

            for (groupIndex, gid) in groups.enumerated() {
                let entities = await provider.getIndexableEntities(groupId: gid)

                for entity in entities {
                    if let document = await provider.indexEntity(entity, groupId: gid) {
                        var docWithVector = document
                        docWithVector.vector = await tfidfEngine.vectorize(document)
                        allDocuments.append(docWithVector)

                        try await database.indexDocument(docWithVector)
                    }
                }

                // Update progress
                let totalSteps = Double(providers.count * groups.count)
                let currentStep = Double(providerIndex * groups.count + groupIndex + 1)
                indexingProgress = currentStep / totalSteps
            }
        }

        // Rebuild TF-IDF corpus
        await tfidfEngine.rebuildCorpus(from: allDocuments)

        lastIndexTime = Date()
        logger.info("Full reindex completed: \(allDocuments.count) documents indexed")
    }

    /// Perform incremental index update
    /// - Parameter since: Index entities updated since this timestamp
    public func incrementalUpdate(since: Int64) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard !isIndexing else {
            logger.warning("Indexing already in progress")
            return
        }

        isIndexing = true
        defer { isIndexing = false }

        logger.info("Starting incremental update since \(since)...")

        let providers = await providerRegistry.getEnabledProviders()
        var updatedCount = 0

        for provider in providers {
            let groups = await getAccessibleGroupIds()

            for gid in groups {
                let entities = await provider.getEntitiesUpdatedSince(since, groupId: gid)

                for entity in entities {
                    if let document = await provider.indexEntity(entity, groupId: gid) {
                        var docWithVector = document
                        docWithVector.vector = await tfidfEngine.vectorize(document)

                        try await database.indexDocument(docWithVector)
                        updatedCount += 1
                    }
                }
            }
        }

        lastIndexTime = Date()
        logger.info("Incremental update completed: \(updatedCount) documents updated")
    }

    // MARK: - Background Indexing

    /// Start background indexing task
    private func startBackgroundIndexing() {
        backgroundIndexTask?.cancel()
        backgroundIndexTask = Task.detached(priority: .utility) { [weak self] in
            await self?.backgroundIndexLoop()
        }
    }

    /// Background indexing loop
    private func backgroundIndexLoop() async {
        // Wait for initial delay
        try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds

        while !Task.isCancelled {
            // Perform incremental update every 5 minutes
            let fiveMinutesAgo = Int64((Date().timeIntervalSince1970 - 300) * 1000)
            try? await incrementalUpdate(since: fiveMinutesAgo)

            // Sleep for 5 minutes
            try? await Task.sleep(nanoseconds: 300_000_000_000)
        }
    }

    // MARK: - Tag Operations

    /// Get tags for a group
    public func getTags(groupId: String) async throws -> [Tag] {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }
        return try await database.getTags(groupId: groupId)
    }

    /// Create a new tag
    public func createTag(_ tag: Tag) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }
        try await database.saveTag(tag)
    }

    // MARK: - Saved Search Operations

    /// Get saved searches for current user
    public func getSavedSearches() async throws -> [SavedSearch] {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard let userPubkey = await getCurrentUserPubkey() else {
            return []
        }

        return try await database.getSavedSearches(userPubkey: userPubkey)
    }

    /// Save a search
    public func saveSearch(_ search: SavedSearch) async throws {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }
        try await database.saveSavedSearch(search)
    }

    /// Get recent searches for current user
    public func getRecentSearches(limit: Int = 20) async throws -> [RecentSearch] {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        guard let userPubkey = await getCurrentUserPubkey() else {
            return []
        }

        return try await database.getRecentSearches(userPubkey: userPubkey, limit: limit)
    }

    // MARK: - Statistics

    /// Get index statistics
    public func getStats() async throws -> IndexStats {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }
        return try await database.getStats()
    }

    /// Get current indexing progress (0-1)
    public func getIndexingProgress() -> Double {
        return indexingProgress
    }

    /// Check if indexing is in progress
    public func isCurrentlyIndexing() -> Bool {
        return isIndexing
    }

    // MARK: - Similar Documents

    /// Find documents similar to a given document
    public func findSimilar(to documentId: String, limit: Int = 10) async throws -> [SearchResult] {
        guard isInitialized else {
            throw SearchCoordinatorError.notInitialized
        }

        // Get the reference document
        let (documents, _) = try await database.search(
            query: "",
            scope: .global,
            filters: nil,
            options: SearchOptions(limit: 1000)
        )

        guard let refDocument = documents.first(where: { $0.id == documentId }) else {
            return []
        }

        // Find similar documents
        let similar = await tfidfEngine.findSimilar(to: refDocument, among: documents, limit: limit)

        return similar.map { doc, similarity in
            SearchResult(
                document: doc,
                score: similarity,
                matchedTerms: [],
                matchedFields: []
            )
        }
    }

    // MARK: - Private Helpers

    /// Determine which fields matched the query
    private func determineMatchedFields(_ document: SearchDocument, query: ParsedQuery) -> [String] {
        var fields: [String] = []
        let keywords = query.keywords.map { $0.lowercased() }

        for keyword in keywords {
            if document.title.lowercased().contains(keyword) {
                if !fields.contains("title") {
                    fields.append("title")
                }
            }
            if document.content.lowercased().contains(keyword) {
                if !fields.contains("content") {
                    fields.append("content")
                }
            }
            if let tags = document.tags, tags.joined(separator: " ").lowercased().contains(keyword) {
                if !fields.contains("tags") {
                    fields.append("tags")
                }
            }
        }

        return fields
    }

    /// Highlight matched terms in excerpt
    private func highlightExcerpt(_ document: SearchDocument, query: ParsedQuery) -> String? {
        let content = document.excerpt ?? String(document.content.prefix(200))
        let keywords = query.keywords

        guard !keywords.isEmpty else { return content }

        var highlighted = content

        for keyword in keywords {
            // Case-insensitive replacement with markers
            let pattern = "(?i)(\(NSRegularExpression.escapedPattern(for: keyword)))"
            if let regex = try? NSRegularExpression(pattern: pattern) {
                highlighted = regex.stringByReplacingMatches(
                    in: highlighted,
                    range: NSRange(highlighted.startIndex..., in: highlighted),
                    withTemplate: "**$1**"
                )
            }
        }

        return highlighted
    }

    /// Calculate facet counts from documents
    private func calculateFacetCounts(from documents: [SearchDocument]) -> FacetCounts {
        var moduleTypeCounts: [String: Int] = [:]
        var groupCounts: [String: Int] = [:]
        var tagCounts: [String: Int] = [:]
        var authorCounts: [String: Int] = [:]

        for document in documents {
            moduleTypeCounts[document.moduleType, default: 0] += 1
            groupCounts[document.groupId, default: 0] += 1

            if let author = document.authorPubkey {
                authorCounts[author, default: 0] += 1
            }

            if let tags = document.tags {
                for tag in tags {
                    tagCounts[tag, default: 0] += 1
                }
            }
        }

        return FacetCounts(
            moduleType: moduleTypeCounts.isEmpty ? nil : moduleTypeCounts,
            groups: groupCounts.isEmpty ? nil : groupCounts,
            tags: tagCounts.isEmpty ? nil : tagCounts,
            authors: authorCounts.isEmpty ? nil : authorCounts
        )
    }

    /// Get current user's pubkey
    @MainActor
    private func getCurrentUserPubkey() async -> String? {
        return await CryptoManager.shared.getPublicKeyHex()
    }

    /// Get accessible group IDs for current user
    private func getAccessibleGroupIds() async -> [String] {
        // This would integrate with your group/permission system
        // For now, return placeholder
        return ["default"]
    }
}

// MARK: - CryptoManager Reference
// Uses the real CryptoManager from Core/Crypto/CryptoManager.swift
// No need for placeholder - import directly
