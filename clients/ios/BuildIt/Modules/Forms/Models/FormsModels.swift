// FormsModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for forms, fields, and responses.

import Foundation

// MARK: - Enums

/// Types of form fields
public enum FormFieldType: String, Codable, CaseIterable, Sendable {
    case text
    case textarea
    case number
    case email
    case phone
    case url
    case date
    case time
    case datetime
    case select
    case multiselect
    case radio
    case checkbox
    case file
    case rating
    case scale
    case location

    var displayName: String {
        switch self {
        case .text: return "Text"
        case .textarea: return "Long Text"
        case .number: return "Number"
        case .email: return "Email"
        case .phone: return "Phone"
        case .url: return "URL"
        case .date: return "Date"
        case .time: return "Time"
        case .datetime: return "Date & Time"
        case .select: return "Dropdown"
        case .multiselect: return "Multi-Select"
        case .radio: return "Radio Buttons"
        case .checkbox: return "Checkbox"
        case .file: return "File Upload"
        case .rating: return "Rating"
        case .scale: return "Scale"
        case .location: return "Location"
        }
    }

    var icon: String {
        switch self {
        case .text: return "textformat"
        case .textarea: return "text.alignleft"
        case .number: return "number"
        case .email: return "envelope"
        case .phone: return "phone"
        case .url: return "link"
        case .date: return "calendar"
        case .time: return "clock"
        case .datetime: return "calendar.badge.clock"
        case .select: return "chevron.down.circle"
        case .multiselect: return "checklist"
        case .radio: return "circle.inset.filled"
        case .checkbox: return "checkmark.square"
        case .file: return "paperclip"
        case .rating: return "star"
        case .scale: return "slider.horizontal.3"
        case .location: return "mappin.and.ellipse"
        }
    }

    /// Whether this field type requires options
    var requiresOptions: Bool {
        switch self {
        case .select, .multiselect, .radio:
            return true
        default:
            return false
        }
    }

    /// Whether this field type accepts multiple values
    var acceptsMultipleValues: Bool {
        switch self {
        case .multiselect, .checkbox:
            return true
        default:
            return false
        }
    }
}

/// Form visibility settings
public enum FormVisibility: String, Codable, CaseIterable, Sendable {
    case `public`
    case group
    case inviteOnly = "invite-only"
    case `private`

    var displayName: String {
        switch self {
        case .public: return "Public"
        case .group: return "Group Only"
        case .inviteOnly: return "Invite Only"
        case .private: return "Private"
        }
    }

    var description: String {
        switch self {
        case .public: return "Anyone can view and submit"
        case .group: return "Only group members can access"
        case .inviteOnly: return "Only invited users can access"
        case .private: return "Only you can access"
        }
    }

    var icon: String {
        switch self {
        case .public: return "globe"
        case .group: return "person.3"
        case .inviteOnly: return "envelope.badge.person.crop"
        case .private: return "lock"
        }
    }
}

/// Form status
public enum FormStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case active
    case paused
    case closed
    case archived

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .active: return "Active"
        case .paused: return "Paused"
        case .closed: return "Closed"
        case .archived: return "Archived"
        }
    }

    var isAcceptingResponses: Bool {
        self == .active
    }

    var color: String {
        switch self {
        case .draft: return "gray"
        case .active: return "green"
        case .paused: return "orange"
        case .closed: return "red"
        case .archived: return "gray"
        }
    }
}

/// Validation types for fields
public enum ValidationType: String, Codable, Sendable {
    case minLength = "min-length"
    case maxLength = "max-length"
    case minValue = "min-value"
    case maxValue = "max-value"
    case pattern
    case email
    case url
    case phone
    case custom
}

/// Conditional logic operators
public enum ConditionalOperator: String, Codable, Sendable {
    case equals
    case notEquals = "not-equals"
    case contains
    case notContains = "not-contains"
    case greaterThan = "greater-than"
    case lessThan = "less-than"
    case isEmpty = "is-empty"
    case isNotEmpty = "is-not-empty"
}

/// Conditional logic actions
public enum ConditionalAction: String, Codable, Sendable {
    case show
    case hide
    case require
    case optional
    case skipTo = "skip-to"
}

// MARK: - Models

/// Option for select/radio/checkbox fields
public struct FieldOption: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let value: String
    public let order: Int

    public init(
        id: String = UUID().uuidString,
        label: String,
        value: String? = nil,
        order: Int = 0
    ) {
        self.id = id
        self.label = label
        self.value = value ?? label
        self.order = order
    }
}

/// Validation rule for a field
public struct FieldValidation: Codable, Sendable {
    public let type: ValidationType
    public let value: String?
    public let message: String?

    public init(type: ValidationType, value: String? = nil, message: String? = nil) {
        self.type = type
        self.value = value
        self.message = message
    }

    /// Create a minimum length validation
    public static func minLength(_ length: Int, message: String? = nil) -> FieldValidation {
        FieldValidation(type: .minLength, value: String(length), message: message)
    }

