// ShareConfig.swift
// BuildIt - Decentralized Mesh Communication
//
// Shared configuration for App Group communication between
// the main app and Share Extension.

import Foundation

/// App Group identifier for sharing data between main app and extensions
enum ShareConfig {
    /// The App Group identifier - must match in both targets and entitlements
    static let appGroupIdentifier = "group.com.buildit.shared"

    /// Keychain access group for sharing keys between app and extension
    static let keychainAccessGroup = "com.buildit.shared.keychain"

    /// UserDefaults suite for shared preferences
    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    /// Shared container URL for file storage
    static var sharedContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }

    // MARK: - User Identity Keys

    /// Key for storing user's public key in shared defaults
    static let userPublicKeyKey = "user.publicKey"

    /// Key for storing user's npub in shared defaults
    static let userNpubKey = "user.npub"

    /// Key for storing user's display name in shared defaults
    static let userDisplayNameKey = "user.displayName"

    // MARK: - Relay Configuration Keys

    /// Key for storing relay URLs in shared defaults
    static let relayURLsKey = "relay.urls"

    /// Key for storing relay configuration in shared defaults
    static let relayConfigKey = "relay.config"

    // MARK: - Share Queue Keys

    /// Key for storing pending share messages
    static let pendingSharesKey = "pending.shares"

    /// Notification name for when new shares are queued
    static let newShareQueuedNotification = Notification.Name("com.buildit.newShareQueued")

    // MARK: - Recent Destinations

    /// Key for storing recent share destinations (contacts/groups)
    static let recentDestinationsKey = "recent.destinations"

    /// Maximum number of recent destinations to store
    static let maxRecentDestinations = 10
}

// MARK: - Shared User Identity

/// User identity data shared between app and extension
struct SharedUserIdentity: Codable {
    let publicKey: String
    let npub: String?
    let displayName: String?

    static func load() -> SharedUserIdentity? {
        guard let defaults = ShareConfig.sharedDefaults,
              let publicKey = defaults.string(forKey: ShareConfig.userPublicKeyKey) else {
            return nil
        }

        return SharedUserIdentity(
            publicKey: publicKey,
            npub: defaults.string(forKey: ShareConfig.userNpubKey),
            displayName: defaults.string(forKey: ShareConfig.userDisplayNameKey)
        )
    }

    func save() {
        guard let defaults = ShareConfig.sharedDefaults else { return }

        defaults.set(publicKey, forKey: ShareConfig.userPublicKeyKey)
        defaults.set(npub, forKey: ShareConfig.userNpubKey)
        defaults.set(displayName, forKey: ShareConfig.userDisplayNameKey)
        defaults.synchronize()
    }

    static func clear() {
        guard let defaults = ShareConfig.sharedDefaults else { return }

        defaults.removeObject(forKey: ShareConfig.userPublicKeyKey)
        defaults.removeObject(forKey: ShareConfig.userNpubKey)
        defaults.removeObject(forKey: ShareConfig.userDisplayNameKey)
        defaults.synchronize()
    }
}

// MARK: - Shared Relay Configuration

/// Relay configuration shared between app and extension
struct SharedRelayConfig: Codable {
    let url: String
    let isEnabled: Bool
    let isWritable: Bool

    static func loadAll() -> [SharedRelayConfig] {
        guard let defaults = ShareConfig.sharedDefaults,
              let data = defaults.data(forKey: ShareConfig.relayConfigKey),
              let configs = try? JSONDecoder().decode([SharedRelayConfig].self, from: data) else {
            return []
        }
        return configs
    }

    static func saveAll(_ configs: [SharedRelayConfig]) {
        guard let defaults = ShareConfig.sharedDefaults,
              let data = try? JSONEncoder().encode(configs) else {
            return
        }
        defaults.set(data, forKey: ShareConfig.relayConfigKey)
        defaults.synchronize()
    }
}

// MARK: - Share Destination

/// A destination for shared content (contact or group)
struct ShareDestination: Codable, Identifiable, Hashable {
    enum DestinationType: String, Codable {
        case contact
        case group
    }

    let id: String
    let type: DestinationType
    let displayName: String
    let publicKey: String?
    let avatarURL: String?

    /// Create a contact destination
    static func contact(publicKey: String, name: String?, avatarURL: String? = nil) -> ShareDestination {
        ShareDestination(
            id: publicKey,
            type: .contact,
            displayName: name ?? String(publicKey.prefix(8)) + "...",
            publicKey: publicKey,
            avatarURL: avatarURL
        )
    }

    /// Create a group destination
    static func group(id: String, name: String, avatarURL: String? = nil) -> ShareDestination {
        ShareDestination(
            id: id,
            type: .group,
            displayName: name,
            publicKey: nil,
            avatarURL: avatarURL
        )
    }
}

// MARK: - Recent Destinations

/// Manages recent share destinations for quick access
enum RecentDestinations {
    /// Load recent destinations from shared storage
    static func load() -> [ShareDestination] {
        guard let defaults = ShareConfig.sharedDefaults,
              let data = defaults.data(forKey: ShareConfig.recentDestinationsKey),
              let destinations = try? JSONDecoder().decode([ShareDestination].self, from: data) else {
            return []
        }
        return destinations
    }

    /// Add a destination to recents (moves to front if already exists)
    static func add(_ destination: ShareDestination) {
        var recents = load()

        // Remove if already exists
        recents.removeAll { $0.id == destination.id }

        // Add to front
        recents.insert(destination, at: 0)

        // Trim to max size
        if recents.count > ShareConfig.maxRecentDestinations {
            recents = Array(recents.prefix(ShareConfig.maxRecentDestinations))
        }

        // Save
        guard let defaults = ShareConfig.sharedDefaults,
              let data = try? JSONEncoder().encode(recents) else {
            return
        }
        defaults.set(data, forKey: ShareConfig.recentDestinationsKey)
        defaults.synchronize()
    }

    /// Clear all recent destinations
    static func clear() {
        ShareConfig.sharedDefaults?.removeObject(forKey: ShareConfig.recentDestinationsKey)
        ShareConfig.sharedDefaults?.synchronize()
    }
}

// MARK: - Shareable Models (for App Group sync)

/// Minimal contact model for share extension
struct ShareableContact: Codable {
    let name: String?
    let avatarURL: String?
}

/// Minimal group model for share extension
struct ShareableGroup: Codable {
    let name: String
    let avatarURL: String?
}
