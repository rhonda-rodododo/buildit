// NostrClient.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles Nostr protocol communication including WebSocket connections,
// event subscriptions, and event publishing.

import Foundation
import Combine
import os.log

/// Nostr event kinds used by BuildIt
enum NostrEventKind: Int, Codable {
    case setMetadata = 0
    case textNote = 1
    case recommendRelay = 2
    case contactList = 3
    case encryptedDirectMessage = 4
    case deletion = 5
    case repost = 6
    case reaction = 7
    case badgeAward = 8
    case channelCreation = 40
    case channelMetadata = 41
    case channelMessage = 42
    case channelHideMessage = 43
    case channelMuteUser = 44

    // BuildIt custom event kinds (NIP-99 range)
    case meshPeerAnnouncement = 30000
    case groupMessage = 30001
    case deviceSync = 30002
}

/// Nostr event structure
struct NostrEvent: Codable, Identifiable {
    let id: String
    let pubkey: String
    let created_at: Int
    let kind: Int
    let tags: [[String]]
    let content: String
    let sig: String

    /// Create event ID from event data (SHA256 of serialized content)
    static func createId(
        pubkey: String,
        createdAt: Int,
        kind: Int,
        tags: [[String]],
        content: String
    ) -> String {
        let serialized = "[0,\"\(pubkey)\",\(createdAt),\(kind),\(serializeTags(tags)),\"\(escapeContent(content))\"]"
        return CryptoManager.shared.sha256(serialized)
    }

    private static func serializeTags(_ tags: [[String]]) -> String {
        let serialized = tags.map { tag in
            "[" + tag.map { "\"\($0)\"" }.joined(separator: ",") + "]"
        }.joined(separator: ",")
        return "[\(serialized)]"
    }

    private static func escapeContent(_ content: String) -> String {
        content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }
}

/// Nostr filter for subscriptions
struct NostrFilter: Codable {
    var ids: [String]?
    var authors: [String]?
    var kinds: [Int]?
    var e: [String]?  // Referenced event IDs
    var p: [String]?  // Referenced pubkeys
    var since: Int?
    var until: Int?
    var limit: Int?

    enum CodingKeys: String, CodingKey {
        case ids, authors, kinds, since, until, limit
        case e = "#e"
        case p = "#p"
    }
}

/// Nostr relay message types
enum NostrRelayMessage {
    case event(subscriptionId: String, event: NostrEvent)
    case ok(eventId: String, success: Bool, message: String)
    case eose(subscriptionId: String)
    case notice(message: String)
    case auth(challenge: String)

    static func parse(_ data: Data) -> NostrRelayMessage? {
        guard let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let type = array.first as? String else {
            return nil
        }

        switch type {
        case "EVENT":
            guard array.count >= 3,
                  let subscriptionId = array[1] as? String,
                  let eventDict = array[2] as? [String: Any],
                  let eventData = try? JSONSerialization.data(withJSONObject: eventDict),
                  let event = try? JSONDecoder().decode(NostrEvent.self, from: eventData) else {
                return nil
            }
            return .event(subscriptionId: subscriptionId, event: event)

        case "OK":
            guard array.count >= 4,
                  let eventId = array[1] as? String,
                  let success = array[2] as? Bool,
                  let message = array[3] as? String else {
                return nil
            }
            return .ok(eventId: eventId, success: success, message: message)

        case "EOSE":
            guard array.count >= 2,
                  let subscriptionId = array[1] as? String else {
                return nil
            }
            return .eose(subscriptionId: subscriptionId)

        case "NOTICE":
            guard array.count >= 2,
                  let message = array[1] as? String else {
                return nil
            }
            return .notice(message: message)

        case "AUTH":
            guard array.count >= 2,
                  let challenge = array[1] as? String else {
                return nil
            }
            return .auth(challenge: challenge)

        default:
            return nil
        }
    }
}

/// Subscription tracking
struct NostrSubscription {
    let id: String
    let filters: [NostrFilter]
    let callback: (NostrEvent) -> Void
}

