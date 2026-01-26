// SyncStatusIndicator.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI view showing sync status, pending items count,
// last sync time, and error states.

import SwiftUI
import Combine

/// Compact sync status indicator for navigation bars
struct SyncStatusIndicator: View {
    @ObservedObject private var syncManager = SyncManager.shared

    var body: some View {
        HStack(spacing: 6) {
            statusIcon
                .foregroundColor(statusColor)
                .font(.system(size: 14))

            if syncManager.pendingCount > 0 {
                Text("\(syncManager.pendingCount)")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(statusColor))
            }
        }
        .onTapGesture {
            Task {
                await syncManager.triggerSync()
            }
        }
    }

    private var statusIcon: some View {
        Group {
            switch syncManager.syncStatus {
            case .idle:
                Image(systemName: "checkmark.circle.fill")
            case .syncing:
                Image(systemName: "arrow.triangle.2.circlepath")
                    .rotationEffect(.degrees(syncManager.isSyncing ? 360 : 0))
                    .animation(
                        syncManager.isSyncing
                            ? .linear(duration: 1).repeatForever(autoreverses: false)
                            : .default,
                        value: syncManager.isSyncing
                    )
            case .completed:
                Image(systemName: "checkmark.circle.fill")
            case .error:
                Image(systemName: "exclamationmark.triangle.fill")
            case .offline:
                Image(systemName: "wifi.slash")
            }
        }
    }

    private var statusColor: Color {
        switch syncManager.syncStatus {
        case .idle, .completed:
            return .green
        case .syncing:
            return .blue
        case .error:
            return .orange
        case .offline:
            return .gray
        }
    }
}

/// Detailed sync status view for settings or dedicated sync screen
struct SyncStatusDetailView: View {
    @ObservedObject private var syncManager = SyncManager.shared
    @State private var showPendingOperations = false

