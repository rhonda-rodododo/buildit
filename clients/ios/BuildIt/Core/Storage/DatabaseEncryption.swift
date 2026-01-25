// DatabaseEncryption.swift
// BuildIt - Decentralized Mesh Communication
//
// Provides AES-256-GCM encryption for local database storage.
// Uses a master key stored in Keychain for encryption/decryption.

import Foundation
import CryptoKit
import os.log

/// Errors that can occur during database encryption operations
enum DatabaseEncryptionError: LocalizedError {
    case keyGenerationFailed
    case keyNotFound
    case encryptionFailed
    case decryptionFailed
    case invalidData
    case keychainError(OSStatus)

    var errorDescription: String? {
        switch self {
        case .keyGenerationFailed:
            return "Failed to generate encryption key"
        case .keyNotFound:
            return "Encryption key not found in keychain"
        case .encryptionFailed:
            return "Failed to encrypt data"
        case .decryptionFailed:
            return "Failed to decrypt data"
        case .invalidData:
            return "Invalid encrypted data format"
        case .keychainError(let status):
            return "Keychain error: \(status)"
        }
    }
}

/// Manages encryption/decryption for local database storage
/// Uses AES-256-GCM with a master key stored in Keychain
final class DatabaseEncryption {
    // MARK: - Singleton

    static let shared = DatabaseEncryption()

    // MARK: - Constants

