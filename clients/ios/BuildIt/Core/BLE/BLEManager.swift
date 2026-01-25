// BLEManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Central manager for Bluetooth Low Energy operations.
// Coordinates scanning, advertising, and mesh routing.

import Foundation
import CoreBluetooth
import Combine
import os.log

/// Service and Characteristic UUIDs for BuildIt mesh protocol
enum BuildItBLEConstants {
    /// Main service UUID for BuildIt mesh communication
    static let serviceUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef0")

    /// Characteristic for sending/receiving mesh messages
    static let messageCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef1")

    /// Characteristic for device identification
    static let identityCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef2")

    /// Characteristic for mesh routing information
    static let routingCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef3")

    /// Characteristic for connection handshake
    static let handshakeCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef4")

    /// Maximum message size for BLE transfer (negotiated MTU - 3)
    static let maxMessageSize = 512

    /// Scan interval in seconds
    static let scanInterval: TimeInterval = 10.0

    /// Scan duration in seconds
    static let scanDuration: TimeInterval = 5.0
}

/// Represents a discovered peer device
struct DiscoveredPeer: Identifiable, Hashable {
    let id: UUID
    let identifier: String
    let rssi: Int
    var lastSeen: Date
    var isConnected: Bool
    var peripheral: CBPeripheral?

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: DiscoveredPeer, rhs: DiscoveredPeer) -> Bool {
        lhs.id == rhs.id
    }
}

/// Connection state for BLE operations
enum BLEConnectionState {
    case disconnected
    case scanning
    case connecting
    case connected
    case advertising
}

