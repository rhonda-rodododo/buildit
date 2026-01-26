// FormFieldEditorView.swift
// BuildIt - Decentralized Mesh Communication
//
// Edit individual field settings.

import SwiftUI

private typealias Strings = L10n.Forms

// MARK: - Form Field Editor View

struct FormFieldEditorView: View {
    let field: FormField
    let onSave: (FormField) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var label: String
    @State private var description: String
    @State private var placeholder: String
    @State private var required: Bool
    @State private var options: [FieldOption]
    @State private var defaultValue: String
    @State private var showConditionalLogic = false

    // Validation states
    @State private var hasMinLength = false
    @State private var minLength = 1
    @State private var hasMaxLength = false
    @State private var maxLength = 100

    @State private var hasMinValue = false
    @State private var minValue: Double = 0
    @State private var hasMaxValue = false
    @State private var maxValue: Double = 100

    // Scale config
    @State private var scaleMin = 1
    @State private var scaleMax = 10
    @State private var scaleStep = 1
    @State private var scaleMinLabel = ""
    @State private var scaleMaxLabel = ""

    @State private var showDeleteConfirmation = false

    init(field: FormField, onSave: @escaping (FormField) -> Void, onDelete: @escaping () -> Void) {
        self.field = field
        self.onSave = onSave
        self.onDelete = onDelete

        _label = State(initialValue: field.label)
        _description = State(initialValue: field.description ?? "")
        _placeholder = State(initialValue: field.placeholder ?? "")
        _required = State(initialValue: field.required)
        _options = State(initialValue: field.options ?? [])
        _defaultValue = State(initialValue: field.defaultValue ?? "")

        // Initialize validation states
        if let validations = field.validation {
            for validation in validations {
                switch validation.type {
                case .minLength:
                    _hasMinLength = State(initialValue: true)
                    _minLength = State(initialValue: Int(validation.value ?? "1") ?? 1)
                case .maxLength:
                    _hasMaxLength = State(initialValue: true)
                    _maxLength = State(initialValue: Int(validation.value ?? "100") ?? 100)
                case .minValue:
                    _hasMinValue = State(initialValue: true)
                    _minValue = State(initialValue: Double(validation.value ?? "0") ?? 0)
                case .maxValue:
                    _hasMaxValue = State(initialValue: true)
                    _maxValue = State(initialValue: Double(validation.value ?? "100") ?? 100)
                default:
                    break
                }
            }
        }

        // Initialize scale config
        if let config = field.scaleConfig {
            _scaleMin = State(initialValue: config.min)
            _scaleMax = State(initialValue: config.max)
            _scaleStep = State(initialValue: config.step)
            _scaleMinLabel = State(initialValue: config.minLabel ?? "")
            _scaleMaxLabel = State(initialValue: config.maxLabel ?? "")
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Basic Settings
                basicSettingsSection

                // Type-specific settings
                if field.type.requiresOptions {
                    optionsSection
                }

                if field.type == .scale || field.type == .rating {
                    scaleConfigSection
                }

                // Validation
                if showsValidation {
                    validationSection
                }

                // Default Value
                defaultValueSection

                // Conditional Logic (placeholder)
                conditionalLogicSection

                // Delete
                Section {
                    Button(role: .destructive, action: { showDeleteConfirmation = true }) {
                        Label("forms_deleteField".localized, systemImage: "trash")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("forms_editField".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L10n.Common.cancel) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("forms_save".localized) {
                        saveField()
                    }
                    .fontWeight(.semibold)
                    .disabled(!isValid)
                }
            }
            .confirmationDialog("forms_deleteFieldConfirm".localized, isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("forms_delete".localized, role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button(L10n.Common.cancel, role: .cancel) { }
            } message: {
                Text("forms_cannotBeUndone".localized)
            }
        }
    }

    // MARK: - Sections

    private var basicSettingsSection: some View {
        Section("forms_basicSettings".localized) {
            HStack {
                Image(systemName: field.type.icon)
                    .foregroundColor(.accentColor)
                    .frame(width: 24)

                Text(field.type.displayName)
                    .foregroundColor(.secondary)
            }

            TextField("forms_label".localized, text: $label)

            TextField("forms_descriptionFieldOptional".localized, text: $description)

            if showsPlaceholder {
                TextField("forms_placeholderTextOptional".localized, text: $placeholder)
            }

            Toggle("forms_required".localized, isOn: $required)
        }
    }

    private var optionsSection: some View {
        Section("forms_options".localized) {
            ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                HStack {
                    TextField("forms_option".localized(index + 1), text: Binding(
                        get: { option.label },
                        set: { newValue in
                            var updatedOption = options[index]
                            updatedOption = FieldOption(
                                id: updatedOption.id,
                                label: newValue,
                                value: newValue,
                                order: index
                            )
                            options[index] = updatedOption
                        }
                    ))

                    Button(action: { removeOption(at: index) }) {
                        Image(systemName: "minus.circle.fill")
                            .foregroundColor(.red)
                    }
                    .buttonStyle(.plain)
                    .disabled(options.count <= 2)
                }
            }

            Button(action: addOption) {
                Label("forms_addOption".localized, systemImage: "plus.circle")
            }
        }
    }

    private var scaleConfigSection: some View {
        Section("forms_scaleSettings".localized) {
            if field.type == .rating {
                Stepper("forms_maxStars".localized(scaleMax), value: $scaleMax, in: 3...10)
            } else {
                Stepper("forms_minValue".localized(scaleMin), value: $scaleMin, in: 0...99)
                Stepper("forms_maxValue".localized(scaleMax), value: $scaleMax, in: (scaleMin + 1)...100)
                Stepper("forms_step".localized(scaleStep), value: $scaleStep, in: 1...10)

                TextField("forms_minLabelOptional".localized, text: $scaleMinLabel)
                TextField("forms_maxLabelOptional".localized, text: $scaleMaxLabel)
            }
        }
    }