/// NostrClient manages Nostr protocol communication
@MainActor
class NostrClient: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = NostrClient()

    // MARK: - Published Properties

    @Published private(set) var isConnected: Bool = false
    @Published private(set) var connectedRelays: [String] = []
    @Published private(set) var receivedEvents: [NostrEvent] = []
    @Published private(set) var lastError: String?

    // MARK: - Private Properties

    private var relayPool: RelayPool
    private var subscriptions: [String: NostrSubscription] = [:]
    private var pendingEvents: [NostrEvent] = []
    private var eventCallbacks: [(NostrEvent) -> Void] = []

    private let logger = Logger(subsystem: "com.buildit", category: "NostrClient")
    private var cancellables = Set<AnyCancellable>()

    /// Default relays to connect to
    private let defaultRelays = [
        "wss://relay.damus.io",
        "wss://relay.nostr.band",
        "wss://nos.lol",
        "wss://relay.snort.social"
    ]

    // MARK: - Initialization

    private override init() {
        self.relayPool = RelayPool()
        super.init()
        setupBindings()
    }

    private func setupBindings() {
        relayPool.$connectedRelays
            .receive(on: DispatchQueue.main)
            .assign(to: &$connectedRelays)

        relayPool.onEvent = { [weak self] subscriptionId, event in
            Task { @MainActor in
                self?.handleEvent(event, subscriptionId: subscriptionId)
            }
        }

        relayPool.onEOSE = { [weak self] subscriptionId in
            Task { @MainActor in
                self?.logger.info("EOSE for subscription: \(subscriptionId)")
            }
        }
    }

    // MARK: - Connection Management

    /// Connect to default Nostr relays
    func connectToDefaultRelays() {
        for relay in defaultRelays {
            relayPool.addRelay(url: relay)
        }
    }

    /// Connect to a specific relay
    func connect(to relayURL: String) {
        relayPool.addRelay(url: relayURL)
    }

    /// Disconnect from a specific relay
    func disconnect(from relayURL: String) {
        relayPool.removeRelay(url: relayURL)
    }

    /// Disconnect from all relays
    func disconnectAll() {
        relayPool.disconnectAll()
    }

    /// Refresh all subscriptions
    func refreshSubscriptions() {
        for (_, subscription) in subscriptions {
            relayPool.subscribe(id: subscription.id, filters: subscription.filters)
        }
    }

    // MARK: - Subscriptions

    /// Subscribe to events matching filters
    @discardableResult
    func subscribe(
        filters: [NostrFilter],
        callback: @escaping (NostrEvent) -> Void
    ) -> String {
        let subscriptionId = UUID().uuidString.prefix(8).lowercased()
        let subscription = NostrSubscription(
            id: String(subscriptionId),
            filters: filters,
            callback: callback
        )

        subscriptions[String(subscriptionId)] = subscription
        relayPool.subscribe(id: String(subscriptionId), filters: filters)

        logger.info("Created subscription: \(subscriptionId)")
        return String(subscriptionId)
    }

    /// Subscribe to events from specific authors
    func subscribeToAuthors(_ pubkeys: [String], kinds: [NostrEventKind]? = nil) -> String {
        var filter = NostrFilter()
        filter.authors = pubkeys
        filter.kinds = kinds?.map { $0.rawValue }

        return subscribe(filters: [filter]) { [weak self] event in
            self?.receivedEvents.append(event)
        }
    }

    /// Subscribe to direct messages
    func subscribeToDirectMessages() -> String {
        Task {
            guard let myPubkey = await CryptoManager.shared.getPublicKeyHex() else {
                return
            }

            let filter = NostrFilter(
                kinds: [NostrEventKind.encryptedDirectMessage.rawValue],
                p: [myPubkey]
            )

            _ = subscribe(filters: [filter]) { [weak self] event in
                self?.handleDirectMessage(event)
            }
        }

        return "" // Actual subscription ID is set asynchronously
    }

    /// Unsubscribe from a subscription
    func unsubscribe(_ subscriptionId: String) {
        subscriptions.removeValue(forKey: subscriptionId)
        relayPool.unsubscribe(id: subscriptionId)

        logger.info("Removed subscription: \(subscriptionId)")
    }

    /// Unsubscribe from all subscriptions
    func unsubscribeAll() {
        for subscriptionId in subscriptions.keys {
            relayPool.unsubscribe(id: subscriptionId)
        }
        subscriptions.removeAll()
    }

    // MARK: - Event Publishing

    /// Publish a text note
    func publishTextNote(_ content: String, tags: [[String]] = []) async throws -> NostrEvent {
        try await publishEvent(kind: .textNote, content: content, tags: tags)
    }

    /// Send an encrypted direct message
    func sendDirectMessage(_ content: String, to recipientPubkey: String) async throws -> NostrEvent {
        // Encrypt the message using NIP-04
        let encrypted = try await CryptoManager.shared.encryptNIP04(content, for: recipientPubkey)

        // Create the event with p tag pointing to recipient
        let tags = [["p", recipientPubkey]]

        return try await publishEvent(kind: .encryptedDirectMessage, content: encrypted, tags: tags)
    }

    /// Publish an event of any kind
    func publishEvent(
        kind: NostrEventKind,
        content: String,
        tags: [[String]] = []
    ) async throws -> NostrEvent {
        guard let pubkey = await CryptoManager.shared.getPublicKeyHex() else {
            throw NostrError.noKeyPair
        }

        let createdAt = Int(Date().timeIntervalSince1970)

        // Create event ID
        let eventId = NostrEvent.createId(
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind.rawValue,
            tags: tags,
            content: content
        )

        // Sign the event
        let signature = try await CryptoManager.shared.signEvent(eventId: eventId)

        // Create the event
        let event = NostrEvent(
            id: eventId,
            pubkey: pubkey,
            created_at: createdAt,
            kind: kind.rawValue,
            tags: tags,
            content: content,
            sig: signature
        )

        // Publish to relays
        relayPool.publish(event: event)

        logger.info("Published event: \(eventId)")
        return event
    }

    /// Publish a mesh peer announcement
    func publishPeerAnnouncement() async throws -> NostrEvent {
        guard let pubkey = await CryptoManager.shared.getPublicKeyHex() else {
            throw NostrError.noKeyPair
        }

        // Include device info in announcement
        let content = """
        {"type":"peer","version":"1.0","capabilities":["ble","nostr"]}
        """

        return try await publishEvent(kind: .meshPeerAnnouncement, content: content, tags: [])
    }

    // MARK: - Event Callbacks

    /// Register a callback for all received events
    func onEvent(_ callback: @escaping (NostrEvent) -> Void) {
        eventCallbacks.append(callback)
    }

    // MARK: - Background Sync

    func performBackgroundSync() async {
        // Fetch recent events since last sync
        let lastSyncTime = UserDefaults.standard.integer(forKey: "lastNostrSync")
        let since = lastSyncTime > 0 ? lastSyncTime : Int(Date().timeIntervalSince1970) - 3600

        if let myPubkey = await CryptoManager.shared.getPublicKeyHex() {
            let filter = NostrFilter(
                kinds: [NostrEventKind.encryptedDirectMessage.rawValue],
                p: [myPubkey],
                since: since
            )

            relayPool.subscribe(id: "bg-sync", filters: [filter])

            // Wait for events
            try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds

            relayPool.unsubscribe(id: "bg-sync")
        }

        // Update last sync time
        UserDefaults.standard.set(Int(Date().timeIntervalSince1970), forKey: "lastNostrSync")
    }

    // MARK: - Private Methods

    private func handleEvent(_ event: NostrEvent, subscriptionId: String) {
        // Call subscription-specific callback
        if let subscription = subscriptions[subscriptionId] {
            subscription.callback(event)
        }

        // Call global callbacks
        for callback in eventCallbacks {
            callback(event)
        }
    }

    private func handleDirectMessage(_ event: NostrEvent) {
        Task {
            // Find sender pubkey
            guard let senderPubkey = event.tags.first(where: { $0.first == "p" })?[safe: 1] else {
                logger.warning("DM event missing sender tag")
                return
            }

            // Decrypt message
            do {
                let decrypted = try await CryptoManager.shared.decryptNIP04(
                    event.content,
                    from: senderPubkey
                )
                logger.info("Received DM from \(senderPubkey.prefix(8)): \(decrypted.prefix(50))")

                // Notify message queue
                await MessageQueue.shared.enqueue(
                    content: decrypted,
                    from: senderPubkey,
                    eventId: event.id
                )
            } catch {
                logger.error("Failed to decrypt DM: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - Nostr Errors

enum NostrError: LocalizedError {
    case noKeyPair
    case connectionFailed
    case publishFailed
    case invalidEvent

    var errorDescription: String? {
        switch self {
        case .noKeyPair:
            return "No key pair available"
        case .connectionFailed:
            return "Failed to connect to relay"
        case .publishFailed:
            return "Failed to publish event"
        case .invalidEvent:
            return "Invalid event format"
        }
    }
}

// MARK: - Array Extension

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
