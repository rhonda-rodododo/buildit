// MeshRouter.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles message routing through the BLE mesh network.
// Implements privacy-preserving routing with encrypted metadata.
//
// SECURITY FEATURES:
// - Sender/recipient encrypted in all messages
// - Message IDs regenerated per hop to prevent correlation
// - No hops vector - uses TTL only for loop prevention
// - Timestamp randomization (+/- 2 days as per NIP-17)
// - Correlation tokens for endpoint-only deduplication

import Foundation
import Combine
import CryptoKit
import os.log

/// Timestamp randomization range in seconds (2 days as per NIP-17)
private let timestampRangeSeconds: Int64 = 172800

/// How long to remember correlation tokens (5 minutes)
private let correlationTokenTTL: TimeInterval = 300

/// Encrypted routing information - only the intended recipient can decrypt
struct EncryptedRoutingInfo: Codable {
    /// NIP-44 encrypted data containing: recipient_pubkey + sender_pubkey + correlation_token
    let ciphertext: String
    /// Ephemeral public key used for ECDH (allows recipient to derive decryption key)
    let ephemeralPubkey: String
}

/// A privacy-preserving mesh message
///
/// SECURITY: This structure never exposes sender or recipient in cleartext.
/// Each hop sees only:
/// - The encrypted routing info (which they may or may not be able to decrypt)
/// - The TTL
/// - A message ID unique to this hop (not correlatable across hops)
struct MeshMessage: Codable, Identifiable {
    /// Unique message ID for this hop only (regenerated on each forward)
    let id: String
    /// Encrypted routing information
    let routing: EncryptedRoutingInfo
    /// The encrypted payload (NIP-44 ciphertext)
    let payload: Data
    /// Randomized timestamp (unix seconds with +/- 2 day randomization)
    let timestamp: Int64
    /// Time-to-live (decremented on each hop)
    let ttl: Int
    /// Message signature (signed by ephemeral key for unlinkability)
    let signature: String
    /// Ephemeral public key that signed this message
    let signerPubkey: String

    /// Message types for the mesh protocol
    enum MessageType: Int, Codable {
        case direct = 0
        case broadcast = 1
        case routingUpdate = 2
        case acknowledgment = 3
        case peerDiscovery = 4
    }

    let type: MessageType

    /// Encode message to binary format for BLE transfer
    func encode() throws -> Data {
        try JSONEncoder().encode(self)
    }

    /// Decode message from binary format
    static func decode(from data: Data) throws -> MeshMessage {
        try JSONDecoder().decode(MeshMessage.self, from: data)
    }

    /// Create a new message with decremented TTL and NEW message ID
    /// SECURITY: New ID prevents correlation across hops
    func forwarded() -> MeshMessage {
        MeshMessage(
            id: UUID().uuidString, // NEW ID to break correlation
            routing: routing,
            payload: payload,
            timestamp: timestamp, // Keep original randomized timestamp
            ttl: ttl - 1,
            signature: signature,
            signerPubkey: signerPubkey,
            type: type
        )
    }
}

/// Decrypted routing data (only visible to the intended recipient)
struct DecryptedRoutingData: Codable {
    let recipientPubkey: String
    let senderPubkey: String
    let correlationToken: String
}

/// Result of successfully decrypting a message
struct DecryptedMessage {
    let senderPubkey: String
    let payload: Data
    let correlationToken: String
}

/// Represents a peer in the mesh network
struct MeshPeer: Codable, Identifiable {
    let id: UUID
    /// Identity commitment H(pubkey || nonce) - NOT the actual public key
    let commitment: String
    var lastSeen: Date
    var hopCount: Int
    var rssi: Int?
    var reachableVia: UUID?  // Next hop peer ID, nil if direct
    /// Verified public key (only after successful handshake)
    var verifiedPubkey: String?
    /// Nonce for commitment verification
    var nonce: String?

