package network.buildit.modules.contacts.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.modules.contacts.data.local.*
import network.buildit.modules.contacts.domain.ContactNotesUseCase
import javax.inject.Inject

/**
 * UI state for the contact notes screen.
 */
data class ContactNotesUiState(
    val notes: List<ContactNoteEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * UI state for the contact tags screen.
 */
data class ContactTagsUiState(
    val allTags: List<ContactTagEntity> = emptyList(),
    val assignedTagIds: Set<String> = emptySet(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * UI state for the tag manager screen.
 */
data class TagManagerUiState(
    val tags: List<TagWithUsage> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

data class TagWithUsage(
    val tag: ContactTagEntity,
    val usageCount: Int
)

/**
 * ViewModel for contact notes.
 */
@HiltViewModel
class ContactNotesViewModel @Inject constructor(
    private val useCase: ContactNotesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(ContactNotesUiState())
    val uiState: StateFlow<ContactNotesUiState> = _uiState.asStateFlow()

    private var currentContactPubkey: String = ""

    fun loadNotes(contactPubkey: String) {
        currentContactPubkey = contactPubkey
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                useCase.getNotesByContact(contactPubkey)
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { notes ->
                        _uiState.update { it.copy(notes = notes, isLoading = false) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun createNote(content: String, category: NoteCategory) {
        viewModelScope.launch {
            try {
                useCase.createNote(currentContactPubkey, content, category)
                // Flow will automatically update the list
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun updateNote(note: ContactNoteEntity, content: String, category: NoteCategory) {
        viewModelScope.launch {
            try {
                useCase.updateNote(note, content, category)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun deleteNote(noteId: String) {
        viewModelScope.launch {
            try {
                useCase.deleteNote(noteId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

/**
 * ViewModel for contact tags.
 */
@HiltViewModel
class ContactTagsViewModel @Inject constructor(
    private val useCase: ContactNotesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(ContactTagsUiState())
    val uiState: StateFlow<ContactTagsUiState> = _uiState.asStateFlow()

    private var currentContactPubkey: String = ""

    fun loadTags(contactPubkey: String) {
        currentContactPubkey = contactPubkey
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Load all available tags
                useCase.getAllTags()
                    .combine(useCase.getTagsForContact(contactPubkey)) { all, assigned ->
                        Pair(all, assigned.map { it.id }.toSet())
                    }
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { (all, assignedIds) ->
                        _uiState.update {
                            it.copy(
                                allTags = all,
                                assignedTagIds = assignedIds,
                                isLoading = false
                            )
                        }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun toggleTag(tagId: String) {
        viewModelScope.launch {
            try {
                val currentAssigned = _uiState.value.assignedTagIds
                if (tagId in currentAssigned) {
                    useCase.removeTag(currentContactPubkey, tagId)
                } else {
                    useCase.assignTag(currentContactPubkey, tagId)
                }
                // Flow will automatically update
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun createTag(name: String, color: String) {
        viewModelScope.launch {
            try {
                useCase.createTag(name, color)
                // Flow will automatically update
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

/**
 * ViewModel for tag manager.
 */
@HiltViewModel
class TagManagerViewModel @Inject constructor(
    private val useCase: ContactNotesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(TagManagerUiState())
    val uiState: StateFlow<TagManagerUiState> = _uiState.asStateFlow()

    init {
        loadTags()
    }

    private fun loadTags() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                useCase.getAllTags()
                    .catch { e -> _uiState.update { it.copy(error = e.message) } }
                    .collect { tags ->
                        val tagsWithUsage = tags.map { tag ->
                            TagWithUsage(
                                tag = tag,
                                usageCount = useCase.getTagUsageCount(tag.id)
                            )
                        }
                        _uiState.update { it.copy(tags = tagsWithUsage, isLoading = false) }
                    }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun createTag(name: String, color: String) {
        viewModelScope.launch {
            try {
                useCase.createTag(name, color)
                // Flow will automatically update
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun updateTag(tag: ContactTagEntity, name: String, color: String) {
        viewModelScope.launch {
            try {
                useCase.updateTag(tag, name, color)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun deleteTag(tagId: String) {
        viewModelScope.launch {
            try {
                useCase.deleteTag(tagId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

/**
 * ViewModel for follow-up notes.
 */
@HiltViewModel
class FollowUpNotesViewModel @Inject constructor(
    private val useCase: ContactNotesUseCase
) : ViewModel() {

    private val _notes = MutableStateFlow<List<ContactNoteEntity>>(emptyList())
    val notes: StateFlow<List<ContactNoteEntity>> = _notes.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadFollowUps()
    }

    private fun loadFollowUps() {
        viewModelScope.launch {
            _isLoading.value = true
            useCase.getFollowUpNotes().collect { followUps ->
                _notes.value = followUps
                _isLoading.value = false
            }
        }
    }
}
