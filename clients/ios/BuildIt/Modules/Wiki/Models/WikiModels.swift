// WikiModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for wiki and knowledge base.

import Foundation

// MARK: - Enums

/// Status of a wiki page
public enum PageStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case review
    case published
    case archived
    case deleted

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

/// Visibility of a wiki page
public enum PageVisibility: String, Codable, Sendable {
    case `public`
    case group
    case `private`
    case roleRestricted = "role-restricted"

    var displayName: String {
        switch self {
        case .public: return "Public"
        case .group: return "Group Only"
        case .private: return "Private"
        case .roleRestricted: return "Role Restricted"
        }
    }
}

/// Type of edit made to a page
public enum EditType: String, Codable, Sendable {
    case create
    case edit
    case revert
    case merge
    case move
}

// MARK: - Models

/// A wiki page in the knowledge base
public struct WikiPage: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let groupId: String
    public let slug: String
    public let title: String
    public let content: String
    public let summary: String?
    public let version: Int
    public let parentId: String?
    public let categoryId: String?
    public var status: PageStatus
    public let visibility: PageVisibility
    public let tags: [String]
    public let createdBy: String
    public let lastEditedBy: String?
    public let contributors: [String]
    public let createdAt: Date
    public var updatedAt: Date?
    public var publishedAt: Date?
    public var archivedAt: Date?

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, groupId, slug, title, content, summary
        case version, parentId, categoryId, status, visibility
        case tags, createdBy, lastEditedBy, contributors
        case createdAt, updatedAt, publishedAt, archivedAt
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        groupId: String,
        slug: String,
        title: String,
        content: String,
        summary: String? = nil,
        version: Int = 1,
        parentId: String? = nil,
        categoryId: String? = nil,
        status: PageStatus = .draft,
        visibility: PageVisibility = .group,
        tags: [String] = [],
        createdBy: String,
        lastEditedBy: String? = nil,
        contributors: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        publishedAt: Date? = nil,
        archivedAt: Date? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.groupId = groupId
        self.slug = slug
        self.title = title
        self.content = content
        self.summary = summary
        self.version = version
        self.parentId = parentId
        self.categoryId = categoryId
        self.status = status
        self.visibility = visibility
        self.tags = tags
        self.createdBy = createdBy
        self.lastEditedBy = lastEditedBy
        self.contributors = contributors
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.publishedAt = publishedAt
        self.archivedAt = archivedAt
    }

    public var isPublished: Bool {
        status == .published
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

/// A category for organizing wiki pages
public struct WikiCategory: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let groupId: String
    public let name: String
    public let slug: String
    public let description: String?
    public let parentId: String?
    public let icon: String?
    public let color: String?
    public let order: Int
    public var pageCount: Int
    public let createdBy: String
    public let createdAt: Date
    public var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, groupId, name, slug, description
        case parentId, icon, color, order, pageCount
        case createdBy, createdAt, updatedAt
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        groupId: String,
        name: String,
        slug: String,
        description: String? = nil,
        parentId: String? = nil,
        icon: String? = nil,
        color: String? = nil,
        order: Int = 0,
        pageCount: Int = 0,
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.groupId = groupId
        self.name = name
        self.slug = slug
        self.description = description
        self.parentId = parentId
        self.icon = icon
        self.color = color
        self.order = order
        self.pageCount = pageCount
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// A historical revision of a wiki page
public struct PageRevision: Identifiable, Codable, Sendable {
    public let schemaVersion: String
    public let id: String
    public let pageId: String
    public let version: Int
    public let title: String
    public let content: String
    public let summary: String?
    public let diff: String?
    public let editedBy: String
    public let editType: EditType
    public let revertedFrom: Int?
    public let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "_v"
        case id, pageId, version, title, content
        case summary, diff, editedBy, editType
        case revertedFrom, createdAt
    }

    public init(
        schemaVersion: String = "1.0.0",
        id: String = UUID().uuidString,
        pageId: String,
        version: Int,
        title: String,
        content: String,
        summary: String? = nil,
        diff: String? = nil,
        editedBy: String,
        editType: EditType = .edit,
        revertedFrom: Int? = nil,
        createdAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.pageId = pageId
        self.version = version
        self.title = title
        self.content = content
        self.summary = summary
        self.diff = diff
        self.editedBy = editedBy
        self.editType = editType
        self.revertedFrom = revertedFrom
        self.createdAt = createdAt
    }
}

/// A search result from the wiki
public struct WikiSearchResult: Identifiable, Codable, Sendable {
    public let id: String // pageId
    public let pageId: String
    public let title: String
    public let slug: String
    public let summary: String?
    public let excerpt: String?
    public let score: Double
    public let matchedTags: [String]
    public let categoryName: String?
    public let updatedAt: Date?

    public init(
        pageId: String,
        title: String,
        slug: String,
        summary: String? = nil,
        excerpt: String? = nil,
        score: Double,
        matchedTags: [String] = [],
        categoryName: String? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = pageId
        self.pageId = pageId
        self.title = title
        self.slug = slug
        self.summary = summary
        self.excerpt = excerpt
        self.score = score
        self.matchedTags = matchedTags
        self.categoryName = categoryName
        self.updatedAt = updatedAt
    }
}

/// Table of contents entry extracted from page content
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
