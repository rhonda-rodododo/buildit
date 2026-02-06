// WikiModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for wiki and knowledge base.
// Protocol types imported from generated schemas; UI-only extensions defined locally.

import Foundation

// Re-export protocol types from generated schema.
// The following types come from Sources/Generated/Schemas/wiki.swift:
//   WikiPage, PageStatus, PageVisibility, PermissionsClass, PagePermissions,
//   PageRevision, EditType, WikiCategory, WikiLink, PageComment,
//   EditSuggestion, Status (suggestion status), WikiSearch, WikiSchema

// MARK: - UI Extensions for PageStatus

extension PageStatus: CaseIterable {
    public static var allCases: [PageStatus] {
        [.draft, .review, .published, .archived, .deleted]
    }

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .review: return "In Review"
        case .published: return "Published"
        case .archived: return "Archived"
        case .deleted: return "Deleted"
        }
    }

    var icon: String {
        switch self {
        case .draft: return "doc"
        case .review: return "eye"
        case .published: return "checkmark.circle"
        case .archived: return "archivebox"
        case .deleted: return "trash"
        }
    }
}

// MARK: - UI Extensions for PageVisibility

extension PageVisibility: CaseIterable {
    public static var allCases: [PageVisibility] {
        [.pageVisibilityPublic, .group, .pageVisibilityPrivate, .roleRestricted]
    }

    var displayName: String {
        switch self {
        case .pageVisibilityPublic: return "Public"
        case .group: return "Group Only"
        case .pageVisibilityPrivate: return "Private"
        case .roleRestricted: return "Role Restricted"
        }
    }
}

// MARK: - UI Extensions for EditType

extension EditType: CaseIterable {
    public static var allCases: [EditType] {
        [.create, .edit, .revert, .merge, .move]
    }
}

// MARK: - UI Extensions for Status (Suggestion Status)

extension Status: CaseIterable {
    public static var allCases: [Status] {
        [.pending, .approved, .rejected, .merged, .superseded]
    }
}

// MARK: - UI View Helpers for WikiPage

extension WikiPage {
    public var isPublished: Bool {
        status == .published
    }

    public var isLocked: Bool {
        lockedBy != nil
    }

    /// Word count of content
    public var wordCount: Int {
        content.split(whereSeparator: { $0.isWhitespace }).count
    }

    /// Estimated reading time in minutes
    public var readingTime: Int {
        max(1, wordCount / 200)
    }
}

// MARK: - UI View Helpers for WikiSearch

extension WikiSearch {
    /// Convenience ID for Identifiable conformance in UI lists
    public var listId: String {
        pageID
    }
}

// MARK: - UI View Helpers for PageComment

extension PageComment {
    public var isReply: Bool {
        parentID != nil
    }

    public var isDeleted: Bool {
        // Generated type uses deletedAt/editedAt as Int? (Unix timestamps)
        // Check if deletedAt is set
        deletedAt != nil
    }
}

// MARK: - UI View Helpers for EditSuggestion

extension EditSuggestion {
    public var isPending: Bool {
        status == .pending
    }

    public var isReviewed: Bool {
        reviewedBy != nil
    }
}

// MARK: - UI-Only Types

/// Table of contents entry extracted from page content (UI-only, not in protocol schema)
public struct TableOfContentsEntry: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let level: Int // 1-6 for h1-h6
    public let anchor: String

    public init(id: String = UUID().uuidString, title: String, level: Int, anchor: String) {
        self.id = id
        self.title = title
        self.level = level
        self.anchor = anchor
    }
}
