// DeviceSyncViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// View model for device synchronization functionality.

import Foundation
import Combine
import UIKit
import os.log

/// View model for device sync operations
@MainActor
class DeviceSyncViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var syncedDevices: [SyncedDevice] = []
    @Published var nearbyDevices: [NearbyDevice] = []
    @Published var lastSyncDate: Date?
    @Published var pendingChanges: Int = 0
    @Published var isSyncing: Bool = false
    @Published var error: String?

    // MARK: - Computed Properties

    var currentDeviceName: String {
        UIDevice.current.name
    }

    var currentDeviceId: String {
        UIDevice.current.identifierForVendor?.uuidString ?? "Unknown"
    }

    var pairingCode: String {
        // Generate pairing code including device info and public key
        Task {
            if let publicKey = await CryptoManager.shared.getPublicKeyHex() {
                return "buildit://pair?device=\(currentDeviceId)&key=\(publicKey)"
            }
            return "buildit://pair?device=\(currentDeviceId)"
        }
        return "buildit://pair?device=\(currentDeviceId)"
    }

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "DeviceSyncViewModel")
    private var cancellables = Set<AnyCancellable>()
    private var isScanning = false

    // MARK: - Initialization

    init() {
        setupObservers()
        loadSyncedDevices()
    }

    private func setupObservers() {
        // Listen for BLE peer discoveries
        BLEManager.shared.$discoveredPeers
            .receive(on: DispatchQueue.main)
            .sink { [weak self] peers in
                self?.updateNearbyDevices(from: peers)
            }
            .store(in: &cancellables)

        // Listen for connection changes
        BLEManager.shared.$connectedPeers
            .receive(on: DispatchQueue.main)
            .sink { [weak self] peers in
                self?.updateSyncedDeviceStatus(from: peers)
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Start scanning for nearby devices
    func startScanning() {
        guard !isScanning else { return }
        isScanning = true
        BLEManager.shared.startScanning()
    }

    /// Stop scanning for nearby devices
    func stopScanning() {
        isScanning = false
        BLEManager.shared.stopScanning()
    }

    /// Refresh device list and sync status
    func refresh() async {
        loadSyncedDevices()
        await checkSyncStatus()
    }

    /// Sync all devices now
    func syncNow() async {
        isSyncing = true

        do {
            // Sync via BLE with all connected devices
            await BLEManager.shared.performBackgroundSync()

            // Sync via Nostr with registered devices
            await NostrClient.shared.performBackgroundSync()

            lastSyncDate = Date()
            pendingChanges = 0

            logger.info("Sync completed successfully")
        }

        isSyncing = false
    }

    /// Sync a specific device
    func syncDevice(_ device: SyncedDevice) {
        Task {
            var mutableDevice = device
            mutableDevice.isSyncing = true
            updateSyncedDevice(mutableDevice)

            // Find the peer and sync
            if let peer = BLEManager.shared.connectedPeers.first(where: { $0.id.uuidString == device.id }) {
                if let peripheral = peer.peripheral {
                    // Request sync from this device
                    let syncRequest = createSyncRequest()
                    if let data = syncRequest.data(using: .utf8) {
                        try? await BLEManager.shared.sendMessage(data, to: peer.id)
                    }
                }
            }

            mutableDevice.isSyncing = false
            mutableDevice.lastSeen = Date()
            updateSyncedDevice(mutableDevice)
        }
    }

    /// Pair with a nearby device
    func pairDevice(_ device: NearbyDevice) {
        Task {
            // Connect to the device
            if let peer = BLEManager.shared.discoveredPeers.first(where: { $0.id == device.peripheral }) {
                BLEManager.shared.connect(to: peer)

                // Wait for connection and handshake
                try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

                // Create synced device entry
                let syncedDevice = SyncedDevice(
                    id: device.id.uuidString,
                    name: device.name,
                    type: detectDeviceType(from: device.name),
                    publicKey: "", // Will be populated after handshake
                    isOnline: true,
                    lastSeen: Date()
                )

                saveSyncedDevice(syncedDevice)
                loadSyncedDevices()

                logger.info("Paired with device: \(device.name)")
            }
        }
    }

    /// Unpair a device
    func unpairDevice(_ device: SyncedDevice) {
        // Disconnect if connected
        if let peer = BLEManager.shared.connectedPeers.first(where: { $0.id.uuidString == device.id }) {
            BLEManager.shared.disconnect(from: peer)
        }

        // Remove from storage
        removeSyncedDevice(device.id)
        loadSyncedDevices()

        logger.info("Unpaired device: \(device.name)")
    }

    /// Remove devices at indices
    func removeDevices(at indexSet: IndexSet) {
        for index in indexSet {
            let device = syncedDevices[index]
            unpairDevice(device)
        }
    }

    /// Process a scanned pairing code
    func processPairingCode(_ code: String) {
        // Parse the pairing code
        guard let url = URL(string: code),
              url.scheme == "buildit",
              url.host == "pair",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            error = "Invalid pairing code"
            return
        }

        var deviceId: String?
        var publicKey: String?

        for item in queryItems {
            switch item.name {
            case "device":
                deviceId = item.value
            case "key":
                publicKey = item.value
            default:
                break
            }
        }

        guard let deviceId = deviceId else {
            error = "Missing device ID in pairing code"
            return
        }

        // Create synced device
        let device = SyncedDevice(
            id: deviceId,
            name: "Paired Device",
            type: .unknown,
            publicKey: publicKey ?? "",
            isOnline: false,
            lastSeen: nil
        )

        saveSyncedDevice(device)
        loadSyncedDevices()

        // Attempt to connect via BLE
        // The device will appear in nearby devices if it's in range

        logger.info("Processed pairing code for device: \(deviceId)")
    }

    // MARK: - Private Methods

    private func loadSyncedDevices() {
        // Load from UserDefaults or database
        if let data = UserDefaults.standard.data(forKey: "syncedDevices"),
           let devices = try? JSONDecoder().decode([SyncedDeviceStorage].self, from: data) {
            syncedDevices = devices.map { $0.toSyncedDevice() }
        }
    }

    private func saveSyncedDevice(_ device: SyncedDevice) {
        var devices = syncedDevices
        if let index = devices.firstIndex(where: { $0.id == device.id }) {
            devices[index] = device
        } else {
            devices.append(device)
        }

        let storage = devices.map { SyncedDeviceStorage(from: $0) }
        if let data = try? JSONEncoder().encode(storage) {
            UserDefaults.standard.set(data, forKey: "syncedDevices")
        }
    }

    private func removeSyncedDevice(_ id: String) {
        var devices = syncedDevices
        devices.removeAll { $0.id == id }

        let storage = devices.map { SyncedDeviceStorage(from: $0) }
        if let data = try? JSONEncoder().encode(storage) {
            UserDefaults.standard.set(data, forKey: "syncedDevices")
        }
    }

    private func updateSyncedDevice(_ device: SyncedDevice) {
        if let index = syncedDevices.firstIndex(where: { $0.id == device.id }) {
            syncedDevices[index] = device
        }
    }

    private func updateNearbyDevices(from peers: [DiscoveredPeer]) {
        nearbyDevices = peers
            .filter { peer in
                // Exclude already synced devices
                !syncedDevices.contains { $0.id == peer.id.uuidString }
            }
            .map { peer in
                NearbyDevice(
                    id: peer.id,
                    name: peer.identifier,
                    rssi: peer.rssi,
                    peripheral: peer.id
                )
            }
    }

    private func updateSyncedDeviceStatus(from peers: [DiscoveredPeer]) {
        for index in syncedDevices.indices {
            let deviceId = syncedDevices[index].id
            let isOnline = peers.contains { $0.id.uuidString == deviceId }
            syncedDevices[index].isOnline = isOnline
            if isOnline {
                syncedDevices[index].lastSeen = Date()
            }
        }
    }

    private func checkSyncStatus() async {
        // Count pending changes (messages not synced to other devices)
        pendingChanges = await MessageQueue.shared.pendingCount

        // Check last sync date from storage
        if let timestamp = UserDefaults.standard.object(forKey: "lastSyncDate") as? Date {
            lastSyncDate = timestamp
        }
    }

    private func createSyncRequest() -> String {
        let request: [String: Any] = [
            "type": "sync_request",
            "device": currentDeviceId,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]

        if let data = try? JSONSerialization.data(withJSONObject: request),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "{}"
    }

    private func detectDeviceType(from name: String) -> SyncedDevice.DeviceType {
        let lowercased = name.lowercased()
        if lowercased.contains("iphone") {
            return .iPhone
        } else if lowercased.contains("ipad") {
            return .iPad
        } else if lowercased.contains("mac") {
            return .mac
        }
        return .unknown
    }
}

// MARK: - Storage Model

private struct SyncedDeviceStorage: Codable {
    let id: String
    let name: String
    let type: String
    let publicKey: String
    let lastSeen: Date?

    init(from device: SyncedDevice) {
        self.id = device.id
        self.name = device.name
        self.type = device.type.rawValue
        self.publicKey = device.publicKey
        self.lastSeen = device.lastSeen
    }

    func toSyncedDevice() -> SyncedDevice {
        SyncedDevice(
            id: id,
            name: name,
            type: SyncedDevice.DeviceType(rawValue: type) ?? .unknown,
            publicKey: publicKey,
            isOnline: false,
            lastSeen: lastSeen
        )
    }
}
