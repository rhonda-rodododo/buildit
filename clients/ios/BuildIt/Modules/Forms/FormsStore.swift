// FormsStore.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData persistence for forms data.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Models

@Model
public final class FormEntity {
    @Attribute(.unique) public var id: String
    public var title: String
    public var descriptionText: String?
    public var fieldsJson: String // JSON encoded [FormField]
    public var groupId: String?
    public var visibilityRaw: String
    public var statusRaw: String
    public var anonymous: Bool
    public var allowMultiple: Bool
    public var opensAt: Date?
    public var closesAt: Date?
    public var maxResponses: Int?
    public var confirmationMessage: String?
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var responseCount: Int
    public var syncedAt: Date?

    public init(
        id: String,
        title: String,
        descriptionText: String?,
        fieldsJson: String,
        groupId: String?,
        visibilityRaw: String,
        statusRaw: String,
        anonymous: Bool,
        allowMultiple: Bool,
        opensAt: Date?,
        closesAt: Date?,
        maxResponses: Int?,
        confirmationMessage: String?,
        createdBy: String,
        createdAt: Date,
        updatedAt: Date?,
        responseCount: Int,
        syncedAt: Date?
    ) {
        self.id = id
        self.title = title
        self.descriptionText = descriptionText
        self.fieldsJson = fieldsJson
        self.groupId = groupId
        self.visibilityRaw = visibilityRaw
        self.statusRaw = statusRaw
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
        self.syncedAt = syncedAt
    }
}

@Model
public final class FormResponseEntity {
    @Attribute(.unique) public var id: String
    public var formId: String
    public var answersJson: String // JSON encoded [FieldAnswer]
    public var respondentJson: String // JSON encoded Respondent
    public var submittedAt: Date
    public var updatedAt: Date?
    public var syncedAt: Date?

    public init(
        id: String,
        formId: String,
        answersJson: String,
        respondentJson: String,
        submittedAt: Date,
        updatedAt: Date?,
        syncedAt: Date?
    ) {
        self.id = id
        self.formId = formId
        self.answersJson = answersJson
        self.respondentJson = respondentJson
        self.submittedAt = submittedAt
        self.updatedAt = updatedAt
        self.syncedAt = syncedAt
    }
}

@Model
public final class FormDraftEntity {
    @Attribute(.unique) public var id: String
    public var formId: String? // nil for new forms
    public var formJson: String // JSON encoded Form
    public var savedAt: Date

    public init(
        id: String,
        formId: String?,
        formJson: String,
        savedAt: Date
    ) {
        self.id = id
        self.formId = formId
        self.formJson = formJson
        self.savedAt = savedAt
    }
}

// MARK: - FormsStore

