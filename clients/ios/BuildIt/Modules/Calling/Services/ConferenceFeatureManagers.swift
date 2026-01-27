// ConferenceFeatureManagers.swift
// BuildIt - Conference Feature Managers
//
// Contains managers for conference features:
// - WaitingRoomManager: Waiting room for participants
// - HostControlsManager: Moderator controls
// - BreakoutRoomManager: Breakout rooms
// - HandRaiseManager: Hand raising queue
// - ReactionManager: Emoji reactions
// - PollManager: Polls with E2EE voting
// - ConferenceChatManager: In-meeting chat with E2EE

import Foundation
import Combine
import CryptoKit
import os.log

// MARK: - Waiting Room Manager

/// Waiting room participant
public struct WaitingParticipant: Identifiable {
    public let id: String // pubkey
    public let pubkey: String
    public var displayName: String?
    public let joinedAt: Date
}

/// Events for waiting room
public enum WaitingRoomEvent {
    case participantWaiting(WaitingParticipant)
    case participantAdmitted(String)
    case participantDenied(String, reason: String?)
    case queueUpdated([WaitingParticipant])
}

/// Waiting Room Manager
@MainActor
public class WaitingRoomManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "WaitingRoomManager")

    @Published public private(set) var isEnabled: Bool = true
    @Published public private(set) var waitingQueue: [WaitingParticipant] = []

    public let events = PassthroughSubject<WaitingRoomEvent, Never>()

    private let roomId: String
    private var onAdmit: ((String) async -> Void)?
    private var onDeny: ((String, String?) async -> Void)?

    public init(roomId: String) {
        self.roomId = roomId
    }

    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }

    public func setCallbacks(
        onAdmit: @escaping (String) async -> Void,
        onDeny: @escaping (String, String?) async -> Void
    ) {
        self.onAdmit = onAdmit
        self.onDeny = onDeny
    }

    public func addToWaitingRoom(pubkey: String, displayName: String?) {
        guard isEnabled else {
            events.send(.participantAdmitted(pubkey))
            return
        }

        let participant = WaitingParticipant(
            id: pubkey,
            pubkey: pubkey,
            displayName: displayName,
            joinedAt: Date()
        )

        waitingQueue.append(participant)
        events.send(.participantWaiting(participant))
        events.send(.queueUpdated(waitingQueue))

        logger.info("Added to waiting room: \(pubkey)")
    }

    public func admitParticipant(_ pubkey: String) async {
        guard let index = waitingQueue.firstIndex(where: { $0.pubkey == pubkey }) else {
            return
        }

        waitingQueue.remove(at: index)
        await onAdmit?(pubkey)
        events.send(.participantAdmitted(pubkey))
        events.send(.queueUpdated(waitingQueue))

        logger.info("Admitted: \(pubkey)")
    }

    public func denyParticipant(_ pubkey: String, reason: String? = nil) async {
        guard let index = waitingQueue.firstIndex(where: { $0.pubkey == pubkey }) else {
            return
        }

        waitingQueue.remove(at: index)
        await onDeny?(pubkey, reason)
        events.send(.participantDenied(pubkey, reason: reason))
        events.send(.queueUpdated(waitingQueue))

        logger.info("Denied: \(pubkey)")
    }

    public func admitAll() async {
        let pubkeys = waitingQueue.map(\.pubkey)
        for pubkey in pubkeys {
            await admitParticipant(pubkey)
        }
    }

    public func close() {
        waitingQueue.removeAll()
    }
}

// MARK: - Host Controls Manager

/// Participant role
public typealias ConferenceRole = ParticipantRole

/// Events for host controls
public enum HostControlEvent {
    case muteRequested(String)
    case muteAllRequested(exceptHosts: Bool)
    case audioLocked
    case audioUnlocked
    case participantRemoved(String)
    case roleChanged(String, ConferenceRole)
    case roomLocked
    case roomUnlocked
    case meetingEnded
}

