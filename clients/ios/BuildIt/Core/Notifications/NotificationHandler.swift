// NotificationHandler.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles notification delegate callbacks, navigation, and action processing.
// Manages badge counts and notification tap handling.

import Foundation
import UserNotifications
import UIKit
import os.log

// MARK: - Notification Navigation

/// Deep link destinations for notification navigation
enum NotificationDestination: Equatable {
    case conversation(id: String)
    case groupConversation(groupId: String, conversationId: String?)
    case event(id: String)
    case eventList
    case proposal(id: String, groupId: String)
    case governanceList(groupId: String)
    case mutualAidRequest(id: String, groupId: String)
    case mutualAidList(groupId: String)
    case wikiPage(id: String, groupId: String)
    case contact(id: String)
    case deviceSync
    case meshPeers
    case settings

    /// Convert to URL for deep linking
    func toURL() -> URL? {
        var components = URLComponents()
        components.scheme = "buildit"

        switch self {
        case .conversation(let id):
            components.host = "chat"
            components.path = "/\(id)"
        case .groupConversation(let groupId, let conversationId):
            components.host = "group"
            components.path = "/\(groupId)/chat"
            if let convId = conversationId {
                components.queryItems = [URLQueryItem(name: "conversation", value: convId)]
            }
        case .event(let id):
            components.host = "events"
            components.path = "/\(id)"
        case .eventList:
            components.host = "events"
        case .proposal(let id, let groupId):
            components.host = "governance"
            components.path = "/\(groupId)/proposal/\(id)"
        case .governanceList(let groupId):
            components.host = "governance"
            components.path = "/\(groupId)"
        case .mutualAidRequest(let id, let groupId):
            components.host = "mutualaid"
            components.path = "/\(groupId)/request/\(id)"
        case .mutualAidList(let groupId):
            components.host = "mutualaid"
            components.path = "/\(groupId)"
        case .wikiPage(let id, let groupId):
            components.host = "wiki"
            components.path = "/\(groupId)/page/\(id)"
        case .contact(let id):
            components.host = "contacts"
            components.path = "/\(id)"
        case .deviceSync:
            components.host = "devices"
        case .meshPeers:
            components.host = "mesh"
        case .settings:
            components.host = "settings"
        }

        return components.url
    }
}

// MARK: - Notification Response Protocol

/// Protocol for objects that want to receive notification navigation events
@MainActor
protocol NotificationNavigationDelegate: AnyObject {
    func navigate(to destination: NotificationDestination)
}

// MARK: - NotificationHandler

