package network.buildit.modules.events.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.Event
import network.buildit.generated.schemas.LocationClass
import network.buildit.generated.schemas.Rsvp
import network.buildit.generated.schemas.Status
import network.buildit.generated.schemas.Visibility

/**
 * Room entity for events.
 */
@Entity(
    tableName = "events",
    indices = [
        Index("startAt"),
        Index("createdBy"),
        Index("groupId")
    ]
)
data class EventEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val title: String,
    val description: String?,
    val startAt: Long,
    val endAt: Long?,
    val allDay: Boolean,
    val locationJson: String?,
    val timezone: String?,
    val virtualUrl: String?,
    val visibility: String,
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?,
    val groupId: String?,
    val maxAttendees: Long?,
    val rsvpDeadline: Long?,
    val recurrenceJson: String?,
    val attachmentsJson: String?,
    val customFieldsJson: String?
) {
    /**
     * Converts this entity to the generated schema Event.
     */
    fun toEvent(): Event {
        return Event(
            v = schemaVersion,
            id = id,
            title = title,
            description = description,
            startAt = startAt,
            endAt = endAt,
            allDay = allDay,
            location = locationJson?.let { Json.decodeFromString<LocationClass>(it) },
            timezone = timezone,
            virtualURL = virtualUrl,
            visibility = Visibility.valueOf(visibility.replaceFirstChar { it.uppercase() }),
            createdBy = createdBy,
            createdAt = createdAt,
            updatedAt = updatedAt,
            maxAttendees = maxAttendees,
            rsvpDeadline = rsvpDeadline,
            recurrence = recurrenceJson?.let {
                Json.decodeFromString<network.buildit.generated.schemas.RecurrenceClass>(it)
            },
            attachments = attachmentsJson?.let {
                Json.decodeFromString<List<network.buildit.generated.schemas.AttachmentElement>>(it)
            },
            customFields = customFieldsJson?.let {
                Json.decodeFromString<kotlinx.serialization.json.JsonObject>(it)
            }
        )
    }

    companion object {
        /**
         * Creates an EventEntity from a generated schema Event.
         */
        fun from(event: Event, groupId: String?): EventEntity {
            return EventEntity(
                id = event.id,
                schemaVersion = event.v,
                title = event.title,
                description = event.description,
                startAt = event.startAt,
                endAt = event.endAt,
                allDay = event.allDay ?: false,
                locationJson = event.location?.let { Json.encodeToString(it) },
                timezone = event.timezone,
                virtualUrl = event.virtualURL,
                visibility = event.visibility?.value ?: "group",
                createdBy = event.createdBy,
                createdAt = event.createdAt,
                updatedAt = event.updatedAt,
                groupId = groupId,
                maxAttendees = event.maxAttendees,
                rsvpDeadline = event.rsvpDeadline,
                recurrenceJson = event.recurrence?.let { Json.encodeToString(it) },
                attachmentsJson = event.attachments?.let { Json.encodeToString(it) },
                customFieldsJson = event.customFields?.let { Json.encodeToString(it) }
            )
        }
    }
}

/**
 * Room entity for RSVPs.
 */
@Entity(
    tableName = "event_rsvps",
    indices = [
        Index("eventId"),
        Index("pubkey")
    ]
)
data class RsvpEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val eventId: String,
    val pubkey: String,
    val status: String,
    val guestCount: Long?,
    val note: String?,
    val respondedAt: Long
) {
    /**
     * Converts this entity to the generated schema Rsvp.
     */
    fun toRsvp(): Rsvp {
        return Rsvp(
            v = schemaVersion,
            eventID = eventId,
            pubkey = pubkey,
            status = Status.valueOf(status.replaceFirstChar { it.uppercase() }.replace("_", "")),
            guestCount = guestCount,
            note = note,
            respondedAt = respondedAt
        )
    }

    companion object {
        /**
         * Creates an RsvpEntity from a generated schema Rsvp.
         */
        fun from(rsvp: Rsvp): RsvpEntity {
            return RsvpEntity(
                id = "${rsvp.eventID}-${rsvp.pubkey}",
                schemaVersion = rsvp.v,
                eventId = rsvp.eventID,
                pubkey = rsvp.pubkey,
                status = rsvp.status.value,
                guestCount = rsvp.guestCount,
                note = rsvp.note,
                respondedAt = rsvp.respondedAt
            )
        }
    }
}
