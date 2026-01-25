// TransportRouter.swift
// BuildIt - Decentralized Mesh Communication
//
// Routes messages through optimal transport channels (BLE mesh or Nostr).
// Handles failover between transports and delivery confirmation.

import Foundation
import Combine
import os.log

/// Transport types available for message delivery
enum TransportType: String, CaseIterable {
    case ble = "BLE Mesh"
    case nostr = "Nostr"
    case both = "Both"
}

/// Message priority levels
enum MessagePriority: Int, Comparable {
    case low = 0
    case normal = 1
    case high = 2
    case urgent = 3

    static func < (lhs: MessagePriority, rhs: MessagePriority) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

/// A routable message with metadata
struct RoutableMessage: Identifiable {
    let id: String
    let content: Data
    let recipientPublicKey: String?  // nil for broadcast
    let senderPublicKey: String
    let timestamp: Date
    let priority: MessagePriority
    var preferredTransport: TransportType
    var attempts: Int = 0
    var lastAttempt: Date?
    var delivered: Bool = false
    var deliveredVia: TransportType?
}

/// Delivery status for a message
enum DeliveryStatus {
    case pending
    case sending(transport: TransportType)
    case delivered(transport: TransportType)
    case failed(error: Error)
}

/// TransportRouter manages message delivery across different transports
@MainActor
class TransportRouter: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = TransportRouter()

    // MARK: - Published Properties

    @Published private(set) var preferredTransport: TransportType = .both
    @Published private(set) var bleAvailable: Bool = false
    @Published private(set) var nostrAvailable: Bool = false
    @Published private(set) var pendingMessages: Int = 0
    @Published private(set) var deliveredMessages: Int = 0

    // MARK: - Private Properties

    private var messageCallbacks: [String: (DeliveryStatus) -> Void] = [:]
    private let logger = Logger(subsystem: "com.buildit", category: "TransportRouter")
    private var cancellables = Set<AnyCancellable>()

    private let maxRetryAttempts = 3
    private let retryDelay: TimeInterval = 5.0

    // MARK: - Initialization

    private override init() {
        super.init()
        setupObservers()
    }

    private func setupObservers() {
        // Monitor BLE availability
        BLEManager.shared.$isBluetoothEnabled
            .receive(on: DispatchQueue.main)
            .assign(to: &$bleAvailable)

        // Monitor Nostr availability
        NostrClient.shared.$connectedRelays
            .receive(on: DispatchQueue.main)
            .map { !$0.isEmpty }
            .assign(to: &$nostrAvailable)

        // Update pending count from message queue
        Task {
            let count = await MessageQueue.shared.pendingCount
            pendingMessages = count
        }
    }

    // MARK: - Configuration

    /// Set the preferred transport for message delivery
    func setPreferredTransport(_ transport: TransportType) {
        preferredTransport = transport
        UserDefaults.standard.set(transport.rawValue, forKey: "preferredTransport")
        logger.info("Preferred transport set to: \(transport.rawValue)")
    }

    // MARK: - Message Routing

    /// Send a message to a specific recipient
    func sendMessage(
        content: String,
        to recipientPublicKey: String,
        priority: MessagePriority = .normal,
        transport: TransportType? = nil,
        callback: ((DeliveryStatus) -> Void)? = nil
    ) async throws {
        guard let senderPublicKey = await CryptoManager.shared.getPublicKeyHex() else {
            throw TransportError.noKeyPair
        }

        // Encrypt the message
        let contentData = content.data(using: .utf8)!
        let encrypted = try await CryptoManager.shared.encrypt(contentData, for: recipientPublicKey)

        // Create routable message
        let message = RoutableMessage(
            id: UUID().uuidString,
            content: encrypted.combined,
            recipientPublicKey: recipientPublicKey,
            senderPublicKey: senderPublicKey,
            timestamp: Date(),
            priority: priority,
            preferredTransport: transport ?? preferredTransport
        )

        // Store callback
        if let callback = callback {
            messageCallbacks[message.id] = callback
        }

        // Route the message
        await routeMessage(message)
    }

    /// Broadcast a message to all peers
    func broadcastMessage(
        content: String,
        priority: MessagePriority = .normal,
        callback: ((DeliveryStatus) -> Void)? = nil
    ) async throws {
        guard let senderPublicKey = await CryptoManager.shared.getPublicKeyHex() else {
            throw TransportError.noKeyPair
        }

        let contentData = content.data(using: .utf8)!

        let message = RoutableMessage(
            id: UUID().uuidString,
            content: contentData,
            recipientPublicKey: nil,
            senderPublicKey: senderPublicKey,
            timestamp: Date(),
            priority: priority,
            preferredTransport: preferredTransport
        )

        if let callback = callback {
            messageCallbacks[message.id] = callback
        }

        await routeMessage(message)
    }

    // MARK: - Private Methods

