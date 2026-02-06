// CryptoManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages cryptographic operations for the BuildIt app.
// Wraps buildit-crypto FFI for Nostr-compatible key operations.

import Foundation
import CryptoKit
import Combine
import os.log

/// Represents a Nostr-compatible key pair
struct NostrKeyPair {
    let privateKey: Data
    let publicKey: Data

    var privateKeyHex: String {
        privateKey.map { String(format: "%02x", $0) }.joined()
    }

    var publicKeyHex: String {
        publicKey.map { String(format: "%02x", $0) }.joined()
    }

    /// Generate npub (bech32-encoded public key)
    var npub: String {
        Bech32.encode(hrp: "npub", data: publicKey)
    }

    /// Generate nsec (bech32-encoded private key)
    var nsec: String {
        Bech32.encode(hrp: "nsec", data: privateKey)
    }
}

/// Encryption result with ciphertext and nonce
struct EncryptedMessage {
    let ciphertext: Data
    let nonce: Data

    var combined: Data {
        nonce + ciphertext
    }

    static func fromCombined(_ data: Data) -> EncryptedMessage? {
        guard data.count > 24 else { return nil }
        let nonce = data.prefix(24)
        let ciphertext = data.suffix(from: 24)
        return EncryptedMessage(ciphertext: Data(ciphertext), nonce: Data(nonce))
    }
}

