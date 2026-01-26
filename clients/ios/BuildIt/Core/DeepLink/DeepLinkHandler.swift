// DeepLinkHandler.swift
// BuildIt - Decentralized Mesh Communication
//
// Parses incoming URLs from various schemes (buildit://, nostr://, https://buildit.network/...)
// and converts them to navigation destinations.

import Foundation
import os.log

/// Errors that can occur during deep link handling
enum DeepLinkError: LocalizedError {
    case invalidURL
    case unsupportedScheme(String)
    case unsupportedPath(String)
    case parsingFailed(String)
    case nostrParsingFailed(NostrURIParserError)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL format"
        case .unsupportedScheme(let scheme):
            return "Unsupported URL scheme: \(scheme)"
        case .unsupportedPath(let path):
            return "Unsupported path: \(path)"
        case .parsingFailed(let reason):
            return "Failed to parse deep link: \(reason)"
        case .nostrParsingFailed(let error):
            return "Nostr URI parsing failed: \(error.localizedDescription)"
        }
    }
}

/// Result of parsing a deep link URL
struct DeepLinkParseResult {
    let destination: DeepLinkDestination
    let originalURL: URL
    let metadata: [String: String]

    init(destination: DeepLinkDestination, originalURL: URL, metadata: [String: String] = [:]) {
        self.destination = destination
        self.originalURL = originalURL
        self.metadata = metadata
    }
}

/// Handles parsing of deep link URLs from various schemes
struct DeepLinkHandler {
    private static let logger = Logger(subsystem: "com.buildit", category: "DeepLinkHandler")

    // MARK: - Supported Schemes

    /// Custom URL scheme for the app
    static let customScheme = "buildit"

    /// Nostr protocol scheme
    static let nostrScheme = "nostr"

    /// Universal link domain
    static let universalLinkDomain = "buildit.network"

    /// Alternative universal link domains
    static let alternativeDomains = ["www.buildit.network", "app.buildit.network"]

    // MARK: - Public Methods

    /// Parse any supported URL into a deep link destination
    /// - Parameter url: The URL to parse
    /// - Returns: The parse result with destination and metadata
    /// - Throws: DeepLinkError if parsing fails
    static func parse(url: URL) throws -> DeepLinkParseResult {
        logger.info("Parsing URL: \(url.absoluteString)")

        guard let scheme = url.scheme?.lowercased() else {
            throw DeepLinkError.invalidURL
        }

        switch scheme {
        case customScheme:
            return try parseCustomScheme(url: url)

        case nostrScheme:
            return try parseNostrScheme(url: url)

        case "https", "http":
            return try parseUniversalLink(url: url)

        default:
            throw DeepLinkError.unsupportedScheme(scheme)
        }
    }

    /// Check if a URL can be handled by this app
    /// - Parameter url: The URL to check
    /// - Returns: True if the URL can be handled
    static func canHandle(url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }

