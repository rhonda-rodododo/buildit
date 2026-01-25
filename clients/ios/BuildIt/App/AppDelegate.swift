// AppDelegate.swift
// BuildIt - Decentralized Mesh Communication
//
// UIKit App Delegate for handling system events and background tasks.

import UIKit
import BackgroundTasks
import UserNotifications

/// AppDelegate handles UIKit lifecycle events and background tasks
/// Required for BLE background mode and push notifications
class AppDelegate: NSObject, UIApplicationDelegate {

    // MARK: - Constants

    /// Background task identifier for BLE mesh sync
    static let meshSyncTaskIdentifier = "com.buildit.meshSync"

    /// Background task identifier for Nostr relay sync
    static let nostrSyncTaskIdentifier = "com.buildit.nostrSync"

    // MARK: - Application Lifecycle

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Configure logging
        configureLogging()

        // Register background tasks
        registerBackgroundTasks()

        // Request notification permissions
        requestNotificationPermissions()

        // Handle launch from BLE wake
        if let options = launchOptions,
           options[.bluetoothCentrals] != nil || options[.bluetoothPeripherals] != nil {
            handleBLELaunch()
        }

        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Schedule background tasks
        scheduleMeshSync()
        scheduleNostrSync()

        // Ensure BLE continues in background
        BLEManager.shared.enterBackgroundMode()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Resume full BLE operations
        BLEManager.shared.enterForegroundMode()

        // Refresh Nostr subscriptions
        NostrClient.shared.refreshSubscriptions()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Clean up resources
        BLEManager.shared.cleanup()
        NostrClient.shared.disconnectAll()

        // Save any pending data
        Database.shared.saveContext()
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
            print("Failed to schedule mesh sync: \(error)")
        }
    }

    private func scheduleNostrSync() {
        let request = BGAppRefreshTaskRequest(identifier: Self.nostrSyncTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5 minutes

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule Nostr sync: \(error)")
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

        let syncOperation = Task {
            await NostrClient.shared.performBackgroundSync()
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
        BLEManager.shared.handleBackgroundLaunch()
    }

    // MARK: - Notifications

    private func requestNotificationPermissions() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("Notification permission error: \(error)")
            }

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Convert token to string and store for relay registration
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        UserDefaults.standard.set(tokenString, forKey: "apnsToken")
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error)")
    }

    // MARK: - Logging

    private func configureLogging() {
        #if DEBUG
        // Enable verbose logging in debug builds
        UserDefaults.standard.set(true, forKey: "verboseLogging")
        #endif
    }
}
