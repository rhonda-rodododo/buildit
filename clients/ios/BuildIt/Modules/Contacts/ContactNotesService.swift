// ContactNotesService.swift
// BuildIt - Decentralized Mesh Communication
//
// Service for contact notes and tags business logic.

import Foundation
import SwiftData

/// Service for managing contact notes and tags.
@MainActor
final class ContactNotesService: ObservableObject {
    private let store: ContactNotesStore

    init(store: ContactNotesStore) {
        self.store = store
    }

    // MARK: - Notes Operations

    /// Gets all notes for a contact.
    func getNotes(for contactPubkey: String) -> [ContactNote] {
        store.getNotes(for: contactPubkey)
    }

    /// Gets the most recent note for a contact.
    func getMostRecentNote(for contactPubkey: String) -> ContactNote? {
        store.getNotes(for: contactPubkey).first
    }

    /// Gets notes requiring follow-up.
    func getFollowUpNotes() -> [ContactNote] {
        store.getNotes(by: .followUp)
    }

    /// Creates a new note for a contact.
    func createNote(
        for contactPubkey: String,
        content: String,
        category: NoteCategory = .general
    ) throws -> ContactNote {
        let note = ContactNote(
            contactPubkey: contactPubkey,
            content: content,
            category: category
        )
        try store.saveNote(note)
        return note
    }

    /// Updates an existing note.
    func updateNote(_ note: ContactNote, content: String, category: NoteCategory) throws -> ContactNote {
        var updatedNote = note
        updatedNote = ContactNote(
            id: note.id,
            contactPubkey: note.contactPubkey,
            content: content,
            category: category,
            createdAt: note.createdAt,
            updatedAt: Date()
        )
        try store.saveNote(updatedNote)
        return updatedNote
    }

    /// Deletes a note.
    func deleteNote(_ note: ContactNote) throws {
        try store.deleteNote(note)
    }

    /// Searches notes by content.
    func searchNotes(query: String) -> [ContactNote] {
        store.searchNotes(query: query)
    }

    // MARK: - Tags Operations

    /// Gets all available tags.
    func getAllTags(groupId: String? = nil) -> [ContactTag] {
        store.getAllTags(groupId: groupId)
    }

    /// Gets tags assigned to a contact.
    func getTags(for contactPubkey: String) -> [ContactTag] {
        store.getTags(for: contactPubkey)
    }

    /// Creates a new tag.
    func createTag(name: String, color: String, groupId: String? = nil) throws -> ContactTag {
        let tag = ContactTag(name: name, color: color, groupId: groupId)
        try store.saveTag(tag)
        return tag
    }

    /// Updates an existing tag.
    func updateTag(_ tag: ContactTag, name: String, color: String) throws -> ContactTag {
        let updatedTag = ContactTag(
            id: tag.id,
            name: name,
            color: color,
            groupId: tag.groupId,
            createdAt: tag.createdAt
        )
        try store.saveTag(updatedTag)
        return updatedTag
    }

    /// Deletes a tag.
    func deleteTag(_ tag: ContactTag) throws {
        try store.deleteTag(tag)
    }

    /// Assigns a tag to a contact.
    func assignTag(_ tag: ContactTag, to contactPubkey: String) throws {
        try store.assignTag(tag.id, to: contactPubkey)
    }

    /// Removes a tag from a contact.
    func removeTag(_ tag: ContactTag, from contactPubkey: String) throws {
        try store.removeTag(tag.id, from: contactPubkey)
    }

    /// Sets all tags for a contact (replaces existing).
    func setTags(_ tags: [ContactTag], for contactPubkey: String) throws {
        try store.setTags(tags.map { $0.id }, for: contactPubkey)
    }

    /// Gets all contacts with a specific tag.
    func getContactsWithTag(_ tag: ContactTag) -> [String] {
        store.getContacts(with: tag.id)
    }

    // MARK: - Combined Data

    /// Gets contact with all notes and tags.
    func getContactData(pubkey: String, displayName: String?) -> ContactWithNotesAndTags {
        let notes = store.getNotes(for: pubkey)
        let tags = store.getTags(for: pubkey)

        return ContactWithNotesAndTags(
            contactPubkey: pubkey,
            displayName: displayName,
            notes: notes,
            tags: tags
        )
    }

    /// Filters contacts by tags.
    func filterContacts(pubkeys: [String], with filter: ContactTagFilter) -> [String] {
        if filter.isEmpty {
            return pubkeys
        }

        return pubkeys.filter { pubkey in
            let contactTags = store.getTags(for: pubkey)
            return filter.matches(contactTags: contactTags)
        }
    }

    // MARK: - Setup

    /// Ensures predefined tags exist.
    func ensurePredefinedTags(groupId: String? = nil) throws {
        try store.ensurePredefinedTags(groupId: groupId)
    }
}
