// BackgroundFetchManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages background fetch operations for syncing new content from relays.
// Handles BGTaskScheduler for background processing and notification scheduling.

import Foundation
import BackgroundTasks
import UIKit
import os.log

// MARK: - Background Task Identifiers

/// Background task identifiers for BuildIt
enum BackgroundTaskIdentifier: String, CaseIterable {
    case meshSync = "com.buildit.meshSync"
    case nostrSync = "com.buildit.nostrSync"
    case messageSync = "com.buildit.messageSync"
    case eventSync = "com.buildit.eventSync"
    case contentRefresh = "com.buildit.contentRefresh"
    case databaseMaintenance = "com.buildit.databaseMaintenance"

    /// Minimum interval between task executions
    var minimumInterval: TimeInterval {
        switch self {
        case .meshSync:
            return 15 * 60  // 15 minutes
        case .nostrSync:
            return 5 * 60   // 5 minutes
        case .messageSync:
            return 3 * 60   // 3 minutes
        case .eventSync:
            return 30 * 60  // 30 minutes
        case .contentRefresh:
            return 60 * 60  // 1 hour
        case .databaseMaintenance:
            return 24 * 60 * 60  // 24 hours
        }
    }

    /// Whether this task requires network connectivity
    var requiresNetwork: Bool {
        switch self {
        case .meshSync:
            return false  // BLE-based
        case .databaseMaintenance:
            return false  // Local only
        default:
            return true
        }
    }

    /// Whether this task requires external power
    var requiresExternalPower: Bool {
        switch self {
        case .databaseMaintenance:
            return true
        default:
            return false
        }
    }
}

// MARK: - Sync Result

/// Result of a background sync operation
struct SyncResult {
    let taskIdentifier: BackgroundTaskIdentifier
    let success: Bool
    let newItemCount: Int
    let errors: [Error]
    let duration: TimeInterval
    let timestamp: Date

    init(
        taskIdentifier: BackgroundTaskIdentifier,
        success: Bool,
        newItemCount: Int = 0,
        errors: [Error] = [],
        duration: TimeInterval = 0
    ) {
        self.taskIdentifier = taskIdentifier
        self.success = success
        self.newItemCount = newItemCount
        self.errors = errors
        self.duration = duration
        self.timestamp = Date()
    }
}

// MARK: - BackgroundFetchManager

/// Manages background fetch and processing tasks
@MainActor
final class BackgroundFetchManager: ObservableObject {
    // MARK: - Singleton

    static let shared = BackgroundFetchManager()

    // MARK: - Published Properties

    @Published private(set) var isBackgroundSyncEnabled: Bool = true
    @Published private(set) var lastSyncResults: [BackgroundTaskIdentifier: SyncResult] = [:]
    @Published private(set) var pendingTaskCount: Int = 0

    // MARK: - Private Properties

    private let notificationService = NotificationService.shared
    private let logger = Logger(subsystem: "com.buildit", category: "BackgroundFetchManager")

    /// Last sync timestamps for each task
    private var lastSyncTimestamps: [BackgroundTaskIdentifier: Date] {
        get {
            guard let data = UserDefaults.standard.data(forKey: "lastSyncTimestamps"),
                  let dict = try? JSONDecoder().decode([String: Date].self, from: data) else {
                return [:]
            }
            return dict.compactMapKeys { BackgroundTaskIdentifier(rawValue: $0) }
        }
        set {
            let dict = newValue.mapKeys { $0.rawValue }
            if let data = try? JSONEncoder().encode(dict) {
                UserDefaults.standard.set(data, forKey: "lastSyncTimestamps")
            }
        }
    }

    // MARK: - Initialization

    private init() {
        loadSyncState()
    }

    // MARK: - Registration

