// FormsService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for forms and responses.

import Foundation
import os.log

/// Service handling forms business logic
@MainActor
public final class FormsService: ObservableObject {
    // MARK: - Nostr Event Kinds
    static let KIND_FORM = 40031
    static let KIND_RESPONSE = 40032

    // MARK: - Properties
    private let store: FormsStore
    private let logger = Logger(subsystem: "com.buildit", category: "FormsService")

    @Published public var forms: [FormDefinition] = []
    @Published public var activeForms: [FormDefinition] = []
    @Published public var myForms: [FormDefinition] = []
    @Published public var isLoading = false
    @Published public var lastError: String?

    // MARK: - Initialization

    public init(store: FormsStore) {
        self.store = store
    }

    // MARK: - Form CRUD

    /// Create a new form
    public func createForm(
        title: String,
        description: String? = nil,
        fields: [FormField],
        groupId: String? = nil,
        visibility: FormVisibility = .group,
        anonymous: Bool = false,
        allowMultiple: Bool = false,
        opensAt: Date? = nil,
        closesAt: Date? = nil,
        maxResponses: Int? = nil,
        confirmationMessage: String? = nil,
        createdBy: String
    ) async throws -> FormDefinition {
        // Validate fields
        for field in fields {
            if field.type.requiresOptions && (field.options?.isEmpty ?? true) {
                throw FormsError.invalidField("Field '\(field.label)' requires options")
            }
        }

        let form = FormDefinition(
            title: title,
            description: description,
            fields: fields.enumerated().map { index, field in
                var f = field
                f.order = index
                return f
            },
            groupId: groupId,
            visibility: visibility,
            status: .draft,
            anonymous: anonymous,
            allowMultiple: allowMultiple,
            opensAt: opensAt,
            closesAt: closesAt,
            maxResponses: maxResponses,
            confirmationMessage: confirmationMessage,
            createdBy: createdBy
        )

        try store.saveForm(form)
        await refreshForms(groupId: groupId)

        logger.info("Created form: \(form.id)")
        return form
    }

    /// Update an existing form
    public func updateForm(_ form: FormDefinition, userId: String) async throws -> FormDefinition {
        guard let existing = try store.getForm(id: form.id) else {
            throw FormsError.formNotFound
        }

        guard existing.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        // Can only update draft or paused forms
        guard existing.status == .draft || existing.status == .paused else {
            throw FormsError.notAuthorized
        }

        var updatedForm = form
        updatedForm.updatedAt = Date()

        try store.saveForm(updatedForm)
        await publishForm(updatedForm)
        await refreshForms(groupId: form.groupId)

        logger.info("Updated form: \(form.id)")
        return updatedForm
    }

    /// Delete a form
    public func deleteForm(id: String, userId: String) async throws {
        guard let form = try store.getForm(id: id) else {
            throw FormsError.formNotFound
        }

        guard form.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        // Delete associated responses
        try store.deleteResponses(formId: id)

        // Delete the form
        try store.deleteForm(id: id)
        await publishFormDeletion(id)
        await refreshForms(groupId: form.groupId)

        logger.info("Deleted form: \(id)")
    }

    /// Publish a form (make it active)
    public func publishForm(_ form: FormDefinition) async throws -> FormDefinition {
        var updatedForm = form
        updatedForm.status = .active
        updatedForm.updatedAt = Date()

        try store.saveForm(updatedForm)
        await publishFormToNostr(updatedForm)
        await refreshForms(groupId: form.groupId)

        logger.info("Published form: \(form.id)")
        return updatedForm
    }

    /// Close a form
    public func closeForm(id: String, userId: String) async throws {
        guard let form = try store.getForm(id: id) else {
            throw FormsError.formNotFound
        }

        guard form.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        try store.updateFormStatus(id: id, status: .closed)
        await publishForm(form)
        await refreshForms(groupId: form.groupId)

        logger.info("Closed form: \(id)")
    }