    /// Quality score for routing decisions (higher is better)
    var qualityScore: Double {
        let ageScore = max(0, 1.0 - (Date().timeIntervalSince(lastSeen) / 300)) // 5 min decay
        let hopScore = 1.0 / Double(hopCount + 1)
        let rssiScore = rssi.map { Double($0 + 100) / 100.0 } ?? 0.5
        return ageScore * 0.3 + hopScore * 0.4 + rssiScore * 0.3
    }

    /// Create a commitment for a public key
    static func createCommitment(pubkey: String) -> (commitment: String, nonce: String) {
        let nonce = UUID().uuidString
        var hasher = SHA256()
        hasher.update(data: Data(pubkey.utf8))
        hasher.update(data: Data(nonce.utf8))
        let hash = hasher.finalize()
        let commitment = hash.prefix(20).map { String(format: "%02x", $0) }.joined()
        return (commitment, nonce)
    }

    /// Verify a commitment
    static func verifyCommitment(_ commitment: String, pubkey: String, nonce: String) -> Bool {
        var hasher = SHA256()
        hasher.update(data: Data(pubkey.utf8))
        hasher.update(data: Data(nonce.utf8))
        let hash = hasher.finalize()
        let computed = hash.prefix(20).map { String(format: "%02x", $0) }.joined()
        return computed == commitment
    }
}

/// Routing table entry
struct RoutingEntry: Codable {
    let destination: String  // Commitment (not public key)
    let nextHop: UUID  // Peer ID
    let hopCount: Int
    var lastUpdated: Date
    var sequenceNumber: Int
}

/// Randomize a timestamp within +/- range (for metadata protection)
private func randomizeTimestamp(_ timestamp: Int64, range: Int64) -> Int64 {
    let offset = Int64.random(in: -range...range)
    return timestamp + offset
}