/// Host Controls Manager
@MainActor
public class HostControlsManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "HostControlsManager")

    @Published public private(set) var localRole: ConferenceRole
    @Published public private(set) var isRoomLocked: Bool = false
    @Published public private(set) var isAudioLocked: Bool = false

    public let events = PassthroughSubject<HostControlEvent, Never>()

    private let roomId: String
    private let localPubkey: String
    private var participantRoles: [String: ConferenceRole] = [:]
    private var mutedParticipants: Set<String> = []
    private var onSendControl: ((String, String, [String: Any]?) async -> Void)?

    public init(roomId: String, localPubkey: String, isHost: Bool) {
        self.roomId = roomId
        self.localPubkey = localPubkey
        self.localRole = isHost ? .host : .participant
        self.participantRoles[localPubkey] = localRole
    }

    public func setOnSendControl(_ callback: @escaping (String, String, [String: Any]?) async -> Void) {
        self.onSendControl = callback
    }

    public var isHostOrCoHost: Bool {
        localRole == .host || localRole == .coHost
    }

    public var isModerator: Bool {
        [.host, .coHost, .moderator].contains(localRole)
    }

    public func getParticipantRole(_ pubkey: String) -> ConferenceRole {
        participantRoles[pubkey] ?? .participant
    }

    public func setParticipantRole(_ pubkey: String, role: ConferenceRole) {
        participantRoles[pubkey] = role
    }

    public func requestMute(_ pubkey: String) async throws {
        guard isModerator else { throw HostControlError.unauthorized }

        await onSendControl?(pubkey, "mute-request", ["roomId": roomId])
        events.send(.muteRequested(pubkey))
        logger.info("Mute requested: \(pubkey)")
    }

    public func forceMute(_ pubkey: String) async throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }

        mutedParticipants.insert(pubkey)
        await onSendControl?(pubkey, "force-mute", ["roomId": roomId])
        events.send(.muteRequested(pubkey))
        logger.info("Force muted: \(pubkey)")
    }

    public func muteAll(exceptHosts: Bool = true) async throws {
        guard isModerator else { throw HostControlError.unauthorized }

        for (pubkey, role) in participantRoles {
            if pubkey == localPubkey { continue }
            if exceptHosts && [.host, .coHost].contains(role) { continue }
            try await requestMute(pubkey)
        }

        events.send(.muteAllRequested(exceptHosts: exceptHosts))
    }

    public func lockAudio() throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        isAudioLocked = true
        events.send(.audioLocked)
    }

    public func unlockAudio() throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        isAudioLocked = false
        mutedParticipants.removeAll()
        events.send(.audioUnlocked)
    }

    public func canUnmute(_ pubkey: String) -> Bool {
        if isAudioLocked && ![.host, .coHost].contains(getParticipantRole(pubkey)) {
            return false
        }
        return !mutedParticipants.contains(pubkey)
    }

    public func removeParticipant(_ pubkey: String) async throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        guard getParticipantRole(pubkey) != .host else { throw HostControlError.cannotRemoveHost }

        await onSendControl?(pubkey, "remove", ["roomId": roomId])
        participantRoles.removeValue(forKey: pubkey)
        events.send(.participantRemoved(pubkey))
        logger.info("Removed: \(pubkey)")
    }

    public func promoteToCoHost(_ pubkey: String) async throws {
        guard localRole == .host else { throw HostControlError.hostOnly }

        participantRoles[pubkey] = .coHost
        await onSendControl?(pubkey, "role-change", ["roomId": roomId, "role": "co_host"])
        events.send(.roleChanged(pubkey, .coHost))
    }

    public func promoteToModerator(_ pubkey: String) async throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }

        participantRoles[pubkey] = .moderator
        await onSendControl?(pubkey, "role-change", ["roomId": roomId, "role": "moderator"])
        events.send(.roleChanged(pubkey, .moderator))
    }

    public func demoteToParticipant(_ pubkey: String) async throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        guard getParticipantRole(pubkey) != .host else { throw HostControlError.cannotDemoteHost }

        participantRoles[pubkey] = .participant
        await onSendControl?(pubkey, "role-change", ["roomId": roomId, "role": "participant"])
        events.send(.roleChanged(pubkey, .participant))
    }

    public func lockRoom() throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        isRoomLocked = true
        events.send(.roomLocked)
    }

    public func unlockRoom() throws {
        guard isHostOrCoHost else { throw HostControlError.unauthorized }
        isRoomLocked = false
        events.send(.roomUnlocked)
    }

    public func endMeetingForAll() async throws {
        guard localRole == .host else { throw HostControlError.hostOnly }

        for pubkey in participantRoles.keys {
            if pubkey != localPubkey {
                await onSendControl?(pubkey, "meeting-ended", ["roomId": roomId])
            }
        }

        events.send(.meetingEnded)
    }

    public func close() {
        participantRoles.removeAll()
        mutedParticipants.removeAll()
    }
}

