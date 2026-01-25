// NostrEventTests.swift
// BuildItTests
//
// Unit tests for Nostr event creation, signing, and verification

import XCTest
import CryptoKit
@testable import BuildIt

final class NostrEventTests: XCTestCase {

    // MARK: - Event Creation Tests

    func testNostrEventCreation() {
        // Given: Event parameters
        let id = TestFixtures.testEventId
        let pubkey = TestFixtures.testPublicKeyHex
        let createdAt = TestFixtures.testTimestamp
        let kind = 1
        let content = TestFixtures.testMessageContent
        let sig = TestFixtures.testSignature

        // When: Creating event
        let event = NostrEvent(
            id: id,
            pubkey: pubkey,
            created_at: createdAt,
            kind: kind,
            tags: [],
            content: content,
            sig: sig
        )

        // Then: Properties should be set
        XCTAssertEqual(event.id, id)
        XCTAssertEqual(event.pubkey, pubkey)
        XCTAssertEqual(event.created_at, createdAt)
        XCTAssertEqual(event.kind, kind)
        XCTAssertEqual(event.content, content)
        XCTAssertEqual(event.sig, sig)
    }

    func testNostrEventIdentifiable() {
        // Given: An event
        let event = TestFixtures.createTestNostrEvent()

        // Then: ID property should work for Identifiable conformance
        XCTAssertEqual(event.id, TestFixtures.testEventId)
    }

    // MARK: - Event ID Generation Tests

    func testNostrEventCreateId() {
        // Given: Event data
        let pubkey = TestFixtures.testPublicKeyHex
        let createdAt = TestFixtures.testTimestamp
        let kind = 1
        let tags: [[String]] = []
        let content = "Hello, Nostr!"

        // When: Creating event ID
        let eventId = NostrEvent.createId(
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind,
            tags: tags,
            content: content
        )

        // Then: Should produce valid hex string
        XCTAssertEqual(eventId.count, 64, "Event ID should be 64 hex characters (32 bytes)")
        XCTAssertTrue(eventId.allSatisfy { $0.isHexDigit })
    }

    func testNostrEventCreateIdConsistency() {
        // Given: Same parameters
        let pubkey = TestFixtures.testPublicKeyHex
        let createdAt = TestFixtures.testTimestamp
        let kind = 1
        let tags: [[String]] = [["e", "abc123"]]
        let content = "Test message"

        // When: Creating ID twice
        let id1 = NostrEvent.createId(pubkey: pubkey, createdAt: createdAt, kind: kind, tags: tags, content: content)
        let id2 = NostrEvent.createId(pubkey: pubkey, createdAt: createdAt, kind: kind, tags: tags, content: content)

        // Then: Should be identical
        XCTAssertEqual(id1, id2, "Same parameters should produce same event ID")
    }

    func testNostrEventCreateIdDifferentContent() {
        // Given: Different content
        let pubkey = TestFixtures.testPublicKeyHex
        let createdAt = TestFixtures.testTimestamp
        let kind = 1
        let tags: [[String]] = []

        // When: Creating IDs with different content
        let id1 = NostrEvent.createId(pubkey: pubkey, createdAt: createdAt, kind: kind, tags: tags, content: "Hello")
        let id2 = NostrEvent.createId(pubkey: pubkey, createdAt: createdAt, kind: kind, tags: tags, content: "World")

        // Then: Should be different
        XCTAssertNotEqual(id1, id2, "Different content should produce different event IDs")
    }

    // MARK: - Event Kind Tests

    func testNostrEventKindRawValues() {
        XCTAssertEqual(NostrEventKind.setMetadata.rawValue, 0)
        XCTAssertEqual(NostrEventKind.textNote.rawValue, 1)
        XCTAssertEqual(NostrEventKind.recommendRelay.rawValue, 2)
        XCTAssertEqual(NostrEventKind.contactList.rawValue, 3)
        XCTAssertEqual(NostrEventKind.encryptedDirectMessage.rawValue, 4)
        XCTAssertEqual(NostrEventKind.deletion.rawValue, 5)
        XCTAssertEqual(NostrEventKind.repost.rawValue, 6)
        XCTAssertEqual(NostrEventKind.reaction.rawValue, 7)
        XCTAssertEqual(NostrEventKind.badgeAward.rawValue, 8)
    }

    func testNostrEventKindChannelTypes() {
        XCTAssertEqual(NostrEventKind.channelCreation.rawValue, 40)
        XCTAssertEqual(NostrEventKind.channelMetadata.rawValue, 41)
        XCTAssertEqual(NostrEventKind.channelMessage.rawValue, 42)
        XCTAssertEqual(NostrEventKind.channelHideMessage.rawValue, 43)
        XCTAssertEqual(NostrEventKind.channelMuteUser.rawValue, 44)
    }

