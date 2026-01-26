// OfflineQueue.swift
// BuildIt - Decentralized Mesh Communication
//
// Queue for pending operations (messages, form submissions, etc.)
// Persists queue to disk and handles retry logic with exponential backoff.

import Foundation
import Combine
import os.log

/// Type of operation that can be queued for offline sync
enum OperationType: String, Codable, CaseIterable {
    case message = "message"
    case formSubmission = "form_submission"
    case eventRsvp = "event_rsvp"
    case profileUpdate = "profile_update"
    case reaction = "reaction"
    case groupAction = "group_action"
    case mutualAidRequest = "mutual_aid_request"
    case vote = "vote"
    case wikiEdit = "wiki_edit"
    case contactNote = "contact_note"
}

/// Status of a queued operation
enum OperationStatus: String, Codable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
}

/// Represents a queued operation for offline sync
struct QueuedOperation: Codable, Identifiable, Equatable {
    let id: String
    let type: OperationType
    let payload: Data
    let recipientPublicKey: String?
    let groupId: String?
    let createdAt: Date
    var status: OperationStatus
    var retryCount: Int
    var lastAttemptAt: Date?
    var errorMessage: String?
    var priority: Int

    /// Next retry time based on exponential backoff
    var nextRetryAt: Date? {
        guard status == .failed || status == .pending else { return nil }
        guard retryCount > 0 else { return Date() }

        // Exponential backoff: 2^retryCount seconds, capped at 30 minutes
        let delay = min(pow(2.0, Double(retryCount)), 1800)
        return lastAttemptAt?.addingTimeInterval(delay)
    }

    /// Whether the operation can be retried
    var canRetry: Bool {
        retryCount < QueuedOperation.maxRetryAttempts && status != .completed && status != .cancelled
    }

    /// Maximum retry attempts before giving up
    static let maxRetryAttempts = 10

    init(
        id: String = UUID().uuidString,
        type: OperationType,
        payload: Data,
        recipientPublicKey: String? = nil,
        groupId: String? = nil,
        createdAt: Date = Date(),
        status: OperationStatus = .pending,
        retryCount: Int = 0,
        lastAttemptAt: Date? = nil,
        errorMessage: String? = nil,
        priority: Int = 0
    ) {
        self.id = id
        self.type = type
        self.payload = payload
        self.recipientPublicKey = recipientPublicKey
        self.groupId = groupId
        self.createdAt = createdAt
        self.status = status
        self.retryCount = retryCount
        self.lastAttemptAt = lastAttemptAt
        self.errorMessage = errorMessage
        self.priority = priority
    }

    static func == (lhs: QueuedOperation, rhs: QueuedOperation) -> Bool {
        lhs.id == rhs.id
    }
}