public enum HostControlError: LocalizedError {
    case unauthorized
    case hostOnly
    case cannotRemoveHost
    case cannotDemoteHost

    public var errorDescription: String? {
        switch self {
        case .unauthorized: return "Unauthorized action"
        case .hostOnly: return "Only host can perform this action"
        case .cannotRemoveHost: return "Cannot remove the host"
        case .cannotDemoteHost: return "Cannot demote the host"
        }
    }
}

// MARK: - Hand Raise Manager

public struct RaisedHand: Identifiable {
    public let id: String // pubkey
    public let pubkey: String
    public let raisedAt: Date
    public let position: Int
}

public enum HandRaiseEvent {
    case handRaised(RaisedHand)
    case handLowered(String)
    case queueUpdated([RaisedHand])
}

@MainActor
public class HandRaiseManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "HandRaiseManager")

    @Published public private(set) var raisedHands: [RaisedHand] = []

    public let events = PassthroughSubject<HandRaiseEvent, Never>()

    private let roomId: String
    private var handsMap: [String: Date] = [:]
    private var onSendHandRaise: ((String, String) async -> Void)?

    public init(roomId: String) {
        self.roomId = roomId
    }

    public func setOnSendHandRaise(_ callback: @escaping (String, String) async -> Void) {
        self.onSendHandRaise = callback
    }

    public func raiseHand(_ pubkey: String) async {
        guard handsMap[pubkey] == nil else { return }

        handsMap[pubkey] = Date()
        updateQueue()

        await onSendHandRaise?(pubkey, "raise")

        if let hand = raisedHands.first(where: { $0.pubkey == pubkey }) {
            events.send(.handRaised(hand))
        }
        events.send(.queueUpdated(raisedHands))

        logger.info("Hand raised: \(pubkey)")
    }

    public func lowerHand(_ pubkey: String) async {
        guard handsMap[pubkey] != nil else { return }

        handsMap.removeValue(forKey: pubkey)
        updateQueue()

        await onSendHandRaise?(pubkey, "lower")

        events.send(.handLowered(pubkey))
        events.send(.queueUpdated(raisedHands))

        logger.info("Hand lowered: \(pubkey)")
    }

    public func handleRemoteHandRaise(_ pubkey: String, action: String) {
        if action == "raise" {
            if handsMap[pubkey] == nil {
                handsMap[pubkey] = Date()
                updateQueue()
                if let hand = raisedHands.first(where: { $0.pubkey == pubkey }) {
                    events.send(.handRaised(hand))
                }
            }
        } else {
            if handsMap[pubkey] != nil {
                handsMap.removeValue(forKey: pubkey)
                updateQueue()
                events.send(.handLowered(pubkey))
            }
        }
        events.send(.queueUpdated(raisedHands))
    }

    public func lowerAllHands() async {
        let pubkeys = Array(handsMap.keys)
        for pubkey in pubkeys {
            await lowerHand(pubkey)
        }
    }

    public func isHandRaised(_ pubkey: String) -> Bool {
        handsMap[pubkey] != nil
    }

    public func getPosition(_ pubkey: String) -> Int? {
        raisedHands.first(where: { $0.pubkey == pubkey })?.position
    }

    private func updateQueue() {
        raisedHands = handsMap
            .sorted { $0.value < $1.value }
            .enumerated()
            .map { index, item in
                RaisedHand(
                    id: item.key,
                    pubkey: item.key,
                    raisedAt: item.value,
                    position: index + 1
                )
            }
    }

    public func close() {
        handsMap.removeAll()
        raisedHands.removeAll()
    }
}

// MARK: - Reaction Manager

public let supportedReactions = ["👍", "👎", "❤️", "😂", "😮", "🎉", "👏", "✋"]

