// PTTChannelManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages Push-to-Talk (PTT) channels with speaker queue management.
// Implements walkie-talkie style voice communication with priority-based speaking.

import Foundation
import Combine
import os.log

// MARK: - Nostr Event Kinds for PTT

/// Nostr event kinds for PTT signaling (24370-24376 range)
public enum PTTEventKind: Int {
    case channelCreate = 24370
    case channelJoin = 24371
    case channelLeave = 24372
    case speakRequest = 24373
    case speakGrant = 24374
    case speakRelease = 24375
    case audioPacket = 24376
}

// MARK: - Speaking Priority

/// Priority levels for speaking requests
public enum SpeakingPriority: String, Codable, CaseIterable, Sendable, Comparable {
    case normal
    case high
    case moderator

    /// Priority weight for queue ordering (higher = more priority)
    public var weight: Int {
        switch self {
        case .normal: return 1
        case .high: return 10
        case .moderator: return 100
        }
    }

    public static func < (lhs: SpeakingPriority, rhs: SpeakingPriority) -> Bool {
        lhs.weight < rhs.weight
    }
}

// MARK: - PTT Channel

/// Represents a PTT channel
public struct PTTChannel: Identifiable, Equatable, Sendable {
    public let id: String
    public let channelId: String
    public let groupId: String?
    public let name: String
    public let createdBy: String
    public let createdAt: Date
    public let maxParticipants: Int
    public var isActive: Bool
    public var isE2EE: Bool

    public init(
        channelId: String,
        groupId: String? = nil,
        name: String,
        createdBy: String,
        createdAt: Date = Date(),
        maxParticipants: Int = 50,
        isActive: Bool = true,
        isE2EE: Bool = true
    ) {
        self.id = channelId
        self.channelId = channelId
        self.groupId = groupId
        self.name = name
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.maxParticipants = maxParticipants
        self.isActive = isActive
        self.isE2EE = isE2EE
    }
}

// MARK: - PTT Member

/// Represents a member in a PTT channel
public struct PTTMember: Identifiable, Equatable, Sendable {
    public let id: String
    public let pubkey: String
    public let displayName: String?
    public let joinedAt: Date
    public var isOnline: Bool
    public var lastSeenAt: Date

    public init(
        pubkey: String,
        displayName: String? = nil,
        joinedAt: Date = Date(),
        isOnline: Bool = true,
        lastSeenAt: Date = Date()
    ) {
        self.id = pubkey
        self.pubkey = pubkey
        self.displayName = displayName
        self.joinedAt = joinedAt
        self.isOnline = isOnline
        self.lastSeenAt = lastSeenAt
    }
}

// MARK: - Speaker Queue Entry

/// Represents an entry in the speaker queue
public struct SpeakerQueueEntry: Identifiable, Equatable, Sendable {
    public let id: String
    public let pubkey: String
    public let displayName: String?
    public let priority: SpeakingPriority
    public let requestedAt: Date

    public init(
        pubkey: String,
        displayName: String? = nil,
        priority: SpeakingPriority = .normal,
        requestedAt: Date = Date()
    ) {
        self.id = "\(pubkey)-\(requestedAt.timeIntervalSince1970)"
        self.pubkey = pubkey
        self.displayName = displayName
        self.priority = priority
        self.requestedAt = requestedAt
    }
}

// MARK: - Current Speaker

/// Represents the current speaker in a channel
public struct CurrentSpeaker: Equatable, Sendable {
    public let pubkey: String
    public let displayName: String?
    public let startedAt: Date
    public let priority: SpeakingPriority
    public var audioLevel: Float

    public init(
        pubkey: String,
        displayName: String? = nil,
        startedAt: Date = Date(),
        priority: SpeakingPriority = .normal,
        audioLevel: Float = 0.0
    ) {
        self.pubkey = pubkey
        self.displayName = displayName
        self.startedAt = startedAt
        self.priority = priority
        self.audioLevel = audioLevel
    }
}

// MARK: - PTT Channel Manager Errors