    /// Pause a form
    public func pauseForm(id: String, userId: String) async throws {
        guard let form = try store.getForm(id: id) else {
            throw FormsError.formNotFound
        }

        guard form.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        try store.updateFormStatus(id: id, status: .paused)
        await refreshForms(groupId: form.groupId)

        logger.info("Paused form: \(id)")
    }

    /// Resume a paused form
    public func resumeForm(id: String, userId: String) async throws {
        guard let form = try store.getForm(id: id) else {
            throw FormsError.formNotFound
        }

        guard form.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        guard form.status == .paused else {
            throw FormsError.notAuthorized
        }

        try store.updateFormStatus(id: id, status: .active)
        await refreshForms(groupId: form.groupId)

        logger.info("Resumed form: \(id)")
    }

    // MARK: - Form Retrieval

    /// Get a specific form
    public func getForm(id: String) async throws -> FormDefinition? {
        return try store.getForm(id: id)
    }

    /// Get all forms for a group
    public func getForms(groupId: String? = nil) async throws -> [FormDefinition] {
        return try store.getForms(groupId: groupId)
    }

    /// Get active forms for a group
    public func getActiveForms(groupId: String? = nil) async throws -> [FormDefinition] {
        return try store.getActiveForms(groupId: groupId)
    }

    /// Get forms created by a user
    public func getMyForms(userId: String, groupId: String? = nil) async throws -> [FormDefinition] {
        let allForms = try store.getForms(groupId: groupId)
        return allForms.filter { $0.createdBy == userId }
    }

    /// Search forms by title/description
    public func searchForms(query: String, groupId: String? = nil) async throws -> [FormDefinition] {
        return try store.searchForms(query: query, groupId: groupId)
    }

