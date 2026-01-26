// NewslettersListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main view for browsing and managing newsletters.

import SwiftUI

/// Main newsletters list view
public struct NewslettersListView: View {
    @StateObject private var viewModel: NewslettersViewModel

    public init(service: NewslettersService) {
        _viewModel = StateObject(wrappedValue: NewslettersViewModel(service: service))
    }

    public var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.newsletters.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.newsletters.isEmpty {
                    EmptyNewslettersView {
                        viewModel.showingCreateSheet = true
                    }
                } else {
                    newslettersList
                }
            }
            .navigationTitle("Newsletters")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showingCreateSheet) {
                CreateNewsletterView(service: viewModel.service) {
                    viewModel.showingCreateSheet = false
                    Task { await viewModel.loadNewsletters() }
                }
            }
            .sheet(item: $viewModel.selectedNewsletter) { newsletter in
                NewsletterDetailView(newsletter: newsletter, service: viewModel.service)
            }
            .task {
                await viewModel.loadNewsletters()
            }
            .refreshable {
                await viewModel.loadNewsletters()
            }
        }
    }

    private var newslettersList: some View {
        List {
            ForEach(viewModel.newsletters) { newsletter in
                NewsletterRow(newsletter: newsletter)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        viewModel.selectedNewsletter = newsletter
                    }
            }
        }
        .listStyle(.plain)
    }
}

