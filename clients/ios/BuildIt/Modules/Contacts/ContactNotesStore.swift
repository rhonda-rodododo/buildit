// ContactNotesStore.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData persistence for contact notes and tags.

import Foundation
import SwiftData

// MARK: - SwiftData Models

@Model
final class ContactNoteEntity {
    @Attribute(.unique) var id: String
    var contactPubkey: String
    var content: String
    var categoryRaw: String
    var createdAt: Date
    var updatedAt: Date?

    init(from note: ContactNote) {
        self.id = note.id
        self.contactPubkey = note.contactPubkey
        self.content = note.content
        self.categoryRaw = note.category.rawValue
        self.createdAt = note.createdAt
        self.updatedAt = note.updatedAt
    }

    func toDomain() -> ContactNote {
        ContactNote(
            id: id,
            contactPubkey: contactPubkey,
            content: content,
            category: NoteCategory(rawValue: categoryRaw) ?? .general,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

@Model
final class ContactTagEntity {
    @Attribute(.unique) var id: String
    var name: String
    var color: String
    var groupId: String?
    var createdAt: Date

    init(from tag: ContactTag) {
        self.id = tag.id
        self.name = tag.name
        self.color = tag.color
        self.groupId = tag.groupId
        self.createdAt = tag.createdAt
    }

    func toDomain() -> ContactTag {
        ContactTag(
            id: id,
            name: name,
            color: color,
            groupId: groupId,
            createdAt: createdAt
        )
    }
}

@Model
final class ContactTagAssignmentEntity {
    @Attribute(.unique) var id: String
    var contactPubkey: String
    var tagId: String
    var assignedAt: Date

    init(from assignment: ContactTagAssignment) {
        self.id = assignment.id
        self.contactPubkey = assignment.contactPubkey
        self.tagId = assignment.tagId
        self.assignedAt = assignment.assignedAt
    }

    func toDomain() -> ContactTagAssignment {
        ContactTagAssignment(
            id: id,
            contactPubkey: contactPubkey,
            tagId: tagId,
            assignedAt: assignedAt
        )
    }
}

// MARK: - Store

@MainActor
final class ContactNotesStore: ObservableObject {
    private let modelContainer: ModelContainer
    private var modelContext: ModelContext { modelContainer.mainContext }

    init(modelContainer: ModelContainer) {
        self.modelContainer = modelContainer
    }

    // MARK: - Notes

    func getAllNotes() -> [ContactNote] {
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        do {
            let entities = try modelContext.fetch(descriptor)
            return entities.map { $0.toDomain() }
        } catch {
            print("Error fetching notes: \(error)")
            return []
        }
    }

    func getNotes(for contactPubkey: String) -> [ContactNote] {
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            predicate: #Predicate { $0.contactPubkey == contactPubkey },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        do {
            let entities = try modelContext.fetch(descriptor)
            return entities.map { $0.toDomain() }
        } catch {
            print("Error fetching notes for contact: \(error)")
            return []
        }
    }

    func getNotes(by category: NoteCategory) -> [ContactNote] {
        let categoryRaw = category.rawValue
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            predicate: #Predicate { $0.categoryRaw == categoryRaw },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        do {
            let entities = try modelContext.fetch(descriptor)
            return entities.map { $0.toDomain() }
        } catch {
            print("Error fetching notes by category: \(error)")
            return []
        }
    }

    func saveNote(_ note: ContactNote) throws {
        // Check if note exists
        let noteId = note.id
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            predicate: #Predicate { $0.id == noteId }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.content = note.content
            existing.categoryRaw = note.category.rawValue
            existing.updatedAt = Date()
        } else {
            modelContext.insert(ContactNoteEntity(from: note))
        }

        try modelContext.save()
    }

    func deleteNote(_ note: ContactNote) throws {
        let noteId = note.id
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            predicate: #Predicate { $0.id == noteId }
        )

        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    // MARK: - Tags

    func getAllTags(groupId: String? = nil) -> [ContactTag] {
        var descriptor: FetchDescriptor<ContactTagEntity>

        if let groupId = groupId {
            descriptor = FetchDescriptor<ContactTagEntity>(
                predicate: #Predicate { $0.groupId == groupId || $0.groupId == nil },
                sortBy: [SortDescriptor(\.name)]
            )
        } else {
            descriptor = FetchDescriptor<ContactTagEntity>(
                sortBy: [SortDescriptor(\.name)]
            )
        }

        do {
            let entities = try modelContext.fetch(descriptor)
            return entities.map { $0.toDomain() }
        } catch {
            print("Error fetching tags: \(error)")
            return []
        }
    }

