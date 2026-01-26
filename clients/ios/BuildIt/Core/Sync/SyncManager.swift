// SyncManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages offline sync: monitors network connectivity, processes queue when online,
// handles conflict resolution for concurrent edits, and publishes sync status.

import Foundation
import Combine
import Network
import os.log

/// Represents the current network connectivity state
enum NetworkState: String, Equatable {
    case offline
    case wifi
    case cellular
    case unknown

    var isConnected: Bool {
        self != .offline && self != .unknown
    }

    var description: String {
        switch self {
        case .offline: return "Offline"
        case .wifi: return "WiFi"
        case .cellular: return "Cellular"
        case .unknown: return "Unknown"
        }
    }
}

/// Sync status for the application
enum SyncStatus: Equatable {
    case idle
    case syncing(progress: Double, message: String)
    case completed(itemsProcessed: Int)
    case error(message: String)
    case offline

    var description: String {
        switch self {
        case .idle:
            return "Up to date"
        case .syncing(let progress, let message):
            return "\(message) (\(Int(progress * 100))%)"
        case .completed(let items):
            return "Synced \(items) items"
        case .error(let message):
            return "Error: \(message)"
        case .offline:
            return "Offline"
        }
    }
}

/// Conflict resolution strategy
enum ConflictResolution {
    case serverWins
    case clientWins
    case merge
    case manual
}

/// Represents a sync conflict
struct SyncConflict: Identifiable {
    let id: String
    let operationType: OperationType
    let localVersion: Data
    let serverVersion: Data
    let localTimestamp: Date
    let serverTimestamp: Date
    var resolution: ConflictResolution?
}

/// SyncManager handles all offline sync operations
@MainActor
class SyncManager: ObservableObject {
    // MARK: - Singleton

    static let shared = SyncManager()

    // MARK: - Published Properties

    @Published private(set) var networkState: NetworkState = .unknown
    @Published private(set) var syncStatus: SyncStatus = .idle
    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var lastSyncTime: Date?
    @Published private(set) var conflicts: [SyncConflict] = []
    @Published private(set) var isSyncing: Bool = false

    // MARK: - Private Properties

    private var networkMonitor: NWPathMonitor?
    private let monitorQueue = DispatchQueue(label: "com.buildit.network-monitor")
    private var cancellables = Set<AnyCancellable>()
    private var syncTask: Task<Void, Never>?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    private let logger = Logger(subsystem: "com.buildit", category: "SyncManager")

    /// Sync interval when online (30 seconds)
    private let syncInterval: TimeInterval = 30

    /// Minimum time between syncs (5 seconds)
    private let minSyncInterval: TimeInterval = 5

    /// Last sync attempt time
    private var lastSyncAttempt: Date?

    // MARK: - Initialization

    private init() {
        setupNetworkMonitor()
        setupQueueObserver()
        loadLastSyncTime()
    }

    deinit {
        stopNetworkMonitor()
    }

    // MARK: - Network Monitoring

