// BLEPeripheral.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles BLE peripheral role operations including advertising
// and accepting connections from other BuildIt devices.

import Foundation
import CoreBluetooth
import Combine
import os.log

/// Manages BLE peripheral role operations
/// Responsible for advertising and accepting connections from other BuildIt devices
class BLEPeripheral: NSObject {
    // MARK: - Published Properties

    @Published private(set) var isAdvertising: Bool = false
    @Published private(set) var subscribedCentrals: [CBCentral] = []

    // MARK: - Private Properties

    private var peripheralManager: CBPeripheralManager?
    private var service: CBMutableService?
    private var messageCharacteristic: CBMutableCharacteristic?
    private var identityCharacteristic: CBMutableCharacteristic?
    private var routingCharacteristic: CBMutableCharacteristic?
    private var handshakeCharacteristic: CBMutableCharacteristic?

    private var pendingUpdates: [(CBCentral, Data)] = []
    private let logger = Logger(subsystem: "com.buildit", category: "BLEPeripheral")

    // MARK: - Configuration

    func configure(with manager: CBPeripheralManager) {
        self.peripheralManager = manager
    }

    // MARK: - Service Setup

    func setupServices() {
        guard let manager = peripheralManager, service == nil else { return }

        // Create characteristics
        messageCharacteristic = CBMutableCharacteristic(
            type: BuildItBLEConstants.messageCharacteristicUUID,
            properties: [.read, .write, .notify, .writeWithoutResponse],
            value: nil,
            permissions: [.readable, .writeable]
        )

        identityCharacteristic = CBMutableCharacteristic(
            type: BuildItBLEConstants.identityCharacteristicUUID,
            properties: [.read],
            value: nil,
            permissions: [.readable]
        )

        routingCharacteristic = CBMutableCharacteristic(
            type: BuildItBLEConstants.routingCharacteristicUUID,
            properties: [.read, .write, .notify],
            value: nil,
            permissions: [.readable, .writeable]
        )

        handshakeCharacteristic = CBMutableCharacteristic(
            type: BuildItBLEConstants.handshakeCharacteristicUUID,
            properties: [.read, .write],
            value: nil,
            permissions: [.readable, .writeable]
        )

        // Create service
        service = CBMutableService(
            type: BuildItBLEConstants.serviceUUID,
            primary: true
        )

        service?.characteristics = [
            messageCharacteristic!,
            identityCharacteristic!,
            routingCharacteristic!,
            handshakeCharacteristic!
        ]

        // Add service to peripheral manager
        manager.add(service!)

        logger.info("BuildIt service setup complete")
    }

    // MARK: - Advertising

    func startAdvertising() {
        guard let manager = peripheralManager,
              manager.state == .poweredOn,
              !isAdvertising else {
            return
        }

        let advertisementData: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [BuildItBLEConstants.serviceUUID],
            CBAdvertisementDataLocalNameKey: "BuildIt-\(getDeviceIdentifier())"
        ]

        manager.startAdvertising(advertisementData)
        isAdvertising = true

