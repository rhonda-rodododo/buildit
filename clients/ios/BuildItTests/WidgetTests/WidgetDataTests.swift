// WidgetDataTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Tests for widget shared data types and serialization.

import XCTest
@testable import BuildIt

final class WidgetDataTests: XCTestCase {

    // MARK: - MessagePreview Tests

    func testMessagePreviewCoding() throws {
        let message = MessagePreview(
            id: "msg-123",
            senderName: "Alice",
            senderPublicKey: "npub1abc123def456",
            content: "Hello, this is a test message",
            timestamp: Date(timeIntervalSince1970: 1700000000),
            isGroupMessage: false,
            groupName: nil
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(message)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(MessagePreview.self, from: data)

        XCTAssertEqual(decoded.id, message.id)
        XCTAssertEqual(decoded.senderName, message.senderName)
        XCTAssertEqual(decoded.senderPublicKey, message.senderPublicKey)
        XCTAssertEqual(decoded.content, message.content)
        XCTAssertEqual(decoded.timestamp.timeIntervalSince1970, message.timestamp.timeIntervalSince1970, accuracy: 1)
        XCTAssertEqual(decoded.isGroupMessage, message.isGroupMessage)
        XCTAssertNil(decoded.groupName)
    }

    func testMessagePreviewGroupMessageCoding() throws {
        let message = MessagePreview(
            id: "msg-456",
            senderName: "Bob",
            senderPublicKey: "npub1xyz789",
            content: "Group message content",
            timestamp: Date(),
            isGroupMessage: true,
            groupName: "Test Group"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(message)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(MessagePreview.self, from: data)

        XCTAssertEqual(decoded.isGroupMessage, true)
        XCTAssertEqual(decoded.groupName, "Test Group")
    }

    func testMessagePreviewTruncation() {
        let shortMessage = MessagePreview(
            id: "1",
            senderName: "Test",
            senderPublicKey: "pk",
            content: "Short",
            timestamp: Date()
        )

        XCTAssertEqual(shortMessage.truncatedContent, "Short")

        let longContent = String(repeating: "a", count: 100)
        let longMessage = MessagePreview(
            id: "2",
            senderName: "Test",
            senderPublicKey: "pk",
            content: longContent,
            timestamp: Date()
        )

        XCTAssertEqual(longMessage.truncatedContent.count, 80)
        XCTAssertTrue(longMessage.truncatedContent.hasSuffix("..."))
    }

    func testMessagePreviewDeepLink() {
        let directMessage = MessagePreview(
            id: "msg-1",
            senderName: "Alice",
            senderPublicKey: "abc123",
            content: "Hi",
            timestamp: Date(),
            isGroupMessage: false
        )

        XCTAssertEqual(directMessage.deepLinkURL.absoluteString, "buildit://messages/direct/abc123")

        let groupMessage = MessagePreview(
            id: "msg-2",
            senderName: "Bob",
            senderPublicKey: "def456",
            content: "Hi all",
            timestamp: Date(),
            isGroupMessage: true,
            groupName: "My Group"
        )

        XCTAssertTrue(groupMessage.deepLinkURL.absoluteString.contains("buildit://messages/group/msg-2"))
    }

    // MARK: - EventPreview Tests

    func testEventPreviewCoding() throws {
        let event = EventPreview(
            id: "event-123",
            title: "Community Meeting",
            startAt: Date(timeIntervalSince1970: 1700000000),
            endAt: Date(timeIntervalSince1970: 1700003600),
            locationName: "Main Hall",
            isVirtual: false,
            allDay: false
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(event)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(EventPreview.self, from: data)

        XCTAssertEqual(decoded.id, event.id)
        XCTAssertEqual(decoded.title, event.title)
        XCTAssertEqual(decoded.startAt.timeIntervalSince1970, event.startAt.timeIntervalSince1970, accuracy: 1)
        XCTAssertEqual(decoded.locationName, event.locationName)
        XCTAssertEqual(decoded.isVirtual, false)
        XCTAssertEqual(decoded.allDay, false)
    }

    func testEventPreviewVirtualEvent() throws {
        let event = EventPreview(
            id: "event-456",
            title: "Virtual Meeting",
            startAt: Date(),
            endAt: nil,
            locationName: "Zoom",
            isVirtual: true,
            allDay: false
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(event)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(EventPreview.self, from: data)

        XCTAssertEqual(decoded.isVirtual, true)
        XCTAssertNil(decoded.endAt)
    }

    func testEventPreviewAllDayEvent() throws {
        let event = EventPreview(
            id: "event-789",
            title: "All Day Event",
            startAt: Date(),
            endAt: nil,
            locationName: nil,
            isVirtual: false,
            allDay: true
        )

        XCTAssertEqual(event.allDay, true)
        XCTAssertNil(event.formattedTimeRange)
    }

    func testEventPreviewDeepLink() {
        let event = EventPreview(
            id: "event-abc",
            title: "Test Event",
            startAt: Date(),
            endAt: nil,
            locationName: nil
        )

        XCTAssertEqual(event.deepLinkURL.absoluteString, "buildit://events/event-abc")
    }

    func testEventPreviewFormattedDate() {
        // Create a date for today
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let todayEvent = EventPreview(
            id: "1",
            title: "Today Event",
            startAt: today.addingTimeInterval(3600 * 14), // 2 PM today
            endAt: nil,
            locationName: nil
        )

        XCTAssertTrue(todayEvent.formattedDate.contains("Today"))

        // Create a date for tomorrow
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!.addingTimeInterval(3600 * 10)
        let tomorrowEvent = EventPreview(
            id: "2",
            title: "Tomorrow Event",
            startAt: tomorrow,
            endAt: nil,
            locationName: nil
        )

        XCTAssertTrue(tomorrowEvent.formattedDate.contains("Tomorrow"))
    }

    // MARK: - Widget Quick Action Tests

    func testWidgetQuickActionRawValues() {
        XCTAssertEqual(WidgetQuickAction.newMessage.rawValue, "new-message")
        XCTAssertEqual(WidgetQuickAction.scanQR.rawValue, "scan-qr")
        XCTAssertEqual(WidgetQuickAction.checkIn.rawValue, "check-in")
        XCTAssertEqual(WidgetQuickAction.newEvent.rawValue, "new-event")
        XCTAssertEqual(WidgetQuickAction.viewGroups.rawValue, "view-groups")
        XCTAssertEqual(WidgetQuickAction.settings.rawValue, "settings")
    }

    func testWidgetQuickActionFromRawValue() {
        XCTAssertEqual(WidgetQuickAction(rawValue: "new-message"), .newMessage)
        XCTAssertEqual(WidgetQuickAction(rawValue: "scan-qr"), .scanQR)
        XCTAssertNil(WidgetQuickAction(rawValue: "invalid-action"))
    }

    // MARK: - DeepLinkDestination Widget Cases Tests

    func testWidgetDeepLinkDestinations() {
        let messages = DeepLinkDestination.messages
        XCTAssertEqual(messages.preferredTab, .chat)

        let directMessage = DeepLinkDestination.directMessage(publicKey: "abc123")
        XCTAssertEqual(directMessage.preferredTab, .chat)

        let events = DeepLinkDestination.events
        XCTAssertEqual(events.preferredTab, .events)

        let eventDetail = DeepLinkDestination.eventDetail(eventId: "event-1")
        XCTAssertEqual(eventDetail.preferredTab, .events)

        let groups = DeepLinkDestination.groups
        XCTAssertEqual(groups.preferredTab, .groups)
    }

    func testWidgetActionDestinations() {
        let newMessage = DeepLinkDestination.widgetAction(.newMessage)
        XCTAssertEqual(newMessage.preferredTab, .chat)

        let scanQR = DeepLinkDestination.widgetAction(.scanQR)
        XCTAssertEqual(scanQR.preferredTab, .chat)

        let newEvent = DeepLinkDestination.widgetAction(.newEvent)
        XCTAssertEqual(newEvent.preferredTab, .events)

        let viewGroups = DeepLinkDestination.widgetAction(.viewGroups)
        XCTAssertEqual(viewGroups.preferredTab, .groups)

        let settings = DeepLinkDestination.widgetAction(.settings)
        XCTAssertEqual(settings.preferredTab, .settings)
    }

    func testWidgetDestinationCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        // Test messages destination
        let messages = DeepLinkDestination.messages
        let messagesData = try encoder.encode(messages)
        let decodedMessages = try decoder.decode(DeepLinkDestination.self, from: messagesData)
        XCTAssertEqual(decodedMessages, messages)

        // Test directMessage destination
        let directMessage = DeepLinkDestination.directMessage(publicKey: "test123")
        let dmData = try encoder.encode(directMessage)
        let decodedDM = try decoder.decode(DeepLinkDestination.self, from: dmData)
        XCTAssertEqual(decodedDM, directMessage)

        // Test events destination
        let events = DeepLinkDestination.events
        let eventsData = try encoder.encode(events)
        let decodedEvents = try decoder.decode(DeepLinkDestination.self, from: eventsData)
        XCTAssertEqual(decodedEvents, events)

        // Test widgetAction destination
        let widgetAction = DeepLinkDestination.widgetAction(.scanQR)
        let actionData = try encoder.encode(widgetAction)
        let decodedAction = try decoder.decode(DeepLinkDestination.self, from: actionData)
        XCTAssertEqual(decodedAction, widgetAction)
    }
}
