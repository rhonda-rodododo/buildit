// SharedDataManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages shared data between the main app and widget extension
// using App Group shared UserDefaults.
//
// NOTE: This file is duplicated in BuildItWidgets/ for the widget extension.
// Both files must be kept in sync.

import Foundation

/// App Group identifier for sharing data between main app and widgets
public let kBuildItAppGroupIdentifier = "group.com.buildit.shared"

/// Keys for shared UserDefaults data
public enum SharedDataKeys {
    static let unreadMessageCount = "widget.unreadMessageCount"
    static let recentMessages = "widget.recentMessages"
    static let upcomingEvents = "widget.upcomingEvents"
    static let lastUpdateTimestamp = "widget.lastUpdateTimestamp"
}

/// Lightweight message preview for widget display
public struct MessagePreview: Codable, Identifiable, Sendable {
    public let id: String
    public let senderName: String
    public let senderPublicKey: String
    public let content: String
    public let timestamp: Date
    public let isGroupMessage: Bool
    public let groupName: String?

    public init(
        id: String,
        senderName: String,
        senderPublicKey: String,
        content: String,
        timestamp: Date,
        isGroupMessage: Bool = false,
        groupName: String? = nil
    ) {
        self.id = id
        self.senderName = senderName
        self.senderPublicKey = senderPublicKey
        self.content = content
        self.timestamp = timestamp
        self.isGroupMessage = isGroupMessage
        self.groupName = groupName
    }

    /// Truncated content suitable for widget display
    public var truncatedContent: String {
        if content.count > 80 {
            return String(content.prefix(77)) + "..."
        }
        return content
    }

    /// Deep link URL to open this message in the app
    public var deepLinkURL: URL {
        if isGroupMessage, let groupName = groupName {
            return URL(string: "buildit://messages/group/\(id)?group=\(groupName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!
        }
        return URL(string: "buildit://messages/direct/\(senderPublicKey)")!
    }
}

/// Lightweight event preview for widget display
public struct EventPreview: Codable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let startAt: Date
    public let endAt: Date?
    public let locationName: String?
    public let isVirtual: Bool
    public let allDay: Bool

    public init(
        id: String,
        title: String,
        startAt: Date,
        endAt: Date?,
        locationName: String?,
        isVirtual: Bool = false,
        allDay: Bool = false
    ) {
        self.id = id
        self.title = title
        self.startAt = startAt
        self.endAt = endAt
        self.locationName = locationName
        self.isVirtual = isVirtual
        self.allDay = allDay
    }

    /// Deep link URL to open this event in the app
    public var deepLinkURL: URL {
        URL(string: "buildit://events/\(id)")!
    }

    /// Formatted date string for display
    public var formattedDate: String {
        if allDay {
            return formatAllDayDate(startAt)
        }
        return formatDateTime(startAt)
    }

    /// Formatted time range for display
    public var formattedTimeRange: String? {
        guard !allDay else { return nil }

        let formatter = DateFormatter()
        formatter.timeStyle = .short

        if let endAt = endAt {
            return "\(formatter.string(from: startAt)) - \(formatter.string(from: endAt))"
        }
        return formatter.string(from: startAt)
    }

    private func formatAllDayDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    private func formatDateTime(_ date: Date) -> String {
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            return "Today, \(formatter.string(from: date))"
        } else if calendar.isDateInTomorrow(date) {
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            return "Tomorrow, \(formatter.string(from: date))"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEE, MMM d, h:mm a"
            return formatter.string(from: date)
        }
    }
}

/// Manages reading and writing shared data for widgets
public final class SharedDataManager: Sendable {
    public static let shared = SharedDataManager()

    private let userDefaults: UserDefaults?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        self.userDefaults = UserDefaults(suiteName: kBuildItAppGroupIdentifier)
    }

    // MARK: - Unread Message Count

    public var unreadMessageCount: Int {
        get {
            userDefaults?.integer(forKey: SharedDataKeys.unreadMessageCount) ?? 0
        }
    }

    public func setUnreadMessageCount(_ count: Int) {
        userDefaults?.set(count, forKey: SharedDataKeys.unreadMessageCount)
        updateLastUpdateTimestamp()
    }

    // MARK: - Recent Messages

    public var recentMessages: [MessagePreview] {
        get {
            guard let data = userDefaults?.data(forKey: SharedDataKeys.recentMessages) else {
                return []
            }
            return (try? decoder.decode([MessagePreview].self, from: data)) ?? []
        }
    }

    public func setRecentMessages(_ messages: [MessagePreview]) {
        guard let data = try? encoder.encode(messages) else { return }
        userDefaults?.set(data, forKey: SharedDataKeys.recentMessages)
        updateLastUpdateTimestamp()
    }

    // MARK: - Upcoming Events

    public var upcomingEvents: [EventPreview] {
        get {
            guard let data = userDefaults?.data(forKey: SharedDataKeys.upcomingEvents) else {
                return []
            }
            return (try? decoder.decode([EventPreview].self, from: data)) ?? []
        }
    }

    public func setUpcomingEvents(_ events: [EventPreview]) {
        guard let data = try? encoder.encode(events) else { return }
        userDefaults?.set(data, forKey: SharedDataKeys.upcomingEvents)
        updateLastUpdateTimestamp()
    }

    // MARK: - Last Update Timestamp

    public var lastUpdateTimestamp: Date? {
        get {
            userDefaults?.object(forKey: SharedDataKeys.lastUpdateTimestamp) as? Date
        }
    }

    private func updateLastUpdateTimestamp() {
        userDefaults?.set(Date(), forKey: SharedDataKeys.lastUpdateTimestamp)
    }
}
