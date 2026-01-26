// DeepLinkRouter.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles navigation to deep link destinations from any screen.
// Manages pending deep links for deferred navigation after authentication.

import Foundation
import SwiftUI
import Combine
import os.log

/// Widget quick action types
enum WidgetQuickAction: String, Sendable {
    case newMessage = "new-message"
    case scanQR = "scan-qr"
    case checkIn = "check-in"
    case newEvent = "new-event"
    case viewGroups = "view-groups"
    case settings = "settings"
}

/// Represents a deep link destination within the app
enum DeepLinkDestination: Equatable, Sendable {
    /// Navigate to a chat with a specific user
    case chat(pubkey: String, relayHints: [String] = [])

    /// Navigate to a group view
    case group(id: String)

    /// Navigate to a specific event
    case event(id: String, relayHints: [String] = [], author: String? = nil, kind: Int? = nil)

    /// Navigate to a user profile
    case profile(pubkey: String, relayHints: [String] = [])

    /// Navigate to a form
    case form(id: String)

    /// Navigate to a campaign
    case campaign(id: String)

    /// Navigate to an article by slug
    case article(slug: String)

    /// Navigate to mutual aid request
    case mutualAid(id: String)

    /// Navigate to governance proposal
    case proposal(id: String)

    /// Navigate to wiki page
    case wiki(slug: String)

    /// Navigate to settings
    case settings

    /// Connect to a relay
    case relay(url: String)

    /// Generic addressable content
    case addressable(identifier: String, pubkey: String, kind: Int, relayHints: [String] = [])

    // MARK: - Widget Deep Link Destinations

    /// Navigate to messages list (from widget)
    case messages

    /// Navigate to direct message conversation (from widget)
    case directMessage(publicKey: String)

    /// Navigate to group message (from widget)
    case groupMessage(messageId: String, groupName: String?)

    /// Navigate to events list (from widget)
    case events

    /// Navigate to event detail (from widget)
    case eventDetail(eventId: String)

    /// Navigate to groups list (from widget)
    case groups

    /// Perform a widget quick action
    case widgetAction(WidgetQuickAction)

    /// The tab to select when navigating
    var preferredTab: ContentView.Tab? {
        switch self {
        case .chat, .messages, .directMessage, .groupMessage:
            return .chat
        case .group, .groups:
            return .groups
        case .event, .events, .eventDetail:
            return .events
        case .profile:
            return .settings  // Profile might be accessed from settings
        case .settings, .relay:
            return .settings
        case .widgetAction(let action):
            switch action {
            case .newMessage, .scanQR:
                return .chat
            case .newEvent:
                return .events
            case .viewGroups:
                return .groups
            case .settings, .checkIn:
                return .settings
            }
        default:
            return nil
        }
    }

    /// Human-readable description for logging
    var description: String {
        switch self {
        case .chat(let pubkey, _):
            return "Chat with \(pubkey.prefix(8))..."
        case .group(let id):
            return "Group: \(id.prefix(8))..."
        case .event(let id, _, _, _):
            return "Event: \(id.prefix(8))..."
        case .profile(let pubkey, _):
            return "Profile: \(pubkey.prefix(8))..."
        case .form(let id):
            return "Form: \(id)"
        case .campaign(let id):
            return "Campaign: \(id)"
        case .article(let slug):
            return "Article: \(slug)"
        case .mutualAid(let id):
            return "Mutual Aid: \(id.prefix(8))..."
        case .proposal(let id):
            return "Proposal: \(id.prefix(8))..."
        case .wiki(let slug):
            return "Wiki: \(slug)"
        case .settings:
            return "Settings"
        case .relay(let url):
            return "Relay: \(url)"
        case .addressable(let identifier, let pubkey, let kind, _):
            return "Addressable: \(kind):\(pubkey.prefix(8)):\(identifier)"
        case .messages:
            return "Messages"
        case .directMessage(let publicKey):
            return "Direct Message: \(publicKey.prefix(8))..."
        case .groupMessage(let messageId, _):
            return "Group Message: \(messageId.prefix(8))..."
        case .events:
            return "Events"
        case .eventDetail(let eventId):
            return "Event Detail: \(eventId.prefix(8))..."
        case .groups:
            return "Groups"
        case .widgetAction(let action):
            return "Widget Action: \(action.rawValue)"
        }
    }
}