    /// Register all background tasks with the system
    func registerBackgroundTasks() {
        for taskId in BackgroundTaskIdentifier.allCases {
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: taskId.rawValue,
                using: nil
            ) { [weak self] task in
                Task { @MainActor in
                    await self?.handleBackgroundTask(task, identifier: taskId)
                }
            }
            logger.info("Registered background task: \(taskId.rawValue)")
        }
    }

    /// Schedule all background tasks
    func scheduleAllBackgroundTasks() {
        guard isBackgroundSyncEnabled else {
            logger.info("Background sync disabled, skipping task scheduling")
            return
        }

        for taskId in BackgroundTaskIdentifier.allCases {
            scheduleTask(taskId)
        }
    }

    /// Schedule a specific background task
    func scheduleTask(_ taskId: BackgroundTaskIdentifier) {
        let request: BGTaskRequest

        switch taskId {
        case .databaseMaintenance:
            // Use processing task for longer operations
            let processingRequest = BGProcessingTaskRequest(identifier: taskId.rawValue)
            processingRequest.requiresNetworkConnectivity = taskId.requiresNetwork
            processingRequest.requiresExternalPower = taskId.requiresExternalPower
            request = processingRequest
        default:
            // Use app refresh task for quick syncs
            request = BGAppRefreshTaskRequest(identifier: taskId.rawValue)
        }

        request.earliestBeginDate = Date(timeIntervalSinceNow: taskId.minimumInterval)

        do {
            try BGTaskScheduler.shared.submit(request)
            pendingTaskCount += 1
            logger.info("Scheduled background task: \(taskId.rawValue)")
        } catch BGTaskScheduler.Error.notPermitted {
            logger.warning("Background task not permitted: \(taskId.rawValue)")
        } catch BGTaskScheduler.Error.tooManyPendingTaskRequests {
            logger.warning("Too many pending tasks, could not schedule: \(taskId.rawValue)")
        } catch BGTaskScheduler.Error.unavailable {
            logger.warning("Background tasks unavailable: \(taskId.rawValue)")
        } catch {
            logger.error("Failed to schedule task \(taskId.rawValue): \(error.localizedDescription)")
        }
    }

    /// Cancel all pending background tasks
    func cancelAllBackgroundTasks() {
        BGTaskScheduler.shared.cancelAllTaskRequests()
        pendingTaskCount = 0
        logger.info("Cancelled all background tasks")
    }

    /// Cancel a specific background task
    func cancelTask(_ taskId: BackgroundTaskIdentifier) {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId.rawValue)
        logger.info("Cancelled background task: \(taskId.rawValue)")
    }

    // MARK: - Task Handling

    private func handleBackgroundTask(_ task: BGTask, identifier: BackgroundTaskIdentifier) async {
        let startTime = Date()
        logger.info("Starting background task: \(identifier.rawValue)")

        // Reschedule the task immediately
        scheduleTask(identifier)
        pendingTaskCount = max(0, pendingTaskCount - 1)

        // Set expiration handler
        var isCancelled = false
        task.expirationHandler = {
            isCancelled = true
            self.logger.warning("Background task expired: \(identifier.rawValue)")
        }

        // Execute the appropriate sync
        let result: SyncResult

        do {
            switch identifier {
            case .meshSync:
                result = await performMeshSync(isCancelled: { isCancelled })
            case .nostrSync:
                result = await performNostrSync(isCancelled: { isCancelled })
            case .messageSync:
                result = await performMessageSync(isCancelled: { isCancelled })
            case .eventSync:
                result = await performEventSync(isCancelled: { isCancelled })
            case .contentRefresh:
                result = await performContentRefresh(isCancelled: { isCancelled })
            case .databaseMaintenance:
                result = await performDatabaseMaintenance(isCancelled: { isCancelled })
            }
        } catch {
            result = SyncResult(
                taskIdentifier: identifier,
                success: false,
                errors: [error],
                duration: Date().timeIntervalSince(startTime)
            )
        }

        // Store result
        lastSyncResults[identifier] = result
        lastSyncTimestamps[identifier] = Date()
        saveSyncState()

        // Complete the task
        task.setTaskCompleted(success: result.success && !isCancelled)
        logger.info("Completed background task: \(identifier.rawValue), success: \(result.success), newItems: \(result.newItemCount)")
    }

    // MARK: - Sync Operations

    private func performMeshSync(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var newItems = 0
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .meshSync, success: false)
        }

        // Perform BLE mesh sync
        await BLEManager.shared.performBackgroundSync()

        // Get messages from mesh peers
        let pendingMessages = await MessageQueue.shared.getPendingOutgoing()
        newItems = pendingMessages.count

        return SyncResult(
            taskIdentifier: .meshSync,
            success: errors.isEmpty,
            newItemCount: newItems,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    private func performNostrSync(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var newItems = 0
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .nostrSync, success: false)
        }

        // Get last sync time
        let lastSync = lastSyncTimestamps[.nostrSync] ?? Date(timeIntervalSinceNow: -3600)

        // Perform Nostr sync
        await NostrClient.shared.performBackgroundSync()

        // Check for new messages and schedule notifications
        let unreadMessages = await MessageQueue.shared.getUnreadMessages()

        for message in unreadMessages {
            if message.timestamp > lastSync {
                newItems += 1

                // Schedule notification for new message
                do {
                    try await notificationService.scheduleMessageNotification(
                        from: String(message.senderPublicKey.prefix(8)) + "...",
                        senderId: message.senderPublicKey,
                        messageId: message.id,
                        preview: String(message.content.prefix(100)),
                        conversationId: message.senderPublicKey
                    )
                } catch {
                    errors.append(error)
                }
            }
        }

        return SyncResult(
            taskIdentifier: .nostrSync,
            success: errors.isEmpty,
            newItemCount: newItems,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    private func performMessageSync(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var newItems = 0
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .messageSync, success: false)
        }

        // Sync messages through both BLE and Nostr
        await BLEManager.shared.performBackgroundSync()
        await NostrClient.shared.performBackgroundSync()

        // Check message queue for new items
        let lastSync = lastSyncTimestamps[.messageSync] ?? Date(timeIntervalSinceNow: -300)
        let messages = await MessageQueue.shared.getIncomingMessages()

        for message in messages {
            if message.timestamp > lastSync && !message.isRead {
                newItems += 1

                // Schedule notification
                do {
                    try await notificationService.scheduleMessageNotification(
                        from: String(message.senderPublicKey.prefix(8)) + "...",
                        senderId: message.senderPublicKey,
                        messageId: message.id,
                        preview: String(message.content.prefix(100)),
                        conversationId: message.senderPublicKey
                    )
                } catch {
                    errors.append(error)
                }
            }
        }

        // Update badge count
        NotificationHandler.shared.setUnreadMessageCount(await MessageQueue.shared.unreadCount)

        return SyncResult(
            taskIdentifier: .messageSync,
            success: true,
            newItemCount: newItems,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    private func performEventSync(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var newItems = 0
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .eventSync, success: false)
        }

        // Sync through Nostr
        await NostrClient.shared.performBackgroundSync()

        // TODO: Check for new events through EventsModule and schedule notifications
        // This would require querying the EventsStore for new events

        return SyncResult(
            taskIdentifier: .eventSync,
            success: true,
            newItemCount: newItems,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    private func performContentRefresh(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var newItems = 0
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .contentRefresh, success: false)
        }

        // Refresh subscriptions
        NostrClient.shared.refreshSubscriptions()

        // TODO: Sync other content types (wiki, governance, mutual aid)

        return SyncResult(
            taskIdentifier: .contentRefresh,
            success: true,
            newItemCount: newItems,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    private func performDatabaseMaintenance(isCancelled: @escaping () -> Bool) async -> SyncResult {
        let startTime = Date()
        var errors: [Error] = []

        guard !isCancelled() else {
            return SyncResult(taskIdentifier: .databaseMaintenance, success: false)
        }

        // Perform database maintenance
        do {
            // Clean up old messages
            // TODO: Implement message retention policy

            // Optimize database
            Database.shared.saveContext()

            logger.info("Database maintenance completed")
        } catch {
            errors.append(error)
        }

        return SyncResult(
            taskIdentifier: .databaseMaintenance,
            success: errors.isEmpty,
            errors: errors,
            duration: Date().timeIntervalSince(startTime)
        )
    }

    // MARK: - Settings

    /// Enable or disable background sync
    func setBackgroundSyncEnabled(_ enabled: Bool) {
        isBackgroundSyncEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "backgroundSyncEnabled")

        if enabled {
            scheduleAllBackgroundTasks()
        } else {
            cancelAllBackgroundTasks()
        }

        logger.info("Background sync enabled: \(enabled)")
    }

    // MARK: - State Persistence

    private func loadSyncState() {
        isBackgroundSyncEnabled = UserDefaults.standard.object(forKey: "backgroundSyncEnabled") as? Bool ?? true
    }

    private func saveSyncState() {
        // Results are stored in memory only
        // Timestamps are stored in UserDefaults
    }

    // MARK: - App Lifecycle

    /// Called when app enters background
    func appDidEnterBackground() {
        if isBackgroundSyncEnabled {
            scheduleAllBackgroundTasks()
        }
    }

    /// Called when app becomes active
    func appDidBecomeActive() {
        // Cancel pending tasks as we'll sync in foreground
        // They will be rescheduled when we go to background again
    }

    // MARK: - Manual Sync

    /// Perform a manual sync of all content
    func performManualSync() async -> [SyncResult] {
        var results: [SyncResult] = []

        // Perform syncs sequentially to avoid overwhelming resources
        results.append(await performMessageSync(isCancelled: { false }))
        results.append(await performNostrSync(isCancelled: { false }))
        results.append(await performMeshSync(isCancelled: { false }))

        return results
    }

    /// Get time since last sync for a task
    func timeSinceLastSync(for taskId: BackgroundTaskIdentifier) -> TimeInterval? {
        guard let lastSync = lastSyncTimestamps[taskId] else {
            return nil
        }
        return Date().timeIntervalSince(lastSync)
    }
}

// MARK: - Dictionary Extension

private extension Dictionary {
    func compactMapKeys<T: Hashable>(_ transform: (Key) -> T?) -> [T: Value] {
        var result: [T: Value] = [:]
        for (key, value) in self {
            if let newKey = transform(key) {
                result[newKey] = value
            }
        }
        return result
    }

    func mapKeys<T: Hashable>(_ transform: (Key) -> T) -> [T: Value] {
        var result: [T: Value] = [:]
        for (key, value) in self {
            result[transform(key)] = value
        }
        return result
    }
}