public struct ReactionEvent: Identifiable {
    public let id: String
    public let pubkey: String
    public let emoji: String
    public let timestamp: Date
}

public enum ReactionManagerEvent {
    case reactionReceived(ReactionEvent)
    case reactionExpired(String)
    case reactionsUpdated([ReactionEvent])
}

@MainActor
public class ReactionManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "ReactionManager")

    @Published public private(set) var activeReactions: [ReactionEvent] = []

    public let events = PassthroughSubject<ReactionManagerEvent, Never>()

    private let roomId: String
    private var reactionCounter = 0
    private var expirationTasks: [String: Task<Void, Never>] = [:]
    private var onSendReaction: ((String) async -> Void)?

    private let displayDuration: TimeInterval = 5.0

    public init(roomId: String) {
        self.roomId = roomId
    }

    public func setOnSendReaction(_ callback: @escaping (String) async -> Void) {
        self.onSendReaction = callback
    }

    public func sendReaction(_ pubkey: String, emoji: String) async {
        guard supportedReactions.contains(emoji) else { return }

        let reaction = createReaction(pubkey: pubkey, emoji: emoji)
        addReaction(reaction)

        await onSendReaction?(emoji)

        logger.debug("Reaction sent: \(emoji)")
    }

    public func handleRemoteReaction(_ pubkey: String, emoji: String) {
        guard supportedReactions.contains(emoji) else { return }

        let reaction = createReaction(pubkey: pubkey, emoji: emoji)
        addReaction(reaction)

        logger.debug("Remote reaction: \(emoji)")
    }

    private func createReaction(pubkey: String, emoji: String) -> ReactionEvent {
        reactionCounter += 1
        return ReactionEvent(
            id: "\(pubkey)-\(reactionCounter)",
            pubkey: pubkey,
            emoji: emoji,
            timestamp: Date()
        )
    }

    private func addReaction(_ reaction: ReactionEvent) {
        activeReactions.append(reaction)
        events.send(.reactionReceived(reaction))
        events.send(.reactionsUpdated(activeReactions))

        // Schedule expiration
        let task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(displayDuration * 1_000_000_000))
            await self?.removeReaction(reaction.id)
        }
        expirationTasks[reaction.id] = task
    }

    private func removeReaction(_ id: String) {
        activeReactions.removeAll { $0.id == id }
        expirationTasks[id]?.cancel()
        expirationTasks.removeValue(forKey: id)

        events.send(.reactionExpired(id))
        events.send(.reactionsUpdated(activeReactions))
    }

    public func getReactionCounts() -> [String: Int] {
        var counts: [String: Int] = [:]
        for emoji in supportedReactions {
            counts[emoji] = activeReactions.filter { $0.emoji == emoji }.count
        }
        return counts
    }

    public func close() {
        for task in expirationTasks.values {
            task.cancel()
        }
        expirationTasks.removeAll()
        activeReactions.removeAll()
    }
}

// MARK: - Poll Manager

public struct PollOption: Identifiable, Codable {
    public let id: String
    public let text: String
}

public struct PollSettings: Codable {
    public var anonymous: Bool = true
    public var multiSelect: Bool = false
    public var showLiveResults: Bool = true
    public var allowChangeVote: Bool = false
}

public struct Poll: Identifiable {
    public let id: String
    public let roomId: String
    public let creatorPubkey: String
    public let question: String
    public let options: [PollOption]
    public let settings: PollSettings
    public var status: PollStatus
    public let createdAt: Date
    public var closedAt: Date?
}

public enum PollStatus: String, Codable {
    case draft
    case active
    case closed
}

public struct PollResults {
    public let pollId: String
    public let totalVotes: Int
    public let optionCounts: [String: Int]
    public let percentages: [String: Double]
}

public struct PollVote: Codable {
    public let pollId: String
    public let voterToken: String // Anonymous HMAC token
    public let selectedOptions: [String]
    public let timestamp: Date
}

public enum PollManagerEvent {
    case pollCreated(Poll)
    case pollLaunched(Poll)
    case pollClosed(Poll, PollResults)
    case voteReceived(String, Int)
    case resultsUpdated(String, PollResults)
}

