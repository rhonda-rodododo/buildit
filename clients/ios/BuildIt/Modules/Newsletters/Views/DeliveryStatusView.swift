// DeliveryStatusView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for tracking newsletter sending progress and delivery status.

import SwiftUI

/// View showing detailed delivery status for an issue
public struct DeliveryStatusView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: DeliveryStatusViewModel

    public init(issueId: String, service: NewslettersService) {
        _viewModel = StateObject(wrappedValue: DeliveryStatusViewModel(
            issueId: issueId,
            service: service
        ))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress header if sending
                if let progress = viewModel.sendProgress, !progress.isComplete {
                    sendingProgressHeader(progress: progress)
                }

                // Status filter
                statusFilterBar

                // Delivery records list
                if viewModel.isLoading && viewModel.deliveryRecords.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.filteredRecords.isEmpty {
                    emptyState
                } else {
                    recordsList
                }
            }
            .navigationTitle("Delivery Status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        if viewModel.failedCount > 0 {
                            Button {
                                Task { await viewModel.retryFailed() }
                            } label: {
                                Label("Retry Failed (\(viewModel.failedCount))", systemImage: "arrow.clockwise")
                            }
                        }

                        Button {
                            Task { await viewModel.loadDeliveryRecords() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.triangle.2.circlepath")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .task {
                await viewModel.loadDeliveryRecords()
            }
        }
    }

    private func sendingProgressHeader(progress: BatchSendProgress) -> some View {
        VStack(spacing: 12) {
            HStack {
                Text("Sending in progress...")
                    .font(.headline)

                Spacer()

                Text("\(progress.sent + progress.failed)/\(progress.total)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            ProgressView(value: progress.progress)
                .progressViewStyle(.linear)

            HStack {
                Label("\(progress.sent) sent", systemImage: "checkmark.circle")
                    .foregroundColor(.green)

                Spacer()

                if progress.failed > 0 {
                    Label("\(progress.failed) failed", systemImage: "xmark.circle")
                        .foregroundColor(.red)
                }

                Spacer()

                if let eta = progress.estimatedCompletion {
                    Text("ETA: \(eta, style: .time)")
                        .foregroundColor(.secondary)
                }
            }
            .font(.caption)
        }
        .padding()
        .background(Color.accentColor.opacity(0.1))
    }

    private var statusFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                DeliveryFilterPill(
                    title: "All",
                    count: viewModel.deliveryRecords.count,
                    isSelected: viewModel.statusFilter == nil
                ) {
                    viewModel.statusFilter = nil
                }

                ForEach(DeliveryStatus.allCases, id: \.self) { status in
                    let count = viewModel.deliveryRecords.filter { $0.status == status }.count
                    if count > 0 {
                        DeliveryFilterPill(
                            title: status.displayName,
                            count: count,
                            isSelected: viewModel.statusFilter == status,
                            color: statusColor(status)
                        ) {
                            viewModel.statusFilter = status
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.systemGray6))
    }

    private var recordsList: some View {
        List {
            ForEach(viewModel.filteredRecords) { record in
                DeliveryRecordDetailRow(record: record)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.loadDeliveryRecords()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No delivery records")
                .font(.headline)

            if viewModel.statusFilter != nil {
                Text("Try selecting a different status filter")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Button("Show All") {
                    viewModel.statusFilter = nil
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func statusColor(_ status: DeliveryStatus) -> Color {
        switch status {
        case .pending: return .gray
        case .sending: return .blue
        case .delivered: return .green
        case .failed: return .red
        case .bounced: return .red
        case .opened: return .purple
        case .clicked: return .orange
        }
    }
}

/// Filter pill for delivery status
struct DeliveryFilterPill: View {
    let title: String
    let count: Int
    let isSelected: Bool
    var color: Color = .accentColor
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                Text("(\(count))")
                    .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
            }
            .font(.caption)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? color : Color(.systemBackground))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color.gray.opacity(0.3), lineWidth: isSelected ? 0 : 1)
            )
        }
    }
}

