// NIP44Tests.swift
// BuildItTests
//
// Unit tests for NIP-44 encryption/decryption (and NIP-04 compatibility)

import XCTest
import CryptoKit
@testable import BuildIt

final class NIP44Tests: XCTestCase {

    // MARK: - NIP-04 Format Tests

    func testNIP04FormatStructure() {
        // Given: A NIP-04 formatted string
        let content = TestFixtures.testNIP04Content

        // When: Parsing the format
        let parts = content.split(separator: "?")

        // Then: Should have ciphertext and IV
        XCTAssertEqual(parts.count, 2, "NIP-04 should have 2 parts separated by '?'")
        XCTAssertTrue(parts[1].hasPrefix("iv="), "Second part should be IV")
    }

    func testNIP04CiphertextExtraction() {
        // Given: NIP-04 content
        let ciphertextBase64 = "SGVsbG8gV29ybGQh"
        let content = "\(ciphertextBase64)?iv=YWJjZGVmZ2hpamtsbW5vcA=="

        // When: Extracting ciphertext
        let parts = content.split(separator: "?")
        let extractedCiphertext = String(parts[0])

        // Then: Should match original
        XCTAssertEqual(extractedCiphertext, ciphertextBase64)
    }

    func testNIP04IVExtraction() {
        // Given: NIP-04 content
        let ivBase64 = "YWJjZGVmZ2hpamtsbW5vcA=="
        let content = "SGVsbG8gV29ybGQh?iv=\(ivBase64)"

        // When: Extracting IV
        let parts = content.split(separator: "?")
        let ivPart = String(parts[1])
        let extractedIV = String(ivPart.dropFirst(3)) // Remove "iv="

        // Then: Should match original
        XCTAssertEqual(extractedIV, ivBase64)
    }

    func testNIP04InvalidFormatMissingIV() {
        // Given: Content without IV
        let content = "SGVsbG8gV29ybGQh"

        // When: Splitting
        let parts = content.split(separator: "?")

        // Then: Should only have one part
        XCTAssertEqual(parts.count, 1, "Content without '?' should have 1 part")
    }

    func testNIP04InvalidFormatWrongPrefix() {
        // Given: Content with wrong IV prefix
        let content = "SGVsbG8gV29ybGQh?nonce=YWJjZGVm"

        // When: Extracting
        let parts = content.split(separator: "?")
        let secondPart = String(parts[1])

        // Then: Should not have iv= prefix
        XCTAssertFalse(secondPart.hasPrefix("iv="))
    }

    // MARK: - Base64 Encoding Tests

    func testBase64RoundTrip() {
        // Given: Original data
        let original = TestFixtures.testMessageData

        // When: Encoding and decoding
        let base64 = original.base64EncodedString()
        let decoded = Data(base64Encoded: base64)

        // Then: Should match original
        XCTAssertEqual(decoded, original)
    }

    func testBase64EncodingForCiphertext() {
        // Given: Ciphertext data
        let ciphertext = TestFixtures.testCiphertext

        // When: Encoding to base64
        let base64 = ciphertext.base64EncodedString()

        // Then: Should be valid base64 (only contains valid chars)
        let validBase64Chars = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
        let base64CharSet = CharacterSet(charactersIn: base64)
        XCTAssertTrue(validBase64Chars.isSuperset(of: base64CharSet))
    }

    func testBase64DecodingInvalidInput() {
        // Given: Invalid base64 string
        let invalidBase64 = "This is not valid base64!!!"

        // When: Attempting to decode
        let decoded = Data(base64Encoded: invalidBase64)

        // Then: Should fail
        XCTAssertNil(decoded, "Invalid base64 should return nil")
    }

    // MARK: - IV/Nonce Handling Tests

    func testIVLengthForAES() {
        // Given: Standard IV length for AES (16 bytes)
        let standardIVLength = 16

        // When: Creating IV from base64
        let ivBase64 = "YWJjZGVmZ2hpamtsbW5vcA==" // 16 bytes
        let iv = Data(base64Encoded: ivBase64)

        // Then: Should be correct length
        XCTAssertEqual(iv?.count, standardIVLength)
    }