/// Router for handling deep link navigation throughout the app
@MainActor
final class DeepLinkRouter: ObservableObject {
    // MARK: - Singleton

    static let shared = DeepLinkRouter()

    // MARK: - Published Properties

    /// Current destination to navigate to (observe this in views)
    @Published private(set) var currentDestination: DeepLinkDestination?

    /// Whether the app is ready to process deep links (e.g., user is authenticated)
    @Published var isReadyForNavigation: Bool = false

    /// Pending destination waiting for the app to be ready
    @Published private(set) var pendingDestination: DeepLinkDestination?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "DeepLinkRouter")
    private var cancellables = Set<AnyCancellable>()

    /// Callback for tab selection (set by ContentView)
    var onSelectTab: ((ContentView.Tab) -> Void)?

    /// Callback for navigation (set by views that can handle navigation)
    var navigationHandlers: [String: (DeepLinkDestination) -> Bool] = [:]

    // MARK: - Initialization

    private init() {
        setupBindings()
    }

    private func setupBindings() {
        // When app becomes ready and there's a pending destination, process it
        $isReadyForNavigation
            .filter { $0 }
            .sink { [weak self] _ in
                self?.processPendingDestination()
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Navigate to a destination
    /// - Parameter destination: The destination to navigate to
    /// - Parameter force: Whether to navigate even if not ready (stores as pending if not ready)
    func navigate(to destination: DeepLinkDestination, force: Bool = false) {
        logger.info("Navigate requested: \(destination.description)")

        guard isReadyForNavigation || force else {
            logger.info("App not ready, storing pending destination")
            pendingDestination = destination
            return
        }

        // Select the appropriate tab first
        if let tab = destination.preferredTab {
            logger.debug("Selecting tab: \(tab.rawValue)")
            onSelectTab?(tab)
        }

        // Small delay to allow tab switch to complete
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.performNavigation(to: destination)
        }
    }

    /// Register a navigation handler for a specific context
    /// - Parameters:
    ///   - context: A unique identifier for the handler context
    ///   - handler: A closure that returns true if it handled the navigation
    func registerHandler(context: String, handler: @escaping (DeepLinkDestination) -> Bool) {
        navigationHandlers[context] = handler
    }

    /// Unregister a navigation handler
    func unregisterHandler(context: String) {
        navigationHandlers.removeValue(forKey: context)
    }

    /// Clear any pending destination
    func clearPendingDestination() {
        pendingDestination = nil
    }

    /// Clear the current destination (call after navigation completes)
    func clearCurrentDestination() {
        currentDestination = nil
    }

    /// Mark the app as ready for navigation (call after authentication)
    func markReady() {
        isReadyForNavigation = true
    }

    /// Mark the app as not ready (call on logout)
    func markNotReady() {
        isReadyForNavigation = false
    }

    // MARK: - Private Methods

    private func processPendingDestination() {
        guard let pending = pendingDestination else { return }

        logger.info("Processing pending destination: \(pending.description)")
        pendingDestination = nil
        navigate(to: pending, force: true)
    }

    private func performNavigation(to destination: DeepLinkDestination) {
        // Try registered handlers first
        for (context, handler) in navigationHandlers {
            if handler(destination) {
                logger.debug("Navigation handled by: \(context)")
                return
            }
        }

        // Set current destination for views to observe
        currentDestination = destination
        logger.debug("Set current destination for view observation")

        // Post notification for legacy observers
        NotificationCenter.default.post(
            name: .deepLinkNavigation,
            object: nil,
            userInfo: ["destination": destination]
        )
    }
}

// MARK: - Notification Names

