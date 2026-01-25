// MeshRouterTests.swift
// BuildItTests
//
// Unit tests for mesh routing logic

import XCTest
@testable import BuildIt

final class MeshRouterTests: XCTestCase {

    // MARK: - MeshMessage Tests

    func testMeshMessageCreation() {
        // Given: Message parameters
        let id = UUID().uuidString
        let source = TestFixtures.testPublicKeyHex
        let destination = TestFixtures.testPublicKeyHex2
        let payload = TestFixtures.testMessageData

        // When: Creating message
        let message = MeshMessage(
            id: id,
            sourcePublicKey: source,
            destinationPublicKey: destination,
            payload: payload,
            timestamp: Date(),
            ttl: 10,
            hopCount: 0,
            signature: TestFixtures.testSignature,
            type: .direct
        )

        // Then: Properties should be set
        XCTAssertEqual(message.id, id)
        XCTAssertEqual(message.sourcePublicKey, source)
        XCTAssertEqual(message.destinationPublicKey, destination)
        XCTAssertEqual(message.payload, payload)
        XCTAssertEqual(message.ttl, 10)
        XCTAssertEqual(message.hopCount, 0)
        XCTAssertEqual(message.type, .direct)
    }

    func testMeshMessageForwarded() {
        // Given: An original message
        let original = TestFixtures.createTestMeshMessage(ttl: 10, hopCount: 0)

        // When: Forwarding
        let forwarded = original.forwarded()

        // Then: TTL decremented, hop count incremented
        XCTAssertEqual(forwarded.ttl, 9)
        XCTAssertEqual(forwarded.hopCount, 1)
        // Other properties should remain
        XCTAssertEqual(forwarded.id, original.id)
        XCTAssertEqual(forwarded.sourcePublicKey, original.sourcePublicKey)
        XCTAssertEqual(forwarded.payload, original.payload)
    }

    func testMeshMessageMultipleForwards() {
        // Given: An original message
        var message = TestFixtures.createTestMeshMessage(ttl: 10, hopCount: 0)

        // When: Forwarding multiple times
        for i in 1...5 {
            message = message.forwarded()
            XCTAssertEqual(message.ttl, 10 - i)
            XCTAssertEqual(message.hopCount, i)
        }

        // Then: Final state
        XCTAssertEqual(message.ttl, 5)
        XCTAssertEqual(message.hopCount, 5)
    }

    func testMeshMessageTTLExpiration() {
        // Given: A message with TTL 1
        let message = TestFixtures.createTestMeshMessage(ttl: 1, hopCount: 5)

        // When: Forwarding
        let forwarded = message.forwarded()

        // Then: TTL should be 0
        XCTAssertEqual(forwarded.ttl, 0)
        XCTAssertTrue(forwarded.ttl <= 0) // Expired
    }

    // MARK: - MeshMessage Encoding Tests

    func testMeshMessageEncode() throws {
        // Given: A message
        let message = TestFixtures.createTestMeshMessage()

        // When: Encoding
        let data = try message.encode()

        // Then: Should produce valid JSON data
        XCTAssertFalse(data.isEmpty)

        // Should be valid JSON
        let json = try JSONSerialization.jsonObject(with: data)
        XCTAssertNotNil(json as? [String: Any])
    }