        logger.info("Started advertising BuildIt service")
    }

    func stopAdvertising() {
        peripheralManager?.stopAdvertising()
        isAdvertising = false

        logger.info("Stopped advertising")
    }

    // MARK: - Message Broadcasting

    func broadcastMessage(_ data: Data) {
        guard let characteristic = messageCharacteristic,
              let manager = peripheralManager,
              !subscribedCentrals.isEmpty else {
            return
        }

        let success = manager.updateValue(
            data,
            for: characteristic,
            onSubscribedCentrals: nil
        )

        if !success {
            // Queue for later if transmit queue is full
            for central in subscribedCentrals {
                pendingUpdates.append((central, data))
            }
        }

        logger.info("Broadcast message to \(subscribedCentrals.count) centrals")
    }

    func sendMessage(_ data: Data, to central: CBCentral) {
        guard let characteristic = messageCharacteristic,
              let manager = peripheralManager else {
            return
        }

        let success = manager.updateValue(
            data,
            for: characteristic,
            onSubscribedCentrals: [central]
        )

        if !success {
            pendingUpdates.append((central, data))
        }
    }

    // MARK: - Request Handling

    func handleSubscription(from central: CBCentral, to characteristic: CBCharacteristic) {
        if characteristic.uuid == BuildItBLEConstants.messageCharacteristicUUID {
            if !subscribedCentrals.contains(where: { $0.identifier == central.identifier }) {
                subscribedCentrals.append(central)
            }
            logger.info("Central subscribed: \(central.identifier)")
        }
    }

    func handleUnsubscription(from central: CBCentral, to characteristic: CBCharacteristic) {
        subscribedCentrals.removeAll { $0.identifier == central.identifier }
        logger.info("Central unsubscribed: \(central.identifier)")
    }

    func handleReadRequest(_ request: CBATTRequest) {
        guard let manager = peripheralManager else {
            return
        }

        switch request.characteristic.uuid {
        case BuildItBLEConstants.identityCharacteristicUUID:
            // Return our public key
            Task {
                if let publicKey = await CryptoManager.shared.getPublicKeyHex(),
                   let data = publicKey.data(using: .utf8) {
                    if request.offset > data.count {
                        manager.respond(to: request, withResult: .invalidOffset)
                        return
                    }
                    request.value = data.subdata(in: request.offset..<data.count)
                    manager.respond(to: request, withResult: .success)
                } else {
                    manager.respond(to: request, withResult: .unlikelyError)
                }
            }

        case BuildItBLEConstants.messageCharacteristicUUID:
            // Return any pending messages for this central
            if let pendingData = getPendingMessage(for: request.central) {
                if request.offset > pendingData.count {
                    manager.respond(to: request, withResult: .invalidOffset)
                    return
                }
                request.value = pendingData.subdata(in: request.offset..<pendingData.count)
                manager.respond(to: request, withResult: .success)
            } else {
                request.value = Data()
                manager.respond(to: request, withResult: .success)
            }

        case BuildItBLEConstants.routingCharacteristicUUID:
            // Return routing table information
            Task {
                let routingData = await MeshRouter.shared.getRoutingTableData()
                if request.offset > routingData.count {
                    manager.respond(to: request, withResult: .invalidOffset)
                    return
                }
                request.value = routingData.subdata(in: request.offset..<routingData.count)
                manager.respond(to: request, withResult: .success)
            }

        default:
            manager.respond(to: request, withResult: .attributeNotFound)
        }
    }

    func handleWriteRequests(_ requests: [CBATTRequest]) {
        guard let manager = peripheralManager else {
            return
        }

        for request in requests {
            guard let data = request.value else {
                manager.respond(to: request, withResult: .invalidAttributeValueLength)
                continue
            }

            switch request.characteristic.uuid {
            case BuildItBLEConstants.messageCharacteristicUUID:
                handleIncomingMessage(data, from: request.central)
                manager.respond(to: request, withResult: .success)

            case BuildItBLEConstants.handshakeCharacteristicUUID:
                handleHandshake(data, from: request.central)
                manager.respond(to: request, withResult: .success)

            case BuildItBLEConstants.routingCharacteristicUUID:
                handleRoutingUpdate(data, from: request.central)
                manager.respond(to: request, withResult: .success)

            default:
                manager.respond(to: request, withResult: .attributeNotFound)
            }
        }
    }

    func handleReadyToUpdateSubscribers() {
        // Send any pending updates
        guard let manager = peripheralManager,
              let characteristic = messageCharacteristic else {
            return
        }

        while !pendingUpdates.isEmpty {
            let (central, data) = pendingUpdates.removeFirst()

            let success = manager.updateValue(
                data,
                for: characteristic,
                onSubscribedCentrals: [central]
            )

            if !success {
                // Put back and stop trying
                pendingUpdates.insert((central, data), at: 0)
                break
            }
        }
    }

    // MARK: - Private Methods

    private func getDeviceIdentifier() -> String {
        // Return last 4 characters of device identifier
        let fullId = UIDevice.current.identifierForVendor?.uuidString ?? "UNKNOWN"
        return String(fullId.suffix(4))
    }

    private func getPendingMessage(for central: CBCentral) -> Data? {
        // Check if there are any pending messages for this central
        if let index = pendingUpdates.firstIndex(where: { $0.0.identifier == central.identifier }) {
            return pendingUpdates.remove(at: index).1
        }
        return nil
    }

    private func handleIncomingMessage(_ data: Data, from central: CBCentral) {
        logger.info("Received message from central: \(central.identifier), size: \(data.count)")

        Task {
            do {
                let message = try MeshMessage.decode(from: data)
                try await MeshRouter.shared.handleIncomingMessage(message, from: central.identifier)
            } catch {
                logger.error("Failed to handle message: \(error.localizedDescription)")
            }
        }
    }

    private func handleHandshake(_ data: Data, from central: CBCentral) {
        logger.info("Received handshake from central: \(central.identifier)")

        // Parse peer's public key from handshake
        if let publicKeyHex = String(data: data, encoding: .utf8) {
            Task {
                await MeshRouter.shared.registerPeer(central.identifier, publicKey: publicKeyHex)
            }
        }
    }

    private func handleRoutingUpdate(_ data: Data, from central: CBCentral) {
        logger.info("Received routing update from central: \(central.identifier)")

        Task {
            await MeshRouter.shared.handleRoutingUpdate(data, from: central.identifier)
        }
    }
}
