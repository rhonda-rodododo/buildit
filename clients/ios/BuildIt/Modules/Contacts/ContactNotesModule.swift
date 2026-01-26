// ContactNotesModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Module registration for Contact Notes and Tags.

import Foundation
import SwiftData

/// BuildIt module for contact notes and tags.
final class ContactNotesModule: BuildItModule {
    static let id = "contact-notes"
    static let name = "Contact Notes & Tags"
    static let description = "Track notes and organize contacts with custom tags"
    static let version = "1.0.0"
    static let icon = "note.text.badge.plus"

    private(set) var store: ContactNotesStore?
    private(set) var service: ContactNotesService?

    /// Nostr event kinds used by this module (none - local only).
    let nostrKinds: [Int] = []

    /// Required permissions (none needed).
    let requiredPermissions: [String] = []

    /// Module dependencies.
    let dependencies: [String] = []

    /// Whether the module is enabled.
    var isEnabled: Bool { true }

    /// Initialize the module with SwiftData container.
    @MainActor
    func initialize(with container: ModelContainer) async throws {
        store = ContactNotesStore(modelContainer: container)
        service = ContactNotesService(store: store!)

        // Ensure predefined tags exist
        try service?.ensurePredefinedTags()
    }

    /// Cleanup resources.
    func cleanup() async {
        store = nil
        service = nil
    }
}

// MARK: - Module Registry Extension

extension ModuleRegistry {
    /// Gets the Contact Notes module.
    var contactNotes: ContactNotesModule? {
        getModule(ContactNotesModule.id) as? ContactNotesModule
    }

    /// Gets the Contact Notes service.
    @MainActor
    var contactNotesService: ContactNotesService? {
        contactNotes?.service
    }
}
