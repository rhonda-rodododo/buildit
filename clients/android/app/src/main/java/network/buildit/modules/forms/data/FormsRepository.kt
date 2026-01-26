package network.buildit.modules.forms.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FormEntity
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormResponseEntity
import network.buildit.modules.forms.data.local.FormResponsesDao
import network.buildit.modules.forms.data.local.FormStatus
import network.buildit.modules.forms.data.local.FormVisibility
import network.buildit.modules.forms.data.local.FormsDao
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for forms data operations.
 * Implements offline-first pattern with local storage and sync support.
 */
@Singleton
class FormsRepository @Inject constructor(
    private val formsDao: FormsDao,
    private val responsesDao: FormResponsesDao
) {
    private val json = Json { ignoreUnknownKeys = true }

    // MARK: - Forms

    fun getAllForms(): Flow<List<FormEntity>> = formsDao.getAllForms()

    fun getFormsByGroup(groupId: String): Flow<List<FormEntity>> =
        formsDao.getFormsByGroup(groupId)

    fun getFormsByCreator(pubkey: String): Flow<List<FormEntity>> =
        formsDao.getFormsByCreator(pubkey)

    fun getFormsByStatus(status: FormStatus): Flow<List<FormEntity>> =
        formsDao.getFormsByStatus(status)

    fun getOpenForms(): Flow<List<FormEntity>> = formsDao.getOpenForms()

    fun getOpenFormsByGroup(groupId: String): Flow<List<FormEntity>> =
        formsDao.getOpenFormsByGroup(groupId)

    fun observeForm(id: String): Flow<FormEntity?> = formsDao.observeForm(id)

    suspend fun getFormById(id: String): FormEntity? = formsDao.getFormById(id)

    suspend fun getFormByEventId(eventId: String): FormEntity? =
        formsDao.getFormByEventId(eventId)

    fun searchForms(query: String): Flow<List<FormEntity>> = formsDao.searchForms(query)

    suspend fun createForm(
        title: String,
        description: String?,
        fields: List<FormField>,
        groupId: String?,
        visibility: FormVisibility = FormVisibility.GROUP,
        anonymous: Boolean = false,
        allowMultiple: Boolean = false,
        opensAt: Long? = null,
        closesAt: Long? = null,
        maxResponses: Int? = null,
        confirmationMessage: String?,
        createdBy: String,
        status: FormStatus = FormStatus.DRAFT
    ): FormEntity {
        val form = FormEntity(
            id = UUID.randomUUID().toString(),
            title = title,
            description = description,
            fieldsJson = FormEntity.encodeFields(fields),
            groupId = groupId,
            visibility = visibility,
            anonymous = anonymous,
            allowMultiple = allowMultiple,
            opensAt = opensAt,
            closesAt = closesAt,
            maxResponses = maxResponses,
            confirmationMessage = confirmationMessage,
            status = status,
            createdBy = createdBy
        )
        formsDao.insertForm(form)
        return form
    }

    suspend fun updateForm(form: FormEntity) {
        formsDao.updateForm(form.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun updateFormFields(formId: String, fields: List<FormField>) {
        val form = formsDao.getFormById(formId) ?: return
        formsDao.updateForm(
            form.copy(
                fieldsJson = FormEntity.encodeFields(fields),
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun updateFormStatus(id: String, status: FormStatus) {
        formsDao.updateFormStatus(id, status)
    }

    suspend fun publishForm(formId: String) {
        formsDao.updateFormStatus(formId, FormStatus.OPEN)
    }

    suspend fun closeForm(formId: String) {
        formsDao.updateFormStatus(formId, FormStatus.CLOSED)
    }

    suspend fun archiveForm(formId: String) {
        formsDao.updateFormStatus(formId, FormStatus.ARCHIVED)
    }

    suspend fun deleteForm(id: String) {
        responsesDao.deleteResponsesForForm(id)
        formsDao.deleteForm(id)
    }

    suspend fun markFormSynced(id: String) {
        formsDao.markSynced(id)
    }

    suspend fun getUnsyncedForms(): List<FormEntity> = formsDao.getUnsyncedForms()

    fun getOpenFormCount(): Flow<Int> = formsDao.getOpenFormCount()

    // MARK: - Form Responses

    fun getResponsesForForm(formId: String): Flow<List<FormResponseEntity>> =
        responsesDao.getResponsesForForm(formId)

    fun getResponsesByUser(pubkey: String): Flow<List<FormResponseEntity>> =
        responsesDao.getResponsesByUser(pubkey)

    suspend fun getResponseById(id: String): FormResponseEntity? =
        responsesDao.getResponseById(id)

    suspend fun getUserResponse(formId: String, pubkey: String): FormResponseEntity? =
        responsesDao.getUserResponse(formId, pubkey)

    suspend fun hasResponded(formId: String, pubkey: String): Boolean =
        responsesDao.hasResponded(formId, pubkey)

    suspend fun getResponseByEventId(eventId: String): FormResponseEntity? =
        responsesDao.getResponseByEventId(eventId)

    suspend fun submitResponse(
        formId: String,
        answers: Map<String, String>,
        respondent: String?
    ): FormResponseEntity {
        val response = FormResponseEntity(
            id = UUID.randomUUID().toString(),
            formId = formId,
            answersJson = FormResponseEntity.encodeAnswers(answers),
            respondent = respondent
        )
        responsesDao.insertResponse(response)
        formsDao.incrementResponseCount(formId)
        return response
    }

    suspend fun updateResponse(response: FormResponseEntity) {
        responsesDao.updateResponse(response)
    }

    suspend fun deleteResponse(id: String) {
        responsesDao.deleteResponse(id)
    }

    suspend fun markResponseSynced(id: String) {
        responsesDao.markSynced(id)
    }

    suspend fun getUnsyncedResponses(): List<FormResponseEntity> =
        responsesDao.getUnsyncedResponses()

    suspend fun getResponseCount(formId: String): Int =
        responsesDao.getResponseCount(formId)

    fun observeResponseCount(formId: String): Flow<Int> =
        responsesDao.observeResponseCount(formId)

    // MARK: - Batch Operations (for Nostr sync)

    suspend fun insertFormsFromNostr(forms: List<FormEntity>) {
        formsDao.insertForms(forms)
    }

    suspend fun insertResponsesFromNostr(responses: List<FormResponseEntity>) {
        responsesDao.insertResponses(responses)
    }

    // MARK: - Analytics

    /**
     * Get aggregated response data for a form.
     */
    suspend fun getFormAnalytics(formId: String): FormAnalytics {
        val form = formsDao.getFormById(formId) ?: return FormAnalytics()
        val responses = responsesDao.getResponsesForForm(formId).first()

        val fieldStats = mutableMapOf<String, FieldStats>()

        for (field in form.fields) {
            val answers = responses.mapNotNull { response ->
                response.answers[field.id]
            }

            fieldStats[field.id] = when {
                field.options != null -> {
                    // For select/radio/checkbox, count option selections
                    val optionCounts = mutableMapOf<String, Int>()
                    for (option in field.options) {
                        optionCounts[option.value] = 0
                    }
                    for (answer in answers) {
                        // Handle multi-select (comma-separated values)
                        val selectedValues = answer.split(",").map { it.trim() }
                        for (value in selectedValues) {
                            optionCounts[value] = optionCounts.getOrDefault(value, 0) + 1
                        }
                    }
                    FieldStats.ChoiceStats(optionCounts, answers.size)
                }
                field.type.name in listOf("NUMBER", "RATING", "SCALE") -> {
                    // For numeric fields, calculate min/max/avg
                    val numbers = answers.mapNotNull { it.toDoubleOrNull() }
                    if (numbers.isNotEmpty()) {
                        FieldStats.NumericStats(
                            min = numbers.minOrNull() ?: 0.0,
                            max = numbers.maxOrNull() ?: 0.0,
                            average = numbers.average(),
                            count = numbers.size
                        )
                    } else {
                        FieldStats.Empty
                    }
                }
                else -> {
                    // For text fields, just count responses
                    FieldStats.TextStats(answers.size)
                }
            }
        }

        return FormAnalytics(
            totalResponses = responses.size,
            uniqueRespondents = responses.mapNotNull { it.respondent }.distinct().size,
            fieldStats = fieldStats,
            firstResponseAt = responses.minOfOrNull { it.submittedAt },
            lastResponseAt = responses.maxOfOrNull { it.submittedAt }
        )
    }
}

/**
 * Analytics data for a form.
 */
data class FormAnalytics(
    val totalResponses: Int = 0,
    val uniqueRespondents: Int = 0,
    val fieldStats: Map<String, FieldStats> = emptyMap(),
    val firstResponseAt: Long? = null,
    val lastResponseAt: Long? = null
)

/**
 * Statistics for a single field.
 */
sealed class FieldStats {
    data object Empty : FieldStats()

    data class TextStats(
        val responseCount: Int
    ) : FieldStats()

    data class NumericStats(
        val min: Double,
        val max: Double,
        val average: Double,
        val count: Int
    ) : FieldStats()

    data class ChoiceStats(
        val optionCounts: Map<String, Int>,
        val totalResponses: Int
    ) : FieldStats() {
        fun getPercentage(option: String): Double {
            if (totalResponses == 0) return 0.0
            return (optionCounts[option] ?: 0).toDouble() / totalResponses * 100
        }
    }
}
