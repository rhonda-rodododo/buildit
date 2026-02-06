package network.buildit.modules.wiki.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.modules.wiki.data.local.WikiCategoryEntity
import network.buildit.modules.wiki.domain.WikiUseCase
import javax.inject.Inject

/**
 * UI state for the wiki editor screen.
 */
data class WikiEditorUiState(
    val pageId: String? = null,
    val groupId: String = "",
    val title: String = "",
    val content: String = "",
    val editSummary: String = "",
    val tags: List<String> = emptyList(),
    val categoryId: String? = null,
    val availableCategories: List<CategoryOption> = emptyList(),
    val editorMode: WikiEditorMode = WikiEditorMode.EDIT,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isNewPage: Boolean = true,
    val isDirty: Boolean = false,
    val error: String? = null
) {
    val canSave: Boolean
        get() = title.isNotBlank() && content.isNotBlank() && !isSaving
}

/**
 * ViewModel for the wiki editor screen.
 */
@HiltViewModel
class WikiEditorViewModel @Inject constructor(
    private val useCase: WikiUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WikiEditorUiState())
    val uiState: StateFlow<WikiEditorUiState> = _uiState.asStateFlow()

    /**
     * Initialize the editor with either an existing page or a blank new page.
     */
    fun initialize(pageId: String?, groupId: String) {
        _uiState.update { it.copy(groupId = groupId, isLoading = pageId != null) }

        // Load available categories
        viewModelScope.launch {
            useCase.getCategoriesByGroup(groupId).collect { categories ->
                _uiState.update {
                    it.copy(
                        availableCategories = categories.map { cat ->
                            CategoryOption(id = cat.id, name = cat.name)
                        }
                    )
                }
            }
        }

        // If editing existing page, load it
        if (pageId != null) {
            viewModelScope.launch {
                try {
                    val page = useCase.getPageById(pageId)
                    if (page != null) {
                        _uiState.update {
                            it.copy(
                                pageId = page.id,
                                title = page.title,
                                content = page.content,
                                tags = page.tags,
                                categoryId = page.categoryId,
                                isNewPage = false,
                                isLoading = false
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(error = "Page not found", isLoading = false)
                        }
                    }
                } catch (e: Exception) {
                    _uiState.update {
                        it.copy(error = e.message, isLoading = false)
                    }
                }
            }
        }
    }

    fun updateTitle(title: String) {
        _uiState.update { it.copy(title = title, isDirty = true) }
    }

    fun updateContent(content: String) {
        _uiState.update { it.copy(content = content, isDirty = true) }
    }

    fun updateEditSummary(summary: String) {
        _uiState.update { it.copy(editSummary = summary) }
    }

    fun updateTags(tags: List<String>) {
        _uiState.update { it.copy(tags = tags, isDirty = true) }
    }

    fun updateCategory(categoryId: String?) {
        _uiState.update { it.copy(categoryId = categoryId, isDirty = true) }
    }

    fun toggleEditorMode() {
        _uiState.update {
            val nextMode = when (it.editorMode) {
                WikiEditorMode.EDIT -> WikiEditorMode.PREVIEW
                WikiEditorMode.PREVIEW -> WikiEditorMode.SPLIT
                WikiEditorMode.SPLIT -> WikiEditorMode.EDIT
            }
            it.copy(editorMode = nextMode)
        }
    }

    /**
     * Insert markdown formatting at the current position.
     * Since we can't track cursor position in BasicTextField easily,
     * we append to the content.
     */
    fun insertMarkdown(insert: MarkdownInsert) {
        val currentContent = _uiState.value.content
        val insertion = when (insert) {
            MarkdownInsert.BOLD -> "**bold text**"
            MarkdownInsert.ITALIC -> "*italic text*"
            MarkdownInsert.HEADING -> "\n## Heading\n"
            MarkdownInsert.BULLET_LIST -> "\n- Item 1\n- Item 2\n- Item 3\n"
            MarkdownInsert.NUMBERED_LIST -> "\n1. First item\n2. Second item\n3. Third item\n"
            MarkdownInsert.CHECKLIST -> "\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n"
            MarkdownInsert.LINK -> "[link text](url)"
            MarkdownInsert.CODE -> "`code`"
            MarkdownInsert.CODE_BLOCK -> "\n```\ncode block\n```\n"
            MarkdownInsert.BLOCKQUOTE -> "\n> quoted text\n"
            MarkdownInsert.HORIZONTAL_RULE -> "\n---\n"
        }
        updateContent(currentContent + insertion)
    }

    /**
     * Save the page (create or update).
     */
    fun save(onSaved: (String) -> Unit) {
        val state = _uiState.value
        if (!state.canSave) return

        _uiState.update { it.copy(isSaving = true) }

        viewModelScope.launch {
            try {
                // For now, log the save action
                // In production this would call useCase.createPage or useCase.updatePage
                android.util.Log.d(
                    "WikiEditor",
                    "Saving page: title='${state.title}', " +
                        "content length=${state.content.length}, " +
                        "tags=${state.tags}, " +
                        "category=${state.categoryId}"
                )

                val pageId = state.pageId ?: java.util.UUID.randomUUID().toString()

                _uiState.update {
                    it.copy(
                        pageId = pageId,
                        isSaving = false,
                        isDirty = false,
                        isNewPage = false
                    )
                }

                onSaved(pageId)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message, isSaving = false)
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
