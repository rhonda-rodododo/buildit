// NewsletterEditorView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for composing and editing newsletter issues.

import SwiftUI

// Import localization
private typealias Strings = L10n.Newsletters

/// View for composing a newsletter issue
public struct NewsletterEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: NewsletterEditorViewModel

    let onComplete: () -> Void

    public init(
        newsletterId: String,
        service: NewslettersService,
        issue: NewsletterIssue? = nil,
        onComplete: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: NewsletterEditorViewModel(
            newsletterId: newsletterId,
            service: service,
            existingIssue: issue
        ))
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Subject and preheader
                VStack(spacing: 12) {
                    TextField("newsletters_subject".localized, text: $viewModel.subject)
                        .font(.headline)
                        .textFieldStyle(.plain)

                    TextField("newsletters_previewTextOptional".localized, text: $viewModel.preheader)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .textFieldStyle(.plain)

                    Divider()
                }
                .padding()

                // Content type toggle
                Picker("newsletters_format".localized, selection: $viewModel.contentType) {
                    Text("newsletters_markdown".localized).tag(ContentType.markdown)
                    Text("newsletters_html".localized).tag(ContentType.html)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Content editor
                TextEditor(text: $viewModel.content)
                    .font(.system(.body, design: viewModel.contentType == .markdown ? .monospaced : .default))
                    .padding()

                Divider()

                // Actions bar
                actionsBar
            }
            .navigationTitle(viewModel.isEditing ? "newsletters_editIssue".localized : "newsletters_newIssue".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            Task { await viewModel.saveDraft() }
                        } label: {
                            Label("newsletters_saveDraft".localized, systemImage: "square.and.arrow.down")
                        }

                        if viewModel.canSend {
                            Button {
                                viewModel.showingSendConfirmation = true
                            } label: {
                                Label("newsletters_sendNow".localized, systemImage: "paperplane")
                            }

                            Button {
                                viewModel.showingSchedule = true
                            } label: {
                                Label("newsletters_scheduleButton".localized, systemImage: "calendar.badge.clock")
                            }
                        }

                        if viewModel.isEditing {
                            Divider()

                            Button(role: .destructive) {
                                viewModel.showingDeleteConfirmation = true
                            } label: {
                                Label("newsletters_delete".localized, systemImage: "trash")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .alert("newsletters_sendNewsletter".localized, isPresented: $viewModel.showingSendConfirmation) {
                Button("newsletters_cancel".localized, role: .cancel) { }
                Button("newsletters_send".localized) {
                    Task {
                        await viewModel.sendNow()
                        dismiss()
                        onComplete()
                    }
                }
            } message: {
                Text("newsletters_sendConfirmation".localized)
            }
            .alert("newsletters_deleteIssue".localized, isPresented: $viewModel.showingDeleteConfirmation) {
                Button("newsletters_cancel".localized, role: .cancel) { }
                Button("newsletters_delete".localized, role: .destructive) {
                    Task {
                        await viewModel.deleteIssue()
                        dismiss()
                        onComplete()
                    }
                }
            } message: {
                Text("newsletters_deleteConfirmation".localized)
            }
            .sheet(isPresented: $viewModel.showingSchedule) {
                ScheduleIssueView(
                    scheduledDate: $viewModel.scheduledAt,
                    onSchedule: {
                        Task {
                            await viewModel.schedule()
                            dismiss()
                            onComplete()
                        }
                    }
                )
            }
            .sheet(isPresented: $viewModel.showingPreview) {
                IssuePreviewView(
                    subject: viewModel.subject,
                    preheader: viewModel.preheader,
                    content: viewModel.content,
                    contentType: viewModel.contentType
                )
            }
            .overlay {
                if viewModel.isSaving {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.2))
                }
            }
        }
    }

    private var actionsBar: some View {
        HStack(spacing: 16) {
            Button {
                viewModel.showingPreview = true
            } label: {
                Label("newsletters_preview".localized, systemImage: "eye")
            }

            Spacer()

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .lineLimit(1)
            }

            Button {
                Task {
                    await viewModel.saveDraft()
                    dismiss()
                    onComplete()
                }
            } label: {
                Text("newsletters_save".localized)
            }
            .buttonStyle(.bordered)
            .disabled(!viewModel.isValid || viewModel.isSaving)
        }
        .padding()
        .background(Color(.systemGray6))
    }
}

/// ViewModel for newsletter editor
@MainActor
class NewsletterEditorViewModel: ObservableObject {
    let newsletterId: String
    let service: NewslettersService
    let existingIssue: NewsletterIssue?

    @Published var subject = ""
    @Published var preheader = ""
    @Published var content = ""
    @Published var contentType: ContentType = .markdown
    @Published var scheduledAt: Date = Date().addingTimeInterval(3600) // Default 1 hour from now

    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var showingSendConfirmation = false
    @Published var showingDeleteConfirmation = false
    @Published var showingSchedule = false
    @Published var showingPreview = false

    var isEditing: Bool { existingIssue != nil }

