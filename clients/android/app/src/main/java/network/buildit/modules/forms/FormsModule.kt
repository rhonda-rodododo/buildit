package network.buildit.modules.forms

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.forms.data.FormsRepository
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FormEntity
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormFieldType
import network.buildit.modules.forms.data.local.FormResponseEntity
import network.buildit.modules.forms.data.local.FormResponsesDao
import network.buildit.modules.forms.data.local.FormStatus
import network.buildit.modules.forms.data.local.FormVisibility
import network.buildit.modules.forms.data.local.FormsDao
import network.buildit.modules.forms.domain.FormsUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Forms module for BuildIt.
 *
 * Provides form/survey creation, submission, and response viewing functionality.
 * Supports various field types: text, radio, checkbox, select, rating, scale, etc.
 *
 * Nostr Event Kinds:
 * - 40031: Form definition (create/update)
 * - 40032: Form response (submission)
 */
class FormsModuleImpl @Inject constructor(
    private val repository: FormsRepository,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "forms"
    override val version: String = "1.0.0"
    override val displayName: String = "Forms"
    override val description: String = "Create surveys, polls, and collect responses"

    private var subscriptionId: String? = null
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun initialize() {
        // Subscribe to form events
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 * 30 // Last 30 days
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            FormsUseCase.KIND_FORM -> {
                handleFormEvent(event)
                true
            }
            FormsUseCase.KIND_RESPONSE -> {
                handleResponseEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeletion(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "forms",
                title = "Forms",
                icon = Icons.Default.Assignment,
                showInNavigation = true,
                content = { _ ->
                    // FormsListScreen() - Navigation handled by NavHost
                }
            ),
            ModuleRoute(
                route = "forms/{formId}",
                title = "Form Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val formId = args["formId"] ?: return@ModuleRoute
                    // FormDetailScreen(formId = formId)
                }
            ),
            ModuleRoute(
                route = "forms/create",
                title = "Create Form",
                icon = null,
                showInNavigation = false,
                content = { _ ->
                    // FormBuilderScreen()
                }
            ),
            ModuleRoute(
                route = "forms/{formId}/responses",
                title = "Form Responses",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val formId = args["formId"] ?: return@ModuleRoute
                    // FormResponsesScreen(formId = formId)
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            FormsUseCase.KIND_FORM,
            FormsUseCase.KIND_RESPONSE,
            NostrClient.KIND_DELETE
        )
    }

    private suspend fun handleFormEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("FormsModule", "Received form event: ${nostrEvent.id}")

            val content = json.parseToJsonElement(nostrEvent.content).jsonObject
            val formId = content["id"]?.jsonPrimitive?.content ?: return

            // Check if we already have a newer version
            val existingForm = repository.getFormById(formId)
            if (existingForm != null && existingForm.updatedAt != null &&
                existingForm.updatedAt > nostrEvent.createdAt * 1000
            ) {
                return
            }

            val form = parseFormFromEvent(nostrEvent, content)
            repository.insertFormsFromNostr(listOf(form))

        } catch (e: Exception) {
            android.util.Log.e("FormsModule", "Failed to handle form event", e)
        }
    }

    private suspend fun handleResponseEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("FormsModule", "Received response event: ${nostrEvent.id}")

            val content = json.parseToJsonElement(nostrEvent.content).jsonObject
            val responseId = content["id"]?.jsonPrimitive?.content ?: return
            val formId = content["formId"]?.jsonPrimitive?.content ?: return

            // Check if we already have this response
            if (repository.getResponseById(responseId) != null) {
                return
            }

            val response = parseResponseFromEvent(nostrEvent, content)
            repository.insertResponsesFromNostr(listOf(response))

        } catch (e: Exception) {
            android.util.Log.e("FormsModule", "Failed to handle response event", e)
        }
    }

    private suspend fun handleDeletion(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            android.util.Log.d("FormsModule", "Received deletion for: $eventIds")

            // We would need to look up which of our entities have these Nostr event IDs
            // and delete them accordingly

        } catch (e: Exception) {
            android.util.Log.e("FormsModule", "Failed to handle deletion", e)
        }
    }

    private fun parseFormFromEvent(event: NostrEvent, content: JsonObject): FormEntity {
        val fieldsArray = content["fields"]?.jsonArray ?: throw IllegalArgumentException("Missing fields")

        val fields = fieldsArray.map { fieldElement ->
            val fieldObj = fieldElement.jsonObject

            val optionsArray = fieldObj["options"]?.jsonArray
            val options = optionsArray?.map { optionElement ->
                val optionObj = optionElement.jsonObject
                FieldOption(
                    value = optionObj["value"]?.jsonPrimitive?.content ?: "",
                    label = optionObj["label"]?.jsonPrimitive?.content ?: ""
                )
            }

            FormField(
                id = fieldObj["id"]?.jsonPrimitive?.content ?: "",
                type = FormFieldType.entries.firstOrNull {
                    it.value == (fieldObj["type"]?.jsonPrimitive?.content ?: "text")
                } ?: FormFieldType.Text,
                label = fieldObj["label"]?.jsonPrimitive?.content ?: "",
                description = fieldObj["description"]?.jsonPrimitive?.content,
                placeholder = fieldObj["placeholder"]?.jsonPrimitive?.content,
                required = fieldObj["required"]?.jsonPrimitive?.content?.toBoolean() ?: false,
                options = options,
                order = fieldObj["order"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
            )
        }

        return FormEntity(
            id = content["id"]?.jsonPrimitive?.content ?: java.util.UUID.randomUUID().toString(),
            title = content["title"]?.jsonPrimitive?.content ?: "Untitled Form",
            description = content["description"]?.jsonPrimitive?.content,
            fieldsJson = FormEntity.encodeFields(fields),
            groupId = content["groupId"]?.jsonPrimitive?.content,
            visibility = FormVisibility.entries.firstOrNull {
                it.value == (content["visibility"]?.jsonPrimitive?.content ?: "group")
            } ?: FormVisibility.Group,
            anonymous = content["anonymous"]?.jsonPrimitive?.content?.toBoolean() ?: false,
            allowMultiple = content["allowMultiple"]?.jsonPrimitive?.content?.toBoolean() ?: false,
            opensAt = content["opensAt"]?.jsonPrimitive?.content?.toLongOrNull()?.times(1000),
            closesAt = content["closesAt"]?.jsonPrimitive?.content?.toLongOrNull()?.times(1000),
            maxResponses = content["maxResponses"]?.jsonPrimitive?.content?.toIntOrNull(),
            confirmationMessage = content["confirmationMessage"]?.jsonPrimitive?.content,
            status = FormStatus.Open, // Assume forms from Nostr are published
            createdBy = event.pubkey,
            createdAt = event.createdAt * 1000,
            nostrEventId = event.id,
            syncedAt = System.currentTimeMillis()
        )
    }

    private fun parseResponseFromEvent(event: NostrEvent, content: JsonObject): FormResponseEntity {
        val answersObj = content["answers"]?.jsonObject ?: throw IllegalArgumentException("Missing answers")

        val answers = answersObj.entries.associate { (key, value) ->
            key to (value.jsonPrimitive.content)
        }

        return FormResponseEntity(
            id = content["id"]?.jsonPrimitive?.content ?: java.util.UUID.randomUUID().toString(),
            formId = content["formId"]?.jsonPrimitive?.content ?: "",
            answersJson = FormResponseEntity.encodeAnswers(answers),
            respondent = content["respondent"]?.jsonPrimitive?.content,
            submittedAt = event.createdAt * 1000,
            nostrEventId = event.id,
            syncedAt = System.currentTimeMillis()
        )
    }
}

/**
 * Hilt module for Forms dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class FormsHiltModule {
    @Binds
    @IntoSet
    abstract fun bindFormsModule(impl: FormsModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Forms module.
 */
@Module
@InstallIn(SingletonComponent::class)
object FormsDaoModule {
    @Provides
    @Singleton
    fun provideFormsDao(database: BuildItDatabase): FormsDao {
        return database.formsDao()
    }

    @Provides
    @Singleton
    fun provideFormResponsesDao(database: BuildItDatabase): FormResponsesDao {
        return database.formResponsesDao()
    }
}
