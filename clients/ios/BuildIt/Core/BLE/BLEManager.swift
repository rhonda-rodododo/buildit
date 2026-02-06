// BLEManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Central manager for Bluetooth Low Energy operations.
// Coordinates scanning, advertising, and mesh routing.
//
// SECURITY FEATURES:
// - Dynamic service UUID rotation (daily) to prevent tracking
// - Commitment-based identity (H(pubkey || nonce)) instead of exposing public keys
// - No public key in advertisements

import Foundation
import CoreBluetooth
import CryptoKit
import Combine
import os.log

/// Service UUID rotation interval in seconds (24 hours)
private let uuidRotationIntervalSecs: UInt64 = 86400

/// Well-known seed for UUID derivation (all BuildIt nodes use this)
private let uuidDerivationSeed = "BuildItNetwork-BLE-UUID-Seed-v1".data(using: .utf8)!

/// Generate the current service UUID based on daily rotation
///
/// SECURITY: All BuildIt nodes derive the same UUID for a given day, allowing
/// discovery while preventing long-term device tracking via static UUIDs.
func getCurrentServiceUUID() -> CBUUID {
    // Get current day (UTC) as the rotation epoch
    let now = UInt64(Date().timeIntervalSince1970)
    let dayEpoch = now / uuidRotationIntervalSecs

    // Derive UUID from seed and day
    var hasher = SHA256()
    hasher.update(data: uuidDerivationSeed)
    withUnsafeBytes(of: dayEpoch.littleEndian) { hasher.update(bufferPointer: $0) }
    let hash = hasher.finalize()

    // Use first 16 bytes of hash as UUID, but keep the version/variant bits valid
    var uuidBytes = Array(hash.prefix(16))

    // Set version 4 (random) and variant 1 (RFC 4122)
    uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40 // Version 4
    uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80 // Variant 1

    let uuidString = uuidBytes.enumerated().map { index, byte -> String in
        let hex = String(format: "%02x", byte)
        switch index {
        case 4, 6, 8, 10: return "-" + hex
        default: return hex
        }
    }.joined()

    return CBUUID(string: uuidString)
}

/// Get characteristic UUIDs based on current service UUID
func getMessageCharacteristicUUID() -> CBUUID {
    // Derive from service UUID with offset
    let service = getCurrentServiceUUID()
    // For simplicity, use a static offset pattern
    return CBUUID(string: service.uuidString.replacingOccurrences(of: "-0000-", with: "-0001-"))
}

func getIdentityCharacteristicUUID() -> CBUUID {
    let service = getCurrentServiceUUID()
    return CBUUID(string: service.uuidString.replacingOccurrences(of: "-0000-", with: "-0002-"))
}

func getHandshakeCharacteristicUUID() -> CBUUID {
    let service = getCurrentServiceUUID()
    return CBUUID(string: service.uuidString.replacingOccurrences(of: "-0000-", with: "-0003-"))
}

func getRoutingCharacteristicUUID() -> CBUUID {
    let service = getCurrentServiceUUID()
    return CBUUID(string: service.uuidString.replacingOccurrences(of: "-0000-", with: "-0004-"))
}

/// DEPRECATED: Legacy static UUIDs - DO NOT USE
/// These expose users to long-term tracking
enum BuildItBLEConstants {
    @available(*, deprecated, message: "Use getCurrentServiceUUID() for rotating UUIDs")
    static let serviceUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef0")

    @available(*, deprecated, message: "Use getMessageCharacteristicUUID() for rotating UUIDs")
    static let messageCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef1")

    @available(*, deprecated, message: "Use getIdentityCharacteristicUUID() for rotating UUIDs")
    static let identityCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef2")

    @available(*, deprecated, message: "Use getRoutingCharacteristicUUID() for rotating UUIDs")
    static let routingCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef3")

    @available(*, deprecated, message: "Use getHandshakeCharacteristicUUID() for rotating UUIDs")
    static let handshakeCharacteristicUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef4")

    /// Maximum message size for BLE transfer (negotiated MTU - 3)
    static let maxMessageSize = 512

    /// Scan interval in seconds
    static let scanInterval: TimeInterval = 10.0

    /// Scan duration in seconds
    static let scanDuration: TimeInterval = 5.0
}

/// Identity commitment for BLE advertisement
///
/// SECURITY: We advertise H(pubkey || nonce) instead of the actual pubkey.
/// The nonce is revealed after connection establishment.
struct IdentityCommitment {
    /// SHA256(pubkey || nonce), first 20 bytes (fits in BLE advertisement)
    let commitment: Data
    /// Nonce used in commitment (revealed after connection)
    let nonce: Data
    /// Our actual public key (never transmitted in advertisements)
    let pubkey: String

    init(pubkey: String) {
        var nonceBytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, 16, &nonceBytes)
        self.nonce = Data(nonceBytes)

        var hasher = SHA256()
        hasher.update(data: Data(pubkey.utf8))
        hasher.update(data: nonce)
        let hash = hasher.finalize()

