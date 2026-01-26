// ContactNotesModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Models for organizer contact notes and tags.

import Foundation

/// A note attached to a contact for organizer tracking.
struct ContactNote: Identifiable, Codable, Hashable {
    let id: String
    let contactPubkey: String
    let content: String
    let category: NoteCategory
    let createdAt: Date
    var updatedAt: Date?

    init(
        id: String = UUID().uuidString,
        contactPubkey: String,
        content: String,
        category: NoteCategory = .general,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.contactPubkey = contactPubkey
        self.content = content
        self.category = category
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Category of a contact note.
enum NoteCategory: String, Codable, CaseIterable {
    case general = "general"
    case meeting = "meeting"
    case followUp = "follow_up"
    case concern = "concern"
    case positive = "positive"
    case task = "task"

    var displayName: String {
        switch self {
        case .general: return "General"
        case .meeting: return "Meeting"
        case .followUp: return "Follow Up"
        case .concern: return "Concern"
        case .positive: return "Positive"
        case .task: return "Task"
        }
    }

    var icon: String {
        switch self {
        case .general: return "note.text"
        case .meeting: return "person.2"
        case .followUp: return "arrow.turn.up.right"
        case .concern: return "exclamationmark.triangle"
        case .positive: return "star"
        case .task: return "checklist"
        }
    }
}

/// A custom tag for categorizing contacts.
struct ContactTag: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let color: String
    let groupId: String?
    let createdAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        color: String = "#3B82F6",
        groupId: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.groupId = groupId
        self.createdAt = createdAt
    }
}

/// Association between a contact and a tag.
struct ContactTagAssignment: Identifiable, Codable, Hashable {
    let id: String
    let contactPubkey: String
    let tagId: String
    let assignedAt: Date

    init(
        id: String = UUID().uuidString,
        contactPubkey: String,
        tagId: String,
        assignedAt: Date = Date()
    ) {
        self.id = id
        self.contactPubkey = contactPubkey
        self.tagId = tagId
        self.assignedAt = assignedAt
    }
}

/// Common predefined tags for organizers.
enum PredefinedTag: String, CaseIterable {
    case volunteer = "Volunteer"
    case member = "Member"
    case leader = "Leader"
    case mediaContact = "Media Contact"
    case ally = "Ally"
    case potential = "Potential"
    case inactive = "Inactive"
    case unionRep = "Union Rep"
    case steward = "Steward"
    case donor = "Donor"

    var color: String {
        switch self {
        case .volunteer: return "#10B981"
        case .member: return "#3B82F6"
        case .leader: return "#8B5CF6"
        case .mediaContact: return "#F59E0B"
        case .ally: return "#06B6D4"
        case .potential: return "#6B7280"
        case .inactive: return "#9CA3AF"
        case .unionRep: return "#EF4444"
        case .steward: return "#EC4899"
        case .donor: return "#14B8A6"
        }
    }

    func toContactTag(groupId: String? = nil) -> ContactTag {
        ContactTag(
            name: self.rawValue,
            color: self.color,
            groupId: groupId
        )
    }
}

/// Contact with all their notes and tags for display.
struct ContactWithNotesAndTags {
    let contactPubkey: String
    let displayName: String?
    let notes: [ContactNote]
    let tags: [ContactTag]

    var hasNotes: Bool { !notes.isEmpty }
    var hasTags: Bool { !tags.isEmpty }

    var recentNote: ContactNote? {
        notes.sorted { ($0.updatedAt ?? $0.createdAt) > ($1.updatedAt ?? $1.createdAt) }.first
    }
}

/// Filter options for contacts by tags.
struct ContactTagFilter {
    var includedTags: Set<String> = []
    var excludedTags: Set<String> = []
    var requireAll: Bool = false

    var isEmpty: Bool {
        includedTags.isEmpty && excludedTags.isEmpty
    }

    func matches(contactTags: [ContactTag]) -> Bool {
        let contactTagIds = Set(contactTags.map { $0.id })

        // Check excluded tags first
        if !excludedTags.isEmpty {
            if !excludedTags.isDisjoint(with: contactTagIds) {
                return false
            }
        }

        // Check included tags
        if includedTags.isEmpty {
            return true
        }

        if requireAll {
            return includedTags.isSubset(of: contactTagIds)
        } else {
            return !includedTags.isDisjoint(with: contactTagIds)
        }
    }
}