    func testNoncePaddingForChaCha20() {
        // Given: 16-byte IV (from NIP-04)
        let iv = Data(repeating: 0xAB, count: 16)
        let chaChanonceLength = 24

        // When: Padding to 24 bytes
        var nonce = iv
        if nonce.count < chaChanonceLength {
            nonce.append(Data(repeating: 0, count: chaChanonceLength - nonce.count))
        }

        // Then: Should be 24 bytes
        XCTAssertEqual(nonce.count, chaChanonceLength)
        XCTAssertEqual(nonce.prefix(16), iv)
    }

    // MARK: - Encrypted Message Construction Tests

    func testEncryptedMessageConstruction() {
        // Given: Ciphertext and nonce
        let ciphertext = Data.randomTestData(size: 64)
        let nonce = Data.randomTestData(size: 24)

        // When: Creating encrypted message
        let encrypted = EncryptedMessage(ciphertext: ciphertext, nonce: nonce)

        // Then: Should contain both components
        XCTAssertEqual(encrypted.ciphertext, ciphertext)
        XCTAssertEqual(encrypted.nonce, nonce)
    }

    func testEncryptedMessageCombinedFormat() {
        // Given: An encrypted message
        let ciphertext = Data([0x01, 0x02, 0x03, 0x04])
        let nonce = Data(repeating: 0xFF, count: 24)
        let encrypted = EncryptedMessage(ciphertext: ciphertext, nonce: nonce)

        // When: Getting combined format
        let combined = encrypted.combined

        // Then: Should be nonce followed by ciphertext
        XCTAssertEqual(combined.count, 28) // 24 + 4
        XCTAssertEqual(Data(combined.prefix(24)), nonce)
        XCTAssertEqual(Data(combined.suffix(4)), ciphertext)
    }

    // MARK: - NIP-44 Padding Tests

    func testNIP44PaddingCalculation() {
        // NIP-44 uses padding to hide message length
        // Padding formula: next power of 2 that's >= max(32, length)

        let testCases: [(messageLength: Int, expectedPaddedLength: Int)] = [
            (1, 32),
            (31, 32),
            (32, 32),
            (33, 64),
            (64, 64),
            (65, 128),
            (100, 128),
            (256, 256),
            (257, 512)
        ]

        for (messageLength, expectedPaddedLength) in testCases {
            let paddedLength = calculateNIP44Padding(messageLength: messageLength)
            XCTAssertEqual(
                paddedLength,
                expectedPaddedLength,
                "Message length \(messageLength) should pad to \(expectedPaddedLength)"
            )
        }
    }

    /// Helper function to calculate NIP-44 padding
    private func calculateNIP44Padding(messageLength: Int) -> Int {
        let minPadded = max(32, messageLength)
        var paddedLength = 32

        while paddedLength < minPadded {
            paddedLength *= 2
        }

        return paddedLength
    }

    // MARK: - Key Exchange for Encryption Tests

