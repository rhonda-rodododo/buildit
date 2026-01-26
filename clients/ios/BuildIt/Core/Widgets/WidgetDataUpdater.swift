// WidgetDataUpdater.swift
// BuildIt - Decentralized Mesh Communication
//
// Updates shared widget data from the main app.
// Triggers widget timeline reloads when data changes.

import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif
import os.log

/// Widget kinds for timeline reloading
public enum WidgetKind {
    public static let unreadMessages = "com.buildit.widget.unread-messages"
    public static let upcomingEvents = "com.buildit.widget.upcoming-events"
    public static let quickActions = "com.buildit.widget.quick-actions"
}

/// Updates widget data from the main application
@MainActor
public final class WidgetDataUpdater: ObservableObject {
    public static let shared = WidgetDataUpdater()

    private let logger = Logger(subsystem: "com.buildit", category: "WidgetDataUpdater")
    private let sharedDataManager = SharedDataManager.shared

    private init() {}

    // MARK: - Message Updates

    /// Updates the unread message count and recent messages for the widget
    /// - Parameters:
    ///   - unreadCount: Total number of unread messages
    ///   - recentMessages: Array of recent message previews (max 5 will be stored)
    public func updateMessageData(
        unreadCount: Int,
        recentMessages: [MessagePreview]
    ) {
        sharedDataManager.setUnreadMessageCount(unreadCount)
        sharedDataManager.setRecentMessages(Array(recentMessages.prefix(5)))

        logger.info("Updated widget message data: \(unreadCount) unread, \(recentMessages.count) recent")

        // Reload the unread messages widget timeline
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.unreadMessages)
        #endif
    }

    /// Convenience method to update just the unread count
    /// - Parameter count: New unread message count
    public func updateUnreadCount(_ count: Int) {
        sharedDataManager.setUnreadMessageCount(count)

        logger.debug("Updated unread count to \(count)")

        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.unreadMessages)
        #endif
    }

    /// Adds a new message to the recent messages list
    /// - Parameter message: The new message preview to add
    public func addRecentMessage(_ message: MessagePreview) {
        var messages = sharedDataManager.recentMessages
        messages.insert(message, at: 0)
        messages = Array(messages.prefix(5))

        sharedDataManager.setRecentMessages(messages)

        logger.debug("Added recent message from \(message.senderName)")

        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.unreadMessages)
        #endif
    }

    // MARK: - Event Updates

    /// Updates the upcoming events for the widget
    /// - Parameter events: Array of upcoming event previews (max 10 will be stored)
    public func updateEventData(events: [EventPreview]) {
        // Sort by start date and take only future events
        let sortedEvents = events
            .filter { $0.startAt > Date() || ($0.endAt ?? $0.startAt) > Date() }
            .sorted { $0.startAt < $1.startAt }

        sharedDataManager.setUpcomingEvents(Array(sortedEvents.prefix(10)))

        logger.info("Updated widget event data: \(sortedEvents.count) upcoming events")

        // Reload the upcoming events widget timeline
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.upcomingEvents)
        #endif
    }

    /// Adds a new event to the upcoming events list
    /// - Parameter event: The new event preview to add
    public func addUpcomingEvent(_ event: EventPreview) {
        var events = sharedDataManager.upcomingEvents
        events.append(event)
        events = events
            .filter { $0.startAt > Date() || ($0.endAt ?? $0.startAt) > Date() }
            .sorted { $0.startAt < $1.startAt }
        events = Array(events.prefix(10))

        sharedDataManager.setUpcomingEvents(events)

        logger.debug("Added upcoming event: \(event.title)")

        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.upcomingEvents)
        #endif
    }

    /// Removes an event from the upcoming events list
    /// - Parameter eventId: The ID of the event to remove
    public func removeUpcomingEvent(eventId: String) {
        var events = sharedDataManager.upcomingEvents
        events.removeAll { $0.id == eventId }

        sharedDataManager.setUpcomingEvents(events)

        logger.debug("Removed event: \(eventId)")

        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.upcomingEvents)
        #endif
    }

    // MARK: - Reload All Widgets

    /// Reloads all BuildIt widget timelines
    /// Call this when the app returns to foreground or after significant data changes
    public func reloadAllWidgets() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
        logger.info("Reloaded all widget timelines")
    }

    /// Reloads all widgets except quick actions (which don't need data updates)
    public func reloadDataWidgets() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.unreadMessages)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.upcomingEvents)
        #endif
        logger.debug("Reloaded message and event widget timelines")
    }

    // MARK: - Integration with Stores

    /// Updates widget data from EventsStore
    /// - Parameter store: The events store to sync from
    public func syncFromEventsStore(_ store: EventsStore) {
        let upcomingEvents = store.getUpcomingEvents()
        let eventPreviews = upcomingEvents.map { event in
            EventPreview(
                id: event.id,
                title: event.title,
                startAt: event.startAt,
                endAt: event.endAt,
                locationName: event.locationName,
                isVirtual: event.virtualURL != nil,
                allDay: event.allDay
            )
        }
        updateEventData(events: eventPreviews)
    }

    /// Updates widget data from MessagingStore
    /// - Parameter store: The messaging store to sync from
    /// - Parameter userPublicKey: The current user's public key to calculate unread count
    public func syncFromMessagingStore(_ store: MessagingStore, userPublicKey: String) {
        // Get unread messages (messages where recipient is current user and not read)
        let unreadMessages = store.directMessages.filter {
            $0.recipientPublicKey == userPublicKey && !$0.isRead
        }

        // Create message previews from recent messages
        let recentMessages = store.directMessages
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(5)
            .map { message in
                MessagePreview(
                    id: message.id,
                    senderName: formatPublicKey(message.senderPublicKey),
                    senderPublicKey: message.senderPublicKey,
                    content: message.content,
                    timestamp: message.timestamp,
                    isGroupMessage: false,
                    groupName: nil
                )
            }

        updateMessageData(
            unreadCount: unreadMessages.count,
            recentMessages: Array(recentMessages)
        )
    }

    /// Formats a public key for display (truncated)
    private func formatPublicKey(_ publicKey: String) -> String {
        if publicKey.count > 12 {
            return String(publicKey.prefix(6)) + "..." + String(publicKey.suffix(4))
        }
        return publicKey
    }
}