@MainActor
public class PollManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "PollManager")

    @Published public private(set) var polls: [Poll] = []

    public let events = PassthroughSubject<PollManagerEvent, Never>()

    private let roomId: String
    private let localPubkey: String
    private var votes: [String: [String: PollVote]] = [:] // pollId -> voterToken -> vote
    private var localVotes: [String: [String]] = [:] // pollId -> selectedOptions

    private var onSendPoll: ((Poll) async -> Void)?
    private var onSendVote: ((PollVote) async -> Void)?
    private var onClosePoll: ((String, PollResults) async -> Void)?

    public init(roomId: String, localPubkey: String) {
        self.roomId = roomId
        self.localPubkey = localPubkey
    }

    public func setCallbacks(
        onSendPoll: @escaping (Poll) async -> Void,
        onSendVote: @escaping (PollVote) async -> Void,
        onClosePoll: @escaping (String, PollResults) async -> Void
    ) {
        self.onSendPoll = onSendPoll
        self.onSendVote = onSendVote
        self.onClosePoll = onClosePoll
    }

    public func createPoll(question: String, options: [String], settings: PollSettings = PollSettings()) -> Poll {
        let poll = Poll(
            id: UUID().uuidString,
            roomId: roomId,
            creatorPubkey: localPubkey,
            question: question,
            options: options.map { PollOption(id: UUID().uuidString, text: $0) },
            settings: settings,
            status: .draft,
            createdAt: Date()
        )

        polls.append(poll)
        votes[poll.id] = [:]
        events.send(.pollCreated(poll))

        logger.info("Poll created: \(poll.id)")
        return poll
    }

    public func launchPoll(_ pollId: String) async throws {
        guard let index = polls.firstIndex(where: { $0.id == pollId }) else {
            throw PollError.pollNotFound
        }
        guard polls[index].status == .draft else {
            throw PollError.pollAlreadyLaunched
        }

        polls[index].status = .active
        await onSendPoll?(polls[index])
        events.send(.pollLaunched(polls[index]))

        logger.info("Poll launched: \(pollId)")
    }

    public func vote(_ pollId: String, selectedOptions: [String]) async throws {
        guard let poll = polls.first(where: { $0.id == pollId }) else {
            throw PollError.pollNotFound
        }
        guard poll.status == .active else {
            throw PollError.pollNotActive
        }

        // Validate options
        let validOptions = Set(poll.options.map(\.id))
        for optionId in selectedOptions {
            guard validOptions.contains(optionId) else {
                throw PollError.invalidOption
            }
        }

        // Check multi-select
        if !poll.settings.multiSelect && selectedOptions.count > 1 {
            throw PollError.multiSelectNotAllowed
        }

        // Check if already voted
        if localVotes[pollId] != nil && !poll.settings.allowChangeVote {
            throw PollError.alreadyVoted
        }

        // Generate anonymous voter token
        let voterToken = generateVoterToken(pollId: pollId)

        let vote = PollVote(
            pollId: pollId,
            voterToken: voterToken,
            selectedOptions: selectedOptions,
            timestamp: Date()
        )

        votes[pollId]?[voterToken] = vote
        localVotes[pollId] = selectedOptions

        await onSendVote?(vote)

        let results = calculateResults(pollId)
        events.send(.voteReceived(pollId, results.totalVotes))

        if poll.settings.showLiveResults {
            events.send(.resultsUpdated(pollId, results))
        }

        logger.info("Vote submitted for poll: \(pollId)")
    }

    public func handleRemoteVote(_ vote: PollVote) {
        guard let poll = polls.first(where: { $0.id == vote.pollId }) else { return }

        votes[vote.pollId]?[vote.voterToken] = vote

        let results = calculateResults(vote.pollId)
        events.send(.voteReceived(vote.pollId, results.totalVotes))

        if poll.settings.showLiveResults {
            events.send(.resultsUpdated(vote.pollId, results))
        }
    }

    public func closePoll(_ pollId: String) async throws -> PollResults {
        guard let index = polls.firstIndex(where: { $0.id == pollId }) else {
            throw PollError.pollNotFound
        }
        guard polls[index].status != .closed else {
            throw PollError.pollAlreadyClosed
        }

        polls[index].status = .closed
        polls[index].closedAt = Date()

        let results = calculateResults(pollId)
        await onClosePoll?(pollId, results)
        events.send(.pollClosed(polls[index], results))

        logger.info("Poll closed: \(pollId)")
        return results
    }

    public func calculateResults(_ pollId: String) -> PollResults {
        guard let poll = polls.first(where: { $0.id == pollId }),
              let pollVotes = votes[pollId] else {
            return PollResults(pollId: pollId, totalVotes: 0, optionCounts: [:], percentages: [:])
        }

        var optionCounts: [String: Int] = [:]
        for option in poll.options {
            optionCounts[option.id] = 0
        }

        for vote in pollVotes.values {
            for optionId in vote.selectedOptions {
                optionCounts[optionId, default: 0] += 1
            }
        }

        let totalVotes = pollVotes.count
        var percentages: [String: Double] = [:]
        for (optionId, count) in optionCounts {
            percentages[optionId] = totalVotes > 0 ? Double(count) / Double(totalVotes) * 100 : 0
        }

        return PollResults(
            pollId: pollId,
            totalVotes: totalVotes,
            optionCounts: optionCounts,
            percentages: percentages
        )
    }

    public func getMyVote(_ pollId: String) -> [String]? {
        localVotes[pollId]
    }

    public func hasVoted(_ pollId: String) -> Bool {
        localVotes[pollId] != nil
    }

    private func generateVoterToken(pollId: String) -> String {
        // HMAC(roomId + pollId, pubkey) for anonymous voting
        let data = "\(roomId):\(pollId):\(localPubkey)".data(using: .utf8)!
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    public func close() {
        polls.removeAll()
        votes.removeAll()
        localVotes.removeAll()
    }
}

