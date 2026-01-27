// MessagingQueueManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Thread management for text-based hotline intake.
// Handles thread lifecycle, assignment, and message flow.

import Foundation
import Combine
import os.log

/// Thread message for messaging hotline conversations
public struct ThreadMessage: Codable, Sendable, Identifiable {
    public let id: String
    public let threadId: String
    public let content: String
    public let senderPubkey: String
    public let senderType: MessageSenderType
    public let timestamp: Int
    public var read: Bool
    public var metadata: [String: String]?

    public init(
        id: String = UUID().uuidString,
        threadId: String,
        content: String,
        senderPubkey: String,
        senderType: MessageSenderType,
        timestamp: Int = Int(Date().timeIntervalSince1970),
        read: Bool = false,
        metadata: [String: String]? = nil
    ) {
        self.id = id
        self.threadId = threadId
        self.content = content
        self.senderPubkey = senderPubkey
        self.senderType = senderType
        self.timestamp = timestamp
        self.read = read
        self.metadata = metadata
    }
}

/// Type of message sender
public enum MessageSenderType: String, Codable, Sendable {
    case caller
    case `operator`
    case system
}

/// Extended messaging thread with local state
public struct MessagingThread: Sendable {
    public var thread: MessagingHotlineThread
    public var messages: [ThreadMessage]
    public var unreadCount: Int
    public var lastMessage: ThreadMessage?
    public var lastActivityAt: Int
    public var waitTime: Int
    public var responseTime: Int?
    public var callerName: String?
    public var callerPhone: String?
    public var notes: String?

    public var threadId: String { thread.threadID }
    public var status: MessagingHotlineThreadStatus { thread.status }
    public var priority: HotlineCallStatePriority { thread.priority ?? .medium }
    public var assignedTo: String? { thread.assignedOperator }
    public var createdAt: Int { thread.createdAt }

    public init(
        thread: MessagingHotlineThread,
        messages: [ThreadMessage] = [],
        unreadCount: Int = 0,
        lastMessage: ThreadMessage? = nil,
        lastActivityAt: Int = 0,
        waitTime: Int = 0,
        responseTime: Int? = nil,
        callerName: String? = nil,
        callerPhone: String? = nil,
        notes: String? = nil
    ) {
        self.thread = thread
        self.messages = messages
        self.unreadCount = unreadCount
        self.lastMessage = lastMessage
        self.lastActivityAt = lastActivityAt
        self.waitTime = waitTime
        self.responseTime = responseTime
        self.callerName = callerName
        self.callerPhone = callerPhone
        self.notes = notes
    }
}

/// Filter options for thread queries
public struct ThreadFilter: Sendable {
    public var status: [MessagingHotlineThreadStatus]?
    public var assignedTo: String?
    public var priority: [HotlineCallStatePriority]?
    public var contactType: [TypeEnum]?
    public var hotlineId: String?
    public var unassigned: Bool?
    public var unread: Bool?

    public init(
        status: [MessagingHotlineThreadStatus]? = nil,
        assignedTo: String? = nil,
        priority: [HotlineCallStatePriority]? = nil,
        contactType: [TypeEnum]? = nil,
        hotlineId: String? = nil,
        unassigned: Bool? = nil,
        unread: Bool? = nil
    ) {
        self.status = status
        self.assignedTo = assignedTo
        self.priority = priority
        self.contactType = contactType
        self.hotlineId = hotlineId
        self.unassigned = unassigned
        self.unread = unread
    }
}

/// Queue statistics
public struct ThreadStats: Sendable {
    public let total: Int
    public let unassigned: Int
    public let myThreads: Int
    public let waiting: Int
    public let active: Int
    public let avgResponseTime: Double
    public let avgResolutionTime: Double
}

/// Thread event for observation
public enum ThreadEvent: Sendable {
    case created(MessagingThread)
    case claimed(MessagingThread)
    case assigned(MessagingThread)
    case transferred(from: String?, to: String, thread: MessagingThread)
    case updated(MessagingThread)
    case resolved(MessagingThread)
    case archived(MessagingThread)
    case messageAdded(thread: MessagingThread, message: ThreadMessage)
    case queueUpdated(ThreadStats)
}