// MARK: - Convenience Extensions

public extension WidgetDataUpdater {
    /// Creates a MessagePreview from a DirectMessageEntity
    /// - Parameters:
    ///   - entity: The message entity
    ///   - senderName: Display name of the sender
    /// - Returns: A MessagePreview for widget display
    static func createMessagePreview(
        from id: String,
        senderName: String,
        senderPublicKey: String,
        content: String,
        timestamp: Date,
        isGroupMessage: Bool = false,
        groupName: String? = nil
    ) -> MessagePreview {
        MessagePreview(
            id: id,
            senderName: senderName,
            senderPublicKey: senderPublicKey,
            content: content,
            timestamp: timestamp,
            isGroupMessage: isGroupMessage,
            groupName: groupName
        )
    }

    /// Creates an EventPreview from event data
    /// - Parameters:
    ///   - id: Event ID
    ///   - title: Event title
    ///   - startAt: Start date/time
    ///   - endAt: End date/time (optional)
    ///   - locationName: Location name (optional)
    ///   - isVirtual: Whether the event is virtual
    ///   - allDay: Whether it's an all-day event
    /// - Returns: An EventPreview for widget display
    static func createEventPreview(
        id: String,
        title: String,
        startAt: Date,
        endAt: Date? = nil,
        locationName: String? = nil,
        isVirtual: Bool = false,
        allDay: Bool = false
    ) -> EventPreview {
        EventPreview(
            id: id,
            title: title,
            startAt: startAt,
            endAt: endAt,
            locationName: locationName,
            isVirtual: isVirtual,
            allDay: allDay
        )
    }
}