        self.commitment = Data(hash.prefix(20))
        self.pubkey = pubkey
    }

    /// Verify a commitment against a pubkey and nonce
    static func verify(commitment: Data, pubkey: String, nonce: Data) -> Bool {
        var hasher = SHA256()
        hasher.update(data: Data(pubkey.utf8))
        hasher.update(data: nonce)
        let hash = hasher.finalize()
        return Data(hash.prefix(commitment.count)) == commitment
    }

    /// Get the commitment bytes for advertisement (max 20 bytes)
    var advertisementData: Data {
        commitment
    }
}

/// Represents a discovered peer device
struct DiscoveredPeer: Identifiable, Hashable {
    let id: UUID
    let identifier: String
    let rssi: Int
    var lastSeen: Date
    var isConnected: Bool
    var peripheral: CBPeripheral?
    /// Identity commitment from advertisement (NOT the actual pubkey)
    var identityCommitment: Data?
    /// Verified public key (only after successful handshake)
    var verifiedPubkey: String?

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
    case handshaking
    case authenticated
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
    @Published private(set) var currentServiceUUID: CBUUID

    // MARK: - Private Properties

    private var centralManager: CBCentralManager!
    private var peripheralManager: CBPeripheralManager!
    private let bleCentral: BLECentral
    private let blePeripheral: BLEPeripheral
    private let meshRouter: MeshRouter

    private var scanTimer: Timer?
    private var cleanupTimer: Timer?
    private var uuidRotationTimer: Timer?
    private let logger = Logger(subsystem: "com.buildit", category: "BLEManager")

    private var cancellables = Set<AnyCancellable>()

    /// Our identity commitment for advertisement
    private var ourCommitment: IdentityCommitment?

    /// Last known service UUID (for rotation detection)
    private var lastServiceUUID: CBUUID

    /// Authenticator for BLE peer verification
    private let authenticator = BLEAuthenticator.shared

    // MARK: - Initialization

