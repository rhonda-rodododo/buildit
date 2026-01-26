// SubscribersView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for managing publication subscribers.

import SwiftUI

struct SubscribersView: View {
    @ObservedObject var service: PublishingService
    let publicationId: String

    @State private var subscribers: [Subscriber] = []
    @State private var searchText = ""
    @State private var selectedFilter: SubscriberFilter = .all
    @State private var isLoading = true
    @State private var showingAddSubscriber = false
    @State private var showingExport = false

    var body: some View {
        VStack(spacing: 0) {
            // Stats header
            subscriberStats
                .padding()
                .background(Color(.systemGroupedBackground))

            // Filter tabs
            SubscriberFilterBar(selectedFilter: $selectedFilter)

            // Content
            if isLoading {
                Spacer()
                ProgressView("Loading subscribers...")
                Spacer()
            } else if filteredSubscribers.isEmpty {
                emptyState
            } else {
                subscribersList
            }
        }
        .navigationTitle("Subscribers")
        .searchable(text: $searchText, prompt: "Search subscribers...")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        showingAddSubscriber = true
                    } label: {
                        Label("Add Subscriber", systemImage: "person.badge.plus")
                    }

                    Button {
                        showingExport = true
                    } label: {
                        Label("Export List", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingAddSubscriber) {
            AddSubscriberView(service: service, publicationId: publicationId) {
                loadSubscribers()
            }
        }
        .sheet(isPresented: $showingExport) {
            ExportSubscribersView(subscribers: filteredSubscribers)
        }
        .task {
            loadSubscribers()
        }
        .refreshable {
            loadSubscribers()
        }
    }

    // MARK: - Computed Properties

