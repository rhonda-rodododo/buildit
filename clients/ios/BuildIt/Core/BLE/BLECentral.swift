// BLECentral.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles BLE central role operations including scanning,
// connecting to peripherals, and data transfer.

import Foundation
import CoreBluetooth
import Combine
import os.log

/// Manages BLE central role operations
/// Responsible for discovering and connecting to BuildIt peripheral devices
class BLECentral: NSObject {
    // MARK: - Published Properties

    @Published private(set) var discoveredPeripherals: [CBPeripheral] = []
    @Published private(set) var connectedPeripherals: [CBPeripheral] = []
    @Published private(set) var isScanning: Bool = false

    // MARK: - Private Properties

    private var centralManager: CBCentralManager?
    private var peripheralDelegates: [UUID: PeripheralDelegate] = [:]
    private var pendingMessages: [UUID: [Data]] = [:]
    private var messageCharacteristics: [UUID: CBCharacteristic] = [:]
    private var handshakeCharacteristics: [UUID: CBCharacteristic] = [:]
    private let logger = Logger(subsystem: "com.buildit", category: "BLECentral")

    /// Authenticator for BLE peer verification
    private let authenticator = BLEAuthenticator.shared

    // Continuation for async message sending
    private var sendContinuations: [UUID: CheckedContinuation<Void, Error>] = [:]

    // Continuation for handshake read operations
    private var handshakeReadContinuations: [UUID: CheckedContinuation<Data, Error>] = [:]

    // Continuation for handshake write operations
    private var handshakeWriteContinuations: [UUID: CheckedContinuation<Void, Error>] = [:]

    // MARK: - Configuration

    func configure(with manager: CBCentralManager) {
        self.centralManager = manager
    }

    // MARK: - Scanning

    func startScanning(forService serviceUUID: CBUUID? = nil) {
        guard let manager = centralManager, manager.state == .poweredOn else {
            logger.warning("Cannot start scanning: Central manager not ready")
            return
        }

        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ]

        let uuid = serviceUUID ?? BuildItBLEConstants.serviceUUID
        manager.scanForPeripherals(
            withServices: [uuid],
            options: options
        )

