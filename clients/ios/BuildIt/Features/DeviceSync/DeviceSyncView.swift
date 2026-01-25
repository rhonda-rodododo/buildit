// DeviceSyncView.swift
// BuildIt - Decentralized Mesh Communication
//
// Device synchronization interface for managing connected devices
// and syncing data between them.

import SwiftUI

/// Main device sync view
struct DeviceSyncView: View {
    @StateObject private var viewModel = DeviceSyncViewModel()
    @State private var showAddDevice = false

    var body: some View {
        NavigationStack {
            List {
                // Current device section
                Section {
                    CurrentDeviceRow(viewModel: viewModel)
                } header: {
                    Text("This Device")
                }

                // Synced devices section
                Section {
                    if viewModel.syncedDevices.isEmpty {
                        ContentUnavailableView {
                            Label("No Synced Devices", systemImage: "iphone.slash")
                        } description: {
                            Text("Add another device to sync your messages and keys.")
                        }
                        .listRowBackground(Color.clear)
                    } else {
                        ForEach(viewModel.syncedDevices) { device in
                            SyncedDeviceRow(device: device, viewModel: viewModel)
                        }
                        .onDelete { indexSet in
                            viewModel.removeDevices(at: indexSet)
                        }
                    }
                } header: {
                    Text("Synced Devices")
                }

                // Nearby devices section
                Section {
                    if viewModel.nearbyDevices.isEmpty {
                        HStack {
                            ProgressView()
                                .padding(.trailing, 8)
                            Text("Scanning for devices...")
                                .foregroundColor(.secondary)
                        }
                    } else {
                        ForEach(viewModel.nearbyDevices) { device in
                            NearbyDeviceRow(device: device) {
                                viewModel.pairDevice(device)
                            }
                        }
                    }
                } header: {
                    Text("Nearby Devices")
                } footer: {
                    Text("Devices running BuildIt within Bluetooth range will appear here.")
                }

                // Sync status section
                Section {
                    HStack {
                        Text("Last Sync")
                        Spacer()
                        if let lastSync = viewModel.lastSyncDate {
                            Text(lastSync.formatted(.relative(presentation: .named)))
                                .foregroundColor(.secondary)
                        } else {
                            Text("Never")
                                .foregroundColor(.secondary)
                        }
                    }

                    HStack {
                        Text("Pending Changes")
                        Spacer()
                        Text("\(viewModel.pendingChanges)")
                            .foregroundColor(.secondary)
                    }

                    Button {
                        Task {
                            await viewModel.syncNow()
                        }
                    } label: {
                        HStack {
                            if viewModel.isSyncing {
                                ProgressView()
                                    .padding(.trailing, 8)
                            }
                            Text(viewModel.isSyncing ? "Syncing..." : "Sync Now")
                        }
                    }
                    .disabled(viewModel.isSyncing || viewModel.syncedDevices.isEmpty)
                } header: {
                    Text("Sync Status")
                }
            }
            .navigationTitle("Devices")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddDevice = true
                    } label: {
                        Image(systemName: "plus.circle")
                    }
                }
            }
            .sheet(isPresented: $showAddDevice) {
                AddDeviceView(viewModel: viewModel)
            }
            .refreshable {
                await viewModel.refresh()
            }
            .onAppear {
                viewModel.startScanning()
            }
            .onDisappear {
                viewModel.stopScanning()
            }
        }
    }
}

/// Current device row
struct CurrentDeviceRow: View {
    @ObservedObject var viewModel: DeviceSyncViewModel

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "iphone")
                .font(.largeTitle)
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 4) {
                Text(viewModel.currentDeviceName)
                    .font(.headline)

                Text(viewModel.currentDeviceId.prefix(16) + "...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Circle()
                .fill(Color.green)
                .frame(width: 12, height: 12)
        }
    }
}

/// Synced device row
struct SyncedDeviceRow: View {
    let device: SyncedDevice
    @ObservedObject var viewModel: DeviceSyncViewModel

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: device.type.icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(device.name)
                    .font(.headline)

                HStack {
                    Circle()
                        .fill(device.isOnline ? Color.green : Color.gray)
                        .frame(width: 8, height: 8)

                    Text(device.isOnline ? "Online" : "Offline")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if let lastSeen = device.lastSeen {
                        Text("- \(lastSeen.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            if device.isSyncing {
                ProgressView()
            }
        }
        .contextMenu {
            Button {
                viewModel.syncDevice(device)
            } label: {
                Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
            }

            Button(role: .destructive) {
                viewModel.unpairDevice(device)
            } label: {
                Label("Remove Device", systemImage: "trash")
            }
        }
    }
}

/// Nearby device row
struct NearbyDeviceRow: View {
    let device: NearbyDevice
    let onPair: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "iphone.radiowaves.left.and.right")
                .font(.title2)
                .foregroundColor(.orange)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(device.name)
                    .font(.headline)

                Text("\(device.rssi) dBm")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Pair") {
                onPair()
            }
            .buttonStyle(.bordered)
        }
    }
}

/// Add device view for QR code pairing
struct AddDeviceView: View {
    @ObservedObject var viewModel: DeviceSyncViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var showScanner = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                // QR Code display
                VStack(spacing: 16) {
                    Text("Scan this code on your other device")
                        .font(.headline)

                    QRCodeView(content: viewModel.pairingCode)
                        .frame(width: 200, height: 200)
                        .padding()
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(radius: 4)
                }

                Divider()
                    .padding(.horizontal, 40)

                // Scan button
                VStack(spacing: 16) {
                    Text("Or scan a code from another device")
                        .font(.headline)

                    Button {
                        showScanner = true
                    } label: {
                        Label("Scan QR Code", systemImage: "qrcode.viewfinder")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.horizontal, 40)
                }

                Spacer()

                // Instructions
                VStack(alignment: .leading, spacing: 8) {
                    Label("Make sure Bluetooth is enabled on both devices", systemImage: "1.circle")
                    Label("Keep devices close together during pairing", systemImage: "2.circle")
                    Label("The pairing process will sync your encryption keys", systemImage: "3.circle")
                }
                .font(.caption)
                .foregroundColor(.secondary)
                .padding()
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding()
            }
            .navigationTitle("Add Device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showScanner) {
                QRCodeScannerView { code in
                    viewModel.processPairingCode(code)
                    showScanner = false
                    dismiss()
                }
            }
        }
    }
}

// MARK: - Models

/// Synced device model
struct SyncedDevice: Identifiable {
    let id: String
    let name: String
    let type: DeviceType
    let publicKey: String
    var isOnline: Bool
    var lastSeen: Date?
    var isSyncing: Bool = false

    enum DeviceType: String {
        case iPhone = "iphone"
        case iPad = "ipad"
        case mac = "laptopcomputer"
        case unknown = "questionmark.circle"

        var icon: String { rawValue }
    }
}

/// Nearby device model
struct NearbyDevice: Identifiable {
    let id: UUID
    let name: String
    let rssi: Int
    let peripheral: UUID
}

// MARK: - Preview

#Preview {
    DeviceSyncView()
}
