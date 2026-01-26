// IssueHistoryView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for showing past issues with delivery statistics.

import SwiftUI

/// View showing issue details and delivery history
public struct IssueHistoryView: View {
    @StateObject private var viewModel: IssueHistoryViewModel

    public init(issue: NewsletterIssue, service: NewslettersService) {
        _viewModel = StateObject(wrappedValue: IssueHistoryViewModel(
            issue: issue,
            service: service
        ))
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Issue header
                issueHeader

                // Stats cards
                if viewModel.issue.status == .sent || viewModel.issue.status == .sending {
                    statsSection
                }

                // Content preview
                contentPreview

                // Delivery records
                if !viewModel.deliveryRecords.isEmpty {
                    deliverySection
                }
            }
            .padding()
        }
        .navigationTitle(viewModel.issue.subject)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if viewModel.issue.status == .sent {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        if viewModel.failedCount > 0 {
                            Button {
                                Task { await viewModel.retryFailed() }
                            } label: {
                                Label("Retry Failed", systemImage: "arrow.clockwise")
                            }
                        }

                        Button {
                            viewModel.showingDeliveryStatus = true
                        } label: {
                            Label("View All Deliveries", systemImage: "list.bullet")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $viewModel.showingDeliveryStatus) {
            DeliveryStatusView(issueId: viewModel.issue.id, service: viewModel.service)
        }
        .task {
            await viewModel.loadDeliveryRecords()
        }
    }

    private var issueHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                StatusBadge(status: viewModel.issue.status)
                Spacer()

                if let sentAt = viewModel.issue.sentAt {
                    Text("Sent \(sentAt, style: .relative) ago")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Created \(viewModel.issue.createdAt, style: .relative) ago")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if let preheader = viewModel.issue.preheader, !preheader.isEmpty {
                Text(preheader)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Delivery Statistics")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                StatCard(
                    title: "Sent",
                    value: "\(viewModel.issue.stats.recipientCount)",
                    icon: "paperplane",
                    color: .blue
                )

                StatCard(
                    title: "Delivered",
                    value: "\(viewModel.issue.stats.deliveredCount)",
                    icon: "checkmark.circle",
                    color: .green,
                    subtitle: viewModel.deliveryRateText
                )

                StatCard(
                    title: "Failed",
                    value: "\(viewModel.issue.stats.failedCount)",
                    icon: "exclamationmark.triangle",
                    color: .red
                )
            }

            if viewModel.issue.stats.openCount > 0 {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    StatCard(
                        title: "Opens",
                        value: "\(viewModel.issue.stats.openCount)",
                        icon: "eye",
                        color: .purple,
                        subtitle: viewModel.openRateText
                    )

                    StatCard(
                        title: "Clicks",
                        value: "\(viewModel.issue.stats.clickCount)",
                        icon: "hand.tap",
                        color: .orange,
                        subtitle: viewModel.clickRateText
                    )
                }
            }
        }
    }

    private var contentPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Content")
                .font(.headline)

            Text(viewModel.issue.content)
                .font(.body)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .cornerRadius(12)
        }
    }

    private var deliverySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Deliveries")
                    .font(.headline)

                Spacer()

                Button("View All") {
                    viewModel.showingDeliveryStatus = true
                }
                .font(.caption)
            }

            ForEach(viewModel.recentDeliveryRecords) { record in
                DeliveryRecordRow(record: record)
            }
        }
    }
}

/// Stat card component
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

