// EventsStore.swift
// BuildIt - Decentralized Mesh Communication
//
// State management for the Events module using SwiftData.

import Foundation
import SwiftData
import Combine
import os.log

/// Store for managing event data
@MainActor
public class EventsStore: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var events: [EventEntity] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "EventsStore")

    // MARK: - Initialization

    public init() throws {
        // Create SwiftData container
        let schema = Schema([EventEntity.self, RsvpEntity.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [configuration])
        self.modelContext = ModelContext(modelContainer)

        loadEvents()
    }

    // MARK: - Event Operations

    /// Load all events from storage
    public func loadEvents() {
        isLoading = true
        defer { isLoading = false }

        do {
            let descriptor = FetchDescriptor<EventEntity>(
                sortBy: [SortDescriptor(\.startAt, order: .forward)]
            )
            events = try modelContext.fetch(descriptor)
            logger.info("Loaded \(self.events.count) events")
        } catch {
            logger.error("Failed to load events: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    /// Get events for a specific group
    public func getEvents(for groupId: String?) -> [EventEntity] {
        events.filter { $0.groupId == groupId }
    }

    /// Get upcoming events
    public func getUpcomingEvents(for groupId: String? = nil) -> [EventEntity] {
        let now = Date()
        return events.filter { event in
            event.startAt >= now && (groupId == nil || event.groupId == groupId)
        }
    }

    /// Get past events
    public func getPastEvents(for groupId: String? = nil) -> [EventEntity] {
        let now = Date()
        return events.filter { event in
            event.startAt < now && (groupId == nil || event.groupId == groupId)
        }
    }

    /// Get a specific event by ID
    public func getEvent(id: String) -> EventEntity? {
        events.first { $0.id == id }
    }

    /// Save a new event
    public func saveEvent(_ event: EventEntity) throws {
        modelContext.insert(event)
        try modelContext.save()
        loadEvents()
        logger.info("Saved event: \(event.title)")
    }

    /// Update an existing event
    public func updateEvent(_ event: EventEntity) throws {
        event.updatedAt = Date()
        try modelContext.save()
        loadEvents()
        logger.info("Updated event: \(event.title)")
    }

    /// Delete an event
    public func deleteEvent(_ event: EventEntity) throws {
        modelContext.delete(event)
        try modelContext.save()
        loadEvents()
        logger.info("Deleted event: \(event.title)")
    }

    /// Delete an event by ID
    public func deleteEvent(id: String) throws {
        guard let event = getEvent(id: id) else {
            throw EventsError.eventNotFound
        }
        try deleteEvent(event)
    }

    // MARK: - RSVP Operations

    /// Save an RSVP
    public func saveRsvp(_ rsvp: RsvpEntity) throws {
        // Check if RSVP already exists
        let descriptor = FetchDescriptor<RsvpEntity>(
            predicate: #Predicate { $0.eventID == rsvp.eventID && $0.pubkey == rsvp.pubkey }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            // Update existing RSVP
            existing.status = rsvp.status
            existing.respondedAt = rsvp.respondedAt
            existing.guestCount = rsvp.guestCount
            existing.note = rsvp.note
        } else {
            // Insert new RSVP
            modelContext.insert(rsvp)
        }

        try modelContext.save()
        logger.info("Saved RSVP for event: \(rsvp.eventID)")
    }

    /// Get RSVPs for an event
    public func getRsvps(for eventId: String) throws -> [RsvpEntity] {
        let descriptor = FetchDescriptor<RsvpEntity>(
            predicate: #Predicate { $0.eventID == eventId }
        )
        return try modelContext.fetch(descriptor)
    }

    /// Get RSVP counts for an event
    public func getRsvpCounts(for eventId: String) throws -> (going: Int, maybe: Int, notGoing: Int) {
        let rsvps = try getRsvps(for: eventId)
        let going = rsvps.filter { $0.status == "going" }.count
        let maybe = rsvps.filter { $0.status == "maybe" }.count
        let notGoing = rsvps.filter { $0.status == "notGoing" }.count
        return (going, maybe, notGoing)
    }

    /// Get user's RSVP for an event
    public func getUserRsvp(eventId: String, pubkey: String) throws -> RsvpEntity? {
        let descriptor = FetchDescriptor<RsvpEntity>(
            predicate: #Predicate { $0.eventID == eventId && $0.pubkey == pubkey }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Delete an RSVP
    public func deleteRsvp(eventId: String, pubkey: String) throws {
        guard let rsvp = try getUserRsvp(eventId: eventId, pubkey: pubkey) else {
            return
        }
        modelContext.delete(rsvp)
        try modelContext.save()
        logger.info("Deleted RSVP for event: \(eventId)")
    }

    // MARK: - Search and Filter

    /// Search events by title
    public func searchEvents(query: String) -> [EventEntity] {
        events.filter { event in
            event.title.localizedCaseInsensitiveContains(query) ||
            event.eventDescription?.localizedCaseInsensitiveContains(query) == true
        }
    }

    /// Filter events by date range
    public func filterEvents(from startDate: Date, to endDate: Date, groupId: String? = nil) -> [EventEntity] {
        events.filter { event in
            event.startAt >= startDate &&
            event.startAt <= endDate &&
            (groupId == nil || event.groupId == groupId)
        }
    }

    /// Get events by visibility
    public func getEvents(visibility: String, groupId: String? = nil) -> [EventEntity] {
        events.filter { event in
            event.visibility == visibility &&
            (groupId == nil || event.groupId == groupId)
        }
    }
}

/// Errors related to events
public enum EventsError: LocalizedError {
    case eventNotFound
    case invalidEventData
    case rsvpNotFound
    case rsvpDeadlinePassed
    case eventFull

    public var errorDescription: String? {
        switch self {
        case .eventNotFound:
            return "Event not found"
        case .invalidEventData:
            return "Invalid event data"
        case .rsvpNotFound:
            return "RSVP not found"
        case .rsvpDeadlinePassed:
            return "RSVP deadline has passed"
        case .eventFull:
            return "Event is at maximum capacity"
        }
    }
}
