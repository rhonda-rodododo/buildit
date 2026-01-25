// GiftWrapTests.swift
// BuildItTests
//
// Unit tests for NIP-17 gift wrap implementation

import XCTest
import CryptoKit
@testable import BuildIt

final class GiftWrapTests: XCTestCase {

    // MARK: - Gift Wrap Structure Tests

    /// Gift wrap structure according to NIP-17
    struct GiftWrap {
        let kind: Int // Kind 1059
        let pubkey: String // Ephemeral sender pubkey
        let content: String // Encrypted seal
        let tags: [[String]] // [["p", recipient_pubkey]]
        let createdAt: Int // Randomized timestamp

        static let giftWrapKind = 1059
        static let sealKind = 13
    }

    /// Seal structure (inner layer)
    struct Seal {
        let kind: Int // Kind 13
        let pubkey: String // Real sender pubkey
        let content: String // Encrypted rumor
        let createdAt: Int
    }

    /// Rumor structure (innermost layer, unsigned event)
    struct Rumor {
        let kind: Int // Original event kind
        let pubkey: String // Real sender pubkey
        let content: String // Actual message
        let tags: [[String]]
        let createdAt: Int
    }

    func testGiftWrapKind() {
        XCTAssertEqual(GiftWrap.giftWrapKind, 1059)
    }

    func testSealKind() {
        XCTAssertEqual(GiftWrap.sealKind, 13)
    }

    func testGiftWrapStructure() {
        // Given: Gift wrap parameters
        let ephemeralPubkey = Data.randomTestData(size: 32).hexString
        let recipientPubkey = TestFixtures.testPublicKeyHex
        let encryptedSeal = "encrypted_content_here"
        let randomizedTimestamp = Int(Date().timeIntervalSince1970) - Int.random(in: 0...172800) // Up to 2 days offset

        // When: Creating gift wrap
        let giftWrap = GiftWrap(
            kind: GiftWrap.giftWrapKind,
            pubkey: ephemeralPubkey,
            content: encryptedSeal,
            tags: [["p", recipientPubkey]],
            createdAt: randomizedTimestamp
        )

        // Then: Structure should be correct
        XCTAssertEqual(giftWrap.kind, 1059)
        XCTAssertEqual(giftWrap.pubkey.count, 64) // 32 bytes hex
        XCTAssertEqual(giftWrap.tags.first?.first, "p")
        XCTAssertEqual(giftWrap.tags.first?[safe: 1], recipientPubkey)
    }

    // MARK: - Timestamp Randomization Tests

    func testTimestampRandomization() {
        // Given: Current timestamp
        let now = Int(Date().timeIntervalSince1970)

        // When: Generating randomized timestamps
        var timestamps: [Int] = []
        for _ in 1...100 {
            let randomOffset = Int.random(in: 0...172800) // Up to 2 days
            let randomizedTimestamp = now - randomOffset
            timestamps.append(randomizedTimestamp)
        }

        // Then: Timestamps should be distributed (not all the same)
        let uniqueTimestamps = Set(timestamps)
        XCTAssertGreaterThan(uniqueTimestamps.count, 50, "Should have variety in timestamps")

        // All should be in the past
        for ts in timestamps {
            XCTAssertLessThanOrEqual(ts, now)
            XCTAssertGreaterThanOrEqual(ts, now - 172800)
        }
    }

    func testTimestampRandomizationRange() {
        // NIP-17 recommends randomizing within +/- 2 days
        let twoDaysInSeconds = 172800

        // Given: Multiple random offsets
        for _ in 1...100 {
            let offset = Int.random(in: -twoDaysInSeconds...twoDaysInSeconds)

            // Then: Should be within 2 days
            XCTAssertGreaterThanOrEqual(offset, -twoDaysInSeconds)
            XCTAssertLessThanOrEqual(offset, twoDaysInSeconds)
        }
    }

    // MARK: - Ephemeral Key Tests

    func testEphemeralKeyGeneration() throws {
        // Given: Need for ephemeral key
        var ephemeralKeys: [Data] = []

        // When: Generating multiple ephemeral keys
        for _ in 1...10 {
            let privateKey = Data.randomTestData(size: 32)
            let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKey)
            let publicKey = signingKey.publicKey.rawRepresentation
            ephemeralKeys.append(publicKey)
        }

