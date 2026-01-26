// FormsModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Forms module for creating and collecting form responses.

import Foundation
import SwiftUI
import os.log

/// Forms module implementation
@MainActor
public final class FormsModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "forms"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    /// Nostr event kinds handled by this module
    public static let nostrKinds: [Int] = [40031, 40032]

    // MARK: - Properties

    private let store: FormsStore
    private let service: FormsService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "FormsModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try FormsStore()
        self.service = FormsService(store: store)
        logger.info("Forms module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Forms module")

        // Enable by default for global scope
        try await enable(for: nil)

        // Load initial data
        await service.refreshForms()

        logger.info("Forms module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route form-related Nostr events to service
        guard Self.nostrKinds.contains(event.kind) else { return }
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "forms",
                title: "Forms",
                icon: "doc.text.fill",
                order: 40
            ) {
                FormsListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Forms module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Forms module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Forms module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

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
        return try await service.createForm(
            title: title,
            description: description,
            fields: fields,
            groupId: groupId,
            visibility: visibility,
            anonymous: anonymous,
            allowMultiple: allowMultiple,
            opensAt: opensAt,
            closesAt: closesAt,
            maxResponses: maxResponses,
            confirmationMessage: confirmationMessage,
            createdBy: createdBy
        )
    }

    /// Update a form
    public func updateForm(_ form: FormDefinition, userId: String) async throws -> FormDefinition {
        return try await service.updateForm(form, userId: userId)
    }

    /// Delete a form
    public func deleteForm(id: String, userId: String) async throws {
        try await service.deleteForm(id: id, userId: userId)
    }

    /// Get a specific form
    public func getForm(id: String) async throws -> FormDefinition? {
        return try await service.getForm(id: id)
    }

    /// Get all forms
    public func getForms(groupId: String? = nil) async throws -> [FormDefinition] {
        return try await service.getForms(groupId: groupId)
    }

    /// Get active forms
    public func getActiveForms(groupId: String? = nil) async throws -> [FormDefinition] {
        return try await service.getActiveForms(groupId: groupId)
    }

    /// Submit a form response
    public func submitResponse(
        formId: String,
        answers: [FieldAnswer],
        respondent: Respondent
    ) async throws -> FormResponse {
        return try await service.submitResponse(
            formId: formId,
            answers: answers,
            respondent: respondent
        )
    }

    /// Get responses for a form
    public func getResponses(formId: String) async throws -> [FormResponse] {
        return try await service.getResponses(formId: formId)
    }

    /// Validate a field value
    public func validateField(
        field: FormField,
        value: String?,
        values: [String]? = nil
    ) -> (Bool, String?) {
        return service.validateField(field: field, value: value, values: values)
    }

    /// Validate a complete response
    public func validateResponse(form: FormDefinition, answers: [FieldAnswer]) -> ValidationResult {
        return service.validateResponse(form: form, answers: answers)
    }

    /// Evaluate conditional logic
    public func evaluateConditional(
        logic: ConditionalLogic,
        answers: [FieldAnswer]
    ) -> Bool {
        return service.evaluateConditional(logic: logic, answers: answers)
    }

    /// Get form statistics
    public func getStatistics(formId: String) async throws -> FormStatistics {
        return try await service.getStatistics(formId: formId)
    }

    /// Sync forms and responses
    public func sync() async throws {
        try await service.sync()
    }

    /// Access to the service for views
    public var formsService: FormsService {
        service
    }
}
