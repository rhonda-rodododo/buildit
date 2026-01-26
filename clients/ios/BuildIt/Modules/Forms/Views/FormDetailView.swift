// FormDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// View and fill a form.

import SwiftUI

private typealias Strings = L10n.Forms

// MARK: - Form Detail View

struct FormDetailView: View {
    let form: FormDefinition
    @ObservedObject var service: FormsService
    @Environment(\.dismiss) private var dismiss

    @State private var answers: [String: FieldAnswer] = [:]
    @State private var validationErrors: [String: String] = [:]
    @State private var isSubmitting = false
    @State private var showConfirmation = false
    @State private var showResponses = false
    @State private var showEditForm = false
    @State private var errorMessage: String?

    // Current user ID (in production, get from identity)
    private let currentUserId = "current-user-id"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                formHeader

                // Form fields
                if form.isAcceptingResponses {
                    formFieldsSection
                } else {
                    closedFormMessage
                }
            }
            .padding()
        }
        .navigationTitle("forms_form".localized)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    if form.createdBy == currentUserId {
                        Button(action: { showEditForm = true }) {
                            Label("forms_edit".localized, systemImage: "pencil")
                        }

                        Button(action: { showResponses = true }) {
                            Label("forms_viewResponses".localized, systemImage: "list.bullet.rectangle")
                        }

                        if form.status == .active {
                            Button(action: pauseForm) {
                                Label("forms_pause".localized, systemImage: "pause")
                            }

                            Button(action: closeForm) {
                                Label("forms_close".localized, systemImage: "xmark.circle")
                            }
                        } else if form.status == .paused {
                            Button(action: resumeForm) {
                                Label("forms_resume".localized, systemImage: "play")
                            }
                        }
                    }

                    Button(action: shareForm) {
                        Label("forms_share".localized, systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showConfirmation) {
            SubmissionConfirmationView(
                message: form.confirmationMessage ?? "Thank you for your response!",
                onDismiss: { dismiss() }
            )
        }
        .sheet(isPresented: $showResponses) {
            FormResponsesView(form: form, service: service)
        }
        .sheet(isPresented: $showEditForm) {
            FormBuilderView(service: service, isPresented: $showEditForm, editingForm: form)
        }
        .alert("forms_error".localized, isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("forms_ok".localized) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? L10n.Common.error)
        }
    }

    // MARK: - Header

    private var formHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                FormStatusBadge(status: form.status)

                Spacer()

                if form.anonymous {
                    Label("forms_anonymous".localized, systemImage: "eye.slash")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Text(form.title)
                .font(.title)
                .fontWeight(.bold)

            if let description = form.description {
                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            // Form info
            HStack(spacing: 16) {
                Label("\(form.fields.count) \("forms_fields".localized)", systemImage: "list.bullet")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Label("\(form.responseCount) \("forms_responses".localized)", systemImage: "person.3")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if form.requiredFieldCount > 0 {
                    Label("\(form.requiredFieldCount) \("forms_required".localized)", systemImage: "asterisk")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Schedule info
            if let closes = form.closesAt {
                if closes > Date() {
                    HStack {
                        Image(systemName: "clock")
                        Text("Closes \(formatDate(closes))")
                    }
                    .font(.caption)
                    .foregroundColor(.orange)
                    .padding(.top, 4)
                }
            }

            Divider()
        }
    }

    // MARK: - Form Fields Section

    private var formFieldsSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            let visibleFields = service.getVisibleFields(form: form, answers: Array(answers.values))

            ForEach(visibleFields) { field in
                FormFieldView(
                    field: field,
                    answer: answers[field.id],
                    validationError: validationErrors[field.id],
                    onAnswerChanged: { answer in
                        answers[field.id] = answer
                        // Clear validation error when user changes answer
                        validationErrors[field.id] = nil
                    }
                )
            }

            // Submit button
            Button(action: submitForm) {
                HStack {
                    if isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text("forms_submit".localized)
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isSubmitting)
            .padding(.top, 8)
        }
    }

    // MARK: - Closed Form Message

    private var closedFormMessage: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("forms_formClosed".localized)
                .font(.title2)
                .fontWeight(.semibold)

            Text(closedReason)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var closedReason: String {
        switch form.status {
        case .draft:
            return "forms_stillBeingDrafted".localized
        case .paused:
            return "forms_pausedByCreator".localized
        case .closed:
            return "forms_formHasBeenClosed".localized
        case .archived:
            return "forms_formHasBeenArchived".localized
        default:
            if let closes = form.closesAt, closes < Date() {
                return "forms_formClosedOn".localized(formatDate(closes))
            }
            if let max = form.maxResponses, form.responseCount >= max {
                return "forms_reachedMaxResponses".localized
            }
            return "forms_notAcceptingResponses".localized
        }
    }

    // MARK: - Actions

    private func submitForm() {
        // Validate
        let validation = service.validateResponse(form: form, answers: Array(answers.values))

        if !validation.isValid {
            validationErrors = validation.errors
            return
        }

        isSubmitting = true

        Task {
            do {
                let respondent = Respondent(
                    pubkey: currentUserId,
                    displayName: nil,
                    anonymous: form.anonymous
                )

                _ = try await service.submitResponse(
                    formId: form.id,
                    answers: Array(answers.values),
                    respondent: respondent
                )

                await MainActor.run {
                    isSubmitting = false
                    showConfirmation = true
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func pauseForm() {
        Task {
            do {
                try await service.pauseForm(id: form.id, userId: currentUserId)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func resumeForm() {
        Task {
            do {
                try await service.resumeForm(id: form.id, userId: currentUserId)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func closeForm() {
        Task {
            do {
                try await service.closeForm(id: form.id, userId: currentUserId)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func shareForm() {
        // In production: generate share link
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Form Field View

struct FormFieldView: View {
    let field: FormField
    let answer: FieldAnswer?
    let validationError: String?
    let onAnswerChanged: (FieldAnswer) -> Void

    @State private var textValue: String = ""
    @State private var selectedOptions: Set<String> = []
    @State private var dateValue: Date = Date()
    @State private var numberValue: Double = 0
    @State private var ratingValue: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Label
            HStack {
                Text(field.label)
                    .font(.headline)

                if field.required {
                    Text("*")
                        .foregroundColor(.red)
                }
            }

            // Description
            if let description = field.description {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Field input
            fieldInput

            // Validation error
            if let error = validationError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .onAppear {
            // Initialize from existing answer
            if let answer = answer {
                textValue = answer.value
                if let values = answer.values {
                    selectedOptions = Set(values)
                }
                if let num = Double(answer.value) {
                    numberValue = num
                    ratingValue = Int(num)
                }
                if let date = ISO8601DateFormatter().date(from: answer.value) {
                    dateValue = date
                }
            } else if let defaultValue = field.defaultValue {
                textValue = defaultValue
            }
        }
    }

    @ViewBuilder
    private var fieldInput: some View {
        switch field.type {
        case .text:
            TextField(field.placeholder ?? "", text: $textValue)
                .textFieldStyle(.roundedBorder)
                .onChange(of: textValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: newValue))
                }

        case .textarea:
            TextEditor(text: $textValue)
                .frame(minHeight: 100)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .onChange(of: textValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: newValue))
                }

        case .number:
            TextField(field.placeholder ?? "0", value: $numberValue, format: .number)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.decimalPad)
                .onChange(of: numberValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: String(newValue)))
                }

        case .email:
            TextField(field.placeholder ?? "email@example.com", text: $textValue)
                .textFieldStyle(.roundedBorder)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .onChange(of: textValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: newValue))
                }

        case .phone:
            TextField(field.placeholder ?? "(555) 555-5555", text: $textValue)
                .textFieldStyle(.roundedBorder)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
                .onChange(of: textValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: newValue))
                }

        case .url:
            TextField(field.placeholder ?? "https://", text: $textValue)
                .textFieldStyle(.roundedBorder)
                .textContentType(.URL)
                .keyboardType(.URL)
                .autocapitalization(.none)
                .onChange(of: textValue) { _, newValue in
                    onAnswerChanged(.single(fieldId: field.id, value: newValue))
                }

        case .date:
            DatePicker("", selection: $dateValue, displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
                .onChange(of: dateValue) { _, newValue in
                    let formatter = ISO8601DateFormatter()
                    onAnswerChanged(.single(fieldId: field.id, value: formatter.string(from: newValue)))
                }

        case .time:
            DatePicker("", selection: $dateValue, displayedComponents: .hourAndMinute)
                .datePickerStyle(.compact)
                .labelsHidden()
                .onChange(of: dateValue) { _, newValue in
                    let formatter = DateFormatter()
                    formatter.dateFormat = "HH:mm"
                    onAnswerChanged(.single(fieldId: field.id, value: formatter.string(from: newValue)))
                }

        case .datetime:
            DatePicker("", selection: $dateValue)
                .datePickerStyle(.compact)
                .labelsHidden()
                .onChange(of: dateValue) { _, newValue in
                    let formatter = ISO8601DateFormatter()
                    onAnswerChanged(.single(fieldId: field.id, value: formatter.string(from: newValue)))
                }

        case .select:
            Picker("", selection: $textValue) {
                Text("forms_select".localized).tag("")
                ForEach(field.options ?? [], id: \.id) { option in
                    Text(option.label).tag(option.value)
                }
            }
            .pickerStyle(.menu)
            .onChange(of: textValue) { _, newValue in
                onAnswerChanged(.single(fieldId: field.id, value: newValue))
            }

        case .multiselect:
            VStack(alignment: .leading, spacing: 4) {
                ForEach(field.options ?? [], id: \.id) { option in
                    Toggle(option.label, isOn: Binding(
                        get: { selectedOptions.contains(option.value) },
                        set: { isOn in
                            if isOn {
                                selectedOptions.insert(option.value)
                            } else {
                                selectedOptions.remove(option.value)
                            }
                            onAnswerChanged(.multiple(fieldId: field.id, values: Array(selectedOptions)))
                        }
                    ))
                }
            }

        case .radio:
            VStack(alignment: .leading, spacing: 8) {
                ForEach(field.options ?? [], id: \.id) { option in
                    Button(action: {
                        textValue = option.value
                        onAnswerChanged(.single(fieldId: field.id, value: option.value))
                    }) {
                        HStack {
                            Image(systemName: textValue == option.value ? "circle.inset.filled" : "circle")
                                .foregroundColor(textValue == option.value ? .accentColor : .secondary)
                            Text(option.label)
                                .foregroundColor(.primary)
                            Spacer()
                        }
                    }
                }
            }

        case .checkbox:
            Toggle(field.options?.first?.label ?? field.label, isOn: Binding(
                get: { textValue == "true" },
                set: { newValue in
                    textValue = newValue ? "true" : "false"
                    onAnswerChanged(.single(fieldId: field.id, value: textValue))
                }
            ))

        case .file:
            Button(action: {
                // In production: show file picker
            }) {
                HStack {
                    Image(systemName: "paperclip")
                    Text(textValue.isEmpty ? "forms_attachFile".localized : textValue)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.secondary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

        case .rating:
            HStack(spacing: 8) {
                let maxRating = field.scaleConfig?.max ?? 5
                ForEach(1...maxRating, id: \.self) { star in
                    Button(action: {
                        ratingValue = star
                        onAnswerChanged(.single(fieldId: field.id, value: String(star)))
                    }) {
                        Image(systemName: star <= ratingValue ? "star.fill" : "star")
                            .foregroundColor(star <= ratingValue ? .yellow : .secondary)
                            .font(.title2)
                    }
                }
            }

        case .scale:
            if let config = field.scaleConfig {
                VStack {
                    HStack {
                        if let minLabel = config.minLabel {
                            Text(minLabel)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        if let maxLabel = config.maxLabel {
                            Text(maxLabel)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Slider(
                        value: $numberValue,
                        in: Double(config.min)...Double(config.max),
                        step: Double(config.step)
                    ) {
                        Text(field.label)
                    } minimumValueLabel: {
                        Text("\(config.min)")
                    } maximumValueLabel: {
                        Text("\(config.max)")
                    }
                    .onChange(of: numberValue) { _, newValue in
                        onAnswerChanged(.single(fieldId: field.id, value: String(Int(newValue))))
                    }

                    Text("Selected: \(Int(numberValue))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

// MARK: - Submission Confirmation View

struct SubmissionConfirmationView: View {
    let message: String
    let onDismiss: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)

            Text("forms_responseSubmitted".localized)
                .font(.title)
                .fontWeight(.bold)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("forms_done".localized) {
                dismiss()
                onDismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        FormDetailView(
            form: FormDefinition(
                title: "Event Feedback",
                description: "Please share your feedback about the event",
                fields: [
                    .text(label: "Name", required: true),
                    .email(required: true),
                    .rating(label: "Overall Rating", required: true)
                ],
                createdBy: "user-1"
            ),
            service: FormsService(store: try! FormsStore())
        )
    }
}
