// KeychainManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages secure key storage using iOS Keychain and Secure Enclave.
// Supports biometric authentication for key access.

import Foundation
import Security
import LocalAuthentication
import os.log

/// Configuration for keychain access
struct KeychainConfiguration {
    let serviceName: String
    let accessGroup: String?
    let requiresBiometrics: Bool
    let useSecureEnclave: Bool

    static let `default` = KeychainConfiguration(
        serviceName: "com.buildit.keys",
        accessGroup: nil,
        requiresBiometrics: true,
        useSecureEnclave: true
    )

    /// Configuration for shared keychain access with Share Extension
    static let shared = KeychainConfiguration(
        serviceName: "com.buildit.keys",
        accessGroup: "com.buildit.shared.keychain",
        requiresBiometrics: true,
        useSecureEnclave: true
    )
}

/// Keychain item types
enum KeychainItemType: String {
    case privateKey = "private_key"
    case symmetricKey = "symmetric_key"
    case deviceKey = "device_key"
    case backupKey = "backup_key"
}

/// KeychainManager handles secure storage of cryptographic keys
/// Uses Secure Enclave when available for enhanced security
class KeychainManager {
    // MARK: - Singleton

    static let shared = KeychainManager()

    /// Shared instance with App Group keychain access for extensions
    static let sharedWithExtensions = KeychainManager(configuration: .shared)

    // MARK: - Properties

    private let configuration: KeychainConfiguration
    private let logger = Logger(subsystem: "com.buildit", category: "KeychainManager")
    private let queue = DispatchQueue(label: "com.buildit.keychain", qos: .userInitiated)

