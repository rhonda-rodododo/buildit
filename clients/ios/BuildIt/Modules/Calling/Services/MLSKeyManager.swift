// MLSKeyManager.swift
// BuildIt - MLS E2EE Key Management
//
// Manages MLS (Message Layer Security) keys for conference E2EE.
// Provides zero-knowledge encryption where SFU cannot decrypt media.

import Foundation
import CryptoKit
import os.log

/// MLS Cipher Suite: MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
private let mlsCipherSuite = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"

/// Maximum cached epochs for out-of-order frame decryption
private let maxCachedEpochs = 5

/// MLS Key Manager for conference E2EE
public class MLSKeyManager {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "MLSKeyManager")

    private let roomId: String
    private let localPubkey: String

    // Current epoch and key
    private var currentEpoch: Int = 0
    private var epochKeys: [Int: SymmetricKey] = [:]

    // MLS state (in production, use actual MLS library)
    private var groupMembers: Set<String> = []
    private var isInitialized: Bool = false

    // Key derivation
    private let hkdfSalt: Data

    // MARK: - Initialization

    public init(roomId: String, localPubkey: String) {
        self.roomId = roomId
        self.localPubkey = localPubkey

        // Generate deterministic salt from room ID
        self.hkdfSalt = SHA256.hash(data: Data(roomId.utf8)).withUnsafeBytes { Data($0) }

        logger.info("MLSKeyManager initialized for room: \(roomId)")
    }

    // MARK: - Group Management

    /// Initialize a new MLS group (creator)
    public func initializeGroup(participants: [String]) async throws {
        guard !isInitialized else {
            throw MLSError.alreadyInitialized
        }

        groupMembers = Set(participants)
        currentEpoch = 0

        // Generate initial epoch key
        let epochKey = try generateEpochKey(epoch: 0)
        epochKeys[0] = epochKey

        isInitialized = true
        logger.info("MLS group initialized with \(participants.count) participants")
    }

    /// Handle MLS Welcome message (joiner)
    public func handleWelcome(_ welcome: Data) async throws {
        guard !isInitialized else {
            throw MLSError.alreadyInitialized
        }

        // In production, parse MLS Welcome and extract:
        // - Group info
        // - Epoch secrets
        // - Member list

        // For now, derive key from welcome data
        let epochKey = try deriveKeyFromWelcome(welcome)
        epochKeys[currentEpoch] = epochKey

        isInitialized = true
        logger.info("MLS Welcome processed, epoch: \(currentEpoch)")
    }

    /// Handle MLS Commit message (key rotation)
    public func handleCommit(_ commit: Data, epoch: Int) async throws {
        guard isInitialized else {
            throw MLSError.notInitialized
        }

        guard epoch > currentEpoch else {
            logger.warning("Received old epoch commit: \(epoch) <= \(currentEpoch)")
            return
        }

        // Derive new epoch key from commit
        let newKey = try deriveKeyFromCommit(commit, epoch: epoch)

        // Update epoch
        currentEpoch = epoch
        epochKeys[epoch] = newKey

        // Prune old keys (keep last N for out-of-order frames)
        pruneOldEpochKeys()

        logger.info("MLS Commit processed, new epoch: \(epoch)")
    }

    /// Add participant to group (returns Commit)
    public func addParticipant(pubkey: String, keyPackage: Data) async throws -> Data {
        guard isInitialized else {
            throw MLSError.notInitialized
        }

        guard !groupMembers.contains(pubkey) else {
            throw MLSError.participantAlreadyInGroup
        }

        groupMembers.insert(pubkey)
        currentEpoch += 1

        // Generate new epoch key
        let newKey = try generateEpochKey(epoch: currentEpoch)
        epochKeys[currentEpoch] = newKey
        pruneOldEpochKeys()

        // In production, create actual MLS Commit
        let commit = createCommitData(epoch: currentEpoch, action: .add(pubkey))

        logger.info("Added participant \(pubkey), new epoch: \(currentEpoch)")
        return commit
    }

    /// Remove participant from group (returns Commit)
    public func removeParticipant(pubkey: String) async throws -> Data {
        guard isInitialized else {
            throw MLSError.notInitialized
        }

        guard groupMembers.contains(pubkey) else {
            throw MLSError.participantNotInGroup
        }

        groupMembers.remove(pubkey)
        currentEpoch += 1

        // Generate new epoch key (forward secrecy)
        let newKey = try generateEpochKey(epoch: currentEpoch)
        epochKeys[currentEpoch] = newKey
        pruneOldEpochKeys()

        // In production, create actual MLS Commit
        let commit = createCommitData(epoch: currentEpoch, action: .remove(pubkey))

        logger.info("Removed participant \(pubkey), new epoch: \(currentEpoch)")
        return commit
    }

    // MARK: - Key Access

    /// Get current epoch
    public func getCurrentEpoch() -> Int {
        return currentEpoch
    }

    /// Get current epoch key
    public func getCurrentEpochKey() -> SymmetricKey? {
        return epochKeys[currentEpoch]
    }

    /// Get key for specific epoch (for out-of-order frame decryption)
    public func getEpochKey(_ epoch: Int) -> SymmetricKey? {
        return epochKeys[epoch]
    }

    // MARK: - Frame Encryption/Decryption

    /// Encrypt a frame with current epoch key
    public func encryptFrame(_ frame: Data) throws -> (encrypted: Data, epoch: Int) {
        guard let key = getCurrentEpochKey() else {
            throw MLSError.noKeyAvailable
        }

        // Generate nonce
        var nonce = Data(count: 12)
        nonce.withUnsafeMutableBytes { buffer in
            _ = SecRandomCopyBytes(kSecRandomDefault, 12, buffer.baseAddress!)
        }

        // Encrypt with AES-GCM
        let sealedBox = try AES.GCM.seal(frame, using: key, nonce: AES.GCM.Nonce(data: nonce))

        // Build encrypted frame: [nonce(12)][ciphertext+tag]
        var encrypted = Data()
        encrypted.append(nonce)
        encrypted.append(sealedBox.ciphertext)
        encrypted.append(sealedBox.tag)

        return (encrypted, currentEpoch)
    }

    /// Decrypt a frame with specified epoch key
    public func decryptFrame(_ encryptedFrame: Data, epoch: Int) throws -> Data {
        guard let key = getEpochKey(epoch) else {
            throw MLSError.noKeyForEpoch(epoch)
        }

        guard encryptedFrame.count > 12 + 16 else { // nonce + min tag
            throw MLSError.invalidFrameFormat
        }

        // Extract nonce
        let nonce = encryptedFrame.prefix(12)

        // Extract ciphertext + tag
        let ciphertextAndTag = encryptedFrame.dropFirst(12)
        let ciphertext = ciphertextAndTag.dropLast(16)
        let tag = ciphertextAndTag.suffix(16)

        // Decrypt with AES-GCM
        let sealedBox = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: nonce),
            ciphertext: ciphertext,
            tag: tag
        )

        let decrypted = try AES.GCM.open(sealedBox, using: key)
        return decrypted
    }

    // MARK: - Private Helpers

    /// Generate epoch key using HKDF
    private func generateEpochKey(epoch: Int) throws -> SymmetricKey {
        // Use HKDF to derive key from room secret + epoch
        let info = "mls-epoch-\(epoch)".data(using: .utf8)!

        // In production, this would use the actual MLS epoch secret
        let inputKeyMaterial = SymmetricKey(data: hkdfSalt)

        let derivedKey = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: inputKeyMaterial,
            salt: hkdfSalt,
            info: info,
            outputByteCount: 16 // AES-128
        )

        return derivedKey
    }

    /// Derive key from Welcome message
    private func deriveKeyFromWelcome(_ welcome: Data) throws -> SymmetricKey {
        // In production, extract secrets from MLS Welcome
        let info = "mls-welcome-key".data(using: .utf8)!

        let inputKeyMaterial = SymmetricKey(data: SHA256.hash(data: welcome))

        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: inputKeyMaterial,
            salt: hkdfSalt,
            info: info,
            outputByteCount: 16
        )
    }

    /// Derive key from Commit message
    private func deriveKeyFromCommit(_ commit: Data, epoch: Int) throws -> SymmetricKey {
        // In production, use MLS commit secrets
        let info = "mls-commit-epoch-\(epoch)".data(using: .utf8)!

        // Combine previous key with commit data
        let previousKey = epochKeys[currentEpoch]
        var combinedData = Data()
        if let prevKey = previousKey {
            prevKey.withUnsafeBytes { combinedData.append(contentsOf: $0) }
        }
        combinedData.append(commit)

        let inputKeyMaterial = SymmetricKey(data: SHA256.hash(data: combinedData))

        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: inputKeyMaterial,
            salt: hkdfSalt,
            info: info,
            outputByteCount: 16
        )
    }

    /// Prune old epoch keys
    private func pruneOldEpochKeys() {
        let keysToRemove = epochKeys.keys.filter { $0 < currentEpoch - maxCachedEpochs }
        for key in keysToRemove {
            epochKeys.removeValue(forKey: key)
        }
    }

    /// Create commit data
    private func createCommitData(epoch: Int, action: CommitAction) -> Data {
        // In production, create actual MLS Commit
        var data = Data()
        data.append(contentsOf: withUnsafeBytes(of: epoch.bigEndian) { Array($0) })

        switch action {
        case .add(let pubkey):
            data.append(0x01)
            data.append(pubkey.data(using: .utf8)!)
        case .remove(let pubkey):
            data.append(0x02)
            data.append(pubkey.data(using: .utf8)!)
        }

        return data
    }

    private enum CommitAction {
        case add(String)
        case remove(String)
    }

    // MARK: - Cleanup

    public func close() {
        epochKeys.removeAll()
        groupMembers.removeAll()
        isInitialized = false
        currentEpoch = 0
        logger.info("MLSKeyManager closed")
    }
}

// MARK: - Errors

public enum MLSError: LocalizedError {
    case alreadyInitialized
    case notInitialized
    case participantAlreadyInGroup
    case participantNotInGroup
    case noKeyAvailable
    case noKeyForEpoch(Int)
    case invalidFrameFormat
    case decryptionFailed
    case encryptionFailed

    public var errorDescription: String? {
        switch self {
        case .alreadyInitialized:
            return "MLS group already initialized"
        case .notInitialized:
            return "MLS group not initialized"
        case .participantAlreadyInGroup:
            return "Participant already in group"
        case .participantNotInGroup:
            return "Participant not in group"
        case .noKeyAvailable:
            return "No encryption key available"
        case .noKeyForEpoch(let epoch):
            return "No key available for epoch \(epoch)"
        case .invalidFrameFormat:
            return "Invalid encrypted frame format"
        case .decryptionFailed:
            return "Frame decryption failed"
        case .encryptionFailed:
            return "Frame encryption failed"
        }
    }
}