    /// Create a maximum length validation
    public static func maxLength(_ length: Int, message: String? = nil) -> FieldValidation {
        FieldValidation(type: .maxLength, value: String(length), message: message)
    }

    /// Create a minimum value validation
    public static func minValue(_ value: Double, message: String? = nil) -> FieldValidation {
        FieldValidation(type: .minValue, value: String(value), message: message)
    }

    /// Create a maximum value validation
    public static func maxValue(_ value: Double, message: String? = nil) -> FieldValidation {
        FieldValidation(type: .maxValue, value: String(value), message: message)
    }

    /// Create a pattern validation
    public static func pattern(_ regex: String, message: String? = nil) -> FieldValidation {
        FieldValidation(type: .pattern, value: regex, message: message)
    }
}

/// Conditional logic for showing/hiding fields
public struct ConditionalLogic: Codable, Sendable {
    public let fieldId: String
    public let `operator`: ConditionalOperator
    public let value: String?
    public let action: ConditionalAction
    public let targetFieldId: String?

    public init(
        fieldId: String,
        operator: ConditionalOperator,
        value: String? = nil,
        action: ConditionalAction,
        targetFieldId: String? = nil
    ) {
        self.fieldId = fieldId
        self.operator = `operator`
        self.value = value
        self.action = action
        self.targetFieldId = targetFieldId
    }
}

/// Scale configuration for scale fields
public struct ScaleConfig: Codable, Sendable {
    public let min: Int
    public let max: Int
    public let step: Int
    public let minLabel: String?
    public let maxLabel: String?

    public init(
        min: Int = 1,
        max: Int = 10,
        step: Int = 1,
        minLabel: String? = nil,
        maxLabel: String? = nil
    ) {
        self.min = min
        self.max = max
        self.step = step
        self.minLabel = minLabel
        self.maxLabel = maxLabel
    }

    public static var defaultScale: ScaleConfig {
        ScaleConfig(min: 1, max: 10, step: 1)
    }

    public static func rating(max: Int = 5) -> ScaleConfig {
        ScaleConfig(min: 1, max: max, step: 1)
    }
}

/// A form field definition
public struct FormField: Identifiable, Codable, Sendable {
    public let id: String
    public let type: FormFieldType
    public var label: String
    public var description: String?
    public var placeholder: String?
    public var required: Bool
    public var options: [FieldOption]?
    public var validation: [FieldValidation]?
    public var conditionalLogic: [ConditionalLogic]?
    public var scaleConfig: ScaleConfig?
    public var defaultValue: String?
    public var order: Int

    public init(
        id: String = UUID().uuidString,
        type: FormFieldType,
        label: String,
        description: String? = nil,
        placeholder: String? = nil,
        required: Bool = false,
        options: [FieldOption]? = nil,
        validation: [FieldValidation]? = nil,
        conditionalLogic: [ConditionalLogic]? = nil,
        scaleConfig: ScaleConfig? = nil,
        defaultValue: String? = nil,
        order: Int = 0
    ) {
        self.id = id
        self.type = type
        self.label = label
        self.description = description
        self.placeholder = placeholder
        self.required = required
        self.options = options
        self.validation = validation
        self.conditionalLogic = conditionalLogic
        self.scaleConfig = scaleConfig
        self.defaultValue = defaultValue
        self.order = order
    }

    /// Create a text field
    public static func text(
        label: String,
        placeholder: String? = nil,
        required: Bool = false
    ) -> FormField {
        FormField(type: .text, label: label, placeholder: placeholder, required: required)
    }

    /// Create an email field
    public static func email(
        label: String = "Email",
        placeholder: String? = "email@example.com",
        required: Bool = false
    ) -> FormField {
        FormField(
            type: .email,
            label: label,
            placeholder: placeholder,
            required: required,
            validation: [FieldValidation(type: .email)]
        )
    }

    /// Create a select field with options
    public static func select(
        label: String,
        options: [String],
        required: Bool = false
    ) -> FormField {
        let fieldOptions = options.enumerated().map { index, opt in
            FieldOption(label: opt, order: index)
        }
        return FormField(type: .select, label: label, required: required, options: fieldOptions)
    }

    /// Create a rating field
    public static func rating(label: String, maxStars: Int = 5, required: Bool = false) -> FormField {
        FormField(
            type: .rating,
            label: label,
            required: required,
            scaleConfig: .rating(max: maxStars)
        )
    }
}

/// A form definition
/// Note: Named FormDefinition to avoid conflict with SwiftUI's Form
public struct FormDefinition: Identifiable, Codable, Sendable {
    public let id: String
    public var title: String
    public var description: String?
    public var fields: [FormField]
    public var groupId: String?
    public var visibility: FormVisibility
    public var status: FormStatus
    public var anonymous: Bool
    public var allowMultiple: Bool
    public var opensAt: Date?
    public var closesAt: Date?
    public var maxResponses: Int?
    public var confirmationMessage: String?
    public let createdBy: String
    public let createdAt: Date
    public var updatedAt: Date?
    public var responseCount: Int