    func testNostrEventKindCustomTypes() {
        XCTAssertEqual(NostrEventKind.meshPeerAnnouncement.rawValue, 30000)
        XCTAssertEqual(NostrEventKind.groupMessage.rawValue, 30001)
        XCTAssertEqual(NostrEventKind.deviceSync.rawValue, 30002)
    }

    // MARK: - Event Tags Tests

    func testNostrEventWithEmptyTags() {
        // Given: Event with no tags
        let event = TestFixtures.createTestNostrEvent(tags: [])

        // Then: Tags should be empty
        XCTAssertTrue(event.tags.isEmpty)
    }

    func testNostrEventWithPTag() {
        // Given: Event with p tag (pubkey reference)
        let referencedPubkey = TestFixtures.testPublicKeyHex2
        let tags = [["p", referencedPubkey]]
        let event = TestFixtures.createTestNostrEvent(tags: tags)

        // Then: Should have p tag
        XCTAssertEqual(event.tags.count, 1)
        XCTAssertEqual(event.tags.first?.first, "p")
        XCTAssertEqual(event.tags.first?[safe: 1], referencedPubkey)
    }

    func testNostrEventWithETag() {
        // Given: Event with e tag (event reference)
        let referencedEventId = TestFixtures.testEventId
        let tags = [["e", referencedEventId]]
        let event = TestFixtures.createTestNostrEvent(tags: tags)

        // Then: Should have e tag
        XCTAssertEqual(event.tags.first?.first, "e")
        XCTAssertEqual(event.tags.first?[safe: 1], referencedEventId)
    }

    func testNostrEventWithMultipleTags() {
        // Given: Event with multiple tags
        let tags = [
            ["p", TestFixtures.testPublicKeyHex],
            ["e", TestFixtures.testEventId],
            ["t", "nostr"],
            ["custom", "value1", "value2"]
        ]
        let event = TestFixtures.createTestNostrEvent(tags: tags)

        // Then: All tags should be present
        XCTAssertEqual(event.tags.count, 4)
    }

    // MARK: - Event Codable Tests

    func testNostrEventCodable() throws {
        // Given: An event
        let event = TestFixtures.createTestNostrEvent()

        // When: Encoding and decoding
        let encoded = try JSONEncoder().encode(event)
        let decoded = try JSONDecoder().decode(NostrEvent.self, from: encoded)

        // Then: Should match
        XCTAssertEqual(decoded.id, event.id)
        XCTAssertEqual(decoded.pubkey, event.pubkey)
        XCTAssertEqual(decoded.created_at, event.created_at)
        XCTAssertEqual(decoded.kind, event.kind)
        XCTAssertEqual(decoded.content, event.content)
        XCTAssertEqual(decoded.sig, event.sig)
    }

    func testNostrEventCodableWithTags() throws {
        // Given: An event with tags
        let tags = [["p", TestFixtures.testPublicKeyHex], ["e", TestFixtures.testEventId]]
        let event = TestFixtures.createTestNostrEvent(tags: tags)

        // When: Encoding and decoding
        let encoded = try JSONEncoder().encode(event)
        let decoded = try JSONDecoder().decode(NostrEvent.self, from: encoded)

        // Then: Tags should match
        XCTAssertEqual(decoded.tags.count, 2)
        XCTAssertEqual(decoded.tags, event.tags)
    }

    // MARK: - NostrFilter Tests

    func testNostrFilterCreation() {
        // Given: Filter parameters
        let filter = NostrFilter(
            ids: ["id1", "id2"],
            authors: [TestFixtures.testPublicKeyHex],
            kinds: [1, 4],
            since: 1700000000,
            limit: 100
        )

        // Then: Properties should be set
        XCTAssertEqual(filter.ids?.count, 2)
        XCTAssertEqual(filter.authors?.count, 1)
        XCTAssertEqual(filter.kinds?.count, 2)
        XCTAssertEqual(filter.since, 1700000000)
        XCTAssertEqual(filter.limit, 100)
    }

    func testNostrFilterCodable() throws {
        // Given: A filter
        let filter = NostrFilter(
            authors: [TestFixtures.testPublicKeyHex],
            kinds: [1],
            since: 1700000000
        )

        // When: Encoding and decoding
        let encoded = try JSONEncoder().encode(filter)
        let decoded = try JSONDecoder().decode(NostrFilter.self, from: encoded)

        // Then: Should match
        XCTAssertEqual(decoded.authors, filter.authors)
        XCTAssertEqual(decoded.kinds, filter.kinds)
        XCTAssertEqual(decoded.since, filter.since)
    }

    func testNostrFilterCodingKeys() throws {
        // Given: A filter with e and p tags
        let filter = NostrFilter(e: ["event1"], p: ["pubkey1"])

        // When: Encoding
        let encoded = try JSONEncoder().encode(filter)
        let json = String(data: encoded, encoding: .utf8)!

        // Then: Should use #e and #p keys
        XCTAssertTrue(json.contains("\"#e\""))
        XCTAssertTrue(json.contains("\"#p\""))
    }

