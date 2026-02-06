package network.buildit.modules.search

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrEvent
import network.buildit.modules.search.domain.SearchCoordinator
import network.buildit.modules.search.providers.SearchProvider
import network.buildit.modules.search.providers.SearchProviderRegistry
import network.buildit.modules.search.ui.SearchScreen
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Search module for BuildIt.
 *
 * Provides client-side full-text search with:
 * - FTS4-powered full-text search
 * - TF-IDF semantic ranking
 * - Faceted filtering
 * - Module provider registration
 * - Saved and recent search management
 *
 * This module coordinates search across all other modules by allowing them
 * to register SearchProviders that know how to index their content.
 *
 * Key Features:
 * - E2EE-respecting: All indexing happens locally on decrypted content
 * - Cross-module: Unified search across events, messaging, documents, etc.
 * - Semantic: TF-IDF ranking for relevance
 * - Extensible: Modules can define custom facets
 */
class SearchModule @Inject constructor(
    private val searchCoordinator: SearchCoordinator
) : BuildItModule {

    override val identifier: String = "search"
    override val version: String = "1.0.0"
    override val displayName: String = "Search"
    override val description: String = "Full-text search across all content"

    override val dependencies: List<String> = emptyList()

    override suspend fun initialize() {
        // Search module is always available
        // Provider registration happens via Hilt multibindings
    }

    override suspend fun shutdown() {
        // Cleanup if needed
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        // Search module doesn't handle Nostr events directly
        // It indexes content through SearchProviders
        return false
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "search",
                title = "Search",
                icon = Icons.Default.Search,
                showInNavigation = false, // Search is usually accessed via search bar
                content = { args ->
                    val initialQuery = args["query"]
                    val groupId = args["groupId"]
                    SearchScreen(
                        onBack = { /* Handle back navigation */ },
                        onResultClick = { result ->
                            // Navigate to result using result.navigationRoute
                        },
                        initialQuery = initialQuery,
                        groupId = groupId
                    )
                }
            ),
            ModuleRoute(
                route = "search/{query}",
                title = "Search Results",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val query = args["query"]
                    val groupId = args["groupId"]
                    SearchScreen(
                        onBack = { /* Handle back navigation */ },
                        onResultClick = { result ->
                            // Navigate to result
                        },
                        initialQuery = query,
                        groupId = groupId
                    )
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> = emptyList()

    /**
     * Registers a search provider for a module.
     */
    fun registerProvider(provider: SearchProvider) {
        searchCoordinator.registerProvider(provider)
    }

    /**
     * Gets the search coordinator for direct access.
     */
    fun getCoordinator(): SearchCoordinator = searchCoordinator
}

/**
 * Hilt module for Search dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class SearchHiltModule {

    @Binds
    @IntoSet
    abstract fun bindSearchModule(impl: SearchModule): BuildItModule

    @Binds
    abstract fun bindSearchProviderRegistry(impl: SearchCoordinator): SearchProviderRegistry

    companion object {
        @Provides
        @Singleton
        fun provideSearchCoordinator(
            searchRepository: network.buildit.modules.search.domain.SearchRepository
        ): SearchCoordinator {
            return SearchCoordinator(searchRepository)
        }

        @Provides
        @Singleton
        fun provideSearchRepository(
            searchDocumentDao: network.buildit.modules.search.data.SearchDocumentDao,
            tagDao: network.buildit.modules.search.data.TagDao,
            entityTagDao: network.buildit.modules.search.data.EntityTagDao,
            savedSearchDao: network.buildit.modules.search.data.SavedSearchDao,
            recentSearchDao: network.buildit.modules.search.data.RecentSearchDao,
            tfidfEngine: network.buildit.modules.search.domain.TFIDFEngine
        ): network.buildit.modules.search.domain.SearchRepository {
            return network.buildit.modules.search.domain.SearchRepository(
                searchDocumentDao = searchDocumentDao,
                tagDao = tagDao,
                entityTagDao = entityTagDao,
                savedSearchDao = savedSearchDao,
                recentSearchDao = recentSearchDao,
                tfidfEngine = tfidfEngine
            )
        }

        @Provides
        @Singleton
        fun provideTFIDFEngine(
            searchDocumentDao: network.buildit.modules.search.data.SearchDocumentDao,
            termFrequencyDao: network.buildit.modules.search.data.TermFrequencyDao,
            idfDao: network.buildit.modules.search.data.InverseDocumentFrequencyDao
        ): network.buildit.modules.search.domain.TFIDFEngine {
            return network.buildit.modules.search.domain.TFIDFEngine(
                searchDocumentDao = searchDocumentDao,
                termFrequencyDao = termFrequencyDao,
                idfDao = idfDao
            )
        }
    }
}

/**
 * Example SearchProvider implementation for reference.
 *
 * Other modules would create similar providers to participate in search.
 *
 * ```kotlin
 * class EventsSearchProvider @Inject constructor(
 *     private val eventsRepository: EventsRepository
 * ) : SearchProvider {
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
 *             tags = emptyList(),
 *             excerpt = event.description?.take(200),
 *             authorPubkey = event.createdBy,
 *             facets = mapOf(
 *                 "visibility" to FacetValue.StringValue(event.visibility.value),
 *                 "hasRsvp" to FacetValue.BooleanValue(true)
 *             ),
 *             createdAt = event.createdAt,
 *             updatedAt = event.updatedAt ?: event.createdAt,
 *             indexedAt = System.currentTimeMillis()
 *         )
 *     }
 *
 *     override fun getFacetDefinitions(): List<FacetDefinition> {
 *         return listOf(
 *             FacetDefinition(
 *                 key = "visibility",
 *                 label = "Visibility",
 *                 type = FacetType.Keyword,
 *                 multiSelect = false
 *             ),
 *             FacetDefinition(
 *                 key = "dateRange",
 *                 label = "Date",
 *                 type = FacetType.Date,
 *                 multiSelect = false
 *             )
 *         )
 *     }
 *
 *     override fun formatResult(result: SearchResult): FormattedSearchResult {
 *         return FormattedSearchResult(
 *             id = result.document.id,
 *             moduleType = moduleType,
 *             title = result.document.title,
 *             subtitle = "Event",
 *             excerpt = result.document.excerpt,
 *             highlightedExcerpt = result.highlightedExcerpt,
 *             iconResId = R.drawable.ic_event,
 *             timestamp = result.document.createdAt,
 *             score = result.score,
 *             navigationRoute = "events/${result.document.entityId}"
 *         )
 *     }
 *
 *     override suspend fun getIndexableEntities(groupId: String): List<Any> {
 *         return eventsRepository.getEventsByGroup(groupId).first()
 *     }
 * }
 * ```
 */
