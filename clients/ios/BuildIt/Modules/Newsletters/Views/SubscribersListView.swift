// SubscribersListView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for managing newsletter subscribers.

import SwiftUI
import UniformTypeIdentifiers

/// View for listing and managing subscribers
public struct SubscribersListView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: SubscribersListViewModel

    public init(newsletterId: String, service: NewslettersService) {
        _viewModel = StateObject(wrappedValue: SubscribersListViewModel(
            newsletterId: newsletterId,
            service: service
        ))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter bar
                filterBar

                // Subscriber list
                if viewModel.isLoading && viewModel.subscribers.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.filteredSubscribers.isEmpty {
                    emptyState
                } else {
                    subscribersList
                }
            }
            .navigationTitle("Subscribers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            viewModel.showingAddSubscriber = true
                        } label: {
                            Label("Add Subscriber", systemImage: "person.badge.plus")
                        }

                        Button {
                            viewModel.showingImportCSV = true
                        } label: {
                            Label("Import CSV", systemImage: "arrow.down.doc")
                        }

                        Divider()

                        Button {
                            Task { await viewModel.exportToCSV() }
                        } label: {
                            Label("Export CSV", systemImage: "arrow.up.doc")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .searchable(text: $viewModel.searchText, prompt: "Search subscribers")
            .sheet(isPresented: $viewModel.showingAddSubscriber) {
                AddSubscriberView(newsletterId: viewModel.newsletterId, service: viewModel.service) {
                    viewModel.showingAddSubscriber = false
                    Task { await viewModel.loadSubscribers() }
                }
            }
            .sheet(isPresented: $viewModel.showingImportCSV) {
                ImportCSVView(newsletterId: viewModel.newsletterId, service: viewModel.service) {
                    viewModel.showingImportCSV = false
                    Task { await viewModel.loadSubscribers() }
                }
            }
            .sheet(item: $viewModel.selectedSubscriber) { subscriber in
                SubscriberDetailView(subscriber: subscriber, service: viewModel.service) {
                    Task { await viewModel.loadSubscribers() }
                }
            }
            .sheet(isPresented: $viewModel.showingExportShare) {
                if let csvData = viewModel.exportedCSV {
                    ShareSheet(items: [csvData])
                }
            }
            .task {
                await viewModel.loadSubscribers()
            }
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterPill(
                    title: "All",
                    count: viewModel.subscribers.count,
                    isSelected: viewModel.statusFilter == nil
                ) {
                    viewModel.statusFilter = nil
                }

                ForEach(SubscriberStatus.allCases, id: \.self) { status in
                    let count = viewModel.subscribers.filter { $0.status == status }.count
                    if count > 0 {
                        FilterPill(
                            title: status.displayName,
                            count: count,
                            isSelected: viewModel.statusFilter == status
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

    private var subscribersList: some View {
        List {
            ForEach(viewModel.filteredSubscribers) { subscriber in
                SubscriberRow(subscriber: subscriber)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        viewModel.selectedSubscriber = subscriber
                    }
                    .swipeActions(edge: .trailing) {
                        if subscriber.status == .active {
                            Button(role: .destructive) {
                                Task { await viewModel.unsubscribe(subscriber.id) }
                            } label: {
                                Label("Unsubscribe", systemImage: "person.badge.minus")
                            }
                        }

                        if subscriber.status == .pending {
                            Button {
                                Task { await viewModel.confirm(subscriber.id) }
                            } label: {
                                Label("Confirm", systemImage: "checkmark")
                            }
                            .tint(.green)
                        }
                    }
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.loadSubscribers()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No subscribers found")
                .font(.headline)

            if viewModel.statusFilter != nil || !viewModel.searchText.isEmpty {
                Text("Try adjusting your filters")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Button("Clear Filters") {
                    viewModel.statusFilter = nil
                    viewModel.searchText = ""
                }
            } else {
                Text("Add subscribers to get started")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Button {
                    viewModel.showingAddSubscriber = true
                } label: {
                    Label("Add Subscriber", systemImage: "person.badge.plus")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Filter pill component
struct FilterPill: View {
    let title: String
    let count: Int
    let isSelected: Bool
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

/// Row view for a subscriber
struct SubscriberRow: View {
    let subscriber: NewsletterSubscriber

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(Color.accentColor.opacity(0.2))
                .frame(width: 40, height: 40)
                .overlay(
                    Text(subscriber.displayName.prefix(1).uppercased())
                        .font(.headline)
                        .foregroundColor(.accentColor)
                )

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(subscriber.displayName)
                        .font(.headline)

                    Spacer()

                    SubscriberStatusBadge(status: subscriber.status)
                }

                HStack(spacing: 8) {
                    if let email = subscriber.email {
                        Text(email)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if subscriber.pubkey != nil {
                        Image(systemName: "link")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Text("Subscribed \(subscriber.subscribedAt, style: .relative) ago")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Status badge for subscribers
struct SubscriberStatusBadge: View {
    let status: SubscriberStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
                .font(.caption2)
            Text(status.displayName)
                .font(.caption2)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(badgeColor.opacity(0.2))
        .foregroundColor(badgeColor)
        .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch status {
        case .pending: return .orange
        case .active: return .green
        case .unsubscribed: return .gray
        case .bounced: return .red
        case .complained: return .red
        }
    }
}

/// ViewModel for subscribers list
@MainActor
class SubscribersListViewModel: ObservableObject {
    let newsletterId: String
    let service: NewslettersService

    @Published var subscribers: [NewsletterSubscriber] = []
    @Published var isLoading = false
    @Published var searchText = ""
    @Published var statusFilter: SubscriberStatus?

    @Published var showingAddSubscriber = false
    @Published var showingImportCSV = false
    @Published var showingExportShare = false
    @Published var selectedSubscriber: NewsletterSubscriber?
    @Published var exportedCSV: String?

    var filteredSubscribers: [NewsletterSubscriber] {
        var result = subscribers

        if let status = statusFilter {
            result = result.filter { $0.status == status }
        }

        if !searchText.isEmpty {
            let search = searchText.lowercased()
            result = result.filter { subscriber in
                subscriber.name?.lowercased().contains(search) == true ||
                subscriber.email?.lowercased().contains(search) == true ||
                subscriber.pubkey?.lowercased().contains(search) == true
            }
        }

        return result
    }

    init(newsletterId: String, service: NewslettersService) {
        self.newsletterId = newsletterId
        self.service = service
    }

    func loadSubscribers() async {
        isLoading = true
        do {
            subscribers = try await service.getSubscribers(newsletterId: newsletterId)
        } catch {
            // Handle error
        }
        isLoading = false
    }

    func unsubscribe(_ subscriberId: String) async {
        do {
            try await service.unsubscribe(subscriberId)
            await loadSubscribers()
        } catch {
            // Handle error
        }
    }

    func confirm(_ subscriberId: String) async {
        do {
            try await service.confirmSubscriber(subscriberId)
            await loadSubscribers()
        } catch {
            // Handle error
        }
    }

    func exportToCSV() async {
        do {
            exportedCSV = try await service.exportSubscribersToCSV(
                newsletterId: newsletterId,
                activeOnly: false
            )
            showingExportShare = true
        } catch {
            // Handle error
        }
    }
}

/// Detail view for a subscriber
struct SubscriberDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let subscriber: NewsletterSubscriber
    let service: NewslettersService
    let onUpdate: () -> Void

    @State private var isLoading = false
    @State private var showingRemoveConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Contact info
                Section("Contact Information") {
                    if let email = subscriber.email {
                        LabeledContent("Email", value: email)
                    }

                    if let pubkey = subscriber.pubkey {
                        LabeledContent("Pubkey") {
                            Text(pubkey.prefix(16) + "...")
                                .font(.system(.body, design: .monospaced))
                        }
                    }

                    if let name = subscriber.name {
                        LabeledContent("Name", value: name)
                    }
                }

                // Status
                Section("Status") {
                    LabeledContent("Status") {
                        SubscriberStatusBadge(status: subscriber.status)
                    }

                    LabeledContent("Subscribed") {
                        Text(subscriber.subscribedAt, style: .date)
                    }

                    if let confirmed = subscriber.confirmedAt {
                        LabeledContent("Confirmed") {
                            Text(confirmed, style: .date)
                        }
                    }

                    if let unsubscribed = subscriber.unsubscribedAt {
                        LabeledContent("Unsubscribed") {
                            Text(unsubscribed, style: .date)
                        }
                    }

                    if let source = subscriber.source {
                        LabeledContent("Source", value: source)
                    }
                }

                // Segments
                if !subscriber.segments.isEmpty {
                    Section("Segments") {
                        ForEach(subscriber.segments, id: \.self) { segment in
                            Text(segment)
                        }
                    }
                }

                // Custom fields
                if !subscriber.customFields.isEmpty {
                    Section("Custom Fields") {
                        ForEach(Array(subscriber.customFields.keys.sorted()), id: \.self) { key in
                            if let value = subscriber.customFields[key] {
                                LabeledContent(key, value: value)
                            }
                        }
                    }
                }

                // Actions
                Section {
                    if subscriber.status == .pending {
                        Button {
                            Task { await confirmSubscriber() }
                        } label: {
                            Label("Confirm Subscription", systemImage: "checkmark.circle")
                        }
                    }

                    if subscriber.status == .active {
                        Button {
                            Task { await unsubscribe() }
                        } label: {
                            Label("Unsubscribe", systemImage: "person.badge.minus")
                                .foregroundColor(.orange)
                        }
                    }

                    Button(role: .destructive) {
                        showingRemoveConfirmation = true
                    } label: {
                        Label("Remove Subscriber", systemImage: "trash")
                    }
                }
            }
            .navigationTitle(subscriber.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Remove Subscriber", isPresented: $showingRemoveConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Remove", role: .destructive) {
                    Task { await removeSubscriber() }
                }
            } message: {
                Text("Are you sure you want to permanently remove this subscriber?")
            }
            .disabled(isLoading)
        }
    }

    private func confirmSubscriber() async {
        isLoading = true
        do {
            try await service.confirmSubscriber(subscriber.id)
            onUpdate()
            dismiss()
        } catch {
            // Handle error
        }
        isLoading = false
    }

    private func unsubscribe() async {
        isLoading = true
        do {
            try await service.unsubscribe(subscriber.id)
            onUpdate()
            dismiss()
        } catch {
            // Handle error
        }
        isLoading = false
    }

    private func removeSubscriber() async {
        isLoading = true
        do {
            try await service.removeSubscriber(subscriber.id)
            onUpdate()
            dismiss()
        } catch {
            // Handle error
        }
        isLoading = false
    }
}

/// Share sheet for exporting CSV
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