/// Detailed row for a delivery record
struct DeliveryRecordDetailRow: View {
    let record: DeliveryRecord

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Main row
            HStack(spacing: 12) {
                // Status icon
                ZStack {
                    Circle()
                        .fill(statusColor.opacity(0.2))
                        .frame(width: 36, height: 36)

                    Image(systemName: record.status.icon)
                        .foregroundColor(statusColor)
                }

                // Recipient info
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if record.status == .failed || record.status == .bounced {
                        if let error = record.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                                .lineLimit(isExpanded ? nil : 1)
                        }
                    }
                }

                Spacer()

                // Status and time
                VStack(alignment: .trailing, spacing: 2) {
                    Text(record.status.displayName)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(statusColor)

                    if let time = relevantTime {
                        Text(time, style: .time)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Expanded details
            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    Divider()

                    if let pubkey = record.subscriberPubkey {
                        DetailRow(label: "Pubkey", value: pubkey)
                    }

                    if let email = record.subscriberEmail {
                        DetailRow(label: "Email", value: email)
                    }

                    if let eventId = record.nostrEventId {
                        DetailRow(label: "Event ID", value: String(eventId.prefix(16)) + "...")
                    }

                    if let sentAt = record.sentAt {
                        DetailRow(label: "Sent At", value: formatDate(sentAt))
                    }

                    if let deliveredAt = record.deliveredAt {
                        DetailRow(label: "Delivered At", value: formatDate(deliveredAt))
                    }

                    if let openedAt = record.openedAt {
                        DetailRow(label: "Opened At", value: formatDate(openedAt))
                    }

                    if let clickedAt = record.clickedAt {
                        DetailRow(label: "Clicked At", value: formatDate(clickedAt))
                    }

                    if record.retryCount > 0 {
                        DetailRow(label: "Retry Count", value: "\(record.retryCount)")
                    }
                }
                .padding(.leading, 48)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation {
                isExpanded.toggle()
            }
        }
    }

    private var displayName: String {
        if let email = record.subscriberEmail {
            return email
        }
        if let pubkey = record.subscriberPubkey {
            return String(pubkey.prefix(16)) + "..."
        }
        return "Unknown"
    }

    private var relevantTime: Date? {
        switch record.status {
        case .pending: return nil
        case .sending: return record.sentAt
        case .delivered: return record.deliveredAt ?? record.sentAt
        case .failed, .bounced: return record.sentAt
        case .opened: return record.openedAt
        case .clicked: return record.clickedAt
        }
    }

    private var statusColor: Color {
        switch record.status {
        case .pending: return .gray
        case .sending: return .blue
        case .delivered: return .green
        case .failed: return .red
        case .bounced: return .red
        case .opened: return .purple
        case .clicked: return .orange
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
}

/// Detail row for expanded view
struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)

            Text(value)
                .font(.caption)
                .foregroundColor(.primary)

            Spacer()
        }
    }
}

/// ViewModel for delivery status
@MainActor
class DeliveryStatusViewModel: ObservableObject {
    let issueId: String
    let service: NewslettersService

    @Published var deliveryRecords: [DeliveryRecord] = []
    @Published var sendProgress: BatchSendProgress?
    @Published var isLoading = false
    @Published var statusFilter: DeliveryStatus?

    var filteredRecords: [DeliveryRecord] {
        if let status = statusFilter {
            return deliveryRecords.filter { $0.status == status }
        }
        return deliveryRecords
    }

    var failedCount: Int {
        deliveryRecords.filter { $0.status == .failed || $0.status == .bounced }.count
    }

    init(issueId: String, service: NewslettersService) {
        self.issueId = issueId
        self.service = service
    }

    func loadDeliveryRecords() async {
        isLoading = true
        do {
            deliveryRecords = try await service.getDeliveryRecords(issueId: issueId)

            // Check if sending is in progress
            if service.isSending {
                sendProgress = service.sendProgress
            }
        } catch {
            // Handle error
        }
        isLoading = false
    }

    func retryFailed() async {
        isLoading = true
        do {
            try await service.retryFailedDeliveries(issueId: issueId)
            await loadDeliveryRecords()
        } catch {
            // Handle error
        }
        isLoading = false
    }
}

// MARK: - Real-time Progress View

/// View showing real-time sending progress
struct SendingProgressView: View {
    @ObservedObject var service: NewslettersService

    var body: some View {
        if let progress = service.sendProgress, service.isSending {
            VStack(spacing: 16) {
                // Animated sending indicator
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                        .frame(width: 120, height: 120)

                    Circle()
                        .trim(from: 0, to: progress.progress)
                        .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 120, height: 120)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut, value: progress.progress)

                    VStack(spacing: 4) {
                        Text("\(Int(progress.progress * 100))%")
                            .font(.title)
                            .fontWeight(.bold)

                        Text("\(progress.sent)/\(progress.total)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Stats
                HStack(spacing: 24) {
                    StatColumn(
                        value: "\(progress.sent)",
                        label: "Sent",
                        color: .green
                    )

                    StatColumn(
                        value: "\(progress.failed)",
                        label: "Failed",
                        color: .red
                    )

                    StatColumn(
                        value: "\(progress.remaining)",
                        label: "Remaining",
                        color: .gray
                    )
                }

                // Rate and ETA
                if progress.currentRate > 0 {
                    Text(String(format: "%.1f messages/sec", progress.currentRate))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let eta = progress.estimatedCompletion {
                    Text("Estimated completion: \(eta, style: .time)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(16)
        }
    }
}

/// Stat column for progress view
struct StatColumn: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
