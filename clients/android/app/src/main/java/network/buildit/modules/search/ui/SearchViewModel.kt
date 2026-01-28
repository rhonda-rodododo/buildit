package network.buildit.modules.search.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import network.buildit.modules.search.domain.IndexingState
import network.buildit.modules.search.domain.SearchCoordinator
import network.buildit.modules.search.models.FacetCounts
import network.buildit.modules.search.models.FacetDefinition
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.FormattedSearchResult
import network.buildit.modules.search.models.IndexStats
import network.buildit.modules.search.models.RecentSearch
import network.buildit.modules.search.models.SavedSearch
import network.buildit.modules.search.models.SearchOptions
import network.buildit.modules.search.models.SearchScope
import network.buildit.modules.search.models.Tag
import javax.inject.Inject

/**
 * ViewModel for the Search module UI.
 *
 * Manages:
 * - Search query state
 * - Search results
 * - Facet filters
 * - Saved and recent searches
 * - Index statistics
 */
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val searchCoordinator: SearchCoordinator,
    private val cryptoManager: CryptoManager
) : ViewModel() {

    // Search state
    private val _searchState = MutableStateFlow<SearchUiState>(SearchUiState.Empty)
    val searchState: StateFlow<SearchUiState> = _searchState.asStateFlow()

    // Current query
    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    // Current scope
    private val _scope = MutableStateFlow<SearchScope>(SearchScope.Global)
    val scope: StateFlow<SearchScope> = _scope.asStateFlow()

    // Active filters
    private val _filters = MutableStateFlow(FacetFilters())
    val filters: StateFlow<FacetFilters> = _filters.asStateFlow()

    // Available facets
    private val _facetDefinitions = MutableStateFlow<List<FacetDefinition>>(emptyList())
    val facetDefinitions: StateFlow<List<FacetDefinition>> = _facetDefinitions.asStateFlow()

    // Facet counts from last search
    private val _facetCounts = MutableStateFlow<FacetCounts?>(null)
    val facetCounts: StateFlow<FacetCounts?> = _facetCounts.asStateFlow()

    // Saved searches
    private val _savedSearches = MutableStateFlow<List<SavedSearch>>(emptyList())
    val savedSearches: StateFlow<List<SavedSearch>> = _savedSearches.asStateFlow()

    // Recent searches
    private val _recentSearches = MutableStateFlow<List<RecentSearch>>(emptyList())
    val recentSearches: StateFlow<List<RecentSearch>> = _recentSearches.asStateFlow()

    // Index stats
    private val _indexStats = MutableStateFlow<IndexStats?>(null)
    val indexStats: StateFlow<IndexStats?> = _indexStats.asStateFlow()

    // Indexing state
    val indexingState: StateFlow<IndexingState> = searchCoordinator.indexingState

    // Tags for current group
    private val _tags = MutableStateFlow<List<Tag>>(emptyList())
    val tags: StateFlow<List<Tag>> = _tags.asStateFlow()

    // Debounce search job
    private var searchJob: Job? = null
    private val debounceDelayMs = 300L

    init {
        loadFacetDefinitions()
        loadUserSearchHistory()
    }

    /**
     * Updates the search query with debouncing.
     */
    fun updateQuery(newQuery: String) {
        _query.value = newQuery

        // Cancel previous search
        searchJob?.cancel()

        if (newQuery.isBlank()) {
            _searchState.value = SearchUiState.Empty
            return
        }

        // Debounce search
        searchJob = viewModelScope.launch {
            delay(debounceDelayMs)
            executeSearch()
        }
    }

    /**
     * Sets the search scope.
     */
    fun setScope(newScope: SearchScope) {
        _scope.value = newScope

        // Re-execute search if there's a query
        if (_query.value.isNotBlank()) {
            viewModelScope.launch {
                executeSearch()
            }
        }
    }

    /**
     * Updates facet filters.
     */
    fun updateFilters(newFilters: FacetFilters) {
        _filters.value = newFilters

        // Re-execute search
        if (_query.value.isNotBlank()) {
            viewModelScope.launch {
                executeSearch()
            }
        }
    }

    /**
     * Toggles a module type filter.
     */
    fun toggleModuleTypeFilter(moduleType: String) {
        val current = _filters.value
        val newModuleTypes = if (moduleType in current.moduleTypes) {
            current.moduleTypes - moduleType
        } else {
            current.moduleTypes + moduleType
        }

        updateFilters(current.copy(moduleTypes = newModuleTypes))
    }

    /**
     * Toggles a tag filter.
     */
    fun toggleTagFilter(tag: String) {
        val current = _filters.value
        val newTags = if (tag in current.tags) {
            current.tags - tag
        } else {
            current.tags + tag
        }

        updateFilters(current.copy(tags = newTags))
    }

    /**
     * Clears all filters.
     */
    fun clearFilters() {
        _filters.value = FacetFilters()

        if (_query.value.isNotBlank()) {
            viewModelScope.launch {
                executeSearch()
            }
        }
    }

    /**
     * Executes search immediately (bypasses debounce).
     */
    fun searchNow() {
        searchJob?.cancel()
        viewModelScope.launch {
            executeSearch()
        }
    }

    /**
     * Executes a saved search.
     */
    fun executeSavedSearch(savedSearch: SavedSearch) {
        _query.value = savedSearch.query
        _scope.value = savedSearch.scope
        savedSearch.filters?.let { _filters.value = it }

        viewModelScope.launch {
            _searchState.value = SearchUiState.Loading

            try {
                val results = searchCoordinator.executeSavedSearch(savedSearch)
                val formattedResults = searchCoordinator.formatResults(results.results)

                _searchState.value = SearchUiState.Results(
                    results = formattedResults,
                    totalCount = results.totalCount,
                    searchTimeMs = results.searchTimeMs
                )
                _facetCounts.value = results.facetCounts
            } catch (e: Exception) {
                _searchState.value = SearchUiState.Error(e.message ?: "Search failed")
            }
        }
    }

    /**
     * Saves the current search.
     */
    fun saveCurrentSearch(name: String) {
        val userPubkey = cryptoManager.getPublicKeyHex() ?: return

        viewModelScope.launch {
            try {
                searchCoordinator.saveSearch(
                    userPubkey = userPubkey,
                    name = name,
                    query = _query.value,
                    scope = _scope.value,
                    filters = _filters.value.takeIf {
                        it.moduleTypes.isNotEmpty() ||
                                it.tags.isNotEmpty() ||
                                it.groupIds.isNotEmpty() ||
                                it.authors.isNotEmpty() ||
                                it.dateRange != null
                    }
                )

                loadUserSearchHistory()
            } catch (e: Exception) {
                // Handle error
            }
        }
    }

    /**
     * Deletes a saved search.
     */
    fun deleteSavedSearch(id: String) {
        viewModelScope.launch {
            searchCoordinator.deleteSavedSearch(id)
            loadUserSearchHistory()
        }
    }

    /**
     * Clears recent search history.
     */
    fun clearRecentSearches() {
        val userPubkey = cryptoManager.getPublicKeyHex() ?: return

        viewModelScope.launch {
            searchCoordinator.clearRecentSearches(userPubkey)
            _recentSearches.value = emptyList()
        }
    }

    /**
     * Triggers a full reindex.
     */
    fun reindexAll() {
        viewModelScope.launch {
            searchCoordinator.reindexAll()
        }
    }

    /**
     * Reindexes a specific group.
     */
    fun reindexGroup(groupId: String) {
        viewModelScope.launch {
            searchCoordinator.reindexGroup(groupId)
        }
    }

    /**
     * Cancels ongoing indexing.
     */
    fun cancelIndexing() {
        searchCoordinator.cancelIndexing()
    }

    /**
     * Loads index statistics.
     */
    fun loadIndexStats() {
        viewModelScope.launch {
            _indexStats.value = searchCoordinator.getIndexStats()
        }
    }

    /**
     * Loads tags for a group.
     */
    fun loadTags(groupId: String) {
        viewModelScope.launch {
            searchCoordinator.getTagsByGroup(groupId)
                .catch { /* Handle error */ }
                .collect { tags ->
                    _tags.value = tags
                }
        }
    }

    /**
     * Creates a new tag.
     */
    fun createTag(groupId: String, name: String, color: String? = null) {
        val userPubkey = cryptoManager.getPublicKeyHex() ?: return

        viewModelScope.launch {
            try {
                searchCoordinator.createTag(
                    groupId = groupId,
                    name = name,
                    createdBy = userPubkey,
                    color = color
                )
            } catch (e: Exception) {
                // Handle error
            }
        }
    }

    /**
     * Deletes a tag.
     */
    fun deleteTag(tagId: String) {
        viewModelScope.launch {
            searchCoordinator.deleteTag(tagId)
        }
    }

    // ============== Private Methods ==============

    private suspend fun executeSearch() {
        val queryText = _query.value
        if (queryText.isBlank()) {
            _searchState.value = SearchUiState.Empty
            return
        }

        _searchState.value = SearchUiState.Loading

        try {
            val userPubkey = cryptoManager.getPublicKeyHex()

            val results = searchCoordinator.search(
                query = queryText,
                scope = _scope.value,
                options = SearchOptions(
                    limit = 50,
                    fuzzy = true,
                    semantic = true,
                    highlight = true
                ),
                filters = _filters.value.takeIf {
                    it.moduleTypes.isNotEmpty() ||
                            it.tags.isNotEmpty() ||
                            it.groupIds.isNotEmpty() ||
                            it.authors.isNotEmpty() ||
                            it.dateRange != null
                },
                userPubkey = userPubkey
            )

            val formattedResults = searchCoordinator.formatResults(results.results)

            _searchState.value = SearchUiState.Results(
                results = formattedResults,
                totalCount = results.totalCount,
                searchTimeMs = results.searchTimeMs
            )
            _facetCounts.value = results.facetCounts
        } catch (e: Exception) {
            _searchState.value = SearchUiState.Error(e.message ?: "Search failed")
        }
    }

    private fun loadFacetDefinitions() {
        _facetDefinitions.value = searchCoordinator.getAllFacetDefinitions()
    }

    private fun loadUserSearchHistory() {
        val userPubkey = cryptoManager.getPublicKeyHex() ?: return

        viewModelScope.launch {
            // Load saved searches
            searchCoordinator.getSavedSearches(userPubkey)
                .catch { /* Handle error */ }
                .collect { searches ->
                    _savedSearches.value = searches
                }
        }

        viewModelScope.launch {
            // Load recent searches
            searchCoordinator.getRecentSearches(userPubkey)
                .catch { /* Handle error */ }
                .collect { searches ->
                    _recentSearches.value = searches
                }
        }
    }
}

/**
 * UI state for search screen.
 */
sealed class SearchUiState {
    data object Empty : SearchUiState()
    data object Loading : SearchUiState()
    data class Results(
        val results: List<FormattedSearchResult>,
        val totalCount: Int,
        val searchTimeMs: Double
    ) : SearchUiState()
    data class Error(val message: String) : SearchUiState()
}