    // MARK: - NostrRelayMessage Tests

    func testNostrRelayMessageParseEvent() {
        // Given: EVENT message data
        let eventJson = """
        ["EVENT", "sub123", {"id":"abc", "pubkey":"def", "created_at":1700000000, "kind":1, "tags":[], "content":"test", "sig":"ghi"}]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(eventJson)

        // Then: Should parse as event
        if case .event(let subId, let event) = message {
            XCTAssertEqual(subId, "sub123")
            XCTAssertEqual(event.id, "abc")
            XCTAssertEqual(event.content, "test")
        } else {
            XCTFail("Should parse as EVENT message")
        }
    }

    func testNostrRelayMessageParseOK() {
        // Given: OK message data
        let okJson = """
        ["OK", "event123", true, "accepted"]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(okJson)

        // Then: Should parse as OK
        if case .ok(let eventId, let success, let msg) = message {
            XCTAssertEqual(eventId, "event123")
            XCTAssertTrue(success)
            XCTAssertEqual(msg, "accepted")
        } else {
            XCTFail("Should parse as OK message")
        }
    }

    func testNostrRelayMessageParseEOSE() {
        // Given: EOSE message data
        let eoseJson = """
        ["EOSE", "sub123"]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(eoseJson)

        // Then: Should parse as EOSE
        if case .eose(let subId) = message {
            XCTAssertEqual(subId, "sub123")
        } else {
            XCTFail("Should parse as EOSE message")
        }
    }

    func testNostrRelayMessageParseNotice() {
        // Given: NOTICE message data
        let noticeJson = """
        ["NOTICE", "rate limited"]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(noticeJson)

        // Then: Should parse as NOTICE
        if case .notice(let msg) = message {
            XCTAssertEqual(msg, "rate limited")
        } else {
            XCTFail("Should parse as NOTICE message")
        }
    }

    func testNostrRelayMessageParseAuth() {
        // Given: AUTH message data
        let authJson = """
        ["AUTH", "challenge123"]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(authJson)

        // Then: Should parse as AUTH
        if case .auth(let challenge) = message {
            XCTAssertEqual(challenge, "challenge123")
        } else {
            XCTFail("Should parse as AUTH message")
        }
    }

    func testNostrRelayMessageParseInvalid() {
        // Given: Invalid JSON
        let invalidJson = "not json".data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(invalidJson)

        // Then: Should return nil
        XCTAssertNil(message)
    }

    func testNostrRelayMessageParseUnknownType() {
        // Given: Unknown message type
        let unknownJson = """
        ["UNKNOWN", "data"]
        """.data(using: .utf8)!

        // When: Parsing
        let message = NostrRelayMessage.parse(unknownJson)

        // Then: Should return nil
        XCTAssertNil(message)
    }

    // MARK: - NostrSubscription Tests

    func testNostrSubscriptionCreation() {
        // Given: Subscription parameters
        let id = "sub123"
        let filters = [TestFixtures.createTestNostrFilter()]
        var receivedEvent: NostrEvent?

        // When: Creating subscription
        let subscription = NostrSubscription(
            id: id,
            filters: filters,
            callback: { event in receivedEvent = event }
        )

        // Then: Properties should be set
        XCTAssertEqual(subscription.id, id)
        XCTAssertEqual(subscription.filters.count, 1)

        // Callback should work
        subscription.callback(TestFixtures.createTestNostrEvent())
        XCTAssertNotNil(receivedEvent)
    }

    // MARK: - NostrError Tests

    func testNostrErrorDescriptions() {
        let errors: [NostrError] = [
            .noKeyPair,
            .connectionFailed,
            .publishFailed,
            .invalidEvent
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }

    // MARK: - Content Escaping Tests

    func testContentEscapingInEventId() {
        // Given: Content with special characters
        let content = "Hello\nWorld\t\"Test\""
        let pubkey = TestFixtures.testPublicKeyHex
        let createdAt = TestFixtures.testTimestamp
        let kind = 1
        let tags: [[String]] = []

        // When: Creating event ID
        let eventId = NostrEvent.createId(
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind,
            tags: tags,
            content: content
        )

        // Then: Should still produce valid ID
        XCTAssertEqual(eventId.count, 64)
        XCTAssertTrue(eventId.allSatisfy { $0.isHexDigit })
    }

    // MARK: - Array Safe Subscript Tests

    func testArraySafeSubscript() {
        let array = ["a", "b", "c"]

        XCTAssertEqual(array[safe: 0], "a")
        XCTAssertEqual(array[safe: 1], "b")
        XCTAssertEqual(array[safe: 2], "c")
        XCTAssertNil(array[safe: 3])
        XCTAssertNil(array[safe: -1])
    }
}

// MARK: - Character Extension

extension Character {
    var isHexDigit: Bool {
        "0123456789abcdefABCDEF".contains(self)
    }
}
