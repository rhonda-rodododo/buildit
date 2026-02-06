// BLEAuthenticator.swift
// BuildIt - Decentralized Mesh Communication
//
// Mutual authentication for BLE peer connections using Schnorr/BIP-340
// compatible challenge-response handshake.
//
// SECURITY: Prevents unauthenticated devices from joining the mesh.
// Each device proves possession of its Nostr private key by signing
// a challenge containing a fresh nonce and timestamp.
//
// Protocol (2-step handshake):
//   Step 1 (initiator -> responder): { pubkey, nonce_i, timestamp, signature }
//   Step 2 (responder -> initiator): { pubkey, nonce_r, nonce_i, timestamp, signature }
//
// The responder includes nonce_i in their signed payload to bind the
// two handshake steps together, preventing replay of step-2 messages.

import Foundation
import CryptoKit
import os.log

/// Timeout for handshake completion (seconds)
private let handshakeTimeoutSeconds: TimeInterval = 15.0

/// Maximum allowed clock skew between peers (seconds)
private let maxTimestampSkewSeconds: Int64 = 120

/// Handshake challenge sent between peers
struct BLEHandshakeChallenge: Codable {
    /// Sender's Nostr public key (hex)
    let pubkey: String
    /// Fresh random nonce (hex, 32 bytes)
    let nonce: String
    /// Unix timestamp (seconds)
    let timestamp: Int64
    /// Signature over (pubkey || nonce || peerNonce || timestamp) using sender's private key
    let signature: String
    /// Peer's nonce from step 1 (only present in step 2 response)
    let peerNonce: String?

    /// Serialize to Data for BLE transfer
    func encode() throws -> Data {
        try JSONEncoder().encode(self)
    }

    /// Deserialize from BLE transfer data
    static func decode(from data: Data) throws -> BLEHandshakeChallenge {
        try JSONDecoder().decode(BLEHandshakeChallenge.self, from: data)
    }
}

/// Result of a successful authentication
struct BLEAuthResult {
    /// The verified Nostr public key of the peer
    let verifiedPubkey: String
    /// The peer identifier (CBPeripheral UUID or CBCentral UUID)
    let peerID: UUID
    /// Timestamp of verification
    let verifiedAt: Date
}

/// Authentication state for a pending handshake
enum BLEAuthState {
    case idle
    case awaitingResponse(nonce: String, startedAt: Date)
    case verified(pubkey: String)
    case failed(reason: String)
}

/// BLEAuthenticator handles mutual authentication of BLE peers.
///
/// SECURITY PROPERTIES:
/// - Freshness: Random nonce + timestamp prevent replay attacks
/// - Mutual authentication: Both peers prove key ownership
/// - Binding: Step-2 includes step-1 nonce to prevent mix-and-match
/// - Timeout: Handshakes that take too long are rejected
/// - Clock skew tolerance: Timestamps within 2 minutes are accepted
class BLEAuthenticator {
    // MARK: - Singleton

