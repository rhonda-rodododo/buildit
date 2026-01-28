// SearchProvider.swift
// BuildIt - Decentralized Mesh Communication
//
// Protocol definition for module search providers.
// Each module can register a provider to make its content searchable.

import Foundation

// MARK: - SearchProvider Protocol

/// Protocol that modules implement to provide searchable content
public protocol SearchProvider: Sendable {
    /// The module type this provider handles
    var moduleType: String { get }

    /// The icon name for this module's results
    var moduleIcon: String { get }

    /// Convert an entity to a search document
    /// - Parameters:
    ///   - entity: The entity to index
    ///   - groupId: The group this entity belongs to
    /// - Returns: A SearchDocument if the entity can be indexed, nil otherwise
    func indexEntity(_ entity: Any, groupId: String) async -> SearchDocument?

    /// Get facet definitions for this module
    /// - Returns: Array of facet definitions for filtering
    func getFacetDefinitions() -> [FacetDefinition]

    /// Format a search result for display
    /// - Parameter result: The raw search result
    /// - Returns: A formatted result ready for UI display
    func formatResult(_ result: SearchResult) async -> FormattedSearchResult

    /// Get all indexable entities for a group
    /// - Parameter groupId: The group to get entities for
    /// - Returns: Array of entities to index
    func getIndexableEntities(groupId: String) async -> [Any]

    /// Get entities updated since a given timestamp
    /// - Parameters:
    ///   - timestamp: Unix timestamp in milliseconds
    ///   - groupId: The group to check
    /// - Returns: Array of entities updated since the timestamp
    func getEntitiesUpdatedSince(_ timestamp: Int64, groupId: String) async -> [Any]

    /// Handle entity deletion - return document ID to remove
    /// - Parameter entityId: The ID of the deleted entity
    /// - Returns: The search document ID to remove from index
    func getDocumentIdForEntity(_ entityId: String) -> String
}

// MARK: - Default Implementations

public extension SearchProvider {
    /// Default implementation returns document ID in standard format
    func getDocumentIdForEntity(_ entityId: String) -> String {
        "\(moduleType):\(entityId)"
    }

    /// Default implementation returns empty array for incremental updates
    func getEntitiesUpdatedSince(_ timestamp: Int64, groupId: String) async -> [Any] {
        []
    }
}

// MARK: - SearchProviderConfig

/// Configuration for a module's search provider
public struct SearchProviderConfig: Codable, Sendable {
    /// Module type this provider handles
    public let moduleType: String

    /// Whether this provider is active
    public var enabled: Bool

    /// Facets this module provides
    public let facetDefinitions: [FacetDefinition]

    /// Result boost factor for this module (default: 1.0)
    public var boost: Double

    public init(
        moduleType: String,
        enabled: Bool = true,
        facetDefinitions: [FacetDefinition] = [],
        boost: Double = 1.0
    ) {
        self.moduleType = moduleType
        self.enabled = enabled
        self.facetDefinitions = facetDefinitions
        self.boost = min(max(boost, 0), 10)
    }
}

// MARK: - SearchProviderRegistry

/// Registry for managing search providers
public actor SearchProviderRegistry {
    /// Singleton instance
    public static let shared = SearchProviderRegistry()

    /// Registered providers by module type
    private var providers: [String: any SearchProvider] = [:]

    /// Provider configurations
    private var configs: [String: SearchProviderConfig] = [:]

    private init() {}

    /// Register a search provider
    /// - Parameter provider: The provider to register
    public func register(_ provider: any SearchProvider) {
        providers[provider.moduleType] = provider
        if configs[provider.moduleType] == nil {
            configs[provider.moduleType] = SearchProviderConfig(
                moduleType: provider.moduleType,
                facetDefinitions: provider.getFacetDefinitions()
            )
        }
    }

    /// Unregister a provider
    /// - Parameter moduleType: The module type to unregister
    public func unregister(_ moduleType: String) {
        providers.removeValue(forKey: moduleType)
        configs.removeValue(forKey: moduleType)
    }

    /// Get a provider for a module type
    /// - Parameter moduleType: The module type
    /// - Returns: The provider if registered
    public func getProvider(for moduleType: String) -> (any SearchProvider)? {
        providers[moduleType]
    }

    /// Get all registered providers
    /// - Returns: Array of all providers
    public func getAllProviders() -> [any SearchProvider] {
        Array(providers.values)
    }

    /// Get all enabled providers
    /// - Returns: Array of enabled providers
    public func getEnabledProviders() -> [any SearchProvider] {
        providers.values.filter { provider in
            configs[provider.moduleType]?.enabled ?? true
        }
    }

    /// Get configuration for a provider
    /// - Parameter moduleType: The module type
    /// - Returns: The configuration if exists
    public func getConfig(for moduleType: String) -> SearchProviderConfig? {
        configs[moduleType]
    }

    /// Update provider configuration
    /// - Parameters:
    ///   - moduleType: The module type
    ///   - config: The new configuration
    public func updateConfig(_ moduleType: String, config: SearchProviderConfig) {
        configs[moduleType] = config
    }

    /// Enable or disable a provider
    /// - Parameters:
    ///   - moduleType: The module type
    ///   - enabled: Whether to enable or disable
    public func setEnabled(_ moduleType: String, enabled: Bool) {
        if var config = configs[moduleType] {
            config.enabled = enabled
            configs[moduleType] = config
        }
    }

    /// Get all facet definitions from all providers
    /// - Returns: Combined facet definitions
    public func getAllFacetDefinitions() -> [FacetDefinition] {
        providers.values.flatMap { $0.getFacetDefinitions() }
    }

    /// Get registered module types
    /// - Returns: Array of module type strings
    public func getRegisteredModuleTypes() -> [String] {
        Array(providers.keys).sorted()
    }
}