public enum PollError: LocalizedError {
    case pollNotFound
    case pollAlreadyLaunched
    case pollNotActive
    case pollAlreadyClosed
    case invalidOption
    case multiSelectNotAllowed
    case alreadyVoted

    public var errorDescription: String? {
        switch self {
        case .pollNotFound: return "Poll not found"
        case .pollAlreadyLaunched: return "Poll already launched"
        case .pollNotActive: return "Poll is not active"
        case .pollAlreadyClosed: return "Poll already closed"
        case .invalidOption: return "Invalid option selected"
        case .multiSelectNotAllowed: return "Multiple selection not allowed"
        case .alreadyVoted: return "Already voted"
        }
    }
}

// MARK: - Breakout Room Manager

public struct BreakoutRoom: Identifiable {
    public let id: String
    public let name: String
    public var participants: [String]
    public var capacity: Int?
    public var mlsGroupId: String?
}

public struct BreakoutState {
    public var isOpen: Bool = false
    public var duration: TimeInterval?
    public var openedAt: Date?
    public var warningIssued: Bool = false
}

public enum BreakoutRoomEvent {
    case roomsCreated([BreakoutRoom])
    case participantAssigned(String, String)
    case breakoutsOpened(TimeInterval?)
    case breakoutsClosed
    case timerWarning(Int)
    case helpRequested(String, String)
    case broadcastSent(String)
}

@MainActor
public class BreakoutRoomManager: ObservableObject {
    private let logger = Logger(subsystem: "com.buildit", category: "BreakoutRoomManager")

    @Published public private(set) var rooms: [BreakoutRoom] = []
    @Published public private(set) var state: BreakoutState = BreakoutState()

    public let events = PassthroughSubject<BreakoutRoomEvent, Never>()

    private let mainRoomId: String
    private var participantAssignments: [String: String] = [:] // pubkey -> breakoutId
    private var timerTask: Task<Void, Never>?
    private var onSendToBreakout: ((String, String, [String: Any]?) async -> Void)?
    private var onBroadcastAll: ((String) async -> Void)?

    private let warningThreshold = 60 // seconds

    public init(mainRoomId: String) {
        self.mainRoomId = mainRoomId
    }

    public func setCallbacks(
        onSendToBreakout: @escaping (String, String, [String: Any]?) async -> Void,
        onBroadcastAll: @escaping (String) async -> Void
    ) {
        self.onSendToBreakout = onSendToBreakout
        self.onBroadcastAll = onBroadcastAll
    }