    /// Refresh forms list
    public func refreshForms(groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let all = try store.getForms(groupId: groupId)
            forms = all
            activeForms = all.filter { $0.status == .active }
        } catch {
            logger.error("Failed to refresh forms: \(error)")
            lastError = error.localizedDescription
        }
    }

    // MARK: - Response Submission

    /// Submit a response to a form
    public func submitResponse(
        formId: String,
        answers: [FieldAnswer],
        respondent: Respondent
    ) async throws -> FormResponse {
        // Get the form
        guard let form = try store.getForm(id: formId) else {
            throw FormsError.formNotFound
        }

        // Check if form is accepting responses
        guard form.isAcceptingResponses else {
            throw FormsError.formNotAcceptingResponses
        }

        // Check if user has already responded (if not allowing multiple)
        if !form.allowMultiple, let userId = respondent.pubkey {
            if try store.hasUserResponded(formId: formId, userId: userId) {
                throw FormsError.alreadyResponded
            }
        }

        // Validate the response
        let validation = validateResponse(form: form, answers: answers)
        guard validation.isValid else {
            throw FormsError.validationFailed(errors: validation.errors)
        }

        // Create the response
        let actualRespondent = form.anonymous ? .anonymous : respondent
        let response = FormResponse(
            formId: formId,
            answers: answers,
            respondent: actualRespondent
        )

        // Save
        try store.saveResponse(response)
        try store.incrementResponseCount(formId: formId)
        await publishResponse(response)

        logger.info("Submitted response \(response.id) for form \(formId)")
        return response
    }

    /// Get responses for a form
    public func getResponses(formId: String) async throws -> [FormResponse] {
        return try store.getResponses(formId: formId)
    }

    /// Get response count for a form
    public func getResponseCount(formId: String) async throws -> Int {
        return try store.getResponseCount(formId: formId)
    }

    /// Get user's response to a form
    public func getUserResponse(formId: String, userId: String) async throws -> FormResponse? {
        return try store.getUserResponse(formId: formId, userId: userId)
    }

    /// Check if user has responded to a form
    public func hasUserResponded(formId: String, userId: String) async throws -> Bool {
        return try store.hasUserResponded(formId: formId, userId: userId)
    }

    /// Delete a response
    public func deleteResponse(id: String, userId: String) async throws {
        guard let response = try store.getResponse(id: id) else {
            throw FormsError.responseNotFound
        }

        // Check authorization - either the respondent or the form owner
        guard let form = try store.getForm(id: response.formId) else {
            throw FormsError.formNotFound
        }

        guard response.respondent.pubkey == userId || form.createdBy == userId else {
            throw FormsError.notAuthorized
        }

        try store.deleteResponse(id: id)
        logger.info("Deleted response: \(id)")
    }

    // MARK: - Validation

    /// Validate a field value
    public func validateField(field: FormField, value: String?, values: [String]? = nil) -> (Bool, String?) {
        let actualValue = value ?? ""
        let actualValues = values ?? []

        // Check required
        if field.required {
            let isEmpty = actualValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            let areValuesEmpty = actualValues.isEmpty

            if field.type.acceptsMultipleValues {
                if areValuesEmpty {
                    return (false, "This field is required")
                }
            } else if isEmpty {
                return (false, "This field is required")
            }
        }

        // Skip further validation if empty and not required
        if actualValue.isEmpty && !field.required {
            return (true, nil)
        }

        // Type-specific validation
        switch field.type {
        case .email:
            if !isValidEmail(actualValue) {
                return (false, "Please enter a valid email address")
            }

        case .url:
            if !isValidURL(actualValue) {
                return (false, "Please enter a valid URL")
            }

        case .phone:
            if !isValidPhone(actualValue) {
                return (false, "Please enter a valid phone number")
            }

        case .number:
            if Double(actualValue) == nil {
                return (false, "Please enter a valid number")
            }

        case .select, .radio:
            if let options = field.options {
                let validValues = options.map { $0.value }
                if !validValues.contains(actualValue) {
                    return (false, "Please select a valid option")
                }
            }

        case .multiselect:
            if let options = field.options {
                let validValues = Set(options.map { $0.value })
                for v in actualValues {
                    if !validValues.contains(v) {
                        return (false, "Please select valid options")
                    }
                }
            }

        case .rating, .scale:
            if let config = field.scaleConfig {
                guard let numValue = Int(actualValue) else {
                    return (false, "Please enter a valid rating")
                }
                if numValue < config.min || numValue > config.max {
                    return (false, "Rating must be between \(config.min) and \(config.max)")
                }
            }

        default:
            break
        }

        // Custom validation rules
        if let validations = field.validation {
            for validation in validations {
                let (valid, message) = applyValidation(validation, value: actualValue)
                if !valid {
                    return (false, message ?? validation.message ?? "Validation failed")
                }
            }
        }

        return (true, nil)
    }

    /// Validate a complete form response
    public func validateResponse(form: FormDefinition, answers: [FieldAnswer]) -> ValidationResult {
        var errors: [String: String] = [:]

        let answersByFieldId = Dictionary(uniqueKeysWithValues: answers.map { ($0.fieldId, $0) })

        for field in form.fields {
            let answer = answersByFieldId[field.id]
            let (valid, message) = validateField(
                field: field,
                value: answer?.value,
                values: answer?.values
            )

            if !valid, let errorMessage = message {
                errors[field.id] = errorMessage
            }
        }

        return errors.isEmpty ? .valid : .invalid(errors: errors)
    }

    /// Evaluate conditional logic for a field
    public func evaluateConditional(
        logic: ConditionalLogic,
        answers: [FieldAnswer]
    ) -> Bool {
        guard let answer = answers.first(where: { $0.fieldId == logic.fieldId }) else {
            // Field not answered - check isEmpty operators
            switch logic.operator {
            case .isEmpty:
                return true
            case .isNotEmpty:
                return false
            default:
                return false
            }
        }

        let value = answer.value
        let conditionValue = logic.value ?? ""

        switch logic.operator {
        case .equals:
            return value == conditionValue

        case .notEquals:
            return value != conditionValue

        case .contains:
            return value.lowercased().contains(conditionValue.lowercased())

        case .notContains:
            return !value.lowercased().contains(conditionValue.lowercased())

        case .greaterThan:
            if let numValue = Double(value), let condNum = Double(conditionValue) {
                return numValue > condNum
            }
            return false

        case .lessThan:
            if let numValue = Double(value), let condNum = Double(conditionValue) {
                return numValue < condNum
            }
            return false

        case .isEmpty:
            return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        case .isNotEmpty:
            return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    /// Get visible fields based on conditional logic
    public func getVisibleFields(form: FormDefinition, answers: [FieldAnswer]) -> [FormField] {
        var visibleFieldIds = Set(form.fields.map { $0.id })

        for field in form.fields {
            guard let conditionals = field.conditionalLogic else { continue }

            for logic in conditionals {
                let conditionMet = evaluateConditional(logic: logic, answers: answers)

                switch logic.action {
                case .show:
                    if !conditionMet {
                        visibleFieldIds.remove(field.id)
                    }
                case .hide:
                    if conditionMet {
                        visibleFieldIds.remove(field.id)
                    }
                case .require, .optional, .skipTo:
                    // These don't affect visibility
                    break
                }
            }
        }

        return form.fields.filter { visibleFieldIds.contains($0.id) }
    }

    // MARK: - Statistics

    /// Get statistics for a form
    public func getStatistics(formId: String) async throws -> FormStatistics {
        let responses = try store.getResponses(formId: formId)
        guard let form = try store.getForm(id: formId) else {
            throw FormsError.formNotFound
        }

        var fieldStats: [String: FieldStatistics] = [:]

        for field in form.fields {
            let fieldAnswers = responses.compactMap { $0.answer(for: field.id) }
            let stats = calculateFieldStatistics(field: field, answers: fieldAnswers)
            fieldStats[field.id] = stats
        }

        return FormStatistics(
            formId: formId,
            totalResponses: responses.count,
            completionRate: 1.0, // All submitted responses are complete
            fieldStatistics: fieldStats
        )
    }

    private func calculateFieldStatistics(field: FormField, answers: [FieldAnswer]) -> FieldStatistics {
        let responseCount = answers.count

        var optionCounts: [String: Int]?
        var averageValue: Double?
        var minValue: Double?
        var maxValue: Double?

        switch field.type {
        case .select, .radio, .multiselect, .checkbox:
            var counts: [String: Int] = [:]
            for answer in answers {
                if let values = answer.values {
                    for v in values {
                        counts[v, default: 0] += 1
                    }
                } else {
                    counts[answer.value, default: 0] += 1
                }
            }
            optionCounts = counts

        case .number, .rating, .scale:
            let numericValues = answers.compactMap { Double($0.value) }
            if !numericValues.isEmpty {
                averageValue = numericValues.reduce(0, +) / Double(numericValues.count)
                minValue = numericValues.min()
                maxValue = numericValues.max()
            }

        default:
            break
        }

        return FieldStatistics(
            fieldId: field.id,
            responseCount: responseCount,
            optionCounts: optionCounts,
            averageValue: averageValue,
            minValue: minValue,
            maxValue: maxValue
        )
    }

    // MARK: - Drafts

    /// Save form as draft
    public func saveDraft(form: FormDefinition, draftId: String? = nil) async throws -> String {
        return try store.saveDraft(form: form, draftId: draftId)
    }

    /// Get draft
    public func getDraft(id: String) async throws -> FormDefinition? {
        return try store.getDraft(id: id)
    }

    /// Get all drafts
    public func getAllDrafts() async throws -> [(id: String, form: FormDefinition, savedAt: Date)] {
        return try store.getAllDrafts()
    }

    /// Delete draft
    public func deleteDraft(id: String) async throws {
        try store.deleteDraft(id: id)
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr form events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_FORM:
            await handleFormEvent(event)
        case Self.KIND_RESPONSE:
            await handleResponseEvent(event)
        default:
            break
        }
    }

    private func handleFormEvent(_ event: NostrEvent) async {
        logger.debug("Received form event: \(event.id)")

        // Decode and save form from event
        guard let formData = event.content.data(using: .utf8),
              let form = try? JSONDecoder().decode(FormDefinition.self, from: formData) else {
            logger.warning("Failed to decode form from event: \(event.id)")
            return
        }

        do {
            try store.saveForm(form)
            await refreshForms(groupId: form.groupId)
        } catch {
            logger.error("Failed to save form from event: \(error)")
        }
    }

    private func handleResponseEvent(_ event: NostrEvent) async {
        logger.debug("Received response event: \(event.id)")

        // Decode and save response from event
        guard let responseData = event.content.data(using: .utf8),
              let response = try? JSONDecoder().decode(FormResponse.self, from: responseData) else {
            logger.warning("Failed to decode response from event: \(event.id)")
            return
        }

        do {
            try store.saveResponse(response)
            try store.incrementResponseCount(formId: response.formId)
        } catch {
            logger.error("Failed to save response from event: \(error)")
        }
    }

    // MARK: - Nostr Publishing

    private func publishFormToNostr(_ form: FormDefinition) async {
        logger.debug("Would publish form: \(form.id)")
        // In production: encode form and publish as Nostr event
    }

    private func publishForm(_ form: FormDefinition) async {
        logger.debug("Would publish form update: \(form.id)")
    }

    private func publishFormDeletion(_ formId: String) async {
        logger.debug("Would publish form deletion: \(formId)")
    }

    private func publishResponse(_ response: FormResponse) async {
        logger.debug("Would publish response: \(response.id)")
    }

    // MARK: - Sync

    /// Sync unsynced forms and responses
    public func sync() async throws {
        let unsyncedForms = try store.getUnsyncedForms()
        for form in unsyncedForms {
            await publishFormToNostr(form)
            try store.markFormSynced(id: form.id)
        }

        let unsyncedResponses = try store.getUnsyncedResponses()
        for response in unsyncedResponses {
            await publishResponse(response)
            try store.markResponseSynced(id: response.id)
        }

        logger.info("Synced \(unsyncedForms.count) forms and \(unsyncedResponses.count) responses")
    }

    // MARK: - Private Helpers

    private func applyValidation(_ validation: FieldValidation, value: String) -> (Bool, String?) {
        switch validation.type {
        case .minLength:
            if let minLength = Int(validation.value ?? "0") {
                if value.count < minLength {
                    return (false, "Must be at least \(minLength) characters")
                }
            }

        case .maxLength:
            if let maxLength = Int(validation.value ?? "0") {
                if value.count > maxLength {
                    return (false, "Must be no more than \(maxLength) characters")
                }
            }

        case .minValue:
            if let minValue = Double(validation.value ?? "0"),
               let numValue = Double(value) {
                if numValue < minValue {
                    return (false, "Must be at least \(minValue)")
                }
            }

        case .maxValue:
            if let maxValue = Double(validation.value ?? "0"),
               let numValue = Double(value) {
                if numValue > maxValue {
                    return (false, "Must be no more than \(maxValue)")
                }
            }

        case .pattern:
            if let pattern = validation.value {
                let regex = try? NSRegularExpression(pattern: pattern)
                let range = NSRange(value.startIndex..., in: value)
                if regex?.firstMatch(in: value, range: range) == nil {
                    return (false, nil)
                }
            }

        case .email:
            if !isValidEmail(value) {
                return (false, "Invalid email format")
            }

        case .url:
            if !isValidURL(value) {
                return (false, "Invalid URL format")
            }

        case .phone:
            if !isValidPhone(value) {
                return (false, "Invalid phone number format")
            }

        case .custom:
            // Custom validation would be handled by the caller
            break
        }

        return (true, nil)
    }

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    private func isValidURL(_ url: String) -> Bool {
        guard let url = URL(string: url) else { return false }
        return url.scheme != nil && url.host != nil
    }

    private func isValidPhone(_ phone: String) -> Bool {
        let digits = phone.filter { $0.isNumber }
        return digits.count >= 10 && digits.count <= 15
    }
}
