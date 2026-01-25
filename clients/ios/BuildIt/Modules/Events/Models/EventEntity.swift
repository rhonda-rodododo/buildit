// EventEntity.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData model for persisting events locally.
// Wraps the generated Event schema type.

import Foundation
import SwiftData

/// SwiftData model for events
@Model
public final class EventEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var title: String
    public var eventDescription: String?
    public var startAt: Date
    public var endAt: Date?
    public var allDay: Bool
    public var timezone: String?

    // Location
    public var locationName: String?
    public var locationAddress: String?
    public var locationCoordinatesLat: Double?
    public var locationCoordinatesLon: Double?
    public var locationInstructions: String?

    // Virtual
    public var virtualURL: String?

    // Metadata
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var visibility: String
    public var groupId: String?

    // RSVP
    public var maxAttendees: Int?
    public var rsvpDeadline: Date?

    // Recurrence (stored as JSON)
    public var recurrenceJSON: Data?

    // Attachments (stored as JSON)
    public var attachmentsJSON: Data?

    // Custom fields (stored as JSON)
    public var customFieldsJSON: Data?

    // Relationship to RSVPs
    @Relationship(deleteRule: .cascade, inverse: \RsvpEntity.event)
    public var rsvps: [RsvpEntity]?

    public init(
        id: String,
        schemaVersion: String,
        title: String,
        eventDescription: String?,
        startAt: Date,
        endAt: Date?,
        allDay: Bool,
        timezone: String?,
        locationName: String?,
        locationAddress: String?,
        locationCoordinatesLat: Double?,
        locationCoordinatesLon: Double?,
        locationInstructions: String?,
        virtualURL: String?,
        createdBy: String,
        createdAt: Date,
        updatedAt: Date?,
        visibility: String,
        groupId: String?,
        maxAttendees: Int?,
        rsvpDeadline: Date?,
        recurrenceJSON: Data?,
        attachmentsJSON: Data?,
        customFieldsJSON: Data?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.title = title
        self.eventDescription = eventDescription
        self.startAt = startAt
        self.endAt = endAt
        self.allDay = allDay
        self.timezone = timezone
        self.locationName = locationName
        self.locationAddress = locationAddress
        self.locationCoordinatesLat = locationCoordinatesLat
        self.locationCoordinatesLon = locationCoordinatesLon
        self.locationInstructions = locationInstructions
        self.virtualURL = virtualURL
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.visibility = visibility
        self.groupId = groupId
        self.maxAttendees = maxAttendees
        self.rsvpDeadline = rsvpDeadline
        self.recurrenceJSON = recurrenceJSON
        self.attachmentsJSON = attachmentsJSON
        self.customFieldsJSON = customFieldsJSON
    }

    /// Convert from generated Event type
    public static func from(_ event: Event, groupId: String?) -> EventEntity {
        let encoder = JSONEncoder()

        return EventEntity(
            id: event.id,
            schemaVersion: event.v,
            title: event.title,
            eventDescription: event.description,
            startAt: Date(timeIntervalSince1970: TimeInterval(event.startAt)),
            endAt: event.endAt.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            allDay: event.allDay ?? false,
            timezone: event.timezone,
            locationName: event.location?.name,
            locationAddress: event.location?.address,
            locationCoordinatesLat: event.location?.coordinates?.first,
            locationCoordinatesLon: event.location?.coordinates?.last,
            locationInstructions: event.location?.instructions,
            virtualURL: event.virtualURL,
            createdBy: event.createdBy,
            createdAt: Date(timeIntervalSince1970: TimeInterval(event.createdAt)),
            updatedAt: event.updatedAt.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            visibility: event.visibility?.rawValue ?? "group",
            groupId: groupId,
            maxAttendees: event.maxAttendees,
            rsvpDeadline: event.rsvpDeadline.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            recurrenceJSON: event.recurrence.flatMap { try? encoder.encode($0) },
            attachmentsJSON: event.attachments.flatMap { try? encoder.encode($0) },
            customFieldsJSON: event.customFields.flatMap { try? encoder.encode($0) }
        )
    }

    /// Convert to generated Event type
    public func toEvent() -> Event {
        let decoder = JSONDecoder()

        let location: LocationClass? = {
            guard locationName != nil || locationAddress != nil else { return nil }
            return LocationClass(
                address: locationAddress,
                coordinates: locationCoordinatesLat.flatMap { lat in
                    locationCoordinatesLon.map { lon in [lat, lon] }
                },
                instructions: locationInstructions,
                name: locationName
            )
        }()

        let recurrence = recurrenceJSON.flatMap { try? decoder.decode(RecurrenceClass.self, from: $0) }
        let attachments = attachmentsJSON.flatMap { try? decoder.decode([AttachmentElement].self, from: $0) }
        let customFields = customFieldsJSON.flatMap { try? decoder.decode([String: Any?].self, from: $0) }

        return Event(
            v: schemaVersion,
            allDay: allDay,
            attachments: attachments,
            createdAt: Int(createdAt.timeIntervalSince1970),
            createdBy: createdBy,
            customFields: customFields,
            description: eventDescription,
            endAt: endAt.map { Int($0.timeIntervalSince1970) },
            id: id,
            location: location,
            maxAttendees: maxAttendees,
            recurrence: recurrence,
            rsvpDeadline: rsvpDeadline.map { Int($0.timeIntervalSince1970) },
            startAt: Int(startAt.timeIntervalSince1970),
            timezone: timezone,
            title: title,
            updatedAt: updatedAt.map { Int($0.timeIntervalSince1970) },
            virtualURL: virtualURL,
            visibility: Visibility(rawValue: visibility)
        )
    }
}

/// SwiftData model for RSVPs
@Model
public final class RsvpEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var eventID: String
    public var pubkey: String
    public var status: String
    public var respondedAt: Date
    public var guestCount: Int?
    public var note: String?

    // Relationship to event
    public var event: EventEntity?

    public init(
        id: String,
        schemaVersion: String,
        eventID: String,
        pubkey: String,
        status: String,
        respondedAt: Date,
        guestCount: Int?,
        note: String?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.eventID = eventID
        self.pubkey = pubkey
        self.status = status
        self.respondedAt = respondedAt
        self.guestCount = guestCount
        self.note = note
    }

    /// Convert from generated Rsvp type
    public static func from(_ rsvp: Rsvp, event: EventEntity?) -> RsvpEntity {
        let entity = RsvpEntity(
            id: "\(rsvp.eventID)-\(rsvp.pubkey)",
            schemaVersion: rsvp.v,
            eventID: rsvp.eventID,
            pubkey: rsvp.pubkey,
            status: rsvp.status.rawValue,
            respondedAt: Date(timeIntervalSince1970: TimeInterval(rsvp.respondedAt)),
            guestCount: rsvp.guestCount,
            note: rsvp.note
        )
        entity.event = event
        return entity
    }

    /// Convert to generated Rsvp type
    public func toRsvp() -> Rsvp {
        Rsvp(
            v: schemaVersion,
            eventID: eventID,
            guestCount: guestCount,
            note: note,
            pubkey: pubkey,
            respondedAt: Int(respondedAt.timeIntervalSince1970),
            status: Status(rawValue: status) ?? .maybe
        )
    }
}
