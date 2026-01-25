package network.buildit.modules.events.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.generated.schemas.Event
import network.buildit.generated.schemas.Rsvp
import network.buildit.generated.schemas.Status
import network.buildit.modules.events.data.EventsRepository
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for events module operations.
 *
 * Handles all business logic for:
 * - Creating and managing events
 * - RSVP tracking
 * - Event queries
 * - Nostr event publishing
 */
@Singleton
class EventsUseCase @Inject constructor(
    private val repository: EventsRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    /**
     * Creates a new event.
     *
     * @param event The event to create
     * @param groupId Optional group ID for group-scoped events
     * @return Result containing the created event
     */
    suspend fun createEvent(event: Event, groupId: String? = null): ModuleResult<Event> {
        return runCatching {
            // Generate ID if not provided
            val eventWithId = if (event.id.isBlank()) {
                event.copy(id = UUID.randomUUID().toString())
            } else {
                event
            }

            // Save to local storage
            repository.saveEvent(eventWithId, groupId)

            // Publish to Nostr
            publishEventToNostr(eventWithId, groupId)

            eventWithId
        }.toModuleResult()
    }

    /**
     * Updates an existing event.
     *
     * @param event The updated event
     * @param groupId Optional group ID
     * @return Result containing the updated event
     */
    suspend fun updateEvent(event: Event, groupId: String? = null): ModuleResult<Event> {
        return runCatching {
            val updatedEvent = event.copy(
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateEvent(updatedEvent, groupId)
            publishEventToNostr(updatedEvent, groupId)

            updatedEvent
        }.toModuleResult()
    }

    /**
     * Deletes an event.
     *
     * @param eventId The event ID to delete
     * @return Result indicating success or failure
     */
    suspend fun deleteEvent(eventId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteEvent(eventId)

            // Publish deletion event to Nostr (Kind 5)
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val deleteEvent = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = NostrClient.KIND_DELETE,
                tags = listOf(listOf("e", eventId)),
                content = ""
            )

            val signed = cryptoManager.signEvent(deleteEvent)
            if (signed != null) {
                nostrClient.publishEvent(
                    network.buildit.core.nostr.NostrEvent(
                        id = signed.id,
                        pubkey = signed.pubkey,
                        createdAt = signed.createdAt,
                        kind = signed.kind,
                        tags = signed.tags,
                        content = signed.content,
                        sig = signed.sig
                    )
                )
            }
        }.toModuleResult()
    }

    /**
     * Submits an RSVP for an event.
     *
     * @param eventId The event ID
     * @param status The RSVP status
     * @param guestCount Optional number of additional guests
     * @param note Optional note with the RSVP
     * @return Result containing the created RSVP
     */
    suspend fun rsvp(
        eventId: String,
        status: Status,
        guestCount: Long? = null,
        note: String? = null
    ): ModuleResult<Rsvp> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val rsvp = Rsvp(
                v = "1.0.0",
                eventID = eventId,
                pubkey = pubkey,
                status = status,
                guestCount = guestCount,
                note = note,
                respondedAt = System.currentTimeMillis() / 1000
            )

            // Save locally
            repository.saveRsvp(rsvp)

            // Publish to Nostr
            publishRsvpToNostr(rsvp)

            rsvp
        }.toModuleResult()
    }

    /**
     * Gets RSVPs for an event.
     *
     * @param eventId The event ID
     * @return Flow of RSVPs
     */
    fun getRsvps(eventId: String): Flow<List<Rsvp>> {
        return repository.getRsvpsForEvent(eventId)
    }

    /**
     * Gets the user's RSVP for an event.
     *
     * @param eventId The event ID
     * @return The user's RSVP, or null if they haven't responded
     */
    suspend fun getUserRsvp(eventId: String): Rsvp? {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return null
        return repository.getRsvp(eventId, pubkey)
    }

    /**
     * Gets RSVPs by status.
     *
     * @param eventId The event ID
     * @param status The RSVP status to filter by
     * @return Flow of RSVPs with the given status
     */
    fun getRsvpsByStatus(eventId: String, status: Status): Flow<List<Rsvp>> {
        return repository.getRsvpsByStatus(eventId, status)
    }

    /**
     * Gets the count of attendees marked as "going".
     *
     * @param eventId The event ID
     * @return Count of confirmed attendees
     */
    suspend fun getAttendeeCount(eventId: String): Int {
        return repository.getGoingCount(eventId)
    }

    /**
     * Gets all events for a group.
     *
     * @param groupId The group ID (null for public events)
     * @return Flow of events
     */
    fun getEvents(groupId: String?): Flow<List<Event>> {
        return if (groupId != null) {
            repository.getEventsByGroup(groupId)
        } else {
            repository.getPublicEvents()
        }
    }

    /**
     * Gets a specific event by ID.
     *
     * @param id The event ID
     * @return The event, or null if not found
     */
    suspend fun getEvent(id: String): Event? {
        return repository.getEvent(id)
    }

    /**
     * Observes a specific event.
     *
     * @param id The event ID
     * @return Flow of the event (null if deleted)
     */
    fun observeEvent(id: String): Flow<Event?> {
        return repository.observeEvent(id)
    }

    /**
     * Gets events in a time range.
     *
     * @param groupId The group ID
     * @param startTime Start of range (Unix timestamp)
     * @param endTime End of range (Unix timestamp)
     * @return Flow of events in the range
     */
    fun getEventsInRange(groupId: String, startTime: Long, endTime: Long): Flow<List<Event>> {
        return repository.getEventsInRange(groupId, startTime, endTime)
    }

    /**
     * Gets events created by the current user.
     *
     * @return Flow of user's events
     */
    fun getMyEvents(): Flow<List<Event>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return kotlinx.coroutines.flow.flowOf(emptyList())
        return repository.getEventsByCreator(pubkey)
    }

    /**
     * Gets upcoming event count for a group.
     *
     * @param groupId The group ID
     * @return Count of upcoming events
     */
    suspend fun getUpcomingEventCount(groupId: String): Int {
        return repository.getUpcomingEventCount(groupId)
    }

    /**
     * Publishes an event to Nostr relays.
     */
    private suspend fun publishEventToNostr(event: Event, groupId: String?) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        // Serialize event to JSON
        val content = Json.encodeToString(event)

        // Build tags
        val tags = mutableListOf<List<String>>()
        groupId?.let { tags.add(listOf("g", it)) }
        tags.add(listOf("d", event.id)) // Replaceable event marker

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = event.createdAt,
            kind = KIND_EVENT,
            tags = tags,
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    /**
     * Publishes an RSVP to Nostr relays.
     */
    private suspend fun publishRsvpToNostr(rsvp: Rsvp) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(rsvp)

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = rsvp.respondedAt,
            kind = KIND_RSVP,
            tags = listOf(
                listOf("e", rsvp.eventID),
                listOf("d", "${rsvp.eventID}-${rsvp.pubkey}") // Replaceable
            ),
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    companion object {
        const val KIND_EVENT = 31923 // Parameterized replaceable event for events
        const val KIND_RSVP = 31924 // Parameterized replaceable event for RSVPs
    }
}
