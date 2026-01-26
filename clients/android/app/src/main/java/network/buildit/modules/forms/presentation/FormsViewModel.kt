package network.buildit.modules.forms.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.modules.forms.data.FieldStats
import network.buildit.modules.forms.data.FormAnalytics
import network.buildit.modules.forms.data.local.ConditionalLogic
import network.buildit.modules.forms.data.local.ConditionalOperator
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FieldValidation
import network.buildit.modules.forms.data.local.FormEntity
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormFieldType
import network.buildit.modules.forms.data.local.FormResponseEntity
import network.buildit.modules.forms.data.local.FormStatus
import network.buildit.modules.forms.data.local.FormVisibility
import network.buildit.modules.forms.domain.FormsUseCase
import java.util.UUID
import javax.inject.Inject

// MARK: - Forms List ViewModel

/**
 * UI state for the forms list screen.
 */
data class FormsListUiState(
    val forms: List<FormEntity> = emptyList(),
    val myForms: List<FormEntity> = emptyList(),
    val selectedTab: Int = 0, // 0 = All Open, 1 = My Forms
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for the forms list screen.
 */
@HiltViewModel
class FormsListViewModel @Inject constructor(
    private val useCase: FormsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FormsListUiState())
    val uiState: StateFlow<FormsListUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.getOpenForms().collect { forms ->
                _uiState.update {
                    it.copy(forms = forms, isLoading = false)
                }
            }
        }

        viewModelScope.launch {
            useCase.getMyForms().collect { forms ->
                _uiState.update { it.copy(myForms = forms) }
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun deleteForm(formId: String) {
        viewModelScope.launch {
            try {
                useCase.deleteForm(formId)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}

// MARK: - Form Detail ViewModel

/**
 * UI state for form detail/fill screen.
 */
data class FormDetailUiState(
    val form: FormEntity? = null,
    val answers: Map<String, String> = emptyMap(),
    val visibleFields: List<FormField> = emptyList(),
    val hasResponded: Boolean = false,
    val existingResponse: FormResponseEntity? = null,
    val isLoading: Boolean = true,
    val isSubmitting: Boolean = false,
    val isComplete: Boolean = false,
    val validationErrors: Map<String, String> = emptyMap(),
    val errorMessage: String? = null
)

/**
 * ViewModel for form detail/fill screen.
 */
@HiltViewModel
class FormDetailViewModel @Inject constructor(
    private val useCase: FormsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FormDetailUiState())
    val uiState: StateFlow<FormDetailUiState> = _uiState.asStateFlow()

    fun loadForm(formId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.observeForm(formId).collect { form ->
                if (form != null) {
                    val visibleFields = useCase.getVisibleFields(form, _uiState.value.answers)
                    _uiState.update {
                        it.copy(
                            form = form,
                            visibleFields = visibleFields,
                            isLoading = false
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Form not found"
                        )
                    }
                }
            }
        }

        // Check if user has already responded
        viewModelScope.launch {
            val hasResponded = useCase.hasResponded(formId)
            val existingResponse = if (hasResponded) useCase.getUserResponse(formId) else null
            _uiState.update {
                it.copy(
                    hasResponded = hasResponded,
                    existingResponse = existingResponse
                )
            }
        }
    }

    fun updateAnswer(fieldId: String, value: String) {
        val newAnswers = _uiState.value.answers.toMutableMap()
        newAnswers[fieldId] = value

        val form = _uiState.value.form ?: return
        val visibleFields = useCase.getVisibleFields(form, newAnswers)

        // Clear validation error for this field
        val newErrors = _uiState.value.validationErrors.toMutableMap()
        newErrors.remove(fieldId)

        _uiState.update {
            it.copy(
                answers = newAnswers,
                visibleFields = visibleFields,
                validationErrors = newErrors
            )
        }
    }

    fun submit() {
        val form = _uiState.value.form ?: return
        val answers = _uiState.value.answers

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null, validationErrors = emptyMap()) }

            try {
                useCase.submitResponse(form.id, answers)
                _uiState.update { it.copy(isSubmitting = false, isComplete = true) }
            } catch (e: IllegalArgumentException) {
                // Parse validation error
                val message = e.message ?: "Validation error"
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = message
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to submit response"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}

// MARK: - Form Builder ViewModel

/**
 * UI state for form builder screen.
 */
data class FormBuilderUiState(
    val title: String = "",
    val description: String = "",
    val fields: List<FormField> = emptyList(),
    val visibility: FormVisibility = FormVisibility.GROUP,
    val anonymous: Boolean = false,
    val allowMultiple: Boolean = false,
    val hasClosingDate: Boolean = false,
    val closesAt: Long? = null,
    val maxResponses: Int? = null,
    val confirmationMessage: String = "",
    val editingFieldIndex: Int? = null,
    val isSubmitting: Boolean = false,
    val isComplete: Boolean = false,
    val createdFormId: String? = null,
    val errorMessage: String? = null
)

/**
 * ViewModel for form builder screen.
 */
@HiltViewModel
class FormBuilderViewModel @Inject constructor(
    private val useCase: FormsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FormBuilderUiState())
    val uiState: StateFlow<FormBuilderUiState> = _uiState.asStateFlow()

    fun updateTitle(title: String) {
        _uiState.update { it.copy(title = title) }
    }

    fun updateDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun updateVisibility(visibility: FormVisibility) {
        _uiState.update { it.copy(visibility = visibility) }
    }

    fun updateAnonymous(anonymous: Boolean) {
        _uiState.update { it.copy(anonymous = anonymous) }
    }

    fun updateAllowMultiple(allowMultiple: Boolean) {
        _uiState.update { it.copy(allowMultiple = allowMultiple) }
    }

    fun updateHasClosingDate(hasClosingDate: Boolean) {
        _uiState.update { it.copy(hasClosingDate = hasClosingDate) }
    }

    fun updateClosesAt(closesAt: Long?) {
        _uiState.update { it.copy(closesAt = closesAt) }
    }

    fun updateMaxResponses(maxResponses: Int?) {
        _uiState.update { it.copy(maxResponses = maxResponses) }
    }

    fun updateConfirmationMessage(message: String) {
        _uiState.update { it.copy(confirmationMessage = message) }
    }

    fun addField(type: FormFieldType) {
        val newField = FormField(
            id = UUID.randomUUID().toString(),
            type = type,
            label = getDefaultLabel(type),
            required = false,
            options = if (type.needsOptions()) getDefaultOptions() else null,
            order = _uiState.value.fields.size
        )

        val fields = _uiState.value.fields.toMutableList()
        fields.add(newField)
        _uiState.update { it.copy(fields = fields, editingFieldIndex = fields.size - 1) }
    }

    fun updateField(index: Int, field: FormField) {
        val fields = _uiState.value.fields.toMutableList()
        if (index >= 0 && index < fields.size) {
            fields[index] = field
            _uiState.update { it.copy(fields = fields) }
        }
    }

    fun removeField(index: Int) {
        val fields = _uiState.value.fields.toMutableList()
        if (index >= 0 && index < fields.size) {
            fields.removeAt(index)
            // Update order for remaining fields
            fields.forEachIndexed { i, f ->
                fields[i] = f.copy(order = i)
            }
            _uiState.update { it.copy(fields = fields, editingFieldIndex = null) }
        }
    }

    fun moveField(fromIndex: Int, toIndex: Int) {
        val fields = _uiState.value.fields.toMutableList()
        if (fromIndex >= 0 && fromIndex < fields.size && toIndex >= 0 && toIndex < fields.size) {
            val field = fields.removeAt(fromIndex)
            fields.add(toIndex, field)
            // Update order for all fields
            fields.forEachIndexed { i, f ->
                fields[i] = f.copy(order = i)
            }
            _uiState.update { it.copy(fields = fields) }
        }
    }

    fun duplicateField(index: Int) {
        val fields = _uiState.value.fields.toMutableList()
        if (index >= 0 && index < fields.size) {
            val original = fields[index]
            val duplicate = original.copy(
                id = UUID.randomUUID().toString(),
                label = "${original.label} (copy)",
                order = fields.size
            )
            fields.add(duplicate)
            _uiState.update { it.copy(fields = fields) }
        }
    }

    fun setEditingField(index: Int?) {
        _uiState.update { it.copy(editingFieldIndex = index) }
    }

    fun isValid(): Boolean {
        val state = _uiState.value
        return state.title.isNotBlank() && state.fields.isNotEmpty()
    }

    fun saveDraft(groupId: String?) {
        if (_uiState.value.title.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Title is required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val state = _uiState.value

                val form = useCase.createForm(
                    title = state.title.trim(),
                    description = state.description.ifBlank { null },
                    fields = state.fields,
                    groupId = groupId,
                    visibility = state.visibility,
                    anonymous = state.anonymous,
                    allowMultiple = state.allowMultiple,
                    closesAt = if (state.hasClosingDate) state.closesAt else null,
                    maxResponses = state.maxResponses,
                    confirmationMessage = state.confirmationMessage.ifBlank { null },
                    publishImmediately = false
                )

                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        isComplete = true,
                        createdFormId = form.id
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to save form"
                    )
                }
            }
        }
    }

    fun publish(groupId: String?) {
        if (!isValid()) {
            _uiState.update { it.copy(errorMessage = "Form must have a title and at least one field") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val state = _uiState.value

                val form = useCase.createForm(
                    title = state.title.trim(),
                    description = state.description.ifBlank { null },
                    fields = state.fields,
                    groupId = groupId,
                    visibility = state.visibility,
                    anonymous = state.anonymous,
                    allowMultiple = state.allowMultiple,
                    closesAt = if (state.hasClosingDate) state.closesAt else null,
                    maxResponses = state.maxResponses,
                    confirmationMessage = state.confirmationMessage.ifBlank { null },
                    publishImmediately = true
                )

                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        isComplete = true,
                        createdFormId = form.id
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to publish form"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    private fun getDefaultLabel(type: FormFieldType): String {
        return when (type) {
            FormFieldType.TEXT -> "Short answer"
            FormFieldType.TEXTAREA -> "Long answer"
            FormFieldType.NUMBER -> "Number"
            FormFieldType.EMAIL -> "Email address"
            FormFieldType.PHONE -> "Phone number"
            FormFieldType.URL -> "Website URL"
            FormFieldType.DATE -> "Date"
            FormFieldType.TIME -> "Time"
            FormFieldType.DATETIME -> "Date and time"
            FormFieldType.SELECT -> "Dropdown"
            FormFieldType.MULTISELECT -> "Multi-select"
            FormFieldType.RADIO -> "Multiple choice"
            FormFieldType.CHECKBOX -> "Checkboxes"
            FormFieldType.FILE -> "File upload"
            FormFieldType.RATING -> "Rating"
            FormFieldType.SCALE -> "Scale"
        }
    }

    private fun getDefaultOptions(): List<FieldOption> {
        return listOf(
            FieldOption("option_1", "Option 1"),
            FieldOption("option_2", "Option 2"),
            FieldOption("option_3", "Option 3")
        )
    }

    private fun FormFieldType.needsOptions(): Boolean {
        return this in listOf(
            FormFieldType.SELECT,
            FormFieldType.MULTISELECT,
            FormFieldType.RADIO,
            FormFieldType.CHECKBOX
        )
    }
}

// MARK: - Form Responses ViewModel

/**
 * UI state for form responses screen.
 */
data class FormResponsesUiState(
    val form: FormEntity? = null,
    val responses: List<FormResponseEntity> = emptyList(),
    val analytics: FormAnalytics? = null,
    val selectedTab: Int = 0, // 0 = Responses, 1 = Analytics
    val isLoading: Boolean = true,
    val errorMessage: String? = null
)

/**
 * ViewModel for form responses screen.
 */
@HiltViewModel
class FormResponsesViewModel @Inject constructor(
    private val useCase: FormsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FormResponsesUiState())
    val uiState: StateFlow<FormResponsesUiState> = _uiState.asStateFlow()

    fun loadForm(formId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.observeForm(formId).collect { form ->
                _uiState.update { it.copy(form = form, isLoading = false) }
            }
        }

        viewModelScope.launch {
            useCase.getResponsesForForm(formId).collect { responses ->
                _uiState.update { it.copy(responses = responses) }
            }
        }

        viewModelScope.launch {
            try {
                val analytics = useCase.getFormAnalytics(formId)
                _uiState.update { it.copy(analytics = analytics) }
            } catch (e: Exception) {
                // Ignore analytics errors
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun closeForm(formId: String) {
        viewModelScope.launch {
            try {
                useCase.closeForm(formId)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