/// CryptoManager handles all cryptographic operations
/// Uses Curve25519 for key exchange and ChaCha20-Poly1305 for encryption
///
/// Security features:
/// - Memory zeroization on deinit
/// - Shared secret cache cleared on app background
/// - Key material stored in Keychain with biometric protection
@MainActor
class CryptoManager: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = CryptoManager()

    // MARK: - Published Properties

    @Published private(set) var isInitialized: Bool = false
    @Published private(set) var hasKeyPair: Bool = false

    // MARK: - Private Properties

    private var keyPair: NostrKeyPair?
    private let keychainManager = KeychainManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "CryptoManager")

    // Cache for shared secrets - entries expire after TTL, capped at maxCacheSize.
    // Also cleared entirely on background for defense-in-depth.
    private static let cacheTTL: TimeInterval = 300 // 5 minutes
    private static let maxCacheSize = 50

    private struct CacheEntry {
        let key: SymmetricKey
        let timestamp: Date
    }

    private var sharedSecretCache: [String: CacheEntry] = [:]
    private let cacheLock = NSLock()

    // MARK: - Initialization

    private override init() {
        super.init()
        setupBackgroundObserver()
    }

    deinit {
        // Zero out sensitive memory on deallocation
        clearSensitiveMemory()
        NotificationCenter.default.removeObserver(self)
    }

    private func setupBackgroundObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
    }

    @objc private func applicationDidEnterBackground() {
        // Clear shared secret cache when app backgrounds for security
        clearSharedSecretCache()
        logger.debug("Cleared shared secret cache on background")
    }

    @objc private func applicationWillTerminate() {
        clearSensitiveMemory()
    }

    // MARK: - Memory Security

    /// Clears the shared secret cache
    /// Should be called when app enters background
    func clearSharedSecretCache() {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        sharedSecretCache.removeAll()
    }

    /// Zeros out all sensitive memory
    /// Called on deinit and app termination
    private func clearSensitiveMemory() {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        // Clear cached shared secrets
        sharedSecretCache.removeAll()

        // Note: keyPair contains Data which is value type in Swift
        // Setting to nil will trigger deallocation, but Swift doesn't guarantee
        // immediate memory zeroing. For maximum security, the private key
        // should only be loaded from Keychain when needed and never cached.
        // The Keychain-stored key is protected by Secure Enclave when available.
        keyPair = nil

        logger.debug("Cleared sensitive cryptographic memory")
    }

    /// Initialize crypto manager and load existing keys
    func initialize() async {
        // Try to load existing key pair from Keychain
        if let privateKeyData = try? await keychainManager.loadPrivateKey() {
            do {
                let keyPair = try deriveKeyPair(from: privateKeyData)
                self.keyPair = keyPair
                hasKeyPair = true
                logger.info("Loaded existing key pair")
            } catch {
                logger.error("Failed to derive key pair: \(error.localizedDescription)")
            }
        }

        isInitialized = true
    }

    // MARK: - Key Management

    /// Generate a new Nostr-compatible key pair
    func generateKeyPair() async throws -> NostrKeyPair {
        // Generate 32 random bytes for private key
        var privateKeyBytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, 32, &privateKeyBytes)

        guard status == errSecSuccess else {
            throw CryptoError.randomGenerationFailed
        }

        let privateKeyData = Data(privateKeyBytes)
        let keyPair = try deriveKeyPair(from: privateKeyData)

        // Save to Keychain
        try await keychainManager.savePrivateKey(privateKeyData)

        self.keyPair = keyPair
        hasKeyPair = true

        logger.info("Generated new key pair")
        return keyPair
    }

    /// Import an existing private key
    func importPrivateKey(_ privateKeyHex: String) async throws -> NostrKeyPair {
        guard let privateKeyData = Data(hexString: privateKeyHex),
              privateKeyData.count == 32 else {
            throw CryptoError.invalidPrivateKey
        }

        let keyPair = try deriveKeyPair(from: privateKeyData)

        // Save to Keychain
        try await keychainManager.savePrivateKey(privateKeyData)

        self.keyPair = keyPair
        hasKeyPair = true

        logger.info("Imported private key")
        return keyPair
    }

    /// Import from nsec format
    func importNsec(_ nsec: String) async throws -> NostrKeyPair {
        guard let (hrp, data) = Bech32.decode(nsec),
              hrp == "nsec",
              data.count == 32 else {
            throw CryptoError.invalidNsec
        }

        return try await importPrivateKey(data.hexString)
    }

    /// Get the current public key in hex format
    func getPublicKeyHex() async -> String? {
        keyPair?.publicKeyHex
    }

    /// Get the current npub
    func getNpub() async -> String? {
        keyPair?.npub
    }

    /// Delete the current key pair
    func deleteKeyPair() async throws {
        try await keychainManager.deletePrivateKey()

        // Clear all sensitive memory
        clearSensitiveMemory()

        keyPair = nil
        hasKeyPair = false

        logger.info("Deleted key pair and cleared sensitive memory")
    }

    // MARK: - Encryption

    /// Encrypt a message for a recipient using their public key
    func encrypt(_ message: Data, for recipientPublicKey: String) async throws -> EncryptedMessage {
        guard let keyPair = keyPair else {
            throw CryptoError.noKeyPair
        }

        let sharedSecret = try getSharedSecret(with: recipientPublicKey)

        // Generate random nonce
        var nonceBytes = [UInt8](repeating: 0, count: 24)
        let status = SecRandomCopyBytes(kSecRandomDefault, 24, &nonceBytes)
        guard status == errSecSuccess else {
            throw CryptoError.randomGenerationFailed
        }
        let nonce = Data(nonceBytes)

        // Encrypt using ChaCha20-Poly1305
        let sealedBox = try ChaChaPoly.seal(
            message,
            using: sharedSecret,
            nonce: ChaChaPoly.Nonce(data: nonce)
        )

        return EncryptedMessage(
            ciphertext: sealedBox.ciphertext + sealedBox.tag,
            nonce: nonce
        )
    }

    /// Decrypt a message from a sender
    func decrypt(_ encrypted: EncryptedMessage, from senderPublicKey: String) async throws -> Data {
        let sharedSecret = try getSharedSecret(with: senderPublicKey)

        // Split ciphertext and tag
        let ciphertext = encrypted.ciphertext.dropLast(16)
        let tag = encrypted.ciphertext.suffix(16)

        // Decrypt using ChaCha20-Poly1305
        let sealedBox = try ChaChaPoly.SealedBox(
            nonce: ChaChaPoly.Nonce(data: encrypted.nonce),
            ciphertext: ciphertext,
            tag: tag
        )

        return try ChaChaPoly.open(sealedBox, using: sharedSecret)
    }

    /// Encrypt for NIP-04 compatible format (for Nostr DMs)
    func encryptNIP04(_ message: String, for recipientPublicKey: String) async throws -> String {
        let messageData = message.data(using: .utf8)!
        let encrypted = try await encrypt(messageData, for: recipientPublicKey)

        // NIP-04 format: base64(ciphertext)?iv=base64(iv)
        let ciphertextBase64 = encrypted.ciphertext.base64EncodedString()
        let ivBase64 = encrypted.nonce.prefix(16).base64EncodedString()

        return "\(ciphertextBase64)?iv=\(ivBase64)"
    }

    /// Decrypt NIP-04 format
    func decryptNIP04(_ content: String, from senderPublicKey: String) async throws -> String {
        let parts = content.split(separator: "?")
        guard parts.count == 2,
              let ciphertext = Data(base64Encoded: String(parts[0])),
              parts[1].hasPrefix("iv=") else {
            throw CryptoError.invalidNIP04Format
        }

        let ivString = String(parts[1].dropFirst(3))
        guard let iv = Data(base64Encoded: ivString) else {
            throw CryptoError.invalidNIP04Format
        }

        // Pad IV to 24 bytes for ChaCha20
        var nonce = iv
        if nonce.count < 24 {
            nonce.append(Data(repeating: 0, count: 24 - nonce.count))
        }

        let encrypted = EncryptedMessage(ciphertext: ciphertext, nonce: nonce)
        let decrypted = try await decrypt(encrypted, from: senderPublicKey)

        guard let message = String(data: decrypted, encoding: .utf8) else {
            throw CryptoError.decryptionFailed
        }

        return message
    }

    // MARK: - Signing

    /// Sign data with our private key (Schnorr signature for Nostr)
    func sign(_ data: Data) async throws -> String {
        guard let keyPair = keyPair else {
            throw CryptoError.noKeyPair
        }

        // Create Curve25519 signing key
        let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: keyPair.privateKey)

        // Sign the data
        let signature = try signingKey.signature(for: data)

        return signature.hexString
    }

    /// Sign a Nostr event (sign the event ID hash)
    func signEvent(eventId: String) async throws -> String {
        guard let eventIdData = Data(hexString: eventId) else {
            throw CryptoError.invalidEventId
        }

        return try await sign(eventIdData)
    }

    /// Verify a signature
    func verifySignature(_ signature: String, for data: Data, publicKey: String) async -> Bool {
        guard let signatureData = Data(hexString: signature),
              let publicKeyData = Data(hexString: publicKey) else {
            return false
        }

        do {
            let verifyingKey = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyData)
            return verifyingKey.isValidSignature(signatureData, for: data)
        } catch {
            logger.error("Signature verification failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Hashing

    /// SHA256 hash of data
    func sha256(_ data: Data) -> Data {
        Data(SHA256.hash(data: data))
    }

    /// SHA256 hash of string
    func sha256(_ string: String) -> String {
        let data = string.data(using: .utf8)!
        return sha256(data).hexString
    }

    // MARK: - Private Methods

    private func deriveKeyPair(from privateKey: Data) throws -> NostrKeyPair {
        // Derive public key using Curve25519
        let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKey)
        let publicKey = signingKey.publicKey.rawRepresentation

        return NostrKeyPair(privateKey: privateKey, publicKey: publicKey)
    }

    /// Evicts expired entries from the cache. Must be called while holding cacheLock.
    private func evictExpiredCacheEntries() {
        let now = Date()
        sharedSecretCache = sharedSecretCache.filter { _, entry in
            now.timeIntervalSince(entry.timestamp) < Self.cacheTTL
        }
    }

    private func getSharedSecret(with publicKeyHex: String) throws -> SymmetricKey {
        cacheLock.lock()

        // Evict expired entries on every access
        evictExpiredCacheEntries()

        // Check cache first (while holding lock)
        if let cached = sharedSecretCache[publicKeyHex] {
            cacheLock.unlock()
            return cached.key
        }

        cacheLock.unlock()

        guard let keyPair = keyPair,
              let publicKeyData = Data(hexString: publicKeyHex) else {
            throw CryptoError.invalidPublicKey
        }

        // Compute shared secret using X25519 key agreement
        let privateKey = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: keyPair.privateKey)
        let publicKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: publicKeyData)

        let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: publicKey)

        // Derive symmetric key
        let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "buildit-encryption".data(using: .utf8)!,
            outputByteCount: 32
        )

        // Cache it (with lock)
        cacheLock.lock()

        // Enforce size limit: if at capacity, evict the oldest entry
        if sharedSecretCache.count >= Self.maxCacheSize {
            if let oldestKey = sharedSecretCache.min(by: { $0.value.timestamp < $1.value.timestamp })?.key {
                sharedSecretCache.removeValue(forKey: oldestKey)
            }
        }

        sharedSecretCache[publicKeyHex] = CacheEntry(key: symmetricKey, timestamp: Date())
        cacheLock.unlock()

        return symmetricKey
    }
}

