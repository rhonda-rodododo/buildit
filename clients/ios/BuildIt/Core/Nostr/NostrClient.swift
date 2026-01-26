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

/// Configuration for subscription filter obfuscation
struct SubscriptionObfuscationConfig {
    /// Enable subscription obfuscation
    var enabled: Bool = true
    /// Use broad filters and filter locally
    var broadFilteringEnabled: Bool = true
    /// Send different filter subsets to different relays
    var filterDiffusionEnabled: Bool = true
    /// Add dummy subscriptions to obscure real interests
    var dummySubscriptionsEnabled: Bool = true
    /// Number of dummy pubkeys to add to author filters
    var dummyPubkeyCount: Int = 5
    /// Number of dummy event IDs to add to ID filters
    var dummyEventIdCount: Int = 3
    /// Percentage of real filter elements to send per relay
    var filterDiffusionRatio: Double = 0.6
    /// Minimum relays to receive each real filter element
    var minRelaysPerElement: Int = 2
}

/// Subscription tracking
struct NostrSubscription {
    let id: String
    let filters: [NostrFilter]
    let callback: (NostrEvent) -> Void
}

/// Obfuscated subscription tracking for privacy
struct ObfuscatedSubscription {
    let publicId: String
    let originalFilters: [NostrFilter]
    var relaySubscriptions: [String: String] = [:] // relay URL -> subscription ID
    var dummyPubkeys: Set<String> = []
    var dummyEventIds: Set<String> = []
    let callback: (NostrEvent) -> Void
    var eoseCount: Int = 0
    var relayCount: Int = 0
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
    private var obfuscatedSubscriptions: [String: ObfuscatedSubscription] = [:]
    private var pendingEvents: [NostrEvent] = []
    private var eventCallbacks: [(NostrEvent) -> Void] = []
    private var obfuscationConfig = SubscriptionObfuscationConfig()

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

    /// Subscribe to events matching filters with privacy obfuscation
    ///
    /// When obfuscation is enabled, this method:
    /// 1. Adds dummy pubkeys/event IDs to obscure real interests
    /// 2. Distributes filter elements across relays (diffusion)
    /// 3. Filters results locally to match original intent
    ///
    /// This prevents relays from learning the user's full social graph
    /// through subscription pattern analysis.
    @discardableResult
    func subscribe(
        filters: [NostrFilter],
        callback: @escaping (NostrEvent) -> Void
    ) -> String {
        let subscriptionId = String(UUID().uuidString.prefix(8).lowercased())

        // If obfuscation is disabled, use simple subscription
        guard obfuscationConfig.enabled else {
            return subscribeSimple(filters: filters, callback: callback)
        }

        let relayUrls = defaultRelays

        // Create obfuscated subscription
        var obfuscatedSub = ObfuscatedSubscription(
            publicId: subscriptionId,
            originalFilters: filters,
            callback: callback,
            relayCount: relayUrls.count
        )

        // Generate dummy data for obfuscation
        if obfuscationConfig.dummySubscriptionsEnabled {
            for _ in 0..<obfuscationConfig.dummyPubkeyCount {
                obfuscatedSub.dummyPubkeys.insert(generateRandomHex(length: 64))
            }
            for _ in 0..<obfuscationConfig.dummyEventIdCount {
                obfuscatedSub.dummyEventIds.insert(generateRandomHex(length: 64))
            }
        }

        // Create obfuscated filters for each relay
        let obfuscatedFiltersPerRelay = createObfuscatedFilters(
            originalFilters: filters,
            relayUrls: relayUrls,
            obfuscatedSub: &obfuscatedSub
        )

        // Subscribe to each relay with its specific filter set
        for (index, relayUrl) in relayUrls.enumerated() {
            let relayFilters = obfuscatedFiltersPerRelay[index]
            guard !relayFilters.isEmpty else { continue }

            let relaySubId = "\(subscriptionId)_\(index)"
            obfuscatedSub.relaySubscriptions[relayUrl] = relaySubId

            relayPool.subscribe(id: relaySubId, filters: relayFilters, to: relayUrl)
        }

        obfuscatedSubscriptions[subscriptionId] = obfuscatedSub

        // Also store in regular subscriptions for compatibility
        let subscription = NostrSubscription(
            id: subscriptionId,
            filters: filters,
            callback: callback
        )
        subscriptions[subscriptionId] = subscription

        logger.info("Created obfuscated subscription: \(subscriptionId)")
        return subscriptionId
    }

    /// Simple subscription without obfuscation
    private func subscribeSimple(
        filters: [NostrFilter],
        callback: @escaping (NostrEvent) -> Void
    ) -> String {
        let subscriptionId = String(UUID().uuidString.prefix(8).lowercased())
        let subscription = NostrSubscription(
            id: subscriptionId,
            filters: filters,
            callback: callback
        )

        subscriptions[subscriptionId] = subscription
        relayPool.subscribe(id: subscriptionId, filters: filters)

        logger.info("Created subscription: \(subscriptionId)")
        return subscriptionId
    }

