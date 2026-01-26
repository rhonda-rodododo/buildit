package network.buildit.modules.forms.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.forms.data.FieldStats
import network.buildit.modules.forms.data.FormAnalytics
import network.buildit.modules.forms.data.FormsRepository
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
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for forms business logic.
 */
@Singleton
class FormsUseCase @Inject constructor(
    private val repository: FormsRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    companion object {
        const val KIND_FORM = 40031
        const val KIND_RESPONSE = 40032
    }

    private val json = Json { ignoreUnknownKeys = true }

    // Current user ID
    private val currentUserId: String
        get() = cryptoManager.getPublicKeyHex() ?: ""

    // MARK: - Forms

    fun getAllForms(): Flow<List<FormEntity>> = repository.getAllForms()

    fun getOpenForms(): Flow<List<FormEntity>> = repository.getOpenForms()

    fun getFormsByGroup(groupId: String): Flow<List<FormEntity>> =
        repository.getFormsByGroup(groupId)

    fun getOpenFormsByGroup(groupId: String): Flow<List<FormEntity>> =
        repository.getOpenFormsByGroup(groupId)

    fun getMyForms(): Flow<List<FormEntity>> =
        repository.getFormsByCreator(currentUserId)

    fun observeForm(id: String): Flow<FormEntity?> = repository.observeForm(id)

    suspend fun getFormById(id: String): FormEntity? = repository.getFormById(id)

    fun searchForms(query: String): Flow<List<FormEntity>> = repository.searchForms(query)

    suspend fun createForm(
        title: String,
        description: String? = null,
        fields: List<FormField>,
        groupId: String? = null,
        visibility: FormVisibility = FormVisibility.GROUP,
        anonymous: Boolean = false,
        allowMultiple: Boolean = false,
        opensAt: Long? = null,
        closesAt: Long? = null,
        maxResponses: Int? = null,
        confirmationMessage: String? = null,
        publishImmediately: Boolean = false
    ): FormEntity {
        // Validate fields
        validateFields(fields)

        val status = if (publishImmediately) FormStatus.OPEN else FormStatus.DRAFT

        val form = repository.createForm(
            title = title,
            description = description,
            fields = fields,
            groupId = groupId,
            visibility = visibility,
            anonymous = anonymous,
            allowMultiple = allowMultiple,
            opensAt = opensAt,
            closesAt = closesAt,
            maxResponses = maxResponses,
            confirmationMessage = confirmationMessage,
            createdBy = currentUserId,
            status = status
        )

        if (publishImmediately) {
            publishFormToNostr(form)
        }

        return form
    }

    suspend fun updateForm(
        formId: String,
        title: String? = null,
        description: String? = null,
        fields: List<FormField>? = null,
        visibility: FormVisibility? = null,
        anonymous: Boolean? = null,
        allowMultiple: Boolean? = null,
        opensAt: Long? = null,
        closesAt: Long? = null,
        maxResponses: Int? = null,
        confirmationMessage: String? = null
    ): FormEntity {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        if (form.createdBy != currentUserId) {
            throw SecurityException("Not authorized to edit this form")
        }

        if (form.status != FormStatus.DRAFT) {
            throw IllegalStateException("Cannot edit a published form")
        }

        fields?.let { validateFields(it) }

        val updated = form.copy(
            title = title ?: form.title,
            description = description ?: form.description,
            fieldsJson = fields?.let { FormEntity.encodeFields(it) } ?: form.fieldsJson,
            visibility = visibility ?: form.visibility,
            anonymous = anonymous ?: form.anonymous,
            allowMultiple = allowMultiple ?: form.allowMultiple,
            opensAt = opensAt ?: form.opensAt,
            closesAt = closesAt ?: form.closesAt,
            maxResponses = maxResponses ?: form.maxResponses,
            confirmationMessage = confirmationMessage ?: form.confirmationMessage,
            updatedAt = System.currentTimeMillis()
        )

        repository.updateForm(updated)
        return updated
    }

    suspend fun publishForm(formId: String): FormEntity {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        if (form.createdBy != currentUserId) {
            throw SecurityException("Not authorized to publish this form")
        }

        if (form.status != FormStatus.DRAFT) {
            throw IllegalStateException("Form is already published")
        }

        if (form.fields.isEmpty()) {
            throw IllegalStateException("Form must have at least one field")
        }

        repository.publishForm(formId)
        val published = repository.getFormById(formId)!!

        publishFormToNostr(published)
        return published
    }

    suspend fun closeForm(formId: String) {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        if (form.createdBy != currentUserId) {
            throw SecurityException("Not authorized to close this form")
        }

        repository.closeForm(formId)
        publishFormDeletion(formId)
    }

    suspend fun deleteForm(formId: String) {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        if (form.createdBy != currentUserId) {
            throw SecurityException("Not authorized to delete this form")
        }

        repository.deleteForm(formId)
        publishFormDeletion(formId)
    }

    // MARK: - Responses

    fun getResponsesForForm(formId: String): Flow<List<FormResponseEntity>> =
        repository.getResponsesForForm(formId)

    fun getMyResponses(): Flow<List<FormResponseEntity>> =
        repository.getResponsesByUser(currentUserId)

    suspend fun getUserResponse(formId: String): FormResponseEntity? =
        repository.getUserResponse(formId, currentUserId)

    suspend fun hasResponded(formId: String): Boolean =
        repository.hasResponded(formId, currentUserId)

    suspend fun submitResponse(
        formId: String,
        answers: Map<String, String>
    ): FormResponseEntity {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        // Check if form is open
        if (!form.isOpen) {
            throw IllegalStateException("Form is not accepting responses")
        }

        // Check if already responded (unless multiple submissions allowed)
        if (!form.allowMultiple && repository.hasResponded(formId, currentUserId)) {
            throw IllegalStateException("Already submitted a response to this form")
        }

        // Validate answers
        validateAnswers(form, answers)

        val respondent = if (form.anonymous) null else currentUserId

        val response = repository.submitResponse(
            formId = formId,
            answers = answers,
            respondent = respondent
        )

        publishResponseToNostr(response)
        return response
    }

    suspend fun getFormAnalytics(formId: String): FormAnalytics {
        val form = repository.getFormById(formId)
            ?: throw IllegalStateException("Form not found")

        if (form.createdBy != currentUserId) {
            throw SecurityException("Not authorized to view analytics for this form")
        }

        return repository.getFormAnalytics(formId)
    }

    fun observeResponseCount(formId: String): Flow<Int> =
        repository.observeResponseCount(formId)

    // MARK: - Field Validation

    private fun validateFields(fields: List<FormField>) {
        if (fields.isEmpty()) {
            throw IllegalArgumentException("Form must have at least one field")
        }

        if (fields.size > 100) {
            throw IllegalArgumentException("Form cannot have more than 100 fields")
        }

        val fieldIds = mutableSetOf<String>()
        for (field in fields) {
            if (field.id.isBlank()) {
                throw IllegalArgumentException("Field ID cannot be blank")
            }
            if (!fieldIds.add(field.id)) {
                throw IllegalArgumentException("Duplicate field ID: ${field.id}")
            }
            if (field.label.isBlank()) {
                throw IllegalArgumentException("Field label cannot be blank")
            }
            if (field.label.length > 512) {
                throw IllegalArgumentException("Field label cannot exceed 512 characters")
            }

            // Validate options for choice fields
            when (field.type) {
                FormFieldType.SELECT,
                FormFieldType.MULTISELECT,
                FormFieldType.RADIO,
                FormFieldType.CHECKBOX -> {
                    if (field.options.isNullOrEmpty()) {
                        throw IllegalArgumentException("${field.type.displayName} field '${field.label}' must have options")
                    }
                }
                else -> { /* No validation needed */ }
            }
        }
    }

    private fun validateAnswers(form: FormEntity, answers: Map<String, String>) {
        for (field in form.fields) {
            val answer = answers[field.id]

            // Check required fields
            if (field.required && answer.isNullOrBlank()) {
                throw IllegalArgumentException("Field '${field.label}' is required")
            }

            if (!answer.isNullOrBlank()) {
                // Validate field-specific rules
                validateFieldAnswer(field, answer)
            }
        }
    }

    private fun validateFieldAnswer(field: FormField, answer: String) {
        val validation = field.validation

        when (field.type) {
            FormFieldType.TEXT, FormFieldType.TEXTAREA -> {
                validation?.minLength?.let {
                    if (answer.length < it) {
                        throw IllegalArgumentException(
                            validation.customError ?: "Field '${field.label}' must be at least $it characters"
                        )
                    }
                }
                validation?.maxLength?.let {
                    if (answer.length > it) {
                        throw IllegalArgumentException(
                            validation.customError ?: "Field '${field.label}' cannot exceed $it characters"
                        )
                    }
                }
                validation?.pattern?.let { pattern ->
                    if (!Regex(pattern).matches(answer)) {
                        throw IllegalArgumentException(
                            validation.customError ?: "Field '${field.label}' has invalid format"
                        )
                    }
                }
            }

            FormFieldType.NUMBER, FormFieldType.RATING, FormFieldType.SCALE -> {
                val number = answer.toDoubleOrNull()
                    ?: throw IllegalArgumentException("Field '${field.label}' must be a number")

                validation?.min?.let {
                    if (number < it) {
                        throw IllegalArgumentException(
                            validation.customError ?: "Field '${field.label}' must be at least $it"
                        )
                    }
                }
                validation?.max?.let {
                    if (number > it) {
                        throw IllegalArgumentException(
                            validation.customError ?: "Field '${field.label}' cannot exceed $it"
                        )
                    }
                }
            }

            FormFieldType.EMAIL -> {
                val emailPattern = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")
                if (!emailPattern.matches(answer)) {
                    throw IllegalArgumentException("Field '${field.label}' must be a valid email address")
                }
            }

            FormFieldType.PHONE -> {
                val phonePattern = Regex("^[+]?[0-9\\s\\-()]+$")
                if (!phonePattern.matches(answer)) {
                    throw IllegalArgumentException("Field '${field.label}' must be a valid phone number")
                }
            }

            FormFieldType.URL -> {
                val urlPattern = Regex("^(https?://)?[\\w.-]+\\.[a-z]{2,}(/.*)?$", RegexOption.IGNORE_CASE)
                if (!urlPattern.matches(answer)) {
                    throw IllegalArgumentException("Field '${field.label}' must be a valid URL")
                }
            }

            FormFieldType.SELECT, FormFieldType.RADIO -> {
                val validOptions = field.options?.map { it.value }?.toSet() ?: emptySet()
                if (answer !in validOptions) {
                    throw IllegalArgumentException("Invalid option for field '${field.label}'")
                }
            }

            FormFieldType.MULTISELECT, FormFieldType.CHECKBOX -> {
                val validOptions = field.options?.map { it.value }?.toSet() ?: emptySet()
                val selectedOptions = answer.split(",").map { it.trim() }
                for (option in selectedOptions) {
                    if (option.isNotEmpty() && option !in validOptions) {
                        throw IllegalArgumentException("Invalid option '$option' for field '${field.label}'")
                    }
                }
            }

            else -> { /* No specific validation */ }
        }
    }

    // MARK: - Conditional Logic

    /**
     * Evaluates whether a field should be visible based on conditional logic.
     */
    fun shouldShowField(field: FormField, answers: Map<String, String>): Boolean {
        val conditional = field.conditional ?: return true

        val dependentAnswer = answers[conditional.field] ?: ""

        return when (conditional.operator) {
            ConditionalOperator.EQUALS -> dependentAnswer == conditional.value
            ConditionalOperator.NOT_EQUALS -> dependentAnswer != conditional.value
            ConditionalOperator.CONTAINS -> dependentAnswer.contains(conditional.value, ignoreCase = true)
            ConditionalOperator.NOT_CONTAINS -> !dependentAnswer.contains(conditional.value, ignoreCase = true)
            ConditionalOperator.GREATER -> {
                val answerNum = dependentAnswer.toDoubleOrNull() ?: return false
                val valueNum = conditional.value.toDoubleOrNull() ?: return false
                answerNum > valueNum
            }
            ConditionalOperator.LESS -> {
                val answerNum = dependentAnswer.toDoubleOrNull() ?: return false
                val valueNum = conditional.value.toDoubleOrNull() ?: return false
                answerNum < valueNum
            }
        }
    }

    /**
     * Gets the visible fields based on current answers.
     */
    fun getVisibleFields(form: FormEntity, answers: Map<String, String>): List<FormField> {
        return form.fields.filter { shouldShowField(it, answers) }
    }

    // MARK: - Nostr Publishing

    private suspend fun publishFormToNostr(form: FormEntity) {
        android.util.Log.d("FormsUseCase", "Would publish form: ${form.id}")
        // TODO: Implement actual Nostr publishing
        // val event = createFormNostrEvent(form)
        // nostrClient.publishEvent(event)
        // repository.markFormSynced(form.id)
    }

    private suspend fun publishFormDeletion(formId: String) {
        android.util.Log.d("FormsUseCase", "Would publish form deletion: $formId")
        // TODO: Implement deletion event
    }

    private suspend fun publishResponseToNostr(response: FormResponseEntity) {
        android.util.Log.d("FormsUseCase", "Would publish response: ${response.id}")
        // TODO: Implement actual Nostr publishing
        // val event = createResponseNostrEvent(response)
        // nostrClient.publishEvent(event)
        // repository.markResponseSynced(response.id)
    }

    // MARK: - Form Builder Helpers

    /**
     * Creates a simple poll form with radio options.
     */
    suspend fun createPoll(
        question: String,
        options: List<String>,
        groupId: String? = null,
        anonymous: Boolean = false,
        closesAt: Long? = null
    ): FormEntity {
        val fields = listOf(
            FormField(
                id = "poll",
                type = FormFieldType.RADIO,
                label = question,
                required = true,
                options = options.mapIndexed { index, label ->
                    FieldOption(value = "option_$index", label = label)
                },
                order = 0
            )
        )

        return createForm(
            title = question,
            fields = fields,
            groupId = groupId,
            anonymous = anonymous,
            closesAt = closesAt,
            publishImmediately = true
        )
    }

    /**
     * Creates an RSVP form for events.
     */
    suspend fun createRsvpForm(
        eventTitle: String,
        groupId: String? = null,
        anonymous: Boolean = false
    ): FormEntity {
        val fields = listOf(
            FormField(
                id = "attending",
                type = FormFieldType.RADIO,
                label = "Will you attend?",
                required = true,
                options = listOf(
                    FieldOption("yes", "Yes, I'll be there"),
                    FieldOption("maybe", "Maybe"),
                    FieldOption("no", "No, I can't make it")
                ),
                order = 0
            ),
            FormField(
                id = "guests",
                type = FormFieldType.NUMBER,
                label = "Number of additional guests",
                placeholder = "0",
                validation = FieldValidation(min = 0.0, max = 10.0),
                conditional = ConditionalLogic("attending", ConditionalOperator.EQUALS, "yes"),
                order = 1
            ),
            FormField(
                id = "notes",
                type = FormFieldType.TEXTAREA,
                label = "Any notes or dietary requirements?",
                placeholder = "Optional",
                order = 2
            )
        )

        return createForm(
            title = "RSVP: $eventTitle",
            fields = fields,
            groupId = groupId,
            anonymous = anonymous,
            publishImmediately = true
        )
    }
}
