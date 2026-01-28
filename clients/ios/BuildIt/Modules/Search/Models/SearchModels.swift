// SearchModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Model definitions for the Search module, aligned with protocol/schemas/modules/search/v1.json
// All search operations are client-side only - no server-side indexing.
// Content is encrypted at rest, only decrypted for local indexing.

import Foundation

// MARK: - Schema Version

/// Current schema version for search models
public let searchSchemaVersion = "1.0.0"

// MARK: - FacetValue

/// Facet value types - string, number, boolean, string array, or range
public enum FacetValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case boolean(Bool)
    case stringArray([String])
    case range(min: Double, max: Double)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let boolValue = try? container.decode(Bool.self) {
            self = .boolean(boolValue)
        } else if let numberValue = try? container.decode(Double.self) {
            self = .number(numberValue)
        } else if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
        } else if let arrayValue = try? container.decode([String].self) {
            self = .stringArray(arrayValue)
        } else {
            let rangeContainer = try decoder.container(keyedBy: RangeCodingKeys.self)
            let min = try rangeContainer.decode(Double.self, forKey: .min)
            let max = try rangeContainer.decode(Double.self, forKey: .max)
            self = .range(min: min, max: max)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .boolean(let value):
            try container.encode(value)
        case .stringArray(let value):
            try container.encode(value)
        case .range(let min, let max):
            var rangeContainer = encoder.container(keyedBy: RangeCodingKeys.self)
            try rangeContainer.encode(min, forKey: .min)
            try rangeContainer.encode(max, forKey: .max)
        }
    }

    private enum RangeCodingKeys: String, CodingKey {
        case min, max
    }
}

// MARK: - SparseVector

/// Sparse vector representation for TF-IDF - maps term index to weight
public typealias SparseVector = [String: Double]

// MARK: - SearchDocument

/// A document indexed for search - internal representation stored in search index
public struct SearchDocument: Codable, Sendable, Identifiable, Equatable {
    /// Schema version
    public let _v: String

    /// Unique document ID (format: moduleType:entityId)
    public let id: String

    /// Source module type (messaging, documents, events, wiki, etc.)
    public let moduleType: String

    /// Original entity ID in the source module
    public let entityId: String

    /// Group this document belongs to
    public let groupId: String

    /// Searchable title/name
    public let title: String

    /// Searchable content body (plaintext, HTML stripped)
    public let content: String

    /// Tags associated with this document
    public var tags: [String]?

    /// Short excerpt for display in search results
    public var excerpt: String?

    /// Author/creator pubkey
    public var authorPubkey: String?

    /// Module-specific facets for filtering
    public var facets: [String: FacetValue]?

    /// TF-IDF vector for semantic search (optional)
    public var vector: SparseVector?

    /// When the source entity was created (Unix timestamp ms)
    public let createdAt: Int64

    /// When the source entity was last updated (Unix timestamp ms)
    public let updatedAt: Int64

    /// When this document was indexed (Unix timestamp ms)
    public let indexedAt: Int64

    public init(
        moduleType: String,
        entityId: String,
        groupId: String,
        title: String,
        content: String,
        tags: [String]? = nil,
        excerpt: String? = nil,
        authorPubkey: String? = nil,
        facets: [String: FacetValue]? = nil,
        vector: SparseVector? = nil,
        createdAt: Int64,
        updatedAt: Int64
    ) {
        self._v = searchSchemaVersion
        self.id = "\(moduleType):\(entityId)"
        self.moduleType = moduleType
        self.entityId = entityId
        self.groupId = groupId
        self.title = title
        self.content = content
        self.tags = tags
        self.excerpt = excerpt
        self.authorPubkey = authorPubkey
        self.facets = facets
        self.vector = vector
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.indexedAt = Int64(Date().timeIntervalSince1970 * 1000)
    }
}

// MARK: - FacetDefinition

/// Type of facet for filtering
public enum FacetType: String, Codable, Sendable {
    case keyword
    case range
    case date
    case boolean
    case hierarchy
}

/// Defines a filterable facet for a module
public struct FacetDefinition: Codable, Sendable, Identifiable, Equatable {
    /// Facet key/identifier
    public let key: String

    /// Display label for the facet
    public let label: String

    /// Type of facet
    public let type: FacetType

