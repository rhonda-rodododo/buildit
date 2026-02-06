package network.buildit.modules.forms.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.forms.FormStatus as GeneratedFormStatus
import network.buildit.generated.schemas.forms.Operator as GeneratedOperator
import network.buildit.generated.schemas.forms.Type as GeneratedFieldType
import network.buildit.generated.schemas.forms.Visibility as GeneratedVisibility

/**
 * Type aliases mapping generated protocol types to local names
 * used throughout the forms module.
 */
typealias FormFieldType = GeneratedFieldType
typealias FormVisibility = GeneratedVisibility
typealias FormStatus = GeneratedFormStatus
typealias ConditionalOperator = GeneratedOperator

/**
 * UI display name for form field types.
 */
val FormFieldType.displayName: String get() = when (this) {
    FormFieldType.Text -> "Short Text"
    FormFieldType.Textarea -> "Long Text"
    FormFieldType.Number -> "Number"
    FormFieldType.Email -> "Email"
    FormFieldType.Phone -> "Phone"
    FormFieldType.URL -> "URL"
    FormFieldType.Date -> "Date"
    FormFieldType.Time -> "Time"
    FormFieldType.Datetime -> "Date & Time"
    FormFieldType.Select -> "Dropdown"
    FormFieldType.Multiselect -> "Multi-Select"
    FormFieldType.Radio -> "Radio Buttons"
    FormFieldType.Checkbox -> "Checkboxes"
    FormFieldType.File -> "File Upload"
    FormFieldType.Rating -> "Rating"
    FormFieldType.Scale -> "Scale"
    FormFieldType.Location -> "Location"
}

/**
 * UI display name for form visibility options.
 */
val FormVisibility.displayName: String get() = when (this) {
    FormVisibility.Private -> "Private"
    FormVisibility.Group -> "Group Only"
    FormVisibility.Public -> "Public"
}

/**
 * UI display name for form status values.
 */
val FormStatus.displayName: String get() = when (this) {
    FormStatus.Draft -> "Draft"
    FormStatus.Open -> "Open"
    FormStatus.Closed -> "Closed"
    FormStatus.Archived -> "Archived"
}

/**
 * A single option for select/radio/checkbox fields.
 */
@Serializable
data class FieldOption(
    val value: String,
    val label: String
)

/**
 * Validation rules for a field.
 */
@Serializable
data class FieldValidation(
    val minLength: Int? = null,
    val maxLength: Int? = null,
    val min: Double? = null,
    val max: Double? = null,
    val pattern: String? = null,
    val customError: String? = null
)

/**
 * Conditional display logic for a field.
 */
@Serializable
data class ConditionalLogic(
    val field: String,
    val operator: ConditionalOperator,
    val value: String
)

/**
 * A single form field/question.
 */
@Serializable
data class FormField(
    val id: String,
    val type: FormFieldType,
    val label: String,
    val description: String? = null,
    val placeholder: String? = null,
    val required: Boolean = false,
    val options: List<FieldOption>? = null,
    val validation: FieldValidation? = null,
    val conditional: ConditionalLogic? = null,
    val order: Int = 0
)

/**
 * Room entity for forms.
 */
@Entity(
    tableName = "forms",
    indices = [
        Index("groupId"),
        Index("status"),
        Index("createdBy"),
        Index("createdAt")
    ]
)
data class FormEntity(
    @PrimaryKey
    val id: String,
    val title: String,
    val description: String? = null,
    val fieldsJson: String, // JSON encoded List<FormField>
    val groupId: String? = null,
    val visibility: FormVisibility = FormVisibility.Group,
    val anonymous: Boolean = false,
    val allowMultiple: Boolean = false,
    val opensAt: Long? = null,
    val closesAt: Long? = null,
    val maxResponses: Int? = null,
    val confirmationMessage: String? = null,
    val status: FormStatus = FormStatus.Draft,
    val responseCount: Int = 0,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long? = null,
    val nostrEventId: String? = null,
    val syncedAt: Long? = null
) {
    val fields: List<FormField>
        get() = try {
            Json.decodeFromString(fieldsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val isOpen: Boolean
        get() {
            if (status != FormStatus.Open) return false
            val now = System.currentTimeMillis()
            opensAt?.let { if (now < it) return false }
            closesAt?.let { if (now > it) return false }
            maxResponses?.let { if (responseCount >= it) return false }
            return true
        }

    val canSubmit: Boolean
        get() = isOpen

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun encodeFields(fields: List<FormField>): String =
            json.encodeToString(fields)
    }
}

/**
 * Room entity for form responses.
 */
@Entity(
    tableName = "form_responses",
    indices = [
        Index("formId"),
        Index("respondent"),
        Index("submittedAt")
    ]
)
data class FormResponseEntity(
    @PrimaryKey
    val id: String,
    val formId: String,
    val answersJson: String, // JSON encoded Map<String, Any>
    val respondent: String? = null, // null if anonymous
    val submittedAt: Long = System.currentTimeMillis(),
    val nostrEventId: String? = null,
    val syncedAt: Long? = null
) {
    val answers: Map<String, String>
        get() = try {
            Json.decodeFromString(answersJson)
        } catch (_: Exception) {
            emptyMap()
        }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun encodeAnswers(answers: Map<String, String>): String =
            json.encodeToString(answers)
    }
}

/**
 * Type converters for Forms module.
 * Uses the generated enum's .value property for stable serialization.
 */
class FormsConverters {
    @TypeConverter
    fun fromFormFieldType(value: FormFieldType): String = value.value

    @TypeConverter
    fun toFormFieldType(value: String): FormFieldType =
        FormFieldType.entries.first { it.value == value }

    @TypeConverter
    fun fromFormVisibility(value: FormVisibility): String = value.value

    @TypeConverter
    fun toFormVisibility(value: String): FormVisibility =
        FormVisibility.entries.first { it.value == value }

    @TypeConverter
    fun fromFormStatus(value: FormStatus): String = value.value

    @TypeConverter
    fun toFormStatus(value: String): FormStatus =
        FormStatus.entries.first { it.value == value }

    @TypeConverter
    fun fromConditionalOperator(value: ConditionalOperator): String = value.value

    @TypeConverter
    fun toConditionalOperator(value: String): ConditionalOperator =
        ConditionalOperator.entries.first { it.value == value }
}
