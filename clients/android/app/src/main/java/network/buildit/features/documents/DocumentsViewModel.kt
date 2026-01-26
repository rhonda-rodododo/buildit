package network.buildit.features.documents

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel for Documents feature.
 *
 * Manages document listing and viewing (read-only for now).
 */
@HiltViewModel
class DocumentsViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(DocumentsUiState())
    val uiState: StateFlow<DocumentsUiState> = _uiState.asStateFlow()

    private val _documents = MutableStateFlow<List<Document>>(emptyList())
    val documents: StateFlow<List<Document>> = _documents.asStateFlow()

    private val _selectedDocument = MutableStateFlow<Document?>(null)
    val selectedDocument: StateFlow<Document?> = _selectedDocument.asStateFlow()

    init {
        loadDocuments()
    }

    /**
     * Loads documents from local storage and synced groups.
     */
    fun loadDocuments() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                // For now, load sample documents
                // In production, this would fetch from local storage and group sync
                val docs = listOf(
                    Document(
                        id = UUID.randomUUID().toString(),
                        title = "Getting Started Guide",
                        content = """
                            # Getting Started with BuildIt

                            Welcome to BuildIt, a privacy-first organizing platform.

                            ## Key Features

                            - **End-to-end encryption** - All messages are encrypted
                            - **BLE mesh networking** - Works without internet
                            - **Decentralized** - No central server required

                            ## Quick Start

                            1. Create your identity
                            2. Connect with nearby devices
                            3. Join or create a group
                            4. Start organizing!
                        """.trimIndent(),
                        type = DocumentType.MARKDOWN,
                        createdAt = System.currentTimeMillis() - 86400000,
                        updatedAt = System.currentTimeMillis(),
                        groupId = null
                    ),
                    Document(
                        id = UUID.randomUUID().toString(),
                        title = "Meeting Notes - Jan 20",
                        content = """
                            # Weekly Sync Meeting

                            **Date:** January 20, 2026
                            **Attendees:** Alice, Bob, Charlie

                            ## Agenda

                            1. Project updates
                            2. Upcoming events
                            3. Action items

                            ## Discussion

                            - Reviewed progress on community outreach
                            - Discussed venue for next event
                            - Assigned tasks for the week

                            ## Action Items

                            - [ ] Alice: Contact venue
                            - [ ] Bob: Update flyers
                            - [ ] Charlie: Send reminder emails
                        """.trimIndent(),
                        type = DocumentType.MARKDOWN,
                        createdAt = System.currentTimeMillis() - 172800000,
                        updatedAt = System.currentTimeMillis() - 86400000,
                        groupId = "group-1"
                    )
                )

                _documents.value = docs
                _uiState.value = _uiState.value.copy(isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            }
        }
    }

    /**
     * Selects a document to view.
     */
    fun selectDocument(document: Document) {
        _selectedDocument.value = document
    }

    /**
     * Clears the selected document.
     */
    fun clearSelection() {
        _selectedDocument.value = null
    }

    /**
     * Searches documents by title or content.
     */
    fun searchDocuments(query: String) {
        if (query.isBlank()) {
            loadDocuments()
            return
        }

        viewModelScope.launch {
            val allDocs = _documents.value
            val filtered = allDocs.filter { doc ->
                doc.title.contains(query, ignoreCase = true) ||
                doc.content.contains(query, ignoreCase = true)
            }
            _documents.value = filtered
        }
    }

    /**
     * Refreshes the document list.
     */
    fun refresh() {
        loadDocuments()
    }

    /**
     * Clears error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

/**
 * UI state for Documents feature.
 */
data class DocumentsUiState(
    val isLoading: Boolean = false,
    val error: String? = null
)

/**
 * Represents a document.
 */
data class Document(
    val id: String,
    val title: String,
    val content: String,
    val type: DocumentType,
    val createdAt: Long,
    val updatedAt: Long,
    val groupId: String?
)

/**
 * Types of documents supported.
 */
enum class DocumentType {
    MARKDOWN,
    PLAIN_TEXT,
    RICH_TEXT
}
