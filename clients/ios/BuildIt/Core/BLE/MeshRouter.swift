// MeshRouter.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles message routing through the BLE mesh network.
// Implements routing table management and message forwarding.

import Foundation
import Combine
import os.log

/// Represents a message in the mesh network
struct MeshMessage: Codable, Identifiable {
    let id: String
    let sourcePublicKey: String
    let destinationPublicKey: String?  // nil for broadcast
    let payload: Data
    let timestamp: Date
    let ttl: Int
    let hopCount: Int
    let signature: String

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

    /// Create a new message with decremented TTL and incremented hop count
    func forwarded() -> MeshMessage {
        MeshMessage(
            id: id,
            sourcePublicKey: sourcePublicKey,
            destinationPublicKey: destinationPublicKey,
            payload: payload,
            timestamp: timestamp,
            ttl: ttl - 1,
            hopCount: hopCount + 1,
            signature: signature,
            type: type
        )
    }
}

/// Represents a peer in the mesh network
struct MeshPeer: Codable, Identifiable {
    let id: UUID
    let publicKey: String
    var lastSeen: Date
    var hopCount: Int
    var rssi: Int?
    var reachableVia: UUID?  // Next hop peer ID, nil if direct

    /// Quality score for routing decisions (higher is better)
    var qualityScore: Double {
        let ageScore = max(0, 1.0 - (Date().timeIntervalSince(lastSeen) / 300)) // 5 min decay
        let hopScore = 1.0 / Double(hopCount + 1)
        let rssiScore = rssi.map { Double($0 + 100) / 100.0 } ?? 0.5
        return ageScore * 0.3 + hopScore * 0.4 + rssiScore * 0.3
    }
}

/// Routing table entry
struct RoutingEntry: Codable {
    let destination: String  // Public key
    let nextHop: UUID  // Peer ID
    let hopCount: Int
    var lastUpdated: Date
    var sequenceNumber: Int
}

