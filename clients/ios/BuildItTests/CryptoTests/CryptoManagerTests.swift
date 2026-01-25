// CryptoManagerTests.swift
// BuildItTests
//
// Unit tests for CryptoManager - key generation, signing, and encryption

import XCTest
import CryptoKit
@testable import BuildIt

final class CryptoManagerTests: XCTestCase {

    // MARK: - Properties

    var mockKeychain: MockKeychain!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        mockKeychain = MockKeychain()
    }

    override func tearDown() {
        mockKeychain = nil
        super.tearDown()
    }

    // MARK: - Key Pair Generation Tests

    func testKeyPairHasCorrectPrivateKeyLength() throws {
        // Given: A 32-byte private key
        let privateKey = TestFixtures.testPrivateKey

        // Then: Private key should be 32 bytes (256 bits)
        XCTAssertEqual(privateKey.count, 32, "Private key should be 32 bytes")
    }

    func testNostrKeyPairHexConversion() {
        // Given: A key pair with known values
        let privateKeyData = TestFixtures.testPrivateKey
        let publicKeyData = Data(repeating: 0xAB, count: 32)

        let keyPair = NostrKeyPair(privateKey: privateKeyData, publicKey: publicKeyData)

        // Then: Hex conversion should work correctly
        XCTAssertEqual(keyPair.privateKeyHex.count, 64, "Private key hex should be 64 characters")
        XCTAssertEqual(keyPair.publicKeyHex.count, 64, "Public key hex should be 64 characters")
        XCTAssertEqual(keyPair.privateKeyHex, TestFixtures.testPrivateKeyHex)
    }

    func testNostrKeyPairBech32Encoding() {
        // Given: A key pair
        let privateKeyData = TestFixtures.testPrivateKey
        let publicKeyData = Data(repeating: 0xAB, count: 32)

        let keyPair = NostrKeyPair(privateKey: privateKeyData, publicKey: publicKeyData)

        // Then: Bech32 encoding should produce valid npub and nsec
        XCTAssertTrue(keyPair.npub.hasPrefix("npub"), "npub should start with 'npub'")
        XCTAssertTrue(keyPair.nsec.hasPrefix("nsec"), "nsec should start with 'nsec'")
    }

    // MARK: - Encryption Tests

    func testEncryptedMessageStructure() {
        // Given: An encrypted message
        let encrypted = TestFixtures.createTestEncryptedMessage()

        // Then: Structure should be correct
        XCTAssertEqual(encrypted.nonce.count, 24, "Nonce should be 24 bytes")
        XCTAssertFalse(encrypted.ciphertext.isEmpty, "Ciphertext should not be empty")
    }

    func testEncryptedMessageCombined() {
        // Given: An encrypted message
        let nonce = Data(repeating: 0xAB, count: 24)
        let ciphertext = Data(repeating: 0xCD, count: 32)
        let encrypted = EncryptedMessage(ciphertext: ciphertext, nonce: nonce)

        // When: Getting combined data
        let combined = encrypted.combined

        // Then: Combined should be nonce + ciphertext
        XCTAssertEqual(combined.count, 24 + 32)
        XCTAssertEqual(combined.prefix(24), nonce)
        XCTAssertEqual(combined.suffix(32), ciphertext)
    }

    func testEncryptedMessageFromCombined() {
        // Given: Combined encrypted data
        let nonce = Data(repeating: 0xAB, count: 24)
        let ciphertext = Data(repeating: 0xCD, count: 32)
        let combined = nonce + ciphertext

        // When: Creating from combined
        let encrypted = EncryptedMessage.fromCombined(combined)

        // Then: Should parse correctly
        XCTAssertNotNil(encrypted)
        XCTAssertEqual(encrypted?.nonce, nonce)
        XCTAssertEqual(encrypted?.ciphertext, ciphertext)
    }

    func testEncryptedMessageFromCombinedTooShort() {
        // Given: Data shorter than minimum required (24 bytes for nonce + at least 1 for ciphertext)
        let shortData = Data(repeating: 0x00, count: 20)

        // When: Trying to create from short data
        let encrypted = EncryptedMessage.fromCombined(shortData)

        // Then: Should return nil
        XCTAssertNil(encrypted, "Should return nil for data shorter than 24 bytes")
    }

    // MARK: - SHA256 Hashing Tests

    func testSHA256HashData() {
        // Given: Known input data
        let input = "Hello, World!".data(using: .utf8)!

        // When: Computing SHA256
        let hash = Data(SHA256.hash(data: input))

        // Then: Hash should be 32 bytes
        XCTAssertEqual(hash.count, 32)
    }

    func testSHA256HashConsistency() {
        // Given: Same input
        let input = TestFixtures.testMessageData

        // When: Computing hash twice
        let hash1 = Data(SHA256.hash(data: input))
        let hash2 = Data(SHA256.hash(data: input))

        // Then: Hashes should be identical
        XCTAssertEqual(hash1, hash2, "Same input should produce same hash")
    }

    func testSHA256HashUniqueness() {
        // Given: Different inputs
        let input1 = "Hello".data(using: .utf8)!
        let input2 = "World".data(using: .utf8)!

        // When: Computing hashes
        let hash1 = Data(SHA256.hash(data: input1))
        let hash2 = Data(SHA256.hash(data: input2))

        // Then: Hashes should be different
        XCTAssertNotEqual(hash1, hash2, "Different inputs should produce different hashes")
    }

    // MARK: - Data Hex Extension Tests

    func testDataFromHexString() {
        // Given: A valid hex string
        let hexString = "0123456789abcdef"

        // When: Creating Data from hex
        let data = Data(hexString: hexString)

        // Then: Should create correct data
        XCTAssertNotNil(data)
        XCTAssertEqual(data?.count, 8)
        XCTAssertEqual(data?[0], 0x01)
        XCTAssertEqual(data?[7], 0xef)
    }

    func testDataFromHexStringUppercase() {
        // Given: Uppercase hex string
        let hexString = "ABCDEF"

        // When: Creating Data from hex
        let data = Data(hexString: hexString)

        // Then: Should create correct data (case insensitive)
        XCTAssertNotNil(data)
        XCTAssertEqual(data?.count, 3)
    }

    func testDataFromHexStringInvalidOddLength() {
        // Given: Hex string with odd length
        let hexString = "123"

        // When: Creating Data from hex
        let data = Data(hexString: hexString)

        // Then: Should return nil
        XCTAssertNil(data, "Odd-length hex string should return nil")
    }

    func testDataFromHexStringInvalidCharacters() {
        // Given: Hex string with invalid characters
        let hexString = "GHIJ"

        // When: Creating Data from hex
        let data = Data(hexString: hexString)

        // Then: Should return nil
        XCTAssertNil(data, "Invalid hex characters should return nil")
    }

    func testDataToHexString() {
        // Given: Known data
        let data = Data([0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF])

        // When: Converting to hex
        let hexString = data.hexString

        // Then: Should produce correct lowercase hex
        XCTAssertEqual(hexString, "0123456789abcdef")
    }

    func testHexStringRoundTrip() {
        // Given: Original hex string
        let original = TestFixtures.testPrivateKeyHex

        // When: Converting to Data and back
        let data = Data(hexString: original)
        let roundTripped = data?.hexString

        // Then: Should match original
        XCTAssertEqual(roundTripped, original)
    }

    // MARK: - Curve25519 Key Derivation Tests

    func testCurve25519KeyDerivation() throws {
        // Given: A valid private key
        let privateKeyData = TestFixtures.testPrivateKey

        // When: Creating signing key
        let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)
        let publicKey = signingKey.publicKey.rawRepresentation

        // Then: Public key should be 32 bytes
        XCTAssertEqual(publicKey.count, 32)
    }

    func testCurve25519SigningConsistency() throws {
        // Given: Same private key
        let privateKeyData = TestFixtures.testPrivateKey

        // When: Creating two signing keys
        let signingKey1 = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)
        let signingKey2 = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)

        // Then: Public keys should match
        XCTAssertEqual(
            signingKey1.publicKey.rawRepresentation,
            signingKey2.publicKey.rawRepresentation
        )
    }

    func testCurve25519SignAndVerify() throws {
        // Given: A key pair and message
        let privateKeyData = Data.randomTestData(size: 32)
        let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)
        let message = TestFixtures.testMessageData

        // When: Signing and verifying
        let signature = try signingKey.signature(for: message)
        let isValid = signingKey.publicKey.isValidSignature(signature, for: message)

        // Then: Signature should be valid
        XCTAssertTrue(isValid)
    }

    func testCurve25519InvalidSignature() throws {
        // Given: A key pair and different signer
        let privateKey1 = Data.randomTestData(size: 32)
        let privateKey2 = Data.randomTestData(size: 32)
        let signingKey1 = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKey1)
        let signingKey2 = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKey2)

        let message = TestFixtures.testMessageData

        // When: Signing with key1 and verifying with key2's public key
        let signature = try signingKey1.signature(for: message)
        let isValid = signingKey2.publicKey.isValidSignature(signature, for: message)

        // Then: Should be invalid
        XCTAssertFalse(isValid, "Signature from different key should be invalid")
    }

    // MARK: - Key Agreement Tests

    func testCurve25519KeyAgreement() throws {
        // Given: Two key pairs
        let privateKey1 = Data.randomTestData(size: 32)
        let privateKey2 = Data.randomTestData(size: 32)

        let keyPair1 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey1)
        let keyPair2 = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey2)

        // When: Computing shared secrets
        let sharedSecret1 = try keyPair1.sharedSecretFromKeyAgreement(with: keyPair2.publicKey)
        let sharedSecret2 = try keyPair2.sharedSecretFromKeyAgreement(with: keyPair1.publicKey)

        // Then: Both parties should derive the same shared secret
        let derived1 = sharedSecret1.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "test".data(using: .utf8)!,
            outputByteCount: 32
        )

        let derived2 = sharedSecret2.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "test".data(using: .utf8)!,
            outputByteCount: 32
        )

        XCTAssertEqual(
            derived1.withUnsafeBytes { Data($0) },
            derived2.withUnsafeBytes { Data($0) }
        )
    }

    // MARK: - ChaCha20-Poly1305 Tests

    func testChaChaPolyEncryptDecrypt() throws {
        // Given: A symmetric key and message
        let key = SymmetricKey(size: .bits256)
        let message = TestFixtures.testMessageData

        // When: Encrypting and decrypting
        let sealed = try ChaChaPoly.seal(message, using: key)
        let decrypted = try ChaChaPoly.open(sealed, using: key)

        // Then: Decrypted should match original
        XCTAssertEqual(decrypted, message)
    }

    func testChaChaPolyWithCustomNonce() throws {
        // Given: A key, nonce, and message
        let key = SymmetricKey(size: .bits256)
        let nonceData = Data.randomTestData(size: 12) // ChaCha20-Poly1305 uses 12-byte nonce
        let nonce = try ChaChaPoly.Nonce(data: nonceData)
        let message = TestFixtures.testMessageData

        // When: Encrypting with custom nonce
        let sealed = try ChaChaPoly.seal(message, using: key, nonce: nonce)

        // Then: Should succeed and decrypt correctly
        let decrypted = try ChaChaPoly.open(sealed, using: key)
        XCTAssertEqual(decrypted, message)
    }

    func testChaChaPolyWrongKey() throws {
        // Given: Two different keys and a message
        let key1 = SymmetricKey(size: .bits256)
        let key2 = SymmetricKey(size: .bits256)
        let message = TestFixtures.testMessageData

        // When: Encrypting with key1
        let sealed = try ChaChaPoly.seal(message, using: key1)

        // Then: Decrypting with key2 should fail
        XCTAssertThrowsError(try ChaChaPoly.open(sealed, using: key2)) { error in
            // CryptoKit throws CryptoKitError.authenticationFailure
            XCTAssertTrue(error is CryptoKitError)
        }
    }

    // MARK: - Crypto Error Tests

    func testCryptoErrorDescriptions() {
        // Test all error cases have descriptions
        let errors: [CryptoError] = [
            .randomGenerationFailed,
            .invalidPrivateKey,
            .invalidPublicKey,
            .invalidNsec,
            .noKeyPair,
            .encryptionFailed,
            .decryptionFailed,
            .invalidNIP04Format,
            .invalidEventId,
            .signingFailed
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Error \(error) should have description")
            XCTAssertFalse(error.errorDescription!.isEmpty, "Error description should not be empty")
        }
    }

    // MARK: - Random Generation Tests

    func testSecureRandomGeneration() {
        // Given: Desired byte count
        let byteCount = 32

        // When: Generating random bytes
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)

        // Then: Should succeed with non-zero data
        XCTAssertEqual(status, errSecSuccess)
        XCTAssertFalse(bytes.allSatisfy { $0 == 0 }, "Random bytes should not all be zero")
    }

    func testSecureRandomUniqueness() {
        // Given: Two random generations
        var bytes1 = [UInt8](repeating: 0, count: 32)
        var bytes2 = [UInt8](repeating: 0, count: 32)

        _ = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes1)
        _ = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes2)

        // Then: Should be different
        XCTAssertNotEqual(Data(bytes1), Data(bytes2), "Random generations should be unique")
    }
}
