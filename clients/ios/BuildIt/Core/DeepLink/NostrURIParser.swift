// NostrURIParser.swift
// BuildIt - Decentralized Mesh Communication
//
// Parses Nostr URIs including npub, note, nevent, and nprofile bech32 formats.
// Supports NIP-19 bech32-encoded entities with relay hints and metadata.

import Foundation
import os.log

/// Represents a parsed Nostr entity from a bech32-encoded string
enum NostrEntity: Equatable, Sendable {
    /// Public key (npub1...)
    case pubkey(hex: String)

    /// Note/Event ID (note1...)
    case note(id: String)

    /// Event with relay hints (nevent1...)
    case nevent(id: String, relays: [String], author: String?, kind: Int?)

    /// Profile with relay hints (nprofile1...)
    case nprofile(pubkey: String, relays: [String])

    /// Relay address (nrelay1...)
    case relay(url: String)

    /// Private key (nsec1...) - handle with care
    case secret(hex: String)

    /// Addressable event (naddr1...)
    case naddr(identifier: String, pubkey: String, kind: Int, relays: [String])
}

/// Errors that can occur during Nostr URI parsing
enum NostrURIParserError: LocalizedError {
    case invalidFormat
    case invalidChecksum
    case unsupportedPrefix
    case decodingFailed
    case invalidTLVData
    case missingRequiredField(String)

    var errorDescription: String? {
        switch self {
        case .invalidFormat:
            return "Invalid bech32 format"
        case .invalidChecksum:
            return "Invalid checksum"
        case .unsupportedPrefix:
            return "Unsupported prefix"
        case .decodingFailed:
            return "Failed to decode bech32 data"
        case .invalidTLVData:
            return "Invalid TLV-encoded data"
        case .missingRequiredField(let field):
            return "Missing required field: \(field)"
        }
    }
}

/// Parser for Nostr URIs and bech32-encoded entities
/// Supports NIP-19 encoded identifiers: npub, nsec, note, nevent, nprofile, nrelay, naddr
struct NostrURIParser {
    private static let logger = Logger(subsystem: "com.buildit", category: "NostrURIParser")

    // MARK: - TLV Type Constants (NIP-19)

    /// TLV type for special (main value)
    private static let tlvTypeSpecial: UInt8 = 0
    /// TLV type for relay
    private static let tlvTypeRelay: UInt8 = 1
    /// TLV type for author
    private static let tlvTypeAuthor: UInt8 = 2
    /// TLV type for kind
    private static let tlvTypeKind: UInt8 = 3

    // MARK: - Public Methods

    /// Parse a Nostr URI string (nostr:... or just the bech32 part)
    /// - Parameter uri: The URI string to parse
    /// - Returns: The parsed NostrEntity
    /// - Throws: NostrURIParserError if parsing fails
    static func parse(_ uri: String) throws -> NostrEntity {
        // Strip nostr: prefix if present
        let bech32String: String
        if uri.lowercased().hasPrefix("nostr:") {
            bech32String = String(uri.dropFirst(6))
        } else {
            bech32String = uri
        }

        // Decode bech32
        guard let (hrp, data) = Bech32.decode(bech32String) else {
            throw NostrURIParserError.invalidFormat
        }

        // Parse based on human-readable part
        switch hrp {
        case "npub":
            guard data.count == 32 else {
                throw NostrURIParserError.invalidFormat
            }
            return .pubkey(hex: data.hexString)

        case "nsec":
            guard data.count == 32 else {
                throw NostrURIParserError.invalidFormat
            }
            return .secret(hex: data.hexString)

        case "note":
            guard data.count == 32 else {
                throw NostrURIParserError.invalidFormat
            }
            return .note(id: data.hexString)

        case "nevent":
            return try parseNevent(data: data)

        case "nprofile":
            return try parseNprofile(data: data)

        case "nrelay":
            return try parseNrelay(data: data)

        case "naddr":
            return try parseNaddr(data: data)

        default:
            throw NostrURIParserError.unsupportedPrefix
        }
    }

    /// Parse npub to hex pubkey
    /// - Parameter npub: The npub1... string
    /// - Returns: The 64-character hex pubkey
    /// - Throws: NostrURIParserError if parsing fails
    static func npubToHex(_ npub: String) throws -> String {
        let entity = try parse(npub)

        switch entity {
        case .pubkey(let hex):
            return hex
        case .nprofile(let pubkey, _):
            return pubkey
        default:
            throw NostrURIParserError.invalidFormat
        }
    }

