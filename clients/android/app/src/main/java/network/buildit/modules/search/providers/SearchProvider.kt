package network.buildit.modules.search.providers

import network.buildit.modules.search.models.FacetDefinition
import network.buildit.modules.search.models.FormattedSearchResult
import network.buildit.modules.search.models.SearchDocument
import network.buildit.modules.search.models.SearchResult

/**
 * Interface that modules implement to provide searchable content.
 *
 * Each module (events, messaging, documents, wiki, etc.) can register a provider
 * that knows how to:
 * - Index entities from that module
 * - Define facets for filtering
 * - Format search results for display
 *
 * Usage:
 * ```kotlin
 * class EventsSearchProvider @Inject constructor(...) : SearchProvider {
 *     override val moduleType = "events"
 *
 *     override fun indexEntity(entity: Any, groupId: String): SearchDocument? {
 *         val event = entity as? Event ?: return null
 *         return SearchDocument(
 *             id = "events:${event.id}",
 *             moduleType = moduleType,
 *             entityId = event.id,
 *             groupId = groupId,
 *             title = event.title,
 *             content = event.description ?: "",
 *             ...
 *         )
 *     }
 *     ...
 * }
 * ```
 */
interface SearchProvider {
    /**
     * Unique identifier for this module (e.g., "events", "documents", "messaging").
     * Must match the module's identifier in BuildItModule.
     */
    val moduleType: String

    /**
     * Whether this provider is currently enabled.
     * Allows disabling search for specific modules without unregistering.
     */
    val isEnabled: Boolean
        get() = true

    /**
     * Boost factor for results from this module (default: 1.0).
     * Higher values make results from this module rank higher.
     */
    val boostFactor: Double
        get() = 1.0

    /**
     * Converts an entity from this module into a SearchDocument.
     *
     * @param entity The entity to index (type depends on module)
     * @param groupId The group this entity belongs to
     * @return SearchDocument if indexable, null if entity should be skipped
     */
    fun indexEntity(entity: Any, groupId: String): SearchDocument?

    /**
     * Returns the facet definitions for this module.
     * Facets allow users to filter search results by module-specific attributes.
     *
     * Example facets for events: date range, visibility level, has RSVP
     * Example facets for documents: document type, has attachments, last edited
     */
    fun getFacetDefinitions(): List<FacetDefinition>

    /**
     * Formats a search result for display in the UI.
     *
     * @param result The raw search result
     * @return Formatted result with title, subtitle, icon, navigation route, etc.
     */
    fun formatResult(result: SearchResult): FormattedSearchResult

    /**
     * Returns all indexable entities for a group.
     * Called during full reindex operations.
     *
     * @param groupId The group to get entities for
     * @return List of entities to index
     */
    suspend fun getIndexableEntities(groupId: String): List<Any>

    /**
     * Called when an entity is created or updated.
     * Providers can use this to trigger incremental index updates.
     *
     * @param entityId The entity that was modified
     * @param groupId The group the entity belongs to
     * @return The updated SearchDocument, or null if entity is not indexable
     */
    suspend fun onEntityChanged(entityId: String, groupId: String): SearchDocument? {
        // Default implementation - override for real-time indexing
        return null
    }

    /**
     * Called when an entity is deleted.
     *
     * @param entityId The entity that was deleted
     * @param groupId The group the entity belonged to
     */
    suspend fun onEntityDeleted(entityId: String, groupId: String) {
        // Default no-op - override to handle deletion
    }

    /**
     * Extracts tags from an entity for indexing.
     *
     * @param entity The entity to extract tags from
     * @return List of tag strings
     */
    fun extractTags(entity: Any): List<String> {
        return emptyList()
    }

    /**
     * Generates a preview excerpt from entity content.
     *
     * @param entity The entity to generate excerpt from
     * @param maxLength Maximum excerpt length
     * @return Short text excerpt
     */
    fun generateExcerpt(entity: Any, maxLength: Int = 200): String? {
        return null
    }
}

/**
 * Registry for search providers.
 * Modules register their providers here to participate in search.
 */
interface SearchProviderRegistry {
    /**
     * Registers a search provider for a module.
     */
    fun registerProvider(provider: SearchProvider)

    /**
     * Unregisters a search provider.
     */
    fun unregisterProvider(moduleType: String)

    /**
     * Gets all registered providers.
     */
    fun getAllProviders(): List<SearchProvider>

    /**
     * Gets provider for a specific module.
     */
    fun getProvider(moduleType: String): SearchProvider?

    /**
     * Gets all enabled providers.
     */
    fun getEnabledProviders(): List<SearchProvider>
}