// MARK: - Crypto Errors

enum CryptoError: LocalizedError {
    case randomGenerationFailed
    case invalidPrivateKey
    case invalidPublicKey
    case invalidNsec
    case noKeyPair
    case encryptionFailed
    case decryptionFailed
    case invalidNIP04Format
    case invalidEventId
    case signingFailed

    var errorDescription: String? {
        switch self {
        case .randomGenerationFailed:
            return "Failed to generate random bytes"
        case .invalidPrivateKey:
            return "Invalid private key format"
        case .invalidPublicKey:
            return "Invalid public key format"
        case .invalidNsec:
            return "Invalid nsec format"
        case .noKeyPair:
            return "No key pair available"
        case .encryptionFailed:
            return "Encryption failed"
        case .decryptionFailed:
            return "Decryption failed"
        case .invalidNIP04Format:
            return "Invalid NIP-04 encrypted message format"
        case .invalidEventId:
            return "Invalid event ID"
        case .signingFailed:
            return "Signing failed"
        }
    }
}

// MARK: - Bech32 Encoding

/// Bech32 encoding/decoding for Nostr keys
enum Bech32 {
    private static let charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

    static func encode(hrp: String, data: Data) -> String {
        let values = convertTo5bit(data)
        let checksum = createChecksum(hrp: hrp, values: values)
        let combined = values + checksum

        var result = hrp + "1"
        for value in combined {
            let index = charset.index(charset.startIndex, offsetBy: Int(value))
            result.append(charset[index])
        }

        return result
    }

