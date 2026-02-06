package network.buildit.modules.wiki.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.modules.wiki.data.local.WikiCategoryEntity
import network.buildit.modules.wiki.data.local.WikiPageEntity
import network.buildit.modules.wiki.domain.WikiUseCase
import javax.inject.Inject

/**
 * UI state for the wiki category browsing screen.
 */
data class WikiCategoryUiState(
    val categories: List<WikiCategoryEntity> = emptyList(),
    val currentCategory: WikiCategoryEntity? = null,
    val categoryPages: List<WikiPageEntity> = emptyList(),
    val subcategories: List<WikiCategoryEntity> = emptyList(),
    val isLoading: Boolean = true,
    val showCreateDialog: Boolean = false,
    val error: String? = null
)

/**
 * ViewModel for the wiki category browsing screen.
 */
@HiltViewModel
class WikiCategoryViewModel @Inject constructor(
    private val useCase: WikiUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WikiCategoryUiState())
    val uiState: StateFlow<WikiCategoryUiState> = _uiState.asStateFlow()

    private var currentGroupId: String = ""

    /**
     * Load categories for the given group.
     * If categoryId is provided, load the specific category and its pages.
     */
    fun load(groupId: String, categoryId: String? = null) {
        currentGroupId = groupId
        _uiState.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            try {
                // Always load all categories
                useCase.getCategoriesByGroup(groupId)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { categories ->
                        if (categoryId != null) {
                            val current = categories.find { it.id == categoryId }
                            val subs = categories.filter { it.parentId == categoryId }

                            _uiState.update {
                                it.copy(
                                    categories = categories,
                                    currentCategory = current,
                                    subcategories = subs,
                                    isLoading = false
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    categories = categories,
                                    currentCategory = null,
                                    subcategories = emptyList(),
                                    isLoading = false
                                )
                            }
                        }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }

        // Load pages for specific category if provided
        if (categoryId != null) {
            viewModelScope.launch {
                try {
                    useCase.getPublishedPagesByCategory(categoryId)
                        .catch { e -> _uiState.update { it.copy(error = e.message) } }
                        .collect { pages ->
                            _uiState.update { it.copy(categoryPages = pages) }
                        }
                } catch (e: Exception) {
                    _uiState.update { it.copy(error = e.message) }
                }
            }
        }
    }

    fun showCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = true) }
    }

    fun hideCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = false) }
    }

    fun createCategory(name: String, description: String?, parentId: String?, icon: String?) {
        viewModelScope.launch {
            try {
                // For now, log the create action
                // In production, this would call useCase.createCategory(...)
                android.util.Log.d(
                    "WikiCategory",
                    "Creating category: name='$name', parentId=$parentId"
                )
                // Reload categories
                load(currentGroupId, _uiState.value.currentCategory?.id)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