    /// For hierarchical facets, the parent facet key
    public var parentKey: String?

    /// Whether multiple values can be selected
    public let multiSelect: Bool

    public var id: String { key }

    public init(key: String, label: String, type: FacetType, parentKey: String? = nil, multiSelect: Bool) {
        self.key = key
        self.label = label
        self.type = type
        self.parentKey = parentKey
        self.multiSelect = multiSelect
    }
}

// MARK: - SearchScope

/// Defines the scope of a search query
public enum SearchScope: Codable, Sendable, Equatable {
    /// Search across all accessible groups
    case global

    /// Search within a single group
    case group(groupId: String)

    /// Search one module across all groups
    case module(moduleType: String)

    /// Search one module within a specific group
    case moduleInGroup(moduleType: String, groupId: String)

    private enum ScopeType: String, Codable {
        case global
        case group
        case module
        case moduleInGroup = "module-in-group"
    }

    private enum CodingKeys: String, CodingKey {
        case type
        case groupId
        case moduleType
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(ScopeType.self, forKey: .type)

        switch type {
        case .global:
            self = .global
        case .group:
            let groupId = try container.decode(String.self, forKey: .groupId)
            self = .group(groupId: groupId)
        case .module:
            let moduleType = try container.decode(String.self, forKey: .moduleType)
            self = .module(moduleType: moduleType)
        case .moduleInGroup:
            let moduleType = try container.decode(String.self, forKey: .moduleType)
            let groupId = try container.decode(String.self, forKey: .groupId)
            self = .moduleInGroup(moduleType: moduleType, groupId: groupId)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .global:
            try container.encode(ScopeType.global, forKey: .type)
        case .group(let groupId):
            try container.encode(ScopeType.group, forKey: .type)
            try container.encode(groupId, forKey: .groupId)
        case .module(let moduleType):
            try container.encode(ScopeType.module, forKey: .type)
            try container.encode(moduleType, forKey: .moduleType)
        case .moduleInGroup(let moduleType, let groupId):
            try container.encode(ScopeType.moduleInGroup, forKey: .type)
            try container.encode(moduleType, forKey: .moduleType)
            try container.encode(groupId, forKey: .groupId)
        }
    }
}

// MARK: - QueryFilter

/// Filter operator types
public enum FilterOperator: String, Codable, Sendable {
    case eq
    case ne
    case gt
    case lt
    case gte
    case lte
    case contains
    case `in`
    case range
}

/// Filter extracted from query or applied via UI
public struct QueryFilter: Codable, Sendable, Equatable {
    /// Filter field (e.g., 'author', 'date', 'tag')
    public let field: String

    /// Filter operator
    public let `operator`: FilterOperator

    /// Filter value
    public let value: FacetValue

    public init(field: String, operator: FilterOperator, value: FacetValue) {
        self.field = field
        self.operator = `operator`
        self.value = value
    }
}

// MARK: - ParsedQuery

/// Parsed and normalized search query
public struct ParsedQuery: Codable, Sendable, Equatable {
    /// Original raw query string
    public let raw: String

    /// Extracted keywords (stemmed)
    public let keywords: [String]

    /// Exact phrase matches (quoted)
    public let phrases: [String]

    /// Expanded synonyms
    public var expandedTerms: [String]?

    /// Detected filters from query syntax
    public let filters: [QueryFilter]

    /// Active search scope
    public let scope: SearchScope

    public init(
        raw: String,
        keywords: [String],
        phrases: [String],
        expandedTerms: [String]? = nil,
        filters: [QueryFilter],
        scope: SearchScope
    ) {
        self.raw = raw
        self.keywords = keywords
        self.phrases = phrases
        self.expandedTerms = expandedTerms
        self.filters = filters
        self.scope = scope
    }
}

// MARK: - SearchResult

/// A search result with relevance scoring
public struct SearchResult: Codable, Sendable, Identifiable, Equatable {
    /// The matching document
    public let document: SearchDocument

    /// Relevance score (higher is better)
    public let score: Double

    /// Matched terms for highlighting
    public let matchedTerms: [String]

    /// Fields where matches were found
    public let matchedFields: [String]

    /// Highlighted excerpt with match markers
    public var highlightedExcerpt: String?

    public var id: String { document.id }

