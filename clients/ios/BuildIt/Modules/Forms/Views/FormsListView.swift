// FormsListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main list view for forms.

import SwiftUI

// Import localization
private typealias Strings = L10n.Forms

// MARK: - Main List View

struct FormsListView: View {
    @ObservedObject var service: FormsService
    @State private var selectedTab = 0
    @State private var selectedStatus: FormStatus?
    @State private var searchText = ""
    @State private var showCreateForm = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab selector
                Picker("common_view".localized, selection: $selectedTab) {
                    Text("common_all".localized).tag(0)
                    Text("common_active".localized).tag(1)
                    Text("forms_myForms".localized).tag(2)
                }
                .pickerStyle(.segmented)
                .padding()

                // Status filter (only show for "All" tab)
                if selectedTab == 0 {
                    StatusFilterRow(selectedStatus: $selectedStatus)
                }

                // Content
                if service.isLoading {
                    Spacer()
                    ProgressView("forms_loading".localized)
                    Spacer()
                } else {
                    let filteredForms = getFilteredForms()

                    if filteredForms.isEmpty {
                        emptyState
                    } else {
                        List(filteredForms) { form in
                            NavigationLink(destination: FormDetailView(form: form, service: service)) {
                                FormRow(form: form)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
            .navigationTitle(L10n.Forms.title)
            .searchable(text: $searchText, prompt: Text("forms_searchPlaceholder".localized))
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showCreateForm = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateForm) {
                FormBuilderView(service: service, isPresented: $showCreateForm)
            }
            .task {
                await service.refreshForms()
            }
            .refreshable {
                await service.refreshForms()
            }
        }
    }

    private func getFilteredForms() -> [FormDefinition] {
        var forms: [FormDefinition]

        switch selectedTab {
        case 0:
            forms = service.forms
            if let status = selectedStatus {
                forms = forms.filter { $0.status == status }
            }
        case 1:
            forms = service.activeForms
        case 2:
            // Filter to user's forms (in production, use actual user ID)
            forms = service.forms.filter { $0.createdBy == "current-user-id" }
        default:
            forms = service.forms
        }

        // Apply search filter
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            forms = forms.filter {
                $0.title.lowercased().contains(query) ||
                ($0.description?.lowercased().contains(query) ?? false)
            }
        }

        return forms
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: emptyStateIcon)
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(emptyStateTitle)
                .font(.title2)
                .fontWeight(.semibold)

            Text(emptyStateMessage)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button(L10n.Forms.createForm) {
                showCreateForm = true
            }
            .buttonStyle(.borderedProminent)
            .padding(.top)
        }
        .padding()
    }

    private var emptyStateIcon: String {
        if !searchText.isEmpty {
            return "magnifyingglass"
        }
        switch selectedTab {
        case 1: return "doc.text"
        case 2: return "person.crop.rectangle"
        default: return "doc.text.fill"
        }
    }

    private var emptyStateTitle: String {
        if !searchText.isEmpty {
            return "common_noResults".localized
        }
        switch selectedTab {
        case 1: return "forms_noActiveForms".localized
        case 2: return "forms_noFormsCreated".localized
        default: return L10n.Forms.noForms
        }
    }

    private var emptyStateMessage: String {
        if !searchText.isEmpty {
            return "forms_noSearchResults".localized
        }
        switch selectedTab {
        case 1: return "forms_activeFormsAppear".localized
        case 2: return "forms_yourFormsAppear".localized
        default: return L10n.Forms.noFormsDescription
        }
    }
}

// MARK: - Status Filter Row

struct StatusFilterRow: View {
    @Binding var selectedStatus: FormStatus?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FormFilterChip(
                    title: "common_all".localized,
                    isSelected: selectedStatus == nil
                ) {
                    selectedStatus = nil
                }

                ForEach(FormStatus.allCases, id: \.self) { status in
                    FormFilterChip(
                        title: status.displayName,
                        isSelected: selectedStatus == status
                    ) {
                        selectedStatus = status
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 8)
    }
}

struct FormFilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Form Row

struct FormRow: View {
    let form: FormDefinition

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Status badge
                FormStatusBadge(status: form.status)

                Spacer()

                // Response count
                Label("\(form.responseCount)", systemImage: "person.3")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(form.title)
                .font(.headline)
                .lineLimit(2)

            if let description = form.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                // Field count
                Label("forms_fieldCount".localized(form.fields.count), systemImage: "list.bullet")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                // Schedule info
                if let closes = form.closesAt {
                    if closes > Date() {
                        Text("forms_closes".localized(formatDate(closes)))
                            .font(.caption)
                            .foregroundColor(.orange)
                    } else {
                        Text("forms_closed".localized)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                } else {
                    Text(formatDate(form.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Additional info row
            HStack(spacing: 12) {
                if form.anonymous {
                    Label("forms_anonymous".localized, systemImage: "eye.slash")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if form.allowMultiple {
                    Label("forms_multipleResponses".localized, systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Label(form.visibility.displayName, systemImage: form.visibility.icon)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

// MARK: - Status Badge

struct FormStatusBadge: View {
    let status: FormStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(textColor)
            .clipShape(Capsule())
    }

    private var backgroundColor: Color {
        switch status {
        case .draft: return Color.gray.opacity(0.2)
        case .active: return Color.green.opacity(0.2)
        case .paused: return Color.orange.opacity(0.2)
        case .closed: return Color.red.opacity(0.2)
        case .archived: return Color.gray.opacity(0.2)
        }
    }

    private var textColor: Color {
        switch status {
        case .draft: return .gray
        case .active: return .green
        case .paused: return .orange
        case .closed: return .red
        case .archived: return .gray
        }
    }
}

// MARK: - Preview

#Preview {
    FormsListView(service: FormsService(store: try! FormsStore()))
}
