// TestFixtures.swift
// BuildItTests
//
// Test data fixtures for unit testing

import Foundation
@testable import BuildIt

/// Test fixtures providing consistent test data across all tests
enum TestFixtures {
    // MARK: - Key Pairs

    /// Test private key (32 bytes hex)
    static let testPrivateKeyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    /// Second test private key for recipient
    static let testPrivateKeyHex2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"

    /// Test private key as Data
    static var testPrivateKey: Data {
        Data(hexString: testPrivateKeyHex)!
    }

    /// Second test private key as Data
    static var testPrivateKey2: Data {
        Data(hexString: testPrivateKeyHex2)!
    }

    // MARK: - Public Keys

    /// Test public key (derived from testPrivateKeyHex)
    static let testPublicKeyHex = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

    /// Second test public key
    static let testPublicKeyHex2 = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"

    // MARK: - Bech32 Keys

    /// Test nsec (bech32-encoded private key)
    static let testNsec = "nsec1qy2k3l4m5n6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5j6k7l8"

    /// Test npub (bech32-encoded public key)
    static let testNpub = "npub1wy2k3l4m5n6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5j6k7l8"

    // MARK: - Messages

    /// Test message content
    static let testMessageContent = "Hello, BuildIt!"

    /// Test message content as Data
    static var testMessageData: Data {
        testMessageContent.data(using: .utf8)!
    }

    /// Longer test message for chunking tests
    static let longMessageContent = String(repeating: "This is a long message for testing chunking. ", count: 50)

    /// Very large message for stress testing
    static let veryLargeMessageContent = String(repeating: "X", count: 10000)

    // MARK: - Nostr Events

    /// Test Nostr event ID
    static let testEventId = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"

    /// Test Nostr signature
    static let testSignature = "sig123456789abcdef123456789abcdef123456789abcdef123456789abcdef12"

    /// Test Nostr event timestamp
    static let testTimestamp = Int(Date(timeIntervalSince1970: 1700000000).timeIntervalSince1970)

    /// Create a test NostrEvent
    static func createTestNostrEvent(
        id: String = testEventId,
        pubkey: String = testPublicKeyHex,
        kind: Int = 1,
        content: String = testMessageContent,
        tags: [[String]] = []
    ) -> NostrEvent {
        NostrEvent(
            id: id,
            pubkey: pubkey,
            created_at: testTimestamp,
            kind: kind,
            tags: tags,
            content: content,
            sig: testSignature
        )
    }

    /// Create a test NostrFilter
    static func createTestNostrFilter(
        authors: [String]? = nil,
        kinds: [Int]? = nil,
        since: Int? = nil
    ) -> NostrFilter {
        NostrFilter(
            ids: nil,
            authors: authors,
            kinds: kinds,
            since: since
        )
    }

    // MARK: - Mesh Messages

    /// Create a test MeshMessage
    static func createTestMeshMessage(
        id: String = UUID().uuidString,
        sourcePublicKey: String = testPublicKeyHex,
        destinationPublicKey: String? = testPublicKeyHex2,
        payload: Data = testMessageData,
        ttl: Int = 10,
        hopCount: Int = 0,
        type: MeshMessage.MessageType = .direct
    ) -> MeshMessage {
        MeshMessage(
            id: id,
            sourcePublicKey: sourcePublicKey,
            destinationPublicKey: destinationPublicKey,
            payload: payload,
            timestamp: Date(),
            ttl: ttl,
            hopCount: hopCount,
            signature: testSignature,
            type: type
        )
    }

    // MARK: - Contacts

    /// Create a test Contact
    static func createTestContact(
        publicKey: String = testPublicKeyHex,
        name: String? = "Test User"
    ) -> Contact {
        var contact = Contact(publicKey: publicKey, name: name)
        contact.npub = testNpub
        return contact
    }

    // MARK: - Groups

    /// Create a test Group
    static func createTestGroup(
        name: String = "Test Group",
        createdBy: String = testPublicKeyHex
    ) -> Group {
        Group(name: name, createdBy: createdBy)
    }

    // MARK: - Relay Configuration

    /// Test relay URLs
    static let testRelayURLs = [
        "wss://relay.test.com",
        "wss://relay2.test.com",
        "wss://relay3.test.com"
    ]

    /// Create a test RelayConfig
    static func createTestRelayConfig(
        url: String = "wss://relay.test.com"
    ) -> RelayConfig {
        RelayConfig(url: url)
    }

    // MARK: - UUIDs

    /// Test peer UUID
    static let testPeerUUID = UUID()

    /// Second test peer UUID
    static let testPeerUUID2 = UUID()

    // MARK: - Encrypted Messages

    /// Test nonce (24 bytes)
    static let testNonce = Data(repeating: 0xAB, count: 24)

    /// Test ciphertext
    static let testCiphertext = Data(repeating: 0xCD, count: 32)

    /// Create a test EncryptedMessage
    static func createTestEncryptedMessage() -> EncryptedMessage {
        EncryptedMessage(ciphertext: testCiphertext, nonce: testNonce)
    }

    // MARK: - NIP-04 Test Data

    /// Test NIP-04 encrypted content format
    static let testNIP04Content = "SGVsbG8gV29ybGQh?iv=YWJjZGVmZ2hpamtsbW5vcA=="

    // MARK: - Queued Messages

    /// Create a test QueuedMessage
    static func createTestQueuedMessage(
        id: String = UUID().uuidString,
        content: String = testMessageContent,
        senderPublicKey: String = testPublicKeyHex,
        recipientPublicKey: String? = testPublicKeyHex2
    ) -> QueuedMessage {
        QueuedMessage(
            id: id,
            content: content,
            senderPublicKey: senderPublicKey,
            recipientPublicKey: recipientPublicKey,
            timestamp: Date(),
            eventId: testEventId
        )
    }

    // MARK: - Routable Messages

    /// Create a test RoutableMessage
    static func createTestRoutableMessage(
        id: String = UUID().uuidString,
        content: Data = testMessageData,
        recipientPublicKey: String? = testPublicKeyHex2,
        priority: MessagePriority = .normal
    ) -> RoutableMessage {
        RoutableMessage(
            id: id,
            content: content,
            recipientPublicKey: recipientPublicKey,
            senderPublicKey: testPublicKeyHex,
            timestamp: Date(),
            priority: priority,
            preferredTransport: .both
        )
    }

    // MARK: - BLE Constants

    /// Test MTU size
    static let testMTU = 512

    /// Test RSSI value
    static let testRSSI = -65

    // MARK: - Timing

    /// Standard async timeout for tests
    static let asyncTimeout: TimeInterval = 5.0

    /// Short timeout for quick operations
    static let shortTimeout: TimeInterval = 1.0
}

// MARK: - Data Extension for Tests

extension Data {
    /// Create test Data of specified size
    static func testData(size: Int) -> Data {
        Data((0..<size).map { UInt8($0 % 256) })
    }

    /// Create random test Data of specified size
    static func randomTestData(size: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: size)
        _ = SecRandomCopyBytes(kSecRandomDefault, size, &bytes)
        return Data(bytes)
    }
}

// MARK: - Date Extension for Tests

extension Date {
    /// Create a test date at a fixed point in time
    static var testDate: Date {
        Date(timeIntervalSince1970: 1700000000)
    }

    /// Create a test date with offset from testDate
    static func testDate(offsetBy seconds: TimeInterval) -> Date {
        testDate.addingTimeInterval(seconds)
    }
}