/// OfflineQueue manages a persistent queue of operations for offline sync
actor OfflineQueue {
    // MARK: - Singleton

    static let shared = OfflineQueue()

    // MARK: - Properties

    private var queue: [QueuedOperation] = []
    private let logger = Logger(subsystem: "com.buildit", category: "OfflineQueue")
    private let encryption = DatabaseEncryption.shared
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// Publisher for queue updates
    private let queueSubject = PassthroughSubject<[QueuedOperation], Never>()
    nonisolated var queuePublisher: AnyPublisher<[QueuedOperation], Never> {
        queueSubject.eraseToAnyPublisher()
    }

    /// Maximum queue size
    private let maxQueueSize = 500

    /// Maximum age for operations (7 days)
    private let maxOperationAge: TimeInterval = 7 * 24 * 60 * 60

    // MARK: - Initialization

    private init() {
        Task {
            await loadFromDisk()
            await pruneExpiredOperations()
        }
    }

    // MARK: - Queue Operations

    /// Enqueue a new operation
    func enqueue(_ operation: QueuedOperation) {
        // Check for duplicate
        if let existingIndex = queue.firstIndex(where: { $0.id == operation.id }) {
            queue[existingIndex] = operation
            logger.info("Updated existing operation: \(operation.id)")
        } else {
            queue.append(operation)
            logger.info("Enqueued new operation: \(operation.id) type: \(operation.type.rawValue)")
        }

        // Enforce queue size limit
        while queue.count > maxQueueSize {
            // Remove oldest completed/failed operations first
            if let index = queue.firstIndex(where: { $0.status == .completed }) {
                queue.remove(at: index)
            } else if let index = queue.firstIndex(where: { $0.status == .failed && !$0.canRetry }) {
                queue.remove(at: index)
            } else {
                // Remove oldest pending operation
                queue.removeFirst()
            }
        }

        saveToDisk()
        notifyQueueUpdate()
    }

    /// Enqueue a message operation
    func enqueueMessage(content: String, to recipientPublicKey: String, groupId: String? = nil) {
        let payload = try? encoder.encode(["content": content])
        let operation = QueuedOperation(
            type: .message,
            payload: payload ?? Data(),
            recipientPublicKey: recipientPublicKey,
            groupId: groupId,
            priority: 1
        )
        enqueue(operation)
    }

    /// Enqueue a form submission
    func enqueueFormSubmission(formId: String, data: [String: Any]) {
        let payload = try? JSONSerialization.data(withJSONObject: data)
        let operation = QueuedOperation(
            type: .formSubmission,
            payload: payload ?? Data(),
            priority: 0
        )
        enqueue(operation)
    }

    /// Get all pending operations
    func getPendingOperations() -> [QueuedOperation] {
        queue.filter { $0.status == .pending || ($0.status == .failed && $0.canRetry) }
            .sorted { ($0.priority, $0.createdAt) > ($1.priority, $1.createdAt) }
    }

    /// Get operations ready for retry
    func getOperationsReadyForRetry() -> [QueuedOperation] {
        let now = Date()
        return queue.filter { operation in
            guard operation.canRetry else { return false }
            guard let nextRetry = operation.nextRetryAt else { return true }
            return nextRetry <= now
        }.sorted { ($0.priority, $0.createdAt) > ($1.priority, $1.createdAt) }
    }

    /// Get operations by type
    func getOperations(ofType type: OperationType) -> [QueuedOperation] {
        queue.filter { $0.type == type }
    }

    /// Get operation by ID
    func getOperation(id: String) -> QueuedOperation? {
        queue.first { $0.id == id }
    }

    /// Get pending count
    var pendingCount: Int {
        queue.filter { $0.status == .pending || ($0.status == .failed && $0.canRetry) }.count
    }

    /// Get total queue count
    var totalCount: Int {
        queue.count
    }

    // MARK: - Status Updates

    /// Mark an operation as processing
    func markProcessing(_ operationId: String) {
        guard let index = queue.firstIndex(where: { $0.id == operationId }) else { return }
        queue[index].status = .processing
        queue[index].lastAttemptAt = Date()
        saveToDisk()
        notifyQueueUpdate()
        logger.info("Operation processing: \(operationId)")
    }

    /// Mark an operation as completed
    func markCompleted(_ operationId: String) {
        guard let index = queue.firstIndex(where: { $0.id == operationId }) else { return }
        queue[index].status = .completed
        saveToDisk()
        notifyQueueUpdate()
        logger.info("Operation completed: \(operationId)")
    }

    /// Mark an operation as failed
    func markFailed(_ operationId: String, error: String) {
        guard let index = queue.firstIndex(where: { $0.id == operationId }) else { return }
        queue[index].status = .failed
        queue[index].retryCount += 1
        queue[index].lastAttemptAt = Date()
        queue[index].errorMessage = error

        if queue[index].canRetry {
            queue[index].status = .pending
            logger.warning("Operation failed (will retry): \(operationId) - \(error)")
        } else {
            logger.error("Operation permanently failed: \(operationId) - \(error)")
        }

        saveToDisk()
        notifyQueueUpdate()
    }

    /// Cancel an operation
    func cancel(_ operationId: String) {
        guard let index = queue.firstIndex(where: { $0.id == operationId }) else { return }
        queue[index].status = .cancelled
        saveToDisk()
        notifyQueueUpdate()
        logger.info("Operation cancelled: \(operationId)")
    }

    /// Remove completed operations
    func removeCompleted() {
        queue.removeAll { $0.status == .completed }
        saveToDisk()
        notifyQueueUpdate()
    }

    /// Remove an operation from the queue
    func remove(_ operationId: String) {
        queue.removeAll { $0.id == operationId }
        saveToDisk()
        notifyQueueUpdate()
    }

    /// Clear all operations
    func clear() {
        queue.removeAll()
        saveToDisk()
        notifyQueueUpdate()
        logger.info("Queue cleared")
    }

    // MARK: - Batch Operations

    /// Dequeue all pending operations for processing
    func dequeueAllPending() -> [QueuedOperation] {
        let pending = getOperationsReadyForRetry()
        for operation in pending {
            if let index = queue.firstIndex(where: { $0.id == operation.id }) {
                queue[index].status = .processing
                queue[index].lastAttemptAt = Date()
            }
        }
        saveToDisk()
        notifyQueueUpdate()
        return pending
    }

    // MARK: - Persistence

    private func saveToDisk() {
        guard let data = try? encoder.encode(queue) else {
            logger.error("Failed to encode queue")
            return
        }

        let url = getQueueFileURL()
        do {
            try encryption.writeEncrypted(data, to: url)
        } catch {
            logger.error("Failed to save queue: \(error.localizedDescription)")
        }
    }

    private func loadFromDisk() {
        let url = getQueueFileURL()
        let legacyUrl = getDocumentsDirectory().appendingPathComponent("offline_queue.json")

        do {
            if let data = try encryption.readEncrypted(from: url),
               let loaded = try? decoder.decode([QueuedOperation].self, from: data) {
                queue = loaded
                logger.info("Loaded \(loaded.count) operations from encrypted queue")
            } else if FileManager.default.fileExists(atPath: legacyUrl.path),
                      let data = try? Data(contentsOf: legacyUrl),
                      let loaded = try? decoder.decode([QueuedOperation].self, from: data) {
                queue = loaded
                logger.info("Migrated \(loaded.count) operations from legacy queue")
                try? FileManager.default.removeItem(at: legacyUrl)
                saveToDisk() // Save to encrypted format
            }
        } catch {
            logger.error("Failed to load queue: \(error.localizedDescription)")
        }

        notifyQueueUpdate()
    }

    private func pruneExpiredOperations() {
        let cutoff = Date().addingTimeInterval(-maxOperationAge)
        let initialCount = queue.count

        queue.removeAll { operation in
            // Remove expired pending/failed operations
            if operation.createdAt < cutoff && operation.status != .processing {
                return true
            }
            // Remove completed operations older than 1 day
            if operation.status == .completed && operation.createdAt < Date().addingTimeInterval(-86400) {
                return true
            }
            return false
        }

        let removedCount = initialCount - queue.count
        if removedCount > 0 {
            logger.info("Pruned \(removedCount) expired operations")
            saveToDisk()
            notifyQueueUpdate()
        }
    }

    private func getQueueFileURL() -> URL {
        getDocumentsDirectory().appendingPathComponent("offline_queue.db")
    }

    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private func notifyQueueUpdate() {
        let currentQueue = queue
        Task { @MainActor in
            queueSubject.send(currentQueue)
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let offlineQueueUpdated = Notification.Name("offlineQueueUpdated")
    static let operationCompleted = Notification.Name("operationCompleted")
    static let operationFailed = Notification.Name("operationFailed")
}
