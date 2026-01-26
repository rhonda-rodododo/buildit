// FormBuilderView.swift
// BuildIt - Decentralized Mesh Communication
//
// Create and edit forms with drag-and-drop fields.

import SwiftUI

// MARK: - Form Builder View

struct FormBuilderView: View {
    @ObservedObject var service: FormsService
    @Binding var isPresented: Bool
    var editingForm: FormDefinition?

    @State private var title = ""
    @State private var description = ""
    @State private var fields: [FormField] = []
    @State private var visibility: FormVisibility = .group
    @State private var anonymous = false
    @State private var allowMultiple = false
    @State private var hasSchedule = false
    @State private var opensAt: Date = Date()
    @State private var closesAt: Date = Date().addingTimeInterval(7 * 24 * 60 * 60)
    @State private var hasMaxResponses = false
    @State private var maxResponses = 100
    @State private var confirmationMessage = "Thank you for your response!"

    @State private var showAddField = false
    @State private var editingFieldIndex: Int?
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var showPublishConfirmation = false

    private let currentUserId = "current-user-id"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Basic Info Section
                    basicInfoSection

                    Divider()

                    // Fields Section
                    fieldsSection

                    Divider()

                    // Settings Section
                    settingsSection

                    Divider()

                    // Schedule Section
                    scheduleSection

                    Divider()

