// SettingsView.swift
// BuildIt - Decentralized Mesh Communication
//
// Settings interface for app configuration and key management.

import SwiftUI

/// Main settings view
struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()

    var body: some View {
        NavigationStack {
            List {
                // Profile Section
                Section {
                    ProfileRow(viewModel: viewModel)
                } header: {
                    Text("Profile")
                }

                // Identity Section
                Section {
                    NavigationLink {
                        KeyManagementView(viewModel: viewModel)
                    } label: {
                        Label("Key Management", systemImage: "key")
                    }

                    NavigationLink {
                        QRCodeView(content: viewModel.npub ?? "")
                            .navigationTitle("Your QR Code")
                    } label: {
                        Label("Show QR Code", systemImage: "qrcode")
                    }
                } header: {
                    Text("Identity")
                }

                // Network Section
                Section {
                    NavigationLink {
                        RelaySettingsView(viewModel: viewModel)
                    } label: {
                        Label("Nostr Relays", systemImage: "antenna.radiowaves.left.and.right")
                    }

                    NavigationLink {
                        BLESettingsView(viewModel: viewModel)
                    } label: {
                        Label("BLE Mesh", systemImage: "point.3.connected.trianglepath.dotted")
                    }

                    Picker("Preferred Transport", selection: $viewModel.preferredTransport) {
                        ForEach(TransportType.allCases, id: \.self) { transport in
                            Text(transport.rawValue).tag(transport)
                        }
                    }
                    NavigationLink {
                        FederationSettingsView()
                    } label: {
                        Label("Federation", systemImage: "globe")
                    }
                } header: {
                    Text("Network")
                }

                // Security Section
                Section {
                    Toggle("Require Biometrics", isOn: $viewModel.requireBiometrics)
                        .accessibilityHint("When enabled, Face ID or Touch ID is required to access the app")

                    Toggle("Show Notifications", isOn: $viewModel.showNotifications)
                        .accessibilityHint("When enabled, you will receive push notifications for new messages")
                } header: {
                    Text("Security & Privacy")
                        .accessibilityAddTraits(.isHeader)
                }

                // Data Section
                Section {
                    Button(role: .destructive) {
                        viewModel.showClearDataAlert = true
                    } label: {
                        Label("Clear All Data", systemImage: "trash")
                    }
                    .accessibilityHint("Warning: This will permanently delete all messages and settings")
                } header: {
                    Text("Data")
                        .accessibilityAddTraits(.isHeader)
                }

                // About Section
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(viewModel.appVersion)
                            .foregroundColor(.secondary)
                    }

                    Link(destination: URL(string: "https://github.com/buildit")!) {
                        Label("GitHub", systemImage: "link")
                    }
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Settings")
            .alert("Clear All Data", isPresented: $viewModel.showClearDataAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Clear", role: .destructive) {
                    viewModel.clearAllData()
                }
            } message: {
                Text("This will delete all messages, contacts, and settings. This cannot be undone.")
            }
        }
    }
}

/// Profile row with public key info
struct ProfileRow: View {
    @ObservedObject var viewModel: SettingsViewModel

    var body: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(Color.blue.opacity(0.2))
                .frame(width: 60, height: 60)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.title)
                        .foregroundColor(.blue)
                }
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                if let npub = viewModel.npub {
                    Text(String(npub.prefix(24)) + "...")
                        .font(.headline)
                        .lineLimit(1)
                } else {
                    Text("No Identity")
                        .font(.headline)
                        .foregroundColor(.secondary)
                }

                Text("Tap to copy")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if let npub = viewModel.npub {
                SecureClipboard.copy(npub)
                viewModel.showCopiedToast = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(viewModel.npub != nil ? "Your public key" : "No identity configured")
        .accessibilityValue(viewModel.npub != nil ? "Tap to copy" : "")
        .accessibilityHint(viewModel.npub != nil ? "Double tap to copy your public key to clipboard" : "")
        .accessibilityAddTraits(.isButton)
    }
}

