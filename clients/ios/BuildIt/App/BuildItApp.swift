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

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(bleManager)
                .environmentObject(cryptoManager)
                .environmentObject(nostrClient)
                .environmentObject(transportRouter)
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
    @State private var selectedTab: Tab = .chat

    enum Tab: String, CaseIterable {
        case chat = "Chat"
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