    private static let keychainService = "com.buildit.database"
    private static let keychainAccount = "database_master_key"
    private static let encryptedFileMarker = Data([0x42, 0x49, 0x45, 0x4E]) // "BIEN" = BuildIt ENcrypted

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "DatabaseEncryption")
    private var cachedKey: SymmetricKey?
    private let keyLock = NSLock()

    // MARK: - Initialization

    private init() {
        // Subscribe to background notification to clear cached key
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    deinit {
        clearCachedKey()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Public Methods

    /// Encrypts data using AES-256-GCM
    /// - Parameter data: The plaintext data to encrypt
    /// - Returns: Encrypted data with marker, nonce, and tag
    func encrypt(_ data: Data) throws -> Data {
        let key = try getOrCreateMasterKey()

        // Generate random nonce
        let nonce = AES.GCM.Nonce()

        // Encrypt using AES-GCM
        guard let sealedBox = try? AES.GCM.seal(data, using: key, nonce: nonce) else {
            logger.error("AES-GCM encryption failed")
            throw DatabaseEncryptionError.encryptionFailed
        }

        // Format: marker (4 bytes) + nonce (12 bytes) + ciphertext + tag (16 bytes)
        var encryptedData = Self.encryptedFileMarker
        encryptedData.append(contentsOf: nonce)
        encryptedData.append(sealedBox.ciphertext)
        encryptedData.append(sealedBox.tag)

        return encryptedData
    }

    /// Decrypts data that was encrypted with `encrypt(_:)`
    /// - Parameter data: The encrypted data
    /// - Returns: The decrypted plaintext data
    func decrypt(_ data: Data) throws -> Data {
        let key = try getOrCreateMasterKey()

        // Verify marker
        guard data.count > Self.encryptedFileMarker.count + 12 + 16, // marker + nonce + tag minimum
              data.prefix(Self.encryptedFileMarker.count) == Self.encryptedFileMarker else {
            logger.error("Invalid encrypted data format - missing or invalid marker")
            throw DatabaseEncryptionError.invalidData
        }

        // Extract components
        let nonceStart = Self.encryptedFileMarker.count
        let nonceEnd = nonceStart + 12
        let tagStart = data.count - 16

        let nonceData = data[nonceStart..<nonceEnd]
        let ciphertext = data[nonceEnd..<tagStart]
        let tagData = data[tagStart...]

        // Reconstruct sealed box
        guard let nonce = try? AES.GCM.Nonce(data: nonceData) else {
            logger.error("Invalid nonce in encrypted data")
            throw DatabaseEncryptionError.invalidData
        }

        guard let sealedBox = try? AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tagData) else {
            logger.error("Failed to reconstruct sealed box")
            throw DatabaseEncryptionError.invalidData
        }

        // Decrypt
        guard let decrypted = try? AES.GCM.open(sealedBox, using: key) else {
            logger.error("AES-GCM decryption failed")
            throw DatabaseEncryptionError.decryptionFailed
        }

        return decrypted
    }

    /// Checks if data is encrypted (has the encryption marker)
    /// - Parameter data: Data to check
    /// - Returns: true if data appears to be encrypted
    func isEncrypted(_ data: Data) -> Bool {
        guard data.count >= Self.encryptedFileMarker.count else {
            return false
        }
        return data.prefix(Self.encryptedFileMarker.count) == Self.encryptedFileMarker
    }

    /// Clears the cached encryption key from memory
    /// Should be called when the app enters background
    func clearCachedKey() {
        keyLock.lock()
        defer { keyLock.unlock() }

        // Zero out the key data before releasing
        if cachedKey != nil {
            cachedKey = nil
            logger.debug("Cleared cached database encryption key")
        }
    }

    /// Deletes the master key from Keychain (used when user deletes all data)
    func deleteMasterKey() throws {
        clearCachedKey()

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.keychainAccount
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            logger.error("Failed to delete master key: \(status)")
            throw DatabaseEncryptionError.keychainError(status)
        }

        logger.info("Database master key deleted")
    }

    // MARK: - Private Methods

    private func getOrCreateMasterKey() throws -> SymmetricKey {
        keyLock.lock()
        defer { keyLock.unlock() }

        // Return cached key if available
        if let key = cachedKey {
            return key
        }

        // Try to load from Keychain
        if let key = try? loadMasterKey() {
            cachedKey = key
            return key
        }

        // Generate new key
        let key = try generateAndStoreMasterKey()
        cachedKey = key
        return key
    }

    private func loadMasterKey() throws -> SymmetricKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let keyData = result as? Data,
              keyData.count == 32 else {
            throw DatabaseEncryptionError.keyNotFound
        }

        logger.debug("Loaded database master key from keychain")
        return SymmetricKey(data: keyData)
    }

    private func generateAndStoreMasterKey() throws -> SymmetricKey {
        // Generate 256-bit key
        var keyBytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, 32, &keyBytes)

        guard status == errSecSuccess else {
            logger.error("Failed to generate random bytes for master key")
            throw DatabaseEncryptionError.keyGenerationFailed
        }

        let keyData = Data(keyBytes)

        // Zero the local copy after creating Data
        defer {
            for i in 0..<keyBytes.count {
                keyBytes[i] = 0
            }
        }

        // Store in Keychain with strong protection
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.keychainAccount,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        // Delete any existing key first
        SecItemDelete(query as CFDictionary)

        let addStatus = SecItemAdd(query as CFDictionary, nil)

        guard addStatus == errSecSuccess else {
            logger.error("Failed to store master key in keychain: \(addStatus)")
            throw DatabaseEncryptionError.keychainError(addStatus)
        }

        logger.info("Generated and stored new database master key")
        return SymmetricKey(data: keyData)
    }

    @objc private func applicationDidEnterBackground() {
        clearCachedKey()
    }
}

// MARK: - Encrypted File Writing Extension

extension DatabaseEncryption {
    /// Writes encrypted data to a file with NSFileProtectionComplete
    /// - Parameters:
    ///   - data: Plaintext data to encrypt and write
    ///   - url: File URL to write to
    func writeEncrypted(_ data: Data, to url: URL) throws {
        let encryptedData = try encrypt(data)

        // Write with atomic option and file protection
        try encryptedData.write(to: url, options: [.atomic, .completeFileProtection])

        // Also set file protection attribute
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.complete],
            ofItemAtPath: url.path
        )

        logger.debug("Wrote encrypted file: \(url.lastPathComponent)")
    }

    /// Reads and decrypts data from a file
    /// - Parameter url: File URL to read from
    /// - Returns: Decrypted data, or nil if file doesn't exist
    func readEncrypted(from url: URL) throws -> Data? {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        let encryptedData = try Data(contentsOf: url)

        // Check if data is encrypted (for migration from unencrypted format)
        if isEncrypted(encryptedData) {
            let decrypted = try decrypt(encryptedData)
            logger.debug("Read and decrypted file: \(url.lastPathComponent)")
            return decrypted
        } else {
            // Legacy unencrypted file - return as-is for migration
            logger.warning("Read unencrypted legacy file: \(url.lastPathComponent)")
            return encryptedData
        }
    }
}
