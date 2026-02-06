package network.buildit.modules.forms.data

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FormEntity
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormFieldType
import network.buildit.modules.forms.data.local.FormResponseEntity
import network.buildit.modules.forms.data.local.FormResponsesDao
import network.buildit.modules.forms.data.local.FormStatus
import network.buildit.modules.forms.data.local.FormVisibility
import network.buildit.modules.forms.data.local.FormsDao
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource

/**
 * Unit tests for FormsRepository.
 *
 * Verifies form creation, updates, response handling,
 * status transitions, and analytics computation.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("FormsRepository")
class FormsRepositoryTest {

    private lateinit var formsDao: FormsDao
    private lateinit var responsesDao: FormResponsesDao
    private lateinit var repository: FormsRepository

    private val testPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val testGroupId = "test-group-id"
    private val testFormId = "test-form-id"

    @BeforeEach
    fun setup() {
        formsDao = mockk(relaxed = true)
        responsesDao = mockk(relaxed = true)
        repository = FormsRepository(formsDao, responsesDao)
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    // ============== Helper Methods ==============

    private fun createTestFormEntity(
        id: String = testFormId,
        title: String = "Test Form",
        status: FormStatus = FormStatus.Open,
        groupId: String? = testGroupId
    ): FormEntity = FormEntity(
        id = id,
        title = title,
        description = "A test form",
        fieldsJson = "[]",
        groupId = groupId,
        visibility = FormVisibility.Group,
        anonymous = false,
        allowMultiple = false,
        opensAt = null,
        closesAt = null,
        maxResponses = null,
        confirmationMessage = null,
        status = status,
        createdBy = testPubkey
    )

    private fun createTestResponseEntity(
        id: String = "response-1",
        formId: String = testFormId,
        respondent: String? = testPubkey
    ): FormResponseEntity = FormResponseEntity(
        id = id,
        formId = formId,
        answersJson = """{"field1":"Answer 1"}""",
        respondent = respondent
    )

    private fun createTestField(
        id: String = "field-1",
        type: FormFieldType = FormFieldType.Text,
        label: String = "Question 1",
        required: Boolean = false
    ): FormField = FormField(
        id = id,
        type = type,
        label = label,
        required = required,
        options = null,
        order = 0
    )

    // ============== Form CRUD Tests ==============

    @Nested
    @DisplayName("Form Retrieval")
    inner class FormRetrieval {

        @Test
        @DisplayName("getAllForms returns all forms as flow")
        fun getAllFormsReturnsFlow() = runTest {
            val forms = listOf(
                createTestFormEntity(id = "form-1"),
                createTestFormEntity(id = "form-2")
            )
            every { formsDao.getAllForms() } returns flowOf(forms)

            repository.getAllForms().test {
                val result = awaitItem()
                assertThat(result).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getFormsByGroup returns forms filtered by group ID")
        fun getFormsByGroupFilters() = runTest {
            val forms = listOf(createTestFormEntity(groupId = testGroupId))
            every { formsDao.getFormsByGroup(testGroupId) } returns flowOf(forms)

            repository.getFormsByGroup(testGroupId).test {
                val result = awaitItem()
                assertThat(result).hasSize(1)
                assertThat(result[0].groupId).isEqualTo(testGroupId)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getFormsByCreator returns forms by specific user")
        fun getFormsByCreatorReturns() = runTest {
            val forms = listOf(createTestFormEntity())
            every { formsDao.getFormsByCreator(testPubkey) } returns flowOf(forms)

            repository.getFormsByCreator(testPubkey).test {
                val result = awaitItem()
                assertThat(result).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @ParameterizedTest
        @EnumSource(FormStatus::class)
        @DisplayName("getFormsByStatus filters by each status value")
        fun getFormsByStatusFilters(status: FormStatus) = runTest {
            val forms = listOf(createTestFormEntity(status = status))
            every { formsDao.getFormsByStatus(status) } returns flowOf(forms)

            repository.getFormsByStatus(status).test {
                val result = awaitItem()
                assertThat(result).hasSize(1)
                assertThat(result[0].status).isEqualTo(status)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getOpenForms returns only open forms")
        fun getOpenFormsReturnsOpen() = runTest {
            val forms = listOf(createTestFormEntity(status = FormStatus.Open))
            every { formsDao.getOpenForms() } returns flowOf(forms)

            repository.getOpenForms().test {
                val result = awaitItem()
                assertThat(result).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getFormById returns form when found")
        fun getFormByIdReturns() = runTest {
            val form = createTestFormEntity()
            coEvery { formsDao.getFormById(testFormId) } returns form

            val result = repository.getFormById(testFormId)

            assertThat(result).isNotNull()
            assertThat(result?.id).isEqualTo(testFormId)
        }

        @Test
        @DisplayName("getFormById returns null when not found")
        fun getFormByIdReturnsNull() = runTest {
            coEvery { formsDao.getFormById("nonexistent") } returns null

            val result = repository.getFormById("nonexistent")

            assertThat(result).isNull()
        }

        @Test
        @DisplayName("searchForms returns matching forms")
        fun searchFormsReturnsMatching() = runTest {
            val forms = listOf(createTestFormEntity(title = "Volunteer Sign-Up"))
            every { formsDao.searchForms("Volunteer") } returns flowOf(forms)

            repository.searchForms("Volunteer").test {
                val result = awaitItem()
                assertThat(result).hasSize(1)
                assertThat(result[0].title).contains("Volunteer")
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Form Creation and Updates")
    inner class FormCreationAndUpdates {

        @Test
        @DisplayName("createForm generates UUID and inserts form")
        fun createFormGeneratesUuidAndInserts() = runTest {
            val fields = listOf(createTestField())

            val result = repository.createForm(
                title = "New Form",
                description = "Description",
                fields = fields,
                groupId = testGroupId,
                createdBy = testPubkey
            )

            assertThat(result.id).isNotEmpty()
            assertThat(result.title).isEqualTo("New Form")
            coVerify { formsDao.insertForm(any()) }
        }

        @Test
        @DisplayName("createForm with all optional parameters")
        fun createFormWithAllOptions() = runTest {
            val fields = listOf(createTestField())
            val closesAt = System.currentTimeMillis() + 86400000

            val result = repository.createForm(
                title = "Advanced Form",
                description = "With all options",
                fields = fields,
                groupId = testGroupId,
                visibility = FormVisibility.Public,
                anonymous = true,
                allowMultiple = true,
                closesAt = closesAt,
                maxResponses = 100,
                confirmationMessage = "Thank you!",
                createdBy = testPubkey,
                status = FormStatus.Draft
            )

            assertThat(result.anonymous).isTrue()
            assertThat(result.allowMultiple).isTrue()
            assertThat(result.maxResponses).isEqualTo(100)
            assertThat(result.status).isEqualTo(FormStatus.Draft)
        }

        @Test
        @DisplayName("updateForm sets updatedAt timestamp")
        fun updateFormSetsTimestamp() = runTest {
            val form = createTestFormEntity()

            repository.updateForm(form)

            coVerify { formsDao.updateForm(match { it.updatedAt > 0 }) }
        }

        @Test
        @DisplayName("updateFormFields updates only fields JSON")
        fun updateFormFieldsUpdatesJson() = runTest {
            val form = createTestFormEntity()
            coEvery { formsDao.getFormById(testFormId) } returns form

            val newFields = listOf(
                createTestField(id = "field-new", label = "New Question")
            )

            repository.updateFormFields(testFormId, newFields)

            coVerify { formsDao.updateForm(match { it.updatedAt > 0 }) }
        }

        @Test
        @DisplayName("updateFormFields does nothing if form not found")
        fun updateFormFieldsNoOpIfNotFound() = runTest {
            coEvery { formsDao.getFormById("nonexistent") } returns null

            repository.updateFormFields("nonexistent", emptyList())

            coVerify(exactly = 0) { formsDao.updateForm(any()) }
        }
    }

    @Nested
    @DisplayName("Form Status Transitions")
    inner class FormStatusTransitions {

        @Test
        @DisplayName("publishForm sets status to OPEN")
        fun publishFormSetsOpen() = runTest {
            repository.publishForm(testFormId)

            coVerify { formsDao.updateFormStatus(testFormId, FormStatus.Open) }
        }

        @Test
        @DisplayName("closeForm sets status to CLOSED")
        fun closeFormSetsClosed() = runTest {
            repository.closeForm(testFormId)

            coVerify { formsDao.updateFormStatus(testFormId, FormStatus.Closed) }
        }

        @Test
        @DisplayName("archiveForm sets status to ARCHIVED")
        fun archiveFormSetsArchived() = runTest {
            repository.archiveForm(testFormId)

            coVerify { formsDao.updateFormStatus(testFormId, FormStatus.Archived) }
        }
    }

    @Nested
    @DisplayName("Form Deletion")
    inner class FormDeletion {

        @Test
        @DisplayName("deleteForm removes both form and its responses")
        fun deleteFormRemovesBoth() = runTest {
            repository.deleteForm(testFormId)

            coVerify(ordering = Ordering.ORDERED) {
                responsesDao.deleteResponsesForForm(testFormId)
                formsDao.deleteForm(testFormId)
            }
        }
    }

    // ============== Response Tests ==============

    @Nested
    @DisplayName("Form Response Operations")
    inner class FormResponseOperations {

        @Test
        @DisplayName("getResponsesForForm returns flow of responses")
        fun getResponsesReturnsFlow() = runTest {
            val responses = listOf(
                createTestResponseEntity(id = "resp-1"),
                createTestResponseEntity(id = "resp-2")
            )
            every { responsesDao.getResponsesForForm(testFormId) } returns flowOf(responses)

            repository.getResponsesForForm(testFormId).test {
                val result = awaitItem()
                assertThat(result).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("submitResponse generates UUID and increments count")
        fun submitResponseGeneratesUuidAndIncrements() = runTest {
            val answers = mapOf("field1" to "Answer 1", "field2" to "Answer 2")

            val result = repository.submitResponse(testFormId, answers, testPubkey)

            assertThat(result.id).isNotEmpty()
            assertThat(result.formId).isEqualTo(testFormId)
            coVerify {
                responsesDao.insertResponse(any())
                formsDao.incrementResponseCount(testFormId)
            }
        }

        @Test
        @DisplayName("submitResponse with null respondent for anonymous forms")
        fun submitResponseAnonymous() = runTest {
            val answers = mapOf("field1" to "Anonymous answer")

            val result = repository.submitResponse(testFormId, answers, null)

            assertThat(result.respondent).isNull()
        }

        @Test
        @DisplayName("hasResponded returns true when response exists")
        fun hasRespondedReturnsTrue() = runTest {
            coEvery { responsesDao.hasResponded(testFormId, testPubkey) } returns true

            val result = repository.hasResponded(testFormId, testPubkey)

            assertThat(result).isTrue()
        }

        @Test
        @DisplayName("hasResponded returns false when no response exists")
        fun hasRespondedReturnsFalse() = runTest {
            coEvery { responsesDao.hasResponded(testFormId, "other-user") } returns false

            val result = repository.hasResponded(testFormId, "other-user")

            assertThat(result).isFalse()
        }

        @Test
        @DisplayName("getResponseCount returns accurate count")
        fun getResponseCountReturnsAccurate() = runTest {
            coEvery { responsesDao.getResponseCount(testFormId) } returns 42

            val count = repository.getResponseCount(testFormId)

            assertThat(count).isEqualTo(42)
        }

        @Test
        @DisplayName("deleteResponse removes response by ID")
        fun deleteResponseRemoves() = runTest {
            repository.deleteResponse("resp-1")

            coVerify { responsesDao.deleteResponse("resp-1") }
        }
    }

    @Nested
    @DisplayName("Sync Operations")
    inner class SyncOperations {

        @Test
        @DisplayName("markFormSynced updates sync status")
        fun markFormSyncedUpdates() = runTest {
            repository.markFormSynced(testFormId)

            coVerify { formsDao.markSynced(testFormId) }
        }

        @Test
        @DisplayName("getUnsyncedForms returns only unsynced forms")
        fun getUnsyncedFormsReturnsUnsynced() = runTest {
            val forms = listOf(createTestFormEntity(id = "unsynced-1"))
            coEvery { formsDao.getUnsyncedForms() } returns forms

            val result = repository.getUnsyncedForms()

            assertThat(result).hasSize(1)
        }

        @Test
        @DisplayName("insertFormsFromNostr batch inserts forms")
        fun insertFormsFromNostrBatchInserts() = runTest {
            val forms = listOf(
                createTestFormEntity(id = "nostr-1"),
                createTestFormEntity(id = "nostr-2")
            )

            repository.insertFormsFromNostr(forms)

            coVerify { formsDao.insertForms(forms) }
        }
    }

    @Nested
    @DisplayName("FieldStats")
    inner class FieldStatsTests {

        @Test
        @DisplayName("ChoiceStats getPercentage calculates correctly")
        fun choiceStatsPercentage() {
            val stats = FieldStats.ChoiceStats(
                optionCounts = mapOf("yes" to 30, "no" to 10, "maybe" to 10),
                totalResponses = 50
            )

            assertThat(stats.getPercentage("yes")).isWithin(0.01).of(60.0)
            assertThat(stats.getPercentage("no")).isWithin(0.01).of(20.0)
            assertThat(stats.getPercentage("maybe")).isWithin(0.01).of(20.0)
        }

        @Test
        @DisplayName("ChoiceStats getPercentage returns 0 for empty responses")
        fun choiceStatsPercentageZero() {
            val stats = FieldStats.ChoiceStats(
                optionCounts = emptyMap(),
                totalResponses = 0
            )

            assertThat(stats.getPercentage("any")).isWithin(0.01).of(0.0)
        }

        @Test
        @DisplayName("ChoiceStats getPercentage returns 0 for missing option")
        fun choiceStatsPercentageMissingOption() {
            val stats = FieldStats.ChoiceStats(
                optionCounts = mapOf("yes" to 10),
                totalResponses = 10
            )

            assertThat(stats.getPercentage("nonexistent")).isWithin(0.01).of(0.0)
        }

        @Test
        @DisplayName("NumericStats stores min, max, average correctly")
        fun numericStatsCorrect() {
            val stats = FieldStats.NumericStats(
                min = 1.0,
                max = 10.0,
                average = 5.5,
                count = 20
            )

            assertThat(stats.min).isWithin(0.01).of(1.0)
            assertThat(stats.max).isWithin(0.01).of(10.0)
            assertThat(stats.average).isWithin(0.01).of(5.5)
            assertThat(stats.count).isEqualTo(20)
        }

        @Test
        @DisplayName("TextStats stores response count")
        fun textStatsCorrect() {
            val stats = FieldStats.TextStats(responseCount = 42)

            assertThat(stats.responseCount).isEqualTo(42)
        }
    }
}
