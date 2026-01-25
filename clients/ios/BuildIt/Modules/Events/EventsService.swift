// EventsService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for the Events module.
// Handles event creation, RSVP management, and Nostr event publishing.

import Foundation
import os.log

/// Service for managing events
@MainActor
public class EventsService {
    // MARK: - Properties

    private let store: EventsStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "EventsService")

    // Event kinds for Nostr
    private static let eventKind = 31922  // NIP-52 calendar event
    private static let rsvpKind = 31925   // NIP-52 calendar event RSVP

    // MARK: - Initialization

    public init(store: EventsStore) {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
    }

    // MARK: - Event Management

    /// Create a new event
    public func createEvent(
        title: String,
        description: String?,
        startAt: Date,
        endAt: Date?,
        allDay: Bool = false,
        location: LocationClass? = nil,
        virtualURL: String? = nil,
        visibility: Visibility = .group,
        groupId: String? = nil,
        maxAttendees: Int? = nil,
        rsvpDeadline: Date? = nil,
        timezone: String? = nil
    ) async throws -> Event {
        guard let createdBy = await cryptoManager.getPublicKeyHex() else {
            throw EventsError.invalidEventData
        }

        let event = Event(
            v: EventsSchema.version,
            allDay: allDay,
            attachments: nil,
            createdAt: Int(Date().timeIntervalSince1970),
            createdBy: createdBy,
            customFields: nil,
            description: description,
            endAt: endAt.map { Int($0.timeIntervalSince1970) },
            id: UUID().uuidString,
            location: location,
            maxAttendees: maxAttendees,
            recurrence: nil,
            rsvpDeadline: rsvpDeadline.map { Int($0.timeIntervalSince1970) },
            startAt: Int(startAt.timeIntervalSince1970),
            timezone: timezone,
            title: title,
            updatedAt: nil,
            virtualURL: virtualURL,
            visibility: visibility
        )

        // Save to local store
        let entity = EventEntity.from(event, groupId: groupId)
        try store.saveEvent(entity)

        // Publish to Nostr
        try await publishEvent(event, groupId: groupId)

        logger.info("Created event: \(title)")
        return event
    }

    /// Update an existing event
    public func updateEvent(_ eventId: String, updates: EventUpdates) async throws -> Event {
        guard var entity = store.getEvent(id: eventId) else {
            throw EventsError.eventNotFound
        }

        // Apply updates
        if let title = updates.title { entity.title = title }
        if let description = updates.description { entity.eventDescription = description }
        if let startAt = updates.startAt { entity.startAt = startAt }
        if let endAt = updates.endAt { entity.endAt = endAt }
        if let location = updates.location {
            entity.locationName = location.name
            entity.locationAddress = location.address
            entity.locationCoordinatesLat = location.coordinates?.first
            entity.locationCoordinatesLon = location.coordinates?.last
            entity.locationInstructions = location.instructions
        }
        if let virtualURL = updates.virtualURL { entity.virtualURL = virtualURL }

        entity.updatedAt = Date()

        // Save to store
        try store.updateEvent(entity)

        // Publish update to Nostr
        let event = entity.toEvent()
        try await publishEvent(event, groupId: entity.groupId)

        logger.info("Updated event: \(eventId)")
        return event
    }

    /// Delete an event
    public func deleteEvent(_ eventId: String) async throws {
        try store.deleteEvent(id: eventId)

        // Publish deletion event to Nostr
        try await publishEventDeletion(eventId)

        logger.info("Deleted event: \(eventId)")
    }

    /// Get events for a group
    public func getEvents(groupId: String? = nil) async throws -> [Event] {
        store.getEvents(for: groupId).map { $0.toEvent() }
    }

    /// Get a specific event
    public func getEvent(id: String) async throws -> Event? {
        store.getEvent(id: id)?.toEvent()
    }

    // MARK: - RSVP Management

    /// Submit an RSVP to an event
    public func rsvp(
        eventId: String,
        status: Status,
        guestCount: Int? = nil,
        note: String? = nil
    ) async throws -> Rsvp {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw EventsError.invalidEventData
        }

        guard let eventEntity = store.getEvent(id: eventId) else {
            throw EventsError.eventNotFound
        }

        // Check RSVP deadline
        if let deadline = eventEntity.rsvpDeadline, deadline < Date() {
            throw EventsError.rsvpDeadlinePassed
        }

        // Check event capacity
        if let maxAttendees = eventEntity.maxAttendees {
            let counts = try store.getRsvpCounts(for: eventId)
            if counts.going >= maxAttendees && status == .going {
                throw EventsError.eventFull
            }
        }

        let rsvp = Rsvp(
            v: EventsSchema.version,
            eventID: eventId,
            guestCount: guestCount,
            note: note,
            pubkey: pubkey,
            respondedAt: Int(Date().timeIntervalSince1970),
            status: status
        )

        // Save to local store
        let entity = RsvpEntity.from(rsvp, event: eventEntity)
        try store.saveRsvp(entity)

        // Publish to Nostr
        try await publishRsvp(rsvp)

        logger.info("RSVP submitted for event: \(eventId)")
        return rsvp
    }

    /// Get RSVPs for an event
    public func getRsvps(eventId: String) async throws -> [Rsvp] {
        try store.getRsvps(for: eventId).map { $0.toRsvp() }
    }

    /// Get RSVP counts
    public func getRsvpCounts(eventId: String) async throws -> (going: Int, maybe: Int, notGoing: Int) {
        try store.getRsvpCounts(for: eventId)
    }

    /// Get user's RSVP for an event
    public func getUserRsvp(eventId: String) async throws -> Rsvp? {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            return nil
        }
        return try store.getUserRsvp(eventId: eventId, pubkey: pubkey)?.toRsvp()
    }

    // MARK: - Nostr Publishing

    private func publishEvent(_ event: Event, groupId: String?) async throws {
        let encoder = JSONEncoder()
        let content = try encoder.encode(event)
        let contentString = String(data: content, encoding: .utf8) ?? ""

        var tags: [[String]] = [
            ["d", event.id],  // 'd' tag for replaceable events
            ["title", event.title],
            ["start", String(event.startAt)]
        ]

        if let endAt = event.endAt {
            tags.append(["end", String(endAt)])
        }

        if let location = event.location?.name {
            tags.append(["location", location])
        }

        if let groupId = groupId {
            tags.append(["group", groupId])
        }

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: Self.eventKind) ?? .textNote,
            content: contentString,
            tags: tags
        )
    }

    private func publishRsvp(_ rsvp: Rsvp) async throws {
        let encoder = JSONEncoder()
        let content = try encoder.encode(rsvp)
        let contentString = String(data: content, encoding: .utf8) ?? ""

        let tags: [[String]] = [
            ["e", rsvp.eventID],
            ["status", rsvp.status.rawValue]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: Self.rsvpKind) ?? .textNote,
            content: contentString,
            tags: tags
        )
    }

    private func publishEventDeletion(_ eventId: String) async throws {
        let tags: [[String]] = [
            ["e", eventId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: .deletion,
            content: "Event deleted",
            tags: tags
        )
    }

    // MARK: - Event Processing

    /// Process incoming event from Nostr
    public func processNostrEvent(_ nostrEvent: NostrEvent) async {
        do {
            let decoder = JSONDecoder()

            switch nostrEvent.kind {
            case Self.eventKind:
                // Parse event
                guard let data = nostrEvent.content.data(using: .utf8),
                      let event = try? decoder.decode(Event.self, from: data) else {
                    logger.warning("Failed to decode event")
                    return
                }

                // Extract group ID from tags
                let groupId = nostrEvent.tags.first { $0.first == "group" }?[safe: 1]

                // Save to store
                let entity = EventEntity.from(event, groupId: groupId)
                try store.saveEvent(entity)

                logger.info("Processed incoming event: \(event.title)")

            case Self.rsvpKind:
                // Parse RSVP
                guard let data = nostrEvent.content.data(using: .utf8),
                      let rsvp = try? decoder.decode(Rsvp.self, from: data) else {
                    logger.warning("Failed to decode RSVP")
                    return
                }

                // Get event entity
                guard let eventEntity = store.getEvent(id: rsvp.eventID) else {
                    logger.warning("Event not found for RSVP: \(rsvp.eventID)")
                    return
                }

                // Save to store
                let entity = RsvpEntity.from(rsvp, event: eventEntity)
                try store.saveRsvp(entity)

                logger.info("Processed incoming RSVP for event: \(rsvp.eventID)")

            default:
                break
            }
        } catch {
            logger.error("Failed to process Nostr event: \(error.localizedDescription)")
        }
    }
}

/// Updates for an existing event
public struct EventUpdates {
    public var title: String?
    public var description: String?
    public var startAt: Date?
    public var endAt: Date?
    public var location: LocationClass?
    public var virtualURL: String?

    public init() {}
}