    public init(
        document: SearchDocument,
        score: Double,
        matchedTerms: [String],
        matchedFields: [String],
        highlightedExcerpt: String? = nil
    ) {
        self.document = document
        self.score = score
        self.matchedTerms = matchedTerms
        self.matchedFields = matchedFields
        self.highlightedExcerpt = highlightedExcerpt
    }
}

// MARK: - FacetCounts

/// Aggregated facet counts for filtering UI
public struct FacetCounts: Codable, Sendable, Equatable {
    /// Module type distribution
    public var moduleType: [String: Int]?

    /// Group distribution
    public var groups: [String: Int]?

    /// Tag distribution
    public var tags: [String: Int]?

    /// Date histogram (by day)
    public var dates: [String: Int]?

    /// Author distribution
    public var authors: [String: Int]?

    /// Module-specific facet counts
    public var custom: [String: [String: Int]]?

    public init(
        moduleType: [String: Int]? = nil,
        groups: [String: Int]? = nil,
        tags: [String: Int]? = nil,
        dates: [String: Int]? = nil,
        authors: [String: Int]? = nil,
        custom: [String: [String: Int]]? = nil
    ) {
        self.moduleType = moduleType
        self.groups = groups
        self.tags = tags
        self.dates = dates
        self.authors = authors
        self.custom = custom
    }
}

// MARK: - SearchResults

/// Aggregated search results
public struct SearchResults: Codable, Sendable, Equatable {
    /// Matching results
    public let results: [SearchResult]

    /// Total count (may exceed results.length for pagination)
    public let totalCount: Int

    /// Search execution time in milliseconds
    public let searchTimeMs: Double

    /// Query that produced these results
    public let query: ParsedQuery

    /// Facet counts for filtering UI
    public var facetCounts: FacetCounts?

    public init(
        results: [SearchResult],
        totalCount: Int,
        searchTimeMs: Double,
        query: ParsedQuery,
        facetCounts: FacetCounts? = nil
    ) {
        self.results = results
        self.totalCount = totalCount
        self.searchTimeMs = searchTimeMs
        self.query = query
        self.facetCounts = facetCounts
    }

    /// Empty results
    public static func empty(query: ParsedQuery) -> SearchResults {
        SearchResults(results: [], totalCount: 0, searchTimeMs: 0, query: query)
    }
}

// MARK: - FacetFilters

/// Active facet filters for search
public struct FacetFilters: Codable, Sendable, Equatable {
    /// Filter by module types
    public var moduleTypes: [String]?

    /// Filter by group IDs
    public var groupIds: [String]?

    /// Filter by tags
    public var tags: [String]?

    /// Filter by date range (Unix timestamps)
    public var dateRange: DateRangeFilter?

    /// Filter by author pubkeys
    public var authors: [String]?

    /// Custom facet filters by key
    public var custom: [String: [FacetValue]]?

    public init(
        moduleTypes: [String]? = nil,
        groupIds: [String]? = nil,
        tags: [String]? = nil,
        dateRange: DateRangeFilter? = nil,
        authors: [String]? = nil,
        custom: [String: [FacetValue]]? = nil
    ) {
        self.moduleTypes = moduleTypes
        self.groupIds = groupIds
        self.tags = tags
        self.dateRange = dateRange
        self.authors = authors
        self.custom = custom
    }

    public var isEmpty: Bool {
        moduleTypes == nil &&
        groupIds == nil &&
        tags == nil &&
        dateRange == nil &&
        authors == nil &&
        custom == nil
    }
}

/// Date range filter
public struct DateRangeFilter: Codable, Sendable, Equatable {
    public let start: Int64
    public let end: Int64

    public init(start: Int64, end: Int64) {
        self.start = start
        self.end = end
    }

    public init(start: Date, end: Date) {
        self.start = Int64(start.timeIntervalSince1970 * 1000)
        self.end = Int64(end.timeIntervalSince1970 * 1000)
    }
}

// MARK: - Tag

/// User-defined tag for organizing content
public struct Tag: Codable, Sendable, Identifiable, Equatable {
    /// Schema version
    public let _v: String

    /// Unique tag ID
    public let id: String

    /// Group this tag belongs to
    public let groupId: String

    /// Tag display name
    public let name: String

    /// URL-safe slug
    public let slug: String

