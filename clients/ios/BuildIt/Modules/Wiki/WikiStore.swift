// WikiStore.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData persistence for wiki data.

import Foundation
import SwiftData
import os.log

// MARK: - SwiftData Models

@Model
public final class WikiPageEntity {
    @Attribute(.unique) public var id: String
    public var groupId: String
    public var slug: String
    public var title: String
    public var content: String
    public var summary: String?
    public var version: Int
    public var parentId: String?
    public var categoryId: String?
    public var statusRaw: String
    public var visibilityRaw: String
    public var tagsJson: String
    public var createdBy: String
    public var lastEditedBy: String?
    public var contributorsJson: String
    public var createdAt: Date
    public var updatedAt: Date?
    public var publishedAt: Date?
    public var archivedAt: Date?

    public init(
        id: String,
        groupId: String,
        slug: String,
        title: String,
        content: String,
        summary: String?,
        version: Int,
        parentId: String?,
        categoryId: String?,
        statusRaw: String,
        visibilityRaw: String,
        tagsJson: String,
        createdBy: String,
        lastEditedBy: String?,
        contributorsJson: String,
        createdAt: Date,
        updatedAt: Date?,
        publishedAt: Date?,
        archivedAt: Date?
    ) {
        self.id = id
        self.groupId = groupId
        self.slug = slug
        self.title = title
        self.content = content
        self.summary = summary
        self.version = version
        self.parentId = parentId
        self.categoryId = categoryId
        self.statusRaw = statusRaw
        self.visibilityRaw = visibilityRaw
        self.tagsJson = tagsJson
        self.createdBy = createdBy
        self.lastEditedBy = lastEditedBy
        self.contributorsJson = contributorsJson
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.publishedAt = publishedAt
        self.archivedAt = archivedAt
    }
}

@Model
public final class WikiCategoryEntity {
    @Attribute(.unique) public var id: String
    public var groupId: String
    public var name: String
    public var slug: String
    public var descriptionText: String?
    public var parentId: String?
    public var icon: String?
    public var color: String?
    public var order: Int
    public var pageCount: Int
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?