    private func routeMessage(_ message: RoutableMessage) async {
        var mutableMessage = message
        pendingMessages += 1

        // Add to message queue for persistence
        await MessageQueue.shared.addOutgoing(message)

        // Determine which transports to use
        let transports = selectTransports(for: message)

        // Try each transport
        for transport in transports {
            notifyCallback(message.id, status: .sending(transport: transport))

            do {
                switch transport {
                case .ble:
                    try await sendViaBLE(mutableMessage)
                case .nostr:
                    try await sendViaNostr(mutableMessage)
                case .both:
                    // Handled by sending via both transports
                    continue
                }

                // Success
                mutableMessage.delivered = true
                mutableMessage.deliveredVia = transport
                deliveredMessages += 1
                pendingMessages -= 1

                notifyCallback(message.id, status: .delivered(transport: transport))
                await MessageQueue.shared.markDelivered(message.id)

                logger.info("Message delivered via \(transport.rawValue): \(message.id)")
                return

            } catch {
                logger.warning("Failed to send via \(transport.rawValue): \(error.localizedDescription)")
                mutableMessage.attempts += 1
                mutableMessage.lastAttempt = Date()
            }
        }

        // All transports failed - queue for retry
        if mutableMessage.attempts < maxRetryAttempts {
            scheduleRetry(mutableMessage)
        } else {
            pendingMessages -= 1
            let error = TransportError.allTransportsFailed
            notifyCallback(message.id, status: .failed(error: error))
            logger.error("Message delivery failed after \(mutableMessage.attempts) attempts: \(message.id)")
        }
    }

    private func selectTransports(for message: RoutableMessage) -> [TransportType] {
        switch message.preferredTransport {
        case .ble:
            if bleAvailable {
                return [.ble, .nostr]  // Fallback to Nostr
            }
            return [.nostr]

        case .nostr:
            if nostrAvailable {
                return [.nostr, .ble]  // Fallback to BLE
            }
            return [.ble]

        case .both:
            var transports: [TransportType] = []
            if bleAvailable { transports.append(.ble) }
            if nostrAvailable { transports.append(.nostr) }
            return transports.isEmpty ? [.ble, .nostr] : transports
        }
    }

    private func sendViaBLE(_ message: RoutableMessage) async throws {
        guard bleAvailable else {
            throw TransportError.bleNotAvailable
        }

        if let recipientPublicKey = message.recipientPublicKey {
            // Find peer with this public key
            let peers = await MeshRouter.shared.getAllPeers()
            guard let peer = peers.first(where: { $0.publicKey == recipientPublicKey }) else {
                throw TransportError.peerNotFound
            }

            // Create mesh message
            let meshMessage = MeshMessage(
                id: message.id,
                sourcePublicKey: message.senderPublicKey,
                destinationPublicKey: recipientPublicKey,
                payload: message.content,
                timestamp: message.timestamp,
                ttl: 10,
                hopCount: 0,
                signature: try await CryptoManager.shared.sign(message.content),
                type: .direct
            )

            try await MeshRouter.shared.routeMessage(meshMessage)
        } else {
            // Broadcast
            let meshMessage = MeshMessage(
                id: message.id,
                sourcePublicKey: message.senderPublicKey,
                destinationPublicKey: nil,
                payload: message.content,
                timestamp: message.timestamp,
                ttl: 5,
                hopCount: 0,
                signature: try await CryptoManager.shared.sign(message.content),
                type: .broadcast
            )

            try await MeshRouter.shared.routeMessage(meshMessage)
        }
    }

    private func sendViaNostr(_ message: RoutableMessage) async throws {
        guard nostrAvailable else {
            throw TransportError.nostrNotAvailable
        }

        if let recipientPublicKey = message.recipientPublicKey {
            // Send encrypted DM via Nostr
            guard let content = String(data: message.content, encoding: .utf8) else {
                throw TransportError.invalidContent
            }

            _ = try await NostrClient.shared.sendDirectMessage(content, to: recipientPublicKey)
        } else {
            // Broadcast via Nostr (as a text note or custom event)
            guard let content = String(data: message.content, encoding: .utf8) else {
                throw TransportError.invalidContent
            }

            _ = try await NostrClient.shared.publishTextNote(content)
        }
    }

    private func scheduleRetry(_ message: RoutableMessage) {
        DispatchQueue.main.asyncAfter(deadline: .now() + retryDelay) { [weak self] in
            Task {
                await self?.routeMessage(message)
            }
        }
    }

    private func notifyCallback(_ messageId: String, status: DeliveryStatus) {
        messageCallbacks[messageId]?(status)

        if case .delivered = status {
            messageCallbacks.removeValue(forKey: messageId)
        } else if case .failed = status {
            messageCallbacks.removeValue(forKey: messageId)
        }
    }
}

// MARK: - Transport Errors

enum TransportError: LocalizedError {
    case noKeyPair
    case bleNotAvailable
    case nostrNotAvailable
    case peerNotFound
    case invalidContent
    case allTransportsFailed

    var errorDescription: String? {
        switch self {
        case .noKeyPair:
            return "No key pair available"
        case .bleNotAvailable:
            return "BLE is not available"
        case .nostrNotAvailable:
            return "Nostr is not available"
        case .peerNotFound:
            return "Recipient not found in mesh"
        case .invalidContent:
            return "Invalid message content"
        case .allTransportsFailed:
            return "All transport methods failed"
        }
    }
}
