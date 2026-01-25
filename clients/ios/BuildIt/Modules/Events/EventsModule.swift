// EventsModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Events module for creating and managing events with RSVP tracking.

import Foundation
import SwiftUI
import os.log

/// Events module implementation
@MainActor
public final class EventsModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "events"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: EventsStore
    private let service: EventsService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "EventsModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try EventsStore()
        self.service = EventsService(store: store)
        logger.info("Events module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Events module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Events module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route event-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "events-list",
                title: "Events",
                icon: "calendar",
                order: 20
            ) {
                EventsListView(store: store, service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Events module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Events module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Events module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

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
        try await service.createEvent(
            title: title,
            description: description,
            startAt: startAt,
            endAt: endAt,
            allDay: allDay,
            location: location,
            virtualURL: virtualURL,
            visibility: visibility,
            groupId: groupId,
            maxAttendees: maxAttendees,
            rsvpDeadline: rsvpDeadline,
            timezone: timezone
        )
    }

    /// Update an existing event
    public func updateEvent(_ eventId: String, updates: EventUpdates) async throws -> Event {
        try await service.updateEvent(eventId, updates: updates)
    }

    /// Delete an event
    public func deleteEvent(_ eventId: String) async throws {
        try await service.deleteEvent(eventId)
    }

    /// Get events for a group
    public func getEvents(groupId: String? = nil) async throws -> [Event] {
        try await service.getEvents(groupId: groupId)
    }

    /// Get a specific event
    public func getEvent(id: String) async throws -> Event? {
        try await service.getEvent(id: id)
    }

    /// Submit an RSVP
    public func rsvp(
        eventId: String,
        status: Status,
        guestCount: Int? = nil,
        note: String? = nil
    ) async throws -> Rsvp {
        try await service.rsvp(
            eventId: eventId,
            status: status,
            guestCount: guestCount,
            note: note
        )
    }

    /// Get RSVPs for an event
    public func getRsvps(eventId: String) async throws -> [Rsvp] {
        try await service.getRsvps(eventId: eventId)
    }

    /// Get RSVP counts
    public func getRsvpCounts(eventId: String) async throws -> (going: Int, maybe: Int, notGoing: Int) {
        try await service.getRsvpCounts(eventId: eventId)
    }

    /// Get user's RSVP for an event
    public func getUserRsvp(eventId: String) async throws -> Rsvp? {
        try await service.getUserRsvp(eventId: eventId)
    }
}
