// BuildItApp.swift
// BuildIt - Decentralized Mesh Communication
//
// Main SwiftUI application entry point for BuildIt iOS app.
// Initializes core services and sets up the app's root view hierarchy.
// Handles deep linking from buildit://, nostr://, and universal links.
// Integrates notification services for push and local notifications.

import SwiftUI
import CoreBluetooth
import os.log

/// The main application structure for BuildIt
/// Handles app lifecycle, dependency injection, deep linking, and notifications
@main
struct BuildItApp: App {
    // MARK: - State Objects

    /// App delegate for handling UIKit lifecycle events
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    /// BLE manager for mesh networking
    @StateObject private var bleManager = BLEManager.shared

    /// Crypto manager for encryption operations
    @StateObject private var cryptoManager = CryptoManager.shared

    /// Nostr client for relay communication
    @StateObject private var nostrClient = NostrClient.shared

    /// Transport router for message routing
    @StateObject private var transportRouter = TransportRouter.shared

    /// Module registry for modular features
    @StateObject private var moduleRegistry = ModuleRegistry.shared

    /// Deep link router for navigation
    @StateObject private var deepLinkRouter = DeepLinkRouter.shared

    /// Share queue processor for handling content shared from Share Extension
    @StateObject private var shareQueueProcessor = ShareQueueProcessor.shared

    /// Notification service for push and local notifications
    @StateObject private var notificationService = NotificationService.shared

    /// Notification handler for processing notification events
    @StateObject private var notificationHandler = NotificationHandler.shared

    /// Background fetch manager for background content sync
    @StateObject private var backgroundFetchManager = BackgroundFetchManager.shared

    /// Logger for app-level events
    private let logger = Logger(subsystem: "com.buildit", category: "App")

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(bleManager)
                .environmentObject(cryptoManager)
                .environmentObject(nostrClient)
                .environmentObject(transportRouter)
                .environmentObject(moduleRegistry)
                .environmentObject(deepLinkRouter)
                .environmentObject(shareQueueProcessor)
                .environmentObject(notificationService)
                .environmentObject(notificationHandler)
                .environmentObject(backgroundFetchManager)
                .onAppear {
                    initializeServices()
                }
                .onOpenURL { url in
                    handleDeepLink(url: url)
                }
        }
    }

    // MARK: - Private Methods

    /// Initialize all core services on app launch
    private func initializeServices() {
        Task {
            // Initialize keychain and load existing keys
            await KeychainManager.shared.loadKeys()

            // Initialize crypto manager
            await cryptoManager.initialize()

            // Register and initialize modules
            do {
                // Register modules
                let eventsModule = try EventsModule()
                let messagingModule = try MessagingModule()

                moduleRegistry.registerModules([
                    eventsModule,
                    messagingModule
                ])

                // Initialize all modules
                try await moduleRegistry.initializeAll()

                // Setup Nostr event routing to modules
                nostrClient.onEvent { event in
                    Task {
                        await moduleRegistry.routeEvent(event)
                    }
                }
            } catch {
                print("Failed to initialize modules: \(error)")
            }

            // Start BLE scanning if authorized
            if bleManager.authorizationStatus == .authorizedAlways ||
               bleManager.authorizationStatus == .authorizedWhenInUse {
                bleManager.startScanning()
            }

            // Connect to default Nostr relays
            nostrClient.connectToDefaultRelays()

            // Sync data to App Group for Share Extension access
            await syncDataToAppGroup()

            // Process any pending shares from Share Extension
            await shareQueueProcessor.processQueue()

            // Mark app as ready for deep link navigation
            // In a real app, this should be called after authentication
            await MainActor.run {
                deepLinkRouter.markReady()
            }

            // Setup notification navigation delegate
            await setupNotificationNavigation()
        }
    }

    /// Setup notification handler navigation delegate
    private func setupNotificationNavigation() async {
        await MainActor.run {
            // Create a bridge between notification destinations and deep link routing
            NotificationHandler.shared.navigationDelegate = NotificationNavigationBridge(deepLinkRouter: deepLinkRouter)
        }
    }

    /// Sync necessary data to App Group for Share Extension access
    private func syncDataToAppGroup() async {
        // Sync user identity
        await cryptoManager.syncIdentityToAppGroup()

        // Sync contacts and groups
        Database.shared.syncAllToAppGroup()

        // Sync relay configuration
        nostrClient.syncRelaysToAppGroup()

        logger.info("Synced data to App Group for Share Extension")
    }

    /// Handle incoming deep link URL
    /// - Parameter url: The URL to handle (buildit://, nostr://, or universal link)
    private func handleDeepLink(url: URL) {
        logger.info("Received deep link: \(url.absoluteString)")

        guard DeepLinkHandler.canHandle(url: url) else {
            logger.warning("Cannot handle URL: \(url.absoluteString)")
            return
        }

        // Process the deep link
        DeepLinkHandler.handle(url: url)
    }
}