    /// Optional tag color (hex)
    public var color: String?

    /// Parent tag ID for hierarchical tags
    public var parentTagId: String?

    /// Number of entities using this tag
    public let usageCount: Int

    /// Creation timestamp (Unix ms)
    public let createdAt: Int64

    /// Creator pubkey
    public let createdBy: String

    /// Last update timestamp (Unix ms)
    public let updatedAt: Int64

    public init(
        id: String = UUID().uuidString,
        groupId: String,
        name: String,
        slug: String? = nil,
        color: String? = nil,
        parentTagId: String? = nil,
        usageCount: Int = 0,
        createdBy: String
    ) {
        self._v = searchSchemaVersion
        self.id = id
        self.groupId = groupId
        self.name = name
        self.slug = slug ?? name.lowercased().replacingOccurrences(of: " ", with: "-")
        self.color = color
        self.parentTagId = parentTagId
        self.usageCount = usageCount
        self.createdAt = Int64(Date().timeIntervalSince1970 * 1000)
        self.createdBy = createdBy
        self.updatedAt = self.createdAt
    }
}

// MARK: - EntityTag

/// Association between an entity and a tag
public struct EntityTag: Codable, Sendable, Identifiable, Equatable {
    /// Schema version
    public let _v: String

    /// Unique association ID
    public let id: String

    /// Module type of the tagged entity
    public let entityType: String

    /// ID of the tagged entity
    public let entityId: String

    /// Tag ID
    public let tagId: String

    /// Group ID
    public let groupId: String

    /// Creation timestamp (Unix ms)
    public let createdAt: Int64

    /// Creator pubkey
    public let createdBy: String

    public init(
        entityType: String,
        entityId: String,
        tagId: String,
        groupId: String,
        createdBy: String
    ) {
        self._v = searchSchemaVersion
        self.id = UUID().uuidString
        self.entityType = entityType
        self.entityId = entityId
        self.tagId = tagId
        self.groupId = groupId
        self.createdAt = Int64(Date().timeIntervalSince1970 * 1000)
        self.createdBy = createdBy
    }
}

// MARK: - SavedSearch

/// Saved search query for quick access
public struct SavedSearch: Codable, Sendable, Identifiable, Equatable {
    /// Schema version
    public let _v: String

    /// Unique saved search ID
    public let id: String

    /// User who saved this search
    public let userPubkey: String

    /// Display name for the saved search
    public let name: String

    /// Search query string
    public let query: String

    /// Search scope
    public let scope: SearchScope

    /// Active filters
    public var filters: FacetFilters?

    /// Creation timestamp
    public let createdAt: Int64

    /// Last update timestamp
    public var updatedAt: Int64

    /// Last use timestamp
    public var lastUsedAt: Int64?

    /// Number of times this search has been used
    public var useCount: Int

    public init(
        id: String = UUID().uuidString,
        userPubkey: String,
        name: String,
        query: String,
        scope: SearchScope,
        filters: FacetFilters? = nil
    ) {
        self._v = searchSchemaVersion
        self.id = id
        self.userPubkey = userPubkey
        self.name = name
        self.query = query
        self.scope = scope
        self.filters = filters
        self.createdAt = Int64(Date().timeIntervalSince1970 * 1000)
        self.updatedAt = self.createdAt
        self.useCount = 0
    }
}

// MARK: - RecentSearch

/// Recent search entry for history
public struct RecentSearch: Codable, Sendable, Identifiable, Equatable {
    /// Schema version
    public let _v: String

    /// Unique entry ID
    public let id: String

    /// User pubkey
    public let userPubkey: String

    /// Search query
    public let query: String

    /// Search scope
    public let scope: SearchScope

    /// When the search was performed
    public let timestamp: Int64

    /// Number of results returned
    public let resultCount: Int

    public init(
        userPubkey: String,
        query: String,
        scope: SearchScope,
        resultCount: Int
    ) {
        self._v = searchSchemaVersion
        self.id = UUID().uuidString
        self.userPubkey = userPubkey
        self.query = query
        self.scope = scope
        self.timestamp = Int64(Date().timeIntervalSince1970 * 1000)
        self.resultCount = resultCount
    }
}

// MARK: - SearchOptions