/// Row view for a newsletter
struct NewsletterRow: View {
    let newsletter: Newsletter

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "envelope.badge")
                    .foregroundColor(.accentColor)

                Text(newsletter.name)
                    .font(.headline)

                Spacer()

                VisibilityBadge(visibility: newsletter.visibility)
            }

            if let description = newsletter.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Label("\(newsletter.subscriberCount)", systemImage: "person.2")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text(newsletter.createdAt, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Badge showing newsletter visibility
struct VisibilityBadge: View {
    let visibility: NewsletterVisibility

    var body: some View {
        Text(visibility.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(badgeColor.opacity(0.2))
            .foregroundColor(badgeColor)
            .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch visibility {
        case .private: return .gray
        case .group: return .blue
        case .public: return .green
        }
    }
}

/// Empty state view for newsletters
struct EmptyNewslettersView: View {
    let onCreate: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No newsletters yet")
                .font(.headline)

            Text("Create your first newsletter to start reaching your audience")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button(action: onCreate) {
                Label("Create Newsletter", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .padding(.top)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// ViewModel for newsletters list
@MainActor
class NewslettersViewModel: ObservableObject {
    let service: NewslettersService

    @Published var newsletters: [Newsletter] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showingCreateSheet = false
    @Published var selectedNewsletter: Newsletter?

    init(service: NewslettersService) {
        self.service = service
    }

    func loadNewsletters() async {
        isLoading = true
        do {
            newsletters = try await service.getNewsletters()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

/// Newsletter detail view showing issues and subscribers
struct NewsletterDetailView: View {
    let newsletter: Newsletter
    let service: NewslettersService

    @State private var selectedTab = 0
    @State private var issues: [NewsletterIssue] = []
    @State private var subscriberCount = 0
    @State private var showingNewIssue = false
    @State private var showingSubscribers = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Newsletter header
                newsletterHeader
                    .padding()
                    .background(Color(.systemGray6))

                // Tab picker
                Picker("View", selection: $selectedTab) {
                    Text("Issues").tag(0)
                    Text("Subscribers").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                // Content
                if selectedTab == 0 {
                    IssuesListSection(
                        issues: issues,
                        service: service,
                        onCreateNew: { showingNewIssue = true }
                    )
                } else {
                    SubscribersSection(
                        newsletterId: newsletter.id,
                        service: service
                    )
                }
            }
            .navigationTitle(newsletter.name)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingNewIssue) {
                NewsletterEditorView(
                    newsletterId: newsletter.id,
                    service: service
                ) {
                    showingNewIssue = false
                    Task { await loadIssues() }
                }
            }
            .task {
                await loadIssues()
                await loadSubscriberCount()
            }
        }
    }

    private var newsletterHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let description = newsletter.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 16) {
                Label("\(subscriberCount) subscribers", systemImage: "person.2")
                Label(newsletter.visibility.displayName, systemImage: "eye")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
    }

    private func loadIssues() async {
        do {
            issues = try await service.getIssues(newsletterId: newsletter.id)
        } catch {
            // Handle error
        }
    }

    private func loadSubscriberCount() async {
        do {
            subscriberCount = try await service.getSubscriberCount(newsletterId: newsletter.id)
        } catch {
            // Handle error
        }
    }
}

/// Section showing issues list
struct IssuesListSection: View {
    let issues: [NewsletterIssue]
    let service: NewslettersService
    let onCreateNew: () -> Void

    var body: some View {
        if issues.isEmpty {
            VStack(spacing: 16) {
                Image(systemName: "doc.text")
                    .font(.system(size: 40))
                    .foregroundColor(.secondary)

                Text("No issues yet")
                    .font(.headline)

                Button(action: onCreateNew) {
                    Label("Create First Issue", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List {
                ForEach(issues) { issue in
                    NavigationLink {
                        IssueHistoryView(issue: issue, service: service)
                    } label: {
                        IssueRow(issue: issue)
                    }
                }
            }
            .listStyle(.plain)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: onCreateNew) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
    }
}

/// Row view for an issue
struct IssueRow: View {
    let issue: NewsletterIssue

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(issue.subject)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                StatusBadge(status: issue.status)
            }

            if let preheader = issue.preheader, !preheader.isEmpty {
                Text(preheader)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            HStack {
                if issue.status == .sent, let sentAt = issue.sentAt {
                    Text("Sent \(sentAt, style: .relative) ago")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Created \(issue.createdAt, style: .relative) ago")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if issue.stats.recipientCount > 0 {
                    Text("\(issue.stats.recipientCount) recipients")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Badge showing campaign status
struct StatusBadge: View {
    let status: CampaignStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
                .font(.caption2)
            Text(status.displayName)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(badgeColor.opacity(0.2))
        .foregroundColor(badgeColor)
        .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch status {
        case .draft: return .gray
        case .scheduled: return .blue
        case .sending: return .orange
        case .sent: return .green
        case .failed: return .red
        }
    }
}

/// Section showing subscribers
struct SubscribersSection: View {
    let newsletterId: String
    let service: NewslettersService

    @State private var showingAddSubscriber = false
    @State private var showingImportCSV = false
    @State private var showingSubscribersList = false

    var body: some View {
        VStack(spacing: 16) {
            // Quick actions
            HStack(spacing: 12) {
                ActionButton(
                    title: "Add",
                    icon: "person.badge.plus"
                ) {
                    showingAddSubscriber = true
                }

                ActionButton(
                    title: "Import CSV",
                    icon: "arrow.down.doc"
                ) {
                    showingImportCSV = true
                }

                ActionButton(
                    title: "View All",
                    icon: "list.bullet"
                ) {
                    showingSubscribersList = true
                }
            }
            .padding()

            Spacer()
        }
        .sheet(isPresented: $showingSubscribersList) {
            SubscribersListView(newsletterId: newsletterId, service: service)
        }
        .sheet(isPresented: $showingAddSubscriber) {
            AddSubscriberView(newsletterId: newsletterId, service: service) {
                showingAddSubscriber = false
            }
        }
        .sheet(isPresented: $showingImportCSV) {
            ImportCSVView(newsletterId: newsletterId, service: service) {
                showingImportCSV = false
            }
        }
    }
}

/// Action button for quick actions
struct ActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

/// View for creating a new newsletter
struct CreateNewsletterView: View {
    @Environment(\.dismiss) private var dismiss

    let service: NewslettersService
    let onComplete: () -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var fromName = ""
    @State private var visibility: NewsletterVisibility = .group
    @State private var doubleOptIn = true
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Newsletter Details") {
                    TextField("Name", text: $name)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("From Name (optional)", text: $fromName)
                }

                Section("Settings") {
                    Picker("Visibility", selection: $visibility) {
                        ForEach(NewsletterVisibility.allCases, id: \.self) { vis in
                            Text(vis.displayName).tag(vis)
                        }
                    }

                    Toggle("Require confirmation", isOn: $doubleOptIn)

                    if doubleOptIn {
                        Text("New subscribers will need to confirm their subscription")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New Newsletter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createNewsletter() }
                    }
                    .disabled(!isValid || isSubmitting)
                }
            }
            .disabled(isSubmitting)
        }
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func createNewsletter() async {
        isSubmitting = true
        errorMessage = nil

        do {
            _ = try await service.createNewsletter(
                name: name.trimmingCharacters(in: .whitespaces),
                description: description.isEmpty ? nil : description,
                fromName: fromName.isEmpty ? nil : fromName,
                visibility: visibility,
                doubleOptIn: doubleOptIn
            )
            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// View for adding a subscriber
struct AddSubscriberView: View {
    @Environment(\.dismiss) private var dismiss

    let newsletterId: String
    let service: NewslettersService
    let onComplete: () -> Void

    @State private var pubkey = ""
    @State private var email = ""
    @State private var name = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Contact Info") {
                    TextField("Nostr Pubkey (npub or hex)", text: $pubkey)
                    TextField("Email (optional)", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Name (optional)", text: $name)
                }

                Section {
                    Text("At least a pubkey or email is required")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Add Subscriber")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task { await addSubscriber() }
                    }
                    .disabled(!isValid || isSubmitting)
                }
            }
            .disabled(isSubmitting)
        }
    }

    private var isValid: Bool {
        !pubkey.trimmingCharacters(in: .whitespaces).isEmpty ||
        !email.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func addSubscriber() async {
        isSubmitting = true
        errorMessage = nil

        do {
            _ = try await service.addSubscriber(
                newsletterId: newsletterId,
                pubkey: pubkey.isEmpty ? nil : pubkey.trimmingCharacters(in: .whitespaces),
                email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
                name: name.isEmpty ? nil : name.trimmingCharacters(in: .whitespaces),
                source: "manual"
            )
            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// View for importing subscribers from CSV
struct ImportCSVView: View {
    @Environment(\.dismiss) private var dismiss

    let newsletterId: String
    let service: NewslettersService
    let onComplete: () -> Void

    @State private var csvText = ""
    @State private var isImporting = false
    @State private var importResult: CSVImportResult?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Paste CSV data with columns: email, name, pubkey")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)

                TextEditor(text: $csvText)
                    .font(.system(.body, design: .monospaced))
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .padding(.horizontal)

                if let result = importResult {
                    VStack(spacing: 8) {
                        Text("Import Complete")
                            .font(.headline)

                        HStack(spacing: 16) {
                            VStack {
                                Text("\(result.imported)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.green)
                                Text("Imported")
                                    .font(.caption)
                            }

                            VStack {
                                Text("\(result.duplicates)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.orange)
                                Text("Duplicates")
                                    .font(.caption)
                            }

                            VStack {
                                Text("\(result.skipped)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.red)
                                Text("Skipped")
                                    .font(.caption)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }

                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .padding(.horizontal)
                }

                Spacer()
            }
            .navigationTitle("Import CSV")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(importResult != nil ? "Done" : "Import") {
                        if importResult != nil {
                            dismiss()
                            onComplete()
                        } else {
                            Task { await importCSV() }
                        }
                    }
                    .disabled(csvText.isEmpty || isImporting)
                }
            }
            .disabled(isImporting)
            .overlay {
                if isImporting {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.2))
                }
            }
        }
    }

    private func importCSV() async {
        isImporting = true
        errorMessage = nil

        do {
            importResult = try await service.importSubscribersFromCSV(
                newsletterId: newsletterId,
                csvData: csvText
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isImporting = false
    }
}