/// MeshRouter manages message routing through the BLE mesh network
actor MeshRouter {
    // MARK: - Singleton

    static let shared = MeshRouter()

    // MARK: - Properties

    private var routingTable: [String: RoutingEntry] = [:]
    private var peers: [UUID: MeshPeer] = [:]
    private var seenMessages: Set<String> = []
    private var messageCallbacks: [(MeshMessage) -> Void] = []

    private let logger = Logger(subsystem: "com.buildit", category: "MeshRouter")

    /// Maximum TTL for messages
    private let maxTTL: Int = 10

    /// Maximum age for seen messages cache (to detect duplicates)
    private let seenMessageMaxAge: TimeInterval = 300  // 5 minutes

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

    /// Register a new peer in the routing table
    func registerPeer(_ peerID: UUID, publicKey: String) {
        let peer = MeshPeer(
            id: peerID,
            publicKey: publicKey,
            lastSeen: Date(),
            hopCount: 1,
            rssi: nil,
            reachableVia: nil
        )

        peers[peerID] = peer

        // Add direct route
        let entry = RoutingEntry(
            destination: publicKey,
            nextHop: peerID,
            hopCount: 1,
            lastUpdated: Date(),
            sequenceNumber: routingSequenceNumber
        )
        routingTable[publicKey] = entry

        logger.info("Registered peer: \(publicKey.prefix(16))...")
    }

    /// Remove a peer from the routing table
    func removePeer(_ peerID: UUID) {
        if let peer = peers.removeValue(forKey: peerID) {
            routingTable.removeValue(forKey: peer.publicKey)

            // Remove routes that used this peer as next hop
            for (key, entry) in routingTable where entry.nextHop == peerID {
                routingTable.removeValue(forKey: key)
            }

            logger.info("Removed peer: \(peer.publicKey.prefix(16))...")
        }
    }

    /// Handle an incoming message from a peer
    func handleIncomingMessage(_ message: MeshMessage, from peerID: UUID) throws {
        // Check for duplicate
        guard !seenMessages.contains(message.id) else {
            logger.debug("Ignoring duplicate message: \(message.id)")
            return
        }
        seenMessages.insert(message.id)

        // Update peer last seen
        if var peer = peers[peerID] {
            peer.lastSeen = Date()
            peers[peerID] = peer
        }

        // Process based on message type
        switch message.type {
        case .direct:
            try handleDirectMessage(message, from: peerID)
        case .broadcast:
            try handleBroadcastMessage(message, from: peerID)
        case .routingUpdate:
            try handleRoutingUpdateMessage(message, from: peerID)
        case .acknowledgment:
            handleAcknowledgment(message, from: peerID)
        case .peerDiscovery:
            handlePeerDiscovery(message, from: peerID)
        }
    }

    /// Route a message to its destination
    func routeMessage(_ message: MeshMessage) async throws {
        // Check if message has expired
        guard message.ttl > 0 else {
            logger.warning("Message TTL expired: \(message.id)")
            return
        }

        // Mark as seen
        seenMessages.insert(message.id)

        if message.type == .broadcast {
            // Broadcast to all connected peers
            await broadcastToAllPeers(message)
        } else if let destination = message.destinationPublicKey {
            // Find route to destination
            if let route = routingTable[destination] {
                await forwardMessage(message, via: route.nextHop)
            } else {
                // No route - broadcast for discovery
                await broadcastToAllPeers(message)
            }
        }
    }

    /// Handle routing update data from a peer
    func handleRoutingUpdate(_ data: Data, from peerID: UUID) {
        do {
            let entries = try JSONDecoder().decode([RoutingEntry].self, from: data)
            processRoutingEntries(entries, from: peerID)
        } catch {
            logger.error("Failed to decode routing update: \(error.localizedDescription)")
        }
    }

    /// Get routing table as binary data for sharing
    func getRoutingTableData() -> Data {
        let entries = Array(routingTable.values)
        return (try? JSONEncoder().encode(entries)) ?? Data()
    }

    /// Register a callback for received messages
    func onMessage(_ callback: @escaping (MeshMessage) -> Void) {
        messageCallbacks.append(callback)
    }

    /// Get all known peers
    func getAllPeers() -> [MeshPeer] {
        Array(peers.values)
    }

    /// Get route to a destination
    func getRoute(to publicKey: String) -> RoutingEntry? {
        routingTable[publicKey]
    }

    // MARK: - Private Methods

    private func handleDirectMessage(_ message: MeshMessage, from peerID: UUID) throws {
        // Check if we are the destination
        Task {
            let ourPublicKey = await CryptoManager.shared.getPublicKeyHex()

            if message.destinationPublicKey == ourPublicKey {
                // Deliver to local handler
                await deliverMessage(message)

                // Send acknowledgment
                let ack = createAcknowledgment(for: message)
                try? await routeMessage(ack)
            } else {
                // Forward to next hop
                let forwarded = message.forwarded()
                try await routeMessage(forwarded)
            }
        }
    }

    private func handleBroadcastMessage(_ message: MeshMessage, from peerID: UUID) throws {
        // Deliver locally
        Task {
            await deliverMessage(message)
        }

        // Forward to other peers
        let forwarded = message.forwarded()
        if forwarded.ttl > 0 {
            Task {
                await broadcastToAllPeers(forwarded, excluding: peerID)
            }
        }
    }

    private func handleRoutingUpdateMessage(_ message: MeshMessage, from peerID: UUID) throws {
        // Process routing table updates
        do {
            let entries = try JSONDecoder().decode([RoutingEntry].self, from: message.payload)
            processRoutingEntries(entries, from: peerID)
        } catch {
            logger.error("Failed to decode routing entries: \(error.localizedDescription)")
        }
    }

    private func handleAcknowledgment(_ message: MeshMessage, from peerID: UUID) {
        // Process message delivery confirmation
        logger.info("Received acknowledgment for: \(message.id)")

        // Notify transport layer
        Task {
            await MessageQueue.shared.confirmDelivery(messageId: message.id)
        }
    }

    private func handlePeerDiscovery(_ message: MeshMessage, from peerID: UUID) {
        // Process peer discovery announcement
        let announcer = message.sourcePublicKey

        // Update routing table with new peer info
        if routingTable[announcer] == nil || routingTable[announcer]!.hopCount > message.hopCount + 1 {
            let entry = RoutingEntry(
                destination: announcer,
                nextHop: peerID,
                hopCount: message.hopCount + 1,
                lastUpdated: Date(),
                sequenceNumber: 0
            )
            routingTable[announcer] = entry
        }
    }

    private func processRoutingEntries(_ entries: [RoutingEntry], from peerID: UUID) {
        for entry in entries {
            // Only update if it's a better route
            if let existing = routingTable[entry.destination] {
                if entry.sequenceNumber > existing.sequenceNumber ||
                   (entry.sequenceNumber == existing.sequenceNumber && entry.hopCount + 1 < existing.hopCount) {
                    updateRoute(entry, via: peerID)
                }
            } else {
                updateRoute(entry, via: peerID)
            }
        }
    }

    private func updateRoute(_ entry: RoutingEntry, via peerID: UUID) {
        let newEntry = RoutingEntry(
            destination: entry.destination,
            nextHop: peerID,
            hopCount: entry.hopCount + 1,
            lastUpdated: Date(),
            sequenceNumber: entry.sequenceNumber
        )
        routingTable[entry.destination] = newEntry
    }

    private func forwardMessage(_ message: MeshMessage, via peerID: UUID) async {
        do {
            let data = try message.encode()
            try await BLEManager.shared.sendMessage(data, to: peerID)
            logger.info("Forwarded message via: \(peerID)")
        } catch {
            logger.error("Failed to forward message: \(error.localizedDescription)")
        }
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

    private func deliverMessage(_ message: MeshMessage) async {
        // Verify signature
        let isValid = await CryptoManager.shared.verifySignature(
            message.signature,
            for: message.payload,
            publicKey: message.sourcePublicKey
        )

        guard isValid else {
            logger.warning("Invalid signature on message: \(message.id)")
            return
        }

        // Deliver to callbacks
        for callback in messageCallbacks {
            callback(message)
        }
    }

    private func createAcknowledgment(for message: MeshMessage) -> MeshMessage {
        MeshMessage(
            id: UUID().uuidString,
            sourcePublicKey: "", // Will be set by sender
            destinationPublicKey: message.sourcePublicKey,
            payload: message.id.data(using: .utf8) ?? Data(),
            timestamp: Date(),
            ttl: maxTTL,
            hopCount: 0,
            signature: "",
            type: .acknowledgment
        )
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

        // Remove old seen messages
        // Note: In production, this would need timestamps stored with message IDs
        if seenMessages.count > 10000 {
            seenMessages.removeAll()
        }

        // Remove stale routes
        for (key, entry) in routingTable {
            if now.timeIntervalSince(entry.lastUpdated) > 300 {
                routingTable.removeValue(forKey: key)
            }
        }
    }
}