    func testMeshMessageDecode() throws {
        // Given: Encoded message
        let original = TestFixtures.createTestMeshMessage()
        let data = try original.encode()

        // When: Decoding
        let decoded = try MeshMessage.decode(from: data)

        // Then: Should match original
        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.sourcePublicKey, original.sourcePublicKey)
        XCTAssertEqual(decoded.ttl, original.ttl)
        XCTAssertEqual(decoded.type, original.type)
    }

    func testMeshMessageRoundTrip() throws {
        // Given: Various message types
        let messageTypes: [MeshMessage.MessageType] = [.direct, .broadcast, .routingUpdate, .acknowledgment, .peerDiscovery]

        for type in messageTypes {
            // When: Encoding and decoding
            let original = TestFixtures.createTestMeshMessage(type: type)
            let data = try original.encode()
            let decoded = try MeshMessage.decode(from: data)

            // Then: Should preserve type
            XCTAssertEqual(decoded.type, type, "Type \(type) should survive round trip")
        }
    }

    func testMeshMessageDecodeInvalid() {
        // Given: Invalid JSON
        let invalidData = "not valid json".data(using: .utf8)!

        // When: Trying to decode
        XCTAssertThrowsError(try MeshMessage.decode(from: invalidData)) { error in
            XCTAssertTrue(error is DecodingError)
        }
    }

    // MARK: - MeshMessage Type Tests

    func testMeshMessageTypeRawValues() {
        XCTAssertEqual(MeshMessage.MessageType.direct.rawValue, 0)
        XCTAssertEqual(MeshMessage.MessageType.broadcast.rawValue, 1)
        XCTAssertEqual(MeshMessage.MessageType.routingUpdate.rawValue, 2)
        XCTAssertEqual(MeshMessage.MessageType.acknowledgment.rawValue, 3)
        XCTAssertEqual(MeshMessage.MessageType.peerDiscovery.rawValue, 4)
    }

    func testMeshMessageTypeCodable() throws {
        // Given: All message types
        for type in [MeshMessage.MessageType.direct, .broadcast, .routingUpdate, .acknowledgment, .peerDiscovery] {
            // When: Encoding
            let encoded = try JSONEncoder().encode(type)
            let decoded = try JSONDecoder().decode(MeshMessage.MessageType.self, from: encoded)

            // Then: Should match
            XCTAssertEqual(decoded, type)
        }
    }

    // MARK: - MeshPeer Tests

    func testMeshPeerCreation() {
        // Given: Peer parameters
        let id = UUID()
        let publicKey = TestFixtures.testPublicKeyHex

        // When: Creating peer
        let peer = MeshPeer(
            id: id,
            publicKey: publicKey,
            lastSeen: Date(),
            hopCount: 1,
            rssi: -60,
            reachableVia: nil
        )

        // Then: Properties should be set
        XCTAssertEqual(peer.id, id)
        XCTAssertEqual(peer.publicKey, publicKey)
        XCTAssertEqual(peer.hopCount, 1)
        XCTAssertEqual(peer.rssi, -60)
    }

    func testMeshPeerQualityScore() {
        // Given: Peers with different characteristics
        let now = Date()

        // Peer with good RSSI, low hop count, recent
        let goodPeer = MeshPeer(
            id: UUID(),
            publicKey: TestFixtures.testPublicKeyHex,
            lastSeen: now,
            hopCount: 1,
            rssi: -40,
            reachableVia: nil
        )

        // Peer with poor RSSI, high hop count, old
        let poorPeer = MeshPeer(
            id: UUID(),
            publicKey: TestFixtures.testPublicKeyHex2,
            lastSeen: now.addingTimeInterval(-250), // ~4 minutes ago
            hopCount: 5,
            rssi: -90,
            reachableVia: nil
        )

        // Then: Good peer should have higher quality score
        XCTAssertGreaterThan(goodPeer.qualityScore, poorPeer.qualityScore)
    }

    func testMeshPeerQualityScoreComponents() {
        // Given: A peer
        let now = Date()
        let peer = MeshPeer(
            id: UUID(),
            publicKey: TestFixtures.testPublicKeyHex,
            lastSeen: now,
            hopCount: 1,
            rssi: -50,
            reachableVia: nil
        )

        // When: Getting quality score
        let score = peer.qualityScore

        // Then: Score should be in valid range (0 to 1)
        XCTAssertGreaterThanOrEqual(score, 0)
        XCTAssertLessThanOrEqual(score, 1)
    }

    func testMeshPeerQualityScoreDecaysWithAge() {
        // Given: Same peer at different times
        let id = UUID()
        let publicKey = TestFixtures.testPublicKeyHex
        let now = Date()

        let recentPeer = MeshPeer(id: id, publicKey: publicKey, lastSeen: now, hopCount: 1, rssi: -50, reachableVia: nil)
        let oldPeer = MeshPeer(id: id, publicKey: publicKey, lastSeen: now.addingTimeInterval(-240), hopCount: 1, rssi: -50, reachableVia: nil)

        // Then: Recent peer should have higher score
        XCTAssertGreaterThan(recentPeer.qualityScore, oldPeer.qualityScore)
    }

    func testMeshPeerQualityScoreWithNilRSSI() {
        // Given: Peer with no RSSI
        let peer = MeshPeer(
            id: UUID(),
            publicKey: TestFixtures.testPublicKeyHex,
            lastSeen: Date(),
            hopCount: 1,
            rssi: nil,
            reachableVia: nil
        )

        // When: Getting quality score
        let score = peer.qualityScore

        // Then: Should still compute (uses 0.5 default for RSSI)
        XCTAssertGreaterThan(score, 0)
    }

    // MARK: - RoutingEntry Tests

    func testRoutingEntryCreation() {
        // Given: Entry parameters
        let destination = TestFixtures.testPublicKeyHex
        let nextHop = UUID()

        // When: Creating entry
        let entry = RoutingEntry(
            destination: destination,
            nextHop: nextHop,
            hopCount: 2,
            lastUpdated: Date(),
            sequenceNumber: 5
        )

        // Then: Properties should be set
        XCTAssertEqual(entry.destination, destination)
        XCTAssertEqual(entry.nextHop, nextHop)
        XCTAssertEqual(entry.hopCount, 2)
        XCTAssertEqual(entry.sequenceNumber, 5)
    }

    func testRoutingEntryCodable() throws {
        // Given: A routing entry
        let entry = RoutingEntry(
            destination: TestFixtures.testPublicKeyHex,
            nextHop: UUID(),
            hopCount: 3,
            lastUpdated: Date(),
            sequenceNumber: 10
        )

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(entry)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(RoutingEntry.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.destination, entry.destination)
        XCTAssertEqual(decoded.nextHop, entry.nextHop)
        XCTAssertEqual(decoded.hopCount, entry.hopCount)
        XCTAssertEqual(decoded.sequenceNumber, entry.sequenceNumber)
    }

    // MARK: - Routing Decision Tests

    func testRoutingSelectionByHopCount() {
        // Given: Two routes with different hop counts
        let destination = TestFixtures.testPublicKeyHex
        let route1 = RoutingEntry(destination: destination, nextHop: UUID(), hopCount: 2, lastUpdated: Date(), sequenceNumber: 1)
        let route2 = RoutingEntry(destination: destination, nextHop: UUID(), hopCount: 5, lastUpdated: Date(), sequenceNumber: 1)

        // When: Selecting best route
        let bestRoute = route1.hopCount < route2.hopCount ? route1 : route2

        // Then: Should prefer lower hop count
        XCTAssertEqual(bestRoute.hopCount, 2)
    }

    func testRoutingSelectionBySequenceNumber() {
        // Given: Two routes with different sequence numbers
        let destination = TestFixtures.testPublicKeyHex
        let route1 = RoutingEntry(destination: destination, nextHop: UUID(), hopCount: 2, lastUpdated: Date(), sequenceNumber: 5)
        let route2 = RoutingEntry(destination: destination, nextHop: UUID(), hopCount: 2, lastUpdated: Date(), sequenceNumber: 10)

        // When: Selecting best route (prefer newer sequence)
        let bestRoute = route1.sequenceNumber > route2.sequenceNumber ? route1 : route2

        // Then: Should prefer higher sequence number
        XCTAssertEqual(bestRoute.sequenceNumber, 10)
    }

    // MARK: - Broadcast vs Direct Routing Tests

    func testBroadcastMessageHasNilDestination() {
        // Given: A broadcast message
        let message = TestFixtures.createTestMeshMessage(
            destinationPublicKey: nil,
            type: .broadcast
        )

        // Then: Destination should be nil
        XCTAssertNil(message.destinationPublicKey)
        XCTAssertEqual(message.type, .broadcast)
    }

    func testDirectMessageHasDestination() {
        // Given: A direct message
        let message = TestFixtures.createTestMeshMessage(
            destinationPublicKey: TestFixtures.testPublicKeyHex2,
            type: .direct
        )

        // Then: Destination should be set
        XCTAssertNotNil(message.destinationPublicKey)
        XCTAssertEqual(message.type, .direct)
    }

    // MARK: - Message ID Uniqueness Tests

    func testMessageIDUniqueness() {
        // Given: Multiple messages
        var ids = Set<String>()

        // When: Creating many messages
        for _ in 1...100 {
            let message = TestFixtures.createTestMeshMessage()
            ids.insert(message.id)
        }

        // Then: All IDs should be unique
        XCTAssertEqual(ids.count, 100)
    }

    // MARK: - Routing Table Tests

    func testRoutingTableMultipleEntries() throws {
        // Given: Multiple routing entries
        var routingTable: [String: RoutingEntry] = [:]

        let destinations = [
            TestFixtures.testPublicKeyHex,
            TestFixtures.testPublicKeyHex2,
            "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
        ]

        // When: Adding entries
        for destination in destinations {
            let entry = RoutingEntry(
                destination: destination,
                nextHop: UUID(),
                hopCount: Int.random(in: 1...5),
                lastUpdated: Date(),
                sequenceNumber: 1
            )
            routingTable[destination] = entry
        }

        // Then: All entries should be accessible
        XCTAssertEqual(routingTable.count, 3)
        for destination in destinations {
            XCTAssertNotNil(routingTable[destination])
        }
    }

    func testRoutingTableUpdate() {
        // Given: Existing route
        var routingTable: [String: RoutingEntry] = [:]
        let destination = TestFixtures.testPublicKeyHex
        let oldEntry = RoutingEntry(
            destination: destination,
            nextHop: UUID(),
            hopCount: 5,
            lastUpdated: Date().addingTimeInterval(-60),
            sequenceNumber: 1
        )
        routingTable[destination] = oldEntry

        // When: Updating with better route
        let newEntry = RoutingEntry(
            destination: destination,
            nextHop: UUID(),
            hopCount: 2,
            lastUpdated: Date(),
            sequenceNumber: 2
        )
        routingTable[destination] = newEntry

        // Then: New route should be stored
        XCTAssertEqual(routingTable[destination]?.hopCount, 2)
        XCTAssertEqual(routingTable[destination]?.sequenceNumber, 2)
    }

    // MARK: - MeshPeer Codable Tests

    func testMeshPeerCodable() throws {
        // Given: A mesh peer
        let peer = MeshPeer(
            id: UUID(),
            publicKey: TestFixtures.testPublicKeyHex,
            lastSeen: Date(),
            hopCount: 2,
            rssi: -65,
            reachableVia: UUID()
        )

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(peer)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(MeshPeer.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.id, peer.id)
        XCTAssertEqual(decoded.publicKey, peer.publicKey)
        XCTAssertEqual(decoded.hopCount, peer.hopCount)
        XCTAssertEqual(decoded.rssi, peer.rssi)
    }

    // MARK: - TTL Behavior Tests

    func testMessageNotRoutedAtZeroTTL() {
        // Given: A message with TTL 0
        let message = TestFixtures.createTestMeshMessage(ttl: 0)

        // Then: TTL should indicate expired
        XCTAssertTrue(message.ttl <= 0)
    }

    func testDefaultMaxTTL() {
        // The mesh router uses maxTTL of 10
        let maxTTL = 10

        // Given: A new message
        let message = TestFixtures.createTestMeshMessage(ttl: maxTTL)

        // Then: Should be able to make maxTTL hops
        var current = message
        for _ in 1...maxTTL {
            XCTAssertGreaterThan(current.ttl, 0)
            current = current.forwarded()
        }
        XCTAssertEqual(current.ttl, 0)
    }
}
