// KeychainManagerTests.swift
// BuildItTests
//
// Unit tests for KeychainManager using mock keychain

import XCTest
import Security
@testable import BuildIt

final class KeychainManagerTests: XCTestCase {

    // MARK: - Properties

    var mockKeychain: MockKeychain!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        mockKeychain = MockKeychain()
    }

    override func tearDown() {
        mockKeychain.reset()
        mockKeychain = nil
        super.tearDown()
    }

    // MARK: - Save Private Key Tests

    func testSavePrivateKeySuccess() async throws {
        // Given: A private key
        let privateKey = TestFixtures.testPrivateKey

        // When: Saving to keychain
        try await mockKeychain.savePrivateKey(privateKey)

        // Then: Key should be stored
        XCTAssertTrue(mockKeychain.hasPrivateKey())
        XCTAssertTrue(mockKeychain.didPerformOperation(.save(key: "private_key")))
    }

    func testSavePrivateKeyFailure() async {
        // Given: Keychain configured to fail
        mockKeychain.shouldSucceed = false

        // When: Trying to save
        do {
            try await mockKeychain.savePrivateKey(TestFixtures.testPrivateKey)
            XCTFail("Should have thrown an error")
        } catch {
            // Then: Should throw KeychainError
            XCTAssertTrue(error is KeychainError)
        }
    }

    func testSavePrivateKeyOverwrites() async throws {
        // Given: An existing key
        let key1 = Data(repeating: 0x01, count: 32)
        let key2 = Data(repeating: 0x02, count: 32)

        try await mockKeychain.savePrivateKey(key1)

        // When: Saving a new key
        try await mockKeychain.savePrivateKey(key2)

        // Then: New key should overwrite
        let loaded = try await mockKeychain.loadPrivateKey()
        XCTAssertEqual(loaded, key2)
    }

    // MARK: - Load Private Key Tests

    func testLoadPrivateKeySuccess() async throws {
        // Given: A stored private key
        let privateKey = TestFixtures.testPrivateKey
        try await mockKeychain.savePrivateKey(privateKey)

        // When: Loading from keychain
        let loaded = try await mockKeychain.loadPrivateKey()

        // Then: Should match original
        XCTAssertEqual(loaded, privateKey)
        XCTAssertTrue(mockKeychain.didPerformOperation(.load(key: "private_key")))
    }

    func testLoadPrivateKeyNotFound() async {
        // Given: Empty keychain

        // When: Trying to load
        do {
            _ = try await mockKeychain.loadPrivateKey()
            XCTFail("Should have thrown an error")
        } catch let error as KeychainError {
            // Then: Should throw loadFailed with itemNotFound
            if case .loadFailed(let status) = error {
                XCTAssertEqual(status, errSecItemNotFound)
            } else {
                XCTFail("Wrong error type")
            }
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testLoadPrivateKeyFailure() async {
        // Given: Keychain configured to fail
        mockKeychain.setStoredData(TestFixtures.testPrivateKey, for: "private_key")
        mockKeychain.shouldSucceed = false

        // When: Trying to load
        do {
            _ = try await mockKeychain.loadPrivateKey()
            XCTFail("Should have thrown an error")
        } catch {
            // Then: Should throw KeychainError
            XCTAssertTrue(error is KeychainError)
        }
    }

    // MARK: - Delete Private Key Tests

    func testDeletePrivateKeySuccess() async throws {
        // Given: A stored private key
        try await mockKeychain.savePrivateKey(TestFixtures.testPrivateKey)
        XCTAssertTrue(mockKeychain.hasPrivateKey())

        // When: Deleting
        try await mockKeychain.deletePrivateKey()

        // Then: Key should be removed
        XCTAssertFalse(mockKeychain.hasPrivateKey())
        XCTAssertTrue(mockKeychain.didPerformOperation(.delete(key: "private_key")))
    }

    func testDeletePrivateKeyNotFound() async throws {
        // Given: Empty keychain

        // When: Deleting non-existent key
        // Then: Should not throw (delete is idempotent in mock)
        try await mockKeychain.deletePrivateKey()
        XCTAssertFalse(mockKeychain.hasPrivateKey())
    }

    func testDeletePrivateKeyFailure() async {
        // Given: Keychain configured to fail
        mockKeychain.setStoredData(TestFixtures.testPrivateKey, for: "private_key")
        mockKeychain.shouldSucceed = false

        // When: Trying to delete
        do {
            try await mockKeychain.deletePrivateKey()
            XCTFail("Should have thrown an error")
        } catch {
            // Then: Should throw KeychainError
            XCTAssertTrue(error is KeychainError)
        }
    }

    // MARK: - Has Private Key Tests

    func testHasPrivateKeyWhenPresent() async throws {
        // Given: A stored key
        try await mockKeychain.savePrivateKey(TestFixtures.testPrivateKey)

        // When: Checking existence
        let hasKey = mockKeychain.hasPrivateKey()

        // Then: Should return true
        XCTAssertTrue(hasKey)
    }

    func testHasPrivateKeyWhenAbsent() {
        // Given: Empty keychain

        // When: Checking existence
        let hasKey = mockKeychain.hasPrivateKey()

        // Then: Should return false
        XCTAssertFalse(hasKey)
    }

    // MARK: - Symmetric Key Tests

    func testSaveAndLoadSymmetricKey() async throws {
        // Given: A symmetric key
        let key = Data.randomTestData(size: 32)
        let identifier = "test_symmetric_key"

        // When: Saving and loading
        try await mockKeychain.saveSymmetricKey(key, identifier: identifier)
        let loaded = try await mockKeychain.loadSymmetricKey(identifier: identifier)

        // Then: Should match
        XCTAssertEqual(loaded, key)
    }

    func testMultipleSymmetricKeys() async throws {
        // Given: Multiple symmetric keys
        let key1 = Data.randomTestData(size: 32)
        let key2 = Data.randomTestData(size: 32)
        let key3 = Data.randomTestData(size: 32)

        // When: Saving with different identifiers
        try await mockKeychain.saveSymmetricKey(key1, identifier: "key1")
        try await mockKeychain.saveSymmetricKey(key2, identifier: "key2")
        try await mockKeychain.saveSymmetricKey(key3, identifier: "key3")

        // Then: Each should be independently loadable
        let loaded1 = try await mockKeychain.loadSymmetricKey(identifier: "key1")
        let loaded2 = try await mockKeychain.loadSymmetricKey(identifier: "key2")
        let loaded3 = try await mockKeychain.loadSymmetricKey(identifier: "key3")

        XCTAssertEqual(loaded1, key1)
        XCTAssertEqual(loaded2, key2)
        XCTAssertEqual(loaded3, key3)
    }

    func testDeleteSymmetricKey() async throws {
        // Given: A stored symmetric key
        let key = Data.randomTestData(size: 32)
        let identifier = "test_key"
        try await mockKeychain.saveSymmetricKey(key, identifier: identifier)

        // When: Deleting
        try await mockKeychain.deleteSymmetricKey(identifier: identifier)

        // Then: Should not be loadable
        do {
            _ = try await mockKeychain.loadSymmetricKey(identifier: identifier)
            XCTFail("Should have thrown")
        } catch {
            XCTAssertTrue(error is KeychainError)
        }
    }

    // MARK: - Biometrics Tests

    func testAuthenticateWithBiometricsSuccess() async throws {
        // Given: Biometrics available and enabled
        mockKeychain.isBiometricsAvailable = true

        // When: Authenticating
        let success = try await mockKeychain.authenticateWithBiometrics(reason: "Test")

        // Then: Should succeed
        XCTAssertTrue(success)
        XCTAssertTrue(mockKeychain.didPerformOperation(.authenticate))
    }

    func testAuthenticateWithBiometricsUnavailable() async throws {
        // Given: Biometrics unavailable
        mockKeychain.isBiometricsAvailable = false

        // When: Authenticating
        let success = try await mockKeychain.authenticateWithBiometrics(reason: "Test")

        // Then: Should return false (biometrics not available)
        XCTAssertFalse(success)
    }

    func testAuthenticateWithBiometricsFailure() async {
        // Given: Authentication configured to fail
        mockKeychain.shouldSucceed = false

        // When: Authenticating
        do {
            _ = try await mockKeychain.authenticateWithBiometrics(reason: "Test")
            XCTFail("Should have thrown")
        } catch let error as KeychainError {
            // Then: Should throw authenticationFailed
            if case .authenticationFailed = error {
                // Expected
            } else {
                XCTFail("Wrong error case")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }

    // MARK: - Secure Enclave Tests

    func testGenerateSecureEnclaveKeySuccess() async throws {
        // Given: Secure Enclave available
        mockKeychain.isSecureEnclaveAvailable = true

        // When: Generating key
        try await mockKeychain.generateSecureEnclaveKey()

        // Then: Should succeed
        XCTAssertTrue(mockKeychain.didPerformOperation(.generateSecureEnclaveKey))
        XCTAssertTrue(mockKeychain.hasKey("secure_enclave_key"))
    }

    func testGenerateSecureEnclaveKeyUnavailable() async {
        // Given: Secure Enclave unavailable
        mockKeychain.isSecureEnclaveAvailable = false

        // When: Trying to generate
        do {
            try await mockKeychain.generateSecureEnclaveKey()
            XCTFail("Should have thrown")
        } catch let error as KeychainError {
            // Then: Should throw secureEnclaveNotAvailable
            if case .secureEnclaveNotAvailable = error {
                // Expected
            } else {
                XCTFail("Wrong error case: \(error)")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }

    // MARK: - Operation Logging Tests

    func testOperationLogging() async throws {
        // Given: Various operations
        let key = TestFixtures.testPrivateKey

        // When: Performing multiple operations
        try await mockKeychain.savePrivateKey(key)
        _ = try await mockKeychain.loadPrivateKey()
        try await mockKeychain.deletePrivateKey()

        // Then: All operations should be logged
        XCTAssertEqual(mockKeychain.operationCount(for: .save(key: "private_key")), 1)
        XCTAssertEqual(mockKeychain.operationCount(for: .load(key: "private_key")), 1)
        XCTAssertEqual(mockKeychain.operationCount(for: .delete(key: "private_key")), 1)
    }

    func testOperationLogReset() async throws {
        // Given: Some operations performed
        try await mockKeychain.savePrivateKey(TestFixtures.testPrivateKey)
        XCTAssertFalse(mockKeychain.operationLog.isEmpty)

        // When: Resetting
        mockKeychain.reset()

        // Then: Log should be empty
        XCTAssertTrue(mockKeychain.operationLog.isEmpty)
        XCTAssertFalse(mockKeychain.hasPrivateKey())
    }

    // MARK: - Configuration Tests

    func testKeychainTestConfigurationApply() async throws {
        // Given: A failing configuration
        let config = KeychainTestConfiguration.failing

        // When: Applying to mock
        config.apply(to: mockKeychain)

        // Then: Mock should be configured
        XCTAssertFalse(mockKeychain.shouldSucceed)
    }

    func testKeychainTestConfigurationNoBiometrics() async {
        // Given: No biometrics configuration
        let config = KeychainTestConfiguration.noBiometrics

        // When: Applying to mock
        config.apply(to: mockKeychain)

        // Then: Biometrics should be disabled
        XCTAssertFalse(mockKeychain.isBiometricsAvailable)
    }

    func testKeychainTestConfigurationNoSecureEnclave() async {
        // Given: No Secure Enclave configuration
        let config = KeychainTestConfiguration.noSecureEnclave

        // When: Applying to mock
        config.apply(to: mockKeychain)

        // Then: Secure Enclave should be disabled
        XCTAssertFalse(mockKeychain.isSecureEnclaveAvailable)
    }

    // MARK: - KeychainError Tests

    func testKeychainErrorDescriptions() {
        // Given: All keychain error types
        let errors: [KeychainError] = [
            .saveFailed(errSecIO),
            .loadFailed(errSecItemNotFound),
            .deleteFailed(errSecIO),
            .accessControlCreationFailed,
            .secureEnclaveNotAvailable,
            .keyGenerationFailed,
            .signingFailed,
            .encryptionFailed,
            .decryptionFailed,
            .publicKeyExtractionFailed,
            .authenticationFailed(NSError(domain: "test", code: 0))
        ]

        // Then: All should have descriptions
        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }

    // MARK: - KeychainConfiguration Tests

    func testKeychainConfigurationDefault() {
        // Given: Default configuration
        let config = KeychainConfiguration.default

        // Then: Should have expected values
        XCTAssertEqual(config.serviceName, "com.buildit.keys")
        XCTAssertNil(config.accessGroup)
        XCTAssertTrue(config.requiresBiometrics)
        XCTAssertTrue(config.useSecureEnclave)
    }

    // MARK: - KeychainItemType Tests

    func testKeychainItemTypeRawValues() {
        XCTAssertEqual(KeychainItemType.privateKey.rawValue, "private_key")
        XCTAssertEqual(KeychainItemType.symmetricKey.rawValue, "symmetric_key")
        XCTAssertEqual(KeychainItemType.deviceKey.rawValue, "device_key")
        XCTAssertEqual(KeychainItemType.backupKey.rawValue, "backup_key")
    }
}
