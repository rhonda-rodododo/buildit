package network.buildit.modules.events.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.generated.schemas.Event
import network.buildit.generated.schemas.Rsvp
import network.buildit.generated.schemas.Status
import network.buildit.modules.events.data.local.EventEntity
import network.buildit.modules.events.data.local.EventsDao
import network.buildit.modules.events.data.local.RsvpEntity
import network.buildit.modules.events.data.local.RsvpsDao
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for event data.
 *
 * Provides a clean API for accessing events and RSVPs from local storage.
 * In the future, this could be extended to sync with remote sources.
 */
@Singleton
class EventsRepository @Inject constructor(
    private val eventsDao: EventsDao,
    private val rsvpsDao: RsvpsDao
) {
    /**
     * Gets all events for a specific group.
     */
    fun getEventsByGroup(groupId: String): Flow<List<Event>> {
        return eventsDao.getEventsByGroup(groupId).map { entities ->
            entities.map { it.toEvent() }
        }
    }

    /**
     * Gets all public events.
     */
    fun getPublicEvents(): Flow<List<Event>> {
        return eventsDao.getPublicEvents().map { entities ->
            entities.map { it.toEvent() }
        }
    }

    /**
     * Gets a specific event by ID.
     */
    suspend fun getEvent(id: String): Event? {
        return eventsDao.getEvent(id)?.toEvent()
    }

    /**
     * Observes a specific event.
     */
    fun observeEvent(id: String): Flow<Event?> {
        return eventsDao.observeEvent(id).map { it?.toEvent() }
    }

    /**
     * Gets events in a time range for a group.
     */
    fun getEventsInRange(groupId: String, startTime: Long, endTime: Long): Flow<List<Event>> {
        return eventsDao.getEventsInRange(groupId, startTime, endTime).map { entities ->
            entities.map { it.toEvent() }
        }
    }

    /**
     * Gets events by visibility.
     */
    fun getEventsByVisibility(visibility: String): Flow<List<Event>> {
        return eventsDao.getEventsByVisibility(visibility).map { entities ->
            entities.map { it.toEvent() }
        }
    }

    /**
     * Gets events created by a specific user.
     */
    fun getEventsByCreator(pubkey: String): Flow<List<Event>> {
        return eventsDao.getEventsByCreator(pubkey).map { entities ->
            entities.map { it.toEvent() }
        }
    }

    /**
     * Saves an event to local storage.
     */
    suspend fun saveEvent(event: Event, groupId: String?) {
        eventsDao.insertEvent(EventEntity.from(event, groupId))
    }

    /**
     * Updates an existing event.
     */
    suspend fun updateEvent(event: Event, groupId: String?) {
        eventsDao.updateEvent(EventEntity.from(event, groupId))
    }

    /**
     * Deletes an event.
     */
    suspend fun deleteEvent(eventId: String) {
        eventsDao.deleteEventById(eventId)
    }

    /**
     * Gets the count of upcoming events for a group.
     */
    suspend fun getUpcomingEventCount(groupId: String): Int {
        val currentTime = System.currentTimeMillis() / 1000
        return eventsDao.getUpcomingEventCount(groupId, currentTime)
    }

    // ============== RSVP Methods ==============

    /**
     * Gets all RSVPs for an event.
     */
    fun getRsvpsForEvent(eventId: String): Flow<List<Rsvp>> {
        return rsvpsDao.getRsvpsForEvent(eventId).map { entities ->
            entities.map { it.toRsvp() }
        }
    }

    /**
     * Gets a specific user's RSVP for an event.
     */
    suspend fun getRsvp(eventId: String, pubkey: String): Rsvp? {
        return rsvpsDao.getRsvp(eventId, pubkey)?.toRsvp()
    }

    /**
     * Gets RSVPs by status.
     */
    fun getRsvpsByStatus(eventId: String, status: Status): Flow<List<Rsvp>> {
        return rsvpsDao.getRsvpsByStatus(eventId, status.value).map { entities ->
            entities.map { it.toRsvp() }
        }
    }

    /**
     * Gets the count of attendees marked as "going".
     */
    suspend fun getGoingCount(eventId: String): Int {
        return rsvpsDao.getGoingCount(eventId)
    }

    /**
     * Gets all RSVPs by a specific user.
     */
    fun getRsvpsByUser(pubkey: String): Flow<List<Rsvp>> {
        return rsvpsDao.getRsvpsByUser(pubkey).map { entities ->
            entities.map { it.toRsvp() }
        }
    }

    /**
     * Saves an RSVP.
     */
    suspend fun saveRsvp(rsvp: Rsvp) {
        rsvpsDao.insertRsvp(RsvpEntity.from(rsvp))
    }

    /**
     * Deletes an RSVP.
     */
    suspend fun deleteRsvp(eventId: String, pubkey: String) {
        rsvpsDao.deleteRsvpById(eventId, pubkey)
    }
}