    private override init() {
        self.bleCentral = BLECentral()
        self.blePeripheral = BLEPeripheral()
        self.meshRouter = MeshRouter.shared
        self.currentServiceUUID = getCurrentServiceUUID()
        self.lastServiceUUID = self.currentServiceUUID

        super.init()

        setupManagers()
        setupBindings()
        setupAuthNotifications()
        startCleanupTimer()
        startUUIDRotationTimer()
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

    private func setupAuthNotifications() {
        // Listen for authentication completion
        NotificationCenter.default.publisher(for: .bleAuthenticationCompleted)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self = self,
                      let peerID = notification.userInfo?["peerID"] as? UUID,
                      let pubkey = notification.userInfo?["pubkey"] as? String else { return }

                self.handleAuthenticationSuccess(peerID: peerID, pubkey: pubkey)
            }
            .store(in: &cancellables)

        // Listen for authentication failures
        NotificationCenter.default.publisher(for: .bleAuthenticationFailed)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self = self,
                      let peerID = notification.userInfo?["peerID"] as? UUID,
                      let error = notification.userInfo?["error"] as? String else { return }

                self.handleAuthenticationFailure(peerID: peerID, error: error)
            }
            .store(in: &cancellables)
    }

    private func handleAuthenticationSuccess(peerID: UUID, pubkey: String) {
        // Update peer with verified pubkey
        if let index = connectedPeers.firstIndex(where: { $0.id == peerID }) {
            connectedPeers[index].verifiedPubkey = pubkey
        }

        connectionState = .authenticated
        logger.info("[AUTH] Peer \(peerID) authenticated with pubkey \(pubkey.prefix(16))...")
    }

    private func handleAuthenticationFailure(peerID: UUID, error: String) {
        // Remove the peer since authentication failed
        connectedPeers.removeAll { $0.id == peerID }
        discoveredPeers.removeAll { $0.id == peerID }

        lastError = "Authentication failed: \(error)"
        connectionState = connectedPeers.isEmpty ? .scanning : .connected

        logger.error("[AUTH] SECURITY: Peer \(peerID) failed authentication: \(error)")
    }

    private func startCleanupTimer() {
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.cleanupStalePeers()
            }
        }
    }

    private func startUUIDRotationTimer() {
        // Check for UUID rotation every hour
        uuidRotationTimer = Timer.scheduledTimer(withTimeInterval: 3600.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkUUIDRotation()
            }
        }
    }

    private func checkUUIDRotation() {
        let current = getCurrentServiceUUID()
        if current != lastServiceUUID {
            lastServiceUUID = current
            currentServiceUUID = current
            logger.info("Service UUID rotated to: \(current.uuidString)")

            // Restart scanning and advertising with new UUID
            if connectionState == .scanning {
                stopScanning()
                startScanning()
            }
            if connectionState == .advertising {
                stopAdvertising()
                startAdvertising()
            }
        }
    }

    // MARK: - Identity Management

    /// Set our identity for commitment-based advertisement
    func setIdentity(pubkey: String) {
        ourCommitment = IdentityCommitment(pubkey: pubkey)
        logger.info("Identity commitment created for BLE")

        // Update advertising if active
        if connectionState == .advertising {
            stopAdvertising()
            startAdvertising()
        }
    }

    /// Get our identity commitment for advertisement
    func getAdvertisementData() -> Data? {
        ourCommitment?.advertisementData
    }

    // MARK: - Public Methods

    /// Start scanning for nearby BuildIt devices
    func startScanning() {
        guard centralManager.state == .poweredOn else {
            logger.warning("Cannot scan: Bluetooth not powered on")
            return
        }

        connectionState = .scanning
        let serviceUUID = getCurrentServiceUUID()
        bleCentral.startScanning(forService: serviceUUID)
        startScanTimer()

        logger.info("Started BLE scanning for service: \(serviceUUID.uuidString)")
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

        let serviceUUID = getCurrentServiceUUID()

        // Use commitment data instead of raw public key
        let advertisementData = ourCommitment?.advertisementData

        blePeripheral.startAdvertising(
            serviceUUID: serviceUUID,
            commitmentData: advertisementData
        )
        connectionState = .advertising

        logger.info("Started BLE advertising with service: \(serviceUUID.uuidString)")
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

    /// Check if a peer has been authenticated via the BLE handshake.
    ///
    /// Authentication happens automatically when a connection is established.
    /// The central initiates a signed challenge, the peripheral responds,
    /// and mutual authentication is verified before any messages are exchanged.
    func isPeerAuthenticated(_ peerID: UUID) -> Bool {
        authenticator.isAuthenticated(peerID)
    }

    /// Get the verified public key for an authenticated peer
    func getVerifiedPubkey(for peerID: UUID) -> String? {
        authenticator.getVerifiedPubkey(for: peerID)
    }

    /// Disconnect from a peer
    func disconnect(from peer: DiscoveredPeer) {
        guard let peripheral = peer.peripheral else { return }

        bleCentral.disconnect(from: peripheral)

        logger.info("Disconnecting from peer: \(peer.identifier)")
    }

    /// Send a message to a specific peer.
    /// The peer must have completed mutual authentication.
    func sendMessage(_ data: Data, to peerID: UUID) async throws {
        guard let peer = connectedPeers.first(where: { $0.id == peerID }),
              let peripheral = peer.peripheral else {
            throw BLEError.peerNotConnected
        }

        // Enforce authentication before allowing data exchange
        guard authenticator.isAuthenticated(peerID) else {
            logger.error("[AUTH] Refusing to send message to unauthenticated peer: \(peerID)")
            throw BLEError.peerNotAuthenticated
        }

        try await bleCentral.sendMessage(data, to: peripheral)
    }

    /// Broadcast a message to all connected and authenticated peers
    func broadcastMessage(_ data: Data) async throws {
        for peer in connectedPeers {
            // Only send to authenticated peers
            guard authenticator.isAuthenticated(peer.id),
                  let peripheral = peer.peripheral else {
                continue
            }
            try? await bleCentral.sendMessage(data, to: peripheral)
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
        uuidRotationTimer?.invalidate()

        for peer in connectedPeers {
            disconnect(from: peer)
        }

        // Clear all authentication state
        authenticator.reset()
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
            guard let self = self else { return }
            let serviceUUID = getCurrentServiceUUID()
            self.bleCentral.startScanning(forService: serviceUUID)
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
                    peripheral: peripheral,
                    identityCommitment: nil, // Will be extracted from service data
                    verifiedPubkey: nil
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
                peripheral: peripheral,
                identityCommitment: nil,
                verifiedPubkey: nil
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
                authenticator.reset()
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
        // Extract identity commitment from service data
        let serviceUUID = getCurrentServiceUUID()
        let commitmentData = (advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data])?[serviceUUID]

        bleCentral.handleDiscoveredPeripheral(
            peripheral,
            advertisementData: advertisementData,
            rssi: RSSI.intValue,
            commitmentData: commitmentData
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
            // Clear authentication state for this peer
            authenticator.peerDisconnected(peripheral.identifier)

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
                blePeripheral.setupServices(serviceUUID: getCurrentServiceUUID())
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
    case peerNotAuthenticated
    case messageTooLarge
    case sendFailed
    case characteristicNotFound
    case handshakeFailed
    case commitmentVerificationFailed
    case authenticationFailed(String)

    var errorDescription: String? {
        switch self {
        case .bluetoothNotAvailable:
            return "Bluetooth is not available"
        case .peerNotConnected:
            return "Peer is not connected"
        case .peerNotAuthenticated:
            return "Peer has not completed mutual authentication"
        case .messageTooLarge:
            return "Message exceeds maximum size"
        case .sendFailed:
            return "Failed to send message"
        case .characteristicNotFound:
            return "Required characteristic not found"
        case .handshakeFailed:
            return "Handshake failed - invalid data"
        case .commitmentVerificationFailed:
            return "Identity commitment verification failed"
        case .authenticationFailed(let reason):
            return "Authentication failed: \(reason)"
        }
    }
}