    /// Whether Secure Enclave is available on this device
    var isSecureEnclaveAvailable: Bool {
        // Check for Secure Enclave availability
        if #available(iOS 13.0, *) {
            return SecureEnclave.isAvailable
        }
        return false
    }

    /// Whether biometrics are available
    var isBiometricsAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// The type of biometrics available
    var biometryType: LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }

    // MARK: - Initialization

    init(configuration: KeychainConfiguration = .default) {
        self.configuration = configuration
    }

    // MARK: - Key Loading

    /// Load keys from keychain on app launch
    func loadKeys() async {
        logger.info("Loading keys from keychain")
    }

    // MARK: - Private Key Operations

    /// Save the private key to Keychain
    func savePrivateKey(_ privateKey: Data) async throws {
        let query = createQuery(for: .privateKey)

        // Delete any existing key first
        SecItemDelete(query as CFDictionary)

        // Create access control
        let accessControl = try createAccessControl()

        // Prepare attributes for the new key
        var attributes = query
        attributes[kSecValueData as String] = privateKey
        attributes[kSecAttrAccessControl as String] = accessControl

        // Add the key
        let status = SecItemAdd(attributes as CFDictionary, nil)

        guard status == errSecSuccess else {
            logger.error("Failed to save private key: \(status)")
            throw KeychainError.saveFailed(status)
        }

        logger.info("Private key saved to keychain")
    }

    /// Load the private key from Keychain
    func loadPrivateKey() async throws -> Data {
        var query = createQuery(for: .privateKey)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        // Create authentication context for biometric access
        if configuration.requiresBiometrics {
            let context = LAContext()
            context.localizedReason = "Access your BuildIt private key"
            query[kSecUseAuthenticationContext as String] = context
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data else {
            logger.error("Failed to load private key: \(status)")
            throw KeychainError.loadFailed(status)
        }

        logger.info("Private key loaded from keychain")
        return data
    }

    /// Delete the private key from Keychain
    func deletePrivateKey() async throws {
        let query = createQuery(for: .privateKey)
        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            logger.error("Failed to delete private key: \(status)")
            throw KeychainError.deleteFailed(status)
        }

        logger.info("Private key deleted from keychain")
    }

    /// Check if a private key exists
    func hasPrivateKey() -> Bool {
        var query = createQuery(for: .privateKey)
        query[kSecReturnData as String] = false

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    // MARK: - Secure Enclave Operations

    /// Generate a key in the Secure Enclave
    func generateSecureEnclaveKey() async throws -> SecKey {
        guard isSecureEnclaveAvailable else {
            throw KeychainError.secureEnclaveNotAvailable
        }

        // Create access control for Secure Enclave
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            nil
        ) else {
            throw KeychainError.accessControlCreationFailed
        }

        // Attributes for key generation
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: "com.buildit.secureenclave.key".data(using: .utf8)!,
                kSecAttrAccessControl as String: accessControl
            ]
        ]

        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            logger.error("Secure Enclave key generation failed: \(error.debugDescription)")
            throw KeychainError.keyGenerationFailed
        }

        logger.info("Generated Secure Enclave key")
        return privateKey
    }

    /// Load an existing Secure Enclave key
    func loadSecureEnclaveKey() async throws -> SecKey {
        guard isSecureEnclaveAvailable else {
            throw KeychainError.secureEnclaveNotAvailable
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrApplicationTag as String: "com.buildit.secureenclave.key".data(using: .utf8)!,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecReturnRef as String: true
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let key = result else {
            throw KeychainError.loadFailed(status)
        }

        // SecKey is a CFTypeRef, force cast is safe here
        return (key as! SecKey)
    }

    /// Sign data using Secure Enclave key
    func signWithSecureEnclave(data: Data, key: SecKey) async throws -> Data {
        // Create authentication context
        let context = LAContext()
        context.localizedReason = "Sign with your secure key"

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            key,
            .ecdsaSignatureMessageX962SHA256,
            data as CFData,
            &error
        ) else {
            logger.error("Secure Enclave signing failed: \(error.debugDescription)")
            throw KeychainError.signingFailed
        }

        return signature as Data
    }

    /// Encrypt data using Secure Enclave key
    func encryptWithSecureEnclave(data: Data, key: SecKey) async throws -> Data {
        guard let publicKey = SecKeyCopyPublicKey(key) else {
            throw KeychainError.publicKeyExtractionFailed
        }

        var error: Unmanaged<CFError>?
        guard let encrypted = SecKeyCreateEncryptedData(
            publicKey,
            .eciesEncryptionCofactorX963SHA256AESGCM,
            data as CFData,
            &error
        ) else {
            logger.error("Secure Enclave encryption failed: \(error.debugDescription)")
            throw KeychainError.encryptionFailed
        }

        return encrypted as Data
    }

    /// Decrypt data using Secure Enclave key
    func decryptWithSecureEnclave(data: Data, key: SecKey) async throws -> Data {
        var error: Unmanaged<CFError>?
        guard let decrypted = SecKeyCreateDecryptedData(
            key,
            .eciesEncryptionCofactorX963SHA256AESGCM,
            data as CFData,
            &error
        ) else {
            logger.error("Secure Enclave decryption failed: \(error.debugDescription)")
            throw KeychainError.decryptionFailed
        }

        return decrypted as Data
    }

    // MARK: - Biometric Authentication

    /// Authenticate using biometrics
    func authenticateWithBiometrics(reason: String) async throws -> Bool {
        let context = LAContext()

        // Configure context
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            ) { success, error in
                if let error = error {
                    continuation.resume(throwing: KeychainError.authenticationFailed(error))
                } else {
                    continuation.resume(returning: success)
                }
            }
        }
    }

    /// Authenticate with biometrics or device passcode
    func authenticateWithBiometricsOrPasscode(reason: String) async throws -> Bool {
        let context = LAContext()

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            ) { success, error in
                if let error = error {
                    continuation.resume(throwing: KeychainError.authenticationFailed(error))
                } else {
                    continuation.resume(returning: success)
                }
            }
        }
    }

    // MARK: - Generic Key Operations

    /// Save a symmetric key to Keychain
    func saveSymmetricKey(_ key: Data, identifier: String) async throws {
        var query = createQuery(for: .symmetricKey)
        query[kSecAttrAccount as String] = identifier

        // Delete existing
        SecItemDelete(query as CFDictionary)

        // Add new
        var attributes = query
        attributes[kSecValueData as String] = key

        let status = SecItemAdd(attributes as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /// Load a symmetric key from Keychain
    func loadSymmetricKey(identifier: String) async throws -> Data {
        var query = createQuery(for: .symmetricKey)
        query[kSecAttrAccount as String] = identifier
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data else {
            throw KeychainError.loadFailed(status)
        }

        return data
    }

    /// Delete a symmetric key from Keychain
    func deleteSymmetricKey(identifier: String) async throws {
        var query = createQuery(for: .symmetricKey)
        query[kSecAttrAccount as String] = identifier

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    // MARK: - Shared Keychain for Extensions

    /// Copy the private key to the shared keychain for extension access
    /// Note: The shared key uses less strict access control for extension compatibility
    func syncPrivateKeyToSharedKeychain() async throws {
        // Load from current keychain
        let privateKey = try await loadPrivateKey()

        // Save to shared keychain
        let sharedManager = KeychainManager.sharedWithExtensions
        try await sharedManager.savePrivateKeyForSharing(privateKey)

        logger.info("Synced private key to shared keychain")
    }

    /// Save private key with access control suitable for sharing with extensions
    func savePrivateKeyForSharing(_ privateKey: Data) async throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: KeychainItemType.privateKey.rawValue
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        // Delete any existing key first
        SecItemDelete(query as CFDictionary)

        // SECURITY TRADEOFF: Shared keychain for extensions uses
        // kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly without biometric
        // protection. This is a known limitation because iOS extensions cannot
        // present biometric prompts. The key is still device-bound (no iCloud
        // Keychain sync) and only accessible to apps in the same App Group.
        // The data-protection class ensures the key is unavailable before first
        // unlock (i.e., after a cold reboot before the user enters their passcode).
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            [],
            nil
        ) else {
            throw KeychainError.accessControlCreationFailed
        }

        // Prepare attributes for the new key
        var attributes = query
        attributes[kSecValueData as String] = privateKey
        attributes[kSecAttrAccessControl as String] = accessControl

        // Add the key
        let status = SecItemAdd(attributes as CFDictionary, nil)

        guard status == errSecSuccess else {
            logger.error("Failed to save private key to shared keychain: \(status)")
            throw KeychainError.saveFailed(status)
        }
    }

    /// Load private key from shared keychain (for extensions)
    func loadPrivateKeyFromSharedKeychain() async throws -> Data {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: KeychainItemType.privateKey.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data else {
            throw KeychainError.loadFailed(status)
        }

        return data
    }

    // MARK: - TOFU Certificate Pin Storage

    /// Keychain account identifier for TOFU pins
    private static let tofuPinsAccount = "tofu_certificate_pins"

    /// Save TOFU certificate pins to Keychain.
    ///
    /// SECURITY: TOFU pins were previously stored in UserDefaults, which is
    /// unencrypted and accessible to jailbroken device exploits. Moving to
    /// Keychain protects against:
    /// - File-system level extraction on jailbroken devices
    /// - Backup extraction attacks
    /// - Cross-app data access on compromised devices
    func saveTofuPins(_ pins: [String: String]) throws {
        let data = try JSONEncoder().encode(pins)

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: Self.tofuPinsAccount
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        // Delete existing
        SecItemDelete(query as CFDictionary)

        // Add new with device-only protection (no iCloud sync)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)

        guard status == errSecSuccess else {
            logger.error("Failed to save TOFU pins to keychain: \(status)")
            throw KeychainError.saveFailed(status)
        }

        logger.info("TOFU pins saved to keychain")
    }

    /// Load TOFU certificate pins from Keychain.
    func loadTofuPins() throws -> [String: String] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: Self.tofuPinsAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return [:]
        }

        guard status == errSecSuccess,
              let data = result as? Data else {
            logger.error("Failed to load TOFU pins from keychain: \(status)")
            throw KeychainError.loadFailed(status)
        }

        return try JSONDecoder().decode([String: String].self, from: data)
    }

    /// Delete TOFU certificate pins from Keychain.
    func deleteTofuPins() throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: Self.tofuPinsAccount
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            logger.error("Failed to delete TOFU pins from keychain: \(status)")
            throw KeychainError.deleteFailed(status)
        }

        logger.info("TOFU pins deleted from keychain")
    }

    /// Migrate TOFU pins from UserDefaults to Keychain.
    ///
    /// SECURITY: This performs a one-time migration of TOFU certificate pins
    /// from the insecure UserDefaults storage to Keychain. After successful
    /// migration, the UserDefaults entry is deleted.
    ///
    /// - Parameter userDefaultsKey: The UserDefaults key where pins were stored
    /// - Returns: true if migration was performed, false if nothing to migrate
    @discardableResult
    func migrateTofuPinsFromUserDefaults(userDefaultsKey: String) throws -> Bool {
        // Check if there are pins in UserDefaults
        guard let data = UserDefaults.standard.data(forKey: userDefaultsKey),
              let pins = try? JSONDecoder().decode([String: String].self, from: data),
              !pins.isEmpty else {
            return false
        }

        logger.info("Migrating \(pins.count) TOFU pins from UserDefaults to Keychain")

        // Check if we already have pins in Keychain
        let existingPins = try loadTofuPins()
        if !existingPins.isEmpty {
            // Merge: Keychain pins take precedence
            var mergedPins = pins
            for (key, value) in existingPins {
                mergedPins[key] = value
            }
            try saveTofuPins(mergedPins)
        } else {
            try saveTofuPins(pins)
        }

        // Remove from UserDefaults after successful migration
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
        UserDefaults.standard.synchronize()

        logger.info("Successfully migrated TOFU pins to Keychain and removed UserDefaults entry")
        return true
    }

    // MARK: - Private Methods

    private func createQuery(for type: KeychainItemType) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: configuration.serviceName,
            kSecAttrAccount as String: type.rawValue
        ]

        if let accessGroup = configuration.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }

    private func createAccessControl() throws -> SecAccessControl {
        var flags: SecAccessControlCreateFlags = []

        let biometricsRequested = configuration.requiresBiometrics
        let secureEnclaveRequested = configuration.useSecureEnclave
        let biometricsUsable = biometricsRequested && isBiometricsAvailable
        let secureEnclaveUsable = secureEnclaveRequested && isSecureEnclaveAvailable

        if biometricsUsable {
            flags.insert(.biometryCurrentSet)
        }

        if secureEnclaveUsable {
            flags.insert(.privateKeyUsage)
        }

        // SECURITY: Warn when the configuration requests hardware protection
        // but the device cannot provide it. This means the keychain item will
        // rely solely on data-protection-class access control, which is weaker.
        if !biometricsUsable && !secureEnclaveUsable {
            if biometricsRequested || secureEnclaveRequested {
                logger.warning(
                    "SECURITY DEGRADATION: Keychain access control created without biometric or Secure Enclave protection. " +
                    "Biometrics requested=\(biometricsRequested, privacy: .public), available=\(self.isBiometricsAvailable, privacy: .public). " +
                    "Secure Enclave requested=\(secureEnclaveRequested, privacy: .public), available=\(self.isSecureEnclaveAvailable, privacy: .public). " +
                    "Key material is protected only by data-protection class (kSecAttrAccessibleWhenUnlockedThisDeviceOnly)."
                )
            }
        }

        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            nil
        ) else {
            throw KeychainError.accessControlCreationFailed
        }

        return accessControl
    }
}

// MARK: - Keychain Errors

enum KeychainError: LocalizedError {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
    case deleteFailed(OSStatus)
    case accessControlCreationFailed
    case secureEnclaveNotAvailable
    case keyGenerationFailed
    case signingFailed
    case encryptionFailed
    case decryptionFailed
    case publicKeyExtractionFailed
    case authenticationFailed(Error)

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Failed to save to keychain: \(status)"
        case .loadFailed(let status):
            return "Failed to load from keychain: \(status)"
        case .deleteFailed(let status):
            return "Failed to delete from keychain: \(status)"
        case .accessControlCreationFailed:
            return "Failed to create access control"
        case .secureEnclaveNotAvailable:
            return "Secure Enclave not available on this device"
        case .keyGenerationFailed:
            return "Failed to generate key"
        case .signingFailed:
            return "Failed to sign data"
        case .encryptionFailed:
            return "Failed to encrypt data"
        case .decryptionFailed:
            return "Failed to decrypt data"
        case .publicKeyExtractionFailed:
            return "Failed to extract public key"
        case .authenticationFailed(let error):
            return "Authentication failed: \(error.localizedDescription)"
        }
    }
}