    /// Parse note1 to event ID
    /// - Parameter note: The note1... string
    /// - Returns: The 64-character hex event ID
    /// - Throws: NostrURIParserError if parsing fails
    static func noteToEventId(_ note: String) throws -> String {
        let entity = try parse(note)

        switch entity {
        case .note(let id):
            return id
        case .nevent(let id, _, _, _):
            return id
        default:
            throw NostrURIParserError.invalidFormat
        }
    }

    /// Convert hex pubkey to npub
    /// - Parameter hex: The 64-character hex pubkey
    /// - Returns: The npub1... string
    static func hexToNpub(_ hex: String) -> String? {
        guard let data = Data(hexString: hex), data.count == 32 else {
            return nil
        }
        return Bech32.encode(hrp: "npub", data: data)
    }

    /// Convert hex event ID to note
    /// - Parameter hex: The 64-character hex event ID
    /// - Returns: The note1... string
    static func hexToNote(_ hex: String) -> String? {
        guard let data = Data(hexString: hex), data.count == 32 else {
            return nil
        }
        return Bech32.encode(hrp: "note", data: data)
    }

    /// Create nevent bech32 string
    /// - Parameters:
    ///   - eventId: The event ID (hex)
    ///   - relays: Optional relay hints
    ///   - author: Optional author pubkey (hex)
    ///   - kind: Optional event kind
    /// - Returns: The nevent1... string
    static func createNevent(
        eventId: String,
        relays: [String] = [],
        author: String? = nil,
        kind: Int? = nil
    ) -> String? {
        guard let eventIdData = Data(hexString: eventId), eventIdData.count == 32 else {
            return nil
        }

        var tlvData = Data()

        // Add event ID (type 0)
        tlvData.append(tlvTypeSpecial)
        tlvData.append(UInt8(eventIdData.count))
        tlvData.append(eventIdData)

        // Add relays (type 1)
        for relay in relays {
            if let relayData = relay.data(using: .utf8) {
                tlvData.append(tlvTypeRelay)
                tlvData.append(UInt8(relayData.count))
                tlvData.append(relayData)
            }
        }

        // Add author (type 2)
        if let author = author, let authorData = Data(hexString: author), authorData.count == 32 {
            tlvData.append(tlvTypeAuthor)
            tlvData.append(UInt8(authorData.count))
            tlvData.append(authorData)
        }

        // Add kind (type 3) - big endian 32-bit
        if let kind = kind {
            tlvData.append(tlvTypeKind)
            tlvData.append(4)
            var kindBE = UInt32(kind).bigEndian
            tlvData.append(Data(bytes: &kindBE, count: 4))
        }

        return Bech32.encode(hrp: "nevent", data: tlvData)
    }

    /// Create nprofile bech32 string
    /// - Parameters:
    ///   - pubkey: The pubkey (hex)
    ///   - relays: Optional relay hints
    /// - Returns: The nprofile1... string
    static func createNprofile(pubkey: String, relays: [String] = []) -> String? {
        guard let pubkeyData = Data(hexString: pubkey), pubkeyData.count == 32 else {
            return nil
        }

        var tlvData = Data()

        // Add pubkey (type 0)
        tlvData.append(tlvTypeSpecial)
        tlvData.append(UInt8(pubkeyData.count))
        tlvData.append(pubkeyData)

        // Add relays (type 1)
        for relay in relays {
            if let relayData = relay.data(using: .utf8) {
                tlvData.append(tlvTypeRelay)
                tlvData.append(relayData.count > 255 ? 255 : UInt8(relayData.count))
                tlvData.append(relayData.prefix(255))
            }
        }

        return Bech32.encode(hrp: "nprofile", data: tlvData)
    }

    // MARK: - Private TLV Parsing Methods