    public init(
        id: String,
        groupId: String,
        name: String,
        slug: String,
        descriptionText: String?,
        parentId: String?,
        icon: String?,
        color: String?,
        order: Int,
        pageCount: Int,
        createdBy: String,
        createdAt: Date,
        updatedAt: Date?
    ) {
        self.id = id
        self.groupId = groupId
        self.name = name
        self.slug = slug
        self.descriptionText = descriptionText
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

@Model
public final class PageRevisionEntity {
    @Attribute(.unique) public var id: String
    public var pageId: String
    public var version: Int
    public var title: String
    public var content: String
    public var summary: String?
    public var diff: String?
    public var editedBy: String
    public var editTypeRaw: String
    public var revertedFrom: Int?
    public var createdAt: Date

    public init(
        id: String,
        pageId: String,
        version: Int,
        title: String,
        content: String,
        summary: String?,
        diff: String?,
        editedBy: String,
        editTypeRaw: String,
        revertedFrom: Int?,
        createdAt: Date
    ) {
        self.id = id
        self.pageId = pageId
        self.version = version
        self.title = title
        self.content = content
        self.summary = summary
        self.diff = diff
        self.editedBy = editedBy
        self.editTypeRaw = editTypeRaw
        self.revertedFrom = revertedFrom
        self.createdAt = createdAt
    }
}

// MARK: - WikiStore

@MainActor
public final class WikiStore {
    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "WikiStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init() throws {
        let schema = Schema([
            WikiPageEntity.self,
            WikiCategoryEntity.self,
            PageRevisionEntity.self
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [config])
        self.modelContext = modelContainer.mainContext
    }

    // MARK: - Pages

    public func savePage(_ page: WikiPage) throws {
        let tagsData = try encoder.encode(page.tags)
        let tagsJson = String(data: tagsData, encoding: .utf8) ?? "[]"

        let contributorsData = try encoder.encode(page.contributors)
        let contributorsJson = String(data: contributorsData, encoding: .utf8) ?? "[]"

        let entity = WikiPageEntity(
            id: page.id,
            groupId: page.groupId,
            slug: page.slug,
            title: page.title,
            content: page.content,
            summary: page.summary,
            version: page.version,
            parentId: page.parentId,
            categoryId: page.categoryId,
            statusRaw: page.status.rawValue,
            visibilityRaw: page.visibility.rawValue,
            tagsJson: tagsJson,
            createdBy: page.createdBy,
            lastEditedBy: page.lastEditedBy,
            contributorsJson: contributorsJson,
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
            publishedAt: page.publishedAt,
            archivedAt: page.archivedAt
        )

        modelContext.insert(entity)
        try modelContext.save()
        logger.debug("Saved page: \(page.id)")
    }

    public func getPage(id: String) throws -> WikiPage? {
        let descriptor = FetchDescriptor<WikiPageEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToPage(entity)
    }

    public func getPageBySlug(slug: String, groupId: String) throws -> WikiPage? {
        let descriptor = FetchDescriptor<WikiPageEntity>(
            predicate: #Predicate { $0.slug == slug && $0.groupId == groupId }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return try entityToPage(entity)
    }

    public func getPublishedPages(groupId: String? = nil, categoryId: String? = nil) throws -> [WikiPage] {
        let publishedStatus = PageStatus.published.rawValue
        var descriptor = FetchDescriptor<WikiPageEntity>(
            sortBy: [SortDescriptor(\.title, order: .forward)]
        )

        if let groupId = groupId, let categoryId = categoryId {
            descriptor.predicate = #Predicate {
                $0.statusRaw == publishedStatus && $0.groupId == groupId && $0.categoryId == categoryId
            }
        } else if let groupId = groupId {
            descriptor.predicate = #Predicate {
                $0.statusRaw == publishedStatus && $0.groupId == groupId
            }
        } else {
            descriptor.predicate = #Predicate { $0.statusRaw == publishedStatus }
        }

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToPage($0) }
    }