    public func createBreakoutRooms(count: Int, names: [String]? = nil) -> [BreakoutRoom] {
        var newRooms: [BreakoutRoom] = []

        for i in 0..<count {
            let room = BreakoutRoom(
                id: UUID().uuidString,
                name: names?[safe: i] ?? "Breakout \(i + 1)",
                participants: []
            )
            newRooms.append(room)
        }

        rooms = newRooms
        events.send(.roomsCreated(newRooms))

        logger.info("Created \(count) breakout rooms")
        return newRooms
    }

    public func assignParticipant(_ pubkey: String, to breakoutId: String) {
        // Remove from previous assignment
        if let previousId = participantAssignments[pubkey],
           let previousIndex = rooms.firstIndex(where: { $0.id == previousId }) {
            rooms[previousIndex].participants.removeAll { $0 == pubkey }
        }

        // Add to new room
        if let index = rooms.firstIndex(where: { $0.id == breakoutId }) {
            rooms[index].participants.append(pubkey)
            participantAssignments[pubkey] = breakoutId

            events.send(.participantAssigned(pubkey, breakoutId))
            logger.info("Assigned \(pubkey) to breakout \(breakoutId)")
        }
    }

    public func autoAssign(_ participants: [String], mode: AutoAssignMode = .random) {
        guard !rooms.isEmpty else { return }

        var sorted = participants
        if mode == .random {
            sorted.shuffle()
        } else {
            sorted.sort()
        }

        for (index, pubkey) in sorted.enumerated() {
            let roomIndex = index % rooms.count
            assignParticipant(pubkey, to: rooms[roomIndex].id)
        }

        logger.info("Auto-assigned \(participants.count) participants")
    }

    public func openBreakouts(duration: TimeInterval? = nil) {
        state = BreakoutState(
            isOpen: true,
            duration: duration,
            openedAt: Date(),
            warningIssued: false
        )

        if let duration = duration {
            startTimer(duration: duration)
        }

        events.send(.breakoutsOpened(duration))
        logger.info("Breakouts opened")
    }

    public func closeBreakouts() async {
        stopTimer()
        state = BreakoutState(isOpen: false)

        for room in rooms {
            await onSendToBreakout?(room.id, "return-to-main", ["mainRoomId": mainRoomId])
        }

        events.send(.breakoutsClosed)
        logger.info("Breakouts closed")
    }

    public func getRemainingTime() -> TimeInterval? {
        guard state.isOpen, let duration = state.duration, let openedAt = state.openedAt else {
            return nil
        }
        return max(0, duration - Date().timeIntervalSince(openedAt))
    }

    public func requestHelp(_ pubkey: String) {
        guard let breakoutId = participantAssignments[pubkey] else { return }
        events.send(.helpRequested(pubkey, breakoutId))
        logger.info("Help requested from \(pubkey)")
    }

    public func broadcastToAll(_ message: String) async {
        await onBroadcastAll?(message)

        for room in rooms {
            await onSendToBreakout?(room.id, "broadcast", ["message": message])
        }

        events.send(.broadcastSent(message))
        logger.info("Broadcast sent")
    }

    private func startTimer(duration: TimeInterval) {
        stopTimer()

        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)

                guard let self = self else { return }

                await MainActor.run {
                    guard let remaining = self.getRemainingTime() else { return }

                    if !self.state.warningIssued && remaining <= TimeInterval(self.warningThreshold) {
                        self.state.warningIssued = true
                        self.events.send(.timerWarning(Int(remaining)))

                        Task {
                            await self.broadcastToAll("Breakouts closing in \(Int(remaining)) seconds")
                        }
                    }

                    if remaining <= 0 {
                        Task {
                            await self.closeBreakouts()
                        }
                    }
                }
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }

    public func getParticipantBreakout(_ pubkey: String) -> String? {
        participantAssignments[pubkey]
    }

    public func close() {
        stopTimer()
        rooms.removeAll()
        participantAssignments.removeAll()
        state = BreakoutState()
    }

    public enum AutoAssignMode {
        case random
        case alphabetical
    }
}

// MARK: - Helper Extensions

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