    private func setupNetworkMonitor() {
        networkMonitor = NWPathMonitor()
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                self?.handleNetworkUpdate(path)
            }
        }
        networkMonitor?.start(queue: monitorQueue)
    }

    private func stopNetworkMonitor() {
        networkMonitor?.cancel()
        networkMonitor = nil
    }

    private func handleNetworkUpdate(_ path: NWPath) {
        let oldState = networkState

        switch path.status {
        case .satisfied:
            if path.usesInterfaceType(.wifi) {
                networkState = .wifi
            } else if path.usesInterfaceType(.cellular) {
                networkState = .cellular
            } else {
                networkState = .unknown
            }
        case .unsatisfied, .requiresConnection:
            networkState = .offline
        @unknown default:
            networkState = .unknown
        }

        if oldState != networkState {
            logger.info("Network state changed: \(oldState.rawValue) -> \(self.networkState.rawValue)")

            if networkState.isConnected && !oldState.isConnected {
                // Just came online - trigger sync
                syncStatus = .idle
                Task {
                    await processPendingQueue()
                }
            } else if !networkState.isConnected {
                syncStatus = .offline
            }

            NotificationCenter.default.post(
                name: .networkStateChanged,
                object: nil,
                userInfo: ["state": networkState]
            )
        }
    }

    // MARK: - Queue Observer

    private func setupQueueObserver() {
        Task {
            let count = await OfflineQueue.shared.pendingCount
            pendingCount = count
        }

        // Observe queue updates
        OfflineQueue.shared.queuePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] operations in
                let pending = operations.filter { $0.status == .pending || ($0.status == .failed && $0.canRetry) }
                self?.pendingCount = pending.count
            }
            .store(in: &cancellables)
    }

    // MARK: - Sync Operations

    /// Start automatic sync
    func startAutoSync() {
        guard syncTask == nil else { return }

        syncTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self = self else { break }

                if self.networkState.isConnected && self.pendingCount > 0 {
                    await self.processPendingQueue()
                }

                // Wait for sync interval
                try? await Task.sleep(nanoseconds: UInt64(self.syncInterval * 1_000_000_000))
            }
        }

        logger.info("Auto sync started")
    }

    /// Stop automatic sync
    func stopAutoSync() {
        syncTask?.cancel()
        syncTask = nil
        logger.info("Auto sync stopped")
    }

    /// Manually trigger a sync
    func triggerSync() async {
        guard networkState.isConnected else {
            syncStatus = .offline
            return
        }

        // Rate limit
        if let lastAttempt = lastSyncAttempt,
           Date().timeIntervalSince(lastAttempt) < minSyncInterval {
            return
        }

        await processPendingQueue()
    }

    /// Process all pending operations in the queue
    func processPendingQueue() async {
        guard !isSyncing else { return }
        guard networkState.isConnected else {
            syncStatus = .offline
            return
        }

        isSyncing = true
        lastSyncAttempt = Date()

        // Begin background task for iOS
        beginBackgroundTask()

        let operations = await OfflineQueue.shared.dequeueAllPending()

        if operations.isEmpty {
            syncStatus = .idle
            isSyncing = false
            endBackgroundTask()
            return
        }

        logger.info("Processing \(operations.count) pending operations")
        syncStatus = .syncing(progress: 0, message: "Syncing...")

        var processedCount = 0
        var failedCount = 0

        for (index, operation) in operations.enumerated() {
            let progress = Double(index + 1) / Double(operations.count)
            syncStatus = .syncing(progress: progress, message: "Processing \(operation.type.rawValue)...")

            do {
                try await processOperation(operation)
                await OfflineQueue.shared.markCompleted(operation.id)
                processedCount += 1
            } catch {
                await OfflineQueue.shared.markFailed(operation.id, error: error.localizedDescription)
                failedCount += 1
                logger.error("Failed to process operation \(operation.id): \(error.localizedDescription)")
            }
        }

        lastSyncTime = Date()
        saveLastSyncTime()

        if failedCount > 0 {
            syncStatus = .error(message: "\(failedCount) items failed")
        } else {
            syncStatus = .completed(itemsProcessed: processedCount)
        }

        // Reset to idle after a delay
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if case .completed = syncStatus {
                syncStatus = .idle
            }
        }

        isSyncing = false
        endBackgroundTask()

        await OfflineQueue.shared.removeCompleted()

        let newPendingCount = await OfflineQueue.shared.pendingCount
        pendingCount = newPendingCount

        logger.info("Sync completed: \(processedCount) succeeded, \(failedCount) failed")
    }

    // MARK: - Operation Processing

    private func processOperation(_ operation: QueuedOperation) async throws {
        switch operation.type {
        case .message:
            try await processMessageOperation(operation)
        case .formSubmission:
            try await processFormSubmission(operation)
        case .eventRsvp:
            try await processEventRsvp(operation)
        case .profileUpdate:
            try await processProfileUpdate(operation)
        case .reaction:
            try await processReaction(operation)
        case .groupAction:
            try await processGroupAction(operation)
        case .mutualAidRequest:
            try await processMutualAidRequest(operation)
        case .vote:
            try await processVote(operation)
        case .wikiEdit:
            try await processWikiEdit(operation)
        case .contactNote:
            try await processContactNote(operation)
        }
    }

    private func processMessageOperation(_ operation: QueuedOperation) async throws {
        guard let recipientPublicKey = operation.recipientPublicKey else {
            throw SyncError.missingRecipient
        }

        guard let payloadDict = try? JSONSerialization.jsonObject(with: operation.payload) as? [String: String],
              let content = payloadDict["content"] else {
            throw SyncError.invalidPayload
        }

        // Route through TransportRouter
        try await TransportRouter.shared.sendMessage(
            content: content,
            to: recipientPublicKey,
            priority: .normal
        )
    }

    private func processFormSubmission(_ operation: QueuedOperation) async throws {
        // Form submissions would be sent to appropriate endpoints
        logger.info("Processing form submission: \(operation.id)")
    }

    private func processEventRsvp(_ operation: QueuedOperation) async throws {
        logger.info("Processing event RSVP: \(operation.id)")
    }

    private func processProfileUpdate(_ operation: QueuedOperation) async throws {
        logger.info("Processing profile update: \(operation.id)")
    }

    private func processReaction(_ operation: QueuedOperation) async throws {
        logger.info("Processing reaction: \(operation.id)")
    }

    private func processGroupAction(_ operation: QueuedOperation) async throws {
        logger.info("Processing group action: \(operation.id)")
    }

    private func processMutualAidRequest(_ operation: QueuedOperation) async throws {
        logger.info("Processing mutual aid request: \(operation.id)")
    }

    private func processVote(_ operation: QueuedOperation) async throws {
        logger.info("Processing vote: \(operation.id)")
    }

    private func processWikiEdit(_ operation: QueuedOperation) async throws {
        logger.info("Processing wiki edit: \(operation.id)")
    }

    private func processContactNote(_ operation: QueuedOperation) async throws {
        logger.info("Processing contact note: \(operation.id)")
    }

    // MARK: - Conflict Resolution

    /// Add a conflict to be resolved
    func addConflict(_ conflict: SyncConflict) {
        conflicts.append(conflict)
        NotificationCenter.default.post(
            name: .syncConflictDetected,
            object: nil,
            userInfo: ["conflict": conflict]
        )
    }

    /// Resolve a conflict with the specified strategy
    func resolveConflict(_ conflictId: String, resolution: ConflictResolution) async throws {
        guard let index = conflicts.firstIndex(where: { $0.id == conflictId }) else {
            throw SyncError.conflictNotFound
        }

        var conflict = conflicts[index]
        conflict.resolution = resolution

        switch resolution {
        case .serverWins:
            // Discard local changes, keep server version
            logger.info("Resolved conflict \(conflictId): server wins")

        case .clientWins:
            // Re-queue local version for sync
            let operation = QueuedOperation(
                type: conflict.operationType,
                payload: conflict.localVersion,
                priority: 2
            )
            await OfflineQueue.shared.enqueue(operation)
            logger.info("Resolved conflict \(conflictId): client wins")

        case .merge:
            // Attempt to merge changes
            try await mergeConflict(conflict)
            logger.info("Resolved conflict \(conflictId): merged")

        case .manual:
            // Leave for user to handle
            logger.info("Conflict \(conflictId) marked for manual resolution")
        }

        conflicts.remove(at: index)
    }

    private func mergeConflict(_ conflict: SyncConflict) async throws {
        // Implementation depends on operation type
        // For now, we'll use last-write-wins based on timestamp
        let winningVersion = conflict.localTimestamp > conflict.serverTimestamp
            ? conflict.localVersion
            : conflict.serverVersion

        let operation = QueuedOperation(
            type: conflict.operationType,
            payload: winningVersion,
            priority: 2
        )
        await OfflineQueue.shared.enqueue(operation)
    }

    /// Clear all resolved conflicts
    func clearResolvedConflicts() {
        conflicts.removeAll { $0.resolution != nil }
    }

    // MARK: - Background Task

    private func beginBackgroundTask() {
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }

    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    // MARK: - Persistence

    private func saveLastSyncTime() {
        UserDefaults.standard.set(lastSyncTime, forKey: "lastSyncTime")
    }

    private func loadLastSyncTime() {
        lastSyncTime = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date
    }
}

// MARK: - Sync Errors

enum SyncError: LocalizedError {
    case offline
    case missingRecipient
    case invalidPayload
    case conflictNotFound
    case syncInProgress
    case operationFailed(String)

    var errorDescription: String? {
        switch self {
        case .offline:
            return "Device is offline"
        case .missingRecipient:
            return "Recipient not specified"
        case .invalidPayload:
            return "Invalid operation payload"
        case .conflictNotFound:
            return "Conflict not found"
        case .syncInProgress:
            return "Sync already in progress"
        case .operationFailed(let message):
            return "Operation failed: \(message)"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let networkStateChanged = Notification.Name("networkStateChanged")
    static let syncStatusChanged = Notification.Name("syncStatusChanged")
    static let syncConflictDetected = Notification.Name("syncConflictDetected")
}