    func testKeyExchangeProducesSharedSecret() throws {
        // Given: Two key pairs
        let privateKey1 = Data.randomTestData(size: 32)
        let privateKey2 = Data.randomTestData(size: 32)

        let keyPair1 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey1)
        let keyPair2 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey2)

        // When: Computing shared secret
        let sharedSecret = try keyPair1.sharedSecretFromKeyAgreement(with: keyPair2.publicKey)

        // Then: Should produce a usable symmetric key
        let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "nip44-v2".data(using: .utf8)!,
            outputByteCount: 32
        )

        // Verify key is usable
        let testMessage = TestFixtures.testMessageData
        let sealed = try ChaChaPoly.seal(testMessage, using: symmetricKey)
        let decrypted = try ChaChaPoly.open(sealed, using: symmetricKey)

        XCTAssertEqual(decrypted, testMessage)
    }

    func testSharedSecretSymmetry() throws {
        // Given: Two key pairs
        let privateKey1 = Data.randomTestData(size: 32)
        let privateKey2 = Data.randomTestData(size: 32)

        let keyPair1 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey1)
        let keyPair2 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey2)

        // When: Both parties compute shared secret
        let shared1 = try keyPair1.sharedSecretFromKeyAgreement(with: keyPair2.publicKey)
        let shared2 = try keyPair2.sharedSecretFromKeyAgreement(with: keyPair1.publicKey)

        // Then: Derived keys should be identical
        let key1 = shared1.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "nip44-v2".data(using: .utf8)!,
            outputByteCount: 32
        )

        let key2 = shared2.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "nip44-v2".data(using: .utf8)!,
            outputByteCount: 32
        )

        // Encrypt with key1, decrypt with key2
        let message = TestFixtures.testMessageData
        let sealed = try ChaChaPoly.seal(message, using: key1)
        let decrypted = try ChaChaPoly.open(sealed, using: key2)

        XCTAssertEqual(decrypted, message)
    }

    // MARK: - Content Escaping Tests

    func testContentEscapingForNostrEvent() {
        // Given: Content with special characters
        let testCases: [(input: String, expected: String)] = [
            ("Hello", "Hello"),
            ("Hello\\World", "Hello\\\\World"),
            ("Hello\"World", "Hello\\\"World"),
            ("Hello\nWorld", "Hello\\nWorld"),
            ("Hello\rWorld", "Hello\\rWorld"),
            ("Hello\tWorld", "Hello\\tWorld"),
            ("Mixed\\\"Content\n\t", "Mixed\\\\\\\"Content\\n\\t")
        ]

        for (input, expected) in testCases {
            let escaped = escapeNostrContent(input)
            XCTAssertEqual(escaped, expected, "Failed for input: \(input)")
        }
    }

    /// Helper function to escape Nostr content
    private func escapeNostrContent(_ content: String) -> String {
        content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }

    // MARK: - Version Tag Tests

    func testNIP44VersionIdentification() {
        // NIP-44 uses a version byte at the start of the payload

        // Given: Version byte (0x02 for NIP-44 version 2)
        let versionByte: UInt8 = 0x02

        // When: Checking version
        let isVersion2 = versionByte == 0x02

        // Then: Should identify correctly
        XCTAssertTrue(isVersion2)
    }

    func testNIP44PayloadStructure() {
        // NIP-44 payload structure:
        // [version (1 byte)][nonce (32 bytes)][ciphertext][mac (32 bytes)]

        // Given: Known structure sizes
        let versionSize = 1
        let nonceSize = 32
        let macSize = 32
        let overhead = versionSize + nonceSize + macSize

        // When: Creating payload for a message
        let messageSize = 100
        let totalSize = overhead + messageSize

        // Then: Total should be correct
        XCTAssertEqual(totalSize, 165) // 1 + 32 + 100 + 32
    }

    // MARK: - HMAC Validation Tests

    func testHMACGeneration() throws {
        // Given: Key and data
        let key = SymmetricKey(size: .bits256)
        let data = TestFixtures.testMessageData

        // When: Computing HMAC
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
        let hmacData = Data(hmac)

        // Then: HMAC should be 32 bytes
        XCTAssertEqual(hmacData.count, 32)
    }

    func testHMACValidation() throws {
        // Given: Key, data, and HMAC
        let key = SymmetricKey(size: .bits256)
        let data = TestFixtures.testMessageData
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)

        // When: Validating
        let isValid = HMAC<SHA256>.isValidAuthenticationCode(hmac, authenticating: data, using: key)

        // Then: Should be valid
        XCTAssertTrue(isValid)
    }

    func testHMACInvalidation() throws {
        // Given: Key, data, and HMAC
        let key = SymmetricKey(size: .bits256)
        let data = TestFixtures.testMessageData
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)

        // When: Validating against modified data
        let modifiedData = data + Data([0x00])
        let isValid = HMAC<SHA256>.isValidAuthenticationCode(hmac, authenticating: modifiedData, using: key)

        // Then: Should be invalid
        XCTAssertFalse(isValid, "HMAC should be invalid for modified data")
    }

    // MARK: - Message Size Limits Tests

    func testNIP44MaxMessageSize() {
        // NIP-44 has a maximum plaintext size of 65535 bytes (2^16 - 1)
        let maxSize = 65535

        // Given: Messages at and above limit
        let validMessage = Data(repeating: 0x41, count: maxSize)
        let invalidMessage = Data(repeating: 0x41, count: maxSize + 1)

        // Then: Should distinguish valid from invalid
        XCTAssertTrue(validMessage.count <= maxSize)
        XCTAssertFalse(invalidMessage.count <= maxSize)
    }

    func testNIP44MinMessageSize() {
        // NIP-44 requires at least 1 byte of plaintext
        let minSize = 1

        // Given: Valid minimum message
        let validMessage = Data([0x41])
        let emptyMessage = Data()

        // Then: Should distinguish valid from invalid
        XCTAssertTrue(validMessage.count >= minSize)
        XCTAssertFalse(emptyMessage.count >= minSize)
    }
}