    var isValid: Bool {
        !subject.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var canSend: Bool {
        isValid && !content.trimmingCharacters(in: .whitespaces).isEmpty
    }

    init(newsletterId: String, service: NewslettersService, existingIssue: NewsletterIssue?) {
        self.newsletterId = newsletterId
        self.service = service
        self.existingIssue = existingIssue

        if let issue = existingIssue {
            self.subject = issue.subject
            self.preheader = issue.preheader ?? ""
            self.content = issue.content
            self.contentType = issue.contentType
            if let scheduled = issue.scheduledAt {
                self.scheduledAt = scheduled
            }
        }
    }

    func saveDraft() async {
        isSaving = true
        errorMessage = nil

        do {
            if var issue = existingIssue {
                issue.subject = subject.trimmingCharacters(in: .whitespaces)
                issue.preheader = preheader.isEmpty ? nil : preheader
                issue.content = content
                issue.contentType = contentType
                _ = try await service.updateIssue(issue)
            } else {
                _ = try await service.createIssue(
                    newsletterId: newsletterId,
                    subject: subject.trimmingCharacters(in: .whitespaces),
                    content: content,
                    contentType: contentType,
                    preheader: preheader.isEmpty ? nil : preheader
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    func sendNow() async {
        isSaving = true
        errorMessage = nil

        do {
            // Save first if needed
            var issue: NewsletterIssue
            if let existing = existingIssue {
                var updated = existing
                updated.subject = subject.trimmingCharacters(in: .whitespaces)
                updated.preheader = preheader.isEmpty ? nil : preheader
                updated.content = content
                updated.contentType = contentType
                issue = try await service.updateIssue(updated)
            } else {
                issue = try await service.createIssue(
                    newsletterId: newsletterId,
                    subject: subject.trimmingCharacters(in: .whitespaces),
                    content: content,
                    contentType: contentType,
                    preheader: preheader.isEmpty ? nil : preheader
                )
            }

            // Send the issue
            try await service.sendIssue(issue.id)
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    func schedule() async {
        isSaving = true
        errorMessage = nil

        do {
            if var issue = existingIssue {
                issue.subject = subject.trimmingCharacters(in: .whitespaces)
                issue.preheader = preheader.isEmpty ? nil : preheader
                issue.content = content
                issue.contentType = contentType
                issue.status = .scheduled
                issue.scheduledAt = scheduledAt
                _ = try await service.updateIssue(issue)
            } else {
                var issue = try await service.createIssue(
                    newsletterId: newsletterId,
                    subject: subject.trimmingCharacters(in: .whitespaces),
                    content: content,
                    contentType: contentType,
                    preheader: preheader.isEmpty ? nil : preheader
                )
                issue.status = .scheduled
                issue.scheduledAt = scheduledAt
                _ = try await service.updateIssue(issue)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    func deleteIssue() async {
        guard let issue = existingIssue else { return }

        isSaving = true
        do {
            try await service.deleteIssue(issue.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

/// View for scheduling an issue
struct ScheduleIssueView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var scheduledDate: Date
    let onSchedule: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("newsletters_scheduleSend".localized) {
                    DatePicker(
                        "newsletters_sendAt".localized,
                        selection: $scheduledDate,
                        in: Date()...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }

                Section {
                    Text("newsletters_newsletterSentAutomatically".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("newsletters_scheduleTitle".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("newsletters_scheduleButton".localized) {
                        onSchedule()
                        dismiss()
                    }
                }
            }
        }
    }
}

/// View for previewing an issue
struct IssuePreviewView: View {
    @Environment(\.dismiss) private var dismiss

    let subject: String
    let preheader: String
    let content: String
    let contentType: ContentType

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Email header preview
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Subject: \(subject)")
                            .font(.headline)

                        if !preheader.isEmpty {
                            Text(preheader)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        Divider()
                    }
                    .padding()
                    .background(Color(.systemGray6))

                    // Content preview
                    if contentType == .markdown {
                        Text(content)
                            .padding()
                    } else {
                        // HTML preview - simplified for now
                        Text(content)
                            .padding()
                    }
                }
            }
            .navigationTitle("newsletters_preview".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.Common.done) { dismiss() }
                }
            }
        }
    }
}

// MARK: - Markdown Editor Components

/// Toolbar for markdown editing
struct MarkdownToolbar: View {
    @Binding var text: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FormatButton(icon: "bold", action: { wrapSelection("**") })
                FormatButton(icon: "italic", action: { wrapSelection("*") })
                FormatButton(icon: "link", action: insertLink)
                FormatButton(icon: "list.bullet", action: insertList)
                FormatButton(icon: "list.number", action: insertNumberedList)
                FormatButton(icon: "text.quote", action: insertQuote)
                FormatButton(icon: "chevron.left.forwardslash.chevron.right", action: insertCode)
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
    }

    private func wrapSelection(_ wrapper: String) {
        text += "\(wrapper)text\(wrapper)"
    }

    private func insertLink() {
        text += "[link text](url)"
    }

    private func insertList() {
        text += "\n- Item 1\n- Item 2\n- Item 3\n"
    }

    private func insertNumberedList() {
        text += "\n1. First\n2. Second\n3. Third\n"
    }

    private func insertQuote() {
        text += "\n> Quote\n"
    }

    private func insertCode() {
        text += "`code`"
    }
}

/// Format button for markdown toolbar
struct FormatButton: View {
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
    }
}
