package network.buildit.modules.wiki.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.modules.wiki.data.local.*
import network.buildit.modules.wiki.domain.WikiUseCase
import javax.inject.Inject

/**
 * UI state for the wiki list screen.
 */
data class WikiListUiState(
    val pages: List<WikiPageEntity> = emptyList(),
    val categories: List<WikiCategoryEntity> = emptyList(),
    val recentPages: List<WikiPageEntity> = emptyList(),
    val searchResults: List<WikiSearchResult> = emptyList(),
    val selectedCategoryId: String? = null,
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * UI state for the wiki page detail screen.
 */
data class WikiPageUiState(
    val page: WikiPageEntity? = null,
    val tableOfContents: List<TableOfContentsEntry> = emptyList(),
    val revisions: List<PageRevisionEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * ViewModel for the wiki list screen.
 */
@HiltViewModel
class WikiListViewModel @Inject constructor(
    private val useCase: WikiUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WikiListUiState())
    val uiState: StateFlow<WikiListUiState> = _uiState.asStateFlow()

    private var currentGroupId: String = ""

    fun loadWiki(groupId: String) {
        currentGroupId = groupId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Load categories for this group
                useCase.getCategoriesByGroup(groupId)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { categories ->
                        _uiState.update { it.copy(categories = categories) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }

        viewModelScope.launch {
            try {
                // Load all published pages for this group
                useCase.getPublishedPagesByGroup(groupId)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { pages ->
                        _uiState.update { it.copy(pages = pages, isLoading = false) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }

        viewModelScope.launch {
            try {
                // Load recent pages
                useCase.getRecentPages(5)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { recent ->
                        _uiState.update { it.copy(recentPages = recent) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun selectCategory(categoryId: String?) {
        _uiState.update { it.copy(selectedCategoryId = categoryId) }

        viewModelScope.launch {
            try {
                val pagesFlow = if (categoryId != null) {
                    useCase.getPublishedPagesByCategory(categoryId)
                } else {
                    useCase.getPublishedPagesByGroup(currentGroupId)
                }

                pagesFlow
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { pages ->
                        _uiState.update { it.copy(pages = pages) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }

        if (query.isBlank()) {
            _uiState.update { it.copy(isSearching = false, searchResults = emptyList()) }
            return
        }

        _uiState.update { it.copy(isSearching = true) }

        viewModelScope.launch {
            try {
                val results = useCase.searchPages(query, currentGroupId)
                _uiState.update { it.copy(searchResults = results, isSearching = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isSearching = false) }
            }
        }
    }

    fun clearSearch() {
        _uiState.update { it.copy(searchQuery = "", searchResults = emptyList(), isSearching = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

/**
 * ViewModel for the wiki page detail screen.
 */
@HiltViewModel
class WikiPageViewModel @Inject constructor(
    private val useCase: WikiUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WikiPageUiState())
    val uiState: StateFlow<WikiPageUiState> = _uiState.asStateFlow()

    fun loadPage(pageId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Observe the page
                useCase.observePage(pageId)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { page ->
                        if (page != null) {
                            val toc = useCase.extractTableOfContents(page.content)
                            _uiState.update {
                                it.copy(
                                    page = page,
                                    tableOfContents = toc,
                                    isLoading = false
                                )
                            }
                        } else {
                            _uiState.update { it.copy(error = "Page not found", isLoading = false) }
                        }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun loadPageBySlug(slug: String, groupId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val page = useCase.getPageBySlug(slug, groupId)
                if (page != null) {
                    val toc = useCase.extractTableOfContents(page.content)
                    _uiState.update {
                        it.copy(
                            page = page,
                            tableOfContents = toc,
                            isLoading = false
                        )
                    }
                    loadRevisions(page.id)
                } else {
                    _uiState.update { it.copy(error = "Page not found", isLoading = false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun loadRevisions(pageId: String) {
        viewModelScope.launch {
            try {
                useCase.getRevisionsByPage(pageId)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { revisions ->
                        _uiState.update { it.copy(revisions = revisions) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