/// BLEManager coordinates all Bluetooth Low Energy operations
/// Acts as the central hub for mesh networking functionality
@MainActor
class BLEManager: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = BLEManager()

    // MARK: - Published Properties

    @Published private(set) var connectionState: BLEConnectionState = .disconnected
    @Published private(set) var discoveredPeers: [DiscoveredPeer] = []
    @Published private(set) var connectedPeers: [DiscoveredPeer] = []
    @Published private(set) var authorizationStatus: CBManagerAuthorization = .notDetermined
    @Published private(set) var isBluetoothEnabled: Bool = false
    @Published private(set) var lastError: String?

    // MARK: - Private Properties

    private var centralManager: CBCentralManager!
    private var peripheralManager: CBPeripheralManager!
    private let bleCentral: BLECentral
    private let blePeripheral: BLEPeripheral
    private let meshRouter: MeshRouter

    private var scanTimer: Timer?
    private var cleanupTimer: Timer?
    private let logger = Logger(subsystem: "com.buildit", category: "BLEManager")

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private override init() {
        self.bleCentral = BLECentral()
        self.blePeripheral = BLEPeripheral()
        self.meshRouter = MeshRouter.shared

        super.init()

        setupManagers()
        setupBindings()
        startCleanupTimer()
    }

    // MARK: - Setup

    private func setupManagers() {
        let options: [String: Any] = [
            CBCentralManagerOptionRestoreIdentifierKey: "com.buildit.central",
            CBCentralManagerOptionShowPowerAlertKey: true
        ]

        centralManager = CBCentralManager(
            delegate: self,
            queue: DispatchQueue(label: "com.buildit.ble.central"),
            options: options
        )

        let peripheralOptions: [String: Any] = [
            CBPeripheralManagerOptionRestoreIdentifierKey: "com.buildit.peripheral"
        ]

        peripheralManager = CBPeripheralManager(
            delegate: self,
            queue: DispatchQueue(label: "com.buildit.ble.peripheral"),
            options: peripheralOptions
        )

        bleCentral.configure(with: centralManager)
        blePeripheral.configure(with: peripheralManager)
    }

    private func setupBindings() {
        bleCentral.$discoveredPeripherals
            .receive(on: DispatchQueue.main)
            .sink { [weak self] peripherals in
                self?.updateDiscoveredPeers(from: peripherals)
            }
            .store(in: &cancellables)

        bleCentral.$connectedPeripherals
            .receive(on: DispatchQueue.main)
            .sink { [weak self] peripherals in
                self?.updateConnectedPeers(from: peripherals)
            }
            .store(in: &cancellables)
    }

    private func startCleanupTimer() {
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.cleanupStalePeers()
            }
        }
    }

    // MARK: - Public Methods

    /// Start scanning for nearby BuildIt devices
    func startScanning() {
        guard centralManager.state == .poweredOn else {
            logger.warning("Cannot scan: Bluetooth not powered on")
            return
        }

        connectionState = .scanning
        bleCentral.startScanning()
        startScanTimer()

        logger.info("Started BLE scanning")
    }

    /// Stop scanning for devices
    func stopScanning() {
        bleCentral.stopScanning()
        scanTimer?.invalidate()
        scanTimer = nil

        if connectionState == .scanning {
            connectionState = connectedPeers.isEmpty ? .disconnected : .connected
        }

        logger.info("Stopped BLE scanning")
    }

    /// Start advertising as a BuildIt device
    func startAdvertising() {
        guard peripheralManager.state == .poweredOn else {
            logger.warning("Cannot advertise: Bluetooth not powered on")
            return
        }

        blePeripheral.startAdvertising()
        connectionState = .advertising

        logger.info("Started BLE advertising")
    }

    /// Stop advertising
    func stopAdvertising() {
        blePeripheral.stopAdvertising()

        if connectionState == .advertising {
            connectionState = connectedPeers.isEmpty ? .disconnected : .connected
        }

        logger.info("Stopped BLE advertising")
    }

    /// Connect to a discovered peer
    func connect(to peer: DiscoveredPeer) {
        guard let peripheral = peer.peripheral else {
            logger.error("Cannot connect: No peripheral reference")
            return
        }

        connectionState = .connecting
        bleCentral.connect(to: peripheral)

        logger.info("Connecting to peer: \(peer.identifier)")
    }

    /// Disconnect from a peer
    func disconnect(from peer: DiscoveredPeer) {
        guard let peripheral = peer.peripheral else { return }

        bleCentral.disconnect(from: peripheral)

        logger.info("Disconnecting from peer: \(peer.identifier)")
    }

    /// Send a message to a specific peer
    func sendMessage(_ data: Data, to peerID: UUID) async throws {
        guard let peer = connectedPeers.first(where: { $0.id == peerID }),
              let peripheral = peer.peripheral else {
            throw BLEError.peerNotConnected
        }

        try await bleCentral.sendMessage(data, to: peripheral)
    }

    /// Broadcast a message to all connected peers
    func broadcastMessage(_ data: Data) async throws {
        for peer in connectedPeers {
            if let peripheral = peer.peripheral {
                try? await bleCentral.sendMessage(data, to: peripheral)
            }
        }

        // Also broadcast via peripheral manager for nearby devices
        blePeripheral.broadcastMessage(data)
    }

    /// Route a message through the mesh network
    func routeMessage(_ message: MeshMessage) async throws {
        try await meshRouter.routeMessage(message)
    }

    // MARK: - Background Mode

    func enterBackgroundMode() {
        // Reduce scan frequency but keep advertising
        stopScanning()
        if !connectedPeers.isEmpty {
            startAdvertising()
        }

        logger.info("Entered background mode")
    }

    func enterForegroundMode() {
        // Resume normal operations
        startScanning()
        startAdvertising()

        logger.info("Entered foreground mode")
    }

    func handleBackgroundLaunch() {
        // App was launched by system to handle BLE events
        logger.info("Handling background launch")
    }

    func performBackgroundSync() async {
        // Sync any pending messages with connected peers
        for peer in connectedPeers {
            if let peripheral = peer.peripheral {
                try? await bleCentral.syncWithPeer(peripheral)
            }
        }
    }

    func cleanup() {
        stopScanning()
        stopAdvertising()
        scanTimer?.invalidate()
        cleanupTimer?.invalidate()

        for peer in connectedPeers {
            disconnect(from: peer)
        }
    }

    // MARK: - Private Methods

    private func startScanTimer() {
        scanTimer?.invalidate()
        scanTimer = Timer.scheduledTimer(
            withTimeInterval: BuildItBLEConstants.scanInterval,
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                self?.performScanCycle()
            }
        }
    }

    private func performScanCycle() {
        guard connectionState == .scanning else { return }

        bleCentral.stopScanning()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.bleCentral.startScanning()
        }
    }

    private func updateDiscoveredPeers(from peripherals: [CBPeripheral]) {
        for peripheral in peripherals {
            if let index = discoveredPeers.firstIndex(where: { $0.id == peripheral.identifier }) {
                discoveredPeers[index].lastSeen = Date()
            } else {
                let peer = DiscoveredPeer(
                    id: peripheral.identifier,
                    identifier: peripheral.name ?? "Unknown",
                    rssi: -50, // Will be updated
                    lastSeen: Date(),
                    isConnected: false,
                    peripheral: peripheral
                )
                discoveredPeers.append(peer)
            }
        }
    }

    private func updateConnectedPeers(from peripherals: [CBPeripheral]) {
        connectedPeers = peripherals.compactMap { peripheral in
            DiscoveredPeer(
                id: peripheral.identifier,
                identifier: peripheral.name ?? "Unknown",
                rssi: -50,
                lastSeen: Date(),
                isConnected: true,
                peripheral: peripheral
            )
        }

        connectionState = connectedPeers.isEmpty ? .scanning : .connected
    }

    private func cleanupStalePeers() {
        let staleThreshold = Date().addingTimeInterval(-60)
        discoveredPeers.removeAll { peer in
            !peer.isConnected && peer.lastSeen < staleThreshold
        }
    }
}