/// Options for fine-tuning search behavior
public struct SearchOptions: Sendable {
    /// Maximum results to return
    public var limit: Int

    /// Results to skip (pagination)
    public var offset: Int

    /// Enable fuzzy matching
    public var fuzzy: Bool

    /// Fuzzy match threshold (0-1)
    public var fuzzyThreshold: Double

    /// Enable prefix matching
    public var prefix: Bool

    /// Field boost weights
    public var boost: [String: Double]

    /// Enable semantic/TF-IDF search
    public var semantic: Bool

    /// Semantic search weight (0-1), default 0.3
    public var semanticWeight: Double

    /// Highlight matched terms in results
    public var highlight: Bool

    public init(
        limit: Int = 50,
        offset: Int = 0,
        fuzzy: Bool = true,
        fuzzyThreshold: Double = 0.8,
        prefix: Bool = true,
        boost: [String: Double] = ["title": 2.0, "tags": 1.5, "content": 1.0],
        semantic: Bool = true,
        semanticWeight: Double = 0.3,
        highlight: Bool = true
    ) {
        self.limit = limit
        self.offset = offset
        self.fuzzy = fuzzy
        self.fuzzyThreshold = fuzzyThreshold
        self.prefix = prefix
        self.boost = boost
        self.semantic = semantic
        self.semanticWeight = semanticWeight
        self.highlight = highlight
    }

    public static let `default` = SearchOptions()
}

// MARK: - IndexStats

/// Statistics about the search index
public struct IndexStats: Codable, Sendable {
    /// Total documents indexed
    public let totalDocuments: Int

    /// Documents by module type
    public let byModuleType: [String: Int]

    /// Documents by group
    public let byGroup: [String: Int]

    /// Total unique terms in index
    public let uniqueTerms: Int

    /// Estimated index size in bytes
    public let sizeBytes: Int

    /// Last full reindex timestamp
    public var lastFullReindex: Int64?

    /// Last incremental update timestamp
    public var lastIncrementalUpdate: Int64?

    public init(
        totalDocuments: Int,
        byModuleType: [String: Int],
        byGroup: [String: Int],
        uniqueTerms: Int,
        sizeBytes: Int,
        lastFullReindex: Int64? = nil,
        lastIncrementalUpdate: Int64? = nil
    ) {
        self.totalDocuments = totalDocuments
        self.byModuleType = byModuleType
        self.byGroup = byGroup
        self.uniqueTerms = uniqueTerms
        self.sizeBytes = sizeBytes
        self.lastFullReindex = lastFullReindex
        self.lastIncrementalUpdate = lastIncrementalUpdate
    }
}

// MARK: - ConceptExpansion

/// Concept expansion for semantic search in organizing contexts
public struct ConceptExpansion: Codable, Sendable {
    /// Primary term
    public let term: String

    /// Related/synonym terms
    public let synonyms: [String]

    /// Broader concept
    public var broader: String?

    /// Narrower concepts
    public var narrower: [String]?

    public init(term: String, synonyms: [String], broader: String? = nil, narrower: [String]? = nil) {
        self.term = term
        self.synonyms = synonyms
        self.broader = broader
        self.narrower = narrower
    }
}

// MARK: - FormattedSearchResult

/// Formatted search result for display in UI
public struct FormattedSearchResult: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let excerpt: String
    public let moduleType: String
    public let moduleIcon: String
    public let groupId: String
    public let groupName: String?
    public let authorPubkey: String?
    public let authorName: String?
    public let score: Double
    public let matchedTerms: [String]
    public let createdAt: Date
    public let entityId: String

    public init(
        id: String,
        title: String,
        excerpt: String,
        moduleType: String,
        moduleIcon: String,
        groupId: String,
        groupName: String? = nil,
        authorPubkey: String? = nil,
        authorName: String? = nil,
        score: Double,
        matchedTerms: [String],
        createdAt: Date,
        entityId: String
    ) {
        self.id = id
        self.title = title
        self.excerpt = excerpt
        self.moduleType = moduleType
        self.moduleIcon = moduleIcon
        self.groupId = groupId
        self.groupName = groupName
        self.authorPubkey = authorPubkey
        self.authorName = authorName
        self.score = score
        self.matchedTerms = matchedTerms
        self.createdAt = createdAt
        self.entityId = entityId
    }
}
