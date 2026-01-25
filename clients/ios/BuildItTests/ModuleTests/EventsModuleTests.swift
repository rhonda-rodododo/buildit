// EventsModuleTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Tests for the Events module.

import XCTest
@testable import BuildIt

@MainActor
final class EventsModuleTests: XCTestCase {
    var module: EventsModule!
    var mockCrypto: MockCryptoManager!

    override func setUp() async throws {
        // Create module
        module = try EventsModule()

        // Initialize
        try await module.initialize()
    }

    override func tearDown() async throws {
        await module.cleanup()
    }

    func testCreateEvent() async throws {
        // Create event
        let title = "Test Event"
        let description = "This is a test event"
        let startAt = Date().addingTimeInterval(3600)
        let endAt = startAt.addingTimeInterval(3600)

        let event = try await module.createEvent(
            title: title,
            description: description,
            startAt: startAt,
            endAt: endAt,
            allDay: false,
            visibility: .group
        )

        // Verify event
        XCTAssertEqual(event.title, title)
        XCTAssertEqual(event.description, description)
        XCTAssertEqual(event.v, EventsSchema.version)
    }

    func testGetEvents() async throws {
        // Create an event
        let event = try await module.createEvent(
            title: "Test Event",
            description: nil,
            startAt: Date().addingTimeInterval(3600),
            endAt: nil,
            allDay: false
        )

        // Get events
        let events = try await module.getEvents()

        // Verify
        XCTAssertTrue(events.contains { $0.id == event.id })
    }

    func testRSVP() async throws {
        // Create an event
        let event = try await module.createEvent(
            title: "RSVP Test Event",
            description: nil,
            startAt: Date().addingTimeInterval(3600),
            endAt: nil,
            allDay: false
        )

        // Submit RSVP
        let rsvp = try await module.rsvp(
            eventId: event.id,
            status: .going,
            guestCount: 2,
            note: "Looking forward to it!"
        )

        // Verify RSVP
        XCTAssertEqual(rsvp.eventID, event.id)
        XCTAssertEqual(rsvp.status, .going)
        XCTAssertEqual(rsvp.guestCount, 2)
    }

    func testRSVPCounts() async throws {
        // Create an event
        let event = try await module.createEvent(
            title: "Count Test Event",
            description: nil,
            startAt: Date().addingTimeInterval(3600),
            endAt: nil,
            allDay: false
        )

        // Submit RSVP
        try await module.rsvp(eventId: event.id, status: .going)

        // Get counts
        let counts = try await module.getRsvpCounts(eventId: event.id)

        // Verify counts
        XCTAssertEqual(counts.going, 1)
        XCTAssertEqual(counts.maybe, 0)
        XCTAssertEqual(counts.notGoing, 0)
    }

    func testEventUpdate() async throws {
        // Create event
        let event = try await module.createEvent(
            title: "Original Title",
            description: nil,
            startAt: Date().addingTimeInterval(3600),
            endAt: nil,
            allDay: false
        )

        // Update event
        var updates = EventUpdates()
        updates.title = "Updated Title"
        updates.description = "Updated Description"

        let updatedEvent = try await module.updateEvent(event.id, updates: updates)

        // Verify update
        XCTAssertEqual(updatedEvent.title, "Updated Title")
        XCTAssertEqual(updatedEvent.description, "Updated Description")
    }

    func testDeleteEvent() async throws {
        // Create event
        let event = try await module.createEvent(
            title: "To Be Deleted",
            description: nil,
            startAt: Date().addingTimeInterval(3600),
            endAt: nil,
            allDay: false
        )

        // Delete event
        try await module.deleteEvent(event.id)

        // Verify deletion
        let retrievedEvent = try await module.getEvent(id: event.id)
        XCTAssertNil(retrievedEvent)
    }
}