/// Manager for messaging hotline queue
@MainActor
public class MessagingQueueManager: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var threads: [String: MessagingThread] = [:]
    @Published public private(set) var stats: ThreadStats = ThreadStats(
        total: 0, unassigned: 0, myThreads: 0, waiting: 0,
        active: 0, avgResponseTime: 0, avgResolutionTime: 0
    )
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Properties

    private var operatorPubkey: String = ""
    private var hotlineId: String = ""
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "MessagingQueueManager")

    /// Event stream for thread changes
    public let eventSubject = PassthroughSubject<ThreadEvent, Never>()

    // Priority weight for sorting
    private let priorityWeight: [HotlineCallStatePriority: Int] = [
        .urgent: 4,
        .high: 3,
        .medium: 2,
        .low: 1
    ]

    // MARK: - Initialization

    public init() {
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
    }

    /// Initialize the manager with operator context
    public func initialize(operatorPubkey: String, hotlineId: String) {
        self.operatorPubkey = operatorPubkey
        self.hotlineId = hotlineId
        logger.info("Initialized MessagingQueueManager for hotline: \(hotlineId)")
    }

    // MARK: - Thread Creation

    /// Create a new incoming thread
    public func createThread(
        callerPubkey: String,
        callerName: String? = nil,
        callerPhone: String? = nil,
        contactType: TypeEnum,
        initialMessage: String,
        priority: HotlineCallStatePriority = .medium,
        category: String? = nil,
        metadata: [String: String]? = nil
    ) async throws -> MessagingThread {
        let threadId = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        // Create initial message
        let initialMsg = ThreadMessage(
            id: UUID().uuidString,
            threadId: threadId,
            content: initialMessage,
            senderPubkey: callerPubkey,
            senderType: .caller,
            timestamp: now,
            read: false,
            metadata: metadata
        )

        // Create contact info
        let contact = Contact(
            name: callerName,
            phone: callerPhone,
            pubkey: callerPubkey,
            type: contactType
        )

        // Create the protocol thread
        let hotlineThread = MessagingHotlineThread(
            v: CallingSchema.version,
            assignedOperator: nil,
            category: category,
            contact: contact,
            createdAt: now,
            groupID: nil,
            hotlineID: hotlineId,
            lastMessageAt: now,
            lastMessageBy: .contact,
            linkedCallID: nil,
            messageCount: 1,
            priority: priority,
            resolvedAt: nil,
            status: .unassigned,
            threadID: threadId,
            unreadByOperator: 1
        )

        // Create local thread state
        var thread = MessagingThread(
            thread: hotlineThread,
            messages: [initialMsg],
            unreadCount: 1,
            lastMessage: initialMsg,
            lastActivityAt: now,
            waitTime: 0,
            callerName: callerName,
            callerPhone: callerPhone
        )

        threads[threadId] = thread

        eventSubject.send(.created(thread))
        updateStats()

        logger.info("Created thread: \(threadId)")
        return thread
    }

    // MARK: - Thread Assignment

    /// Claim a thread as the current operator
    public func claimThread(_ threadId: String) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        guard thread.status == .unassigned else {
            throw MessagingQueueError.threadAlreadyAssigned
        }

        let now = Int(Date().timeIntervalSince1970)

        // Update thread status
        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: operatorPubkey,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: now,
            lastMessageBy: .lastMessageByOperator,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: nil,
            status: .active,
            threadID: thread.thread.threadID,
            unreadByOperator: 0
        )

        thread.responseTime = now - thread.createdAt
        thread.lastActivityAt = now

        // Add system message
        addSystemMessage(to: &thread, content: "Thread claimed by operator")

        threads[threadId] = thread

        eventSubject.send(.claimed(thread))
        updateStats()

        logger.info("Claimed thread: \(threadId)")
        return thread
    }

    /// Assign thread to a specific operator
    public func assignThread(_ threadId: String, to operatorPubkey: String? = nil) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let now = Int(Date().timeIntervalSince1970)
        let targetOperator = operatorPubkey ?? self.operatorPubkey

        // Update thread
        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: targetOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: now,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: nil,
            status: .assigned,
            threadID: thread.thread.threadID,
            unreadByOperator: thread.thread.unreadByOperator
        )

        thread.lastActivityAt = now

        addSystemMessage(to: &thread, content: "Thread assigned to operator")

        threads[threadId] = thread

        eventSubject.send(.assigned(thread))
        updateStats()

        logger.info("Assigned thread: \(threadId) to \(targetOperator.prefix(8))")
        return thread
    }

    /// Transfer thread to another operator
    public func transferThread(
        _ threadId: String,
        to targetOperatorPubkey: String,
        reason: String? = nil
    ) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let previousOperator = thread.assignedTo
        let now = Int(Date().timeIntervalSince1970)

        // Update thread
        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: targetOperatorPubkey,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: now,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: nil,
            status: .assigned,
            threadID: thread.thread.threadID,
            unreadByOperator: thread.thread.unreadByOperator
        )

        thread.lastActivityAt = now

        let message = reason.map { "Thread transferred: \($0)" } ?? "Thread transferred to another operator"
        addSystemMessage(to: &thread, content: message)

        threads[threadId] = thread

        eventSubject.send(.transferred(from: previousOperator, to: targetOperatorPubkey, thread: thread))
        updateStats()

        logger.info("Transferred thread: \(threadId) to \(targetOperatorPubkey.prefix(8))")
        return thread
    }

    // MARK: - Thread Status

    /// Mark thread as waiting for caller response
    public func setWaiting(_ threadId: String) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = updateThreadStatus(thread.thread, status: .waiting, timestamp: now)
        thread.lastActivityAt = now

        threads[threadId] = thread

        eventSubject.send(.updated(thread))
        updateStats()

        return thread
    }

    /// Resume an active thread
    public func setActive(_ threadId: String) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = updateThreadStatus(thread.thread, status: .active, timestamp: now)
        thread.lastActivityAt = now

        threads[threadId] = thread

        eventSubject.send(.updated(thread))
        updateStats()

        return thread
    }

    /// Resolve a thread
    public func resolveThread(_ threadId: String, summary: String? = nil) async throws -> MessagingThread {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: now,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: now,
            status: .resolved,
            threadID: thread.thread.threadID,
            unreadByOperator: 0
        )

        thread.lastActivityAt = now
        if let summary = summary {
            thread.notes = summary
        }

        addSystemMessage(to: &thread, content: "Thread resolved")

        threads[threadId] = thread

        eventSubject.send(.resolved(thread))
        updateStats()

        logger.info("Resolved thread: \(threadId)")
        return thread
    }

    /// Archive a resolved thread
    public func archiveThread(_ threadId: String) async throws {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        guard thread.status == .resolved else {
            throw MessagingQueueError.canOnlyArchiveResolved
        }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = updateThreadStatus(thread.thread, status: .archived, timestamp: now)
        thread.lastActivityAt = now

        threads[threadId] = thread

        eventSubject.send(.archived(thread))
        updateStats()

        logger.info("Archived thread: \(threadId)")
    }

    // MARK: - Messages

    /// Add a message to a thread
    public func addMessage(
        to threadId: String,
        content: String,
        senderType: MessageSenderType = .operator
    ) async throws -> ThreadMessage {
        guard var thread = threads[threadId] else {
            throw MessagingQueueError.threadNotFound
        }

        let now = Int(Date().timeIntervalSince1970)
        let senderPubkey = senderType == .operator
            ? operatorPubkey
            : (thread.thread.contact?.pubkey ?? "")

        let message = ThreadMessage(
            id: UUID().uuidString,
            threadId: threadId,
            content: content,
            senderPubkey: senderPubkey,
            senderType: senderType,
            timestamp: now,
            read: senderType == .operator
        )

        thread.messages.append(message)
        thread.lastMessage = message
        thread.lastActivityAt = now

        // Update thread protocol state
        let newMessageCount = (thread.thread.messageCount ?? 0) + 1
        let lastBy: LastMessageBy = senderType == .caller ? .contact : .lastMessageByOperator
        let unread = senderType == .caller ? (thread.thread.unreadByOperator ?? 0) + 1 : thread.thread.unreadByOperator

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: now,
            lastMessageBy: lastBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: newMessageCount,
            priority: thread.thread.priority,
            resolvedAt: thread.thread.resolvedAt,
            status: thread.thread.status,
            threadID: thread.thread.threadID,
            unreadByOperator: unread
        )

        if senderType == .caller {
            thread.unreadCount += 1
            // Auto-reactivate if waiting
            if thread.status == .waiting {
                thread.thread = updateThreadStatus(thread.thread, status: .active, timestamp: now)
            }
        }

        threads[threadId] = thread

        eventSubject.send(.messageAdded(thread: thread, message: message))

        return message
    }

    /// Mark messages as read
    public func markAsRead(_ threadId: String) {
        guard var thread = threads[threadId] else { return }

        for i in thread.messages.indices {
            if !thread.messages[i].read && thread.messages[i].senderType == .caller {
                thread.messages[i].read = true
            }
        }
        thread.unreadCount = 0

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: thread.thread.lastMessageAt,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: thread.thread.resolvedAt,
            status: thread.thread.status,
            threadID: thread.thread.threadID,
            unreadByOperator: 0
        )

        threads[threadId] = thread
        eventSubject.send(.updated(thread))
    }

    // MARK: - Thread Properties

    /// Update thread priority
    public func setPriority(_ threadId: String, priority: HotlineCallStatePriority) {
        guard var thread = threads[threadId] else { return }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: thread.thread.lastMessageAt,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: priority,
            resolvedAt: thread.thread.resolvedAt,
            status: thread.thread.status,
            threadID: thread.thread.threadID,
            unreadByOperator: thread.thread.unreadByOperator
        )

        thread.lastActivityAt = now
        threads[threadId] = thread

        eventSubject.send(.updated(thread))
        updateStats()
    }

    /// Update thread category
    public func setCategory(_ threadId: String, category: String) {
        guard var thread = threads[threadId] else { return }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: thread.thread.lastMessageAt,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: thread.thread.linkedCallID,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: thread.thread.resolvedAt,
            status: thread.thread.status,
            threadID: thread.thread.threadID,
            unreadByOperator: thread.thread.unreadByOperator
        )

        thread.lastActivityAt = now
        threads[threadId] = thread

        eventSubject.send(.updated(thread))
    }

    /// Update thread notes
    public func setNotes(_ threadId: String, notes: String) {
        guard var thread = threads[threadId] else { return }

        thread.notes = notes
        thread.lastActivityAt = Int(Date().timeIntervalSince1970)
        threads[threadId] = thread

        eventSubject.send(.updated(thread))
    }

    /// Link thread to a call
    public func linkToCall(_ threadId: String, callId: String) {
        guard var thread = threads[threadId] else { return }

        let now = Int(Date().timeIntervalSince1970)

        thread.thread = MessagingHotlineThread(
            v: thread.thread.v,
            assignedOperator: thread.thread.assignedOperator,
            category: thread.thread.category,
            contact: thread.thread.contact,
            createdAt: thread.thread.createdAt,
            groupID: thread.thread.groupID,
            hotlineID: thread.thread.hotlineID,
            lastMessageAt: thread.thread.lastMessageAt,
            lastMessageBy: thread.thread.lastMessageBy,
            linkedCallID: callId,
            messageCount: thread.thread.messageCount,
            priority: thread.thread.priority,
            resolvedAt: thread.thread.resolvedAt,
            status: thread.thread.status,
            threadID: thread.thread.threadID,
            unreadByOperator: thread.thread.unreadByOperator
        )

        thread.lastActivityAt = now
        threads[threadId] = thread

        eventSubject.send(.updated(thread))
        logger.info("Linked thread \(threadId) to call \(callId)")
    }

    // MARK: - Queries

    /// Get a thread by ID
    public func getThread(_ threadId: String) -> MessagingThread? {
        threads[threadId]
    }

    /// Get threads with optional filtering
    public func getThreads(filter: ThreadFilter? = nil) -> [MessagingThread] {
        var result = Array(threads.values)

        if let filter = filter {
            if let statuses = filter.status, !statuses.isEmpty {
                result = result.filter { statuses.contains($0.status) }
            }
            if let assignedTo = filter.assignedTo {
                result = result.filter { $0.assignedTo == assignedTo }
            }
            if filter.unassigned == true {
                result = result.filter { $0.assignedTo == nil }
            }
            if let priorities = filter.priority, !priorities.isEmpty {
                result = result.filter { priorities.contains($0.priority) }
            }
            if let contactTypes = filter.contactType, !contactTypes.isEmpty {
                result = result.filter { thread in
                    guard let type = thread.thread.contact?.type else { return false }
                    return contactTypes.contains(type)
                }
            }
            if let hotlineId = filter.hotlineId {
                result = result.filter { $0.thread.hotlineID == hotlineId }
            }
            if filter.unread == true {
                result = result.filter { $0.unreadCount > 0 }
            }
        }

        // Sort by priority then by last activity
        result.sort { a, b in
            let priorityDiff = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0)
            if priorityDiff != 0 { return priorityDiff > 0 }
            return b.lastActivityAt < a.lastActivityAt
        }

        return result
    }

    /// Get current queue statistics
    public func getStats() -> ThreadStats {
        stats
    }

    // MARK: - Private Helpers

    private func addSystemMessage(to thread: inout MessagingThread, content: String) {
        let message = ThreadMessage(
            id: UUID().uuidString,
            threadId: thread.threadId,
            content: content,
            senderPubkey: "system",
            senderType: .system,
            timestamp: Int(Date().timeIntervalSince1970),
            read: true
        )

        thread.messages.append(message)
        thread.lastActivityAt = message.timestamp
    }

    private func updateThreadStatus(
        _ thread: MessagingHotlineThread,
        status: MessagingHotlineThreadStatus,
        timestamp: Int
    ) -> MessagingHotlineThread {
        MessagingHotlineThread(
            v: thread.v,
            assignedOperator: thread.assignedOperator,
            category: thread.category,
            contact: thread.contact,
            createdAt: thread.createdAt,
            groupID: thread.groupID,
            hotlineID: thread.hotlineID,
            lastMessageAt: timestamp,
            lastMessageBy: thread.lastMessageBy,
            linkedCallID: thread.linkedCallID,
            messageCount: thread.messageCount,
            priority: thread.priority,
            resolvedAt: status == .resolved ? timestamp : thread.resolvedAt,
            status: status,
            threadID: thread.threadID,
            unreadByOperator: thread.unreadByOperator
        )
    }

    private func updateStats() {
        let allThreads = Array(threads.values)
        let activeThreads = allThreads.filter {
            $0.status != .resolved && $0.status != .archived
        }

        let responseTimes = allThreads.compactMap { $0.responseTime }
        let avgResponseTime = responseTimes.isEmpty ? 0 :
            Double(responseTimes.reduce(0, +)) / Double(responseTimes.count)

        let resolutionTimes = allThreads
            .filter { $0.thread.resolvedAt != nil }
            .map { ($0.thread.resolvedAt ?? 0) - $0.createdAt }
        let avgResolutionTime = resolutionTimes.isEmpty ? 0 :
            Double(resolutionTimes.reduce(0, +)) / Double(resolutionTimes.count)

        stats = ThreadStats(
            total: activeThreads.count,
            unassigned: activeThreads.filter { $0.status == .unassigned }.count,
            myThreads: activeThreads.filter { $0.assignedTo == operatorPubkey }.count,
            waiting: activeThreads.filter { $0.status == .waiting }.count,
            active: activeThreads.filter { $0.status == .active }.count,
            avgResponseTime: avgResponseTime,
            avgResolutionTime: avgResolutionTime
        )

        eventSubject.send(.queueUpdated(stats))
    }

    /// Clear all threads (for testing)
    public func clear() {
        threads.removeAll()
        updateStats()
    }
}

// MARK: - Errors

public enum MessagingQueueError: LocalizedError {
    case threadNotFound
    case threadAlreadyAssigned
    case canOnlyArchiveResolved
    case invalidOperation

    public var errorDescription: String? {
        switch self {
        case .threadNotFound:
            return "Thread not found"
        case .threadAlreadyAssigned:
            return "Thread is already assigned"
        case .canOnlyArchiveResolved:
            return "Can only archive resolved threads"
        case .invalidOperation:
            return "Invalid operation"
        }
    }
}