// MARK: - CBCentralManagerDelegate

extension BLEManager: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            isBluetoothEnabled = central.state == .poweredOn
            authorizationStatus = CBCentralManager.authorization

            switch central.state {
            case .poweredOn:
                logger.info("Bluetooth is powered on")
                startScanning()
                startAdvertising()
            case .poweredOff:
                logger.warning("Bluetooth is powered off")
                connectionState = .disconnected
            case .unauthorized:
                logger.error("Bluetooth is unauthorized")
                lastError = "Bluetooth access not authorized"
            case .unsupported:
                logger.error("Bluetooth is unsupported")
                lastError = "Bluetooth not supported on this device"
            case .resetting:
                logger.info("Bluetooth is resetting")
            case .unknown:
                logger.info("Bluetooth state unknown")
            @unknown default:
                logger.warning("Unknown Bluetooth state")
            }
        }
    }

    nonisolated func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        bleCentral.handleDiscoveredPeripheral(
            peripheral,
            advertisementData: advertisementData,
            rssi: RSSI.intValue
        )
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        bleCentral.handleConnectedPeripheral(peripheral)

        Task { @MainActor in
            logger.info("Connected to peripheral: \(peripheral.identifier)")
            connectionState = .connected
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        bleCentral.handleDisconnectedPeripheral(peripheral)

        Task { @MainActor in
            logger.info("Disconnected from peripheral: \(peripheral.identifier)")
            if connectedPeers.isEmpty {
                connectionState = .scanning
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            logger.error("Failed to connect: \(error?.localizedDescription ?? "Unknown error")")
            lastError = error?.localizedDescription
            connectionState = .scanning
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        // Restore state after background wake
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
            for peripheral in peripherals {
                bleCentral.handleRestoredPeripheral(peripheral)
            }
        }
    }
}

// MARK: - CBPeripheralManagerDelegate

extension BLEManager: CBPeripheralManagerDelegate {
    nonisolated func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        Task { @MainActor in
            switch peripheral.state {
            case .poweredOn:
                logger.info("Peripheral manager powered on")
                blePeripheral.setupServices()
            case .poweredOff:
                logger.warning("Peripheral manager powered off")
            default:
                break
            }
        }
    }

    nonisolated func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error = error {
            Task { @MainActor in
                logger.error("Failed to add service: \(error.localizedDescription)")
            }
        }
    }

    nonisolated func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        if let error = error {
            Task { @MainActor in
                logger.error("Failed to start advertising: \(error.localizedDescription)")
            }
        }
    }

    nonisolated func peripheralManager(
        _ peripheral: CBPeripheralManager,
        central: CBCentral,
        didSubscribeTo characteristic: CBCharacteristic
    ) {
        blePeripheral.handleSubscription(from: central, to: characteristic)
    }

    nonisolated func peripheralManager(
        _ peripheral: CBPeripheralManager,
        didReceiveRead request: CBATTRequest
    ) {
        blePeripheral.handleReadRequest(request)
    }

    nonisolated func peripheralManager(
        _ peripheral: CBPeripheralManager,
        didReceiveWrite requests: [CBATTRequest]
    ) {
        blePeripheral.handleWriteRequests(requests)
    }

    nonisolated func peripheralManager(_ peripheral: CBPeripheralManager, willRestoreState dict: [String: Any]) {
        // Restore peripheral state after background wake
    }
}

// MARK: - BLE Errors

enum BLEError: LocalizedError {
    case bluetoothNotAvailable
    case peerNotConnected
    case messageTooLarge
    case sendFailed
    case characteristicNotFound

    var errorDescription: String? {
        switch self {
        case .bluetoothNotAvailable:
            return "Bluetooth is not available"
        case .peerNotConnected:
            return "Peer is not connected"
        case .messageTooLarge:
            return "Message exceeds maximum size"
        case .sendFailed:
            return "Failed to send message"
        case .characteristicNotFound:
            return "Required characteristic not found"
        }
    }
}