/// Row showing a delivery record
struct DeliveryRecordRow: View {
    let record: DeliveryRecord

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: record.status.icon)
                .foregroundColor(statusColor)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.subheadline)

                if let error = record.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(record.status.displayName)
                    .font(.caption)
                    .foregroundColor(statusColor)

                if let date = record.sentAt ?? record.deliveredAt {
                    Text(date, style: .time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
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
}

/// ViewModel for issue history
@MainActor
class IssueHistoryViewModel: ObservableObject {
    let service: NewslettersService

    @Published var issue: NewsletterIssue
    @Published var deliveryRecords: [DeliveryRecord] = []
    @Published var isLoading = false
    @Published var showingDeliveryStatus = false

    var recentDeliveryRecords: [DeliveryRecord] {
        Array(deliveryRecords.prefix(5))
    }

    var failedCount: Int {
        deliveryRecords.filter { $0.status == .failed || $0.status == .bounced }.count
    }

    var deliveryRateText: String {
        let rate = issue.stats.deliveryRate
        return String(format: "%.0f%%", rate * 100)
    }

    var openRateText: String {
        let rate = issue.stats.openRate
        return String(format: "%.0f%%", rate * 100)
    }

    var clickRateText: String {
        let rate = issue.stats.clickRate
        return String(format: "%.0f%%", rate * 100)
    }

    init(issue: NewsletterIssue, service: NewslettersService) {
        self.issue = issue
        self.service = service
    }

    func loadDeliveryRecords() async {
        isLoading = true
        do {
            deliveryRecords = try await service.getDeliveryRecords(issueId: issue.id)

            // Refresh issue stats
            if let updated = try await service.getIssue(id: issue.id) {
                issue = updated
            }
        } catch {
            // Handle error
        }
        isLoading = false
    }

    func retryFailed() async {
        isLoading = true
        do {
            try await service.retryFailedDeliveries(issueId: issue.id)
            await loadDeliveryRecords()
        } catch {
            // Handle error
        }
        isLoading = false
    }
}

/// Historical issues list for a newsletter
struct IssuesHistoryListView: View {
    let newsletterId: String
    let service: NewslettersService

    @State private var issues: [NewsletterIssue] = []
    @State private var isLoading = false
    @State private var selectedStatus: CampaignStatus?

    var body: some View {
        VStack(spacing: 0) {
            // Status filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    StatusFilterPill(
                        title: "All",
                        isSelected: selectedStatus == nil
                    ) {
                        selectedStatus = nil
                    }

                    ForEach(CampaignStatus.allCases, id: \.self) { status in
                        StatusFilterPill(
                            title: status.displayName,
                            isSelected: selectedStatus == status
                        ) {
                            selectedStatus = status
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(Color(.systemGray6))

            // Issues list
            if isLoading && issues.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredIssues.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)

                    Text("No issues found")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredIssues) { issue in
                    NavigationLink {
                        IssueHistoryView(issue: issue, service: service)
                    } label: {
                        IssueHistoryRow(issue: issue)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Issue History")
        .task {
            await loadIssues()
        }
        .refreshable {
            await loadIssues()
        }
    }

    private var filteredIssues: [NewsletterIssue] {
        if let status = selectedStatus {
            return issues.filter { $0.status == status }
        }
        return issues
    }

    private func loadIssues() async {
        isLoading = true
        do {
            issues = try await service.getIssues(newsletterId: newsletterId)
        } catch {
            // Handle error
        }
        isLoading = false
    }
}

/// Status filter pill
struct StatusFilterPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.systemBackground))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(Color.gray.opacity(0.3), lineWidth: isSelected ? 0 : 1)
                )
        }
    }
}

/// Row for issue in history list
struct IssueHistoryRow: View {
    let issue: NewsletterIssue

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(issue.subject)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                StatusBadge(status: issue.status)
            }

            HStack {
                if issue.status == .sent, let sentAt = issue.sentAt {
                    Text("Sent \(sentAt, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if issue.status == .scheduled, let scheduledAt = issue.scheduledAt {
                    Text("Scheduled for \(scheduledAt, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Created \(issue.createdAt, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if issue.stats.recipientCount > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2")
                        Text("\(issue.stats.recipientCount)")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }

            // Quick stats for sent issues
            if issue.status == .sent && issue.stats.recipientCount > 0 {
                HStack(spacing: 16) {
                    MiniStat(
                        icon: "checkmark.circle",
                        value: "\(Int(issue.stats.deliveryRate * 100))%",
                        color: .green
                    )

                    if issue.stats.openCount > 0 {
                        MiniStat(
                            icon: "eye",
                            value: "\(Int(issue.stats.openRate * 100))%",
                            color: .purple
                        )
                    }

                    if issue.stats.clickCount > 0 {
                        MiniStat(
                            icon: "hand.tap",
                            value: "\(Int(issue.stats.clickRate * 100))%",
                            color: .orange
                        )
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Mini stat display
struct MiniStat: View {
    let icon: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(color)
            Text(value)
        }
        .font(.caption)
        .foregroundColor(.secondary)
    }
}