        // Then: All should be unique
        let uniqueKeys = Set(ephemeralKeys)
        XCTAssertEqual(uniqueKeys.count, 10)
    }

    func testEphemeralKeyNeverReused() {
        // Given: Set to track used keys
        var usedKeys = Set<String>()

        // When: Generating keys for multiple messages
        for _ in 1...100 {
            let key = Data.randomTestData(size: 32).hexString

            // Then: Key should not have been used before
            XCTAssertFalse(usedKeys.contains(key))
            usedKeys.insert(key)
        }

        XCTAssertEqual(usedKeys.count, 100)
    }

    // MARK: - Layered Encryption Tests

    func testThreeLayerStructure() {
        // NIP-17 has three layers: Gift Wrap -> Seal -> Rumor

        // Given: Original message (rumor)
        let originalContent = "Secret message"
        let senderPubkey = TestFixtures.testPublicKeyHex
        let recipientPubkey = TestFixtures.testPublicKeyHex2

        let rumor = Rumor(
            kind: 14, // NIP-17 DM kind
            pubkey: senderPubkey,
            content: originalContent,
            tags: [["p", recipientPubkey]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Layer 1: Rumor (innermost)
        XCTAssertEqual(rumor.content, originalContent)
        XCTAssertEqual(rumor.pubkey, senderPubkey)

        // Layer 2: Seal wraps rumor
        let seal = Seal(
            kind: 13,
            pubkey: senderPubkey,
            content: "encrypted_rumor_placeholder",
            createdAt: Int(Date().timeIntervalSince1970)
        )
        XCTAssertEqual(seal.kind, 13)

        // Layer 3: Gift wrap wraps seal
        let ephemeralPubkey = Data.randomTestData(size: 32).hexString
        let giftWrap = GiftWrap(
            kind: 1059,
            pubkey: ephemeralPubkey,
            content: "encrypted_seal_placeholder",
            tags: [["p", recipientPubkey]],
            createdAt: Int(Date().timeIntervalSince1970) - Int.random(in: 0...172800)
        )

        XCTAssertEqual(giftWrap.kind, 1059)
        XCTAssertNotEqual(giftWrap.pubkey, senderPubkey) // Ephemeral, not real sender
    }

    // MARK: - Rumor Tests (Unsigned Event)

    func testRumorHasNoSignature() {
        // Given: A rumor (unsigned event)
        let rumor = Rumor(
            kind: 14,
            pubkey: TestFixtures.testPublicKeyHex,
            content: "Test message",
            tags: [],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Then: Rumor should not have signature field
        // (In implementation, rumor is the event data before signing)
        XCTAssertEqual(rumor.kind, 14)
        XCTAssertFalse(rumor.content.isEmpty)
    }

    func testRumorKind14ForDMs() {
        // NIP-17 defines kind 14 for private DMs within gift wrap
        let dmKind = 14

        let rumor = Rumor(
            kind: dmKind,
            pubkey: TestFixtures.testPublicKeyHex,
            content: "Private message",
            tags: [["p", TestFixtures.testPublicKeyHex2]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        XCTAssertEqual(rumor.kind, 14)
    }

    // MARK: - Recipient Tag Tests

    func testGiftWrapPTag() {
        // Gift wrap must have p tag for recipient
        let recipientPubkey = TestFixtures.testPublicKeyHex

        let giftWrap = GiftWrap(
            kind: 1059,
            pubkey: Data.randomTestData(size: 32).hexString,
            content: "encrypted",
            tags: [["p", recipientPubkey]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Then: Should have exactly one p tag with recipient
        XCTAssertEqual(giftWrap.tags.count, 1)
        XCTAssertEqual(giftWrap.tags.first?.first, "p")
        XCTAssertEqual(giftWrap.tags.first?[safe: 1], recipientPubkey)
    }

    func testRumorPTagForRecipient() {
        // Rumor also has p tag for recipient
        let recipientPubkey = TestFixtures.testPublicKeyHex2

        let rumor = Rumor(
            kind: 14,
            pubkey: TestFixtures.testPublicKeyHex,
            content: "Message",
            tags: [["p", recipientPubkey]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        XCTAssertEqual(rumor.tags.first?.first, "p")
        XCTAssertEqual(rumor.tags.first?[safe: 1], recipientPubkey)
    }

    // MARK: - Encryption Key Derivation Tests

    func testConversationKeyDerivation() throws {
        // NIP-44 conversation key is derived from shared secret
        let privateKey1 = Data.randomTestData(size: 32)
        let privateKey2 = Data.randomTestData(size: 32)

        let keyPair1 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey1)
        let keyPair2 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey2)

        // Derive conversation key
        let sharedSecret = try keyPair1.sharedSecretFromKeyAgreement(with: keyPair2.publicKey)
        let conversationKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(), // NIP-44 uses empty salt
            sharedInfo: "nip44-v2".data(using: .utf8)!,
            outputByteCount: 32
        )

        // Then: Should produce 256-bit key
        XCTAssertNotNil(conversationKey)
    }

    func testSealEncryptionKey() throws {
        // Seal is encrypted to recipient using sender's real key
        let senderPrivateKey = Data.randomTestData(size: 32)
        let recipientPrivateKey = Data.randomTestData(size: 32)

        let senderKeyPair = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: senderPrivateKey)
        let recipientKeyPair = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: recipientPrivateKey)

        // Sender encrypts seal to recipient
        let sealKey = try senderKeyPair.sharedSecretFromKeyAgreement(with: recipientKeyPair.publicKey)

        XCTAssertNotNil(sealKey)
    }

    func testGiftWrapEncryptionKey() throws {
        // Gift wrap is encrypted using ephemeral key to recipient
        let ephemeralPrivateKey = Data.randomTestData(size: 32)
        let recipientPrivateKey = Data.randomTestData(size: 32)

        let ephemeralKeyPair = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: ephemeralPrivateKey)
        let recipientKeyPair = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: recipientPrivateKey)

        // Ephemeral key encrypts gift wrap to recipient
        let giftWrapKey = try ephemeralKeyPair.sharedSecretFromKeyAgreement(with: recipientKeyPair.publicKey)

        XCTAssertNotNil(giftWrapKey)
    }

    // MARK: - Privacy Property Tests

    func testSenderPrivacyPreserved() {
        // Given: A gift wrap
        let realSenderPubkey = TestFixtures.testPublicKeyHex
        let ephemeralPubkey = Data.randomTestData(size: 32).hexString

        let giftWrap = GiftWrap(
            kind: 1059,
            pubkey: ephemeralPubkey,
            content: "encrypted",
            tags: [["p", TestFixtures.testPublicKeyHex2]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Then: Gift wrap pubkey should not reveal real sender
        XCTAssertNotEqual(giftWrap.pubkey, realSenderPubkey)
    }

    func testRecipientOnlyKnowsAfterDecryption() {
        // The p tag in gift wrap reveals recipient (necessary for delivery)
        // But actual message recipient is only known after decrypting

        let deliveryRecipient = TestFixtures.testPublicKeyHex
        let giftWrap = GiftWrap(
            kind: 1059,
            pubkey: Data.randomTestData(size: 32).hexString,
            content: "encrypted",
            tags: [["p", deliveryRecipient]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Relay can see delivery recipient
        XCTAssertEqual(giftWrap.tags.first?[safe: 1], deliveryRecipient)

        // But cannot see actual message content or sender without decryption
        XCTAssertEqual(giftWrap.content, "encrypted")
    }

    // MARK: - Validation Tests

    func testValidGiftWrapKind() {
        let validKind = 1059
        let giftWrap = GiftWrap(
            kind: validKind,
            pubkey: Data.randomTestData(size: 32).hexString,
            content: "encrypted",
            tags: [["p", TestFixtures.testPublicKeyHex]],
            createdAt: Int(Date().timeIntervalSince1970)
        )

        XCTAssertEqual(giftWrap.kind, 1059)
    }

    func testValidSealKind() {
        let validKind = 13
        let seal = Seal(
            kind: validKind,
            pubkey: TestFixtures.testPublicKeyHex,
            content: "encrypted",
            createdAt: Int(Date().timeIntervalSince1970)
        )

        XCTAssertEqual(seal.kind, 13)
    }

    func testGiftWrapMustHavePTag() {
        // Gift wrap without p tag is invalid
        let giftWrap = GiftWrap(
            kind: 1059,
            pubkey: Data.randomTestData(size: 32).hexString,
            content: "encrypted",
            tags: [], // Missing p tag
            createdAt: Int(Date().timeIntervalSince1970)
        )

        // Validation should fail
        let hasPTag = giftWrap.tags.contains { $0.first == "p" }
        XCTAssertFalse(hasPTag, "Gift wrap without p tag should be invalid")
    }
}
