package network.buildit.modules.events.data

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import network.buildit.generated.schemas.events.Event
import network.buildit.generated.schemas.events.Rsvp
import network.buildit.generated.schemas.events.RSVPStatus
import network.buildit.generated.schemas.events.Visibility
import network.buildit.modules.events.data.local.EventEntity
import network.buildit.modules.events.data.local.EventsDao
import network.buildit.modules.events.data.local.RsvpEntity
import network.buildit.modules.events.data.local.RsvpsDao
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Unit tests for EventsRepository.
 *
 * Verifies CRUD operations, query filtering, and data mapping
 * between EventEntity/RsvpEntity and domain Event/Rsvp models.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("EventsRepository")
class EventsRepositoryTest {

    private lateinit var eventsDao: EventsDao
    private lateinit var rsvpsDao: RsvpsDao
    private lateinit var repository: EventsRepository

    private val testPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val testGroupId = "test-group-id"
    private val testEventId = "test-event-id"
    private val now = System.currentTimeMillis() / 1000

    @BeforeEach
    fun setup() {
        eventsDao = mockk(relaxed = true)
        rsvpsDao = mockk(relaxed = true)
        repository = EventsRepository(eventsDao, rsvpsDao)
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    // ============== Helper Methods ==============

    private fun createTestEvent(
        id: String = testEventId,
        title: String = "Community Meeting",
        startAt: Long = now + 3600,
        visibility: Visibility = Visibility.Group
    ): Event = Event(
        v = "1.0.0",
        id = id,
        title = title,
        description = "A community gathering",
        startAt = startAt,
        endAt = startAt + 7200,
        allDay = false,
        location = null,
        timezone = "America/New_York",
        virtualURL = null,
        visibility = visibility,
        createdBy = testPubkey,
        createdAt = now,
        updatedAt = null,
        maxAttendees = null,
        rsvpDeadline = null,
        recurrence = null,
        attachments = null,
        customFields = null
    )

    private fun createTestEventEntity(
        id: String = testEventId,
        title: String = "Community Meeting",
        groupId: String? = testGroupId
    ): EventEntity = mockk {
        every { toEvent() } returns createTestEvent(id = id, title = title)
        every { this@mockk.id } returns id
    }

    private fun createTestRsvp(
        eventId: String = testEventId,
        pubkey: String = testPubkey,
        status: RSVPStatus = RSVPStatus.Going
    ): Rsvp = Rsvp(
        v = "1.0.0",
        eventID = eventId,
        pubkey = pubkey,
        status = status,
        guestCount = 0,
        note = null,
        respondedAt = now
    )

    private fun createTestRsvpEntity(
        eventId: String = testEventId,
        pubkey: String = testPubkey,
        status: RSVPStatus = RSVPStatus.Going
    ): RsvpEntity = mockk {
        every { toRsvp() } returns createTestRsvp(eventId = eventId, pubkey = pubkey, status = status)
    }

    // ============== Event CRUD Tests ==============

    @Nested
    @DisplayName("Event Retrieval")
    inner class EventRetrieval {

        @Test
        @DisplayName("getEventsByGroup returns mapped events for a group")
        fun getEventsByGroupReturnsMappedEvents() = runTest {
            val entities = listOf(
                createTestEventEntity(id = "event-1", title = "Meeting 1"),
                createTestEventEntity(id = "event-2", title = "Meeting 2")
            )
            every { eventsDao.getEventsByGroup(testGroupId) } returns flowOf(entities)

            repository.getEventsByGroup(testGroupId).test {
                val events = awaitItem()
                assertThat(events).hasSize(2)
                assertThat(events[0].title).isEqualTo("Community Meeting")
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getEventsByGroup returns empty list for group with no events")
        fun getEventsByGroupReturnsEmptyList() = runTest {
            every { eventsDao.getEventsByGroup("empty-group") } returns flowOf(emptyList())

            repository.getEventsByGroup("empty-group").test {
                val events = awaitItem()
                assertThat(events).isEmpty()
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getPublicEvents returns only public events")
        fun getPublicEventsReturnsPublic() = runTest {
            val entity = createTestEventEntity(id = "public-1")
            every { eventsDao.getPublicEvents() } returns flowOf(listOf(entity))

            repository.getPublicEvents().test {
                val events = awaitItem()
                assertThat(events).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getEvent returns event when found")
        fun getEventReturnsWhenFound() = runTest {
            val entity = createTestEventEntity(id = testEventId)
            coEvery { eventsDao.getEvent(testEventId) } returns entity

            val event = repository.getEvent(testEventId)

            assertThat(event).isNotNull()
            assertThat(event?.id).isEqualTo(testEventId)
        }

        @Test
        @DisplayName("getEvent returns null when not found")
        fun getEventReturnsNullWhenNotFound() = runTest {
            coEvery { eventsDao.getEvent("nonexistent") } returns null

            val event = repository.getEvent("nonexistent")

            assertThat(event).isNull()
        }

        @Test
        @DisplayName("observeEvent emits event updates")
        fun observeEventEmitsUpdates() = runTest {
            val entity = createTestEventEntity(id = testEventId)
            every { eventsDao.observeEvent(testEventId) } returns flowOf(entity)

            repository.observeEvent(testEventId).test {
                val event = awaitItem()
                assertThat(event).isNotNull()
                assertThat(event?.id).isEqualTo(testEventId)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("observeEvent emits null when event deleted")
        fun observeEventEmitsNull() = runTest {
            every { eventsDao.observeEvent("deleted") } returns flowOf(null)

            repository.observeEvent("deleted").test {
                val event = awaitItem()
                assertThat(event).isNull()
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Event Query Filtering")
    inner class EventQueryFiltering {

        @Test
        @DisplayName("getEventsInRange returns events within time window")
        fun getEventsInRangeReturnsWithinWindow() = runTest {
            val startTime = now
            val endTime = now + 86400 // 1 day ahead
            val entity = createTestEventEntity(id = "range-event")
            every { eventsDao.getEventsInRange(testGroupId, startTime, endTime) } returns flowOf(listOf(entity))

            repository.getEventsInRange(testGroupId, startTime, endTime).test {
                val events = awaitItem()
                assertThat(events).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getEventsInRange returns empty for range with no events")
        fun getEventsInRangeReturnsEmptyForNoEvents() = runTest {
            val futureStart = now + 999999
            val futureEnd = now + 9999999
            every { eventsDao.getEventsInRange(testGroupId, futureStart, futureEnd) } returns flowOf(emptyList())

            repository.getEventsInRange(testGroupId, futureStart, futureEnd).test {
                val events = awaitItem()
                assertThat(events).isEmpty()
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getEventsByVisibility filters by visibility type")
        fun getEventsByVisibilityFilters() = runTest {
            val entity = createTestEventEntity(id = "group-vis")
            every { eventsDao.getEventsByVisibility("Group") } returns flowOf(listOf(entity))

            repository.getEventsByVisibility("Group").test {
                val events = awaitItem()
                assertThat(events).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getEventsByCreator returns events by a specific pubkey")
        fun getEventsByCreatorReturnsByPubkey() = runTest {
            val entity = createTestEventEntity(id = "creator-event")
            every { eventsDao.getEventsByCreator(testPubkey) } returns flowOf(listOf(entity))

            repository.getEventsByCreator(testPubkey).test {
                val events = awaitItem()
                assertThat(events).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getUpcomingEventCount returns count of future events")
        fun getUpcomingEventCountReturnsFutureCount() = runTest {
            coEvery { eventsDao.getUpcomingEventCount(testGroupId, any()) } returns 3

            val count = repository.getUpcomingEventCount(testGroupId)

            assertThat(count).isEqualTo(3)
        }
    }

    @Nested
    @DisplayName("Event Persistence")
    inner class EventPersistence {

        @Test
        @DisplayName("saveEvent inserts event entity with group ID")
        fun saveEventInsertsWithGroupId() = runTest {
            val event = createTestEvent()

            repository.saveEvent(event, testGroupId)

            coVerify { eventsDao.insertEvent(any()) }
        }

        @Test
        @DisplayName("saveEvent inserts event entity with null group ID")
        fun saveEventInsertsWithNullGroupId() = runTest {
            val event = createTestEvent()

            repository.saveEvent(event, null)

            coVerify { eventsDao.insertEvent(any()) }
        }

        @Test
        @DisplayName("updateEvent updates existing event entity")
        fun updateEventUpdatesExisting() = runTest {
            val event = createTestEvent()

            repository.updateEvent(event, testGroupId)

            coVerify { eventsDao.updateEvent(any()) }
        }

        @Test
        @DisplayName("deleteEvent removes event by ID")
        fun deleteEventRemovesById() = runTest {
            repository.deleteEvent(testEventId)

            coVerify { eventsDao.deleteEventById(testEventId) }
        }
    }

    // ============== RSVP Tests ==============

    @Nested
    @DisplayName("RSVP Operations")
    inner class RsvpOperations {

        @Test
        @DisplayName("getRsvpsForEvent returns all RSVPs for an event")
        fun getRsvpsForEventReturnsAll() = runTest {
            val entities = listOf(
                createTestRsvpEntity(status = RSVPStatus.Going),
                createTestRsvpEntity(pubkey = "other-user", status = RSVPStatus.Maybe)
            )
            every { rsvpsDao.getRsvpsForEvent(testEventId) } returns flowOf(entities)

            repository.getRsvpsForEvent(testEventId).test {
                val rsvps = awaitItem()
                assertThat(rsvps).hasSize(2)
                assertThat(rsvps[0].status).isEqualTo(RSVPStatus.Going)
                assertThat(rsvps[1].status).isEqualTo(RSVPStatus.Maybe)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getRsvp returns specific user RSVP")
        fun getRsvpReturnsSpecificUser() = runTest {
            val entity = createTestRsvpEntity()
            coEvery { rsvpsDao.getRsvp(testEventId, testPubkey) } returns entity

            val rsvp = repository.getRsvp(testEventId, testPubkey)

            assertThat(rsvp).isNotNull()
            assertThat(rsvp?.status).isEqualTo(RSVPStatus.Going)
        }

        @Test
        @DisplayName("getRsvp returns null when user has not RSVPed")
        fun getRsvpReturnsNullWhenNoRsvp() = runTest {
            coEvery { rsvpsDao.getRsvp(testEventId, "nonexistent") } returns null

            val rsvp = repository.getRsvp(testEventId, "nonexistent")

            assertThat(rsvp).isNull()
        }

        @Test
        @DisplayName("getRsvpsByStatus filters RSVPs by status")
        fun getRsvpsByStatusFilters() = runTest {
            val goingEntity = createTestRsvpEntity(status = RSVPStatus.Going)
            every { rsvpsDao.getRsvpsByStatus(testEventId, RSVPStatus.Going.value) } returns flowOf(listOf(goingEntity))

            repository.getRsvpsByStatus(testEventId, RSVPStatus.Going).test {
                val rsvps = awaitItem()
                assertThat(rsvps).hasSize(1)
                assertThat(rsvps[0].status).isEqualTo(RSVPStatus.Going)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getGoingCount returns correct attendee count")
        fun getGoingCountReturnsCorrect() = runTest {
            coEvery { rsvpsDao.getGoingCount(testEventId) } returns 15

            val count = repository.getGoingCount(testEventId)

            assertThat(count).isEqualTo(15)
        }

        @Test
        @DisplayName("getGoingCount returns zero for event with no RSVPs")
        fun getGoingCountReturnsZero() = runTest {
            coEvery { rsvpsDao.getGoingCount("no-rsvps") } returns 0

            val count = repository.getGoingCount("no-rsvps")

            assertThat(count).isEqualTo(0)
        }

        @Test
        @DisplayName("getRsvpsByUser returns all RSVPs by a user")
        fun getRsvpsByUserReturnsAll() = runTest {
            val entities = listOf(
                createTestRsvpEntity(eventId = "event-1"),
                createTestRsvpEntity(eventId = "event-2")
            )
            every { rsvpsDao.getRsvpsByUser(testPubkey) } returns flowOf(entities)

            repository.getRsvpsByUser(testPubkey).test {
                val rsvps = awaitItem()
                assertThat(rsvps).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("saveRsvp persists RSVP entity")
        fun saveRsvpPersists() = runTest {
            val rsvp = createTestRsvp()

            repository.saveRsvp(rsvp)

            coVerify { rsvpsDao.insertRsvp(any()) }
        }

        @Test
        @DisplayName("deleteRsvp removes RSVP by event and pubkey")
        fun deleteRsvpRemoves() = runTest {
            repository.deleteRsvp(testEventId, testPubkey)

            coVerify { rsvpsDao.deleteRsvpById(testEventId, testPubkey) }
        }
    }

    @Nested
    @DisplayName("Data Mapping")
    inner class DataMapping {

        @Test
        @DisplayName("EventEntity.toEvent preserves all required fields")
        fun eventEntityPreservesFields() {
            val event = createTestEvent(
                id = "map-test",
                title = "Mapping Test Event"
            )

            assertThat(event.id).isEqualTo("map-test")
            assertThat(event.title).isEqualTo("Mapping Test Event")
            assertThat(event.v).isEqualTo("1.0.0")
            assertThat(event.createdBy).isEqualTo(testPubkey)
            assertThat(event.allDay).isFalse()
        }

        @Test
        @DisplayName("Event with all optional fields null is valid")
        fun eventWithNullOptionalsValid() {
            val event = createTestEvent()

            assertThat(event.location).isNull()
            assertThat(event.virtualURL).isNull()
            assertThat(event.updatedAt).isNull()
            assertThat(event.maxAttendees).isNull()
            assertThat(event.rsvpDeadline).isNull()
            assertThat(event.recurrence).isNull()
            assertThat(event.attachments).isNull()
            assertThat(event.customFields).isNull()
        }

        @Test
        @DisplayName("Rsvp entity maps status enum correctly")
        fun rsvpEntityMapsStatus() {
            val goingRsvp = createTestRsvp(status = RSVPStatus.Going)
            val maybeRsvp = createTestRsvp(status = RSVPStatus.Maybe)
            val notGoingRsvp = createTestRsvp(status = RSVPStatus.NotGoing)

            assertThat(goingRsvp.status).isEqualTo(RSVPStatus.Going)
            assertThat(maybeRsvp.status).isEqualTo(RSVPStatus.Maybe)
            assertThat(notGoingRsvp.status).isEqualTo(RSVPStatus.NotGoing)
        }

        @Test
        @DisplayName("Rsvp guest count defaults to zero")
        fun rsvpGuestCountDefaultsToZero() {
            val rsvp = createTestRsvp()

            assertThat(rsvp.guestCount).isEqualTo(0)
        }
    }
}
