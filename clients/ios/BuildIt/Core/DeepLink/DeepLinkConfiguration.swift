// DeepLinkConfiguration.swift
// BuildIt - Decentralized Mesh Communication
//
// Configuration constants and documentation for deep linking setup.
// This file documents the required Info.plist and entitlements configuration.

import Foundation

/// Deep linking configuration constants and documentation
///
/// ## Info.plist Configuration
///
/// Add the following to your Info.plist to enable custom URL schemes:
///
/// ```xml
/// <key>CFBundleURLTypes</key>
/// <array>
///     <!-- BuildIt custom scheme -->
///     <dict>
///         <key>CFBundleURLName</key>
///         <string>com.buildit.app</string>
///         <key>CFBundleURLSchemes</key>
///         <array>
///             <string>buildit</string>
///         </array>
///         <key>CFBundleTypeRole</key>
///         <string>Editor</string>
///     </dict>
///     <!-- Nostr protocol scheme -->
///     <dict>
///         <key>CFBundleURLName</key>
///         <string>com.buildit.nostr</string>
///         <key>CFBundleURLSchemes</key>
///         <array>
///             <string>nostr</string>
///         </array>
///         <key>CFBundleTypeRole</key>
///         <string>Viewer</string>
///     </dict>
/// </array>
/// ```
///
/// ## Associated Domains Entitlement
///
/// To enable universal links, add the following entitlement to your
/// BuildIt.entitlements file:
///
/// ```xml
/// <key>com.apple.developer.associated-domains</key>
/// <array>
///     <string>applinks:buildit.network</string>
///     <string>applinks:www.buildit.network</string>
///     <string>applinks:app.buildit.network</string>
/// </array>
/// ```
///
/// ## Apple App Site Association (AASA)
///
/// Host the following JSON at https://buildit.network/.well-known/apple-app-site-association:
///
/// ```json
/// {
///     "applinks": {
///         "apps": [],
///         "details": [
///             {
///                 "appID": "TEAMID.com.buildit.app",
///                 "paths": [
///                     "/p/*",
///                     "/e/*",
///                     "/chat/*",
///                     "/group/*",
///                     "/event/*",
///                     "/profile/*",
///                     "/article/*",
///                     "/form/*",
///                     "/campaign/*",
///                     "/mutual-aid/*",
///                     "/proposal/*",
///                     "/wiki/*",
///                     "/settings",
///                     "/relay/*"
///                 ]
///             }
///         ]
///     }
/// }
/// ```
///
enum DeepLinkConfiguration {
    // MARK: - URL Schemes

    /// Custom URL scheme for the app
    static let customScheme = "buildit"

    /// Nostr protocol scheme
    static let nostrScheme = "nostr"

    // MARK: - Universal Link Domains

    /// Primary universal link domain
    static let primaryDomain = "buildit.network"

    /// All supported universal link domains
    static let supportedDomains = [
        "buildit.network",
        "www.buildit.network",
        "app.buildit.network"
    ]

    // MARK: - URL Scheme Examples

    /// Example URLs for testing deep linking
    enum Examples {
        // MARK: BuildIt Custom Scheme

        /// Chat with a user by pubkey
        static let chatWithPubkey = "buildit://chat/abc123def456..."

        /// Chat with a user by npub
        static let chatWithNpub = "buildit://chat/npub1..."

        /// View a group
        static let group = "buildit://group/group-id-here"

        /// View an event
        static let event = "buildit://event/note1..."

        /// View a profile
        static let profile = "buildit://profile/npub1..."

        /// Open settings
        static let settings = "buildit://settings"

        /// Connect to a relay
        static let relay = "buildit://relay/wss%3A%2F%2Frelay.damus.io"

        // MARK: Nostr Scheme

        /// View a profile via nostr scheme
        static let nostrProfile = "nostr:npub1..."

        /// View an event via nostr scheme
        static let nostrEvent = "nostr:note1..."

        /// View an event with relay hints
        static let nostrEventWithRelays = "nostr:nevent1..."

        /// View a profile with relay hints
        static let nostrProfileWithRelays = "nostr:nprofile1..."

        // MARK: Universal Links

        /// View a profile via universal link
        static let universalProfile = "https://buildit.network/p/npub1..."

        /// View an event via universal link
        static let universalEvent = "https://buildit.network/e/note1..."

        /// Chat via universal link
        static let universalChat = "https://buildit.network/chat/npub1..."

        /// Article via universal link
        static let universalArticle = "https://buildit.network/article/how-to-organize"
    }

    // MARK: - Query Parameters

    /// Supported query parameters for deep links
    enum QueryParameters {
        /// Relay hint (single)
        static let relay = "relay"

        /// Relay hints (multiple, comma-separated)
        static let relays = "relays"

        /// Short relay parameter
        static let relayShort = "r"

        /// Author pubkey (for events)
        static let author = "author"

        /// Event kind (for filtering)
        static let kind = "kind"

        /// ID parameter
        static let id = "id"

        /// Pubkey parameter
        static let pubkey = "pubkey"

        /// Slug parameter (for articles, wiki pages)
        static let slug = "slug"
    }
}

// MARK: - Testing Helpers

#if DEBUG
extension DeepLinkConfiguration {
    /// Test deep link handling with sample URLs
    @MainActor
    static func runTests() {
        let testURLs = [
            // Custom scheme tests
            "buildit://chat/abc123def456",
            "buildit://profile/npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
            "buildit://settings",

            // Nostr scheme tests
            "nostr:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",

            // Universal link tests
            "https://buildit.network/p/npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
            "https://buildit.network/article/test-article"
        ]

        for urlString in testURLs {
            guard let url = URL(string: urlString) else {
                print("[DeepLink Test] Invalid URL: \(urlString)")
                continue
            }

            let canHandle = DeepLinkHandler.canHandle(url: url)
            print("[DeepLink Test] \(canHandle ? "OK" : "FAIL"): \(urlString)")

            if canHandle {
                do {
                    let result = try DeepLinkHandler.parse(url: url)
                    print("  -> Destination: \(result.destination.description)")
                } catch {
                    print("  -> Parse error: \(error)")
                }
            }
        }
    }
}
#endif
