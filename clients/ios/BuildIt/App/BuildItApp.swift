// BuildItApp.swift
// BuildIt - Decentralized Mesh Communication
//
// Main SwiftUI application entry point for BuildIt iOS app.
// Initializes core services and sets up the app's root view hierarchy.

import SwiftUI
import CoreBluetooth

/// The main application structure for BuildIt
/// Handles app lifecycle and dependency injection
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

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(bleManager)
                .environmentObject(cryptoManager)
                .environmentObject(nostrClient)
                .environmentObject(transportRouter)
                .environmentObject(moduleRegistry)
                .onAppear {
                    initializeServices()
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
        }
    }
}

// MARK: - Content View

/// Root content view with tab-based navigation
struct ContentView: View {
    @EnvironmentObject var bleManager: BLEManager
    @EnvironmentObject var moduleRegistry: ModuleRegistry
    @State private var selectedTab: Tab = .chat

    enum Tab: String, CaseIterable {
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
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environmentObject(BLEManager.shared)
        .environmentObject(CryptoManager.shared)
        .environmentObject(NostrClient.shared)
        .environmentObject(TransportRouter.shared)
}
