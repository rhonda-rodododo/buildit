// SettingsViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// View model for settings management.

import Foundation
import Combine
import os.log

/// View model for settings-related operations
@MainActor
class SettingsViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var publicKeyHex: String?
    @Published var npub: String?
    @Published var relays: [RelayConfig] = []

    @Published var preferredTransport: TransportType = .both {
        didSet {
            TransportRouter.shared.setPreferredTransport(preferredTransport)
        }
    }

    @Published var requireBiometrics: Bool = true {
        didSet {
            UserDefaults.standard.set(requireBiometrics, forKey: "requireBiometrics")
        }
    }

    @Published var showNotifications: Bool = true {
        didSet {
            UserDefaults.standard.set(showNotifications, forKey: "showNotifications")
        }
    }

    @Published var bleAutoConnect: Bool = true {
        didSet {
            UserDefaults.standard.set(bleAutoConnect, forKey: "bleAutoConnect")
        }
    }

    @Published var bleBackgroundMode: Bool = true {
        didSet {
            UserDefaults.standard.set(bleBackgroundMode, forKey: "bleBackgroundMode")
        }
    }

    @Published var showClearDataAlert = false
    @Published var showCopiedToast = false
    @Published var error: String?

    // MARK: - Computed Properties

    var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    var hasSecureEnclave: Bool {
        KeychainManager.shared.isSecureEnclaveAvailable
    }

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "SettingsViewModel")
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        loadSettings()
        loadIdentity()
        loadRelays()
    }

    // MARK: - Public Methods

    /// Load saved settings
    func loadSettings() {
        requireBiometrics = UserDefaults.standard.bool(forKey: "requireBiometrics")
        showNotifications = UserDefaults.standard.bool(forKey: "showNotifications")
        bleAutoConnect = UserDefaults.standard.bool(forKey: "bleAutoConnect")
        bleBackgroundMode = UserDefaults.standard.bool(forKey: "bleBackgroundMode")

        if let transportRaw = UserDefaults.standard.string(forKey: "preferredTransport"),
           let transport = TransportType(rawValue: transportRaw) {
            preferredTransport = transport
        }
    }

    /// Load current identity
    func loadIdentity() {
        Task {
            publicKeyHex = await CryptoManager.shared.getPublicKeyHex()
            npub = await CryptoManager.shared.getNpub()
        }
    }

    /// Load relay configurations
    func loadRelays() {
        relays = Database.shared.getAllRelays()

        // Add default relays if none exist
        if relays.isEmpty {
            let defaults = [
                "wss://relay.damus.io",
                "wss://relay.nostr.band",
                "wss://nos.lol"
            ]

            for url in defaults {
                let relay = RelayConfig(url: url)
                Database.shared.saveRelay(relay)
            }

            relays = Database.shared.getAllRelays()
        }
    }

    /// Generate a new key pair
    func generateNewKeyPair() async {
        do {
            let keyPair = try await CryptoManager.shared.generateKeyPair()
            publicKeyHex = keyPair.publicKeyHex
            npub = keyPair.npub

            logger.info("Generated new key pair")
        } catch {
            self.error = error.localizedDescription
            logger.error("Failed to generate key pair: \(error.localizedDescription)")
        }
    }

    /// Import a key from nsec format
    func importKey(_ nsec: String) async {
        do {
            let keyPair = try await CryptoManager.shared.importNsec(nsec)
            publicKeyHex = keyPair.publicKeyHex
            npub = keyPair.npub

            logger.info("Imported key pair")
        } catch {
            self.error = error.localizedDescription
            logger.error("Failed to import key: \(error.localizedDescription)")
        }
    }

    /// Add a new relay
    func addRelay(_ url: String) {
        var normalizedURL = url.trimmingCharacters(in: .whitespacesAndNewlines)

        // Ensure wss:// prefix
        if !normalizedURL.hasPrefix("wss://") && !normalizedURL.hasPrefix("ws://") {
            normalizedURL = "wss://" + normalizedURL
        }

        let relay = RelayConfig(url: normalizedURL)
        Database.shared.saveRelay(relay)

        // Connect to new relay
        NostrClient.shared.connect(to: normalizedURL)

        loadRelays()
        logger.info("Added relay: \(normalizedURL)")
    }

    /// Toggle relay enabled state
    func toggleRelay(_ url: String, enabled: Bool) {
        Database.shared.toggleRelay(url: url, enabled: enabled)

        if enabled {
            NostrClient.shared.connect(to: url)
        } else {
            NostrClient.shared.disconnect(from: url)
        }

        loadRelays()
    }

    /// Delete relays at indices
    func deleteRelays(at indexSet: IndexSet) {
        for index in indexSet {
            let relay = relays[index]
            Database.shared.deleteRelay(url: relay.url)
            NostrClient.shared.disconnect(from: relay.url)
        }

        loadRelays()
    }

    /// Clear all app data
    func clearAllData() {
        // Clear database
        Database.shared.clearAllData()

        // Delete keys
        Task {
            try? await CryptoManager.shared.deleteKeyPair()
            publicKeyHex = nil
            npub = nil
        }

        // Disconnect from all relays
        NostrClient.shared.disconnectAll()

        // Reset settings
        UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier!)

        logger.warning("Cleared all app data")
    }

    /// Export keys for backup
    func exportKeys() async -> String? {
        // This would export the nsec for backup
        // In production, this should require biometric authentication
        guard await authenticateUser() else {
            error = "Authentication required to export keys"
            return nil
        }

        // Get nsec from keychain (not implemented for security)
        return nil
    }

    // MARK: - Private Methods

    private func authenticateUser() async -> Bool {
        do {
            return try await KeychainManager.shared.authenticateWithBiometrics(
                reason: "Authenticate to access your keys"
            )
        } catch {
            logger.error("Authentication failed: \(error.localizedDescription)")
            return false
        }
    }
}
