// NotificationService.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages push notification setup, permissions, and local notification scheduling.
// Handles notification categories for different modules (messages, events, governance, etc.)

import Foundation
import UserNotifications
import UIKit
import os.log

// MARK: - Notification Categories

/// Notification categories for different BuildIt modules
enum NotificationCategory: String, CaseIterable {
    case message = "MESSAGE"
    case groupMessage = "GROUP_MESSAGE"
    case event = "EVENT"
    case eventReminder = "EVENT_REMINDER"
    case governance = "GOVERNANCE"
    case mutualAid = "MUTUAL_AID"
    case wiki = "WIKI"
    case contact = "CONTACT"
    case meshPeer = "MESH_PEER"
    case deviceSync = "DEVICE_SYNC"

    /// User-visible title for the category
    var displayTitle: String {
        switch self {
        case .message: return "Direct Message"
        case .groupMessage: return "Group Message"
        case .event: return "Event"
        case .eventReminder: return "Event Reminder"
        case .governance: return "Governance"
        case .mutualAid: return "Mutual Aid"
        case .wiki: return "Wiki Update"
        case .contact: return "Contact"
        case .meshPeer: return "Nearby Peer"
        case .deviceSync: return "Device Sync"
        }
    }

    /// Thread identifier prefix for notification grouping
    var threadIdentifierPrefix: String {
        rawValue.lowercased()
    }
}

// MARK: - Notification Actions

/// Actions available for notification categories
enum NotificationAction: String {
    // Message actions
    case reply = "REPLY_ACTION"
    case markRead = "MARK_READ_ACTION"

    // Event actions
    case viewEvent = "VIEW_EVENT_ACTION"
    case rsvpYes = "RSVP_YES_ACTION"
    case rsvpNo = "RSVP_NO_ACTION"
    case rsvpMaybe = "RSVP_MAYBE_ACTION"

    // Governance actions
    case viewProposal = "VIEW_PROPOSAL_ACTION"
    case voteYes = "VOTE_YES_ACTION"
    case voteNo = "VOTE_NO_ACTION"

    // Mutual Aid actions
    case viewRequest = "VIEW_REQUEST_ACTION"
    case offerHelp = "OFFER_HELP_ACTION"

    // General actions
    case view = "VIEW_ACTION"
    case dismiss = "DISMISS_ACTION"

    /// User-visible title for the action
    var title: String {
        switch self {
        case .reply: return "Reply"
        case .markRead: return "Mark as Read"
        case .viewEvent: return "View Event"
        case .rsvpYes: return "Going"
        case .rsvpNo: return "Not Going"
        case .rsvpMaybe: return "Maybe"
        case .viewProposal: return "View Proposal"
        case .voteYes: return "Vote Yes"
        case .voteNo: return "Vote No"
        case .viewRequest: return "View Request"
        case .offerHelp: return "Offer Help"
        case .view: return "View"
        case .dismiss: return "Dismiss"
        }
    }

    /// UNNotificationActionOptions for the action
    var options: UNNotificationActionOptions {
        switch self {
        case .reply, .viewEvent, .viewProposal, .viewRequest, .view:
            return [.foreground]
        case .markRead, .dismiss:
            return []
        case .rsvpYes, .rsvpNo, .rsvpMaybe, .voteYes, .voteNo, .offerHelp:
            return [.authenticationRequired]
        }
    }
}

// MARK: - Notification Content

/// Content for scheduling a local notification
struct LocalNotificationContent {
    let identifier: String
    let title: String
    let subtitle: String?
    let body: String
    let category: NotificationCategory
    let threadIdentifier: String?
    let userInfo: [String: Any]
    let sound: UNNotificationSound?
    let badge: Int?
    let attachments: [UNNotificationAttachment]?

    init(
        identifier: String = UUID().uuidString,
        title: String,
        subtitle: String? = nil,
        body: String,
        category: NotificationCategory,
        threadIdentifier: String? = nil,
        userInfo: [String: Any] = [:],
        sound: UNNotificationSound? = .default,
        badge: Int? = nil,
        attachments: [UNNotificationAttachment]? = nil
    ) {
        self.identifier = identifier
        self.title = title
        self.subtitle = subtitle
        self.body = body
        self.category = category
        self.threadIdentifier = threadIdentifier
        self.userInfo = userInfo
        self.sound = sound
        self.badge = badge
        self.attachments = attachments
    }
}

// MARK: - Notification Trigger