public enum PTTChannelError: LocalizedError {
    case channelNotFound
    case channelFull
    case alreadyInChannel
    case notInChannel
    case notSpeaking
    case alreadySpeaking
    case speakRequestPending
    case noKeyPair
    case signalingFailed

    public var errorDescription: String? {
        switch self {
        case .channelNotFound:
            return "Channel not found"
        case .channelFull:
            return "Channel is full"
        case .alreadyInChannel:
            return "Already in this channel"
        case .notInChannel:
            return "Not in this channel"
        case .notSpeaking:
            return "Not currently speaking"
        case .alreadySpeaking:
            return "Already speaking"
        case .speakRequestPending:
            return "Speak request already pending"
        case .noKeyPair:
            return "No key pair available"
        case .signalingFailed:
            return "Failed to send signaling message"
        }
    }
}

// MARK: - PTT Channel Manager

/// Manages PTT channels with speaker queue management
@MainActor
public class PTTChannelManager: ObservableObject {
    // MARK: - Published Properties

    /// Active channels by channel ID
    @Published public private(set) var channels: [String: PTTChannel] = [:]

    /// Members by channel ID
    @Published public private(set) var channelMembers: [String: [PTTMember]] = [:]

    /// Current speaker by channel ID (nil if no one speaking)
    @Published public private(set) var currentSpeakers: [String: CurrentSpeaker] = [:]

    /// Speaker queue by channel ID
    @Published public private(set) var speakerQueues: [String: [SpeakerQueueEntry]] = [:]

    /// Currently joined channel ID
    @Published public private(set) var currentChannelId: String?

    // MARK: - Configuration

    /// Speak timeout in seconds (default 30)
    public var speakTimeout: TimeInterval = 30.0