// MARK: - Notification Navigation Bridge

/// Bridge between NotificationHandler navigation and DeepLinkRouter
@MainActor
final class NotificationNavigationBridge: NotificationNavigationDelegate {
    private let deepLinkRouter: DeepLinkRouter

    init(deepLinkRouter: DeepLinkRouter) {
        self.deepLinkRouter = deepLinkRouter
    }

    func navigate(to destination: NotificationDestination) {
        // Convert notification destination to deep link URL and route
        if let url = destination.toURL() {
            DeepLinkHandler.handle(url: url)
        }
    }
}

// MARK: - Content View

/// Root content view with tab-based navigation
/// Supports deep link navigation through DeepLinkRouter
struct ContentView: View {
    @EnvironmentObject var bleManager: BLEManager
    @EnvironmentObject var moduleRegistry: ModuleRegistry
    @EnvironmentObject var deepLinkRouter: DeepLinkRouter
    @State private var selectedTab: Tab = .chat

    /// Navigation state for deep link destinations
    @State private var chatDeepLinkDestination: DeepLinkDestination?
    @State private var eventDeepLinkDestination: DeepLinkDestination?
    @State private var groupDeepLinkDestination: DeepLinkDestination?
    @State private var profileDeepLinkDestination: DeepLinkDestination?

    enum Tab: String, CaseIterable, Sendable {
        case chat = "Chat"
        case events = "Events"
        case groups = "Groups"
        case devices = "Devices"
        case settings = "Settings"
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ChatView()
                .tabItem {
                    Label("Chat", systemImage: "message.fill")
                }
                .tag(Tab.chat)

            // Events tab from module
            Group {
                if let eventsModule = moduleRegistry.getModule(EventsModule.self),
                   let eventsView = eventsModule.getViews().first {
                    eventsView.view
                } else {
                    Text("Events module not available")
                }
            }
            .tabItem {
                Label("Events", systemImage: "calendar")
            }
            .tag(Tab.events)

            GroupsView()
                .tabItem {
                    Label("Groups", systemImage: "person.3.fill")
                }
                .tag(Tab.groups)

            DeviceSyncView()
                .tabItem {
                    Label("Devices", systemImage: "iphone.radiowaves.left.and.right")
                }
                .tag(Tab.devices)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(Tab.settings)
        }
        .accentColor(.blue)
        .onAppear {
            setupDeepLinkRouting()
        }
        .onChange(of: deepLinkRouter.currentDestination) { _, newDestination in
            handleDeepLinkNavigation(newDestination)
        }
    }

    // MARK: - Deep Link Handling

    /// Setup deep link router callbacks
    private func setupDeepLinkRouting() {
        // Register tab selection callback with the router
        deepLinkRouter.onSelectTab = { tab in
            withAnimation {
                selectedTab = tab
            }
        }
    }

    /// Handle navigation to a deep link destination
    private func handleDeepLinkNavigation(_ destination: DeepLinkDestination?) {
        guard let destination = destination else { return }

        // Route to appropriate destination based on type
        switch destination {
        case .chat:
            chatDeepLinkDestination = destination
        case .event:
            eventDeepLinkDestination = destination
        case .group:
            groupDeepLinkDestination = destination
        case .profile:
            profileDeepLinkDestination = destination
        default:
            // For other destinations, they're handled by their respective views
            break
        }

        // Clear the current destination after handling
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            deepLinkRouter.clearCurrentDestination()
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environmentObject(BLEManager.shared)
        .environmentObject(CryptoManager.shared)
        .environmentObject(NostrClient.shared)
        .environmentObject(TransportRouter.shared)
        .environmentObject(ModuleRegistry.shared)
        .environmentObject(DeepLinkRouter.shared)
        .environmentObject(ShareQueueProcessor.shared)
        .environmentObject(NotificationService.shared)
        .environmentObject(NotificationHandler.shared)
        .environmentObject(BackgroundFetchManager.shared)
}