        switch scheme {
        case customScheme, nostrScheme:
            return true

        case "https", "http":
            guard let host = url.host?.lowercased() else { return false }
            return host == universalLinkDomain || alternativeDomains.contains(host)

        default:
            return false
        }
    }

    /// Convenience method to parse and immediately route to destination
    /// - Parameter url: The URL to handle
    @MainActor
    static func handle(url: URL) {
        do {
            let result = try parse(url: url)
            logger.info("Routing to: \(result.destination.description)")
            DeepLinkRouter.shared.navigate(to: result.destination)
        } catch {
            logger.error("Failed to handle URL: \(error.localizedDescription)")
        }
    }

    // MARK: - Custom Scheme Parsing (buildit://)

    /// Parse a buildit:// URL
    /// Format: buildit://[host]/[path]?[query]
    /// Examples:
    /// - buildit://chat/npub1...
    /// - buildit://group/abc123
    /// - buildit://event/note1...
    /// - buildit://profile/npub1...
    /// - buildit://settings
    private static func parseCustomScheme(url: URL) throws -> DeepLinkParseResult {
        guard let host = url.host?.lowercased() else {
            // Try path-based format: buildit:chat/npub1...
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if !path.isEmpty {
                return try parsePathBasedURL(path: path, url: url)
            }
            throw DeepLinkError.invalidURL
        }

        let pathComponents = url.pathComponents.filter { $0 != "/" }
        let queryParams = parseQueryParameters(url: url)

        switch host {
        case "chat":
            return try parseChatDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "group":
            return try parseGroupDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "event":
            return try parseEventDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "profile", "user", "p":
            return try parseProfileDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "form":
            return try parseFormDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "campaign":
            return try parseCampaignDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "article":
            return try parseArticleDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "mutual-aid", "mutualaid", "aid":
            return try parseMutualAidDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "proposal", "vote":
            return try parseProposalDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "wiki":
            return try parseWikiDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "settings":
            return DeepLinkParseResult(destination: .settings, originalURL: url)

        case "relay":
            return try parseRelayDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        // Widget deep link destinations
        case "messages":
            return try parseMessagesDestination(pathComponents: pathComponents, queryParams: queryParams, url: url)

        case "events":
            return try parseEventsListDestination(pathComponents: pathComponents, url: url)

        case "groups":
            return DeepLinkParseResult(destination: .groups, originalURL: url)

        case "action":
            return try parseWidgetActionDestination(pathComponents: pathComponents, url: url)

        default:
            throw DeepLinkError.unsupportedPath(host)
        }
    }

    // MARK: - Nostr Scheme Parsing (nostr://)

    /// Parse a nostr:// URL or nostr: URI
    /// Examples:
    /// - nostr:npub1...
    /// - nostr:note1...
    /// - nostr:nevent1...
    /// - nostr:nprofile1...
    private static func parseNostrScheme(url: URL) throws -> DeepLinkParseResult {
        // The entity is in the path (or host for some URL parsers)
        var entityString = url.host ?? ""

        // Also check the path in case the entity is there
        if entityString.isEmpty {
            entityString = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        }

        // Handle nostr:entity format where entity becomes the path
        if entityString.isEmpty {
            entityString = url.absoluteString
            if entityString.lowercased().hasPrefix("nostr:") {
                entityString = String(entityString.dropFirst(6))
            }
        }

        guard !entityString.isEmpty else {
            throw DeepLinkError.invalidURL
        }

        do {
            let entity = try NostrURIParser.parse(entityString)
            let destination = try destinationFromNostrEntity(entity)
            return DeepLinkParseResult(destination: destination, originalURL: url)
        } catch let error as NostrURIParserError {
            throw DeepLinkError.nostrParsingFailed(error)
        }
    }

    /// Convert a NostrEntity to a DeepLinkDestination
    private static func destinationFromNostrEntity(_ entity: NostrEntity) throws -> DeepLinkDestination {
        switch entity {
        case .pubkey(let hex):
            return .profile(pubkey: hex)

        case .nprofile(let pubkey, let relays):
            return .profile(pubkey: pubkey, relayHints: relays)

        case .note(let id):
            return .event(id: id)

        case .nevent(let id, let relays, let author, let kind):
            return .event(id: id, relayHints: relays, author: author, kind: kind)

        case .relay(let url):
            return .relay(url: url)

        case .naddr(let identifier, let pubkey, let kind, let relays):
            return .addressable(identifier: identifier, pubkey: pubkey, kind: kind, relayHints: relays)

        case .secret:
            // Don't navigate to secrets, this is a security measure
            throw DeepLinkError.parsingFailed("Cannot navigate to private key")
        }
    }

    // MARK: - Universal Link Parsing (https://buildit.network/...)

    /// Parse a universal link
    /// Format: https://buildit.network/[path]
    /// Examples:
    /// - https://buildit.network/p/npub1...
    /// - https://buildit.network/e/note1...
    /// - https://buildit.network/chat/abc123
    /// - https://buildit.network/article/how-to-organize
    private static func parseUniversalLink(url: URL) throws -> DeepLinkParseResult {
        guard let host = url.host?.lowercased(),
              host == universalLinkDomain || alternativeDomains.contains(host) else {
            throw DeepLinkError.unsupportedScheme(url.host ?? "unknown")
        }

        let pathComponents = url.pathComponents.filter { $0 != "/" }
        let queryParams = parseQueryParameters(url: url)

        guard !pathComponents.isEmpty else {
            // Root URL - default to settings or home
            return DeepLinkParseResult(destination: .settings, originalURL: url)
        }

        let firstComponent = pathComponents[0].lowercased()
        let remainingComponents = Array(pathComponents.dropFirst())

        switch firstComponent {
        case "p", "profile", "user":
            return try parseProfileDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "e", "event", "note":
            return try parseEventDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "chat", "dm":
            return try parseChatDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "group", "g":
            return try parseGroupDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "form", "f":
            return try parseFormDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "campaign", "c":
            return try parseCampaignDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "article", "a", "blog":
            return try parseArticleDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "mutual-aid", "aid":
            return try parseMutualAidDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "proposal", "vote", "governance":
            return try parseProposalDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "wiki", "w":
            return try parseWikiDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        case "settings":
            return DeepLinkParseResult(destination: .settings, originalURL: url)

        case "relay":
            return try parseRelayDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)

        default:
            // Try to interpret as Nostr entity
            if firstComponent.hasPrefix("npub") || firstComponent.hasPrefix("note") ||
               firstComponent.hasPrefix("nevent") || firstComponent.hasPrefix("nprofile") {
                return try parseNostrEntity(firstComponent, url: url)
            }

            throw DeepLinkError.unsupportedPath(firstComponent)
        }
    }

    // MARK: - Path-Based URL Parsing

    /// Parse a path-based URL format (buildit:chat/npub1...)
    private static func parsePathBasedURL(path: String, url: URL) throws -> DeepLinkParseResult {
        let components = path.split(separator: "/").map(String.init)

        guard !components.isEmpty else {
            throw DeepLinkError.invalidURL
        }

        let queryParams = parseQueryParameters(url: url)
        let firstComponent = components[0].lowercased()
        let remainingComponents = Array(components.dropFirst())

        switch firstComponent {
        case "chat":
            return try parseChatDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)
        case "profile", "p":
            return try parseProfileDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)
        case "event", "e":
            return try parseEventDestination(pathComponents: remainingComponents, queryParams: queryParams, url: url)
        default:
            // Try as Nostr entity
            return try parseNostrEntity(firstComponent, url: url)
        }
    }

    // MARK: - Destination Parsers

    private static func parseChatDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let identifier = pathComponents.first ?? queryParams["pubkey"] ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing pubkey for chat destination")
        }

        let pubkey = try resolvePubkey(identifier)
        let relays = parseRelayHints(queryParams: queryParams)

        return DeepLinkParseResult(
            destination: .chat(pubkey: pubkey, relayHints: relays),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseGroupDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let id = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for group destination")
        }

        return DeepLinkParseResult(
            destination: .group(id: id),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseEventDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let identifier = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for event destination")
        }

        // Check if it's a bech32 encoded entity
        if identifier.hasPrefix("note") || identifier.hasPrefix("nevent") {
            return try parseNostrEntity(identifier, url: url)
        }

        let relays = parseRelayHints(queryParams: queryParams)
        let author = queryParams["author"]
        let kind = queryParams["kind"].flatMap(Int.init)

        return DeepLinkParseResult(
            destination: .event(id: identifier, relayHints: relays, author: author, kind: kind),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseProfileDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let identifier = pathComponents.first ?? queryParams["pubkey"] ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing pubkey for profile destination")
        }

        // Check if it's a bech32 encoded entity
        if identifier.hasPrefix("npub") || identifier.hasPrefix("nprofile") {
            return try parseNostrEntity(identifier, url: url)
        }

        let relays = parseRelayHints(queryParams: queryParams)

        return DeepLinkParseResult(
            destination: .profile(pubkey: identifier, relayHints: relays),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseFormDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let id = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for form destination")
        }

        return DeepLinkParseResult(
            destination: .form(id: id),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseCampaignDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let id = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for campaign destination")
        }

        return DeepLinkParseResult(
            destination: .campaign(id: id),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseArticleDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let slug = pathComponents.first ?? queryParams["slug"] else {
            throw DeepLinkError.parsingFailed("Missing slug for article destination")
        }

        return DeepLinkParseResult(
            destination: .article(slug: slug),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseMutualAidDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let id = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for mutual aid destination")
        }

        return DeepLinkParseResult(
            destination: .mutualAid(id: id),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseProposalDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let id = pathComponents.first ?? queryParams["id"] else {
            throw DeepLinkError.parsingFailed("Missing ID for proposal destination")
        }

        return DeepLinkParseResult(
            destination: .proposal(id: id),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseWikiDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard let slug = pathComponents.first ?? queryParams["slug"] ?? queryParams["page"] else {
            throw DeepLinkError.parsingFailed("Missing slug for wiki destination")
        }

        return DeepLinkParseResult(
            destination: .wiki(slug: slug),
            originalURL: url,
            metadata: queryParams
        )
    }

    private static func parseRelayDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        // Relay URL might be URL-encoded in the path
        if let relayURL = pathComponents.first?.removingPercentEncoding ?? queryParams["url"] {
            return DeepLinkParseResult(
                destination: .relay(url: relayURL),
                originalURL: url,
                metadata: queryParams
            )
        }

        throw DeepLinkError.parsingFailed("Missing URL for relay destination")
    }

    // MARK: - Widget Destination Parsers

    /// Parse messages destination from widget deep link
    /// Format: buildit://messages/[type]/[id]?[query]
    /// Examples:
    /// - buildit://messages (messages list)
    /// - buildit://messages/direct/pubkey123
    /// - buildit://messages/group/messageId?group=GroupName
    private static func parseMessagesDestination(
        pathComponents: [String],
        queryParams: [String: String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard !pathComponents.isEmpty else {
            return DeepLinkParseResult(destination: .messages, originalURL: url)
        }

        switch pathComponents[0].lowercased() {
        case "direct":
            guard pathComponents.count > 1 else {
                return DeepLinkParseResult(destination: .messages, originalURL: url)
            }
            let publicKey = pathComponents[1]
            return DeepLinkParseResult(
                destination: .directMessage(publicKey: publicKey),
                originalURL: url,
                metadata: queryParams
            )

        case "group":
            guard pathComponents.count > 1 else {
                return DeepLinkParseResult(destination: .messages, originalURL: url)
            }
            let messageId = pathComponents[1]
            let groupName = queryParams["group"]
            return DeepLinkParseResult(
                destination: .groupMessage(messageId: messageId, groupName: groupName),
                originalURL: url,
                metadata: queryParams
            )

        default:
            return DeepLinkParseResult(destination: .messages, originalURL: url)
        }
    }

    /// Parse events list destination from widget deep link
    /// Format: buildit://events/[eventId]
    private static func parseEventsListDestination(
        pathComponents: [String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard !pathComponents.isEmpty else {
            return DeepLinkParseResult(destination: .events, originalURL: url)
        }

        let eventId = pathComponents[0]
        return DeepLinkParseResult(
            destination: .eventDetail(eventId: eventId),
            originalURL: url
        )
    }

    /// Parse widget quick action destination
    /// Format: buildit://action/[action-type]
    private static func parseWidgetActionDestination(
        pathComponents: [String],
        url: URL
    ) throws -> DeepLinkParseResult {
        guard !pathComponents.isEmpty,
              let actionType = WidgetQuickAction(rawValue: pathComponents[0]) else {
            throw DeepLinkError.parsingFailed("Invalid widget action")
        }

        return DeepLinkParseResult(
            destination: .widgetAction(actionType),
            originalURL: url
        )
    }

    // MARK: - Helper Methods

    /// Parse a standalone Nostr entity string
    private static func parseNostrEntity(_ entity: String, url: URL) throws -> DeepLinkParseResult {
        do {
            let nostrEntity = try NostrURIParser.parse(entity)
            let destination = try destinationFromNostrEntity(nostrEntity)
            return DeepLinkParseResult(destination: destination, originalURL: url)
        } catch let error as NostrURIParserError {
            throw DeepLinkError.nostrParsingFailed(error)
        }
    }

    /// Resolve a pubkey identifier (could be npub, nprofile, or hex)
    private static func resolvePubkey(_ identifier: String) throws -> String {
        if identifier.hasPrefix("npub") || identifier.hasPrefix("nprofile") {
            return try NostrURIParser.npubToHex(identifier)
        }

        // Assume hex format
        return identifier.lowercased()
    }

    /// Parse query parameters from URL
    private static func parseQueryParameters(url: URL) -> [String: String] {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            return [:]
        }

        var params: [String: String] = [:]
        for item in queryItems {
            params[item.name] = item.value
        }
        return params
    }

    /// Parse relay hints from query parameters
    private static func parseRelayHints(queryParams: [String: String]) -> [String] {
        var relays: [String] = []

        // Single relay parameter
        if let relay = queryParams["relay"] {
            relays.append(relay)
        }

        // Multiple relays (relay[]=...)
        for (key, value) in queryParams {
            if key.hasPrefix("relay[") || key == "relays" {
                // Split by comma for comma-separated values
                relays.append(contentsOf: value.split(separator: ",").map(String.init))
            }
        }

        // r parameter (shorthand)
        if let r = queryParams["r"] {
            relays.append(contentsOf: r.split(separator: ",").map(String.init))
        }

        return relays.map { relay in
            // Ensure wss:// prefix if missing
            if !relay.hasPrefix("wss://") && !relay.hasPrefix("ws://") {
                return "wss://\(relay)"
            }
            return relay
        }
    }
}