    static let shared = BLEAuthenticator()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "BLEAuth")

    /// Active handshake states keyed by peer ID
    private var handshakeStates: [UUID: BLEAuthState] = [:]

    /// Successfully authenticated peers
    private var authenticatedPeers: [UUID: BLEAuthResult] = [:]

    /// Lock for thread-safe state access
    private let stateLock = NSLock()

    // MARK: - Initialization

    private init() {}

    // MARK: - Step 1: Create Initial Challenge (Initiator)

    /// Create a handshake challenge to send to a peer (step 1).
    /// The initiator generates a nonce and signs it along with their pubkey.
    ///
    /// - Parameter peerID: The BLE peripheral/central identifier
    /// - Returns: The serialized challenge data to send over BLE
    /// - Throws: CryptoError if signing fails
    func createChallenge(for peerID: UUID) async throws -> Data {
        guard let pubkey = await CryptoManager.shared.getPublicKeyHex() else {
            throw BLEAuthError.noIdentity
        }

        // Generate fresh nonce (32 random bytes)
        let nonce = generateNonce()
        let timestamp = Int64(Date().timeIntervalSince1970)

        // Sign: pubkey || nonce || timestamp
        let signaturePayload = buildSignaturePayload(
            pubkey: pubkey,
            nonce: nonce,
            peerNonce: nil,
            timestamp: timestamp
        )
        let signature = try await CryptoManager.shared.sign(signaturePayload)

        let challenge = BLEHandshakeChallenge(
            pubkey: pubkey,
            nonce: nonce,
            timestamp: timestamp,
            signature: signature,
            peerNonce: nil
        )

        // Record state
        stateLock.lock()
        handshakeStates[peerID] = .awaitingResponse(nonce: nonce, startedAt: Date())
        stateLock.unlock()

        logger.info("[AUTH] Created challenge for peer \(peerID) with nonce \(nonce.prefix(16))...")

        return try challenge.encode()
    }

    // MARK: - Step 2: Verify Challenge & Create Response (Responder)

    /// Verify an incoming challenge (step 1) from a peer and create a signed
    /// response (step 2).
    ///
    /// - Parameters:
    ///   - challengeData: The raw challenge data received over BLE
    ///   - peerID: The BLE peripheral/central identifier
    /// - Returns: Tuple of (response data to send, verified peer pubkey)
    /// - Throws: BLEAuthError if verification fails
    func verifyAndRespond(to challengeData: Data, from peerID: UUID) async throws -> (responseData: Data, peerPubkey: String) {
        // Decode the incoming challenge
        let challenge: BLEHandshakeChallenge
        do {
            challenge = try BLEHandshakeChallenge.decode(from: challengeData)
        } catch {
            logger.error("[AUTH] SECURITY: Failed to decode challenge from peer \(peerID): \(error.localizedDescription)")
            recordFailure(peerID: peerID, reason: "Invalid challenge format")
            throw BLEAuthError.invalidChallenge
        }

        // Validate timestamp is within acceptable skew
        let now = Int64(Date().timeIntervalSince1970)
        guard abs(now - challenge.timestamp) <= maxTimestampSkewSeconds else {
            logger.error("[AUTH] SECURITY: Timestamp skew too large from peer \(peerID). Theirs: \(challenge.timestamp), ours: \(now)")
            recordFailure(peerID: peerID, reason: "Timestamp skew exceeded")
            throw BLEAuthError.timestampSkewExceeded
        }

        // Validate public key format (64 hex chars = 32 bytes)
        guard challenge.pubkey.count == 64,
              challenge.pubkey.allSatisfy({ $0.isHexDigit }) else {
            logger.error("[AUTH] SECURITY: Invalid public key format from peer \(peerID)")
            recordFailure(peerID: peerID, reason: "Invalid public key format")
            throw BLEAuthError.invalidPublicKey
        }

        // Verify signature: pubkey || nonce || timestamp
        let signaturePayload = buildSignaturePayload(
            pubkey: challenge.pubkey,
            nonce: challenge.nonce,
            peerNonce: nil,
            timestamp: challenge.timestamp
        )

        let isValid = await CryptoManager.shared.verifySignature(
            challenge.signature,
            for: signaturePayload,
            publicKey: challenge.pubkey
        )

        guard isValid else {
            logger.error("[AUTH] SECURITY: Signature verification FAILED for peer \(peerID) claiming pubkey \(challenge.pubkey.prefix(16))...")
            recordFailure(peerID: peerID, reason: "Signature verification failed")
            throw BLEAuthError.signatureVerificationFailed
        }

        logger.info("[AUTH] Verified step-1 challenge from peer \(peerID) with pubkey \(challenge.pubkey.prefix(16))...")

        // Create our response (step 2)
        guard let ourPubkey = await CryptoManager.shared.getPublicKeyHex() else {
            throw BLEAuthError.noIdentity
        }

        let ourNonce = generateNonce()
        let responseTimestamp = Int64(Date().timeIntervalSince1970)

        // Sign: ourPubkey || ourNonce || theirNonce || timestamp
        // Including their nonce binds our response to their specific challenge
        let responseSignaturePayload = buildSignaturePayload(
            pubkey: ourPubkey,
            nonce: ourNonce,
            peerNonce: challenge.nonce,
            timestamp: responseTimestamp
        )
        let responseSignature = try await CryptoManager.shared.sign(responseSignaturePayload)

        let response = BLEHandshakeChallenge(
            pubkey: ourPubkey,
            nonce: ourNonce,
            timestamp: responseTimestamp,
            signature: responseSignature,
            peerNonce: challenge.nonce
        )

        // Record the peer as authenticated on our side
        recordSuccess(peerID: peerID, pubkey: challenge.pubkey)

        return (try response.encode(), challenge.pubkey)
    }

    // MARK: - Step 2 Verification (Initiator verifies response)

    /// Verify the response (step 2) from a peer that we challenged in step 1.
    ///
    /// - Parameters:
    ///   - responseData: The raw response data received over BLE
    ///   - peerID: The BLE peripheral/central identifier
    /// - Returns: The verified peer public key
    /// - Throws: BLEAuthError if verification fails
    func verifyResponse(_ responseData: Data, from peerID: UUID) async throws -> String {
        // Check we have a pending handshake with this peer
        stateLock.lock()
        guard case .awaitingResponse(let ourNonce, let startedAt) = handshakeStates[peerID] else {
            stateLock.unlock()
            logger.error("[AUTH] SECURITY: Received unexpected response from peer \(peerID) - no pending handshake")
            throw BLEAuthError.unexpectedResponse
        }
        stateLock.unlock()

        // Check for timeout
        guard Date().timeIntervalSince(startedAt) < handshakeTimeoutSeconds else {
            logger.error("[AUTH] SECURITY: Handshake timed out for peer \(peerID)")
            recordFailure(peerID: peerID, reason: "Handshake timed out")
            throw BLEAuthError.handshakeTimeout
        }

        // Decode the response
        let response: BLEHandshakeChallenge
        do {
            response = try BLEHandshakeChallenge.decode(from: responseData)
        } catch {
            logger.error("[AUTH] SECURITY: Failed to decode response from peer \(peerID): \(error.localizedDescription)")
            recordFailure(peerID: peerID, reason: "Invalid response format")
            throw BLEAuthError.invalidChallenge
        }

        // Verify they included our nonce (binding check)
        guard response.peerNonce == ourNonce else {
            logger.error("[AUTH] SECURITY: Nonce binding mismatch from peer \(peerID). Expected our nonce, got \(response.peerNonce ?? "nil")")
            recordFailure(peerID: peerID, reason: "Nonce binding mismatch")
            throw BLEAuthError.nonceMismatch
        }

        // Validate timestamp
        let now = Int64(Date().timeIntervalSince1970)
        guard abs(now - response.timestamp) <= maxTimestampSkewSeconds else {
            logger.error("[AUTH] SECURITY: Response timestamp skew too large from peer \(peerID)")
            recordFailure(peerID: peerID, reason: "Response timestamp skew exceeded")
            throw BLEAuthError.timestampSkewExceeded
        }

        // Validate public key format
        guard response.pubkey.count == 64,
              response.pubkey.allSatisfy({ $0.isHexDigit }) else {
            logger.error("[AUTH] SECURITY: Invalid public key format in response from peer \(peerID)")
            recordFailure(peerID: peerID, reason: "Invalid public key format in response")
            throw BLEAuthError.invalidPublicKey
        }

        // Verify signature: theirPubkey || theirNonce || ourNonce || timestamp
        let signaturePayload = buildSignaturePayload(
            pubkey: response.pubkey,
            nonce: response.nonce,
            peerNonce: ourNonce,
            timestamp: response.timestamp
        )

        let isValid = await CryptoManager.shared.verifySignature(
            response.signature,
            for: signaturePayload,
            publicKey: response.pubkey
        )

        guard isValid else {
            logger.error("[AUTH] SECURITY: Response signature verification FAILED for peer \(peerID) claiming pubkey \(response.pubkey.prefix(16))...")
            recordFailure(peerID: peerID, reason: "Response signature verification failed")
            throw BLEAuthError.signatureVerificationFailed
        }

        // Authenticated
        recordSuccess(peerID: peerID, pubkey: response.pubkey)
        logger.info("[AUTH] Mutual authentication COMPLETE with peer \(peerID), pubkey \(response.pubkey.prefix(16))...")

        return response.pubkey
    }

    // MARK: - State Management

    /// Check whether a peer has been authenticated
    func isAuthenticated(_ peerID: UUID) -> Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return authenticatedPeers[peerID] != nil
    }

    /// Get the verified public key for an authenticated peer
    func getVerifiedPubkey(for peerID: UUID) -> String? {
        stateLock.lock()
        defer { stateLock.unlock() }
        return authenticatedPeers[peerID]?.verifiedPubkey
    }

    /// Get the authentication result for a peer
    func getAuthResult(for peerID: UUID) -> BLEAuthResult? {
        stateLock.lock()
        defer { stateLock.unlock() }
        return authenticatedPeers[peerID]
    }

    /// Remove authentication state when a peer disconnects
    func peerDisconnected(_ peerID: UUID) {
        stateLock.lock()
        handshakeStates.removeValue(forKey: peerID)
        authenticatedPeers.removeValue(forKey: peerID)
        stateLock.unlock()
        logger.info("[AUTH] Cleared auth state for disconnected peer \(peerID)")
    }

    /// Clear all authentication state (e.g., on Bluetooth reset)
    func reset() {
        stateLock.lock()
        handshakeStates.removeAll()
        authenticatedPeers.removeAll()
        stateLock.unlock()
        logger.info("[AUTH] Reset all authentication state")
    }

    // MARK: - Private Methods

    /// Generate a cryptographically secure random nonce (32 bytes, hex-encoded)
    private func generateNonce() -> String {
        var nonceBytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, 32, &nonceBytes)
        return nonceBytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Build the payload to be signed.
    /// Format: SHA256(pubkey || nonce || peerNonce || timestamp)
    ///
    /// Using SHA256 hash of the concatenation ensures a fixed-size input
    /// to the signing function regardless of component sizes.
    private func buildSignaturePayload(
        pubkey: String,
        nonce: String,
        peerNonce: String?,
        timestamp: Int64
    ) -> Data {
        var hasher = SHA256()
        hasher.update(data: Data(pubkey.utf8))
        hasher.update(data: Data(nonce.utf8))
        if let peerNonce = peerNonce {
            hasher.update(data: Data(peerNonce.utf8))
        }
        withUnsafeBytes(of: timestamp.littleEndian) { hasher.update(bufferPointer: $0) }
        return Data(hasher.finalize())
    }

    /// Record a successful authentication
    private func recordSuccess(peerID: UUID, pubkey: String) {
        let result = BLEAuthResult(
            verifiedPubkey: pubkey,
            peerID: peerID,
            verifiedAt: Date()
        )
        stateLock.lock()
        authenticatedPeers[peerID] = result
        handshakeStates[peerID] = .verified(pubkey: pubkey)
        stateLock.unlock()
    }

    /// Record a failed authentication attempt
    private func recordFailure(peerID: UUID, reason: String) {
        stateLock.lock()
        handshakeStates[peerID] = .failed(reason: reason)
        authenticatedPeers.removeValue(forKey: peerID)
        stateLock.unlock()
    }
}

// MARK: - Authentication Errors

enum BLEAuthError: LocalizedError {
    case noIdentity
    case invalidChallenge
    case invalidPublicKey
    case signatureVerificationFailed
    case timestampSkewExceeded
    case nonceMismatch
    case handshakeTimeout
    case unexpectedResponse
    case peerNotAuthenticated

    var errorDescription: String? {
        switch self {
        case .noIdentity:
            return "No Nostr identity available for authentication"
        case .invalidChallenge:
            return "Invalid handshake challenge format"
        case .invalidPublicKey:
            return "Invalid public key format in handshake"
        case .signatureVerificationFailed:
            return "Peer's signature verification failed - identity not proven"
        case .timestampSkewExceeded:
            return "Handshake timestamp skew too large"
        case .nonceMismatch:
            return "Handshake nonce binding mismatch - possible replay attack"
        case .handshakeTimeout:
            return "Handshake timed out - peer did not respond in time"
        case .unexpectedResponse:
            return "Received handshake response without a pending challenge"
        case .peerNotAuthenticated:
            return "Peer has not completed authentication"
        }
    }
}
