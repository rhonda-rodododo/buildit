package network.buildit.modules.search.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import network.buildit.modules.search.domain.IndexingState
import network.buildit.modules.search.models.FacetCounts
import network.buildit.modules.search.models.FacetDefinition
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.FormattedSearchResult
import network.buildit.modules.search.models.RecentSearch
import network.buildit.modules.search.models.SavedSearch
import network.buildit.modules.search.models.SearchScope
import network.buildit.modules.search.ui.components.ActiveFiltersBar
import network.buildit.modules.search.ui.components.EmptyResults
import network.buildit.modules.search.ui.components.FacetChips
import network.buildit.modules.search.ui.components.ResultList
import network.buildit.modules.search.ui.components.ResultsHeader
import network.buildit.modules.search.ui.components.SearchBar
import network.buildit.modules.search.ui.components.SearchLoading

/**
 * Main search screen composable.
 *
 * Features:
 * - Full-text search with debouncing
 * - Faceted filtering
 * - Saved and recent search suggestions
 * - Result highlighting
 * - Navigation to results
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onBack: () -> Unit,
    onResultClick: (FormattedSearchResult) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SearchViewModel = hiltViewModel(),
    initialQuery: String? = null,
    groupId: String? = null
) {
    val searchState by viewModel.searchState.collectAsState()
    val query by viewModel.query.collectAsState()
    val filters by viewModel.filters.collectAsState()
    val facetCounts by viewModel.facetCounts.collectAsState()
    val facetDefinitions by viewModel.facetDefinitions.collectAsState()
    val savedSearches by viewModel.savedSearches.collectAsState()
    val recentSearches by viewModel.recentSearches.collectAsState()
    val indexingState by viewModel.indexingState.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Filter bottom sheet state
    var showFilterSheet by remember { mutableStateOf(false) }
    val filterSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Save search dialog state
    var showSaveDialog by remember { mutableStateOf(false) }

    // Handle initial query
    LaunchedEffect(initialQuery) {
        initialQuery?.let {
            viewModel.updateQuery(it)
        }
    }

    // Handle group scope
    LaunchedEffect(groupId) {
        groupId?.let {
            viewModel.setScope(SearchScope.Group(it))
            viewModel.loadTags(it)
        }
    }

    // Show indexing status
    LaunchedEffect(indexingState) {
        when (val state = indexingState) {
            is IndexingState.Completed -> {
                scope.launch {
                    snackbarHostState.showSnackbar("Indexing complete: ${state.totalIndexed} documents")
                }
            }
            is IndexingState.Error -> {
                scope.launch {
                    snackbarHostState.showSnackbar("Indexing failed: ${state.message}")
                }
            }
            else -> {}
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            SearchBar(
                query = query,
                onQueryChange = viewModel::updateQuery,
                onSearch = viewModel::searchNow,
                onBack = onBack,
                placeholder = "Search everything...",
                recentSearches = recentSearches,
                savedSearches = savedSearches,
                onRecentSearchClick = { recent ->
                    viewModel.updateQuery(recent.query)
                    viewModel.searchNow()
                },
                onSavedSearchClick = viewModel::executeSavedSearch,
                autoFocus = initialQuery.isNullOrBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            )

            // Active filters bar
            val hasFilters = filters.moduleTypes.isNotEmpty() ||
                    filters.tags.isNotEmpty()

            if (hasFilters) {
                ActiveFiltersBar(
                    filters = filters,
                    onRemoveModuleType = viewModel::toggleModuleTypeFilter,
                    onRemoveTag = viewModel::toggleTagFilter,
                    onClearAll = viewModel::clearFilters
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            // Main content
            when (val state = searchState) {
                is SearchUiState.Empty -> {
                    // Show suggestions when empty
                    EmptySearchState(
                        savedSearches = savedSearches,
                        recentSearches = recentSearches,
                        onSavedSearchClick = viewModel::executeSavedSearch,
                        onRecentSearchClick = { recent ->
                            viewModel.updateQuery(recent.query)
                            viewModel.searchNow()
                        },
                        onClearHistory = viewModel::clearRecentSearches
                    )
                }

                is SearchUiState.Loading -> {
                    SearchLoading()
                }

                is SearchUiState.Results -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Results header
                        ResultsHeader(
                            totalCount = state.totalCount,
                            searchTimeMs = state.searchTimeMs
                        )

                        // Facet chips (collapsed by default)
                        if (facetCounts != null) {
                            FacetChips(
                                facetCounts = facetCounts,
                                filters = filters,
                                facetDefinitions = facetDefinitions,
                                onModuleTypeClick = viewModel::toggleModuleTypeFilter,
                                onTagClick = viewModel::toggleTagFilter,
                                onClearFilters = viewModel::clearFilters
                            )

                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }

                        // Results list
                        if (state.results.isEmpty()) {
                            EmptyResults(query = query)
                        } else {
                            ResultList(
                                results = state.results,
                                onResultClick = onResultClick,
                                contentPadding = PaddingValues(16.dp)
                            )
                        }
                    }
                }

                is SearchUiState.Error -> {
                    SearchError(
                        message = state.message,
                        onRetry = viewModel::searchNow
                    )
                }
            }
        }

        // Filter bottom sheet
        if (showFilterSheet) {
            ModalBottomSheet(
                onDismissRequest = { showFilterSheet = false },
                sheetState = filterSheetState
            ) {
                FilterBottomSheet(
                    facetCounts = facetCounts,
                    filters = filters,
                    facetDefinitions = facetDefinitions,
                    onModuleTypeClick = viewModel::toggleModuleTypeFilter,
                    onTagClick = viewModel::toggleTagFilter,
                    onClearFilters = viewModel::clearFilters,
                    onDismiss = { showFilterSheet = false }
                )
            }
        }

        // Save search dialog
        if (showSaveDialog) {
            SaveSearchDialog(
                onSave = { name ->
                    viewModel.saveCurrentSearch(name)
                    showSaveDialog = false
                },
                onDismiss = { showSaveDialog = false }
            )
        }
    }
}

/**
 * Empty search state with suggestions.
 */