    /// Create obfuscated filters for each relay
    private func createObfuscatedFilters(
        originalFilters: [NostrFilter],
        relayUrls: [String],
        obfuscatedSub: inout ObfuscatedSubscription
    ) -> [[NostrFilter]] {
        var result: [[NostrFilter]] = relayUrls.map { _ in [] }

        for filter in originalFilters {
            // Handle author-based filters (protect social graph)
            if let authors = filter.authors, !authors.isEmpty {
                var authorsWithDummies = authors
                if obfuscationConfig.dummySubscriptionsEnabled {
                    authorsWithDummies.append(contentsOf: obfuscatedSub.dummyPubkeys)
                }

                if obfuscationConfig.filterDiffusionEnabled && relayUrls.count > 1 {
                    let distributed = distributeWithOverlap(
                        elements: authorsWithDummies,
                        bucketCount: relayUrls.count,
                        ratio: obfuscationConfig.filterDiffusionRatio,
                        minBucketsPerElement: obfuscationConfig.minRelaysPerElement
                    )

                    for (relayIndex, relayAuthors) in distributed.enumerated() {
                        if !relayAuthors.isEmpty {
                            var modifiedFilter = filter
                            modifiedFilter.authors = relayAuthors
                            result[relayIndex].append(modifiedFilter)
                        }
                    }
                } else {
                    for index in 0..<relayUrls.count {
                        var modifiedFilter = filter
                        modifiedFilter.authors = authorsWithDummies
                        result[index].append(modifiedFilter)
                    }
                }
            }
            // Handle ID-based filters
            else if let ids = filter.ids, !ids.isEmpty {
                var idsWithDummies = ids
                if obfuscationConfig.dummySubscriptionsEnabled {
                    idsWithDummies.append(contentsOf: obfuscatedSub.dummyEventIds)
                }

                if obfuscationConfig.filterDiffusionEnabled && relayUrls.count > 1 {
                    let distributed = distributeWithOverlap(
                        elements: idsWithDummies,
                        bucketCount: relayUrls.count,
                        ratio: obfuscationConfig.filterDiffusionRatio,
                        minBucketsPerElement: obfuscationConfig.minRelaysPerElement
                    )

                    for (relayIndex, relayIds) in distributed.enumerated() {
                        if !relayIds.isEmpty {
                            var modifiedFilter = filter
                            modifiedFilter.ids = relayIds
                            result[relayIndex].append(modifiedFilter)
                        }
                    }
                } else {
                    for index in 0..<relayUrls.count {
                        var modifiedFilter = filter
                        modifiedFilter.ids = idsWithDummies
                        result[index].append(modifiedFilter)
                    }
                }
            }
            // Handle #p tag filters
            else if let pTags = filter.p, !pTags.isEmpty {
                var pTagsWithDummies = pTags
                if obfuscationConfig.dummySubscriptionsEnabled {
                    pTagsWithDummies.append(contentsOf: obfuscatedSub.dummyPubkeys)
                }

                if obfuscationConfig.filterDiffusionEnabled && relayUrls.count > 1 {
                    let distributed = distributeWithOverlap(
                        elements: pTagsWithDummies,
                        bucketCount: relayUrls.count,
                        ratio: obfuscationConfig.filterDiffusionRatio,
                        minBucketsPerElement: obfuscationConfig.minRelaysPerElement
                    )

                    for (relayIndex, relayPTags) in distributed.enumerated() {
                        if !relayPTags.isEmpty {
                            var modifiedFilter = filter
                            modifiedFilter.p = relayPTags
                            result[relayIndex].append(modifiedFilter)
                        }
                    }
                } else {
                    for index in 0..<relayUrls.count {
                        var modifiedFilter = filter
                        modifiedFilter.p = pTagsWithDummies
                        result[index].append(modifiedFilter)
                    }
                }
            }
            // Other filters - send to all relays as-is
            else {
                for index in 0..<relayUrls.count {
                    result[index].append(filter)
                }
            }
        }

        return result
    }

    /// Distribute elements across buckets with overlap
    private func distributeWithOverlap<T>(
        elements: [T],
        bucketCount: Int,
        ratio: Double,
        minBucketsPerElement: Int
    ) -> [[T]] {
        guard !elements.isEmpty, bucketCount > 0 else {
            return Array(repeating: [], count: bucketCount)
        }

        var buckets: [[T]] = Array(repeating: [], count: bucketCount)
        var elementBuckets: [Int: Set<Int>] = [:]
        elements.indices.forEach { elementBuckets[$0] = [] }

        let elementsPerBucket = Int(ceil(Double(elements.count) * ratio))

        // First pass: randomly assign elements to buckets
        for bucketIdx in 0..<bucketCount {
            let shuffled = elements.indices.shuffled()
            let selected = shuffled.prefix(min(elementsPerBucket, elements.count))

            for elementIdx in selected {
                buckets[bucketIdx].append(elements[elementIdx])
                elementBuckets[elementIdx]?.insert(bucketIdx)
            }
        }

        // Second pass: ensure minimum coverage
        for (elementIdx, element) in elements.enumerated() {
            var assignedBuckets = elementBuckets[elementIdx] ?? []
            while assignedBuckets.count < min(minBucketsPerElement, bucketCount) {
                let availableBuckets = (0..<bucketCount).filter { !assignedBuckets.contains($0) }
                guard !availableBuckets.isEmpty else { break }

                let randomBucket = availableBuckets.randomElement()!
                buckets[randomBucket].append(element)
                assignedBuckets.insert(randomBucket)
            }
        }

        return buckets
    }