extension Notification.Name {
    /// Posted when a deep link navigation is requested
    static let deepLinkNavigation = Notification.Name("com.buildit.deepLinkNavigation")
}

// MARK: - Environment Key

private struct DeepLinkRouterKey: EnvironmentKey {
    static let defaultValue: DeepLinkRouter = .shared
}

extension EnvironmentValues {
    var deepLinkRouter: DeepLinkRouter {
        get { self[DeepLinkRouterKey.self] }
        set { self[DeepLinkRouterKey.self] = newValue }
    }
}

// MARK: - View Extension for Deep Link Handling

extension View {
    /// Handle deep link navigation in this view
    /// - Parameter handler: Closure called when navigation is requested, return true if handled
    func onDeepLink(context: String = UUID().uuidString, handler: @escaping (DeepLinkDestination) -> Bool) -> some View {
        modifier(DeepLinkHandlerModifier(context: context, handler: handler))
    }
}

/// View modifier for handling deep links
private struct DeepLinkHandlerModifier: ViewModifier {
    let context: String
    let handler: (DeepLinkDestination) -> Bool

    @StateObject private var router = DeepLinkRouter.shared

    func body(content: Content) -> some View {
        content
            .onAppear {
                router.registerHandler(context: context, handler: handler)
            }
            .onDisappear {
                router.unregisterHandler(context: context)
            }
    }
}

// MARK: - DeepLinkDestination Codable

extension DeepLinkDestination: Codable {
    private enum CodingKeys: String, CodingKey {
        case type
        case pubkey
        case id
        case slug
        case url
        case relayHints
        case author
        case kind
        case identifier
    }

    private enum DestinationType: String, Codable {
        case chat, group, event, profile, form, campaign, article
        case mutualAid, proposal, wiki, settings, relay, addressable
        case messages, directMessage, groupMessage, events, eventDetail, groups, widgetAction
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(DestinationType.self, forKey: .type)