    // MARK: - Private Properties

    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "PTTChannelManager")

    /// Speak timeout timers by channel ID
    private var speakTimeoutTimers: [String: Task<Void, Never>] = [:]

    /// Local pubkey cache
    private var localPubkey: String?

    // MARK: - Event Publishers

    /// Emits when speaker changes in a channel
    public let speakerChanged = PassthroughSubject<(channelId: String, speaker: CurrentSpeaker?), Never>()

    /// Emits when queue is updated
    public let queueUpdated = PassthroughSubject<(channelId: String, queue: [SpeakerQueueEntry]), Never>()

    /// Emits when there's channel activity
    public let channelActivity = PassthroughSubject<(channelId: String, type: String, pubkey: String), Never>()

    /// Emits when speak request is granted
    public let speakGranted = PassthroughSubject<String, Never>()

    /// Emits when speak request is queued
    public let speakQueued = PassthroughSubject<(channelId: String, position: Int), Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(
        nostrClient: NostrClient = .shared,
        cryptoManager: CryptoManager = .shared
    ) {
        self.nostrClient = nostrClient
        self.cryptoManager = cryptoManager
    }

    deinit {
        speakTimeoutTimers.values.forEach { $0.cancel() }
    }

    // MARK: - Channel Operations

    /// Create a new PTT channel
    /// - Parameters:
    ///   - groupId: Optional group ID
    ///   - name: Channel name
    ///   - maxParticipants: Maximum participants (default 50)
    /// - Returns: The created channel
    public func createChannel(
        groupId: String? = nil,
        name: String,
        maxParticipants: Int = 50
    ) async throws -> PTTChannel {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        let channelId = UUID().uuidString
        let timestamp = Int(Date().timeIntervalSince1970)

        let channel = PTTChannel(
            channelId: channelId,
            groupId: groupId,
            name: name,
            createdBy: pubkey,
            maxParticipants: maxParticipants
        )

        // Store locally
        channels[channelId] = channel
        channelMembers[channelId] = []
        speakerQueues[channelId] = []

        // Publish channel creation event
        let createEvent: [String: Any] = [
            "channelId": channelId,
            "groupId": groupId as Any,
            "name": name,
            "createdBy": pubkey,
            "maxParticipants": maxParticipants,
            "timestamp": timestamp
        ]

        try await publishPTTEvent(
            kind: .channelCreate,
            content: createEvent,
            channelId: channelId
        )

        logger.info("Created PTT channel: \(name) (\(channelId))")

        return channel
    }

    /// Join a PTT channel
    /// - Parameters:
    ///   - channelId: The channel ID to join
    ///   - displayName: Optional display name
    public func joinChannel(
        _ channelId: String,
        displayName: String? = nil
    ) async throws {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        guard channels[channelId] != nil else {
            throw PTTChannelError.channelNotFound
        }

        // Check if already in this channel
        if channelMembers[channelId]?.contains(where: { $0.pubkey == pubkey }) == true {
            throw PTTChannelError.alreadyInChannel
        }

        // Check capacity
        if let members = channelMembers[channelId],
           let channel = channels[channelId],
           members.count >= channel.maxParticipants {
            throw PTTChannelError.channelFull
        }

        // Leave current channel if in one
        if let currentId = currentChannelId, currentId != channelId {
            try await leaveChannel(currentId)
        }

        let member = PTTMember(
            pubkey: pubkey,
            displayName: displayName
        )

        // Add to members
        var members = channelMembers[channelId] ?? []
        members.append(member)
        channelMembers[channelId] = members

        currentChannelId = channelId

        // Publish join event
        let joinEvent: [String: Any] = [
            "channelId": channelId,
            "pubkey": pubkey,
            "displayName": displayName as Any,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        try await publishPTTEvent(
            kind: .channelJoin,
            content: joinEvent,
            channelId: channelId
        )

        channelActivity.send((channelId: channelId, type: "join", pubkey: pubkey))

        logger.info("Joined PTT channel: \(channelId)")
    }

    /// Leave a PTT channel
    /// - Parameter channelId: The channel ID to leave
    public func leaveChannel(_ channelId: String) async throws {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        guard channelMembers[channelId]?.contains(where: { $0.pubkey == pubkey }) == true else {
            throw PTTChannelError.notInChannel
        }

        // Release speak if currently speaking
        if currentSpeakers[channelId]?.pubkey == pubkey {
            try await releaseSpeak(channelId)
        }

        // Remove from queue if queued
        removeFromQueue(channelId: channelId, pubkey: pubkey)

        // Remove from members
        channelMembers[channelId]?.removeAll { $0.pubkey == pubkey }

        if currentChannelId == channelId {
            currentChannelId = nil
        }

        // Publish leave event
        let leaveEvent: [String: Any] = [
            "channelId": channelId,
            "pubkey": pubkey,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        try await publishPTTEvent(
            kind: .channelLeave,
            content: leaveEvent,
            channelId: channelId
        )

        channelActivity.send((channelId: channelId, type: "leave", pubkey: pubkey))

        logger.info("Left PTT channel: \(channelId)")
    }

    // MARK: - Speaking Operations

    /// Request to speak in a channel
    /// - Parameters:
    ///   - channelId: The channel ID
    ///   - priority: Speaking priority (default normal)
    public func requestSpeak(
        _ channelId: String,
        priority: SpeakingPriority = .normal
    ) async throws {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        guard channelMembers[channelId]?.contains(where: { $0.pubkey == pubkey }) == true else {
            throw PTTChannelError.notInChannel
        }

        // Check if already speaking
        if currentSpeakers[channelId]?.pubkey == pubkey {
            throw PTTChannelError.alreadySpeaking
        }

        // Check if already in queue
        if speakerQueues[channelId]?.contains(where: { $0.pubkey == pubkey }) == true {
            throw PTTChannelError.speakRequestPending
        }

        let member = channelMembers[channelId]?.first { $0.pubkey == pubkey }
        let displayName = member?.displayName

        // If no one is speaking, grant immediately
        if currentSpeakers[channelId] == nil {
            await grantSpeak(channelId: channelId, pubkey: pubkey, displayName: displayName, priority: priority)

            // Publish speak grant event
            let grantEvent: [String: Any] = [
                "channelId": channelId,
                "pubkey": pubkey,
                "priority": priority.rawValue,
                "timestamp": Int(Date().timeIntervalSince1970)
            ]

            try await publishPTTEvent(
                kind: .speakGrant,
                content: grantEvent,
                channelId: channelId
            )

            speakGranted.send(channelId)
            logger.info("Speak granted immediately for \(pubkey.prefix(8)) in channel \(channelId)")
        } else {
            // Add to queue
            let entry = SpeakerQueueEntry(
                pubkey: pubkey,
                displayName: displayName,
                priority: priority
            )

            addToQueue(channelId: channelId, entry: entry)

            let position = speakerQueues[channelId]?.firstIndex(where: { $0.pubkey == pubkey }) ?? 0

            // Publish speak request event
            let requestEvent: [String: Any] = [
                "channelId": channelId,
                "pubkey": pubkey,
                "priority": priority.rawValue,
                "timestamp": Int(Date().timeIntervalSince1970)
            ]

            try await publishPTTEvent(
                kind: .speakRequest,
                content: requestEvent,
                channelId: channelId
            )

            speakQueued.send((channelId: channelId, position: position + 1))
            logger.info("Speak request queued at position \(position + 1) for \(pubkey.prefix(8))")
        }
    }

    /// Release speaking turn
    /// - Parameter channelId: The channel ID
    public func releaseSpeak(_ channelId: String) async throws {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        guard currentSpeakers[channelId]?.pubkey == pubkey else {
            throw PTTChannelError.notSpeaking
        }

        // Clear timeout timer
        cancelSpeakTimeout(channelId: channelId)

        // Clear current speaker
        currentSpeakers[channelId] = nil
        speakerChanged.send((channelId: channelId, speaker: nil))

        // Publish release event
        let releaseEvent: [String: Any] = [
            "channelId": channelId,
            "pubkey": pubkey,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        try await publishPTTEvent(
            kind: .speakRelease,
            content: releaseEvent,
            channelId: channelId
        )

        logger.info("Speak released by \(pubkey.prefix(8))")

        // Grant to next in queue
        await processQueue(channelId: channelId)
    }

    /// Cancel speak request (remove from queue)
    /// - Parameter channelId: The channel ID
    public func cancelSpeakRequest(_ channelId: String) async throws {
        guard let pubkey = await getLocalPubkey() else {
            throw PTTChannelError.noKeyPair
        }

        removeFromQueue(channelId: channelId, pubkey: pubkey)
        logger.info("Speak request cancelled for \(pubkey.prefix(8))")
    }

    // MARK: - Remote Event Handling

    /// Handle remote channel join event
    public func handleRemoteJoin(channelId: String, pubkey: String, displayName: String?) {
        guard channelMembers[channelId] != nil else { return }

        // Don't add if already present
        if channelMembers[channelId]?.contains(where: { $0.pubkey == pubkey }) == true {
            return
        }

        let member = PTTMember(
            pubkey: pubkey,
            displayName: displayName
        )

        channelMembers[channelId]?.append(member)
        channelActivity.send((channelId: channelId, type: "join", pubkey: pubkey))

        logger.info("Remote member joined: \(pubkey.prefix(8))")
    }

    /// Handle remote channel leave event
    public func handleRemoteLeave(channelId: String, pubkey: String) {
        channelMembers[channelId]?.removeAll { $0.pubkey == pubkey }

        // If they were speaking, clear and process queue
        if currentSpeakers[channelId]?.pubkey == pubkey {
            currentSpeakers[channelId] = nil
            speakerChanged.send((channelId: channelId, speaker: nil))

            Task {
                await processQueue(channelId: channelId)
            }
        }

        // Remove from queue
        removeFromQueue(channelId: channelId, pubkey: pubkey)

        channelActivity.send((channelId: channelId, type: "leave", pubkey: pubkey))

        logger.info("Remote member left: \(pubkey.prefix(8))")
    }

    /// Handle remote speak grant event
    public func handleRemoteSpeakGrant(channelId: String, pubkey: String, priority: SpeakingPriority) {
        let member = channelMembers[channelId]?.first { $0.pubkey == pubkey }

        let speaker = CurrentSpeaker(
            pubkey: pubkey,
            displayName: member?.displayName,
            priority: priority
        )

        currentSpeakers[channelId] = speaker
        speakerChanged.send((channelId: channelId, speaker: speaker))

        // Start timeout
        startSpeakTimeout(channelId: channelId)

        // Remove from queue
        removeFromQueue(channelId: channelId, pubkey: pubkey)

        logger.info("Remote speak granted to: \(pubkey.prefix(8))")
    }

    /// Handle remote speak release event
    public func handleRemoteSpeakRelease(channelId: String, pubkey: String) {
        guard currentSpeakers[channelId]?.pubkey == pubkey else { return }

        cancelSpeakTimeout(channelId: channelId)
        currentSpeakers[channelId] = nil
        speakerChanged.send((channelId: channelId, speaker: nil))

        logger.info("Remote speak released by: \(pubkey.prefix(8))")

        Task {
            await processQueue(channelId: channelId)
        }
    }

    /// Handle remote speak request (add to queue)
    public func handleRemoteSpeakRequest(channelId: String, pubkey: String, displayName: String?, priority: SpeakingPriority) {
        // Don't add if already in queue
        if speakerQueues[channelId]?.contains(where: { $0.pubkey == pubkey }) == true {
            return
        }

        let entry = SpeakerQueueEntry(
            pubkey: pubkey,
            displayName: displayName,
            priority: priority
        )

        addToQueue(channelId: channelId, entry: entry)

        logger.info("Remote speak request from: \(pubkey.prefix(8))")
    }

    /// Update audio level for current speaker
    public func updateSpeakerAudioLevel(channelId: String, level: Float) {
        guard var speaker = currentSpeakers[channelId] else { return }
        speaker.audioLevel = level
        currentSpeakers[channelId] = speaker
    }

    // MARK: - Query Methods

    /// Get queue position for local user
    public func getQueuePosition(channelId: String) async -> Int? {
        guard let pubkey = await getLocalPubkey() else { return nil }
        guard let index = speakerQueues[channelId]?.firstIndex(where: { $0.pubkey == pubkey }) else {
            return nil
        }
        return index + 1
    }

    /// Check if local user is currently speaking
    public func isSpeaking(channelId: String) async -> Bool {
        guard let pubkey = await getLocalPubkey() else { return false }
        return currentSpeakers[channelId]?.pubkey == pubkey
    }

    /// Check if local user is in queue
    public func isInQueue(channelId: String) async -> Bool {
        guard let pubkey = await getLocalPubkey() else { return false }
        return speakerQueues[channelId]?.contains(where: { $0.pubkey == pubkey }) == true
    }

    /// Get online members for a channel
    public func getOnlineMembers(channelId: String) -> [PTTMember] {
        channelMembers[channelId]?.filter { $0.isOnline } ?? []
    }

    /// Get offline members for a channel
    public func getOfflineMembers(channelId: String) -> [PTTMember] {
        channelMembers[channelId]?.filter { !$0.isOnline } ?? []
    }

    // MARK: - Private Methods

    private func getLocalPubkey() async -> String? {
        if let cached = localPubkey {
            return cached
        }
        localPubkey = await cryptoManager.getPublicKeyHex()
        return localPubkey
    }

    private func grantSpeak(channelId: String, pubkey: String, displayName: String?, priority: SpeakingPriority) async {
        let speaker = CurrentSpeaker(
            pubkey: pubkey,
            displayName: displayName,
            priority: priority
        )

        currentSpeakers[channelId] = speaker
        speakerChanged.send((channelId: channelId, speaker: speaker))

        // Start timeout
        startSpeakTimeout(channelId: channelId)
    }

    private func addToQueue(channelId: String, entry: SpeakerQueueEntry) {
        var queue = speakerQueues[channelId] ?? []

        // Find insertion point based on priority ordering
        // Moderator > High > Normal, then by request time (FIFO within same priority)
        let insertIndex = queue.firstIndex { existingEntry in
            // If new entry has higher priority, insert before
            if entry.priority > existingEntry.priority {
                return true
            }
            // If same priority, maintain FIFO (insert before those who requested later)
            if entry.priority == existingEntry.priority && entry.requestedAt < existingEntry.requestedAt {
                return true
            }
            return false
        }

        if let index = insertIndex {
            queue.insert(entry, at: index)
        } else {
            queue.append(entry)
        }

        speakerQueues[channelId] = queue
        queueUpdated.send((channelId: channelId, queue: queue))
    }

    private func removeFromQueue(channelId: String, pubkey: String) {
        speakerQueues[channelId]?.removeAll { $0.pubkey == pubkey }
        if let queue = speakerQueues[channelId] {
            queueUpdated.send((channelId: channelId, queue: queue))
        }
    }

    private func processQueue(channelId: String) async {
        // If someone is already speaking, don't process
        guard currentSpeakers[channelId] == nil else { return }

        // Get next in queue
        guard let nextEntry = speakerQueues[channelId]?.first else { return }

        // Grant speak to next in queue
        await grantSpeak(
            channelId: channelId,
            pubkey: nextEntry.pubkey,
            displayName: nextEntry.displayName,
            priority: nextEntry.priority
        )

        // Remove from queue
        removeFromQueue(channelId: channelId, pubkey: nextEntry.pubkey)

        // Publish speak grant
        let grantEvent: [String: Any] = [
            "channelId": channelId,
            "pubkey": nextEntry.pubkey,
            "priority": nextEntry.priority.rawValue,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        do {
            try await publishPTTEvent(
                kind: .speakGrant,
                content: grantEvent,
                channelId: channelId
            )
        } catch {
            logger.error("Failed to publish speak grant: \(error.localizedDescription)")
        }

        logger.info("Granted speak to next in queue: \(nextEntry.pubkey.prefix(8))")
    }

    private func startSpeakTimeout(channelId: String) {
        cancelSpeakTimeout(channelId: channelId)

        speakTimeoutTimers[channelId] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.speakTimeout ?? 30) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.handleSpeakTimeout(channelId: channelId)
        }
    }

    private func cancelSpeakTimeout(channelId: String) {
        speakTimeoutTimers[channelId]?.cancel()
        speakTimeoutTimers.removeValue(forKey: channelId)
    }

    private func handleSpeakTimeout(channelId: String) async {
        guard let speaker = currentSpeakers[channelId] else { return }

        logger.info("Speak timeout for \(speaker.pubkey.prefix(8))")

        // Auto-release
        currentSpeakers[channelId] = nil
        speakerChanged.send((channelId: channelId, speaker: nil))

        // Publish release event
        let releaseEvent: [String: Any] = [
            "channelId": channelId,
            "pubkey": speaker.pubkey,
            "reason": "timeout",
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        do {
            try await publishPTTEvent(
                kind: .speakRelease,
                content: releaseEvent,
                channelId: channelId
            )
        } catch {
            logger.error("Failed to publish timeout release: \(error.localizedDescription)")
        }

        // Process queue
        await processQueue(channelId: channelId)
    }

    private func publishPTTEvent(
        kind: PTTEventKind,
        content: [String: Any],
        channelId: String
    ) async throws {
        let encoder = JSONEncoder()
        let contentData = try JSONSerialization.data(withJSONObject: content)
        guard let contentString = String(data: contentData, encoding: .utf8) else {
            throw PTTChannelError.signalingFailed
        }

        let tags: [[String]] = [
            ["d", channelId],
            ["type", "ptt"]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: kind.rawValue) ?? .textNote,
            content: contentString,
            tags: tags
        )
    }

    // MARK: - Cleanup

    public func cleanup() {
        speakTimeoutTimers.values.forEach { $0.cancel() }
        speakTimeoutTimers.removeAll()

        channels.removeAll()
        channelMembers.removeAll()
        currentSpeakers.removeAll()
        speakerQueues.removeAll()
        currentChannelId = nil

        cancellables.removeAll()
    }
}
