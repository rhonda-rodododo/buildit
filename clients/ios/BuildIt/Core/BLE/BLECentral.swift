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
    private let logger = Logger(subsystem: "com.buildit", category: "BLECentral")

    // Continuation for async message sending
    private var sendContinuations: [UUID: CheckedContinuation<Void, Error>] = [:]

    // MARK: - Configuration

    func configure(with manager: CBCentralManager) {
        self.centralManager = manager
    }

    // MARK: - Scanning

    func startScanning() {
        guard let manager = centralManager, manager.state == .poweredOn else {
            logger.warning("Cannot start scanning: Central manager not ready")
            return
        }

        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ]

        manager.scanForPeripherals(
            withServices: [BuildItBLEConstants.serviceUUID],
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
        rssi: Int
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
                // Read identity
                peripheral.readValue(for: characteristic)

            case BuildItBLEConstants.handshakeCharacteristicUUID:
                // Initiate handshake
                performHandshake(with: peripheral, characteristic: characteristic)

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
            handleReceivedMessage(data, from: peripheral)

        case BuildItBLEConstants.identityCharacteristicUUID:
            handleIdentity(data, from: peripheral)

        default:
            break
        }
    }

    func didWriteValue(for characteristic: CBCharacteristic, peripheral: CBPeripheral, error: Error?) {
        if let continuation = sendContinuations.removeValue(forKey: peripheral.identifier) {
            if let error = error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume()
            }
        }
    }

    // MARK: - Private Methods

    private func cleanupPeripheral(_ peripheral: CBPeripheral) {
        connectedPeripherals.removeAll { $0.identifier == peripheral.identifier }
        peripheralDelegates.removeValue(forKey: peripheral.identifier)
        messageCharacteristics.removeValue(forKey: peripheral.identifier)
        pendingMessages.removeValue(forKey: peripheral.identifier)
        sendContinuations.removeValue(forKey: peripheral.identifier)
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

    private func handleIdentity(_ data: Data, from peripheral: CBPeripheral) {
        // Parse peer identity (public key)
        logger.info("Received identity from: \(peripheral.identifier)")

        // Store identity for message routing
        if let publicKeyHex = String(data: data, encoding: .utf8) {
            Task {
                await MeshRouter.shared.registerPeer(peripheral.identifier, publicKey: publicKeyHex)
            }
        }
    }

    private func performHandshake(with peripheral: CBPeripheral, characteristic: CBCharacteristic) {
        // Send our identity for handshake
        Task {
            guard let publicKey = await CryptoManager.shared.getPublicKeyHex() else {
                logger.error("No public key available for handshake")
                return
            }

            if let data = publicKey.data(using: .utf8) {
                peripheral.writeValue(data, for: characteristic, type: .withResponse)
                logger.info("Initiated handshake with: \(peripheral.identifier)")
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