        switch type {
        case .chat:
            let pubkey = try container.decode(String.self, forKey: .pubkey)
            let relayHints = try container.decodeIfPresent([String].self, forKey: .relayHints) ?? []
            self = .chat(pubkey: pubkey, relayHints: relayHints)

        case .group:
            let id = try container.decode(String.self, forKey: .id)
            self = .group(id: id)

        case .event:
            let id = try container.decode(String.self, forKey: .id)
            let relayHints = try container.decodeIfPresent([String].self, forKey: .relayHints) ?? []
            let author = try container.decodeIfPresent(String.self, forKey: .author)
            let kind = try container.decodeIfPresent(Int.self, forKey: .kind)
            self = .event(id: id, relayHints: relayHints, author: author, kind: kind)

        case .profile:
            let pubkey = try container.decode(String.self, forKey: .pubkey)
            let relayHints = try container.decodeIfPresent([String].self, forKey: .relayHints) ?? []
            self = .profile(pubkey: pubkey, relayHints: relayHints)

        case .form:
            let id = try container.decode(String.self, forKey: .id)
            self = .form(id: id)

        case .campaign:
            let id = try container.decode(String.self, forKey: .id)
            self = .campaign(id: id)

        case .article:
            let slug = try container.decode(String.self, forKey: .slug)
            self = .article(slug: slug)

        case .mutualAid:
            let id = try container.decode(String.self, forKey: .id)
            self = .mutualAid(id: id)

        case .proposal:
            let id = try container.decode(String.self, forKey: .id)
            self = .proposal(id: id)

        case .wiki:
            let slug = try container.decode(String.self, forKey: .slug)
            self = .wiki(slug: slug)

        case .settings:
            self = .settings

        case .relay:
            let url = try container.decode(String.self, forKey: .url)
            self = .relay(url: url)

        case .addressable:
            let identifier = try container.decode(String.self, forKey: .identifier)
            let pubkey = try container.decode(String.self, forKey: .pubkey)
            let kind = try container.decode(Int.self, forKey: .kind)
            let relayHints = try container.decodeIfPresent([String].self, forKey: .relayHints) ?? []
            self = .addressable(identifier: identifier, pubkey: pubkey, kind: kind, relayHints: relayHints)

        case .messages:
            self = .messages

        case .directMessage:
            let pubkey = try container.decode(String.self, forKey: .pubkey)
            self = .directMessage(publicKey: pubkey)

        case .groupMessage:
            let id = try container.decode(String.self, forKey: .id)
            let slug = try container.decodeIfPresent(String.self, forKey: .slug)
            self = .groupMessage(messageId: id, groupName: slug)

        case .events:
            self = .events

        case .eventDetail:
            let id = try container.decode(String.self, forKey: .id)
            self = .eventDetail(eventId: id)

        case .groups:
            self = .groups

        case .widgetAction:
            let id = try container.decode(String.self, forKey: .id)
            if let action = WidgetQuickAction(rawValue: id) {
                self = .widgetAction(action)
            } else {
                self = .settings
            }
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .chat(let pubkey, let relayHints):
            try container.encode(DestinationType.chat, forKey: .type)
            try container.encode(pubkey, forKey: .pubkey)
            try container.encode(relayHints, forKey: .relayHints)

        case .group(let id):
            try container.encode(DestinationType.group, forKey: .type)
            try container.encode(id, forKey: .id)

        case .event(let id, let relayHints, let author, let kind):
            try container.encode(DestinationType.event, forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(relayHints, forKey: .relayHints)
            try container.encodeIfPresent(author, forKey: .author)
            try container.encodeIfPresent(kind, forKey: .kind)

        case .profile(let pubkey, let relayHints):
            try container.encode(DestinationType.profile, forKey: .type)
            try container.encode(pubkey, forKey: .pubkey)
            try container.encode(relayHints, forKey: .relayHints)

        case .form(let id):
            try container.encode(DestinationType.form, forKey: .type)
            try container.encode(id, forKey: .id)

        case .campaign(let id):
            try container.encode(DestinationType.campaign, forKey: .type)
            try container.encode(id, forKey: .id)

        case .article(let slug):
            try container.encode(DestinationType.article, forKey: .type)
            try container.encode(slug, forKey: .slug)

        case .mutualAid(let id):
            try container.encode(DestinationType.mutualAid, forKey: .type)
            try container.encode(id, forKey: .id)

        case .proposal(let id):
            try container.encode(DestinationType.proposal, forKey: .type)
            try container.encode(id, forKey: .id)

        case .wiki(let slug):
            try container.encode(DestinationType.wiki, forKey: .type)
            try container.encode(slug, forKey: .slug)

        case .settings:
            try container.encode(DestinationType.settings, forKey: .type)

        case .relay(let url):
            try container.encode(DestinationType.relay, forKey: .type)
            try container.encode(url, forKey: .url)

        case .addressable(let identifier, let pubkey, let kind, let relayHints):
            try container.encode(DestinationType.addressable, forKey: .type)
            try container.encode(identifier, forKey: .identifier)
            try container.encode(pubkey, forKey: .pubkey)
            try container.encode(kind, forKey: .kind)
            try container.encode(relayHints, forKey: .relayHints)

        case .messages:
            try container.encode(DestinationType.messages, forKey: .type)

        case .directMessage(let publicKey):
            try container.encode(DestinationType.directMessage, forKey: .type)
            try container.encode(publicKey, forKey: .pubkey)

        case .groupMessage(let messageId, let groupName):
            try container.encode(DestinationType.groupMessage, forKey: .type)
            try container.encode(messageId, forKey: .id)
            try container.encodeIfPresent(groupName, forKey: .slug)

        case .events:
            try container.encode(DestinationType.events, forKey: .type)

        case .eventDetail(let eventId):
            try container.encode(DestinationType.eventDetail, forKey: .type)
            try container.encode(eventId, forKey: .id)

        case .groups:
            try container.encode(DestinationType.groups, forKey: .type)

        case .widgetAction(let action):
            try container.encode(DestinationType.widgetAction, forKey: .type)
            try container.encode(action.rawValue, forKey: .id)
        }
    }
}