/// Trigger type for scheduling notifications
enum NotificationTrigger {
    case immediate
    case timeInterval(TimeInterval)
    case date(DateComponents)
    case location(CLCircularRegion, triggersOnce: Bool)

    func toUNTrigger() -> UNNotificationTrigger? {
        switch self {
        case .immediate:
            return nil
        case .timeInterval(let interval):
            return UNTimeIntervalNotificationTrigger(timeInterval: max(1, interval), repeats: false)
        case .date(let components):
            return UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        case .location(let region, let triggersOnce):
            return UNLocationNotificationTrigger(region: region, repeats: !triggersOnce)
        }
    }
}

import CoreLocation

// MARK: - NotificationService

/// Service for managing push and local notifications
@MainActor
final class NotificationService: ObservableObject {
    // MARK: - Singleton

    static let shared = NotificationService()

    // MARK: - Published Properties

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var isRegisteredForRemoteNotifications: Bool = false
    @Published private(set) var deviceToken: String?

    // MARK: - Private Properties

    private let notificationCenter = UNUserNotificationCenter.current()
    private let logger = Logger(subsystem: "com.buildit", category: "NotificationService")

    /// Notification settings preferences
    private var notificationPreferences: NotificationPreferences {
        get {
            if let data = UserDefaults.standard.data(forKey: "notificationPreferences"),
               let prefs = try? JSONDecoder().decode(NotificationPreferences.self, from: data) {
                return prefs
            }
            return NotificationPreferences()
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: "notificationPreferences")
            }
        }
    }

    // MARK: - Initialization

    private init() {
        Task {
            await refreshAuthorizationStatus()
        }
    }

    // MARK: - Authorization

    /// Request notification permissions
    /// - Parameter options: The notification options to request
    /// - Returns: Whether authorization was granted
    @discardableResult
    func requestAuthorization(
        options: UNAuthorizationOptions = [.alert, .sound, .badge, .provisional]
    ) async throws -> Bool {
        do {
            let granted = try await notificationCenter.requestAuthorization(options: options)
            await refreshAuthorizationStatus()

            if granted {
                logger.info("Notification authorization granted")
                await registerCategories()
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else {
                logger.info("Notification authorization denied")
            }

            return granted
        } catch {
            logger.error("Failed to request notification authorization: \(error.localizedDescription)")
            throw error
        }
    }

    /// Refresh the current authorization status
    func refreshAuthorizationStatus() async {
        let settings = await notificationCenter.notificationSettings()
        authorizationStatus = settings.authorizationStatus

        logger.info("Authorization status: \(String(describing: settings.authorizationStatus))")
    }

    /// Check if notifications are authorized
    var isAuthorized: Bool {
        authorizationStatus == .authorized || authorizationStatus == .provisional
    }

    // MARK: - Remote Notifications

    /// Handle successful remote notification registration
    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        self.deviceToken = tokenString
        isRegisteredForRemoteNotifications = true

        // Store for relay registration
        UserDefaults.standard.set(tokenString, forKey: "apnsToken")

        logger.info("Registered for remote notifications with token: \(tokenString.prefix(16))...")
    }

    /// Handle remote notification registration failure
    func didFailToRegisterForRemoteNotifications(error: Error) {
        isRegisteredForRemoteNotifications = false
        logger.error("Failed to register for remote notifications: \(error.localizedDescription)")
    }

    // MARK: - Category Registration

    /// Register all notification categories and actions
    func registerCategories() async {
        var categories = Set<UNNotificationCategory>()

        // Message category with reply and mark read actions
        let replyAction = UNTextInputNotificationAction(
            identifier: NotificationAction.reply.rawValue,
            title: NotificationAction.reply.title,
            options: NotificationAction.reply.options,
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Type a message..."
        )
        let markReadAction = UNNotificationAction(
            identifier: NotificationAction.markRead.rawValue,
            title: NotificationAction.markRead.title,
            options: NotificationAction.markRead.options
        )
        let messageCategory = UNNotificationCategory(
            identifier: NotificationCategory.message.rawValue,
            actions: [replyAction, markReadAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "New message",
            categorySummaryFormat: "%u messages",
            options: [.customDismissAction]
        )
        categories.insert(messageCategory)

        // Group message category
        let groupMessageCategory = UNNotificationCategory(
            identifier: NotificationCategory.groupMessage.rawValue,
            actions: [replyAction, markReadAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "New group message",
            categorySummaryFormat: "%u messages in group",
            options: [.customDismissAction]
        )
        categories.insert(groupMessageCategory)

        // Event category with RSVP actions
        let viewEventAction = UNNotificationAction(
            identifier: NotificationAction.viewEvent.rawValue,
            title: NotificationAction.viewEvent.title,
            options: NotificationAction.viewEvent.options
        )
        let rsvpYesAction = UNNotificationAction(
            identifier: NotificationAction.rsvpYes.rawValue,
            title: NotificationAction.rsvpYes.title,
            options: NotificationAction.rsvpYes.options
        )
        let rsvpNoAction = UNNotificationAction(
            identifier: NotificationAction.rsvpNo.rawValue,
            title: NotificationAction.rsvpNo.title,
            options: NotificationAction.rsvpNo.options
        )
        let rsvpMaybeAction = UNNotificationAction(
            identifier: NotificationAction.rsvpMaybe.rawValue,
            title: NotificationAction.rsvpMaybe.title,
            options: NotificationAction.rsvpMaybe.options
        )
        let eventCategory = UNNotificationCategory(
            identifier: NotificationCategory.event.rawValue,
            actions: [viewEventAction, rsvpYesAction, rsvpNoAction, rsvpMaybeAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "New event",
            categorySummaryFormat: "%u events",
            options: []
        )
        categories.insert(eventCategory)

        // Event reminder category
        let eventReminderCategory = UNNotificationCategory(
            identifier: NotificationCategory.eventReminder.rawValue,
            actions: [viewEventAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Event reminder",
            options: []
        )
        categories.insert(eventReminderCategory)

        // Governance category with voting actions
        let viewProposalAction = UNNotificationAction(
            identifier: NotificationAction.viewProposal.rawValue,
            title: NotificationAction.viewProposal.title,
            options: NotificationAction.viewProposal.options
        )
        let voteYesAction = UNNotificationAction(
            identifier: NotificationAction.voteYes.rawValue,
            title: NotificationAction.voteYes.title,
            options: NotificationAction.voteYes.options
        )
        let voteNoAction = UNNotificationAction(
            identifier: NotificationAction.voteNo.rawValue,
            title: NotificationAction.voteNo.title,
            options: NotificationAction.voteNo.options
        )
        let governanceCategory = UNNotificationCategory(
            identifier: NotificationCategory.governance.rawValue,
            actions: [viewProposalAction, voteYesAction, voteNoAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "New proposal",
            categorySummaryFormat: "%u proposals",
            options: []
        )
        categories.insert(governanceCategory)

        // Mutual Aid category
        let viewRequestAction = UNNotificationAction(
            identifier: NotificationAction.viewRequest.rawValue,
            title: NotificationAction.viewRequest.title,
            options: NotificationAction.viewRequest.options
        )
        let offerHelpAction = UNNotificationAction(
            identifier: NotificationAction.offerHelp.rawValue,
            title: NotificationAction.offerHelp.title,
            options: NotificationAction.offerHelp.options
        )
        let mutualAidCategory = UNNotificationCategory(
            identifier: NotificationCategory.mutualAid.rawValue,
            actions: [viewRequestAction, offerHelpAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Mutual aid request",
            categorySummaryFormat: "%u requests",
            options: []
        )
        categories.insert(mutualAidCategory)

        // Wiki category
        let viewAction = UNNotificationAction(
            identifier: NotificationAction.view.rawValue,
            title: NotificationAction.view.title,
            options: NotificationAction.view.options
        )
        let wikiCategory = UNNotificationCategory(
            identifier: NotificationCategory.wiki.rawValue,
            actions: [viewAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Wiki update",
            options: []
        )
        categories.insert(wikiCategory)

        // Contact category
        let contactCategory = UNNotificationCategory(
            identifier: NotificationCategory.contact.rawValue,
            actions: [viewAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Contact update",
            options: []
        )
        categories.insert(contactCategory)

        // Mesh peer category
        let meshPeerCategory = UNNotificationCategory(
            identifier: NotificationCategory.meshPeer.rawValue,
            actions: [viewAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Nearby peer",
            options: []
        )
        categories.insert(meshPeerCategory)

        // Device sync category
        let deviceSyncCategory = UNNotificationCategory(
            identifier: NotificationCategory.deviceSync.rawValue,
            actions: [viewAction],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Device sync",
            options: []
        )
        categories.insert(deviceSyncCategory)

        notificationCenter.setNotificationCategories(categories)
        logger.info("Registered \(categories.count) notification categories")
    }

    // MARK: - Local Notification Scheduling

    /// Schedule a local notification
    /// - Parameters:
    ///   - content: The notification content
    ///   - trigger: When to deliver the notification
    /// - Returns: The notification identifier
    @discardableResult
    func scheduleNotification(
        content: LocalNotificationContent,
        trigger: NotificationTrigger = .immediate
    ) async throws -> String {
        // Check if this category is enabled in preferences
        guard notificationPreferences.isCategoryEnabled(content.category) else {
            logger.info("Notification skipped - category \(content.category.rawValue) is disabled")
            return content.identifier
        }

        let notificationContent = UNMutableNotificationContent()
        notificationContent.title = content.title
        if let subtitle = content.subtitle {
            notificationContent.subtitle = subtitle
        }
        notificationContent.body = content.body
        notificationContent.categoryIdentifier = content.category.rawValue

        // Set thread identifier for grouping
        if let threadId = content.threadIdentifier {
            notificationContent.threadIdentifier = "\(content.category.threadIdentifierPrefix)_\(threadId)"
        } else {
            notificationContent.threadIdentifier = content.category.threadIdentifierPrefix
        }

        // Set user info with category and additional data
        var userInfo = content.userInfo
        userInfo["category"] = content.category.rawValue
        notificationContent.userInfo = userInfo

        // Set sound
        if let sound = content.sound {
            notificationContent.sound = sound
        }

        // Set badge
        if let badge = content.badge {
            notificationContent.badge = NSNumber(value: badge)
        }

        // Add attachments
        if let attachments = content.attachments {
            notificationContent.attachments = attachments
        }

        let request = UNNotificationRequest(
            identifier: content.identifier,
            content: notificationContent,
            trigger: trigger.toUNTrigger()
        )

        try await notificationCenter.add(request)
        logger.info("Scheduled notification: \(content.identifier) for category: \(content.category.rawValue)")

        return content.identifier
    }

    /// Schedule a message notification
    func scheduleMessageNotification(
        from senderName: String,
        senderId: String,
        messageId: String,
        preview: String,
        conversationId: String,
        isGroupMessage: Bool = false,
        groupName: String? = nil
    ) async throws {
        let title = isGroupMessage ? (groupName ?? "Group") : senderName
        let subtitle = isGroupMessage ? senderName : nil
        let category: NotificationCategory = isGroupMessage ? .groupMessage : .message

        let content = LocalNotificationContent(
            identifier: "message_\(messageId)",
            title: title,
            subtitle: subtitle,
            body: preview,
            category: category,
            threadIdentifier: conversationId,
            userInfo: [
                "messageId": messageId,
                "senderId": senderId,
                "conversationId": conversationId,
                "isGroupMessage": isGroupMessage
            ]
        )

        try await scheduleNotification(content: content)
    }

    /// Schedule an event notification
    func scheduleEventNotification(
        eventId: String,
        eventTitle: String,
        eventDate: Date,
        location: String?,
        isReminder: Bool = false,
        reminderOffset: TimeInterval? = nil
    ) async throws {
        let category: NotificationCategory = isReminder ? .eventReminder : .event

        var body = eventTitle
        if let location = location {
            body += " at \(location)"
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .short

        let content = LocalNotificationContent(
            identifier: "event_\(eventId)_\(isReminder ? "reminder" : "new")",
            title: isReminder ? "Event Reminder" : "New Event",
            subtitle: dateFormatter.string(from: eventDate),
            body: body,
            category: category,
            threadIdentifier: eventId,
            userInfo: [
                "eventId": eventId,
                "eventDate": eventDate.timeIntervalSince1970,
                "isReminder": isReminder
            ]
        )

        if isReminder, let offset = reminderOffset {
            let triggerDate = eventDate.addingTimeInterval(-offset)
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: triggerDate
            )
            try await scheduleNotification(content: content, trigger: .date(components))
        } else {
            try await scheduleNotification(content: content)
        }
    }

    /// Schedule a governance notification
    func scheduleGovernanceNotification(
        proposalId: String,
        proposalTitle: String,
        proposerName: String,
        groupId: String,
        deadline: Date?
    ) async throws {
        var body = "Proposed by \(proposerName)"
        if let deadline = deadline {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .full
            body += " - Vote ends \(formatter.localizedString(for: deadline, relativeTo: Date()))"
        }

        let content = LocalNotificationContent(
            identifier: "governance_\(proposalId)",
            title: "New Proposal",
            subtitle: proposalTitle,
            body: body,
            category: .governance,
            threadIdentifier: groupId,
            userInfo: [
                "proposalId": proposalId,
                "groupId": groupId
            ]
        )

        try await scheduleNotification(content: content)
    }

    /// Schedule a mutual aid notification
    func scheduleMutualAidNotification(
        requestId: String,
        requestTitle: String,
        requesterName: String,
        requestType: String,
        groupId: String
    ) async throws {
        let content = LocalNotificationContent(
            identifier: "mutualaid_\(requestId)",
            title: "Mutual Aid: \(requestType)",
            subtitle: requestTitle,
            body: "Requested by \(requesterName)",
            category: .mutualAid,
            threadIdentifier: groupId,
            userInfo: [
                "requestId": requestId,
                "groupId": groupId,
                "requestType": requestType
            ]
        )

        try await scheduleNotification(content: content)
    }

    // MARK: - Notification Management

    /// Cancel a scheduled notification
    func cancelNotification(identifier: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
        notificationCenter.removeDeliveredNotifications(withIdentifiers: [identifier])
        logger.info("Cancelled notification: \(identifier)")
    }

    /// Cancel all notifications for a thread
    func cancelNotifications(forThread threadIdentifier: String) {
        Task {
            let pending = await notificationCenter.pendingNotificationRequests()
            let toRemove = pending.filter { $0.content.threadIdentifier == threadIdentifier }
            let identifiers = toRemove.map { $0.identifier }

            notificationCenter.removePendingNotificationRequests(withIdentifiers: identifiers)
            notificationCenter.removeDeliveredNotifications(withIdentifiers: identifiers)
            logger.info("Cancelled \(identifiers.count) notifications for thread: \(threadIdentifier)")
        }
    }

    /// Cancel all notifications for a category
    func cancelNotifications(forCategory category: NotificationCategory) {
        Task {
            let pending = await notificationCenter.pendingNotificationRequests()
            let toRemove = pending.filter { $0.content.categoryIdentifier == category.rawValue }
            let identifiers = toRemove.map { $0.identifier }

            notificationCenter.removePendingNotificationRequests(withIdentifiers: identifiers)
            notificationCenter.removeDeliveredNotifications(withIdentifiers: identifiers)
            logger.info("Cancelled \(identifiers.count) notifications for category: \(category.rawValue)")
        }
    }

    /// Cancel all pending notifications
    func cancelAllPendingNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
        logger.info("Cancelled all pending notifications")
    }

    /// Remove all delivered notifications
    func removeAllDeliveredNotifications() {
        notificationCenter.removeAllDeliveredNotifications()
        logger.info("Removed all delivered notifications")
    }

    /// Get pending notification count
    func getPendingNotificationCount() async -> Int {
        let requests = await notificationCenter.pendingNotificationRequests()
        return requests.count
    }

    /// Get delivered notification count
    func getDeliveredNotificationCount() async -> Int {
        let notifications = await notificationCenter.deliveredNotifications()
        return notifications.count
    }

    // MARK: - Notification Preferences

    /// Enable or disable a notification category
    func setCategoryEnabled(_ category: NotificationCategory, enabled: Bool) {
        var prefs = notificationPreferences
        prefs.setCategoryEnabled(category, enabled: enabled)
        notificationPreferences = prefs
        logger.info("Category \(category.rawValue) enabled: \(enabled)")
    }

    /// Check if a category is enabled
    func isCategoryEnabled(_ category: NotificationCategory) -> Bool {
        notificationPreferences.isCategoryEnabled(category)
    }

    /// Get all notification preferences
    func getPreferences() -> NotificationPreferences {
        notificationPreferences
    }

    /// Update all notification preferences
    func updatePreferences(_ prefs: NotificationPreferences) {
        notificationPreferences = prefs
    }
}

// MARK: - Notification Preferences

/// User preferences for notifications
struct NotificationPreferences: Codable {
    private var enabledCategories: [String: Bool]
    var showPreviews: Bool
    var soundEnabled: Bool
    var badgeEnabled: Bool
    var groupingEnabled: Bool

    init() {
        // Enable all categories by default
        var categories: [String: Bool] = [:]
        for category in NotificationCategory.allCases {
            categories[category.rawValue] = true
        }
        self.enabledCategories = categories
        self.showPreviews = true
        self.soundEnabled = true
        self.badgeEnabled = true
        self.groupingEnabled = true
    }

    func isCategoryEnabled(_ category: NotificationCategory) -> Bool {
        enabledCategories[category.rawValue] ?? true
    }

    mutating func setCategoryEnabled(_ category: NotificationCategory, enabled: Bool) {
        enabledCategories[category.rawValue] = enabled
    }
}