    public func getRecentPages(limit: Int = 10) throws -> [WikiPage] {
        let publishedStatus = PageStatus.published.rawValue
        var descriptor = FetchDescriptor<WikiPageEntity>(
            predicate: #Predicate { $0.statusRaw == publishedStatus },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        descriptor.fetchLimit = limit

        let entities = try modelContext.fetch(descriptor)
        return try entities.compactMap { try entityToPage($0) }
    }

    public func searchPages(query: String, groupId: String? = nil) throws -> [WikiPage] {
        let publishedStatus = PageStatus.published.rawValue
        let lowercaseQuery = query.lowercased()

        var descriptor = FetchDescriptor<WikiPageEntity>(
            predicate: #Predicate { $0.statusRaw == publishedStatus },
            sortBy: [SortDescriptor(\.title, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)

        // Filter by search query (title, content, tags)
        let filtered = entities.filter { entity in
            if let gId = groupId, entity.groupId != gId { return false }
            return entity.title.lowercased().contains(lowercaseQuery) ||
                   entity.content.lowercased().contains(lowercaseQuery) ||
                   (entity.summary?.lowercased().contains(lowercaseQuery) ?? false)
        }

        return try filtered.compactMap { try entityToPage($0) }
    }

    public func deletePage(id: String) throws {
        let descriptor = FetchDescriptor<WikiPageEntity>(
            predicate: #Predicate { $0.id == id }
        )
        if let entity = try modelContext.fetch(descriptor).first {
            modelContext.delete(entity)
            try modelContext.save()
        }
    }

    private func entityToPage(_ entity: WikiPageEntity) throws -> WikiPage {
        let tags: [String] = (try? decoder.decode([String].self, from: entity.tagsJson.data(using: .utf8) ?? Data())) ?? []
        let contributors: [String] = (try? decoder.decode([String].self, from: entity.contributorsJson.data(using: .utf8) ?? Data())) ?? []

        return WikiPage(
            id: entity.id,
            groupId: entity.groupId,
            slug: entity.slug,
            title: entity.title,
            content: entity.content,
            summary: entity.summary,
            version: entity.version,
            parentId: entity.parentId,
            categoryId: entity.categoryId,
            status: PageStatus(rawValue: entity.statusRaw) ?? .draft,
            visibility: PageVisibility(rawValue: entity.visibilityRaw) ?? .group,
            tags: tags,
            createdBy: entity.createdBy,
            lastEditedBy: entity.lastEditedBy,
            contributors: contributors,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            publishedAt: entity.publishedAt,
            archivedAt: entity.archivedAt
        )
    }

    // MARK: - Categories

    public func saveCategory(_ category: WikiCategory) throws {
        let entity = WikiCategoryEntity(
            id: category.id,
            groupId: category.groupId,
            name: category.name,
            slug: category.slug,
            descriptionText: category.description,
            parentId: category.parentId,
            icon: category.icon,
            color: category.color,
            order: category.order,
            pageCount: category.pageCount,
            createdBy: category.createdBy,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt
        )

        modelContext.insert(entity)
        try modelContext.save()
    }

    public func getCategories(groupId: String) throws -> [WikiCategory] {
        let descriptor = FetchDescriptor<WikiCategoryEntity>(
            predicate: #Predicate { $0.groupId == groupId },
            sortBy: [SortDescriptor(\.order, order: .forward)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToCategory($0) }
    }

    public func getCategory(id: String) throws -> WikiCategory? {
        let descriptor = FetchDescriptor<WikiCategoryEntity>(
            predicate: #Predicate { $0.id == id }
        )
        guard let entity = try modelContext.fetch(descriptor).first else {
            return nil
        }
        return entityToCategory(entity)
    }

    private func entityToCategory(_ entity: WikiCategoryEntity) -> WikiCategory {
        WikiCategory(
            id: entity.id,
            groupId: entity.groupId,
            name: entity.name,
            slug: entity.slug,
            description: entity.descriptionText,
            parentId: entity.parentId,
            icon: entity.icon,
            color: entity.color,
            order: entity.order,
            pageCount: entity.pageCount,
            createdBy: entity.createdBy,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        )
    }

    // MARK: - Revisions

    public func saveRevision(_ revision: PageRevision) throws {
        let entity = PageRevisionEntity(
            id: revision.id,
            pageId: revision.pageId,
            version: revision.version,
            title: revision.title,
            content: revision.content,
            summary: revision.summary,
            diff: revision.diff,
            editedBy: revision.editedBy,
            editTypeRaw: revision.editType.rawValue,
            revertedFrom: revision.revertedFrom,
            createdAt: revision.createdAt
        )

        modelContext.insert(entity)
        try modelContext.save()
    }

    public func getRevisions(pageId: String) throws -> [PageRevision] {
        let descriptor = FetchDescriptor<PageRevisionEntity>(
            predicate: #Predicate { $0.pageId == pageId },
            sortBy: [SortDescriptor(\.version, order: .reverse)]
        )

        let entities = try modelContext.fetch(descriptor)
        return entities.map { entityToRevision($0) }
    }

    private func entityToRevision(_ entity: PageRevisionEntity) -> PageRevision {
        PageRevision(
            id: entity.id,
            pageId: entity.pageId,
            version: entity.version,
            title: entity.title,
            content: entity.content,
            summary: entity.summary,
            diff: entity.diff,
            editedBy: entity.editedBy,
            editType: EditType(rawValue: entity.editTypeRaw) ?? .edit,
            revertedFrom: entity.revertedFrom,
            createdAt: entity.createdAt
        )
    }
}