@Composable
private fun EmptySearchState(
    savedSearches: List<SavedSearch>,
    recentSearches: List<RecentSearch>,
    onSavedSearchClick: (SavedSearch) -> Unit,
    onRecentSearchClick: (RecentSearch) -> Unit,
    onClearHistory: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        if (savedSearches.isNotEmpty()) {
            Text(
                text = "Saved Searches",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            savedSearches.take(5).forEach { saved ->
                SavedSearchItem(
                    savedSearch = saved,
                    onClick = { onSavedSearchClick(saved) }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }

        if (recentSearches.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Recent Searches",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                TextButton(onClick = onClearHistory) {
                    Text("Clear")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            recentSearches.take(10).forEach { recent ->
                RecentSearchItem(
                    recentSearch = recent,
                    onClick = { onRecentSearchClick(recent) }
                )
            }
        }

        if (savedSearches.isEmpty() && recentSearches.isEmpty()) {
            EmptySearchHint()
        }
    }
}

/**
 * Saved search list item.
 */
@Composable
private fun SavedSearchItem(
    savedSearch: SavedSearch,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = savedSearch.name,
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = savedSearch.query,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = "${savedSearch.useCount} uses",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
        }
    }
}

/**
 * Recent search list item.
 */
@Composable
private fun RecentSearchItem(
    recentSearch: RecentSearch,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.History,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = recentSearch.query,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )

            Text(
                text = "${recentSearch.resultCount} results",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
        }
    }
}

/**
 * Empty search hint.
 */
@Composable
private fun EmptySearchHint(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Search,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Search everything",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Find events, messages, documents, and more",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Search error state.
 */
@Composable
private fun SearchError(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Search failed",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

/**
 * Filter bottom sheet content.
 */
@Composable
private fun FilterBottomSheet(
    facetCounts: FacetCounts?,
    filters: FacetFilters,
    facetDefinitions: List<FacetDefinition>,
    onModuleTypeClick: (String) -> Unit,
    onTagClick: (String) -> Unit,
    onClearFilters: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        FacetChips(
            facetCounts = facetCounts,
            filters = filters,
            facetDefinitions = facetDefinitions,
            onModuleTypeClick = onModuleTypeClick,
            onTagClick = onTagClick,
            onClearFilters = onClearFilters
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Apply Filters")
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

/**
 * Save search dialog.
 */
@Composable
private fun SaveSearchDialog(
    onSave: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Save Search") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name) },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
