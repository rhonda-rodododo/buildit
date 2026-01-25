// BLEManagerTests.swift
// BuildItTests
//
// Unit tests for BLE Manager state management

import XCTest
import CoreBluetooth
@testable import BuildIt

final class BLEManagerTests: XCTestCase {

    // MARK: - Properties

    var mockBLEManager: MockBLEManager!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        mockBLEManager = MockBLEManager()
    }

    override func tearDown() {
        mockBLEManager.reset()
        mockBLEManager = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialConnectionState() {
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
    }

    func testInitialPeersEmpty() {
        XCTAssertTrue(mockBLEManager.discoveredPeers.isEmpty)
        XCTAssertTrue(mockBLEManager.connectedPeers.isEmpty)
    }

    func testInitialBluetoothEnabled() {
        XCTAssertTrue(mockBLEManager.isBluetoothEnabled)
    }

    // MARK: - Scanning Tests

    func testStartScanning() {
        // When: Starting scan
        mockBLEManager.startScanning()

        // Then: State should update
        XCTAssertEqual(mockBLEManager.connectionState, .scanning)
        XCTAssertTrue(mockBLEManager.didPerformOperation(.startScanning))
    }

    func testStartScanningWhenBluetoothDisabled() {
        // Given: Bluetooth disabled
        mockBLEManager.simulateBluetoothStateChange(.poweredOff)

        // When: Starting scan
        mockBLEManager.shouldSucceed = false
        mockBLEManager.startScanning()

        // Then: Should record attempt but not change state to scanning
        XCTAssertTrue(mockBLEManager.didPerformOperation(.startScanning))
    }

    func testStopScanning() {
        // Given: Currently scanning
        mockBLEManager.startScanning()

        // When: Stopping scan
        mockBLEManager.stopScanning()

        // Then: State should update
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
        XCTAssertTrue(mockBLEManager.didPerformOperation(.stopScanning))
    }

    func testStopScanningWithConnectedPeers() {
        // Given: Scanning with connected peers
        mockBLEManager.startScanning()
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.simulateDiscoveredPeer(peer)
        mockBLEManager.connect(to: peer)

        // When: Stopping scan
        mockBLEManager.stopScanning()

        // Then: State should be connected (not disconnected)
        XCTAssertEqual(mockBLEManager.connectionState, .connected)
    }

    // MARK: - Advertising Tests

    func testStartAdvertising() {
        // When: Starting advertising
        mockBLEManager.startAdvertising()

        // Then: State should update
        XCTAssertEqual(mockBLEManager.connectionState, .advertising)
        XCTAssertTrue(mockBLEManager.didPerformOperation(.startAdvertising))
    }

    func testStopAdvertising() {
        // Given: Currently advertising
        mockBLEManager.startAdvertising()

        // When: Stopping advertising
        mockBLEManager.stopAdvertising()

        // Then: State should update
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
        XCTAssertTrue(mockBLEManager.didPerformOperation(.stopAdvertising))
    }

    // MARK: - Peer Discovery Tests

    func testPeerDiscovery() {
        // Given: Mock is scanning
        mockBLEManager.startScanning()

        // When: Peer is discovered
        let peer = MockBLEManager.createMockPeer(identifier: "Test Device")
        mockBLEManager.simulateDiscoveredPeer(peer)

        // Then: Peer should be in discovered list
        XCTAssertEqual(mockBLEManager.discoveredPeers.count, 1)
        XCTAssertEqual(mockBLEManager.discoveredPeers.first?.identifier, "Test Device")
    }

    func testMultiplePeerDiscovery() {
        // Given: Mock is scanning
        mockBLEManager.startScanning()

        // When: Multiple peers discovered
        for i in 1...5 {
            let peer = MockBLEManager.createMockPeer(identifier: "Device \(i)")
            mockBLEManager.simulateDiscoveredPeer(peer)
        }

        // Then: All peers should be in discovered list
        XCTAssertEqual(mockBLEManager.discoveredPeers.count, 5)
    }

    func testPeerDiscoveryCallback() {
        // Given: Callback registered
        var discoveredPeer: DiscoveredPeer?
        mockBLEManager.onPeerDiscovered = { peer in
            discoveredPeer = peer
        }

        // When: Peer discovered
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.simulateDiscoveredPeer(peer)

        // Then: Callback should be invoked
        XCTAssertNotNil(discoveredPeer)
        XCTAssertEqual(discoveredPeer?.id, peer.id)
    }

    // MARK: - Connection Tests

    func testConnectToPeer() {
        // Given: A discovered peer
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.simulateDiscoveredPeer(peer)

        // When: Connecting
        mockBLEManager.connect(to: peer)

        // Then: Peer should be connected
        XCTAssertEqual(mockBLEManager.connectionState, .connected)
        XCTAssertTrue(mockBLEManager.connectedPeers.contains { $0.id == peer.id })
        XCTAssertTrue(mockBLEManager.didPerformOperation(.connect(peerId: peer.id)))
    }

    func testConnectRemovesFromDiscovered() {
        // Given: A discovered peer
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.simulateDiscoveredPeer(peer)
        XCTAssertEqual(mockBLEManager.discoveredPeers.count, 1)

        // When: Connecting
        mockBLEManager.connect(to: peer)

        // Then: Peer should move from discovered to connected
        XCTAssertEqual(mockBLEManager.discoveredPeers.count, 0)
        XCTAssertEqual(mockBLEManager.connectedPeers.count, 1)
    }

    func testConnectCallback() {
        // Given: Callback registered
        var connectedPeer: DiscoveredPeer?
        mockBLEManager.onPeerConnected = { peer in
            connectedPeer = peer
        }

        // When: Connecting
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        // Then: Callback should be invoked
        XCTAssertNotNil(connectedPeer)
        XCTAssertEqual(connectedPeer?.id, peer.id)
    }

    func testConnectionFailure() {
        // Given: Connection configured to fail
        mockBLEManager.shouldSucceed = false
        mockBLEManager.simulatedError = .sendFailed

        let peer = MockBLEManager.createMockPeer()

        // When: Trying to connect
        mockBLEManager.connect(to: peer)

        // Then: Should have error
        XCTAssertNotNil(mockBLEManager.lastError)
    }

    // MARK: - Disconnection Tests

    func testDisconnectFromPeer() {
        // Given: A connected peer
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        // When: Disconnecting
        mockBLEManager.disconnect(from: peer)

        // Then: Peer should be removed
        XCTAssertFalse(mockBLEManager.connectedPeers.contains { $0.id == peer.id })
        XCTAssertTrue(mockBLEManager.didPerformOperation(.disconnect(peerId: peer.id)))
    }

    func testDisconnectCallback() {
        // Given: Callback registered and connected peer
        var disconnectedId: UUID?
        mockBLEManager.onPeerDisconnected = { id in
            disconnectedId = id
        }

        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        // When: Disconnecting
        mockBLEManager.disconnect(from: peer)

        // Then: Callback should be invoked
        XCTAssertEqual(disconnectedId, peer.id)
    }

    func testDisconnectAllReturnsToDisconnected() {
        // Given: Multiple connected peers
        for _ in 1...3 {
            let peer = MockBLEManager.createMockPeer()
            mockBLEManager.connect(to: peer)
        }
        XCTAssertEqual(mockBLEManager.connectedPeers.count, 3)

        // When: Disconnecting all
        for peer in mockBLEManager.connectedPeers {
            mockBLEManager.disconnect(from: peer)
        }

        // Then: State should be disconnected
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
        XCTAssertTrue(mockBLEManager.connectedPeers.isEmpty)
    }

    // MARK: - Message Sending Tests

    func testSendMessageSuccess() async throws {
        // Given: A connected peer
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        let messageData = TestFixtures.testMessageData

        // When: Sending message
        try await mockBLEManager.sendMessage(messageData, to: peer.id)

        // Then: Message should be tracked
        XCTAssertEqual(mockBLEManager.sentMessageCount(to: peer.id), 1)
        XCTAssertTrue(mockBLEManager.didPerformOperation(.sendMessage(peerId: peer.id, dataSize: messageData.count)))
    }

    func testSendMessageToDisconnectedPeer() async {
        // Given: A peer that's not connected
        let peerId = UUID()

        // When: Trying to send message
        do {
            try await mockBLEManager.sendMessage(TestFixtures.testMessageData, to: peerId)
            XCTFail("Should throw error")
        } catch let error as BLEError {
            // Then: Should throw peerNotConnected
            XCTAssertEqual(error, .peerNotConnected)
        } catch {
            XCTFail("Wrong error type")
        }
    }

    func testSendMessageTooLarge() async {
        // Given: A connected peer and oversized message
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        let largeData = Data(repeating: 0x00, count: BuildItBLEConstants.maxMessageSize + 1)

        // When: Trying to send
        do {
            try await mockBLEManager.sendMessage(largeData, to: peer.id)
            XCTFail("Should throw error")
        } catch let error as BLEError {
            // Then: Should throw messageTooLarge
            XCTAssertEqual(error, .messageTooLarge)
        } catch {
            XCTFail("Wrong error type")
        }
    }

    // MARK: - Broadcast Tests

    func testBroadcastMessage() async throws {
        // Given: Multiple connected peers
        for _ in 1...3 {
            let peer = MockBLEManager.createMockPeer()
            mockBLEManager.connect(to: peer)
        }

        let messageData = TestFixtures.testMessageData

        // When: Broadcasting
        try await mockBLEManager.broadcastMessage(messageData)

        // Then: Message should be sent to all peers
        XCTAssertEqual(mockBLEManager.broadcastMessages.count, 1)
        XCTAssertEqual(mockBLEManager.sentMessages.count, 3) // One per peer
    }

    func testBroadcastWithNoPeers() async throws {
        // Given: No connected peers
        XCTAssertTrue(mockBLEManager.connectedPeers.isEmpty)

        // When: Broadcasting
        try await mockBLEManager.broadcastMessage(TestFixtures.testMessageData)

        // Then: Broadcast should be recorded but no individual sends
        XCTAssertEqual(mockBLEManager.broadcastMessages.count, 1)
        XCTAssertEqual(mockBLEManager.sentMessages.count, 0)
    }

    // MARK: - Message Reception Tests

    func testReceiveMessage() {
        // Given: Callback registered
        var receivedMessage: (peerId: UUID, data: Data)?
        mockBLEManager.onMessageReceived = { peerId, data in
            receivedMessage = (peerId, data)
        }

        // When: Message received
        let peerId = UUID()
        let data = TestFixtures.testMessageData
        mockBLEManager.simulateReceivedMessage(data, from: peerId)

        // Then: Callback should be invoked
        XCTAssertNotNil(receivedMessage)
        XCTAssertEqual(receivedMessage?.peerId, peerId)
        XCTAssertEqual(receivedMessage?.data, data)
    }

    func testReceivedMessagesTracked() {
        // When: Multiple messages received
        let peerId = UUID()
        for i in 1...5 {
            let data = "Message \(i)".data(using: .utf8)!
            mockBLEManager.simulateReceivedMessage(data, from: peerId)
        }

        // Then: All should be tracked
        XCTAssertEqual(mockBLEManager.receivedMessages.count, 5)
    }

    // MARK: - Bluetooth State Tests

    func testBluetoothStateChangePoweredOff() {
        // Given: Some connected peers
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        // When: Bluetooth powers off
        mockBLEManager.simulateBluetoothStateChange(.poweredOff)

        // Then: Should disconnect all peers
        XCTAssertFalse(mockBLEManager.isBluetoothEnabled)
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
        XCTAssertTrue(mockBLEManager.connectedPeers.isEmpty)
    }

    func testBluetoothStateChangePoweredOn() {
        // Given: Bluetooth was off
        mockBLEManager.simulateBluetoothStateChange(.poweredOff)

        // When: Bluetooth powers on
        mockBLEManager.simulateBluetoothStateChange(.poweredOn)

        // Then: Should be enabled
        XCTAssertTrue(mockBLEManager.isBluetoothEnabled)
    }

    // MARK: - Connection Loss Simulation Tests

    func testConnectionLoss() {
        // Given: A connected peer
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.connect(to: peer)

        var disconnectedId: UUID?
        mockBLEManager.onPeerDisconnected = { id in
            disconnectedId = id
        }

        // When: Connection lost
        mockBLEManager.simulateConnectionLoss(for: peer.id)

        // Then: Peer should be removed and callback invoked
        XCTAssertEqual(disconnectedId, peer.id)
        XCTAssertFalse(mockBLEManager.connectedPeers.contains { $0.id == peer.id })
    }

    // MARK: - Reset Tests

    func testReset() {
        // Given: Some state
        mockBLEManager.startScanning()
        let peer = MockBLEManager.createMockPeer()
        mockBLEManager.simulateDiscoveredPeer(peer)
        mockBLEManager.connect(to: peer)

        // When: Resetting
        mockBLEManager.reset()

        // Then: Everything should be cleared
        XCTAssertEqual(mockBLEManager.connectionState, .disconnected)
        XCTAssertTrue(mockBLEManager.discoveredPeers.isEmpty)
        XCTAssertTrue(mockBLEManager.connectedPeers.isEmpty)
        XCTAssertTrue(mockBLEManager.operationLog.isEmpty)
        XCTAssertTrue(mockBLEManager.sentMessages.isEmpty)
    }

    // MARK: - BLE Constants Tests

    func testBLEConstants() {
        XCTAssertEqual(BuildItBLEConstants.maxMessageSize, 512)
        XCTAssertEqual(BuildItBLEConstants.scanInterval, 10.0)
        XCTAssertEqual(BuildItBLEConstants.scanDuration, 5.0)

        // Service UUIDs should be valid
        XCTAssertNotNil(BuildItBLEConstants.serviceUUID)
        XCTAssertNotNil(BuildItBLEConstants.messageCharacteristicUUID)
    }

    // MARK: - BLE Error Tests

    func testBLEErrorDescriptions() {
        let errors: [BLEError] = [
            .bluetoothNotAvailable,
            .peerNotConnected,
            .messageTooLarge,
            .sendFailed,
            .characteristicNotFound
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }

    // MARK: - DiscoveredPeer Tests

    func testDiscoveredPeerEquality() {
        let id = UUID()
        let peer1 = DiscoveredPeer(id: id, identifier: "Peer", rssi: -60, lastSeen: Date(), isConnected: false, peripheral: nil)
        let peer2 = DiscoveredPeer(id: id, identifier: "Different Name", rssi: -70, lastSeen: Date(), isConnected: true, peripheral: nil)

        // Equality is based on ID only
        XCTAssertEqual(peer1, peer2)
    }

    func testDiscoveredPeerHashing() {
        let id = UUID()
        let peer1 = DiscoveredPeer(id: id, identifier: "Peer1", rssi: -60, lastSeen: Date(), isConnected: false, peripheral: nil)
        let peer2 = DiscoveredPeer(id: id, identifier: "Peer2", rssi: -70, lastSeen: Date(), isConnected: true, peripheral: nil)

        // Same ID should have same hash
        XCTAssertEqual(peer1.hashValue, peer2.hashValue)

        // Can be used in sets
        var peerSet: Set<DiscoveredPeer> = []
        peerSet.insert(peer1)
        peerSet.insert(peer2)
        XCTAssertEqual(peerSet.count, 1) // Deduplicated by ID
    }

    // MARK: - Connection State Tests

    func testBLEConnectionStateValues() {
        // Verify all connection states exist
        let states: [BLEConnectionState] = [
            .disconnected,
            .scanning,
            .connecting,
            .connected,
            .advertising
        ]

        XCTAssertEqual(states.count, 5)
    }
}