@MainActor
public final class FormsStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "FormsStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init() throws {
        let schema = Schema([
            FormEntity.self,
            FormResponseEntity.self,
            FormDraftEntity.self
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [config])
        self.modelContext = modelContainer.mainContext
    }

    // MARK: - Forms CRUD

    public func saveForm(_ form: FormDefinition) throws {
        let fieldsData = try encoder.encode(form.fields)
        let fieldsJson = String(data: fieldsData, encoding: .utf8) ?? "[]"

        // Check if form exists
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == form.id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            // Update existing
            existing.title = form.title
            existing.descriptionText = form.description
            existing.fieldsJson = fieldsJson
            existing.groupId = form.groupId
            existing.visibilityRaw = form.visibility.rawValue
            existing.statusRaw = form.status.rawValue
            existing.anonymous = form.anonymous
            existing.allowMultiple = form.allowMultiple
            existing.opensAt = form.opensAt
            existing.closesAt = form.closesAt
            existing.maxResponses = form.maxResponses
            existing.confirmationMessage = form.confirmationMessage
            existing.updatedAt = Date()
            existing.responseCount = form.responseCount
        } else {
            // Create new
            let entity = FormEntity(
                id: form.id,
                title: form.title,
                descriptionText: form.description,
                fieldsJson: fieldsJson,
                groupId: form.groupId,
                visibilityRaw: form.visibility.rawValue,
                statusRaw: form.status.rawValue,
                anonymous: form.anonymous,
                allowMultiple: form.allowMultiple,
                opensAt: form.opensAt,
                closesAt: form.closesAt,
                maxResponses: form.maxResponses,
                confirmationMessage: form.confirmationMessage,
                createdBy: form.createdBy,
                createdAt: form.createdAt,
                updatedAt: form.updatedAt,
                responseCount: form.responseCount,
                syncedAt: nil
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        logger.debug("Saved form: \(form.id)")
    }

    public func getForm(id: String) throws -> FormDefinition? {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToForm(entity)
    }

    public func getForms(groupId: String? = nil, status: FormStatus? = nil) throws -> [FormDefinition] {
        var descriptor = FetchDescriptor<FormEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        if let groupId = groupId, let status = status {
            let statusRaw = status.rawValue
            descriptor.predicate = #Predicate { $0.groupId == groupId && $0.statusRaw == statusRaw }
        } else if let groupId = groupId {
            descriptor.predicate = #Predicate { $0.groupId == groupId }
        } else if let status = status {
            let statusRaw = status.rawValue
            descriptor.predicate = #Predicate { $0.statusRaw == statusRaw }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToForm($0) }
    }

    public func getActiveForms(groupId: String? = nil) throws -> [FormDefinition] {
        let activeStatus = FormStatus.active.rawValue
        var descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.statusRaw == activeStatus },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        if let groupId = groupId {
            descriptor.predicate = #Predicate {
                $0.statusRaw == activeStatus && $0.groupId == groupId
            }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToForm($0) }
    }

    public func updateFormStatus(id: String, status: FormStatus) throws {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            throw FormsError.formNotFound
        }

        entity.statusRaw = status.rawValue
        entity.updatedAt = Date()
        try modelContext.save()
    }

    public func incrementResponseCount(formId: String) throws {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == formId }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            throw FormsError.formNotFound
        }

        entity.responseCount += 1
        entity.updatedAt = Date()
        try modelContext.save()
    }

    public func deleteForm(id: String) throws {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    public func searchForms(query: String, groupId: String? = nil) throws -> [FormDefinition] {
        let lowercasedQuery = query.lowercased()
        var descriptor = FetchDescriptor<FormEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        if let groupId = groupId {
            descriptor.predicate = #Predicate { entity in
                entity.groupId == groupId && (
                    entity.title.localizedStandardContains(lowercasedQuery) ||
                    (entity.descriptionText?.localizedStandardContains(lowercasedQuery) ?? false)
                )
            }
        } else {
            descriptor.predicate = #Predicate { entity in
                entity.title.localizedStandardContains(lowercasedQuery) ||
                (entity.descriptionText?.localizedStandardContains(lowercasedQuery) ?? false)
            }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToForm($0) }
    }

    private func entityToForm(_ entity: FormEntity) throws -> FormDefinition {
        let fields: [FormField] = try decoder.decode(
            [FormField].self,
            from: entity.fieldsJson.data(using: .utf8) ?? Data()
        )

        return FormDefinition(
            id: entity.id,
            title: entity.title,
            description: entity.descriptionText,
            fields: fields,
            groupId: entity.groupId,
            visibility: FormVisibility(rawValue: entity.visibilityRaw) ?? .group,
            status: FormStatus(rawValue: entity.statusRaw) ?? .draft,
            anonymous: entity.anonymous,
            allowMultiple: entity.allowMultiple,
            opensAt: entity.opensAt,
            closesAt: entity.closesAt,
            maxResponses: entity.maxResponses,
            confirmationMessage: entity.confirmationMessage,
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            responseCount: entity.responseCount
        )
    }

    // MARK: - Responses CRUD

    public func saveResponse(_ response: FormResponse) throws {
        let answersData = try encoder.encode(response.answers)
        let answersJson = String(data: answersData, encoding: .utf8) ?? "[]"

        let respondentData = try encoder.encode(response.respondent)
        let respondentJson = String(data: respondentData, encoding: .utf8) ?? "{}"

        let entity = FormResponseEntity(
            id: response.id,
            formId: response.formId,
            answersJson: answersJson,
            respondentJson: respondentJson,
            submittedAt: response.submittedAt,
            updatedAt: response.updatedAt,
            syncedAt: nil
        )

        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved response: \(response.id) for form: \(response.formId)")
    }

    public func getResponse(id: String) throws -> FormResponse? {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToResponse(entity)
    }

    public func getResponses(formId: String) throws -> [FormResponse] {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.formId == formId },
            sortBy: [SortDescriptor(\.submittedAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        return try entities.map { try entityToResponse($0) }
    }

    public func getResponseCount(formId: String) throws -> Int {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.formId == formId }
        )
        return try modelContext.fetchCount(descriptor)
    }

    public func getUserResponse(formId: String, userId: String) throws -> FormResponse? {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.formId == formId }
        )

        let entities = try modelContext.fetch(descriptor)
        for entity in entities {
            if let response = try? entityToResponse(entity),
               response.respondent.pubkey == userId {
                return response
            }
        }
        return nil
    }

    public func hasUserResponded(formId: String, userId: String) throws -> Bool {
        return try getUserResponse(formId: formId, userId: userId) != nil
    }

    public func deleteResponse(id: String) throws {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    public func deleteResponses(formId: String) throws {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.formId == formId }
        )
        let entities = try modelContext.fetch(descriptor)
        for entity in entities {
            modelContext.delete(entity)
        }
        try modelContext.save()
    }

    private func entityToResponse(_ entity: FormResponseEntity) throws -> FormResponse {
        let answers: [FieldAnswer] = try decoder.decode(
            [FieldAnswer].self,
            from: entity.answersJson.data(using: .utf8) ?? Data()
        )

        let respondent: Respondent = try decoder.decode(
            Respondent.self,
            from: entity.respondentJson.data(using: .utf8) ?? Data()
        )

        return FormResponse(
            id: entity.id,
            formId: entity.formId,
            answers: answers,
            respondent: respondent,
            submittedAt: entity.submittedAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Drafts

    public func saveDraft(form: FormDefinition, draftId: String? = nil) throws -> String {
        let formData = try encoder.encode(form)
        let formJson = String(data: formData, encoding: .utf8) ?? "{}"

        let id = draftId ?? UUID().uuidString

        let descriptor = FetchDescriptor<FormDraftEntity>(
            predicate: #Predicate { $0.id == id }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.formJson = formJson
            existing.savedAt = Date()
        } else {
            let entity = FormDraftEntity(
                id: id,
                formId: form.id,
                formJson: formJson,
                savedAt: Date()
            )
            modelContext.insert(entity)
        }

        try modelContext.save()
        return id
    }

    public func getDraft(id: String) throws -> FormDefinition? {
        let descriptor = FetchDescriptor<FormDraftEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first,
              let data = entity.formJson.data(using: .utf8) else {
            return nil
        }
        return try decoder.decode(FormDefinition.self, from: data)
    }

    public func getAllDrafts() throws -> [(id: String, form: FormDefinition, savedAt: Date)] {
        let descriptor = FetchDescriptor<FormDraftEntity>(
            sortBy: [SortDescriptor(\.savedAt, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.compactMap { entity in
            guard let data = entity.formJson.data(using: .utf8),
                  let form = try? decoder.decode(FormDefinition.self, from: data) else {
                return nil
            }
            return (entity.id, form, entity.savedAt)
        }
    }

    public func deleteDraft(id: String) throws {
        let descriptor = FetchDescriptor<FormDraftEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    // MARK: - Sync Support

    public func getUnsyncedForms() throws -> [FormDefinition] {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.syncedAt == nil }
        )
        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToForm($0) }
    }

    public func getUnsyncedResponses() throws -> [FormResponse] {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.syncedAt == nil }
        )
        let entities = try modelContext.fetch(descriptor)
        return try entities.map { try entityToResponse($0) }
    }

    public func markFormSynced(id: String) throws {
        let descriptor = FetchDescriptor<FormEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            entity.syncedAt = Date()
            try modelContext.save()
        }
    }

    public func markResponseSynced(id: String) throws {
        let descriptor = FetchDescriptor<FormResponseEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            entity.syncedAt = Date()
            try modelContext.save()
        }
    }
}

// MARK: - Errors

public enum FormsError: Error, LocalizedError {
    case formNotFound
    case responseNotFound
    case formNotAcceptingResponses
    case alreadyResponded
    case validationFailed(errors: [String: String])
    case notAuthorized
    case invalidField(String)
    case encodingFailed
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .formNotFound:
            return "Form not found"
        case .responseNotFound:
            return "Response not found"
        case .formNotAcceptingResponses:
            return "This form is not currently accepting responses"
        case .alreadyResponded:
            return "You have already submitted a response to this form"
        case .validationFailed(let errors):
            return "Validation failed: \(errors.values.joined(separator: ", "))"
        case .notAuthorized:
            return "You are not authorized to perform this action"
        case .invalidField(let field):
            return "Invalid field: \(field)"
        case .encodingFailed:
            return "Failed to encode data"
        case .decodingFailed:
            return "Failed to decode data"
        }
    }
}
