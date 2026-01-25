// BuildItTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Unit tests for BuildIt core functionality.

import XCTest
@testable import BuildIt

final class BuildItTests: XCTestCase {

    // MARK: - Crypto Tests

    func testBech32Encoding() {
        // Test npub encoding
        let testData = Data(repeating: 0xAB, count: 32)
        let encoded = Bech32.encode(hrp: "npub", data: testData)

        XCTAssertTrue(encoded.hasPrefix("npub"))

        // Test decoding
        if let (hrp, decoded) = Bech32.decode(encoded) {
            XCTAssertEqual(hrp, "npub")
            XCTAssertEqual(decoded, testData)
        } else {
            XCTFail("Failed to decode bech32")
        }
    }

    func testHexConversion() {
        let original = Data([0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF])
        let hex = original.hexString
        XCTAssertEqual(hex, "0123456789abcdef")

        if let converted = Data(hexString: hex) {
            XCTAssertEqual(converted, original)
        } else {
            XCTFail("Failed to convert hex to data")
        }
    }

    // MARK: - Mesh Message Tests

    func testMeshMessageEncoding() throws {
        let message = MeshMessage(
            id: "test-id",
            sourcePublicKey: "abc123",
            destinationPublicKey: "def456",
            payload: Data("Hello".utf8),
            timestamp: Date(),
            ttl: 10,
            hopCount: 0,
            signature: "sig",
            type: .direct
        )

        let encoded = try message.encode()
        XCTAssertFalse(encoded.isEmpty)

        let decoded = try MeshMessage.decode(from: encoded)
        XCTAssertEqual(decoded.id, message.id)
        XCTAssertEqual(decoded.sourcePublicKey, message.sourcePublicKey)
        XCTAssertEqual(decoded.destinationPublicKey, message.destinationPublicKey)
        XCTAssertEqual(decoded.ttl, message.ttl)
    }

    func testMeshMessageForwarding() {
        let original = MeshMessage(
            id: "test-id",
            sourcePublicKey: "abc123",
            destinationPublicKey: "def456",
            payload: Data("Hello".utf8),
            timestamp: Date(),
            ttl: 10,
            hopCount: 0,
            signature: "sig",
            type: .direct
        )

        let forwarded = original.forwarded()
        XCTAssertEqual(forwarded.id, original.id)
        XCTAssertEqual(forwarded.ttl, original.ttl - 1)
        XCTAssertEqual(forwarded.hopCount, original.hopCount + 1)
    }

    // MARK: - Nostr Tests

    func testNostrEventIdCreation() {
        let pubkey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        let createdAt = 1234567890
        let kind = 1
        let tags: [[String]] = [["p", "abc123"]]
        let content = "Hello, Nostr!"

        let eventId = NostrEvent.createId(
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind,
            tags: tags,
            content: content
        )

        XCTAssertEqual(eventId.count, 64) // SHA256 hex is 64 characters
    }

    func testNostrFilterEncoding() throws {
        let filter = NostrFilter(
            authors: ["pubkey1", "pubkey2"],
            kinds: [1, 4],
            limit: 100
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(filter)
        let json = String(data: data, encoding: .utf8)

        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("authors"))
        XCTAssertTrue(json!.contains("kinds"))
    }

    // MARK: - Contact Tests

    func testContactDisplayName() {
        var contact = Contact(publicKey: "abc123def456")
        XCTAssertEqual(contact.displayName, "abc123de...")

        contact.name = "Alice"
        XCTAssertEqual(contact.displayName, "Alice")
    }

    // MARK: - Group Tests

    func testGroupCreation() {
        let group = Group(name: "Test Group", createdBy: "creator-pubkey")

        XCTAssertEqual(group.name, "Test Group")
        XCTAssertEqual(group.createdBy, "creator-pubkey")
        XCTAssertTrue(group.memberPublicKeys.contains("creator-pubkey"))
        XCTAssertTrue(group.adminPublicKeys.contains("creator-pubkey"))
        XCTAssertTrue(group.isPrivate)
    }

    // MARK: - Queue Message Tests

    func testQueuedMessageCreation() {
        let message = QueuedMessage(
            id: "msg-1",
            content: "Test content",
            senderPublicKey: "sender",
            recipientPublicKey: "recipient",
            timestamp: Date(),
            eventId: nil
        )

        XCTAssertFalse(message.isRead)
        XCTAssertFalse(message.isDelivered)
        XCTAssertNil(message.deliveredAt)
    }

    // MARK: - Relay Config Tests

    func testRelayConfigDefaults() {
        let relay = RelayConfig(url: "wss://relay.example.com")

        XCTAssertTrue(relay.isEnabled)
        XCTAssertTrue(relay.isReadable)
        XCTAssertTrue(relay.isWritable)
    }

    // MARK: - Transport Tests

    func testTransportTypeRawValues() {
        XCTAssertEqual(TransportType.ble.rawValue, "BLE Mesh")
        XCTAssertEqual(TransportType.nostr.rawValue, "Nostr")
        XCTAssertEqual(TransportType.both.rawValue, "Both")
    }

    func testMessagePriorityComparison() {
        XCTAssertTrue(MessagePriority.low < MessagePriority.normal)
        XCTAssertTrue(MessagePriority.normal < MessagePriority.high)
        XCTAssertTrue(MessagePriority.high < MessagePriority.urgent)
    }

    // MARK: - BLE Constants Tests

    func testBLEServiceUUID() {
        let uuid = BuildItBLEConstants.serviceUUID
        XCTAssertEqual(uuid.uuidString, "12345678-1234-5678-1234-56789ABCDEF0")
    }
}
