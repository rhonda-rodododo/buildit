package network.buildit.modules.forms.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Field types for form fields.
 */
enum class FormFieldType(val displayName: String) {
    TEXT("Short Text"),
    TEXTAREA("Long Text"),
    NUMBER("Number"),
    EMAIL("Email"),
    PHONE("Phone"),
    URL("URL"),
    DATE("Date"),
    TIME("Time"),
    DATETIME("Date & Time"),
    SELECT("Dropdown"),
    MULTISELECT("Multi-Select"),
    RADIO("Radio Buttons"),
    CHECKBOX("Checkboxes"),
    FILE("File Upload"),
    RATING("Rating"),
    SCALE("Scale")
}

/**
 * Visibility options for forms.
 */
enum class FormVisibility(val displayName: String) {
    PRIVATE("Private"),
    GROUP("Group Only"),
    PUBLIC("Public")
}

/**
 * Status of a form.
 */
enum class FormStatus(val displayName: String) {
    DRAFT("Draft"),
    OPEN("Open"),
    CLOSED("Closed"),
    ARCHIVED("Archived")
}

/**
 * Conditional operator for field logic.
 */
enum class ConditionalOperator {
    EQUALS,
    NOT_EQUALS,
    CONTAINS,
    NOT_CONTAINS,
    GREATER,
    LESS
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
    val visibility: FormVisibility = FormVisibility.GROUP,
    val anonymous: Boolean = false,
    val allowMultiple: Boolean = false,
    val opensAt: Long? = null,
    val closesAt: Long? = null,
    val maxResponses: Int? = null,
    val confirmationMessage: String? = null,
    val status: FormStatus = FormStatus.DRAFT,
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
            if (status != FormStatus.OPEN) return false
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
 */
class FormsConverters {
    @TypeConverter
    fun fromFormFieldType(value: FormFieldType): String = value.name

    @TypeConverter
    fun toFormFieldType(value: String): FormFieldType = FormFieldType.valueOf(value)

    @TypeConverter
    fun fromFormVisibility(value: FormVisibility): String = value.name

    @TypeConverter
    fun toFormVisibility(value: String): FormVisibility = FormVisibility.valueOf(value)

    @TypeConverter
    fun fromFormStatus(value: FormStatus): String = value.name

    @TypeConverter
    fun toFormStatus(value: String): FormStatus = FormStatus.valueOf(value)

    @TypeConverter
    fun fromConditionalOperator(value: ConditionalOperator): String = value.name

    @TypeConverter
    fun toConditionalOperator(value: String): ConditionalOperator =
        ConditionalOperator.valueOf(value)
}