        isScanning = true
        logger.info("Started scanning for BuildIt peripherals")
    }

    func stopScanning() {
        centralManager?.stopScan()
        isScanning = false
        logger.info("Stopped scanning")
    }

    // MARK: - Connection Management

    func connect(to peripheral: CBPeripheral) {
        guard let manager = centralManager else { return }

        let options: [String: Any] = [
            CBConnectPeripheralOptionNotifyOnConnectionKey: true,
            CBConnectPeripheralOptionNotifyOnDisconnectionKey: true,
            CBConnectPeripheralOptionNotifyOnNotificationKey: true
        ]

        manager.connect(peripheral, options: options)
        logger.info("Initiating connection to: \(peripheral.identifier)")
    }

    func disconnect(from peripheral: CBPeripheral) {
        centralManager?.cancelPeripheralConnection(peripheral)
        cleanupPeripheral(peripheral)
    }

    func handleDiscoveredPeripheral(
        _ peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi: Int,
        commitmentData: Data? = nil
    ) {
        // Filter by signal strength
        guard rssi > -80 else { return }

        // Check if already discovered
        if !discoveredPeripherals.contains(where: { $0.identifier == peripheral.identifier }) {
            discoveredPeripherals.append(peripheral)
            logger.info("Discovered peripheral: \(peripheral.identifier), RSSI: \(rssi)")
        }
    }

    func handleConnectedPeripheral(_ peripheral: CBPeripheral) {
        // Setup delegate
        let delegate = PeripheralDelegate(central: self, peripheral: peripheral)
        peripheralDelegates[peripheral.identifier] = delegate
        peripheral.delegate = delegate

        // Discover services
        peripheral.discoverServices([BuildItBLEConstants.serviceUUID])

        // Add to connected list
        if !connectedPeripherals.contains(where: { $0.identifier == peripheral.identifier }) {
            connectedPeripherals.append(peripheral)
        }

        // Remove from discovered list
        discoveredPeripherals.removeAll { $0.identifier == peripheral.identifier }

        logger.info("Connected to peripheral: \(peripheral.identifier)")
    }

    func handleDisconnectedPeripheral(_ peripheral: CBPeripheral) {
        cleanupPeripheral(peripheral)
        logger.info("Disconnected from peripheral: \(peripheral.identifier)")
    }

    func handleRestoredPeripheral(_ peripheral: CBPeripheral) {
        // Re-setup delegate for restored peripheral
        let delegate = PeripheralDelegate(central: self, peripheral: peripheral)
        peripheralDelegates[peripheral.identifier] = delegate
        peripheral.delegate = delegate

        if peripheral.state == .connected {
            connectedPeripherals.append(peripheral)
            peripheral.discoverServices([BuildItBLEConstants.serviceUUID])
        }

        logger.info("Restored peripheral: \(peripheral.identifier)")
    }

    // MARK: - Message Sending

    func sendMessage(_ data: Data, to peripheral: CBPeripheral) async throws {
        guard let characteristic = messageCharacteristics[peripheral.identifier] else {
            throw BLEError.characteristicNotFound
        }

        guard data.count <= BuildItBLEConstants.maxMessageSize else {
            throw BLEError.messageTooLarge
        }

        return try await withCheckedThrowingContinuation { continuation in
            sendContinuations[peripheral.identifier] = continuation

            peripheral.writeValue(
                data,
                for: characteristic,
                type: .withResponse
            )

            // Timeout after 10 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                if let cont = self?.sendContinuations.removeValue(forKey: peripheral.identifier) {
                    cont.resume(throwing: BLEError.sendFailed)
                }
            }
        }
    }

    func syncWithPeer(_ peripheral: CBPeripheral) async throws {
        // Request any pending messages from peer
        guard let characteristic = messageCharacteristics[peripheral.identifier] else {
            throw BLEError.characteristicNotFound
        }

        peripheral.readValue(for: characteristic)
    }

    // MARK: - Internal Callbacks

    func didDiscoverServices(for peripheral: CBPeripheral, error: Error?) {
        guard error == nil else {
            logger.error("Service discovery error: \(error!.localizedDescription)")
            return
        }

        guard let services = peripheral.services else { return }

        for service in services {
            if service.uuid == BuildItBLEConstants.serviceUUID {
                peripheral.discoverCharacteristics(
                    [
                        BuildItBLEConstants.messageCharacteristicUUID,
                        BuildItBLEConstants.identityCharacteristicUUID,
                        BuildItBLEConstants.routingCharacteristicUUID,
                        BuildItBLEConstants.handshakeCharacteristicUUID
                    ],
                    for: service
                )
            }
        }
    }

    func didDiscoverCharacteristics(for service: CBService, peripheral: CBPeripheral, error: Error?) {
        guard error == nil else {
            logger.error("Characteristic discovery error: \(error!.localizedDescription)")
            return
        }

        guard let characteristics = service.characteristics else { return }

        for characteristic in characteristics {
            switch characteristic.uuid {
            case BuildItBLEConstants.messageCharacteristicUUID:
                messageCharacteristics[peripheral.identifier] = characteristic
                // Subscribe to notifications
                if characteristic.properties.contains(.notify) {
                    peripheral.setNotifyValue(true, for: characteristic)
                }
                logger.info("Found message characteristic for: \(peripheral.identifier)")

            case BuildItBLEConstants.identityCharacteristicUUID:
                // Read identity (only used after authentication)
                break

            case BuildItBLEConstants.handshakeCharacteristicUUID:
                // Store handshake characteristic and initiate authenticated handshake
                handshakeCharacteristics[peripheral.identifier] = characteristic
                // Subscribe to handshake notifications for receiving responses
                if characteristic.properties.contains(.notify) {
                    peripheral.setNotifyValue(true, for: characteristic)
                }
                performAuthenticatedHandshake(with: peripheral, characteristic: characteristic)

            default:
                break
            }
        }
    }

    func didUpdateValue(for characteristic: CBCharacteristic, peripheral: CBPeripheral, error: Error?) {
        guard error == nil else {
            logger.error("Value update error: \(error!.localizedDescription)")
            return
        }

        guard let data = characteristic.value else { return }

        switch characteristic.uuid {
        case BuildItBLEConstants.messageCharacteristicUUID:
            // Only process messages from authenticated peers
            guard authenticator.isAuthenticated(peripheral.identifier) else {
                logger.warning("[AUTH] Dropping message from unauthenticated peer: \(peripheral.identifier)")
                return
            }
            handleReceivedMessage(data, from: peripheral)

        case BuildItBLEConstants.identityCharacteristicUUID:
            // Identity is now verified via handshake, not raw read
            break

        case BuildItBLEConstants.handshakeCharacteristicUUID:
            // Resume any pending handshake read continuation
            if let continuation = handshakeReadContinuations.removeValue(forKey: peripheral.identifier) {
                continuation.resume(returning: data)
            }

        default:
            break
        }
    }

    func didWriteValue(for characteristic: CBCharacteristic, peripheral: CBPeripheral, error: Error?) {
        switch characteristic.uuid {
        case BuildItBLEConstants.handshakeCharacteristicUUID:
            if let continuation = handshakeWriteContinuations.removeValue(forKey: peripheral.identifier) {
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }

        default:
            if let continuation = sendContinuations.removeValue(forKey: peripheral.identifier) {
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Private Methods

    private func cleanupPeripheral(_ peripheral: CBPeripheral) {
        connectedPeripherals.removeAll { $0.identifier == peripheral.identifier }
        peripheralDelegates.removeValue(forKey: peripheral.identifier)
        messageCharacteristics.removeValue(forKey: peripheral.identifier)
        handshakeCharacteristics.removeValue(forKey: peripheral.identifier)
        pendingMessages.removeValue(forKey: peripheral.identifier)
        sendContinuations.removeValue(forKey: peripheral.identifier)
        handshakeReadContinuations.removeValue(forKey: peripheral.identifier)
        handshakeWriteContinuations.removeValue(forKey: peripheral.identifier)

        // Clear authentication state for this peer
        authenticator.peerDisconnected(peripheral.identifier)
    }

    private func handleReceivedMessage(_ data: Data, from peripheral: CBPeripheral) {
        logger.info("Received message from: \(peripheral.identifier), size: \(data.count)")

        // Parse and route the message
        Task {
            do {
                let message = try MeshMessage.decode(from: data)
                try await MeshRouter.shared.handleIncomingMessage(message, from: peripheral.identifier)
            } catch {
                logger.error("Failed to handle message: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Authenticated Handshake (Central as Initiator)

    /// Perform a mutually authenticated handshake with a peripheral.
    ///
    /// Protocol:
    ///   1. Central (us) sends signed challenge to peripheral
    ///   2. Peripheral verifies and sends signed response
    ///   3. Central verifies response -- mutual authentication complete
    ///
    /// If the handshake fails or times out, the peripheral is disconnected.
    private func performAuthenticatedHandshake(with peripheral: CBPeripheral, characteristic: CBCharacteristic) {
        Task {
            do {
                logger.info("[AUTH] Starting authenticated handshake with: \(peripheral.identifier)")

                // Step 1: Create and send our challenge
                let challengeData = try await authenticator.createChallenge(for: peripheral.identifier)
                try await writeHandshakeData(challengeData, to: peripheral, characteristic: characteristic)

                logger.info("[AUTH] Sent challenge to: \(peripheral.identifier), awaiting response...")

                // Step 2: Read the peer's response
                let responseData = try await readHandshakeData(from: peripheral, characteristic: characteristic)

                // Step 3: Verify the response
                let verifiedPubkey = try await authenticator.verifyResponse(responseData, from: peripheral.identifier)

                logger.info("[AUTH] Mutual authentication SUCCEEDED with: \(peripheral.identifier), pubkey: \(verifiedPubkey.prefix(16))...")

                // Register the verified peer in the mesh router
                let commitment = MeshPeer.createCommitment(pubkey: verifiedPubkey)
                await MeshRouter.shared.registerPeer(peripheral.identifier, commitment: commitment.commitment)
                _ = await MeshRouter.shared.verifyPeerIdentity(
                    peripheral.identifier,
                    pubkey: verifiedPubkey,
                    nonce: commitment.nonce
                )

                // Notify BLEManager of successful authentication
                NotificationCenter.default.post(
                    name: .bleAuthenticationCompleted,
                    object: nil,
                    userInfo: [
                        "peerID": peripheral.identifier,
                        "pubkey": verifiedPubkey
                    ]
                )

            } catch {
                logger.error("[AUTH] Handshake FAILED with \(peripheral.identifier): \(error.localizedDescription)")

                // Reject the unauthenticated connection
                centralManager?.cancelPeripheralConnection(peripheral)

                NotificationCenter.default.post(
                    name: .bleAuthenticationFailed,
                    object: nil,
                    userInfo: [
                        "peerID": peripheral.identifier,
                        "error": error.localizedDescription
                    ]
                )
            }
        }
    }

    /// Write handshake data to the peer's handshake characteristic
    private func writeHandshakeData(_ data: Data, to peripheral: CBPeripheral, characteristic: CBCharacteristic) async throws {
        return try await withCheckedThrowingContinuation { continuation in
            handshakeWriteContinuations[peripheral.identifier] = continuation

            peripheral.writeValue(data, for: characteristic, type: .withResponse)

            // Timeout after 15 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
                if let cont = self?.handshakeWriteContinuations.removeValue(forKey: peripheral.identifier) {
                    cont.resume(throwing: BLEAuthError.handshakeTimeout)
                }
            }
        }
    }

    /// Read handshake data from the peer's handshake characteristic
    private func readHandshakeData(from peripheral: CBPeripheral, characteristic: CBCharacteristic) async throws -> Data {
        return try await withCheckedThrowingContinuation { continuation in
            handshakeReadContinuations[peripheral.identifier] = continuation

            peripheral.readValue(for: characteristic)

            // Timeout after 15 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
                if let cont = self?.handshakeReadContinuations.removeValue(forKey: peripheral.identifier) {
                    cont.resume(throwing: BLEAuthError.handshakeTimeout)
                }
            }
        }
    }
}

// MARK: - Peripheral Delegate

/// Delegate for handling peripheral callbacks
private class PeripheralDelegate: NSObject, CBPeripheralDelegate {
    weak var central: BLECentral?
    weak var peripheral: CBPeripheral?

    init(central: BLECentral, peripheral: CBPeripheral) {
        self.central = central
        self.peripheral = peripheral
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        central?.didDiscoverServices(for: peripheral, error: error)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        central?.didDiscoverCharacteristics(for: service, peripheral: peripheral, error: error)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        central?.didUpdateValue(for: characteristic, peripheral: peripheral, error: error)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        central?.didWriteValue(for: characteristic, peripheral: peripheral, error: error)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error = error {
            print("Notification state update error: \(error.localizedDescription)")
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didModifyServices invalidatedServices: [CBService]) {
        // Re-discover services if they were modified
        peripheral.discoverServices([BuildItBLEConstants.serviceUUID])
    }
}

// MARK: - BLE Authentication Notifications

extension Notification.Name {
    /// Posted when a BLE peer completes mutual authentication.
    /// UserInfo contains "peerID" (UUID) and "pubkey" (String).
    static let bleAuthenticationCompleted = Notification.Name("com.buildit.ble.auth.completed")

    /// Posted when a BLE peer fails authentication.
    /// UserInfo contains "peerID" (UUID) and "error" (String).
    static let bleAuthenticationFailed = Notification.Name("com.buildit.ble.auth.failed")
}