                    // Confirmation Section
                    confirmationSection
                }
                .padding()
            }
            .navigationTitle(editingForm == nil ? "New Form" : "Edit Form")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: saveDraft) {
                            Label("Save Draft", systemImage: "square.and.arrow.down")
                        }

                        Button(action: { showPublishConfirmation = true }) {
                            Label("Publish", systemImage: "paperplane")
                        }
                        .disabled(!isValid)
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isSubmitting)
                }
            }
            .sheet(isPresented: $showAddField) {
                AddFieldSheet(onAdd: { field in
                    fields.append(field)
                })
            }
            .sheet(item: $editingFieldIndex) { index in
                FormFieldEditorView(
                    field: fields[index],
                    onSave: { updatedField in
                        fields[index] = updatedField
                        editingFieldIndex = nil
                    },
                    onDelete: {
                        fields.remove(at: index)
                        editingFieldIndex = nil
                    }
                )
            }
            .alert("Publish Form", isPresented: $showPublishConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Publish") { publishForm() }
            } message: {
                Text("This will make the form available for responses. You can still pause or close it later.")
            }
            .alert("Error", isPresented: .init(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "An error occurred")
            }
            .onAppear {
                if let form = editingForm {
                    loadForm(form)
                }
            }
        }
    }

    // MARK: - Sections

    private var basicInfoSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Basic Information")
                .font(.headline)

            TextField("Form Title", text: $title)
                .textFieldStyle(.roundedBorder)

            VStack(alignment: .leading, spacing: 4) {
                Text("Description (optional)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                TextEditor(text: $description)
                    .frame(minHeight: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                    )
            }
        }
    }

    private var fieldsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Fields")
                    .font(.headline)

                Spacer()

                Button(action: { showAddField = true }) {
                    Label("Add Field", systemImage: "plus.circle.fill")
                }
            }

            if fields.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)

                    Text("No fields yet")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button("Add Your First Field") {
                        showAddField = true
                    }
                    .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .background(Color.secondary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                ForEach(Array(fields.enumerated()), id: \.element.id) { index, field in
                    FieldBuilderRow(
                        field: field,
                        onEdit: { editingFieldIndex = index },
                        onDelete: { fields.remove(at: index) },
                        onMoveUp: index > 0 ? { moveField(from: index, to: index - 1) } : nil,
                        onMoveDown: index < fields.count - 1 ? { moveField(from: index, to: index + 1) } : nil
                    )
                }
            }
        }
    }

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.headline)

            // Visibility
            HStack {
                Label("Visibility", systemImage: "eye")

                Spacer()

                Picker("", selection: $visibility) {
                    ForEach(FormVisibility.allCases, id: \.self) { vis in
                        Text(vis.displayName).tag(vis)
                    }
                }
                .pickerStyle(.menu)
            }

            Divider()

            // Anonymous
            Toggle(isOn: $anonymous) {
                Label("Anonymous Responses", systemImage: "eye.slash")
            }

            Text("Respondent identities will be hidden")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.leading, 28)

            Divider()

            // Multiple Responses
            Toggle(isOn: $allowMultiple) {
                Label("Allow Multiple Responses", systemImage: "arrow.triangle.2.circlepath")
            }

            Text("Users can submit more than one response")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.leading, 28)
        }
    }

    private var scheduleSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Schedule")
                    .font(.headline)

                Spacer()

                Toggle("", isOn: $hasSchedule)
                    .labelsHidden()
            }

            if hasSchedule {
                VStack(alignment: .leading, spacing: 12) {
                    DatePicker("Opens", selection: $opensAt)

                    DatePicker("Closes", selection: $closesAt)
                }
                .padding(.leading, 4)
            }

            Divider()

            HStack {
                Text("Max Responses")
                    .font(.subheadline)

                Spacer()

                Toggle("", isOn: $hasMaxResponses)
                    .labelsHidden()
            }

            if hasMaxResponses {
                Stepper("\(maxResponses) responses", value: $maxResponses, in: 1...10000, step: 10)
                    .padding(.leading, 4)
            }
        }
    }

    private var confirmationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Confirmation Message")
                .font(.headline)

            TextEditor(text: $confirmationMessage)
                .frame(minHeight: 60)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )

            Text("Shown to respondents after they submit")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Validation

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !fields.isEmpty
    }

    // MARK: - Actions

    private func loadForm(_ form: FormDefinition) {
        title = form.title
        description = form.description ?? ""
        fields = form.fields
        visibility = form.visibility
        anonymous = form.anonymous
        allowMultiple = form.allowMultiple
        hasSchedule = form.opensAt != nil || form.closesAt != nil
        opensAt = form.opensAt ?? Date()
        closesAt = form.closesAt ?? Date().addingTimeInterval(7 * 24 * 60 * 60)
        hasMaxResponses = form.maxResponses != nil
        maxResponses = form.maxResponses ?? 100
        confirmationMessage = form.confirmationMessage ?? "Thank you for your response!"
    }

    private func moveField(from: Int, to: Int) {
        let field = fields.remove(at: from)
        fields.insert(field, at: to)
    }

    private func buildForm() -> FormDefinition {
        FormDefinition(
            id: editingForm?.id ?? UUID().uuidString,
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            fields: fields.enumerated().map { index, field in
                var f = field
                f.order = index
                return f
            },
            groupId: "default-group",
            visibility: visibility,
            status: editingForm?.status ?? .draft,
            anonymous: anonymous,
            allowMultiple: allowMultiple,
            opensAt: hasSchedule ? opensAt : nil,
            closesAt: hasSchedule ? closesAt : nil,
            maxResponses: hasMaxResponses ? maxResponses : nil,
            confirmationMessage: confirmationMessage.isEmpty ? nil : confirmationMessage,
            createdBy: editingForm?.createdBy ?? currentUserId,
            createdAt: editingForm?.createdAt ?? Date(),
            updatedAt: Date(),
            responseCount: editingForm?.responseCount ?? 0
        )
    }

    private func saveDraft() {
        guard isValid else {
            errorMessage = "Please provide a title and at least one field"
            return
        }

        isSubmitting = true

        Task {
            do {
                let form = buildForm()
                _ = try await service.saveDraft(form: form)

                await MainActor.run {
                    isSubmitting = false
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func publishForm() {
        guard isValid else {
            errorMessage = "Please provide a title and at least one field"
            return
        }

        isSubmitting = true

        Task {
            do {
                var form = buildForm()
                form.status = .active

                if editingForm != nil {
                    _ = try await service.updateForm(form, userId: currentUserId)
                } else {
                    _ = try await service.createForm(
                        title: form.title,
                        description: form.description,
                        fields: form.fields,
                        groupId: form.groupId,
                        visibility: form.visibility,
                        anonymous: form.anonymous,
                        allowMultiple: form.allowMultiple,
                        opensAt: form.opensAt,
                        closesAt: form.closesAt,
                        maxResponses: form.maxResponses,
                        confirmationMessage: form.confirmationMessage,
                        createdBy: currentUserId
                    )
                }

                await MainActor.run {
                    isSubmitting = false
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

// MARK: - Field Builder Row

struct FieldBuilderRow: View {
    let field: FormField
    let onEdit: () -> Void
    let onDelete: () -> Void
    var onMoveUp: (() -> Void)?
    var onMoveDown: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            // Reorder controls
            VStack(spacing: 4) {
                Button(action: { onMoveUp?() }) {
                    Image(systemName: "chevron.up")
                        .font(.caption)
                }
                .disabled(onMoveUp == nil)

                Button(action: { onMoveDown?() }) {
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .disabled(onMoveDown == nil)
            }
            .foregroundColor(.secondary)

            // Field info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: field.type.icon)
                        .foregroundColor(.accentColor)
                        .frame(width: 20)

                    Text(field.label)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if field.required {
                        Text("*")
                            .foregroundColor(.red)
                    }
                }

                Text(field.type.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Actions
            Button(action: onEdit) {
                Image(systemName: "pencil")
            }
            .buttonStyle(.borderless)

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.borderless)
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Add Field Sheet

struct AddFieldSheet: View {
    let onAdd: (FormField) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var selectedType: FormFieldType = .text

    var body: some View {
        NavigationStack {
            List {
                Section("Text Fields") {
                    ForEach([FormFieldType.text, .textarea, .email, .phone, .url], id: \.self) { type in
                        FieldTypeRow(type: type, isSelected: selectedType == type) {
                            addField(type: type)
                        }
                    }
                }

                Section("Choice Fields") {
                    ForEach([FormFieldType.select, .multiselect, .radio, .checkbox], id: \.self) { type in
                        FieldTypeRow(type: type, isSelected: selectedType == type) {
                            addField(type: type)
                        }
                    }
                }

                Section("Date & Time") {
                    ForEach([FormFieldType.date, .time, .datetime], id: \.self) { type in
                        FieldTypeRow(type: type, isSelected: selectedType == type) {
                            addField(type: type)
                        }
                    }
                }

                Section("Number & Rating") {
                    ForEach([FormFieldType.number, .rating, .scale], id: \.self) { type in
                        FieldTypeRow(type: type, isSelected: selectedType == type) {
                            addField(type: type)
                        }
                    }
                }

                Section("Other") {
                    FieldTypeRow(type: .file, isSelected: selectedType == .file) {
                        addField(type: .file)
                    }
                }
            }
            .navigationTitle("Add Field")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func addField(type: FormFieldType) {
        var field = FormField(
            type: type,
            label: type.displayName
        )

        // Add default options for choice fields
        if type.requiresOptions {
            field.options = [
                FieldOption(label: "Option 1", order: 0),
                FieldOption(label: "Option 2", order: 1)
            ]
        }

        // Add default scale config
        if type == .rating {
            field.scaleConfig = .rating(max: 5)
        } else if type == .scale {
            field.scaleConfig = .defaultScale
        }

        onAdd(field)
        dismiss()
    }
}

struct FieldTypeRow: View {
    let type: FormFieldType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: type.icon)
                    .foregroundColor(.accentColor)
                    .frame(width: 24)

                VStack(alignment: .leading) {
                    Text(type.displayName)
                        .foregroundColor(.primary)
                }

                Spacer()

                Image(systemName: "plus.circle")
                    .foregroundColor(.accentColor)
            }
        }
    }
}

// MARK: - Int Extension for Sheet Item

extension Int: @retroactive Identifiable {
    public var id: Int { self }
}

// MARK: - Preview

#Preview {
    FormBuilderView(
        service: FormsService(store: try! FormsStore()),
        isPresented: .constant(true)
    )
}