    /// Generate random hex string
    private func generateRandomHex(length: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: length / 2)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Check if event matches original filters (filtering out dummy data)
    private func eventMatchesOriginalFilters(
        event: NostrEvent,
        obfuscatedSub: ObfuscatedSubscription
    ) -> Bool {
        // Check if from dummy pubkey
        if obfuscatedSub.dummyPubkeys.contains(event.pubkey) {
            return false
        }

        // Check if dummy event ID
        if obfuscatedSub.dummyEventIds.contains(event.id) {
            return false
        }

        // Check if matches any original filter
        for filter in obfuscatedSub.originalFilters {
            if eventMatchesFilter(event: event, filter: filter) {
                return true
            }
        }

        return false
    }

    /// Check if event matches a filter
    private func eventMatchesFilter(event: NostrEvent, filter: NostrFilter) -> Bool {
        if let ids = filter.ids, !ids.isEmpty, !ids.contains(event.id) {
            return false
        }
        if let authors = filter.authors, !authors.isEmpty, !authors.contains(event.pubkey) {
            return false
        }
        if let kinds = filter.kinds, !kinds.isEmpty, !kinds.contains(event.kind) {
            return false
        }
        if let since = filter.since, event.created_at < since {
            return false
        }
        if let until = filter.until, event.created_at > until {
            return false
        }
        if let pTags = filter.p, !pTags.isEmpty {
            let eventPTags = event.tags.filter { $0.first == "p" }.compactMap { $0[safe: 1] }
            if !pTags.contains(where: { eventPTags.contains($0) }) {
                return false
            }
        }
        if let eTags = filter.e, !eTags.isEmpty {
            let eventETags = event.tags.filter { $0.first == "e" }.compactMap { $0[safe: 1] }
            if !eTags.contains(where: { eventETags.contains($0) }) {
                return false
            }
        }
        return true
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
        // Clean up obfuscated subscription if it exists
        if let obfuscatedSub = obfuscatedSubscriptions[subscriptionId] {
            for (_, relaySubId) in obfuscatedSub.relaySubscriptions {
                relayPool.unsubscribe(id: relaySubId)
            }
            obfuscatedSubscriptions.removeValue(forKey: subscriptionId)
        }

        subscriptions.removeValue(forKey: subscriptionId)
        relayPool.unsubscribe(id: subscriptionId)

        logger.info("Removed subscription: \(subscriptionId)")
    }

    /// Unsubscribe from all subscriptions
    func unsubscribeAll() {
        // Clean up all obfuscated subscriptions
        for (_, obfuscatedSub) in obfuscatedSubscriptions {
            for (_, relaySubId) in obfuscatedSub.relaySubscriptions {
                relayPool.unsubscribe(id: relaySubId)
            }
        }
        obfuscatedSubscriptions.removeAll()

        for subscriptionId in subscriptions.keys {
            relayPool.unsubscribe(id: subscriptionId)
        }
        subscriptions.removeAll()
    }

    // MARK: - Obfuscation Configuration

    /// Enable or disable subscription obfuscation
    func setSubscriptionObfuscationEnabled(_ enabled: Bool) {
        obfuscationConfig.enabled = enabled
    }

    /// Update subscription obfuscation configuration
    func updateObfuscationConfig(_ config: SubscriptionObfuscationConfig) {
        obfuscationConfig = config
    }

    /// Get current obfuscation configuration
    func getObfuscationConfig() -> SubscriptionObfuscationConfig {
        return obfuscationConfig
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
        // Check if this is part of an obfuscated subscription
        // Extract the public subscription ID from relay-specific ID (format: publicId_relayIndex)
        let publicSubId = subscriptionId.contains("_")
            ? String(subscriptionId.split(separator: "_").first ?? "")
            : subscriptionId

        if let obfuscatedSub = obfuscatedSubscriptions[publicSubId] {
            // Filter out dummy data
            guard eventMatchesOriginalFilters(event: event, obfuscatedSub: obfuscatedSub) else {
                return
            }
            obfuscatedSub.callback(event)
        } else if let subscription = subscriptions[subscriptionId] {
            // Regular subscription
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