    private var filteredSubscribers: [Subscriber] {
        var result = subscribers

        // Filter by status
        switch selectedFilter {
        case .all:
            break
        case .active:
            result = result.filter { $0.subscriptionStatus == .active }
        case .free:
            result = result.filter { $0.subscriptionStatus == .free }
        case .expired:
            result = result.filter { $0.subscriptionStatus == .expired }
        }

        // Filter by search
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.displayName?.lowercased().contains(query) ?? false ||
                $0.email?.lowercased().contains(query) ?? false ||
                $0.pubkey.lowercased().contains(query)
            }
        }

        return result
    }

    private var totalSubscribers: Int {
        subscribers.count
    }

    private var activeSubscribers: Int {
        subscribers.filter { $0.subscriptionStatus == .active }.count
    }

    private var freeSubscribers: Int {
        subscribers.filter { $0.subscriptionStatus == .free }.count
    }

    // MARK: - Views

    private var subscriberStats: some View {
        HStack(spacing: 20) {
            StatBox(
                title: "Total",
                value: "\(totalSubscribers)",
                icon: "person.2",
                color: .blue
            )

            StatBox(
                title: "Paid",
                value: "\(activeSubscribers)",
                icon: "star",
                color: .green
            )

            StatBox(
                title: "Free",
                value: "\(freeSubscribers)",
                icon: "person",
                color: .gray
            )
        }
    }

    private var subscribersList: some View {
        List {
            ForEach(filteredSubscribers) { subscriber in
                SubscriberRow(subscriber: subscriber)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task {
                                try? await service.removeSubscriber(subscriber)
                                loadSubscribers()
                            }
                        } label: {
                            Label("Remove", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: selectedFilter == .all ? "person.2" : "person.2.slash")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(emptyStateTitle)
                .font(.title2)
                .fontWeight(.semibold)

            Text(emptyStateMessage)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            if selectedFilter == .all {
                Button {
                    showingAddSubscriber = true
                } label: {
                    Label("Add Subscriber", systemImage: "person.badge.plus")
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }

    private var emptyStateTitle: String {
        switch selectedFilter {
        case .all:
            return searchText.isEmpty ? "No Subscribers Yet" : "No Results"
        case .active:
            return "No Paid Subscribers"
        case .free:
            return "No Free Subscribers"
        case .expired:
            return "No Expired Subscribers"
        }
    }

    private var emptyStateMessage: String {
        switch selectedFilter {
        case .all:
            return searchText.isEmpty ?
                "Share your publication to grow your audience" :
                "Try a different search term"
        case .active:
            return "Paid subscribers will appear here"
        case .free:
            return "Free subscribers will appear here"
        case .expired:
            return "Expired subscriptions will appear here"
        }
    }

    // MARK: - Methods

    private func loadSubscribers() {
        Task {
            isLoading = true
            defer { isLoading = false }

            do {
                subscribers = try await service.getSubscribers(publicationId: publicationId)
            } catch {
                // Handle error
            }
        }
    }
}

// MARK: - Subscriber Filter

enum SubscriberFilter: String, CaseIterable {
    case all = "All"
    case active = "Paid"
    case free = "Free"
    case expired = "Expired"

    var icon: String {
        switch self {
        case .all: return "person.2"
        case .active: return "star.fill"
        case .free: return "person"
        case .expired: return "clock"
        }
    }
}

struct SubscriberFilterBar: View {
    @Binding var selectedFilter: SubscriberFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(SubscriberFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        icon: filter.icon,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Stat Box

struct StatBox: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(value)
                    .font(.title2.bold())
            }
            .foregroundColor(color)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Subscriber Row

struct SubscriberRow: View {
    let subscriber: Subscriber

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(avatarColor.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay {
                    Text(avatarInitial)
                        .font(.headline)
                        .foregroundColor(avatarColor)
                }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(subscriber.displayName ?? "Anonymous")
                        .font(.headline)

                    SubscriptionStatusBadge(status: subscriber.subscriptionStatus)
                }

                if let email = subscriber.email {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text("Since \(formatDate(subscriber.subscribedAt))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Expiry indicator
            if let expiresAt = subscriber.expiresAt {
                VStack(alignment: .trailing) {
                    if expiresAt < Date() {
                        Text("Expired")
                            .font(.caption2)
                            .foregroundColor(.red)
                    } else {
                        Text("Expires")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(formatDate(expiresAt))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var avatarInitial: String {
        if let name = subscriber.displayName, !name.isEmpty {
            return String(name.prefix(1)).uppercased()
        }
        return "?"
    }

    private var avatarColor: Color {
        switch subscriber.subscriptionStatus {
        case .active: return .green
        case .free: return .blue
        case .expired: return .orange
        case .cancelled: return .gray
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

// MARK: - Subscription Status Badge

struct SubscriptionStatusBadge: View {
    let status: Subscriber.SubscriptionStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .clipShape(Capsule())
    }

    private var backgroundColor: Color {
        switch status {
        case .free: return .blue.opacity(0.2)
        case .active: return .green.opacity(0.2)
        case .expired: return .orange.opacity(0.2)
        case .cancelled: return .gray.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .free: return .blue
        case .active: return .green
        case .expired: return .orange
        case .cancelled: return .gray
        }
    }
}

// MARK: - Add Subscriber View

struct AddSubscriberView: View {
    @ObservedObject var service: PublishingService
    let publicationId: String
    let onAdd: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var pubkey = ""
    @State private var displayName = ""
    @State private var email = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nostr Public Key", text: $pubkey)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()

                    TextField("Display Name (optional)", text: $displayName)

                    TextField("Email (optional)", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                } header: {
                    Text("Subscriber Info")
                } footer: {
                    Text("Enter the Nostr public key (npub or hex) of the subscriber")
                }
            }
            .navigationTitle("Add Subscriber")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        addSubscriber()
                    }
                    .disabled(pubkey.isEmpty || isSaving)
                }
            }
        }
    }

    private func addSubscriber() {
        Task {
            isSaving = true
            defer { isSaving = false }

            do {
                _ = try await service.addSubscriber(
                    publicationId: publicationId,
                    pubkey: pubkey,
                    displayName: displayName.isEmpty ? nil : displayName,
                    email: email.isEmpty ? nil : email
                )
                onAdd()
                dismiss()
            } catch {
                // Handle error
            }
        }
    }
}

// MARK: - Export Subscribers View

struct ExportSubscribersView: View {
    let subscribers: [Subscriber]
    @Environment(\.dismiss) private var dismiss

    @State private var exportFormat: ExportFormat = .csv
    @State private var includeEmail = true
    @State private var includePubkey = true
    @State private var includeStatus = true

    enum ExportFormat: String, CaseIterable {
        case csv = "CSV"
        case json = "JSON"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Format", selection: $exportFormat) {
                        ForEach(ExportFormat.allCases, id: \.self) { format in
                            Text(format.rawValue).tag(format)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Export Format")
                }

                Section {
                    Toggle("Include Email", isOn: $includeEmail)
                    Toggle("Include Public Key", isOn: $includePubkey)
                    Toggle("Include Status", isOn: $includeStatus)
                } header: {
                    Text("Include Fields")
                }

                Section {
                    Text("\(subscribers.count) subscribers will be exported")
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Export Subscribers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Export") {
                        exportSubscribers()
                    }
                }
            }
        }
    }

    private func exportSubscribers() {
        var content = ""

        switch exportFormat {
        case .csv:
            var headers: [String] = ["Name"]
            if includeEmail { headers.append("Email") }
            if includePubkey { headers.append("Public Key") }
            if includeStatus { headers.append("Status") }
            headers.append("Subscribed At")

            content = headers.joined(separator: ",") + "\n"

            for subscriber in subscribers {
                var row: [String] = [subscriber.displayName ?? ""]
                if includeEmail { row.append(subscriber.email ?? "") }
                if includePubkey { row.append(subscriber.pubkey) }
                if includeStatus { row.append(subscriber.subscriptionStatus.rawValue) }
                row.append(ISO8601DateFormatter().string(from: subscriber.subscribedAt))

                content += row.map { "\"\($0)\"" }.joined(separator: ",") + "\n"
            }

        case .json:
            var exportData: [[String: Any]] = []
            for subscriber in subscribers {
                var data: [String: Any] = [
                    "name": subscriber.displayName ?? "",
                    "subscribedAt": ISO8601DateFormatter().string(from: subscriber.subscribedAt)
                ]
                if includeEmail { data["email"] = subscriber.email ?? "" }
                if includePubkey { data["pubkey"] = subscriber.pubkey }
                if includeStatus { data["status"] = subscriber.subscriptionStatus.rawValue }
                exportData.append(data)
            }

            if let jsonData = try? JSONSerialization.data(withJSONObject: exportData, options: .prettyPrinted) {
                content = String(data: jsonData, encoding: .utf8) ?? ""
            }
        }

        // Copy to clipboard
        UIPasteboard.general.string = content
        dismiss()
    }
}
