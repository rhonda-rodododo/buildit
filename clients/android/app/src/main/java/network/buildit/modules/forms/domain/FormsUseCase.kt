package network.buildit.modules.forms.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
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
import network.buildit.modules.forms.data.local.displayName
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
        visibility: FormVisibility = FormVisibility.Group,
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

        val status = if (publishImmediately) FormStatus.Open else FormStatus.Draft

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

        if (form.status != FormStatus.Draft) {
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

        if (form.status != FormStatus.Draft) {
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
                FormFieldType.Select,
                FormFieldType.Multiselect,
                FormFieldType.Radio,
                FormFieldType.Checkbox -> {
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
            FormFieldType.Text, FormFieldType.Textarea -> {
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

            FormFieldType.Number, FormFieldType.Rating, FormFieldType.Scale -> {
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

            FormFieldType.Email -> {
                val emailPattern = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")
                if (!emailPattern.matches(answer)) {
                    throw IllegalArgumentException("Field '${field.label}' must be a valid email address")
                }
            }

            FormFieldType.Phone -> {
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

            FormFieldType.Select, FormFieldType.Radio -> {
                val validOptions = field.options?.map { it.value }?.toSet() ?: emptySet()
                if (answer !in validOptions) {
                    throw IllegalArgumentException("Invalid option for field '${field.label}'")
                }
            }

            FormFieldType.Multiselect, FormFieldType.Checkbox -> {
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
            ConditionalOperator.Equals -> dependentAnswer == conditional.value
            ConditionalOperator.NotEquals -> dependentAnswer != conditional.value
            ConditionalOperator.Contains -> dependentAnswer.contains(conditional.value, ignoreCase = true)
            ConditionalOperator.NotContains -> !dependentAnswer.contains(conditional.value, ignoreCase = true)
            ConditionalOperator.Greater -> {
                val answerNum = dependentAnswer.toDoubleOrNull() ?: return false
                val valueNum = conditional.value.toDoubleOrNull() ?: return false
                answerNum > valueNum
            }
            ConditionalOperator.Less -> {
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

    /**
     * Publishes a form to Nostr as a kind 40031 event.
     *
     * The form content is JSON-encoded with title, description, fields, and settings.
     * Tags include group ID and form metadata for discoverability.
     */
    private suspend fun publishFormToNostr(form: FormEntity) {
        val pubkey = cryptoManager.getPublicKeyHex()
            ?: throw IllegalStateException("No public key available")

        val contentJson = org.json.JSONObject().apply {
            put("title", form.title)
            form.description?.let { put("description", it) }
            put("fields", form.fieldsJson)
            put("visibility", form.visibility.value)
            put("anonymous", form.anonymous)
            put("allowMultiple", form.allowMultiple)
            form.opensAt?.let { put("opensAt", it) }
            form.closesAt?.let { put("closesAt", it) }
            form.maxResponses?.let { put("maxResponses", it) }
            form.confirmationMessage?.let { put("confirmationMessage", it) }
        }.toString()

        val tags = mutableListOf(
            listOf("d", form.id), // NIP-33 parameterized replaceable event identifier
            listOf("title", form.title)
        )
        form.groupId?.let { tags.add(listOf("g", it)) }

        val unsigned = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_FORM,
            tags = tags,
            content = contentJson
        )

        val signed = cryptoManager.signEvent(unsigned)
            ?: throw IllegalStateException("Failed to sign form event")

        val event = NostrEvent(
            id = signed.id,
            pubkey = signed.pubkey,
            createdAt = signed.createdAt,
            kind = signed.kind,
            tags = signed.tags,
            content = signed.content,
            sig = signed.sig
        )

        val published = nostrClient.publishEvent(event)
        if (published) {
            repository.markFormSynced(form.id)
        }
    }

    /**
     * Publishes a NIP-09 deletion event for a form.
     */
    private suspend fun publishFormDeletion(formId: String) {
        val pubkey = cryptoManager.getPublicKeyHex()
            ?: throw IllegalStateException("No public key available")

        // Look up the form's Nostr event ID if available
        val form = repository.getFormById(formId)
        val eventIdToDelete = form?.nostrEventId ?: formId

        val unsigned = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = 5, // NIP-09 deletion
            tags = listOf(
                listOf("e", eventIdToDelete),
                listOf("k", KIND_FORM.toString())
            ),
            content = "Form deleted"
        )

        val signed = cryptoManager.signEvent(unsigned)
            ?: throw IllegalStateException("Failed to sign deletion event")

        val event = NostrEvent(
            id = signed.id,
            pubkey = signed.pubkey,
            createdAt = signed.createdAt,
            kind = signed.kind,
            tags = signed.tags,
            content = signed.content,
            sig = signed.sig
        )

        nostrClient.publishEvent(event)
    }

    /**
     * Publishes a form response to Nostr as a kind 40032 event.
     *
     * Responses are sent using NIP-17 gift wrap to the form creator
     * so that only the form creator can read the response contents.
     */
    private suspend fun publishResponseToNostr(response: FormResponseEntity) {
        val form = repository.getFormById(response.formId) ?: return
        val pubkey = cryptoManager.getPublicKeyHex()
            ?: throw IllegalStateException("No public key available")

        val contentJson = org.json.JSONObject().apply {
            put("formId", response.formId)
            put("answers", response.answersJson)
        }.toString()

        // If the form creator is someone else, encrypt via gift wrap (NIP-17)
        if (form.createdBy.isNotBlank() && form.createdBy != pubkey) {
            val giftWrap = cryptoManager.createGiftWrap(
                recipientPubkey = form.createdBy,
                content = contentJson
            )
            if (giftWrap != null) {
                val event = NostrEvent(
                    id = giftWrap.id,
                    pubkey = giftWrap.pubkey,
                    createdAt = giftWrap.createdAt,
                    kind = giftWrap.kind,
                    tags = giftWrap.tags,
                    content = giftWrap.content,
                    sig = giftWrap.sig
                )
                val published = nostrClient.publishEvent(event)
                if (published) {
                    repository.markResponseSynced(response.id)
                }
                return
            }
        }

        // Fallback: publish as a regular kind 40032 event
        val tags = mutableListOf(
            listOf("e", response.formId),
            listOf("p", form.createdBy)
        )

        val unsigned = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_RESPONSE,
            tags = tags,
            content = contentJson
        )

        val signed = cryptoManager.signEvent(unsigned)
            ?: throw IllegalStateException("Failed to sign response event")

        val event = NostrEvent(
            id = signed.id,
            pubkey = signed.pubkey,
            createdAt = signed.createdAt,
            kind = signed.kind,
            tags = signed.tags,
            content = signed.content,
            sig = signed.sig
        )

        val published = nostrClient.publishEvent(event)
        if (published) {
            repository.markResponseSynced(response.id)
        }
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
                type = FormFieldType.Radio,
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
                type = FormFieldType.Radio,
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
                type = FormFieldType.Number,
                label = "Number of additional guests",
                placeholder = "0",
                validation = FieldValidation(min = 0.0, max = 10.0),
                conditional = ConditionalLogic("attending", ConditionalOperator.Equals, "yes"),
                order = 1
            ),
            FormField(
                id = "notes",
                type = FormFieldType.Textarea,
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
