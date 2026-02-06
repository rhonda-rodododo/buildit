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

    /// Authenticator for BLE peer verification
    private let authenticator = BLEAuthenticator.shared

    /// Pending handshake responses keyed by central identifier.
    /// When a central writes a challenge to the handshake characteristic, the
    /// peripheral verifies it and stores the signed response here. The central
    /// then reads the response from the handshake characteristic.
    private var pendingHandshakeResponses: [UUID: Data] = [:]

    /// Set of authenticated central identifiers
    private var authenticatedCentrals: Set<UUID> = []

    // MARK: - Configuration

    func configure(with manager: CBPeripheralManager) {
        self.peripheralManager = manager
    }

    // MARK: - Service Setup

    func setupServices(serviceUUID: CBUUID? = nil) {
        guard let manager = peripheralManager, service == nil else { return }

        let svcUUID = serviceUUID ?? BuildItBLEConstants.serviceUUID

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

        // Handshake characteristic supports read (for response retrieval),
        // write (for challenge submission), and notify (for async response)
        handshakeCharacteristic = CBMutableCharacteristic(
            type: BuildItBLEConstants.handshakeCharacteristicUUID,
            properties: [.read, .write, .notify],
            value: nil,
            permissions: [.readable, .writeable]
        )

        // Create service
        service = CBMutableService(
            type: svcUUID,
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

    func startAdvertising(serviceUUID: CBUUID? = nil, commitmentData: Data? = nil) {
        guard let manager = peripheralManager,
              manager.state == .poweredOn,
              !isAdvertising else {
            return
        }

        let svcUUID = serviceUUID ?? BuildItBLEConstants.serviceUUID

        var advertisementData: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [svcUUID],
            CBAdvertisementDataLocalNameKey: "BuildIt-\(getDeviceIdentifier())"
        ]

        // Include commitment data in service data if available
        if let commitment = commitmentData {
            advertisementData[CBAdvertisementDataServiceDataKey] = [svcUUID: commitment]
        }

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
        switch characteristic.uuid {
        case BuildItBLEConstants.messageCharacteristicUUID:
            // Only allow authenticated centrals to subscribe to messages
            guard authenticatedCentrals.contains(central.identifier) else {
                logger.warning("[AUTH] Rejecting message subscription from unauthenticated central: \(central.identifier)")
                return
            }
            if !subscribedCentrals.contains(where: { $0.identifier == central.identifier }) {
                subscribedCentrals.append(central)
            }
            logger.info("Authenticated central subscribed to messages: \(central.identifier)")

        case BuildItBLEConstants.handshakeCharacteristicUUID:
            // Handshake subscriptions are always allowed (needed for authentication)
            logger.info("Central subscribed to handshake: \(central.identifier)")

        default:
            logger.info("Central subscribed to characteristic: \(characteristic.uuid)")
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
            // Only serve identity to authenticated centrals
            guard authenticatedCentrals.contains(request.central.identifier) else {
                logger.warning("[AUTH] Rejecting identity read from unauthenticated central: \(request.central.identifier)")
                manager.respond(to: request, withResult: .insufficientAuthentication)
                return
            }
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
            // Only serve messages to authenticated centrals
            guard authenticatedCentrals.contains(request.central.identifier) else {
                logger.warning("[AUTH] Rejecting message read from unauthenticated central: \(request.central.identifier)")
                manager.respond(to: request, withResult: .insufficientAuthentication)
                return
            }
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

        case BuildItBLEConstants.handshakeCharacteristicUUID:
            // Return the pending handshake response for this central
            if let responseData = pendingHandshakeResponses[request.central.identifier] {
                if request.offset > responseData.count {
                    manager.respond(to: request, withResult: .invalidOffset)
                    return
                }
                request.value = responseData.subdata(in: request.offset..<responseData.count)
                manager.respond(to: request, withResult: .success)
                // Clear the pending response after it's been read
                pendingHandshakeResponses.removeValue(forKey: request.central.identifier)
                logger.info("[AUTH] Served handshake response to central: \(request.central.identifier)")
            } else {
                request.value = Data()
                manager.respond(to: request, withResult: .success)
            }

        case BuildItBLEConstants.routingCharacteristicUUID:
            // Only serve routing data to authenticated centrals
            guard authenticatedCentrals.contains(request.central.identifier) else {
                logger.warning("[AUTH] Rejecting routing read from unauthenticated central: \(request.central.identifier)")
                manager.respond(to: request, withResult: .insufficientAuthentication)
                return
            }
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
                // Only accept messages from authenticated centrals
                guard authenticatedCentrals.contains(request.central.identifier) else {
                    logger.warning("[AUTH] Rejecting message write from unauthenticated central: \(request.central.identifier)")
                    manager.respond(to: request, withResult: .insufficientAuthentication)
                    continue
                }
                handleIncomingMessage(data, from: request.central)
                manager.respond(to: request, withResult: .success)

            case BuildItBLEConstants.handshakeCharacteristicUUID:
                handleAuthenticatedHandshake(data, from: request.central, manager: manager, request: request)
                // Response is sent inside handleAuthenticatedHandshake

            case BuildItBLEConstants.routingCharacteristicUUID:
                // Only accept routing updates from authenticated centrals
                guard authenticatedCentrals.contains(request.central.identifier) else {
                    logger.warning("[AUTH] Rejecting routing write from unauthenticated central: \(request.central.identifier)")
                    manager.respond(to: request, withResult: .insufficientAuthentication)
                    continue
                }
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

    /// Handle an authenticated handshake challenge from a central (responder role).
    ///
    /// The central sends a signed challenge. We verify it, create a signed response,
    /// and store the response so the central can read it from the handshake characteristic.
    private func handleAuthenticatedHandshake(_ data: Data, from central: CBCentral, manager: CBPeripheralManager, request: CBATTRequest) {
        logger.info("[AUTH] Received handshake challenge from central: \(central.identifier)")

        Task {
            do {
                let (responseData, peerPubkey) = try await authenticator.verifyAndRespond(to: data, from: central.identifier)

                // Store the response for the central to read
                pendingHandshakeResponses[central.identifier] = responseData

                // Mark this central as authenticated
                authenticatedCentrals.insert(central.identifier)

                // Register the verified peer in the mesh router
                let commitment = MeshPeer.createCommitment(pubkey: peerPubkey)
                await MeshRouter.shared.registerPeer(central.identifier, commitment: commitment.commitment)
                _ = await MeshRouter.shared.verifyPeerIdentity(
                    central.identifier,
                    pubkey: peerPubkey,
                    nonce: commitment.nonce
                )

                logger.info("[AUTH] Authenticated central \(central.identifier), pubkey: \(peerPubkey.prefix(16))...")

                // Respond success to the write request
                manager.respond(to: request, withResult: .success)

                // Notify via the handshake characteristic that a response is available
                if let handshakeChar = handshakeCharacteristic {
                    manager.updateValue(responseData, for: handshakeChar, onSubscribedCentrals: [central])
                }

            } catch {
                logger.error("[AUTH] SECURITY: Handshake verification FAILED for central \(central.identifier): \(error.localizedDescription)")

                // Respond with authentication failure
                manager.respond(to: request, withResult: .insufficientAuthentication)
            }
        }
    }

    /// Remove authentication state when a central disconnects or unsubscribes
    func handleCentralDisconnected(_ centralID: UUID) {
        authenticatedCentrals.remove(centralID)
        pendingHandshakeResponses.removeValue(forKey: centralID)
        authenticator.peerDisconnected(centralID)
        logger.info("[AUTH] Cleared auth state for disconnected central: \(centralID)")
    }

    private func handleRoutingUpdate(_ data: Data, from central: CBCentral) {
        logger.info("Received routing update from central: \(central.identifier)")

        Task {
            await MeshRouter.shared.handleRoutingUpdate(data, from: central.identifier)
        }
    }
}
