// RelayPool.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages connections to multiple Nostr relays with automatic
// reconnection and load balancing.

import Foundation
import Combine
import os.log

/// Represents a single relay connection
class RelayConnection: NSObject, URLSessionWebSocketDelegate {
    let url: String
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession!
    private var isConnected: Bool = false
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts = 5
    private let reconnectDelay: TimeInterval = 5.0

    private let logger = Logger(subsystem: "com.buildit", category: "RelayConnection")

    var onConnect: (() -> Void)?
    var onDisconnect: ((Error?) -> Void)?
    var onMessage: ((Data) -> Void)?

    init(url: String) {
        self.url = url
        super.init()
        self.session = URLSession(
            configuration: .default,
            delegate: self,
            delegateQueue: OperationQueue()
        )
    }

    func connect() {
        guard let url = URL(string: self.url) else {
            logger.error("Invalid relay URL: \(self.url)")
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 30

        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()

        receiveMessage()

        logger.info("Connecting to relay: \(self.url)")
    }

    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
    }

    func send(_ message: String) {
        guard isConnected else {
            logger.warning("Cannot send: not connected to \(self.url)")
            return
        }

        webSocket?.send(.string(message)) { [weak self] error in
            if let error = error {
                self?.logger.error("Send error: \(error.localizedDescription)")
            }
        }
    }

    func send(_ data: Data) {
        guard isConnected else { return }

        webSocket?.send(.data(data)) { [weak self] error in
            if let error = error {
                self?.logger.error("Send error: \(error.localizedDescription)")
            }
        }
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    if let data = text.data(using: .utf8) {
                        self.onMessage?(data)
                    }
                case .data(let data):
                    self.onMessage?(data)
                @unknown default:
                    break
                }

                // Continue receiving
                self.receiveMessage()

            case .failure(let error):
                self.logger.error("Receive error: \(error.localizedDescription)")
                self.handleDisconnect(error: error)
            }
        }
    }

    private func handleDisconnect(error: Error?) {
        isConnected = false
        onDisconnect?(error)

        // Attempt reconnection
        if reconnectAttempts < maxReconnectAttempts {
            reconnectAttempts += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + reconnectDelay) { [weak self] in
                self?.connect()
            }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            self.isConnected = true
            self.reconnectAttempts = 0
            self.onConnect?()
            self.logger.info("Connected to relay: \(self.url)")
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            self.isConnected = false
            self.onDisconnect?(nil)
            self.logger.info("Disconnected from relay: \(self.url)")
        }
    }
}

/// Manages a pool of relay connections
class RelayPool: ObservableObject {
    // MARK: - Published Properties

    @Published private(set) var connectedRelays: [String] = []

    // MARK: - Callbacks

    var onEvent: ((String, NostrEvent) -> Void)?
    var onEOSE: ((String) -> Void)?
    var onNotice: ((String, String) -> Void)?

    // MARK: - Private Properties

    private var connections: [String: RelayConnection] = [:]
    private var subscriptions: [String: [NostrFilter]] = [:]
    private let logger = Logger(subsystem: "com.buildit", category: "RelayPool")
    private let queue = DispatchQueue(label: "com.buildit.relaypool")

    // MARK: - Relay Management

    /// Add and connect to a relay
    func addRelay(url: String) {
        queue.async { [weak self] in
            guard self?.connections[url] == nil else { return }

            let connection = RelayConnection(url: url)

            connection.onConnect = { [weak self] in
                DispatchQueue.main.async {
                    self?.connectedRelays.append(url)

                    // Re-send existing subscriptions to new relay
                    self?.resendSubscriptions(to: connection)
                }
            }

            connection.onDisconnect = { [weak self] _ in
                DispatchQueue.main.async {
                    self?.connectedRelays.removeAll { $0 == url }
                }
            }

            connection.onMessage = { [weak self] data in
                self?.handleMessage(data, from: url)
            }

            self?.connections[url] = connection
            connection.connect()
        }
    }

    /// Remove and disconnect from a relay
    func removeRelay(url: String) {
        queue.async { [weak self] in
            guard let connection = self?.connections.removeValue(forKey: url) else { return }
            connection.disconnect()

            DispatchQueue.main.async {
                self?.connectedRelays.removeAll { $0 == url }
            }
        }
    }

    /// Disconnect from all relays
    func disconnectAll() {
        queue.async { [weak self] in
            for (_, connection) in self?.connections ?? [:] {
                connection.disconnect()
            }
            self?.connections.removeAll()

            DispatchQueue.main.async {
                self?.connectedRelays.removeAll()
            }
        }
    }

    // MARK: - Subscriptions

    /// Subscribe to events with filters
    func subscribe(id: String, filters: [NostrFilter]) {
        subscriptions[id] = filters

        // Send REQ to all connected relays
        let message = createReqMessage(id: id, filters: filters)

        for (_, connection) in connections {
            connection.send(message)
        }

        logger.info("Subscribed with ID: \(id)")
    }

    /// Unsubscribe from a subscription
    func unsubscribe(id: String) {
        subscriptions.removeValue(forKey: id)

        // Send CLOSE to all relays
        let message = "[\"CLOSE\",\"\(id)\"]"

        for (_, connection) in connections {
            connection.send(message)
        }

        logger.info("Unsubscribed: \(id)")
    }

    // MARK: - Publishing

    /// Publish an event to all relays
    func publish(event: NostrEvent) {
        guard let eventData = try? JSONEncoder().encode(event),
              let eventJson = String(data: eventData, encoding: .utf8) else {
            logger.error("Failed to encode event")
            return
        }

        let message = "[\"EVENT\",\(eventJson)]"

        for (_, connection) in connections {
            connection.send(message)
        }

        logger.info("Published event: \(event.id.prefix(8))")
    }

    // MARK: - Private Methods

    private func handleMessage(_ data: Data, from relayURL: String) {
        guard let message = NostrRelayMessage.parse(data) else {
            logger.warning("Failed to parse message from \(relayURL)")
            return
        }

        switch message {
        case .event(let subscriptionId, let event):
            onEvent?(subscriptionId, event)

        case .ok(let eventId, let success, let message):
            if success {
                logger.info("Event accepted: \(eventId.prefix(8))")
            } else {
                logger.warning("Event rejected: \(eventId.prefix(8)) - \(message)")
            }

        case .eose(let subscriptionId):
            onEOSE?(subscriptionId)

        case .notice(let message):
            logger.info("Notice from \(relayURL): \(message)")
            onNotice?(relayURL, message)

        case .auth(let challenge):
            handleAuth(challenge: challenge, relay: relayURL)
        }
    }

    private func handleAuth(challenge: String, relay: String) {
        // Implement NIP-42 authentication if needed
        logger.info("Auth challenge from \(relay): \(challenge.prefix(20))")
    }

    private func createReqMessage(id: String, filters: [NostrFilter]) -> String {
        guard let filtersData = try? JSONEncoder().encode(filters),
              let filtersJson = String(data: filtersData, encoding: .utf8) else {
            return ""
        }

        // Remove array brackets to get individual filter objects
        let filterObjects = filtersJson.dropFirst().dropLast()

        return "[\"REQ\",\"\(id)\",\(filterObjects)]"
    }

    private func resendSubscriptions(to connection: RelayConnection) {
        for (id, filters) in subscriptions {
            let message = createReqMessage(id: id, filters: filters)
            connection.send(message)
        }
    }
}