    func saveTag(_ tag: ContactTag) throws {
        let tagId = tag.id
        let descriptor = FetchDescriptor<ContactTagEntity>(
            predicate: #Predicate { $0.id == tagId }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.name = tag.name
            existing.color = tag.color
        } else {
            modelContext.insert(ContactTagEntity(from: tag))
        }

        try modelContext.save()
    }

    func deleteTag(_ tag: ContactTag) throws {
        let tagId = tag.id

        // Delete tag assignments first
        let assignmentDescriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.tagId == tagId }
        )
        let assignments = try modelContext.fetch(assignmentDescriptor)
        for assignment in assignments {
            modelContext.delete(assignment)
        }

        // Delete the tag
        let tagDescriptor = FetchDescriptor<ContactTagEntity>(
            predicate: #Predicate { $0.id == tagId }
        )
        if let entity = try modelContext.fetch(tagDescriptor).first {
            modelContext.delete(entity)
        }

        try modelContext.save()
    }

    // MARK: - Tag Assignments

    func getTags(for contactPubkey: String) -> [ContactTag] {
        let assignmentDescriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.contactPubkey == contactPubkey }
        )

        do {
            let assignments = try modelContext.fetch(assignmentDescriptor)
            let tagIds = assignments.map { $0.tagId }

            let tagDescriptor = FetchDescriptor<ContactTagEntity>(
                sortBy: [SortDescriptor(\.name)]
            )
            let allTags = try modelContext.fetch(tagDescriptor)

            return allTags
                .filter { tagIds.contains($0.id) }
                .map { $0.toDomain() }
        } catch {
            print("Error fetching tags for contact: \(error)")
            return []
        }
    }

    func getContacts(with tagId: String) -> [String] {
        let descriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.tagId == tagId }
        )

        do {
            let assignments = try modelContext.fetch(descriptor)
            return assignments.map { $0.contactPubkey }
        } catch {
            print("Error fetching contacts with tag: \(error)")
            return []
        }
    }

    func assignTag(_ tagId: String, to contactPubkey: String) throws {
        let descriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.tagId == tagId && $0.contactPubkey == contactPubkey }
        )

        // Check if already assigned
        if try !modelContext.fetch(descriptor).isEmpty {
            return
        }

        let assignment = ContactTagAssignment(
            contactPubkey: contactPubkey,
            tagId: tagId
        )
        modelContext.insert(ContactTagAssignmentEntity(from: assignment))
        try modelContext.save()
    }

    func removeTag(_ tagId: String, from contactPubkey: String) throws {
        let descriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.tagId == tagId && $0.contactPubkey == contactPubkey }
        )

        if let assignment = try modelContext.fetch(descriptor).first {
            modelContext.delete(assignment)
            try modelContext.save()
        }
    }

    func setTags(_ tagIds: [String], for contactPubkey: String) throws {
        // Remove all existing assignments
        let existingDescriptor = FetchDescriptor<ContactTagAssignmentEntity>(
            predicate: #Predicate { $0.contactPubkey == contactPubkey }
        )
        let existing = try modelContext.fetch(existingDescriptor)
        for assignment in existing {
            modelContext.delete(assignment)
        }

        // Add new assignments
        for tagId in tagIds {
            let assignment = ContactTagAssignment(
                contactPubkey: contactPubkey,
                tagId: tagId
            )
            modelContext.insert(ContactTagAssignmentEntity(from: assignment))
        }

        try modelContext.save()
    }

    // MARK: - Search

    func searchNotes(query: String) -> [ContactNote] {
        let lowercaseQuery = query.lowercased()
        let descriptor = FetchDescriptor<ContactNoteEntity>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )

        do {
            let entities = try modelContext.fetch(descriptor)
            return entities
                .filter { $0.content.lowercased().contains(lowercaseQuery) }
                .map { $0.toDomain() }
        } catch {
            print("Error searching notes: \(error)")
            return []
        }
    }

    // MARK: - Predefined Tags

    func ensurePredefinedTags(groupId: String? = nil) throws {
        let existingTags = getAllTags(groupId: groupId)
        let existingNames = Set(existingTags.map { $0.name })

        for predefined in PredefinedTag.allCases {
            if !existingNames.contains(predefined.rawValue) {
                let tag = predefined.toContactTag(groupId: groupId)
                modelContext.insert(ContactTagEntity(from: tag))
            }
        }

        try modelContext.save()
    }
}