    var body: some View {
        VStack(spacing: 16) {
            // Status Card
            statusCard

            // Quick Actions
            quickActions

            // Pending Operations
            if syncManager.pendingCount > 0 {
                pendingOperationsSection
            }

            // Conflicts
            if !syncManager.conflicts.isEmpty {
                conflictsSection
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Sync Status")
    }

    private var statusCard: some View {
        VStack(spacing: 12) {
            // Network Status
            HStack {
                Image(systemName: networkIcon)
                    .foregroundColor(networkColor)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(syncManager.networkState.description)
                        .font(.headline)
                    Text(networkDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)

            // Sync Status
            HStack {
                syncStatusIcon
                    .foregroundColor(syncStatusColor)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(syncManager.syncStatus.description)
                        .font(.headline)
                    if let lastSync = syncManager.lastSyncTime {
                        Text("Last sync: \(lastSync.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                if case .syncing(let progress, _) = syncManager.syncStatus {
                    ProgressView(value: progress)
                        .progressViewStyle(.circular)
                        .scaleEffect(0.8)
                }
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
        }
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            Button(action: {
                Task {
                    await syncManager.triggerSync()
                }
            }) {
                Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(!syncManager.networkState.isConnected || syncManager.isSyncing)

            Button(action: {
                showPendingOperations.toggle()
            }) {
                Label("View Queue", systemImage: "list.bullet")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }

    private var pendingOperationsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Pending Operations")
                    .font(.headline)
                Spacer()
                Text("\(syncManager.pendingCount)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Text("These items will sync when you're back online.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }

    private var conflictsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                Text("Sync Conflicts")
                    .font(.headline)
                Spacer()
                Text("\(syncManager.conflicts.count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            ForEach(syncManager.conflicts) { conflict in
                ConflictRowView(conflict: conflict)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }

    // MARK: - Helper Properties

    private var networkIcon: String {
        switch syncManager.networkState {
        case .wifi:
            return "wifi"
        case .cellular:
            return "antenna.radiowaves.left.and.right"
        case .offline:
            return "wifi.slash"
        case .unknown:
            return "questionmark.circle"
        }
    }

    private var networkColor: Color {
        syncManager.networkState.isConnected ? .green : .gray
    }

    private var networkDescription: String {
        switch syncManager.networkState {
        case .wifi:
            return "Connected via WiFi"
        case .cellular:
            return "Connected via cellular"
        case .offline:
            return "No internet connection"
        case .unknown:
            return "Checking connection..."
        }
    }

    private var syncStatusIcon: some View {
        Group {
            switch syncManager.syncStatus {
            case .idle:
                Image(systemName: "checkmark.circle.fill")
            case .syncing:
                Image(systemName: "arrow.triangle.2.circlepath")
            case .completed:
                Image(systemName: "checkmark.circle.fill")
            case .error:
                Image(systemName: "exclamationmark.triangle.fill")
            case .offline:
                Image(systemName: "cloud.slash")
            }
        }
    }

    private var syncStatusColor: Color {
        switch syncManager.syncStatus {
        case .idle, .completed:
            return .green
        case .syncing:
            return .blue
        case .error:
            return .orange
        case .offline:
            return .gray
        }
    }
}

/// Row view for displaying a sync conflict
struct ConflictRowView: View {
    let conflict: SyncConflict
    @ObservedObject private var syncManager = SyncManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(conflict.operationType.rawValue.capitalized)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                Text(conflict.localTimestamp.formatted(.relative(presentation: .named)))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 8) {
                Button("Keep Local") {
                    Task {
                        try? await syncManager.resolveConflict(conflict.id, resolution: .clientWins)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .controlSize(.small)

                Button("Keep Server") {
                    Task {
                        try? await syncManager.resolveConflict(conflict.id, resolution: .serverWins)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button("Merge") {
                    Task {
                        try? await syncManager.resolveConflict(conflict.id, resolution: .merge)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(8)
        .background(Color(.tertiarySystemBackground))
        .cornerRadius(8)
    }
}

/// Banner view for showing sync status at top of screens
struct SyncStatusBanner: View {
    @ObservedObject private var syncManager = SyncManager.shared
    @State private var isExpanded = false

    var body: some View {
        if shouldShowBanner {
            VStack(spacing: 0) {
                HStack {
                    bannerIcon
                        .foregroundColor(bannerColor)

                    Text(bannerText)
                        .font(.subheadline)
                        .foregroundColor(bannerColor)

                    Spacer()

                    if syncManager.pendingCount > 0 {
                        Text("\(syncManager.pendingCount) pending")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if case .error = syncManager.syncStatus {
                        Button("Retry") {
                            Task {
                                await syncManager.triggerSync()
                            }
                        }
                        .font(.caption)
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(bannerBackground)
            }
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.spring(response: 0.3), value: shouldShowBanner)
        }
    }

    private var shouldShowBanner: Bool {
        switch syncManager.syncStatus {
        case .offline, .error:
            return true
        case .syncing:
            return true
        default:
            return syncManager.pendingCount > 0
        }
    }

    private var bannerIcon: some View {
        Group {
            switch syncManager.syncStatus {
            case .offline:
                Image(systemName: "wifi.slash")
            case .syncing:
                Image(systemName: "arrow.triangle.2.circlepath")
            case .error:
                Image(systemName: "exclamationmark.triangle.fill")
            default:
                Image(systemName: "clock")
            }
        }
    }

    private var bannerText: String {
        switch syncManager.syncStatus {
        case .offline:
            return "You're offline"
        case .syncing(_, let message):
            return message
        case .error(let message):
            return message
        default:
            return "Pending changes"
        }
    }

    private var bannerColor: Color {
        switch syncManager.syncStatus {
        case .offline:
            return .gray
        case .syncing:
            return .blue
        case .error:
            return .orange
        default:
            return .secondary
        }
    }

    private var bannerBackground: Color {
        switch syncManager.syncStatus {
        case .offline:
            return Color.gray.opacity(0.1)
        case .syncing:
            return Color.blue.opacity(0.1)
        case .error:
            return Color.orange.opacity(0.1)
        default:
            return Color.secondary.opacity(0.1)
        }
    }
}

// MARK: - Preview Provider

#Preview("Sync Status Indicator") {
    SyncStatusIndicator()
        .padding()
}

#Preview("Sync Status Detail") {
    NavigationStack {
        SyncStatusDetailView()
    }
}

#Preview("Sync Status Banner") {
    VStack {
        SyncStatusBanner()
        Spacer()
    }
}
