// MockKeychain.swift
// BuildItTests
//
// Mock Keychain implementation for testing

import Foundation
import Security
@testable import BuildIt

/// Mock Keychain Manager for unit testing without actual Keychain access
class MockKeychain {
    // MARK: - Properties

    /// In-memory storage simulating Keychain
    private var storage: [String: Data] = [:]

    /// Whether operations should succeed
    var shouldSucceed: Bool = true

    /// Simulated error to throw when shouldSucceed is false
    var simulatedError: KeychainError = .saveFailed(errSecIO)

    /// Track all operations for verification
    private(set) var operationLog: [KeychainOperation] = []

    /// Whether biometrics are simulated as available
    var isBiometricsAvailable: Bool = true

    /// Whether Secure Enclave is simulated as available
    var isSecureEnclaveAvailable: Bool = true

    // MARK: - Operation Tracking

    enum KeychainOperation: Equatable {
        case save(key: String)
        case load(key: String)
        case delete(key: String)
        case authenticate
        case generateSecureEnclaveKey
    }

    // MARK: - Initialization

    init() {}

    // MARK: - Reset

    /// Reset all stored data and operation log
    func reset() {
        storage.removeAll()
        operationLog.removeAll()
        shouldSucceed = true
    }

    // MARK: - Private Key Operations

    func savePrivateKey(_ privateKey: Data) async throws {
        operationLog.append(.save(key: "private_key"))

        guard shouldSucceed else {
            throw simulatedError
        }

        storage["private_key"] = privateKey
    }

    func loadPrivateKey() async throws -> Data {
        operationLog.append(.load(key: "private_key"))

        guard shouldSucceed else {
            throw simulatedError
        }

        guard let data = storage["private_key"] else {
            throw KeychainError.loadFailed(errSecItemNotFound)
        }

        return data
    }

    func deletePrivateKey() async throws {
        operationLog.append(.delete(key: "private_key"))

        guard shouldSucceed else {
            throw simulatedError
        }

        storage.removeValue(forKey: "private_key")
    }

    func hasPrivateKey() -> Bool {
        storage["private_key"] != nil
    }

    // MARK: - Symmetric Key Operations

    func saveSymmetricKey(_ key: Data, identifier: String) async throws {
        operationLog.append(.save(key: identifier))

        guard shouldSucceed else {
            throw simulatedError
        }

        storage[identifier] = key
    }

    func loadSymmetricKey(identifier: String) async throws -> Data {
        operationLog.append(.load(key: identifier))

        guard shouldSucceed else {
            throw simulatedError
        }

        guard let data = storage[identifier] else {
            throw KeychainError.loadFailed(errSecItemNotFound)
        }

        return data
    }

    func deleteSymmetricKey(identifier: String) async throws {
        operationLog.append(.delete(key: identifier))

        guard shouldSucceed else {
            throw simulatedError
        }

        storage.removeValue(forKey: identifier)
    }

    // MARK: - Authentication

    func authenticateWithBiometrics(reason: String) async throws -> Bool {
        operationLog.append(.authenticate)

        guard shouldSucceed else {
            throw KeychainError.authenticationFailed(NSError(domain: "LAError", code: -1))
        }

        return isBiometricsAvailable
    }

    // MARK: - Secure Enclave

    func generateSecureEnclaveKey() async throws {
        operationLog.append(.generateSecureEnclaveKey)

        guard shouldSucceed else {
            throw KeychainError.secureEnclaveNotAvailable
        }

        guard isSecureEnclaveAvailable else {
            throw KeychainError.secureEnclaveNotAvailable
        }

        // Simulate key generation by storing a marker
        storage["secure_enclave_key"] = Data([0x01])
    }

    // MARK: - Verification Helpers

    /// Check if a specific operation was performed
    func didPerformOperation(_ operation: KeychainOperation) -> Bool {
        operationLog.contains(operation)
    }

    /// Get count of specific operation type
    func operationCount(for operation: KeychainOperation) -> Int {
        operationLog.filter { $0 == operation }.count
    }

    /// Get all keys currently stored
    func getAllStoredKeys() -> [String] {
        Array(storage.keys)
    }

    /// Check if a key exists in storage
    func hasKey(_ key: String) -> Bool {
        storage[key] != nil
    }

    /// Get stored data for a key (for test verification)
    func getStoredData(for key: String) -> Data? {
        storage[key]
    }

    /// Set stored data directly (for test setup)
    func setStoredData(_ data: Data, for key: String) {
        storage[key] = data
    }
}

// MARK: - Testable Keychain Protocol

/// Protocol for dependency injection of keychain operations
protocol KeychainProtocol {
    func savePrivateKey(_ privateKey: Data) async throws
    func loadPrivateKey() async throws -> Data
    func deletePrivateKey() async throws
    func hasPrivateKey() -> Bool
    func saveSymmetricKey(_ key: Data, identifier: String) async throws
    func loadSymmetricKey(identifier: String) async throws -> Data
    func deleteSymmetricKey(identifier: String) async throws
}

// MARK: - MockKeychain Conformance

extension MockKeychain: KeychainProtocol {}

// MARK: - Mock Access Control

/// Mock access control for testing protected operations
class MockAccessControl {
    var requiresAuthentication: Bool = false
    var authenticationSucceeds: Bool = true

    func checkAccess() throws {
        if requiresAuthentication && !authenticationSucceeds {
            throw KeychainError.authenticationFailed(
                NSError(domain: "LAError", code: -2, userInfo: [NSLocalizedDescriptionKey: "User cancelled"])
            )
        }
    }
}

// MARK: - Keychain Test Configuration

/// Configuration for keychain test scenarios
struct KeychainTestConfiguration {
    var shouldSucceed: Bool = true
    var biometricsAvailable: Bool = true
    var secureEnclaveAvailable: Bool = true
    var simulatedLatency: TimeInterval = 0

    /// Create a failing configuration
    static var failing: KeychainTestConfiguration {
        var config = KeychainTestConfiguration()
        config.shouldSucceed = false
        return config
    }

    /// Create a configuration without biometrics
    static var noBiometrics: KeychainTestConfiguration {
        var config = KeychainTestConfiguration()
        config.biometricsAvailable = false
        return config
    }

    /// Create a configuration without Secure Enclave
    static var noSecureEnclave: KeychainTestConfiguration {
        var config = KeychainTestConfiguration()
        config.secureEnclaveAvailable = false
        return config
    }

    /// Apply configuration to a mock keychain
    func apply(to mock: MockKeychain) {
        mock.shouldSucceed = shouldSucceed
        mock.isBiometricsAvailable = biometricsAvailable
        mock.isSecureEnclaveAvailable = secureEnclaveAvailable
    }
}
