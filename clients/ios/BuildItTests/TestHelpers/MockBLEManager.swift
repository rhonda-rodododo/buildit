// MockBLEManager.swift
// BuildItTests
//
// Mock BLE Manager for testing without actual Bluetooth hardware

import Foundation
import CoreBluetooth
import Combine
@testable import BuildIt

/// Mock BLE Manager for unit testing
class MockBLEManager: ObservableObject {
    // MARK: - Published Properties (mirroring BLEManager)

    @Published private(set) var connectionState: BLEConnectionState = .disconnected
    @Published private(set) var discoveredPeers: [DiscoveredPeer] = []
    @Published private(set) var connectedPeers: [DiscoveredPeer] = []
    @Published private(set) var authorizationStatus: CBManagerAuthorization = .notDetermined
    @Published private(set) var isBluetoothEnabled: Bool = false
    @Published private(set) var lastError: String?

    // MARK: - Mock Control Properties

    /// Whether Bluetooth operations should succeed
    var shouldSucceed: Bool = true

    /// Simulated Bluetooth state
    var simulatedBluetoothState: CBManagerState = .poweredOn {
        didSet {
            isBluetoothEnabled = simulatedBluetoothState == .poweredOn
        }
    }

    /// Simulated error for operations
    var simulatedError: BLEError?

    /// Delay for simulated operations (in seconds)
    var operationDelay: TimeInterval = 0

    // MARK: - Operation Tracking

    private(set) var operationLog: [BLEOperation] = []

    enum BLEOperation: Equatable {
        case startScanning
        case stopScanning
        case startAdvertising
        case stopAdvertising
        case connect(peerId: UUID)
        case disconnect(peerId: UUID)
        case sendMessage(peerId: UUID, dataSize: Int)
        case broadcastMessage(dataSize: Int)
    }

    // MARK: - Message Tracking

    private(set) var sentMessages: [(peerId: UUID, data: Data)] = []
    private(set) var broadcastMessages: [Data] = []
    private(set) var receivedMessages: [(peerId: UUID, data: Data)] = []

    // MARK: - Callbacks

    var onMessageReceived: ((UUID, Data) -> Void)?
    var onPeerDiscovered: ((DiscoveredPeer) -> Void)?
    var onPeerConnected: ((DiscoveredPeer) -> Void)?
    var onPeerDisconnected: ((UUID) -> Void)?

    // MARK: - Initialization

    init() {
        isBluetoothEnabled = true
    }

    // MARK: - Reset

    func reset() {
        connectionState = .disconnected
        discoveredPeers.removeAll()
        connectedPeers.removeAll()
        operationLog.removeAll()
        sentMessages.removeAll()
        broadcastMessages.removeAll()
        receivedMessages.removeAll()
        shouldSucceed = true
        simulatedError = nil
        lastError = nil
    }

    // MARK: - Scanning

    func startScanning() {
        operationLog.append(.startScanning)

        guard shouldSucceed else {
            lastError = simulatedError?.localizedDescription ?? "Scanning failed"
            return
        }

        connectionState = .scanning
    }

    func stopScanning() {
        operationLog.append(.stopScanning)

        if connectionState == .scanning {
            connectionState = connectedPeers.isEmpty ? .disconnected : .connected
        }
    }

    // MARK: - Advertising

    func startAdvertising() {
        operationLog.append(.startAdvertising)

        guard shouldSucceed else {
            lastError = simulatedError?.localizedDescription ?? "Advertising failed"
            return
        }

        connectionState = .advertising
    }

    func stopAdvertising() {
        operationLog.append(.stopAdvertising)

        if connectionState == .advertising {
            connectionState = connectedPeers.isEmpty ? .disconnected : .connected
        }
    }

    // MARK: - Connection