    public init(
        id: String = UUID().uuidString,
        title: String,
        description: String? = nil,
        fields: [FormField] = [],
        groupId: String? = nil,
        visibility: FormVisibility = .group,
        status: FormStatus = .draft,
        anonymous: Bool = false,
        allowMultiple: Bool = false,
        opensAt: Date? = nil,
        closesAt: Date? = nil,
        maxResponses: Int? = nil,
        confirmationMessage: String? = nil,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        responseCount: Int = 0
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.fields = fields
        self.groupId = groupId
        self.visibility = visibility
        self.status = status
        self.anonymous = anonymous
        self.allowMultiple = allowMultiple
        self.opensAt = opensAt
        self.closesAt = closesAt
        self.maxResponses = maxResponses
        self.confirmationMessage = confirmationMessage
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.responseCount = responseCount
    }

    /// Check if form is currently accepting responses
    public var isAcceptingResponses: Bool {
        guard status == .active else { return false }

        let now = Date()
        if let opens = opensAt, now < opens { return false }
        if let closes = closesAt, now > closes { return false }
        if let max = maxResponses, responseCount >= max { return false }

        return true
    }

    /// Check if form has scheduling configured
    public var hasSchedule: Bool {
        opensAt != nil || closesAt != nil
    }

    /// Get the number of required fields
    public var requiredFieldCount: Int {
        fields.filter { $0.required }.count
    }
}

/// An answer to a single field
public struct FieldAnswer: Codable, Sendable {
    public let fieldId: String
    public let value: String
    public let values: [String]?

    public init(fieldId: String, value: String, values: [String]? = nil) {
        self.fieldId = fieldId
        self.value = value
        self.values = values
    }

    /// Create a single-value answer
    public static func single(fieldId: String, value: String) -> FieldAnswer {
        FieldAnswer(fieldId: fieldId, value: value)
    }

    /// Create a multi-value answer
    public static func multiple(fieldId: String, values: [String]) -> FieldAnswer {
        FieldAnswer(fieldId: fieldId, value: values.joined(separator: ", "), values: values)
    }
}

/// Respondent information
public struct Respondent: Codable, Sendable {
    public let pubkey: String?
    public let displayName: String?
    public let anonymous: Bool

    public init(pubkey: String? = nil, displayName: String? = nil, anonymous: Bool = false) {
        self.pubkey = pubkey
        self.displayName = displayName
        self.anonymous = anonymous
    }

    public static var anonymous: Respondent {
        Respondent(anonymous: true)
    }
}

/// A response to a form
public struct FormResponse: Identifiable, Codable, Sendable {
    public let id: String
    public let formId: String
    public let answers: [FieldAnswer]
    public let respondent: Respondent
    public let submittedAt: Date
    public var updatedAt: Date?

    public init(
        id: String = UUID().uuidString,
        formId: String,
        answers: [FieldAnswer],
        respondent: Respondent,
        submittedAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.formId = formId
        self.answers = answers
        self.respondent = respondent
        self.submittedAt = submittedAt
        self.updatedAt = updatedAt
    }

    /// Get answer for a specific field
    public func answer(for fieldId: String) -> FieldAnswer? {
        answers.first { $0.fieldId == fieldId }
    }
}

/// Validation result
public struct ValidationResult: Sendable {
    public let isValid: Bool
    public let errors: [String: String]

    public init(isValid: Bool, errors: [String: String] = [:]) {
        self.isValid = isValid
        self.errors = errors
    }

    public static var valid: ValidationResult {
        ValidationResult(isValid: true)
    }

    public static func invalid(errors: [String: String]) -> ValidationResult {
        ValidationResult(isValid: false, errors: errors)
    }
}

/// Form statistics
public struct FormStatistics: Sendable {
    public let formId: String
    public let totalResponses: Int
    public let completionRate: Double
    public let averageCompletionTime: TimeInterval?
    public let fieldStatistics: [String: FieldStatistics]

    public init(
        formId: String,
        totalResponses: Int,
        completionRate: Double = 0,
        averageCompletionTime: TimeInterval? = nil,
        fieldStatistics: [String: FieldStatistics] = [:]
    ) {
        self.formId = formId
        self.totalResponses = totalResponses
        self.completionRate = completionRate
        self.averageCompletionTime = averageCompletionTime
        self.fieldStatistics = fieldStatistics
    }
}

/// Statistics for a single field
public struct FieldStatistics: Sendable {
    public let fieldId: String
    public let responseCount: Int
    public let optionCounts: [String: Int]?
    public let averageValue: Double?
    public let minValue: Double?
    public let maxValue: Double?

    public init(
        fieldId: String,
        responseCount: Int,
        optionCounts: [String: Int]? = nil,
        averageValue: Double? = nil,
        minValue: Double? = nil,
        maxValue: Double? = nil
    ) {
        self.fieldId = fieldId
        self.responseCount = responseCount
        self.optionCounts = optionCounts
        self.averageValue = averageValue
        self.minValue = minValue
        self.maxValue = maxValue
    }
}
