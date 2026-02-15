package network.buildit.modules.events.domain

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.SignedNostrEvent
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.generated.schemas.events.Event
import network.buildit.generated.schemas.events.Rsvp
import network.buildit.generated.schemas.events.RSVPStatus
import network.buildit.generated.schemas.events.Visibility
import network.buildit.modules.events.data.EventsRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Unit tests for EventsUseCase.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EventsUseCaseTest {

    private lateinit var useCase: EventsUseCase
    private lateinit var repository: EventsRepository
    private lateinit var cryptoManager: CryptoManager
    private lateinit var nostrClient: NostrClient

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private val testPubkey = "test-pubkey-12345"
    private val testEventId = "test-event-id"
    private val testGroupId = "test-group-id"

    @BeforeEach
    fun setup() {
        repository = mockk()
        cryptoManager = mockk()
        nostrClient = mockk()

        // Setup common mocks
        every { cryptoManager.getPublicKeyHex() } returns testPubkey

        useCase = EventsUseCase(repository, cryptoManager, nostrClient)
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    @Test
    fun `createEvent should save event and publish to Nostr`() = testScope.runTest {
        // Given
        val event = createTestEvent()
        val signedEvent = createTestSignedNostrEvent()

        coEvery { repository.saveEvent(any(), any()) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns signedEvent
        coEvery { nostrClient.publishEvent(any()) } returns true

        // When
        val result = useCase.createEvent(event, testGroupId)

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Success::class.java)
        val success = result as ModuleResult.Success
        assertThat(success.data.id).isNotEmpty()

        coVerify {
            repository.saveEvent(
                withArg { assertThat(it.id).isNotEmpty() },
                testGroupId
            )
            cryptoManager.signEvent(any())
            nostrClient.publishEvent(any())
        }
    }

    @Test
    fun `createEvent should generate ID if not provided`() = testScope.runTest {
        // Given
        val eventWithoutId = createTestEvent(id = "")
        val signedEvent = createTestSignedNostrEvent()

        coEvery { repository.saveEvent(any(), any()) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns signedEvent
        coEvery { nostrClient.publishEvent(any()) } returns true

        // When
        val result = useCase.createEvent(eventWithoutId, testGroupId)

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Success::class.java)
        val success = result as ModuleResult.Success
        assertThat(success.data.id).isNotEmpty()
    }

    @Test
    fun `createEvent should return error when crypto fails`() = testScope.runTest {
        // Given
        val event = createTestEvent()

        coEvery { repository.saveEvent(any(), any()) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns null

        // When
        val result = useCase.createEvent(event, testGroupId)

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Error::class.java)
    }

    @Test
    fun `updateEvent should update timestamp and publish`() = testScope.runTest {
        // Given
        val event = createTestEvent()
        val signedEvent = createTestSignedNostrEvent()

        coEvery { repository.updateEvent(any(), any()) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns signedEvent
        coEvery { nostrClient.publishEvent(any()) } returns true

        // When
        val result = useCase.updateEvent(event, testGroupId)

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Success::class.java)
        val success = result as ModuleResult.Success
        assertThat(success.data.updatedAt).isNotNull()

        coVerify { repository.updateEvent(any(), testGroupId) }
    }

    @Test
    fun `deleteEvent should delete from repository and publish delete event`() = testScope.runTest {
        // Given
        val signedEvent = createTestSignedNostrEvent()

        coEvery { repository.deleteEvent(testEventId) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns signedEvent
        coEvery { nostrClient.publishEvent(any()) } returns true

        // When
        val result = useCase.deleteEvent(testEventId)

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Success::class.java)

        coVerify {
            repository.deleteEvent(testEventId)
            cryptoManager.signEvent(withArg {
                assertThat(it.kind).isEqualTo(NostrClient.KIND_DELETE)
                assertThat(it.tags).contains(listOf("e", testEventId))
            })
        }
    }

    @Test
    fun `rsvp should create RSVP and publish to Nostr`() = testScope.runTest {
        // Given
        val signedEvent = createTestSignedNostrEvent()

        coEvery { repository.saveRsvp(any()) } just Runs
        coEvery { cryptoManager.signEvent(any()) } returns signedEvent
        coEvery { nostrClient.publishEvent(any()) } returns true

        // When
        val result = useCase.rsvp(
            eventId = testEventId,
            status = RSVPStatus.Going,
            guestCount = 2,
            note = "Looking forward to it!"
        )

        // Then
        assertThat(result).isInstanceOf(ModuleResult.Success::class.java)
        val success = result as ModuleResult.Success
        assertThat(success.data.eventID).isEqualTo(testEventId)
        assertThat(success.data.status).isEqualTo(RSVPStatus.Going)
        assertThat(success.data.guestCount).isEqualTo(2)
        assertThat(success.data.note).isEqualTo("Looking forward to it!")

        coVerify {
            repository.saveRsvp(any())
            nostrClient.publishEvent(any())
        }
    }

    @Test
    fun `getRsvps should return flow from repository`() = testScope.runTest {
        // Given
        val rsvps = listOf(
            createTestRsvp(status = RSVPStatus.Going),
            createTestRsvp(status = RSVPStatus.Maybe)
        )

        every { repository.getRsvpsForEvent(testEventId) } returns flowOf(rsvps)

        // When
        useCase.getRsvps(testEventId).test {
            // Then
            val items = awaitItem()
            assertThat(items).hasSize(2)
            assertThat(items[0].status).isEqualTo(RSVPStatus.Going)
            assertThat(items[1].status).isEqualTo(RSVPStatus.Maybe)
            awaitComplete()
        }
    }

    @Test
    fun `getUserRsvp should return user's RSVP`() = testScope.runTest {
        // Given
        val rsvp = createTestRsvp()

        coEvery { repository.getRsvp(testEventId, testPubkey) } returns rsvp

        // When
        val result = useCase.getUserRsvp(testEventId)

        // Then
        assertThat(result).isEqualTo(rsvp)
    }

    @Test
    fun `getEvents should return events for group`() = testScope.runTest {
        // Given
        val events = listOf(createTestEvent(), createTestEvent())

        every { repository.getEventsByGroup(testGroupId) } returns flowOf(events)

        // When
        useCase.getEvents(testGroupId).test {
            // Then
            val items = awaitItem()
            assertThat(items).hasSize(2)
            awaitComplete()
        }
    }

    @Test
    fun `getEvents should return public events when groupId is null`() = testScope.runTest {
        // Given
        val events = listOf(createTestEvent())

        every { repository.getPublicEvents() } returns flowOf(events)

        // When
        useCase.getEvents(null).test {
            // Then
            val items = awaitItem()
            assertThat(items).hasSize(1)
            awaitComplete()
        }

        verify { repository.getPublicEvents() }
    }

    @Test
    fun `getAttendeeCount should return count from repository`() = testScope.runTest {
        // Given
        coEvery { repository.getGoingCount(testEventId) } returns 5

        // When
        val count = useCase.getAttendeeCount(testEventId)

        // Then
        assertThat(count).isEqualTo(5)
    }

    // ============== Helper Methods ==============

    private fun createTestEvent(
        id: String = testEventId,
        title: String = "Test Event",
        startAt: Long = System.currentTimeMillis() / 1000
    ): Event {
        return Event(
            v = "1.0.0",
            id = id,
            title = title,
            description = "A test event",
            startAt = startAt,
            endAt = startAt + 3600,
            allDay = false,
            location = null,
            timezone = "America/New_York",
            virtualURL = null,
            visibility = Visibility.Group,
            createdBy = testPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            updatedAt = null,
            maxAttendees = null,
            rsvpDeadline = null,
            recurrence = null,
            attachments = null,
            customFields = null
        )
    }

    private fun createTestRsvp(
        status: RSVPStatus = RSVPStatus.Going
    ): Rsvp {
        return Rsvp(
            v = "1.0.0",
            eventID = testEventId,
            pubkey = testPubkey,
            status = status,
            guestCount = 0,
            note = null,
            respondedAt = System.currentTimeMillis() / 1000
        )
    }

    private fun createTestSignedNostrEvent(): SignedNostrEvent {
        return SignedNostrEvent(
            id = "signed-event-id",
            pubkey = testPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = EventsUseCase.KIND_EVENT,
            tags = emptyList(),
            content = "{}",
            sig = "test-signature"
        )
    }
}
