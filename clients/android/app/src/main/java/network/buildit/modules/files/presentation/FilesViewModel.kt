package network.buildit.modules.files.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.files.data.local.FileEntity
import network.buildit.modules.files.domain.FilesUseCase
import javax.inject.Inject

/**
 * UI state for the files screen.
 */
data class FilesUiState(
    val files: List<FileEntity> = emptyList(),
    val breadcrumbs: List<BreadcrumbItem> = emptyList(),
    val groupId: String? = null,
    val currentFolderId: String? = null,
    val searchQuery: String = "",
    val searchResults: List<FileEntity> = emptyList(),
    val isSearching: Boolean = false,
    val isLoading: Boolean = true,
    val error: String? = null,
    val fileCount: Int = 0,
    val totalSize: Long = 0
)

/**
 * Breadcrumb navigation item.
 */
data class BreadcrumbItem(
    val id: String?,
    val name: String
)

/**
 * ViewModel for the Files module.
 */
@HiltViewModel
class FilesViewModel @Inject constructor(
    private val filesUseCase: FilesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FilesUiState())
    val uiState: StateFlow<FilesUiState> = _uiState.asStateFlow()

    /**
     * Loads files at root level or in a folder.
     */
    fun loadFiles(groupId: String, folderId: String? = null) {
        _uiState.update {
            it.copy(
                groupId = groupId,
                currentFolderId = folderId,
                isLoading = true,
                error = null,
                searchQuery = "",
                isSearching = false
            )
        }

        viewModelScope.launch {
            val filesFlow = if (folderId != null) {
                filesUseCase.getFilesInFolder(groupId, folderId)
            } else {
                filesUseCase.getRootFiles(groupId)
            }

            filesFlow
                .catch { e -> _uiState.update { it.copy(error = e.message, isLoading = false) } }
                .collect { files ->
                    _uiState.update { it.copy(files = files, isLoading = false) }
                }
        }

        // Update breadcrumbs
        viewModelScope.launch {
            val breadcrumbs = buildBreadcrumbs(folderId)
            _uiState.update { it.copy(breadcrumbs = breadcrumbs) }
        }

        // Load stats
        viewModelScope.launch {
            try {
                val count = filesUseCase.getFileCount(groupId)
                val size = filesUseCase.getTotalSize(groupId)
                _uiState.update { it.copy(fileCount = count, totalSize = size) }
            } catch (_: Exception) { /* non-critical */ }
        }
    }

    /**
     * Navigates into a folder.
     */
    fun openFolder(folderId: String) {
        val groupId = _uiState.value.groupId ?: return
        loadFiles(groupId, folderId)
    }

    /**
     * Navigates up one level.
     */
    fun navigateUp() {
        val groupId = _uiState.value.groupId ?: return
        val breadcrumbs = _uiState.value.breadcrumbs
        if (breadcrumbs.size >= 2) {
            loadFiles(groupId, breadcrumbs[breadcrumbs.size - 2].id)
        } else {
            loadFiles(groupId, null)
        }
    }

    /**
     * Creates a new folder.
     */
    fun createFolder(name: String, description: String? = null) {
        val groupId = _uiState.value.groupId ?: return

        viewModelScope.launch {
            when (val result = filesUseCase.createFolder(
                groupId = groupId,
                name = name,
                parentFolderId = _uiState.value.currentFolderId,
                description = description
            )) {
                is ModuleResult.Success -> {
                    loadFiles(groupId, _uiState.value.currentFolderId)
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Files module not enabled") }
                }
            }
        }
    }

    /**
     * Deletes a file or folder.
     */
    fun deleteFile(fileId: String) {
        viewModelScope.launch {
            when (val result = filesUseCase.deleteFile(fileId)) {
                is ModuleResult.Success -> {
                    val groupId = _uiState.value.groupId ?: return@launch
                    loadFiles(groupId, _uiState.value.currentFolderId)
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Files module not enabled") }
                }
            }
        }
    }

    /**
     * Renames a file or folder.
     */
    fun renameFile(fileId: String, newName: String) {
        viewModelScope.launch {
            when (val result = filesUseCase.renameFile(fileId, newName)) {
                is ModuleResult.Success -> {
                    val groupId = _uiState.value.groupId ?: return@launch
                    loadFiles(groupId, _uiState.value.currentFolderId)
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Files module not enabled") }
                }
            }
        }
    }

    /**
     * Searches files.
     */
    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        val groupId = _uiState.value.groupId ?: return

        if (query.isBlank()) {
            _uiState.update { it.copy(isSearching = false, searchResults = emptyList()) }
            return
        }

        _uiState.update { it.copy(isSearching = true) }

        viewModelScope.launch {
            filesUseCase.searchFiles(groupId, query)
                .catch { e -> _uiState.update { it.copy(error = e.message, isSearching = false) } }
                .collect { results ->
                    _uiState.update { it.copy(searchResults = results, isSearching = false) }
                }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private suspend fun buildBreadcrumbs(folderId: String?): List<BreadcrumbItem> {
        val crumbs = mutableListOf(BreadcrumbItem(null, "Root"))
        var currentId = folderId

        while (currentId != null) {
            val folder = filesUseCase.getFile(currentId) ?: break
            crumbs.add(1, BreadcrumbItem(folder.id, folder.name))
            currentId = folder.parentFolderId
        }

        return crumbs
    }
}