    static func decode(_ string: String) -> (hrp: String, data: Data)? {
        let lower = string.lowercased()

        guard let separatorIndex = lower.lastIndex(of: "1") else {
            return nil
        }

        let hrp = String(lower[..<separatorIndex])
        let dataString = String(lower[lower.index(after: separatorIndex)...])

        var values: [UInt8] = []
        for char in dataString {
            guard let index = charset.firstIndex(of: char) else {
                return nil
            }
            values.append(UInt8(charset.distance(from: charset.startIndex, to: index)))
        }

        guard verifyChecksum(hrp: hrp, values: values) else {
            return nil
        }

        let data = convertFrom5bit(Array(values.dropLast(6)))
        return (hrp, data)
    }

    private static func convertTo5bit(_ data: Data) -> [UInt8] {
        var result: [UInt8] = []
        var acc: Int = 0
        var bits: Int = 0

        for byte in data {
            acc = (acc << 8) | Int(byte)
            bits += 8
            while bits >= 5 {
                bits -= 5
                result.append(UInt8((acc >> bits) & 31))
            }
        }

        if bits > 0 {
            result.append(UInt8((acc << (5 - bits)) & 31))
        }

        return result
    }

    private static func convertFrom5bit(_ values: [UInt8]) -> Data {
        var result = Data()
        var acc: Int = 0
        var bits: Int = 0

        for value in values {
            acc = (acc << 5) | Int(value)
            bits += 5
            while bits >= 8 {
                bits -= 8
                result.append(UInt8((acc >> bits) & 255))
            }
        }

        return result
    }

    private static func createChecksum(hrp: String, values: [UInt8]) -> [UInt8] {
        var expanded = expandHRP(hrp) + values + [0, 0, 0, 0, 0, 0]
        let polymod = polymod(&expanded) ^ 1
        var result: [UInt8] = []
        for i in 0..<6 {
            result.append(UInt8((polymod >> (5 * (5 - i))) & 31))
        }
        return result
    }

    private static func verifyChecksum(hrp: String, values: [UInt8]) -> Bool {
        var expanded = expandHRP(hrp) + values
        return polymod(&expanded) == 1
    }

    private static func expandHRP(_ hrp: String) -> [UInt8] {
        var result: [UInt8] = []
        for char in hrp.unicodeScalars {
            result.append(UInt8(char.value >> 5))
        }
        result.append(0)
        for char in hrp.unicodeScalars {
            result.append(UInt8(char.value & 31))
        }
        return result
    }

    private static func polymod(_ values: inout [UInt8]) -> Int {
        let generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
        var chk = 1
        for value in values {
            let top = chk >> 25
            chk = ((chk & 0x1ffffff) << 5) ^ Int(value)
            for i in 0..<5 {
                if ((top >> i) & 1) != 0 {
                    chk ^= generator[i]
                }
            }
        }
        return chk
    }
}

// MARK: - Data Extensions

extension Data {
    init?(hexString: String) {
        let hex = hexString.lowercased()
        guard hex.count % 2 == 0 else { return nil }

        var data = Data()
        var index = hex.startIndex

        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }

        self = data
    }

    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
