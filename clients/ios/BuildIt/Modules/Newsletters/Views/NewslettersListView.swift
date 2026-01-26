// NewslettersListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main view for browsing and managing newsletters.

import SwiftUI

// Import localization
private typealias Strings = L10n.Newsletters

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
            .navigationTitle(Strings.title)
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

            Text(L10n.Newsletters.noNewsletters)
                .font(.headline)

            Text("newsletters_createFirstHint".localized)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button(action: onCreate) {
                Label(L10n.Newsletters.newNewsletter, systemImage: "plus")
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
                Picker("newsletters_view".localized, selection: $selectedTab) {
                    Text("newsletters_issues".localized).tag(0)
                    Text(L10n.Newsletters.subscribers).tag(1)
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
                Label("newsletters_subscriberCount".localized(subscriberCount), systemImage: "person.2")
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

                Text("newsletters_noIssues".localized)
                    .font(.headline)

                Button(action: onCreateNew) {
                    Label("newsletters_createFirstIssue".localized, systemImage: "plus")
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
                    Text("newsletters_sentAgo".localized) + Text(" \(sentAt, style: .relative)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("newsletters_createdAgo".localized) + Text(" \(issue.createdAt, style: .relative)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if issue.stats.recipientCount > 0 {
                    Text("newsletters_recipients".localized(issue.stats.recipientCount))
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
                    title: "newsletters_addSubscriber".localized,
                    icon: "person.badge.plus"
                ) {
                    showingAddSubscriber = true
                }

                ActionButton(
                    title: "newsletters_importCSV".localized,
                    icon: "arrow.down.doc"
                ) {
                    showingImportCSV = true
                }

                ActionButton(
                    title: "newsletters_viewAll".localized,
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
                Section("newsletters_details".localized) {
                    TextField("newsletters_name".localized, text: $name)
                    TextField("newsletters_descriptionOptional".localized, text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("newsletters_fromNameOptional".localized, text: $fromName)
                }

                Section("newsletters_settings".localized) {
                    Picker("newsletters_visibility".localized, selection: $visibility) {
                        ForEach(NewsletterVisibility.allCases, id: \.self) { vis in
                            Text(vis.displayName).tag(vis)
                        }
                    }

                    Toggle("newsletters_requireConfirmation".localized, isOn: $doubleOptIn)

                    if doubleOptIn {
                        Text("newsletters_confirmationHint".localized)
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
            .navigationTitle(L10n.Newsletters.newNewsletter)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.Common.create) {
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
                Section("newsletters_contactInfo".localized) {
                    TextField("newsletters_pubkeyHint".localized, text: $pubkey)
                    TextField("newsletters_emailOptional".localized, text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("newsletters_nameOptional".localized, text: $name)
                }

                Section {
                    Text("newsletters_pubkeyOrEmailRequired".localized)
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
            .navigationTitle("newsletters_addSubscriber".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("newsletters_add".localized) {
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
                Text("newsletters_csvInstructions".localized)
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
                        Text("newsletters_importComplete".localized)
                            .font(.headline)

                        HStack(spacing: 16) {
                            VStack {
                                Text("\(result.imported)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.green)
                                Text("newsletters_imported".localized)
                                    .font(.caption)
                            }

                            VStack {
                                Text("\(result.duplicates)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.orange)
                                Text("newsletters_duplicates".localized)
                                    .font(.caption)
                            }

                            VStack {
                                Text("\(result.skipped)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.red)
                                Text("newsletters_skipped".localized)
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
            .navigationTitle("newsletters_importCSV".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(importResult != nil ? L10n.Common.done : "newsletters_import".localized) {
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