/// Key management view
struct KeyManagementView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @State private var showImportKey = false
    @State private var importKeyText = ""

    var body: some View {
        List {
            Section {
                if let publicKey = viewModel.publicKeyHex {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Public Key")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(publicKey)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    .padding(.vertical, 4)
                }

                if let npub = viewModel.npub {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("npub")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(npub)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Current Identity")
            }

            Section {
                Button {
                    Task {
                        await viewModel.generateNewKeyPair()
                    }
                } label: {
                    Label("Generate New Key Pair", systemImage: "plus.circle")
                }

                Button {
                    showImportKey = true
                } label: {
                    Label("Import Key (nsec)", systemImage: "square.and.arrow.down")
                }
            } header: {
                Text("Actions")
            } footer: {
                Text("Warning: Generating a new key pair will replace your current identity.")
            }

            if viewModel.hasSecureEnclave {
                Section {
                    HStack {
                        Image(systemName: "checkmark.shield.fill")
                            .foregroundColor(.green)
                        Text("Secure Enclave Available")
                    }

                    Text("Your keys are protected by the Secure Enclave, providing hardware-level security.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } header: {
                    Text("Hardware Security")
                }
            }
        }
        .navigationTitle("Key Management")
        .alert("Import Key", isPresented: $showImportKey) {
            TextField("nsec1...", text: $importKeyText)
                .autocapitalization(.none)

            Button("Cancel", role: .cancel) {
                importKeyText = ""
            }

            Button("Import") {
                Task {
                    await viewModel.importKey(importKeyText)
                    importKeyText = ""
                }
            }
        } message: {
            Text("Enter your nsec private key to import an existing identity.")
        }
    }
}

/// Relay settings view
struct RelaySettingsView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @State private var newRelayURL = ""
    @State private var showAddRelay = false

    var body: some View {
        List {
            Section {
                ForEach(viewModel.relays) { relay in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(relay.url)
                                .font(.subheadline)

                            HStack(spacing: 8) {
                                if relay.isReadable {
                                    Label("Read", systemImage: "arrow.down.circle")
                                        .font(.caption2)
                                        .foregroundColor(.green)
                                }
                                if relay.isWritable {
                                    Label("Write", systemImage: "arrow.up.circle")
                                        .font(.caption2)
                                        .foregroundColor(.blue)
                                }
                            }
                        }

                        Spacer()

                        Toggle("", isOn: Binding(
                            get: { relay.isEnabled },
                            set: { viewModel.toggleRelay(relay.url, enabled: $0) }
                        ))
                    }
                }
                .onDelete { indexSet in
                    viewModel.deleteRelays(at: indexSet)
                }
            } header: {
                Text("Connected Relays")
            }

            Section {
                Button {
                    showAddRelay = true
                } label: {
                    Label("Add Relay", systemImage: "plus.circle")
                }
            }
        }
        .navigationTitle("Nostr Relays")
        .alert("Add Relay", isPresented: $showAddRelay) {
            TextField("wss://relay.example.com", text: $newRelayURL)
                .autocapitalization(.none)

            Button("Cancel", role: .cancel) {
                newRelayURL = ""
            }

            Button("Add") {
                viewModel.addRelay(newRelayURL)
                newRelayURL = ""
            }
        }
    }
}

/// BLE settings view
struct BLESettingsView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @EnvironmentObject var bleManager: BLEManager

    var body: some View {
        List {
            Section {
                HStack {
                    Text("Bluetooth Status")
                    Spacer()
                    if bleManager.isBluetoothEnabled {
                        Label("Enabled", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else {
                        Label("Disabled", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                }

                HStack {
                    Text("Connection State")
                    Spacer()
                    Text(connectionStateText)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Connected Peers")
                    Spacer()
                    Text("\(bleManager.connectedPeers.count)")
                        .foregroundColor(.secondary)
                }
            } header: {
                Text("Status")
            }

            Section {
                Toggle("Auto-connect", isOn: $viewModel.bleAutoConnect)

                Toggle("Background Mode", isOn: $viewModel.bleBackgroundMode)
            } header: {
                Text("Settings")
            }

            Section {
                ForEach(bleManager.discoveredPeers) { peer in
                    HStack {
                        Circle()
                            .fill(peer.isConnected ? Color.green : Color.gray)
                            .frame(width: 8, height: 8)

                        Text(peer.identifier)
                            .font(.subheadline)

                        Spacer()

                        Text("\(peer.rssi) dBm")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } header: {
                Text("Nearby Devices")
            }
        }
        .navigationTitle("BLE Mesh")
    }

    private var connectionStateText: String {
        switch bleManager.connectionState {
        case .disconnected: return "Disconnected"
        case .scanning: return "Scanning..."
        case .connecting: return "Connecting..."
        case .connected: return "Connected"
        case .advertising: return "Advertising"
        }
    }
}

// MARK: - Preview

#Preview {
    SettingsView()
        .environmentObject(BLEManager.shared)
}