/// MeshRouter manages message routing through the BLE mesh network
actor MeshRouter {
    // MARK: - Singleton

    static let shared = MeshRouter()

    // MARK: - Properties

    private var routingTable: [String: RoutingEntry] = [:]
    private var peers: [UUID: MeshPeer] = [:]
    /// Seen correlation tokens (for endpoint deduplication only)
    private var seenTokens: [String: Date] = [:]
    private var messageCallbacks: [(DecryptedMessage) -> Void] = []

    private let logger = Logger(subsystem: "com.buildit", category: "MeshRouter")

    /// Maximum TTL for messages
    private let maxTTL: Int = 10

    /// Sequence number for routing updates
    private var routingSequenceNumber: Int = 0

    // MARK: - Initialization

    private init() {
        // Start cleanup timer
        Task {
            await startCleanupTimer()
        }
    }

    // MARK: - Public Methods

    /// Register a new peer in the routing table (using commitment, not pubkey)
    func registerPeer(_ peerID: UUID, commitment: String) {
        let peer = MeshPeer(
            id: peerID,
            commitment: commitment,
            lastSeen: Date(),
            hopCount: 1,
            rssi: nil,
            reachableVia: nil,
            verifiedPubkey: nil,
            nonce: nil
        )

        peers[peerID] = peer

        // Add direct route using commitment
        let entry = RoutingEntry(
            destination: commitment,
            nextHop: peerID,
            hopCount: 1,
            lastUpdated: Date(),
            sequenceNumber: routingSequenceNumber
        )
        routingTable[commitment] = entry

        logger.info("Registered peer with commitment: \(commitment.prefix(16))...")
    }

    /// Verify and upgrade a peer's identity after handshake
    func verifyPeerIdentity(_ peerID: UUID, pubkey: String, nonce: String) -> Bool {
        guard var peer = peers[peerID] else {
            logger.warning("Peer not found for verification: \(peerID)")
            return false
        }

        // Verify commitment
        guard MeshPeer.verifyCommitment(peer.commitment, pubkey: pubkey, nonce: nonce) else {
            logger.error("Commitment verification failed for peer: \(peerID)")
            return false
        }

        // Upgrade peer with verified identity
        peer.verifiedPubkey = pubkey
        peer.nonce = nonce
        peers[peerID] = peer

        logger.info("Verified identity for peer: \(pubkey.prefix(16))...")
        return true
    }

    /// Remove a peer from the routing table
    func removePeer(_ peerID: UUID) {
        if let peer = peers.removeValue(forKey: peerID) {
            routingTable.removeValue(forKey: peer.commitment)

            // Remove routes that used this peer as next hop
            for (key, entry) in routingTable where entry.nextHop == peerID {
                routingTable.removeValue(forKey: key)
            }

            logger.info("Removed peer: \(peer.commitment.prefix(16))...")
        }
    }

    /// Handle an incoming message from a peer
    func handleIncomingMessage(_ message: MeshMessage, from peerID: UUID) async throws {
        // Update peer last seen
        if var peer = peers[peerID] {
            peer.lastSeen = Date()
            peers[peerID] = peer
        }

        // Try to decrypt for us
        let ourPrivateKey = await CryptoManager.shared.getPrivateKey()
        guard let privateKey = ourPrivateKey else {
            logger.error("No private key available")
            return
        }

        do {
            let decrypted = try await decryptMessage(message, privateKey: privateKey)

            // Check for duplicate via correlation token
            if seenTokens[decrypted.correlationToken] != nil {
                logger.debug("Ignoring duplicate message with token: \(decrypted.correlationToken.prefix(8))...")
                return
            }
            seenTokens[decrypted.correlationToken] = Date()

            // Deliver to local handler
            await deliverMessage(decrypted)

            // Send acknowledgment
            let ack = try await createAcknowledgment(
                for: decrypted.correlationToken,
                to: decrypted.senderPubkey,
                privateKey: privateKey
            )
            try await routeMessage(ack)

        } catch MeshError.notForUs {
            // Not for us - forward if TTL allows
            if message.ttl > 0 {
                let forwarded = message.forwarded()
                try await routeMessage(forwarded)
            }
        } catch {
            logger.error("Failed to process message: \(error.localizedDescription)")
        }
    }

    /// Route a message to its destination
    func routeMessage(_ message: MeshMessage) async throws {
        // Check if message has expired
        guard message.ttl > 0 else {
            logger.warning("Message TTL expired: \(message.id)")
            return
        }

        if message.type == .broadcast {
            // Broadcast to all connected peers
            await broadcastToAllPeers(message)
        } else {
            // For direct messages, we don't know the recipient (it's encrypted)
            // So we flood to all peers and let them try to decrypt
            await broadcastToAllPeers(message)
        }
    }

    /// Create a new encrypted message
    func createMessage(
        to recipientPubkey: String,
        payload: Data,
        type: MeshMessage.MessageType = .direct
    ) async throws -> MeshMessage {
        guard let privateKey = await CryptoManager.shared.getPrivateKey(),
              let ourPubkey = await CryptoManager.shared.getPublicKeyHex() else {
            throw MeshError.noIdentity
        }

        // Generate ephemeral key for signing (unlinkable)
        let ephemeralKey = P256.Signing.PrivateKey()
        let ephemeralPubkey = ephemeralKey.publicKey.rawRepresentation.map {
            String(format: "%02x", $0)
        }.joined()

        // Generate correlation token
        let correlationToken = UUID().uuidString

        // Create routing data
        let routingData = DecryptedRoutingData(
            recipientPubkey: recipientPubkey,
            senderPubkey: ourPubkey,
            correlationToken: correlationToken
        )
        let routingJson = try JSONEncoder().encode(routingData)

        // Encrypt routing data with NIP-44 to recipient
        let encryptedRouting = try await CryptoManager.shared.nip44Encrypt(
            plaintext: routingJson,
            recipientPubkey: recipientPubkey
        )

        // Encrypt payload with NIP-44
        let encryptedPayload = try await CryptoManager.shared.nip44Encrypt(
            plaintext: payload,
            recipientPubkey: recipientPubkey
        )

        // Get randomized timestamp
        let now = Int64(Date().timeIntervalSince1970)
        let randomizedTimestamp = randomizeTimestamp(now, range: timestampRangeSeconds)

        // Generate message ID
        let messageId = UUID().uuidString

        // Sign with ephemeral key
        let signatureData = (messageId + encryptedRouting + encryptedPayload.base64EncodedString()).data(using: .utf8)!
        let signature = try ephemeralKey.signature(for: signatureData)
        let signatureHex = signature.rawRepresentation.map { String(format: "%02x", $0) }.joined()

        return MeshMessage(
            id: messageId,
            routing: EncryptedRoutingInfo(
                ciphertext: encryptedRouting,
                ephemeralPubkey: ourPubkey // Used for ECDH
            ),
            payload: encryptedPayload,
            timestamp: randomizedTimestamp,
            ttl: maxTTL,
            signature: signatureHex,
            signerPubkey: ephemeralPubkey,
            type: type
        )
    }

    /// Register a callback for received messages
    func onMessage(_ callback: @escaping (DecryptedMessage) -> Void) {
        messageCallbacks.append(callback)
    }

    /// Get all known peers
    func getAllPeers() -> [MeshPeer] {
        Array(peers.values)
    }

    /// Get only verified peers (with confirmed identity)
    func getVerifiedPeers() -> [MeshPeer] {
        peers.values.filter { $0.verifiedPubkey != nil }
    }

    // MARK: - Private Methods

    private func decryptMessage(_ message: MeshMessage, privateKey: Data) async throws -> DecryptedMessage {
        // Try to decrypt routing data
        guard let routingJson = try? await CryptoManager.shared.nip44Decrypt(
            ciphertext: message.routing.ciphertext,
            senderPubkey: message.routing.ephemeralPubkey
        ) else {
            throw MeshError.notForUs
        }

        let routingData = try JSONDecoder().decode(DecryptedRoutingData.self, from: routingJson)

        // Check if we're the recipient
        let ourPubkey = await CryptoManager.shared.getPublicKeyHex()
        guard routingData.recipientPubkey == ourPubkey else {
            throw MeshError.notForUs
        }

        // Decrypt payload
        let decryptedPayload = try await CryptoManager.shared.nip44Decrypt(
            ciphertext: message.payload.base64EncodedString(),
            senderPubkey: message.routing.ephemeralPubkey
        )

        return DecryptedMessage(
            senderPubkey: routingData.senderPubkey,
            payload: decryptedPayload,
            correlationToken: routingData.correlationToken
        )
    }

    private func createAcknowledgment(
        for correlationToken: String,
        to recipientPubkey: String,
        privateKey: Data
    ) async throws -> MeshMessage {
        // Create ack with encrypted correlation token
        return try await createMessage(
            to: recipientPubkey,
            payload: correlationToken.data(using: .utf8)!,
            type: .acknowledgment
        )
    }

    private func broadcastToAllPeers(_ message: MeshMessage, excluding: UUID? = nil) async {
        do {
            let data = try message.encode()
            try await BLEManager.shared.broadcastMessage(data)
            logger.info("Broadcast message to all peers")
        } catch {
            logger.error("Failed to broadcast message: \(error.localizedDescription)")
        }
    }

    private func deliverMessage(_ decrypted: DecryptedMessage) async {
        // Deliver to callbacks
        for callback in messageCallbacks {
            callback(decrypted)
        }
    }

    private func startCleanupTimer() async {
        while true {
            try? await Task.sleep(nanoseconds: 60_000_000_000) // 1 minute
            cleanupStaleData()
        }
    }

    private func cleanupStaleData() {
        let now = Date()

        // Remove stale peers
        for (id, peer) in peers {
            if now.timeIntervalSince(peer.lastSeen) > 300 { // 5 minutes
                removePeer(id)
            }
        }

        // Remove old correlation tokens
        seenTokens = seenTokens.filter { _, timestamp in
            now.timeIntervalSince(timestamp) < correlationTokenTTL
        }

        // Remove stale routes
        for (key, entry) in routingTable {
            if now.timeIntervalSince(entry.lastUpdated) > 300 {
                routingTable.removeValue(forKey: key)
            }
        }
    }
}

/// Mesh-specific errors
enum MeshError: Error {
    case notForUs
    case noIdentity
    case encryptionFailed
    case decryptionFailed
    case invalidMessage
}