    /// Parse nevent TLV data
    private static func parseNevent(data: Data) throws -> NostrEntity {
        let tlv = try parseTLV(data: data)

        guard let eventIdData = tlv[tlvTypeSpecial]?.first, eventIdData.count == 32 else {
            throw NostrURIParserError.missingRequiredField("event_id")
        }

        let relays = (tlv[tlvTypeRelay] ?? []).compactMap { data in
            String(data: data, encoding: .utf8)
        }

        let author: String? = tlv[tlvTypeAuthor]?.first.flatMap { data in
            data.count == 32 ? data.hexString : nil
        }

        let kind: Int? = tlv[tlvTypeKind]?.first.flatMap { data in
            guard data.count == 4 else { return nil }
            let value = data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
            return Int(value)
        }

        return .nevent(
            id: eventIdData.hexString,
            relays: relays,
            author: author,
            kind: kind
        )
    }

    /// Parse nprofile TLV data
    private static func parseNprofile(data: Data) throws -> NostrEntity {
        let tlv = try parseTLV(data: data)

        guard let pubkeyData = tlv[tlvTypeSpecial]?.first, pubkeyData.count == 32 else {
            throw NostrURIParserError.missingRequiredField("pubkey")
        }

        let relays = (tlv[tlvTypeRelay] ?? []).compactMap { data in
            String(data: data, encoding: .utf8)
        }

        return .nprofile(pubkey: pubkeyData.hexString, relays: relays)
    }

    /// Parse nrelay TLV data
    private static func parseNrelay(data: Data) throws -> NostrEntity {
        let tlv = try parseTLV(data: data)

        guard let relayData = tlv[tlvTypeSpecial]?.first,
              let url = String(data: relayData, encoding: .utf8) else {
            throw NostrURIParserError.missingRequiredField("relay_url")
        }

        return .relay(url: url)
    }

    /// Parse naddr TLV data
    private static func parseNaddr(data: Data) throws -> NostrEntity {
        let tlv = try parseTLV(data: data)

        guard let identifierData = tlv[tlvTypeSpecial]?.first,
              let identifier = String(data: identifierData, encoding: .utf8) else {
            throw NostrURIParserError.missingRequiredField("identifier")
        }

        guard let pubkeyData = tlv[tlvTypeAuthor]?.first, pubkeyData.count == 32 else {
            throw NostrURIParserError.missingRequiredField("pubkey")
        }

        guard let kindData = tlv[tlvTypeKind]?.first, kindData.count == 4 else {
            throw NostrURIParserError.missingRequiredField("kind")
        }

        let kind = kindData.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }

        let relays = (tlv[tlvTypeRelay] ?? []).compactMap { data in
            String(data: data, encoding: .utf8)
        }

        return .naddr(
            identifier: identifier,
            pubkey: pubkeyData.hexString,
            kind: Int(kind),
            relays: relays
        )
    }

    /// Parse TLV (Type-Length-Value) encoded data
    /// Returns a dictionary mapping type to list of values
    private static func parseTLV(data: Data) throws -> [UInt8: [Data]] {
        var result: [UInt8: [Data]] = [:]
        var offset = 0

        while offset < data.count {
            guard offset + 2 <= data.count else {
                throw NostrURIParserError.invalidTLVData
            }

            let type = data[offset]
            let length = Int(data[offset + 1])
            offset += 2

            guard offset + length <= data.count else {
                throw NostrURIParserError.invalidTLVData
            }

            let value = data[offset..<(offset + length)]
            result[type, default: []].append(Data(value))
            offset += length
        }

        return result
    }
}

// MARK: - Convenience Extensions

extension NostrEntity {
    /// Get the primary identifier (hex) from the entity
    var primaryIdentifier: String {
        switch self {
        case .pubkey(let hex):
            return hex
        case .note(let id):
            return id
        case .nevent(let id, _, _, _):
            return id
        case .nprofile(let pubkey, _):
            return pubkey
        case .relay(let url):
            return url
        case .secret(let hex):
            return hex
        case .naddr(let identifier, _, _, _):
            return identifier
        }
    }

    /// Get relay hints if available
    var relayHints: [String] {
        switch self {
        case .nevent(_, let relays, _, _):
            return relays
        case .nprofile(_, let relays):
            return relays
        case .naddr(_, _, _, let relays):
            return relays
        default:
            return []
        }
    }

    /// Check if this entity represents a user/profile
    var isProfile: Bool {
        switch self {
        case .pubkey, .nprofile:
            return true
        default:
            return false
        }
    }

    /// Check if this entity represents an event
    var isEvent: Bool {
        switch self {
        case .note, .nevent:
            return true
        default:
            return false
        }
    }
}