    private var validationSection: some View {
        Section("forms_validation".localized) {
            if field.type == .text || field.type == .textarea || field.type == .email || field.type == .phone || field.type == .url {
                // Length validation
                Toggle("forms_minimumLength".localized, isOn: $hasMinLength)
                if hasMinLength {
                    Stepper("forms_characters".localized(minLength), value: $minLength, in: 1...1000)
                }

                Toggle("forms_maximumLength".localized, isOn: $hasMaxLength)
                if hasMaxLength {
                    Stepper("forms_characters".localized(maxLength), value: $maxLength, in: 1...10000)
                }
            }

            if field.type == .number {
                // Value validation
                Toggle("forms_minimumValue".localized, isOn: $hasMinValue)
                if hasMinValue {
                    HStack {
                        Text("forms_min".localized + ":")
                        TextField("", value: $minValue, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.decimalPad)
                    }
                }

                Toggle("forms_maximumValue".localized, isOn: $hasMaxValue)
                if hasMaxValue {
                    HStack {
                        Text("forms_max".localized + ":")
                        TextField("", value: $maxValue, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.decimalPad)
                    }
                }
            }
        }
    }

    private var defaultValueSection: some View {
        Section("forms_defaultValue".localized) {
            switch field.type {
            case .text, .textarea, .email, .phone, .url:
                TextField("forms_defaultValueOptional".localized, text: $defaultValue)

            case .number:
                TextField("forms_defaultValue".localized, text: $defaultValue)
                    .keyboardType(.decimalPad)

            case .select, .radio:
                Picker("forms_defaultValue".localized, selection: $defaultValue) {
                    Text("forms_none".localized).tag("")
                    ForEach(options) { option in
                        Text(option.label).tag(option.value)
                    }
                }

            case .checkbox:
                Toggle("forms_defaultChecked".localized, isOn: Binding(
                    get: { defaultValue == "true" },
                    set: { defaultValue = $0 ? "true" : "false" }
                ))

            case .rating, .scale:
                Stepper("forms_defaultValueLabel".localized(Int(Double(defaultValue) ?? 0)), value: Binding(
                    get: { Int(Double(defaultValue) ?? 0) },
                    set: { defaultValue = String($0) }
                ), in: scaleMin...scaleMax)

            default:
                Text("forms_noDefaultAvailable".localized)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var conditionalLogicSection: some View {
        Section("forms_conditionalLogic".localized) {
            Button(action: { showConditionalLogic = true }) {
                Label("forms_addCondition".localized, systemImage: "arrow.branch")
            }

            Text("forms_conditionalLogicHint".localized)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Computed Properties

    private var showsPlaceholder: Bool {
        switch field.type {
        case .text, .textarea, .number, .email, .phone, .url:
            return true
        default:
            return false
        }
    }

    private var showsValidation: Bool {
        switch field.type {
        case .text, .textarea, .number, .email, .phone, .url:
            return true
        default:
            return false
        }
    }

    private var isValid: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty &&
        (!field.type.requiresOptions || options.count >= 2)
    }

    // MARK: - Actions

    private func addOption() {
        let newOption = FieldOption(
            label: "Option \(options.count + 1)",
            order: options.count
        )
        options.append(newOption)
    }

    private func removeOption(at index: Int) {
        guard options.count > 2 else { return }
        options.remove(at: index)

        // Update order
        for i in 0..<options.count {
            let opt = options[i]
            options[i] = FieldOption(id: opt.id, label: opt.label, value: opt.value, order: i)
        }
    }

    private func saveField() {
        // Build validation array
        var validations: [FieldValidation] = []

        if hasMinLength {
            validations.append(.minLength(minLength))
        }
        if hasMaxLength {
            validations.append(.maxLength(maxLength))
        }
        if hasMinValue {
            validations.append(.minValue(minValue))
        }
        if hasMaxValue {
            validations.append(.maxValue(maxValue))
        }

        // Build scale config
        var scaleConfig: ScaleConfig?
        if field.type == .scale || field.type == .rating {
            scaleConfig = ScaleConfig(
                min: field.type == .rating ? 1 : scaleMin,
                max: scaleMax,
                step: scaleStep,
                minLabel: scaleMinLabel.isEmpty ? nil : scaleMinLabel,
                maxLabel: scaleMaxLabel.isEmpty ? nil : scaleMaxLabel
            )
        }

        let updatedField = FormField(
            id: field.id,
            type: field.type,
            label: label.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            placeholder: placeholder.isEmpty ? nil : placeholder,
            required: required,
            options: field.type.requiresOptions ? options : nil,
            validation: validations.isEmpty ? nil : validations,
            conditionalLogic: field.conditionalLogic,
            scaleConfig: scaleConfig,
            defaultValue: defaultValue.isEmpty ? nil : defaultValue,
            order: field.order
        )

        onSave(updatedField)
        dismiss()
    }
}

// MARK: - Mutable Field Option

extension FieldOption {
    init(id: String = UUID().uuidString, label: String, value: String? = nil, order: Int) {
        self.id = id
        self.label = label
        self.value = value ?? label
        self.order = order
    }
}

// MARK: - Preview

#Preview {
    FormFieldEditorView(
        field: FormField(
            type: .select,
            label: "Favorite Color",
            required: true,
            options: [
                FieldOption(label: "Red", order: 0),
                FieldOption(label: "Blue", order: 1),
                FieldOption(label: "Green", order: 2)
            ]
        ),
        onSave: { _ in },
        onDelete: { }
    )
}
