package network.buildit.modules.search.domain

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import network.buildit.modules.search.models.ConceptExpansion
import network.buildit.modules.search.models.FacetDefinition
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.FilterOperator
import network.buildit.modules.search.models.FormattedSearchResult
import network.buildit.modules.search.models.IndexStats
import network.buildit.modules.search.models.ParsedQuery
import network.buildit.modules.search.models.QueryFilter
import network.buildit.modules.search.models.RecentSearch
import network.buildit.modules.search.models.SavedSearch
import network.buildit.modules.search.models.SearchDocument
import network.buildit.modules.search.models.SearchOptions
import network.buildit.modules.search.models.SearchProviderConfig
import network.buildit.modules.search.models.SearchResult
import network.buildit.modules.search.models.SearchResults
import network.buildit.modules.search.models.SearchScope
import network.buildit.modules.search.models.Tag
import network.buildit.modules.search.providers.SearchProvider
import network.buildit.modules.search.providers.SearchProviderRegistry
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Main orchestrator for the search module.
 *
 * Coordinates:
 * - Search provider registration
 * - Query parsing and execution
 * - Index management
 * - Real-time index updates
 *
 * This is the main entry point for search operations.
 */
@Singleton
class SearchCoordinator @Inject constructor(
    private val repository: SearchRepository
) : SearchProviderRegistry {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Provider registry
    private val providers = mutableMapOf<String, SearchProvider>()

    // Indexing state
    private val _indexingState = MutableStateFlow<IndexingState>(IndexingState.Idle)
    val indexingState: StateFlow<IndexingState> = _indexingState.asStateFlow()

    // Active indexing job
    private var indexingJob: Job? = null

    // Concept expansion dictionary for organizing contexts
    private val conceptExpansions = buildConceptExpansions()

    // ============== Provider Registry ==============

    override fun registerProvider(provider: SearchProvider) {
        providers[provider.moduleType] = provider
    }

    override fun unregisterProvider(moduleType: String) {
        providers.remove(moduleType)
    }

    override fun getAllProviders(): List<SearchProvider> {
        return providers.values.toList()
    }

    override fun getProvider(moduleType: String): SearchProvider? {
        return providers[moduleType]
    }

    override fun getEnabledProviders(): List<SearchProvider> {
        return providers.values.filter { it.isEnabled }
    }

    /**
     * Gets configurations for all registered providers.
     */
    fun getProviderConfigs(): List<SearchProviderConfig> {
        return providers.values.map { provider ->
            SearchProviderConfig(
                moduleType = provider.moduleType,
                enabled = provider.isEnabled,
                facetDefinitions = provider.getFacetDefinitions(),
                boost = provider.boostFactor
            )
        }
    }

    /**
     * Gets all facet definitions from enabled providers.
     */
    fun getAllFacetDefinitions(): List<FacetDefinition> {
        return getEnabledProviders().flatMap { it.getFacetDefinitions() }
    }

    // ============== Search Operations ==============

    /**
     * Performs a search with query parsing and result formatting.
     *
     * @param query Raw query string
     * @param scope Search scope
     * @param options Search options
     * @param filters Active facet filters
     * @param userPubkey User performing the search (for history)
     * @return Formatted search results
     */
    suspend fun search(
        query: String,
        scope: SearchScope = SearchScope.Global,
        options: SearchOptions = SearchOptions(),
        filters: FacetFilters? = null,
        userPubkey: String? = null
    ): SearchResults = withContext(Dispatchers.IO) {
        // Parse the query
        val parsedQuery = parseQuery(query, scope)

        // Execute search
        val results = repository.search(parsedQuery, options, filters)

        // Record in history if user is provided
        userPubkey?.let {
            repository.recordRecentSearch(
                userPubkey = it,
                query = query,
                scope = scope,
                resultCount = results.totalCount
            )
        }

        results
    }

    /**
     * Parses a raw query string into a structured ParsedQuery.
     *
     * Supports:
     * - Quoted phrases: "exact match"
     * - Field filters: author:npub1... or type:events
     * - Exclusions: -word
     * - Wildcards: word*
     */
    fun parseQuery(query: String, scope: SearchScope): ParsedQuery {
        val keywords = mutableListOf<String>()
        val phrases = mutableListOf<String>()
        val filters = mutableListOf<QueryFilter>()
        val expandedTerms = mutableListOf<String>()

        // Extract quoted phrases
        val phraseRegex = Regex("\"([^\"]+)\"")
        var remaining = query
        phraseRegex.findAll(query).forEach { match ->
            phrases.add(match.groupValues[1])
            remaining = remaining.replace(match.value, "")
        }

        // Extract field filters (field:value)
        val filterRegex = Regex("(\\w+):([\\w-]+)")
        filterRegex.findAll(remaining).forEach { match ->
            val field = match.groupValues[1]
            val value = match.groupValues[2]
            remaining = remaining.replace(match.value, "")

            when (field.lowercase()) {
                "type", "module" -> {
                    filters.add(QueryFilter(
                        field = "moduleType",
                        operator = FilterOperator.EQ,
                        value = network.buildit.modules.search.models.FacetValue.StringValue(value)
                    ))
                }
                "author" -> {
                    filters.add(QueryFilter(
                        field = "authorPubkey",
                        operator = FilterOperator.EQ,
                        value = network.buildit.modules.search.models.FacetValue.StringValue(value)
                    ))
                }
                "tag" -> {
                    filters.add(QueryFilter(
                        field = "tags",
                        operator = FilterOperator.CONTAINS,
                        value = network.buildit.modules.search.models.FacetValue.StringValue(value)
                    ))
                }
                "group" -> {
                    filters.add(QueryFilter(
                        field = "groupId",
                        operator = FilterOperator.EQ,
                        value = network.buildit.modules.search.models.FacetValue.StringValue(value)
                    ))
                }
            }
        }

        // Extract keywords from remaining text
        remaining.split(Regex("\\s+"))
            .filter { it.isNotBlank() && !it.startsWith("-") }
            .forEach { word ->
                val cleanWord = word.trim().lowercase()
                if (cleanWord.isNotEmpty()) {
                    keywords.add(cleanWord)

                    // Add concept expansions for organizing-related terms
                    conceptExpansions[cleanWord]?.let { expansion ->
                        expandedTerms.addAll(expansion.synonyms)
                    }
                }
            }

        return ParsedQuery(
            raw = query,
            keywords = keywords,
            phrases = phrases,
            expandedTerms = expandedTerms.distinct(),
            filters = filters,
            scope = scope
        )
    }

    /**
     * Formats search results using the appropriate provider.
     */
    fun formatResults(results: List<SearchResult>): List<FormattedSearchResult> {
        return results.mapNotNull { result ->
            val provider = providers[result.document.moduleType]
            provider?.formatResult(result)
        }
    }

    /**
     * Suggests query completions based on recent and saved searches.
     */
    suspend fun getSuggestions(
        queryPrefix: String,
        userPubkey: String,
        limit: Int = 5
    ): List<String> = withContext(Dispatchers.IO) {
        val suggestions = mutableListOf<String>()

        // Get from recent searches
        val recentSearches = repository.getRecentSearches(userPubkey, limit).let { flow ->
            // This is a simplified version - in production would need to collect
            emptyList<RecentSearch>()
        }

        // Get top saved searches
        // Similar collection needed

        // Filter by prefix and return unique suggestions
        suggestions.distinct().take(limit)
    }

    // ============== Index Management ==============

    /**
     * Indexes an entity from a module.
     *
     * @param moduleType The source module type
     * @param entity The entity to index
     * @param groupId The group the entity belongs to
     */
    suspend fun indexEntity(moduleType: String, entity: Any, groupId: String) {
        val provider = providers[moduleType] ?: return
        if (!provider.isEnabled) return

        val document = provider.indexEntity(entity, groupId) ?: return
        repository.indexDocument(document)
    }

    /**
     * Removes an entity from the index.
     */
    suspend fun removeEntity(moduleType: String, entityId: String) {
        repository.removeDocumentByEntity(moduleType, entityId)
    }

    /**
     * Notifies the coordinator that an entity has changed.
     * Used for real-time index updates.
     */
    suspend fun onEntityChanged(moduleType: String, entityId: String, groupId: String) {
        val provider = providers[moduleType] ?: return
        if (!provider.isEnabled) return

        val document = provider.onEntityChanged(entityId, groupId) ?: return
        repository.indexDocument(document)
    }

    /**
     * Notifies the coordinator that an entity was deleted.
     */
    suspend fun onEntityDeleted(moduleType: String, entityId: String, groupId: String) {
        val provider = providers[moduleType]
        provider?.onEntityDeleted(entityId, groupId)
        repository.removeDocumentByEntity(moduleType, entityId)
    }

    /**
     * Performs a full reindex for a group.
     */
    suspend fun reindexGroup(groupId: String) {
        indexingJob?.cancel()

        indexingJob = scope.launch {
            _indexingState.value = IndexingState.Indexing(0, 0)

            try {
                // Remove existing documents for this group
                repository.removeDocumentsByGroup(groupId)

                // Index from all providers
                val enabledProviders = getEnabledProviders()
                var totalIndexed = 0
                var totalEntities = 0

                for (provider in enabledProviders) {
                    val entities = provider.getIndexableEntities(groupId)
                    totalEntities += entities.size

                    for (entity in entities) {
                        val document = provider.indexEntity(entity, groupId)
                        if (document != null) {
                            repository.indexDocument(document)
                            totalIndexed++
                            _indexingState.value = IndexingState.Indexing(totalIndexed, totalEntities)
                        }
                    }
                }

                _indexingState.value = IndexingState.Completed(totalIndexed)
            } catch (e: Exception) {
                _indexingState.value = IndexingState.Error(e.message ?: "Indexing failed")
            }
        }
    }

    /**
     * Performs a full reindex of all content.
     */
    suspend fun reindexAll() {
        indexingJob?.cancel()

        indexingJob = scope.launch {
            _indexingState.value = IndexingState.Indexing(0, 0)

            try {
                // Clear existing index
                repository.clearIndex()

                // Rebuild TF-IDF index
                repository.rebuildTfIdfIndex()

                _indexingState.value = IndexingState.Completed(0)
            } catch (e: Exception) {
                _indexingState.value = IndexingState.Error(e.message ?: "Reindex failed")
            }
        }
    }

    /**
     * Cancels any ongoing indexing operation.
     */
    fun cancelIndexing() {
        indexingJob?.cancel()
        _indexingState.value = IndexingState.Idle
    }

    /**
     * Gets index statistics.
     */
    suspend fun getIndexStats(): IndexStats {
        return repository.getIndexStats()
    }

    // ============== Tag Operations ==============

    /**
     * Creates a new tag.
     */
    suspend fun createTag(
        groupId: String,
        name: String,
        createdBy: String,
        color: String? = null,
        parentTagId: String? = null
    ): Tag {
        return repository.createTag(groupId, name, createdBy, color, parentTagId)
    }

    /**
     * Gets tags for a group.
     */
    fun getTagsByGroup(groupId: String): Flow<List<Tag>> {
        return repository.getTagsByGroup(groupId)
    }

    /**
     * Searches tags.
     */
    suspend fun searchTags(groupId: String, query: String): List<Tag> {
        return repository.searchTags(groupId, query)
    }

    /**
     * Gets popular tags.
     */
    suspend fun getPopularTags(groupId: String, limit: Int = 10): List<Tag> {
        return repository.getPopularTags(groupId, limit)
    }

    /**
     * Tags an entity.
     */
    suspend fun tagEntity(
        moduleType: String,
        entityId: String,
        tagId: String,
        groupId: String,
        createdBy: String
    ) {
        repository.tagEntity(moduleType, entityId, tagId, groupId, createdBy)

        // Update the search document with the new tag
        val document = repository.getDocumentByEntity(moduleType, entityId)
        if (document != null) {
            // Fetch current tags and add new one
            // This would typically involve getting tag name from tagId
            // For now, just re-index the document
            val provider = providers[moduleType]
            provider?.let {
                // Trigger re-index
                onEntityChanged(moduleType, entityId, groupId)
            }
        }
    }

    /**
     * Removes a tag from an entity.
     */
    suspend fun untagEntity(moduleType: String, entityId: String, tagId: String, groupId: String) {
        repository.untagEntity(moduleType, entityId, tagId)

        // Update the search document
        onEntityChanged(moduleType, entityId, groupId)
    }

    /**
     * Deletes a tag.
     */
    suspend fun deleteTag(tagId: String) {
        repository.deleteTag(tagId)
    }

    // ============== Saved Search Operations ==============

    /**
     * Saves a search.
     */
    suspend fun saveSearch(
        userPubkey: String,
        name: String,
        query: String,
        scope: SearchScope,
        filters: FacetFilters? = null
    ): SavedSearch {
        return repository.saveSearch(userPubkey, name, query, scope, filters)
    }

    /**
     * Gets saved searches.
     */
    fun getSavedSearches(userPubkey: String): Flow<List<SavedSearch>> {
        return repository.getSavedSearches(userPubkey)
    }

    /**
     * Executes a saved search.
     */
    suspend fun executeSavedSearch(
        savedSearch: SavedSearch,
        options: SearchOptions = SearchOptions()
    ): SearchResults {
        repository.useSavedSearch(savedSearch.id)
        return search(
            query = savedSearch.query,
            scope = savedSearch.scope,
            options = options,
            filters = savedSearch.filters
        )
    }

    /**
     * Deletes a saved search.
     */
    suspend fun deleteSavedSearch(id: String) {
        repository.deleteSavedSearch(id)
    }

    // ============== Recent Search Operations ==============

    /**
     * Gets recent searches.
     */
    fun getRecentSearches(userPubkey: String, limit: Int = 10): Flow<List<RecentSearch>> {
        return repository.getRecentSearches(userPubkey, limit)
    }

    /**
     * Clears recent search history.
     */
    suspend fun clearRecentSearches(userPubkey: String) {
        repository.clearRecentSearches(userPubkey)
    }

    // ============== Concept Expansions ==============

    /**
     * Builds concept expansion dictionary for organizing-related terms.
     */
    private fun buildConceptExpansions(): Map<String, ConceptExpansion> {
        return mapOf(
            // Organizing concepts
            "meeting" to ConceptExpansion(
                term = "meeting",
                synonyms = listOf("gathering", "assembly", "session", "conference"),
                broader = "event",
                narrower = listOf("general assembly", "committee meeting", "working group")
            ),
            "protest" to ConceptExpansion(
                term = "protest",
                synonyms = listOf("demonstration", "rally", "march", "action"),
                broader = "direct action",
                narrower = listOf("picket", "sit-in", "blockade")
            ),
            "campaign" to ConceptExpansion(
                term = "campaign",
                synonyms = listOf("initiative", "drive", "effort", "movement"),
                broader = "organizing effort"
            ),
            "union" to ConceptExpansion(
                term = "union",
                synonyms = listOf("labor union", "workers union", "trade union"),
                broader = "organization",
                narrower = listOf("local", "chapter", "bargaining unit")
            ),
            "strike" to ConceptExpansion(
                term = "strike",
                synonyms = listOf("walkout", "work stoppage", "job action"),
                broader = "direct action"
            ),
            "volunteer" to ConceptExpansion(
                term = "volunteer",
                synonyms = listOf("organizer", "activist", "member", "supporter"),
                broader = "participant"
            ),
            "mutual aid" to ConceptExpansion(
                term = "mutual aid",
                synonyms = listOf("solidarity", "community support", "mutual support"),
                broader = "organizing"
            ),
            "collective" to ConceptExpansion(
                term = "collective",
                synonyms = listOf("cooperative", "co-op", "worker-owned", "communal"),
                broader = "organization"
            ),
            "action" to ConceptExpansion(
                term = "action",
                synonyms = listOf("activity", "event", "campaign", "initiative"),
                narrower = listOf("direct action", "political action", "community action")
            ),
            "community" to ConceptExpansion(
                term = "community",
                synonyms = listOf("neighborhood", "local", "grassroots"),
                broader = "group"
            )
        )
    }

    /**
     * Gets concept expansions for a term.
     */
    fun getConceptExpansion(term: String): ConceptExpansion? {
        return conceptExpansions[term.lowercase()]
    }
}

/**
 * State of indexing operations.
 */
sealed class IndexingState {
    data object Idle : IndexingState()
    data class Indexing(val indexed: Int, val total: Int) : IndexingState()
    data class Completed(val totalIndexed: Int) : IndexingState()
    data class Error(val message: String) : IndexingState()
}