    func connect(to peer: DiscoveredPeer) {
        operationLog.append(.connect(peerId: peer.id))

        guard shouldSucceed else {
            lastError = simulatedError?.localizedDescription ?? "Connection failed"
            return
        }

        connectionState = .connecting

        // Simulate async connection
        if operationDelay > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + operationDelay) { [weak self] in
                self?.completeConnection(to: peer)
            }
        } else {
            completeConnection(to: peer)
        }
    }

    private func completeConnection(to peer: DiscoveredPeer) {
        var connectedPeer = peer
        connectedPeer.isConnected = true

        // Remove from discovered if present
        discoveredPeers.removeAll { $0.id == peer.id }

        // Add to connected
        connectedPeers.append(connectedPeer)
        connectionState = .connected

        onPeerConnected?(connectedPeer)
    }

    func disconnect(from peer: DiscoveredPeer) {
        operationLog.append(.disconnect(peerId: peer.id))

        connectedPeers.removeAll { $0.id == peer.id }

        if connectedPeers.isEmpty {
            connectionState = .disconnected
        }

        onPeerDisconnected?(peer.id)
    }

    // MARK: - Messaging

    func sendMessage(_ data: Data, to peerID: UUID) async throws {
        operationLog.append(.sendMessage(peerId: peerID, dataSize: data.count))

        guard shouldSucceed else {
            throw simulatedError ?? BLEError.sendFailed
        }

        guard connectedPeers.contains(where: { $0.id == peerID }) else {
            throw BLEError.peerNotConnected
        }

        if data.count > BuildItBLEConstants.maxMessageSize {
            throw BLEError.messageTooLarge
        }

        sentMessages.append((peerID, data))

        if operationDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(operationDelay * 1_000_000_000))
        }
    }

    func broadcastMessage(_ data: Data) async throws {
        operationLog.append(.broadcastMessage(dataSize: data.count))

        guard shouldSucceed else {
            throw simulatedError ?? BLEError.sendFailed
        }

        broadcastMessages.append(data)

        // Send to all connected peers
        for peer in connectedPeers {
            sentMessages.append((peer.id, data))
        }
    }

    // MARK: - Simulation Methods

    /// Simulate discovering a new peer
    func simulateDiscoveredPeer(_ peer: DiscoveredPeer) {
        discoveredPeers.append(peer)
        onPeerDiscovered?(peer)
    }

    /// Simulate receiving a message from a peer
    func simulateReceivedMessage(_ data: Data, from peerID: UUID) {
        receivedMessages.append((peerID, data))
        onMessageReceived?(peerID, data)
    }

    /// Simulate Bluetooth state change
    func simulateBluetoothStateChange(_ state: CBManagerState) {
        simulatedBluetoothState = state

        if state != .poweredOn {
            connectionState = .disconnected
            connectedPeers.removeAll()
        }
    }

    /// Simulate connection loss
    func simulateConnectionLoss(for peerID: UUID) {
        if let index = connectedPeers.firstIndex(where: { $0.id == peerID }) {
            let peer = connectedPeers.remove(at: index)
            discoveredPeers.append(peer)

            if connectedPeers.isEmpty {
                connectionState = .disconnected
            }

            onPeerDisconnected?(peerID)
        }
    }

    // MARK: - Verification Helpers

    func didPerformOperation(_ operation: BLEOperation) -> Bool {
        operationLog.contains(operation)
    }

    func operationCount(for operation: BLEOperation) -> Int {
        operationLog.filter { $0 == operation }.count
    }

    func sentMessageCount(to peerID: UUID? = nil) -> Int {
        if let peerID = peerID {
            return sentMessages.filter { $0.peerId == peerID }.count
        }
        return sentMessages.count
    }

    func getLastSentMessage(to peerID: UUID? = nil) -> Data? {
        if let peerID = peerID {
            return sentMessages.last { $0.peerId == peerID }?.data
        }
        return sentMessages.last?.data
    }
}

// MARK: - Mock Discovered Peer Factory

extension MockBLEManager {
    /// Create a mock discovered peer for testing
    static func createMockPeer(
        id: UUID = UUID(),
        identifier: String = "Test Peer",
        rssi: Int = -65,
        isConnected: Bool = false,
        verifiedPubkey: String? = nil
    ) -> DiscoveredPeer {
        DiscoveredPeer(
            id: id,
            identifier: identifier,
            rssi: rssi,
            lastSeen: Date(),
            isConnected: isConnected,
            peripheral: nil,
            identityCommitment: nil,
            verifiedPubkey: verifiedPubkey
        )
    }
}

// MARK: - Mock CBPeripheral

/// Minimal mock peripheral for testing (CBPeripheral cannot be directly instantiated)
class MockPeripheralInfo {
    let identifier: UUID
    let name: String?
    var state: CBPeripheralState

    init(identifier: UUID = UUID(), name: String? = "Mock Peripheral", state: CBPeripheralState = .disconnected) {
        self.identifier = identifier
        self.name = name
        self.state = state
    }
}

// MARK: - BLE Test Configuration

/// Configuration for BLE test scenarios
struct BLETestConfiguration {
    var shouldSucceed: Bool = true
    var bluetoothEnabled: Bool = true
    var operationDelay: TimeInterval = 0
    var initialPeerCount: Int = 0

    /// Create a failing configuration
    static var failing: BLETestConfiguration {
        var config = BLETestConfiguration()
        config.shouldSucceed = false
        return config
    }

    /// Create a configuration with Bluetooth disabled
    static var bluetoothDisabled: BLETestConfiguration {
        var config = BLETestConfiguration()
        config.bluetoothEnabled = false
        return config
    }

    /// Apply configuration to mock
    func apply(to mock: MockBLEManager) {
        mock.shouldSucceed = shouldSucceed
        mock.simulatedBluetoothState = bluetoothEnabled ? .poweredOn : .poweredOff

        // Add initial peers if configured
        for i in 0..<initialPeerCount {
            let peer = MockBLEManager.createMockPeer(
                identifier: "Peer \(i + 1)"
            )
            mock.simulateDiscoveredPeer(peer)
        }
    }
}
