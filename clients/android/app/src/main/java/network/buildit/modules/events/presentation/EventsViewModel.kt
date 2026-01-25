package network.buildit.modules.events.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.generated.schemas.Event
import network.buildit.generated.schemas.Rsvp
import network.buildit.generated.schemas.Status
import network.buildit.modules.events.domain.EventsUseCase
import javax.inject.Inject

/**
 * ViewModel for the Events module.
 *
 * Manages UI state for:
 * - Event list
 * - Event details
 * - RSVP management
 * - Event creation/editing
 */
@HiltViewModel
class EventsViewModel @Inject constructor(
    private val eventsUseCase: EventsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<EventsUiState>(EventsUiState.Loading)
    val uiState: StateFlow<EventsUiState> = _uiState.asStateFlow()

    private val _eventDetailState = MutableStateFlow<EventDetailState>(EventDetailState.Loading)
    val eventDetailState: StateFlow<EventDetailState> = _eventDetailState.asStateFlow()

    private var currentGroupId: String? = null

    /**
     * Loads events for a specific group.
     */
    fun loadEvents(groupId: String?) {
        currentGroupId = groupId
        viewModelScope.launch {
            _uiState.value = EventsUiState.Loading
            eventsUseCase.getEvents(groupId).collect { events ->
                _uiState.value = EventsUiState.EventList(
                    events = events,
                    groupId = groupId
                )
            }
        }
    }

    /**
     * Loads a specific event and its RSVPs.
     */
    fun loadEventDetail(eventId: String) {
        viewModelScope.launch {
            _eventDetailState.value = EventDetailState.Loading

            // Collect event and RSVPs
            eventsUseCase.observeEvent(eventId).collect { event ->
                if (event == null) {
                    _eventDetailState.value = EventDetailState.Error("Event not found")
                    return@collect
                }

                // Get RSVPs
                eventsUseCase.getRsvps(eventId).collect { rsvps ->
                    val userRsvp = eventsUseCase.getUserRsvp(eventId)
                    val attendeeCount = eventsUseCase.getAttendeeCount(eventId)

                    _eventDetailState.value = EventDetailState.Success(
                        event = event,
                        rsvps = rsvps,
                        userRsvp = userRsvp,
                        attendeeCount = attendeeCount
                    )
                }
            }
        }
    }

    /**
     * Creates a new event.
     */
    fun createEvent(event: Event, groupId: String? = null) {
        viewModelScope.launch {
            _uiState.value = EventsUiState.Creating

            when (val result = eventsUseCase.createEvent(event, groupId)) {
                is ModuleResult.Success -> {
                    loadEvents(groupId)
                }
                is ModuleResult.Error -> {
                    _uiState.value = EventsUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = EventsUiState.Error("Events module not enabled")
                }
            }
        }
    }

    /**
     * Updates an existing event.
     */
    fun updateEvent(event: Event, groupId: String? = null) {
        viewModelScope.launch {
            when (val result = eventsUseCase.updateEvent(event, groupId)) {
                is ModuleResult.Success -> {
                    loadEventDetail(event.id)
                }
                is ModuleResult.Error -> {
                    _eventDetailState.value = EventDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _eventDetailState.value = EventDetailState.Error("Events module not enabled")
                }
            }
        }
    }

    /**
     * Deletes an event.
     */
    fun deleteEvent(eventId: String) {
        viewModelScope.launch {
            when (val result = eventsUseCase.deleteEvent(eventId)) {
                is ModuleResult.Success -> {
                    loadEvents(currentGroupId)
                }
                is ModuleResult.Error -> {
                    _eventDetailState.value = EventDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _eventDetailState.value = EventDetailState.Error("Events module not enabled")
                }
            }
        }
    }

    /**
     * Submits an RSVP.
     */
    fun rsvp(eventId: String, status: Status, guestCount: Long? = null, note: String? = null) {
        viewModelScope.launch {
            when (val result = eventsUseCase.rsvp(eventId, status, guestCount, note)) {
                is ModuleResult.Success -> {
                    loadEventDetail(eventId)
                }
                is ModuleResult.Error -> {
                    _eventDetailState.value = EventDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _eventDetailState.value = EventDetailState.Error("Events module not enabled")
                }
            }
        }
    }

    /**
     * Loads events in a specific date range.
     */
    fun loadEventsInRange(groupId: String, startTime: Long, endTime: Long) {
        viewModelScope.launch {
            eventsUseCase.getEventsInRange(groupId, startTime, endTime).collect { events ->
                _uiState.value = EventsUiState.EventList(
                    events = events,
                    groupId = groupId
                )
            }
        }
    }

    /**
     * Loads the current user's created events.
     */
    fun loadMyEvents() {
        viewModelScope.launch {
            eventsUseCase.getMyEvents().collect { events ->
                _uiState.value = EventsUiState.EventList(
                    events = events,
                    groupId = null
                )
            }
        }
    }
}

/**
 * UI state for the events list screen.
 */
sealed class EventsUiState {
    data object Loading : EventsUiState()
    data object Creating : EventsUiState()
    data class EventList(
        val events: List<Event>,
        val groupId: String?
    ) : EventsUiState()
    data class Error(val message: String) : EventsUiState()
}

/**
 * UI state for the event detail screen.
 */
sealed class EventDetailState {
    data object Loading : EventDetailState()
    data class Success(
        val event: Event,
        val rsvps: List<Rsvp>,
        val userRsvp: Rsvp?,
        val attendeeCount: Int
    ) : EventDetailState()
    data class Error(val message: String) : EventDetailState()
}
