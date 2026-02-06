package network.buildit.modules.events.presentation

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.modules.ModuleResult
import network.buildit.generated.schemas.events.Event
import network.buildit.generated.schemas.events.Rsvp
import network.buildit.generated.schemas.events.Status
import network.buildit.generated.schemas.events.Visibility
import network.buildit.modules.events.domain.EventsUseCase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Unit tests for EventsViewModel.
 *
 * Verifies UI state management, loading states, error handling,
 * and state transitions for the Events module.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("EventsViewModel")
class EventsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var eventsUseCase: EventsUseCase
    private lateinit var viewModel: EventsViewModel

    private val testPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val testGroupId = "test-group-id"
    private val testEventId = "test-event-id"
    private val now = System.currentTimeMillis() / 1000

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        eventsUseCase = mockk(relaxed = true)
        viewModel = EventsViewModel(eventsUseCase)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    // ============== Helper Methods ==============

    private fun createTestEvent(
        id: String = testEventId,
        title: String = "Community Meeting"
    ): Event = Event(
        v = "1.0.0",
        id = id,
        title = title,
        description = "A community gathering",
        startAt = now + 3600,
        endAt = now + 7200,
        allDay = false,
        location = null,
        timezone = "America/New_York",
        virtualURL = null,
        visibility = Visibility.Group,
        createdBy = testPubkey,
        createdAt = now,
        updatedAt = null,
        maxAttendees = null,
        rsvpDeadline = null,
        recurrence = null,
        attachments = null,
        customFields = null
    )

    private fun createTestRsvp(
        status: Status = Status.Going
    ): Rsvp = Rsvp(
        v = "1.0.0",
        eventID = testEventId,
        pubkey = testPubkey,
        status = status,
        guestCount = 0,
        note = null,
        respondedAt = now
    )

    // ============== UI State Tests ==============

    @Nested
    @DisplayName("Initial State")
    inner class InitialState {

        @Test
        @DisplayName("initial uiState is Loading")
        fun initialUiStateIsLoading() {
            assertThat(viewModel.uiState.value).isEqualTo(EventsUiState.Loading)
        }

        @Test
        @DisplayName("initial eventDetailState is Loading")
        fun initialEventDetailStateIsLoading() {
            assertThat(viewModel.eventDetailState.value).isEqualTo(EventDetailState.Loading)
        }
    }

    @Nested
    @DisplayName("Loading Events")
    inner class LoadingEvents {

        @Test
        @DisplayName("loadEvents transitions to Loading state first")
        fun loadEventsTransitionsToLoading() = testScope.runTest {
            every { eventsUseCase.getEvents(testGroupId) } returns flowOf(emptyList())

            viewModel.loadEvents(testGroupId)

            // Initial state before coroutine runs should be Loading
            assertThat(viewModel.uiState.value).isInstanceOf(EventsUiState.Loading::class.java)
        }

        @Test
        @DisplayName("loadEvents transitions to EventList on success")
        fun loadEventsTransitionsToEventList() = testScope.runTest {
            val events = listOf(createTestEvent())
            every { eventsUseCase.getEvents(testGroupId) } returns flowOf(events)

            viewModel.loadEvents(testGroupId)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.EventList::class.java)
                val eventList = state as EventsUiState.EventList
                assertThat(eventList.events).hasSize(1)
                assertThat(eventList.groupId).isEqualTo(testGroupId)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("loadEvents with null groupId gets public events")
        fun loadEventsNullGroupIdGetsPublic() = testScope.runTest {
            val events = listOf(createTestEvent())
            every { eventsUseCase.getEvents(null) } returns flowOf(events)

            viewModel.loadEvents(null)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.EventList::class.java)
                val eventList = state as EventsUiState.EventList
                assertThat(eventList.groupId).isNull()
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("loadEvents with empty result shows empty list")
        fun loadEventsEmptyResult() = testScope.runTest {
            every { eventsUseCase.getEvents(testGroupId) } returns flowOf(emptyList())

            viewModel.loadEvents(testGroupId)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.EventList::class.java)
                val eventList = state as EventsUiState.EventList
                assertThat(eventList.events).isEmpty()
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Event Detail Loading")
    inner class EventDetailLoading {

        @Test
        @DisplayName("loadEventDetail transitions to Loading first")
        fun loadEventDetailTransitionsToLoading() = testScope.runTest {
            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(null)

            viewModel.loadEventDetail(testEventId)

            // Before coroutine processes, should be Loading
            assertThat(viewModel.eventDetailState.value).isInstanceOf(EventDetailState.Loading::class.java)
        }

        @Test
        @DisplayName("loadEventDetail shows Error for missing event")
        fun loadEventDetailErrorForMissing() = testScope.runTest {
            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(null)

            viewModel.loadEventDetail(testEventId)
            advanceUntilIdle()

            viewModel.eventDetailState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventDetailState.Error::class.java)
                val error = state as EventDetailState.Error
                assertThat(error.message).isEqualTo("Event not found")
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("loadEventDetail shows Success with event, RSVPs, and count")
        fun loadEventDetailSuccess() = testScope.runTest {
            val event = createTestEvent()
            val rsvps = listOf(createTestRsvp())

            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(event)
            every { eventsUseCase.getRsvps(testEventId) } returns flowOf(rsvps)
            coEvery { eventsUseCase.getUserRsvp(testEventId) } returns createTestRsvp()
            coEvery { eventsUseCase.getAttendeeCount(testEventId) } returns 10

            viewModel.loadEventDetail(testEventId)
            advanceUntilIdle()

            viewModel.eventDetailState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventDetailState.Success::class.java)
                val success = state as EventDetailState.Success
                assertThat(success.event.id).isEqualTo(testEventId)
                assertThat(success.rsvps).hasSize(1)
                assertThat(success.userRsvp).isNotNull()
                assertThat(success.attendeeCount).isEqualTo(10)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Event Creation")
    inner class EventCreation {

        @Test
        @DisplayName("createEvent transitions to Creating state")
        fun createEventTransitionsToCreating() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.createEvent(any(), any()) } returns ModuleResult.Success(event)
            every { eventsUseCase.getEvents(any()) } returns flowOf(emptyList())

            viewModel.createEvent(event, testGroupId)

            // The first state emitted should be Creating
            assertThat(viewModel.uiState.value).isEqualTo(EventsUiState.Creating)
        }

        @Test
        @DisplayName("createEvent reloads events on success")
        fun createEventReloadsOnSuccess() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.createEvent(event, testGroupId) } returns ModuleResult.Success(event)
            every { eventsUseCase.getEvents(testGroupId) } returns flowOf(listOf(event))

            viewModel.createEvent(event, testGroupId)
            advanceUntilIdle()

            verify { eventsUseCase.getEvents(testGroupId) }
        }

        @Test
        @DisplayName("createEvent shows Error on failure")
        fun createEventShowsError() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.createEvent(event, testGroupId) } returns ModuleResult.Error("Signing failed")

            viewModel.createEvent(event, testGroupId)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.Error::class.java)
                val error = state as EventsUiState.Error
                assertThat(error.message).isEqualTo("Signing failed")
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("createEvent shows Error when module not enabled")
        fun createEventShowsNotEnabledError() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.createEvent(event, testGroupId) } returns ModuleResult.NotEnabled

            viewModel.createEvent(event, testGroupId)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.Error::class.java)
                val error = state as EventsUiState.Error
                assertThat(error.message).isEqualTo("Events module not enabled")
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Event Updates")
    inner class EventUpdates {

        @Test
        @DisplayName("updateEvent reloads detail on success")
        fun updateEventReloadsDetail() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.updateEvent(event, testGroupId) } returns ModuleResult.Success(event)
            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(event)
            every { eventsUseCase.getRsvps(testEventId) } returns flowOf(emptyList())
            coEvery { eventsUseCase.getUserRsvp(testEventId) } returns null
            coEvery { eventsUseCase.getAttendeeCount(testEventId) } returns 0

            viewModel.updateEvent(event, testGroupId)
            advanceUntilIdle()

            verify { eventsUseCase.observeEvent(testEventId) }
        }

        @Test
        @DisplayName("updateEvent shows Error on failure")
        fun updateEventShowsError() = testScope.runTest {
            val event = createTestEvent()
            coEvery { eventsUseCase.updateEvent(event, testGroupId) } returns ModuleResult.Error("Update failed")

            viewModel.updateEvent(event, testGroupId)
            advanceUntilIdle()

            viewModel.eventDetailState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventDetailState.Error::class.java)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Event Deletion")
    inner class EventDeletion {

        @Test
        @DisplayName("deleteEvent reloads event list on success")
        fun deleteEventReloadsOnSuccess() = testScope.runTest {
            coEvery { eventsUseCase.deleteEvent(testEventId) } returns ModuleResult.Success(Unit)
            every { eventsUseCase.getEvents(any()) } returns flowOf(emptyList())

            viewModel.deleteEvent(testEventId)
            advanceUntilIdle()

            coVerify { eventsUseCase.deleteEvent(testEventId) }
        }

        @Test
        @DisplayName("deleteEvent shows Error on failure")
        fun deleteEventShowsError() = testScope.runTest {
            coEvery { eventsUseCase.deleteEvent(testEventId) } returns ModuleResult.Error("Delete failed")

            viewModel.deleteEvent(testEventId)
            advanceUntilIdle()

            viewModel.eventDetailState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventDetailState.Error::class.java)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("RSVP Management")
    inner class RsvpManagement {

        @Test
        @DisplayName("rsvp reloads event detail on success")
        fun rsvpReloadsOnSuccess() = testScope.runTest {
            val rsvp = createTestRsvp()
            coEvery { eventsUseCase.rsvp(testEventId, Status.Going, null, null) } returns ModuleResult.Success(rsvp)
            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(createTestEvent())
            every { eventsUseCase.getRsvps(testEventId) } returns flowOf(listOf(rsvp))
            coEvery { eventsUseCase.getUserRsvp(testEventId) } returns rsvp
            coEvery { eventsUseCase.getAttendeeCount(testEventId) } returns 1

            viewModel.rsvp(testEventId, Status.Going)
            advanceUntilIdle()

            coVerify { eventsUseCase.rsvp(testEventId, Status.Going, null, null) }
        }

        @Test
        @DisplayName("rsvp passes guest count and note")
        fun rsvpPassesGuestCountAndNote() = testScope.runTest {
            val rsvp = createTestRsvp()
            coEvery { eventsUseCase.rsvp(testEventId, Status.Going, 3L, "Plus 2 friends") } returns ModuleResult.Success(rsvp)
            every { eventsUseCase.observeEvent(testEventId) } returns flowOf(createTestEvent())
            every { eventsUseCase.getRsvps(testEventId) } returns flowOf(emptyList())
            coEvery { eventsUseCase.getUserRsvp(testEventId) } returns null
            coEvery { eventsUseCase.getAttendeeCount(testEventId) } returns 0

            viewModel.rsvp(testEventId, Status.Going, 3L, "Plus 2 friends")
            advanceUntilIdle()

            coVerify { eventsUseCase.rsvp(testEventId, Status.Going, 3L, "Plus 2 friends") }
        }

        @Test
        @DisplayName("rsvp shows Error on failure")
        fun rsvpShowsError() = testScope.runTest {
            coEvery { eventsUseCase.rsvp(testEventId, Status.Going, null, null) } returns ModuleResult.Error("RSVP failed")

            viewModel.rsvp(testEventId, Status.Going)
            advanceUntilIdle()

            viewModel.eventDetailState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventDetailState.Error::class.java)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Date Range Queries")
    inner class DateRangeQueries {

        @Test
        @DisplayName("loadEventsInRange collects events within range")
        fun loadEventsInRangeCollects() = testScope.runTest {
            val start = now
            val end = now + 86400
            val events = listOf(createTestEvent())
            every { eventsUseCase.getEventsInRange(testGroupId, start, end) } returns flowOf(events)

            viewModel.loadEventsInRange(testGroupId, start, end)
            advanceUntilIdle()

            viewModel.uiState.test {
                val state = awaitItem()
                assertThat(state).isInstanceOf(EventsUiState.EventList::class.java)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Sealed State Classes")
    inner class SealedStateClasses {

        @Test
        @DisplayName("EventsUiState.Loading is a singleton object")
        fun loadingIsSingleton() {
            val a = EventsUiState.Loading
            val b = EventsUiState.Loading
            assertThat(a).isSameInstanceAs(b)
        }

        @Test
        @DisplayName("EventsUiState.Creating is a singleton object")
        fun creatingIsSingleton() {
            val a = EventsUiState.Creating
            val b = EventsUiState.Creating
            assertThat(a).isSameInstanceAs(b)
        }

        @Test
        @DisplayName("EventsUiState.Error contains message")
        fun errorContainsMessage() {
            val error = EventsUiState.Error("Something went wrong")
            assertThat(error.message).isEqualTo("Something went wrong")
        }

        @Test
        @DisplayName("EventDetailState.Success contains all fields")
        fun detailSuccessContainsAll() {
            val event = createTestEvent()
            val rsvps = listOf(createTestRsvp())
            val state = EventDetailState.Success(
                event = event,
                rsvps = rsvps,
                userRsvp = createTestRsvp(),
                attendeeCount = 5
            )

            assertThat(state.event).isEqualTo(event)
            assertThat(state.rsvps).hasSize(1)
            assertThat(state.userRsvp).isNotNull()
            assertThat(state.attendeeCount).isEqualTo(5)
        }

        @Test
        @DisplayName("EventDetailState.Success userRsvp can be null")
        fun detailSuccessNullUserRsvp() {
            val state = EventDetailState.Success(
                event = createTestEvent(),
                rsvps = emptyList(),
                userRsvp = null,
                attendeeCount = 0
            )

            assertThat(state.userRsvp).isNull()
        }
    }
}
