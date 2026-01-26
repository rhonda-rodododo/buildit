// AppDelegate.swift
// BuildIt - Decentralized Mesh Communication
//
// UIKit App Delegate for handling system events, background tasks, and deep links.
// Integrates with NotificationService, NotificationHandler, and BackgroundFetchManager.

import UIKit
import BackgroundTasks
import UserNotifications
import os.log

/// AppDelegate handles UIKit lifecycle events and background tasks
/// Required for BLE background mode, push notifications, and deep link handling on cold launch
class AppDelegate: NSObject, UIApplicationDelegate {

    // MARK: - Constants

    /// Background task identifier for BLE mesh sync
    static let meshSyncTaskIdentifier = "com.buildit.meshSync"

    /// Background task identifier for Nostr relay sync
    static let nostrSyncTaskIdentifier = "com.buildit.nostrSync"

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "AppDelegate")

    /// Stores deep link URL received during cold launch
    private(set) var coldLaunchDeepLinkURL: URL?

    // MARK: - Application Lifecycle

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Configure logging
        configureLogging()

        // Configure notification handler as delegate
        Task { @MainActor in
            NotificationHandler.shared.configure()
        }

        // Register background tasks (both legacy and new BackgroundFetchManager)
        registerBackgroundTasks()
        Task { @MainActor in
            BackgroundFetchManager.shared.registerBackgroundTasks()
        }

        // Request notification permissions through NotificationService
        Task { @MainActor in
            await setupNotifications()
        }

        // Handle launch from BLE wake
        if let options = launchOptions,
           options[.bluetoothCentrals] != nil || options[.bluetoothPeripherals] != nil {
            handleBLELaunch()
        }

        // Handle deep link from cold launch
        if let options = launchOptions,
           let url = options[.url] as? URL {
            logger.info("Cold launch with deep link: \(url.absoluteString)")
            coldLaunchDeepLinkURL = url
            // The URL will be processed by SwiftUI's onOpenURL when the view appears
        }

        // Handle launch from notification
        if let notification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            handleNotificationLaunch(userInfo: notification)
        }

        logger.info("Application did finish launching")
        return true
    }

    // MARK: - Deep Link Handling (UIKit)

    /// Handle URL when app is already running (warm launch)
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        logger.info("Open URL (warm launch): \(url.absoluteString)")

        // First try to handle with DeepLinkHandler if available
        if DeepLinkHandler.canHandle(url: url) {
            Task { @MainActor in
                DeepLinkHandler.handle(url: url)
            }
            return true
        }

        // Fall back to notification-based navigation
        if url.scheme == "buildit" {
            Task { @MainActor in
                if let destination = parseNotificationDeepLink(url) {
                    if let delegate = NotificationHandler.shared.navigationDelegate {
                        delegate.navigate(to: destination)
                    }
                }
            }
            return true
        }

        logger.warning("Cannot handle URL: \(url.absoluteString)")
        return false
    }

    /// Handle universal links
    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else {
            return false
        }

        logger.info("Universal link: \(url.absoluteString)")

        // Check if we can handle this URL
        guard DeepLinkHandler.canHandle(url: url) else {
            logger.warning("Cannot handle universal link: \(url.absoluteString)")
            return false
        }

        // Handle the deep link
        Task { @MainActor in
            DeepLinkHandler.handle(url: url)
        }

        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Schedule background tasks through BackgroundFetchManager
        Task { @MainActor in
            BackgroundFetchManager.shared.appDidEnterBackground()
        }

        // Also schedule legacy tasks for compatibility
        scheduleMeshSync()
        scheduleNostrSync()

        // Ensure BLE continues in background
        Task { @MainActor in
            BLEManager.shared.enterBackgroundMode()
        }

        logger.info("Application entered background")
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Resume full BLE operations
        Task { @MainActor in
            BLEManager.shared.enterForegroundMode()
        }

        // Refresh Nostr subscriptions
        Task { @MainActor in
            NostrClient.shared.refreshSubscriptions()
        }

        // Handle any pending notification navigation
        Task { @MainActor in
            NotificationHandler.shared.handlePendingNavigation()
        }

        // Refresh authorization status
        Task { @MainActor in
            await NotificationService.shared.refreshAuthorizationStatus()
        }

        logger.info("Application will enter foreground")
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Notify BackgroundFetchManager
        Task { @MainActor in
            BackgroundFetchManager.shared.appDidBecomeActive()
        }

        logger.info("Application became active")
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Clean up resources
        Task { @MainActor in
            BLEManager.shared.cleanup()
            NostrClient.shared.disconnectAll()

            // Save any pending data
            Database.shared.saveContext()
        }

        logger.info("Application will terminate")
    }

    // MARK: - Notification Setup

    private func setupNotifications() async {
        do {
            // Request authorization with provisional support
            let granted = try await NotificationService.shared.requestAuthorization(
                options: [.alert, .sound, .badge, .provisional]
            )

            if granted {
                logger.info("Notification authorization granted")

                // Register notification categories
                await NotificationService.shared.registerCategories()
            } else {
                logger.info("Notification authorization denied")
            }
        } catch {
            logger.error("Failed to request notification authorization: \(error.localizedDescription)")
        }
    }

    // MARK: - Background Tasks

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.meshSyncTaskIdentifier,
            using: nil
        ) { task in
            self.handleMeshSyncTask(task as! BGAppRefreshTask)
        }

        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.nostrSyncTaskIdentifier,
            using: nil
        ) { task in
            self.handleNostrSyncTask(task as! BGAppRefreshTask)
        }
    }

    private func scheduleMeshSync() {
        let request = BGAppRefreshTaskRequest(identifier: Self.meshSyncTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            logger.error("Failed to schedule mesh sync: \(error.localizedDescription)")
        }
    }

    private func scheduleNostrSync() {
        let request = BGAppRefreshTaskRequest(identifier: Self.nostrSyncTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5 minutes

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            logger.error("Failed to schedule Nostr sync: \(error.localizedDescription)")
        }
    }

    private func handleMeshSyncTask(_ task: BGAppRefreshTask) {
        scheduleMeshSync() // Reschedule

        let syncOperation = Task {
            await BLEManager.shared.performBackgroundSync()
        }

        task.expirationHandler = {
            syncOperation.cancel()
        }

        Task {
            _ = await syncOperation.result
            task.setTaskCompleted(success: true)
        }
    }

    private func handleNostrSyncTask(_ task: BGAppRefreshTask) {
        scheduleNostrSync() // Reschedule

        let syncOperation = Task { @MainActor in
            await NostrClient.shared.performBackgroundSync()

            // Schedule notifications for new messages
            let lastSyncKey = "lastNostrSyncForNotifications"
            let lastSync = UserDefaults.standard.object(forKey: lastSyncKey) as? Date ?? Date(timeIntervalSinceNow: -300)

            let messages = await MessageQueue.shared.getIncomingMessages()
            for message in messages where message.timestamp > lastSync && !message.isRead {
                try? await NotificationService.shared.scheduleMessageNotification(
                    from: String(message.senderPublicKey.prefix(8)) + "...",
                    senderId: message.senderPublicKey,
                    messageId: message.id,
                    preview: String(message.content.prefix(100)),
                    conversationId: message.senderPublicKey
                )
            }

            UserDefaults.standard.set(Date(), forKey: lastSyncKey)
        }

        task.expirationHandler = {
            syncOperation.cancel()
        }

        Task {
            _ = await syncOperation.result
            task.setTaskCompleted(success: true)
        }
    }

    // MARK: - BLE Launch Handling

    private func handleBLELaunch() {
        // App was launched by the system to handle BLE events
        Task { @MainActor in
            BLEManager.shared.handleBackgroundLaunch()
        }

        logger.info("Handling BLE launch")
    }

    // MARK: - Notification Launch Handling

    private func handleNotificationLaunch(userInfo: [AnyHashable: Any]) {
        // App was launched from a notification tap
        logger.info("Launched from notification")

        // Store the userInfo for later processing
        UserDefaults.standard.set(userInfo as? [String: Any], forKey: "pendingNotificationUserInfo")
    }

    // MARK: - Remote Notifications

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Forward to NotificationService
        Task { @MainActor in
            NotificationService.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
        }

        // Also store directly for backward compatibility
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        UserDefaults.standard.set(tokenString, forKey: "apnsToken")

        logger.info("Registered for remote notifications")
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Forward to NotificationService
        Task { @MainActor in
            NotificationService.shared.didFailToRegisterForRemoteNotifications(error: error)
        }

        logger.error("Failed to register for remote notifications: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Handle silent push notification
        logger.info("Received remote notification")

        Task { @MainActor in
            // Perform background sync
            let results = await BackgroundFetchManager.shared.performManualSync()

            // Determine result
            let hasNewData = results.contains { $0.newItemCount > 0 }
            let hasFailed = results.contains { !$0.success }

            if hasFailed {
                completionHandler(.failed)
            } else if hasNewData {
                completionHandler(.newData)
            } else {
                completionHandler(.noData)
            }
        }
    }

    // MARK: - Deep Link Parsing for Notifications

    private func parseNotificationDeepLink(_ url: URL) -> NotificationDestination? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let host = components.host else {
            return nil
        }

        let pathComponents = components.path.split(separator: "/").map(String.init)

        switch host {
        case "chat":
            if let conversationId = pathComponents.first {
                return .conversation(id: conversationId)
            }
        case "group":
            if let groupId = pathComponents.first {
                let conversationId = components.queryItems?.first(where: { $0.name == "conversation" })?.value
                return .groupConversation(groupId: groupId, conversationId: conversationId)
            }
        case "events":
            if let eventId = pathComponents.first {
                return .event(id: eventId)
            }
            return .eventList
        case "governance":
            if pathComponents.count >= 3,
               pathComponents[1] == "proposal" {
                return .proposal(id: pathComponents[2], groupId: pathComponents[0])
            }
            if let groupId = pathComponents.first {
                return .governanceList(groupId: groupId)
            }
        case "mutualaid":
            if pathComponents.count >= 3,
               pathComponents[1] == "request" {
                return .mutualAidRequest(id: pathComponents[2], groupId: pathComponents[0])
            }
            if let groupId = pathComponents.first {
                return .mutualAidList(groupId: groupId)
            }
        case "wiki":
            if pathComponents.count >= 3,
               pathComponents[1] == "page" {
                return .wikiPage(id: pathComponents[2], groupId: pathComponents[0])
            }
        case "contacts":
            if let contactId = pathComponents.first {
                return .contact(id: contactId)
            }
        case "devices":
            return .deviceSync
        case "mesh":
            return .meshPeers
        case "settings":
            return .settings
        default:
            break
        }

        return nil
    }

    // MARK: - Logging

    private func configureLogging() {
        #if DEBUG
        // Enable verbose logging in debug builds
        UserDefaults.standard.set(true, forKey: "verboseLogging")
        #endif
    }
}