/// Handles UNUserNotificationCenterDelegate callbacks and notification processing
@MainActor
final class NotificationHandler: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = NotificationHandler()

    // MARK: - Published Properties

    @Published private(set) var badgeCount: Int = 0
    @Published private(set) var pendingDestination: NotificationDestination?

    // MARK: - Properties

    weak var navigationDelegate: NotificationNavigationDelegate?

    private let notificationService = NotificationService.shared
    private let logger = Logger(subsystem: "com.buildit", category: "NotificationHandler")

    // Badge count components
    private var unreadMessages: Int = 0
    private var unreadEvents: Int = 0
    private var unreadProposals: Int = 0
    private var unreadMutualAid: Int = 0
    private var unreadOther: Int = 0

    // MARK: - Initialization

    private override init() {
        super.init()
        loadBadgeCounts()
    }

    // MARK: - Setup

    /// Configure as the notification center delegate
    func configure() {
        UNUserNotificationCenter.current().delegate = self
        logger.info("NotificationHandler configured as delegate")
    }

    // MARK: - Badge Management

    /// Update the app badge count
    func updateBadgeCount() {
        badgeCount = unreadMessages + unreadEvents + unreadProposals + unreadMutualAid + unreadOther

        Task { @MainActor in
            UIApplication.shared.applicationIconBadgeNumber = badgeCount
        }

        saveBadgeCounts()
        logger.info("Badge count updated: \(self.badgeCount)")
    }

    /// Increment badge count for a category
    func incrementBadge(for category: NotificationCategory, by amount: Int = 1) {
        switch category {
        case .message, .groupMessage:
            unreadMessages += amount
        case .event, .eventReminder:
            unreadEvents += amount
        case .governance:
            unreadProposals += amount
        case .mutualAid:
            unreadMutualAid += amount
        default:
            unreadOther += amount
        }
        updateBadgeCount()
    }

    /// Decrement badge count for a category
    func decrementBadge(for category: NotificationCategory, by amount: Int = 1) {
        switch category {
        case .message, .groupMessage:
            unreadMessages = max(0, unreadMessages - amount)
        case .event, .eventReminder:
            unreadEvents = max(0, unreadEvents - amount)
        case .governance:
            unreadProposals = max(0, unreadProposals - amount)
        case .mutualAid:
            unreadMutualAid = max(0, unreadMutualAid - amount)
        default:
            unreadOther = max(0, unreadOther - amount)
        }
        updateBadgeCount()
    }

    /// Clear badge count for a category
    func clearBadge(for category: NotificationCategory) {
        switch category {
        case .message, .groupMessage:
            unreadMessages = 0
        case .event, .eventReminder:
            unreadEvents = 0
        case .governance:
            unreadProposals = 0
        case .mutualAid:
            unreadMutualAid = 0
        default:
            unreadOther = 0
        }
        updateBadgeCount()
    }

    /// Clear all badge counts
    func clearAllBadges() {
        unreadMessages = 0
        unreadEvents = 0
        unreadProposals = 0
        unreadMutualAid = 0
        unreadOther = 0
        updateBadgeCount()
    }

    /// Set the badge count for unread messages
    func setUnreadMessageCount(_ count: Int) {
        unreadMessages = count
        updateBadgeCount()
    }

    // MARK: - Persistence

    private func saveBadgeCounts() {
        let counts: [String: Int] = [
            "messages": unreadMessages,
            "events": unreadEvents,
            "proposals": unreadProposals,
            "mutualAid": unreadMutualAid,
            "other": unreadOther
        ]
        UserDefaults.standard.set(counts, forKey: "badgeCounts")
    }

    private func loadBadgeCounts() {
        if let counts = UserDefaults.standard.dictionary(forKey: "badgeCounts") as? [String: Int] {
            unreadMessages = counts["messages"] ?? 0
            unreadEvents = counts["events"] ?? 0
            unreadProposals = counts["proposals"] ?? 0
            unreadMutualAid = counts["mutualAid"] ?? 0
            unreadOther = counts["other"] ?? 0
            updateBadgeCount()
        }
    }

    // MARK: - Navigation

    /// Navigate to the pending destination if one exists
    func handlePendingNavigation() {
        guard let destination = pendingDestination else { return }

        pendingDestination = nil

        if let delegate = navigationDelegate {
            delegate.navigate(to: destination)
        } else {
            logger.warning("No navigation delegate set, storing destination")
            pendingDestination = destination
        }
    }

    /// Process notification user info and determine destination
    private func destinationFromUserInfo(_ userInfo: [AnyHashable: Any]) -> NotificationDestination? {
        guard let categoryString = userInfo["category"] as? String,
              let category = NotificationCategory(rawValue: categoryString) else {
            return nil
        }

        switch category {
        case .message:
            if let conversationId = userInfo["conversationId"] as? String {
                return .conversation(id: conversationId)
            }
        case .groupMessage:
            if let groupId = userInfo["groupId"] as? String {
                let conversationId = userInfo["conversationId"] as? String
                return .groupConversation(groupId: groupId, conversationId: conversationId)
            }
        case .event, .eventReminder:
            if let eventId = userInfo["eventId"] as? String {
                return .event(id: eventId)
            }
            return .eventList
        case .governance:
            if let proposalId = userInfo["proposalId"] as? String,
               let groupId = userInfo["groupId"] as? String {
                return .proposal(id: proposalId, groupId: groupId)
            }
        case .mutualAid:
            if let requestId = userInfo["requestId"] as? String,
               let groupId = userInfo["groupId"] as? String {
                return .mutualAidRequest(id: requestId, groupId: groupId)
            }
        case .wiki:
            if let pageId = userInfo["pageId"] as? String,
               let groupId = userInfo["groupId"] as? String {
                return .wikiPage(id: pageId, groupId: groupId)
            }
        case .contact:
            if let contactId = userInfo["contactId"] as? String {
                return .contact(id: contactId)
            }
        case .meshPeer:
            return .meshPeers
        case .deviceSync:
            return .deviceSync
        }

        return nil
    }

    // MARK: - Action Handling

    /// Handle notification action response
    private func handleAction(
        _ actionIdentifier: String,
        for category: NotificationCategory,
        userInfo: [AnyHashable: Any],
        responseText: String?
    ) async {
        guard let action = NotificationAction(rawValue: actionIdentifier) else {
            logger.warning("Unknown action: \(actionIdentifier)")
            return
        }

        logger.info("Handling action: \(action.rawValue) for category: \(category.rawValue)")

        switch action {
        case .reply:
            await handleReplyAction(text: responseText ?? "", userInfo: userInfo, category: category)
        case .markRead:
            await handleMarkReadAction(userInfo: userInfo, category: category)
        case .rsvpYes:
            await handleRSVPAction(response: "yes", userInfo: userInfo)
        case .rsvpNo:
            await handleRSVPAction(response: "no", userInfo: userInfo)
        case .rsvpMaybe:
            await handleRSVPAction(response: "maybe", userInfo: userInfo)
        case .voteYes:
            await handleVoteAction(vote: true, userInfo: userInfo)
        case .voteNo:
            await handleVoteAction(vote: false, userInfo: userInfo)
        case .offerHelp:
            await handleOfferHelpAction(userInfo: userInfo)
        case .view, .viewEvent, .viewProposal, .viewRequest:
            // Navigation is handled separately
            break
        case .dismiss:
            // Just dismiss, decrement badge
            decrementBadge(for: category)
        }
    }

    private func handleReplyAction(text: String, userInfo: [AnyHashable: Any], category: NotificationCategory) async {
        guard !text.isEmpty else { return }

        if let conversationId = userInfo["conversationId"] as? String {
            let isGroup = userInfo["isGroupMessage"] as? Bool ?? false

            // Send reply via MessagingModule
            do {
                if isGroup, let groupId = userInfo["groupId"] as? String {
                    if let messagingModule = await ModuleRegistry.shared.getModule(MessagingModule.self) {
                        try await messagingModule.sendGroupMessage(content: text, to: groupId)
                    }
                } else {
                    if let recipientId = userInfo["senderId"] as? String {
                        if let messagingModule = await ModuleRegistry.shared.getModule(MessagingModule.self) {
                            try await messagingModule.sendDirectMessage(content: text, to: recipientId)
                        }
                    }
                }
                logger.info("Reply sent successfully")
            } catch {
                logger.error("Failed to send reply: \(error.localizedDescription)")
            }
        }
    }

    private func handleMarkReadAction(userInfo: [AnyHashable: Any], category: NotificationCategory) async {
        if let conversationId = userInfo["conversationId"] as? String,
           let messageId = userInfo["messageId"] as? String {
            // Mark messages as read
            await MessageQueue.shared.markAsRead(messageId)
            decrementBadge(for: category)
            logger.info("Marked message as read: \(messageId)")
        }
    }

    private func handleRSVPAction(response: String, userInfo: [AnyHashable: Any]) async {
        guard let eventId = userInfo["eventId"] as? String else { return }

        guard let eventsModule = ModuleRegistry.shared.getModule(EventsModule.self) else {
            logger.error("EventsModule not available for RSVP action")
            decrementBadge(for: .event)
            return
        }

        let rsvpStatus: Status
        switch response {
        case "yes":
            rsvpStatus = .going
        case "no":
            rsvpStatus = .notGoing
        default:
            rsvpStatus = .maybe
        }

        do {
            _ = try await eventsModule.rsvp(eventId: eventId, status: rsvpStatus)
            logger.info("RSVP \(response) submitted for event: \(eventId)")
        } catch EventsError.eventFull {
            logger.warning("Event \(eventId) is at full capacity")
        } catch EventsError.rsvpDeadlinePassed {
            logger.warning("RSVP deadline passed for event: \(eventId)")
        } catch {
            logger.error("Failed to submit RSVP for event \(eventId): \(error.localizedDescription)")
        }

        decrementBadge(for: .event)
    }

    private func handleVoteAction(vote: Bool, userInfo: [AnyHashable: Any]) async {
        guard let proposalId = userInfo["proposalId"] as? String else { return }

        guard let governanceModule = ModuleRegistry.shared.getModule(GovernanceModule.self) else {
            logger.error("GovernanceModule not available for vote action")
            decrementBadge(for: .governance)
            return
        }

        // Resolve voter ID from the current user's pubkey
        let voterId = UserDefaults.standard.string(forKey: "currentPubkey") ?? ""
        guard !voterId.isEmpty else {
            logger.error("No current pubkey available for voting")
            decrementBadge(for: .governance)
            return
        }

        do {
            // Fetch the proposal to determine valid option IDs for yes/no
            if let proposal = try await governanceModule.getProposal(id: proposalId) {
                // Find the matching option ID for the vote direction
                let choiceId: String
                if vote {
                    choiceId = proposal.options.first { $0.label.lowercased() == "yes" || $0.label.lowercased() == "approve" }?.id ?? proposal.options.first?.id ?? "yes"
                } else {
                    choiceId = proposal.options.first { $0.label.lowercased() == "no" || $0.label.lowercased() == "reject" }?.id ?? proposal.options.last?.id ?? "no"
                }

                _ = try await governanceModule.castVote(
                    proposalId: proposalId,
                    choice: [choiceId],
                    voterId: voterId
                )
                logger.info("Vote \(vote ? "yes" : "no") submitted for proposal: \(proposalId)")
            } else {
                logger.error("Proposal \(proposalId) not found for voting")
            }
        } catch {
            logger.error("Failed to cast vote for proposal \(proposalId): \(error.localizedDescription)")
        }

        decrementBadge(for: .governance)
    }

    private func handleOfferHelpAction(userInfo: [AnyHashable: Any]) async {
        guard let requestId = userInfo["requestId"] as? String else { return }

        guard let mutualAidModule = ModuleRegistry.shared.getModule(MutualAidModule.self) else {
            logger.error("MutualAidModule not available for help offer action")
            decrementBadge(for: .mutualAid)
            return
        }

        do {
            _ = try await mutualAidModule.offerFulfillment(requestId: requestId)
            logger.info("Help offer submitted for request: \(requestId)")
        } catch {
            logger.error("Failed to offer help for request \(requestId): \(error.localizedDescription)")
        }

        decrementBadge(for: .mutualAid)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationHandler: UNUserNotificationCenterDelegate {
    /// Called when a notification is delivered while the app is in foreground
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        let categoryIdentifier = notification.request.content.categoryIdentifier

        Task { @MainActor in
            // Check if we should show the notification in foreground
            let prefs = notificationService.getPreferences()

            var options: UNNotificationPresentationOptions = []

            if prefs.soundEnabled {
                options.insert(.sound)
            }
            if prefs.badgeEnabled {
                options.insert(.badge)
            }
            // Always show banner and list
            options.insert(.banner)
            options.insert(.list)

            // Increment badge for this category
            if let category = NotificationCategory(rawValue: categoryIdentifier) {
                incrementBadge(for: category)
            }

            logger.info("Presenting foreground notification: \(notification.request.identifier)")
            completionHandler(options)
        }
    }

    /// Called when user interacts with a notification (tap or action)
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let actionIdentifier = response.actionIdentifier
        let categoryIdentifier = response.notification.request.content.categoryIdentifier

        Task { @MainActor in
            logger.info("Received notification response: \(actionIdentifier)")

            let category = NotificationCategory(rawValue: categoryIdentifier) ?? .message

            // Handle action
            switch actionIdentifier {
            case UNNotificationDefaultActionIdentifier:
                // User tapped the notification
                if let destination = destinationFromUserInfo(userInfo) {
                    if let delegate = navigationDelegate {
                        delegate.navigate(to: destination)
                    } else {
                        pendingDestination = destination
                    }
                }
                decrementBadge(for: category)

            case UNNotificationDismissActionIdentifier:
                // User dismissed the notification
                decrementBadge(for: category)

            default:
                // Custom action
                let responseText: String?
                if let textResponse = response as? UNTextInputNotificationResponse {
                    responseText = textResponse.userText
                } else {
                    responseText = nil
                }

                await handleAction(
                    actionIdentifier,
                    for: category,
                    userInfo: userInfo,
                    responseText: responseText
                )

                // Navigate if it's a view action
                if actionIdentifier.contains("VIEW") || actionIdentifier == NotificationAction.viewEvent.rawValue ||
                   actionIdentifier == NotificationAction.viewProposal.rawValue ||
                   actionIdentifier == NotificationAction.viewRequest.rawValue {
                    if let destination = destinationFromUserInfo(userInfo) {
                        if let delegate = navigationDelegate {
                            delegate.navigate(to: destination)
                        } else {
                            pendingDestination = destination
                        }
                    }
                }
            }

            completionHandler()
        }
    }
}

// MARK: - Notification Name Extensions

extension Notification.Name {
    static let navigateToDestination = Notification.Name("navigateToDestination")
    static let notificationReceived = Notification.Name("notificationReceived")
    static let badgeCountUpdated = Notification.Name("badgeCountUpdated")
}
