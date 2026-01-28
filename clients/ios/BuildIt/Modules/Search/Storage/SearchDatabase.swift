// SearchDatabase.swift
// BuildIt - Decentralized Mesh Communication
//
// SQLite FTS5 wrapper for full-text search.
// Provides thread-safe access to the search index using Swift actors.

import Foundation
import SQLite3
import os.log

// MARK: - SearchDatabaseError

/// Errors that can occur during search database operations
public enum SearchDatabaseError: LocalizedError {
    case databaseNotOpen
    case openFailed(String)
    case queryFailed(String)
    case insertFailed(String)
    case updateFailed(String)
    case deleteFailed(String)
    case schemaInitFailed(String)
    case encodingFailed(String)
    case decodingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .databaseNotOpen:
            return "Database is not open"
        case .openFailed(let message):
            return "Failed to open database: \(message)"
        case .queryFailed(let message):
            return "Query failed: \(message)"
        case .insertFailed(let message):
            return "Insert failed: \(message)"
        case .updateFailed(let message):
            return "Update failed: \(message)"
        case .deleteFailed(let message):
            return "Delete failed: \(message)"
        case .schemaInitFailed(let message):
            return "Schema initialization failed: \(message)"
        case .encodingFailed(let message):
            return "Encoding failed: \(message)"
        case .decodingFailed(let message):
            return "Decoding failed: \(message)"
        }
    }
}

// MARK: - SearchDatabase

/// Thread-safe SQLite FTS5 database wrapper for search indexing
public actor SearchDatabase {
    // MARK: - Properties

    private var db: OpaquePointer?
    private let dbPath: String
    private let logger = Logger(subsystem: "com.buildit", category: "SearchDatabase")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// Whether the database is open
    public var isOpen: Bool { db != nil }

    // MARK: - Initialization

    /// Initialize the search database
    /// - Parameter dbPath: Path to the database file (default: app documents directory)
    public init(dbPath: String? = nil) {
        if let dbPath = dbPath {
            self.dbPath = dbPath
        } else {
            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            self.dbPath = documentsPath.appendingPathComponent("search.sqlite").path
        }
    }

    // MARK: - Database Lifecycle

    /// Open the database and initialize schema
    public func open() throws {
        guard db == nil else { return }

        var dbPointer: OpaquePointer?
        let result = sqlite3_open_v2(
            dbPath,
            &dbPointer,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
            nil
        )

        guard result == SQLITE_OK, let pointer = dbPointer else {
            let errorMessage = String(cString: sqlite3_errmsg(dbPointer))
            sqlite3_close(dbPointer)
            throw SearchDatabaseError.openFailed(errorMessage)
        }

        db = pointer

        // Enable WAL mode for better concurrent access
        try execute("PRAGMA journal_mode = WAL")
        try execute("PRAGMA synchronous = NORMAL")
        try execute("PRAGMA foreign_keys = ON")

        // Initialize schema
        try initializeSchema()

        logger.info("Search database opened at \(self.dbPath)")
    }

    /// Close the database
    public func close() {
        guard let db = db else { return }
        sqlite3_close(db)
        self.db = nil
        logger.info("Search database closed")
    }

    /// Initialize the database schema
    private func initializeSchema() throws {
        // Read schema from embedded SQL file or use inline schema
        let schema = getSchemaSQL()

        let statements = schema.components(separatedBy: ";").filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

        for statement in statements {
            do {
                try execute(statement)
            } catch {
                logger.error("Failed to execute schema statement: \(statement.prefix(100)), error: \(error.localizedDescription)")
                // Continue with other statements - some may fail due to IF NOT EXISTS
            }
        }

        logger.info("Search database schema initialized")
    }

    /// Execute a SQL statement
    @discardableResult
    private func execute(_ sql: String) throws -> Int32 {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        var errorMessage: UnsafeMutablePointer<CChar>?
        let result = sqlite3_exec(db, sql, nil, nil, &errorMessage)

        if result != SQLITE_OK {
            let message = errorMessage != nil ? String(cString: errorMessage!) : "Unknown error"
            sqlite3_free(errorMessage)
            throw SearchDatabaseError.queryFailed(message)
        }

        return result
    }

    // MARK: - Document Operations

    /// Index a document
    public func indexDocument(_ document: SearchDocument) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        // Check if document already exists
        let existingRowId = try getRowId(for: document.id)

        if let rowId = existingRowId {
            // Update existing document
            try updateDocument(document, rowId: rowId)
        } else {
            // Insert new document
            try insertDocument(document)
        }
    }

    /// Insert a new document
    private func insertDocument(_ document: SearchDocument) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        // Insert into FTS5 table
        let ftsSQL = """
            INSERT INTO search_documents (id, module_type, entity_id, group_id, title, content, tags, excerpt, author_pubkey, facets_json, created_at, updated_at, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, ftsSQL, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        let tagsString = document.tags?.joined(separator: " ") ?? ""
        let facetsJSON = try? encoder.encode(document.facets).utf8String

        sqlite3_bind_text(statement, 1, document.id.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, document.moduleType.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, document.entityId.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, document.groupId.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, document.title.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 6, document.content.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 7, tagsString.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 8, (document.excerpt ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 9, (document.authorPubkey ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 10, (facetsJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 11, document.createdAt)
        sqlite3_bind_int64(statement, 12, document.updatedAt)
        sqlite3_bind_int64(statement, 13, document.indexedAt)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }

        let rowId = sqlite3_last_insert_rowid(db)

        // Insert into metadata table
        try insertDocumentMeta(document, rowId: rowId)

        // Update term index
        try updateTermIndex(for: document)

        logger.debug("Indexed document: \(document.id)")
    }

    /// Insert document metadata
    private func insertDocumentMeta(_ document: SearchDocument, rowId: Int64) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = """
            INSERT INTO search_documents_meta (rowid, id, module_type, entity_id, group_id, author_pubkey, facets_json, vector_json, created_at, updated_at, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        let facetsJSON = try? encoder.encode(document.facets).utf8String
        let vectorJSON = try? encoder.encode(document.vector).utf8String

        sqlite3_bind_int64(statement, 1, rowId)
        sqlite3_bind_text(statement, 2, document.id.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, document.moduleType.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, document.entityId.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, document.groupId.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 6, (document.authorPubkey ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 7, (facetsJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 8, (vectorJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 9, document.createdAt)
        sqlite3_bind_int64(statement, 10, document.updatedAt)
        sqlite3_bind_int64(statement, 11, document.indexedAt)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Update an existing document
    private func updateDocument(_ document: SearchDocument, rowId: Int64) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        // Update FTS5 table
        let ftsSQL = """
            UPDATE search_documents SET
                title = ?, content = ?, tags = ?, excerpt = ?, author_pubkey = ?,
                facets_json = ?, updated_at = ?, indexed_at = ?
            WHERE rowid = ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, ftsSQL, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.updateFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        let tagsString = document.tags?.joined(separator: " ") ?? ""
        let facetsJSON = try? encoder.encode(document.facets).utf8String

        sqlite3_bind_text(statement, 1, document.title.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, document.content.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, tagsString.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, (document.excerpt ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, (document.authorPubkey ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 6, (facetsJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 7, document.updatedAt)
        sqlite3_bind_int64(statement, 8, Int64(Date().timeIntervalSince1970 * 1000))
        sqlite3_bind_int64(statement, 9, rowId)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.updateFailed(String(cString: sqlite3_errmsg(db)))
        }

        // Update metadata table
        try updateDocumentMeta(document, rowId: rowId)

        logger.debug("Updated document: \(document.id)")
    }

    /// Update document metadata
    private func updateDocumentMeta(_ document: SearchDocument, rowId: Int64) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = """
            UPDATE search_documents_meta SET
                author_pubkey = ?, facets_json = ?, vector_json = ?,
                updated_at = ?, indexed_at = ?
            WHERE rowid = ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.updateFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        let facetsJSON = try? encoder.encode(document.facets).utf8String
        let vectorJSON = try? encoder.encode(document.vector).utf8String

        sqlite3_bind_text(statement, 1, (document.authorPubkey ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, (facetsJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, (vectorJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 4, document.updatedAt)
        sqlite3_bind_int64(statement, 5, Int64(Date().timeIntervalSince1970 * 1000))
        sqlite3_bind_int64(statement, 6, rowId)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.updateFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Delete a document by ID
    public func deleteDocument(id: String) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        guard let rowId = try getRowId(for: id) else {
            return // Document doesn't exist
        }

        // Delete from FTS5 table
        let ftsSQL = "DELETE FROM search_documents WHERE rowid = ?"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, ftsSQL, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.deleteFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_int64(statement, 1, rowId)
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.deleteFailed(String(cString: sqlite3_errmsg(db)))
        }

        // Delete from metadata table
        try execute("DELETE FROM search_documents_meta WHERE rowid = \(rowId)")

        logger.debug("Deleted document: \(id)")
    }

    /// Get rowid for a document
    private func getRowId(for documentId: String) throws -> Int64? {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = "SELECT rowid FROM search_documents_meta WHERE id = ?"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, documentId.cString, -1, SQLITE_TRANSIENT)

        if sqlite3_step(statement) == SQLITE_ROW {
            return sqlite3_column_int64(statement, 0)
        }
        return nil
    }

    // MARK: - Search Operations

    /// Perform a full-text search
    public func search(
        query: String,
        scope: SearchScope,
        filters: FacetFilters?,
        options: SearchOptions
    ) throws -> (documents: [SearchDocument], totalCount: Int) {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        // Build FTS5 query
        var ftsQuery = sanitizeFTSQuery(query)

        // Build WHERE clauses for scope and filters
        var whereClauses: [String] = []
        var parameters: [Any] = []

        // Apply scope
        switch scope {
        case .global:
            break
        case .group(let groupId):
            whereClauses.append("m.group_id = ?")
            parameters.append(groupId)
        case .module(let moduleType):
            whereClauses.append("m.module_type = ?")
            parameters.append(moduleType)
        case .moduleInGroup(let moduleType, let groupId):
            whereClauses.append("m.module_type = ?")
            whereClauses.append("m.group_id = ?")
            parameters.append(moduleType)
            parameters.append(groupId)
        }

        // Apply filters
        if let filters = filters {
            if let moduleTypes = filters.moduleTypes, !moduleTypes.isEmpty {
                let placeholders = moduleTypes.map { _ in "?" }.joined(separator: ", ")
                whereClauses.append("m.module_type IN (\(placeholders))")
                parameters.append(contentsOf: moduleTypes)
            }
            if let groupIds = filters.groupIds, !groupIds.isEmpty {
                let placeholders = groupIds.map { _ in "?" }.joined(separator: ", ")
                whereClauses.append("m.group_id IN (\(placeholders))")
                parameters.append(contentsOf: groupIds)
            }
            if let authors = filters.authors, !authors.isEmpty {
                let placeholders = authors.map { _ in "?" }.joined(separator: ", ")
                whereClauses.append("m.author_pubkey IN (\(placeholders))")
                parameters.append(contentsOf: authors)
            }
            if let dateRange = filters.dateRange {
                whereClauses.append("m.created_at >= ? AND m.created_at <= ?")
                parameters.append(dateRange.start)
                parameters.append(dateRange.end)
            }
        }

        // Build SQL query
        let whereSQL = whereClauses.isEmpty ? "" : "WHERE " + whereClauses.joined(separator: " AND ")

        // First get total count
        let countSQL = """
            SELECT COUNT(*) FROM search_documents d
            JOIN search_documents_meta m ON d.rowid = m.rowid
            \(query.isEmpty ? whereSQL : "WHERE search_documents MATCH ? \(whereClauses.isEmpty ? "" : "AND " + whereClauses.joined(separator: " AND "))")
        """

        var countStatement: OpaquePointer?
        guard sqlite3_prepare_v2(db, countSQL, -1, &countStatement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(countStatement) }

        var paramIndex: Int32 = 1
        if !query.isEmpty {
            sqlite3_bind_text(countStatement, paramIndex, ftsQuery.cString, -1, SQLITE_TRANSIENT)
            paramIndex += 1
        }
        for param in parameters {
            if let stringParam = param as? String {
                sqlite3_bind_text(countStatement, paramIndex, stringParam.cString, -1, SQLITE_TRANSIENT)
            } else if let intParam = param as? Int64 {
                sqlite3_bind_int64(countStatement, paramIndex, intParam)
            }
            paramIndex += 1
        }

        var totalCount = 0
        if sqlite3_step(countStatement) == SQLITE_ROW {
            totalCount = Int(sqlite3_column_int64(countStatement, 0))
        }

        // Now get paginated results
        let searchSQL = """
            SELECT d.id, d.module_type, d.entity_id, d.group_id, d.title, d.content,
                   d.tags, d.excerpt, d.author_pubkey, d.facets_json, d.created_at,
                   d.updated_at, d.indexed_at, m.vector_json,
                   \(query.isEmpty ? "1.0" : "bm25(search_documents)") AS rank
            FROM search_documents d
            JOIN search_documents_meta m ON d.rowid = m.rowid
            \(query.isEmpty ? whereSQL : "WHERE search_documents MATCH ? \(whereClauses.isEmpty ? "" : "AND " + whereClauses.joined(separator: " AND "))")
            ORDER BY rank
            LIMIT ? OFFSET ?
        """

        var searchStatement: OpaquePointer?
        guard sqlite3_prepare_v2(db, searchSQL, -1, &searchStatement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(searchStatement) }

        paramIndex = 1
        if !query.isEmpty {
            sqlite3_bind_text(searchStatement, paramIndex, ftsQuery.cString, -1, SQLITE_TRANSIENT)
            paramIndex += 1
        }
        for param in parameters {
            if let stringParam = param as? String {
                sqlite3_bind_text(searchStatement, paramIndex, stringParam.cString, -1, SQLITE_TRANSIENT)
            } else if let intParam = param as? Int64 {
                sqlite3_bind_int64(searchStatement, paramIndex, intParam)
            }
            paramIndex += 1
        }
        sqlite3_bind_int(searchStatement, paramIndex, Int32(options.limit))
        sqlite3_bind_int(searchStatement, paramIndex + 1, Int32(options.offset))

        var documents: [SearchDocument] = []
        while sqlite3_step(searchStatement) == SQLITE_ROW {
            if let document = parseDocumentRow(searchStatement) {
                documents.append(document)
            }
        }

        return (documents, totalCount)
    }

    /// Parse a document row from a query result
    private func parseDocumentRow(_ statement: OpaquePointer) -> SearchDocument? {
        guard let id = sqlite3_column_text(statement, 0).map({ String(cString: $0) }),
              let moduleType = sqlite3_column_text(statement, 1).map({ String(cString: $0) }),
              let entityId = sqlite3_column_text(statement, 2).map({ String(cString: $0) }),
              let groupId = sqlite3_column_text(statement, 3).map({ String(cString: $0) }),
              let title = sqlite3_column_text(statement, 4).map({ String(cString: $0) }),
              let content = sqlite3_column_text(statement, 5).map({ String(cString: $0) }) else {
            return nil
        }

        let tagsString = sqlite3_column_text(statement, 6).map { String(cString: $0) } ?? ""
        let tags = tagsString.isEmpty ? nil : tagsString.components(separatedBy: " ")

        let excerpt = sqlite3_column_text(statement, 7).flatMap { String(cString: $0) }
        let authorPubkey = sqlite3_column_text(statement, 8).flatMap { String(cString: $0) }
        let facetsJSON = sqlite3_column_text(statement, 9).flatMap { String(cString: $0) }
        let createdAt = sqlite3_column_int64(statement, 10)
        let updatedAt = sqlite3_column_int64(statement, 11)
        let indexedAt = sqlite3_column_int64(statement, 12)
        let vectorJSON = sqlite3_column_text(statement, 13).flatMap { String(cString: $0) }

        var facets: [String: FacetValue]?
        if let json = facetsJSON, !json.isEmpty, let data = json.data(using: .utf8) {
            facets = try? decoder.decode([String: FacetValue].self, from: data)
        }

        var vector: SparseVector?
        if let json = vectorJSON, !json.isEmpty, let data = json.data(using: .utf8) {
            vector = try? decoder.decode(SparseVector.self, from: data)
        }

        var document = SearchDocument(
            moduleType: moduleType,
            entityId: entityId,
            groupId: groupId,
            title: title,
            content: content,
            tags: tags,
            excerpt: excerpt?.isEmpty == false ? excerpt : nil,
            authorPubkey: authorPubkey?.isEmpty == false ? authorPubkey : nil,
            facets: facets,
            vector: vector,
            createdAt: createdAt,
            updatedAt: updatedAt
        )

        // The document struct creates a new indexedAt, but we want to preserve the stored one
        // This is a limitation of the current struct design, but for display purposes it's fine

        return document
    }

    /// Sanitize a search query for FTS5
    private func sanitizeFTSQuery(_ query: String) -> String {
        // Remove or escape special FTS5 characters
        var sanitized = query
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // Add prefix matching with *
        let words = sanitized.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if words.count == 1 {
            sanitized = "\(words[0])*"
        } else if words.count > 1 {
            // For multi-word queries, match all terms
            sanitized = words.map { "\($0)*" }.joined(separator: " ")
        }

        return sanitized
    }

    // MARK: - Term Index

    /// Update the term index for TF-IDF calculations
    private func updateTermIndex(for document: SearchDocument) throws {
        // Extract terms from document
        let terms = extractTerms(from: document)

        for term in terms {
            try upsertTerm(term)
        }
    }

    /// Extract unique terms from a document
    private func extractTerms(from document: SearchDocument) -> Set<String> {
        var terms = Set<String>()

        // Tokenize and normalize text
        let allText = "\(document.title) \(document.content) \(document.tags?.joined(separator: " ") ?? "")"
        let words = allText.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count >= 2 }

        terms.formUnion(words)
        return terms
    }

    /// Insert or update a term in the term index
    private func upsertTerm(_ term: String) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = """
            INSERT INTO search_term_index (term, document_count, idf_score)
            VALUES (?, 1, NULL)
            ON CONFLICT(term) DO UPDATE SET document_count = document_count + 1
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, term.cString, -1, SQLITE_TRANSIENT)
        sqlite3_step(statement)
    }

    // MARK: - Tag Operations

    /// Save a tag
    public func saveTag(_ tag: Tag) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = """
            INSERT OR REPLACE INTO search_tags
            (id, group_id, name, slug, color, parent_tag_id, usage_count, created_at, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, tag.id.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, tag.groupId.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, tag.name.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, tag.slug.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, (tag.color ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 6, (tag.parentTagId ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(statement, 7, Int32(tag.usageCount))
        sqlite3_bind_int64(statement, 8, tag.createdAt)
        sqlite3_bind_text(statement, 9, tag.createdBy.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 10, tag.updatedAt)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Get tags for a group
    public func getTags(groupId: String) throws -> [Tag] {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = "SELECT * FROM search_tags WHERE group_id = ? ORDER BY name"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, groupId.cString, -1, SQLITE_TRANSIENT)

        var tags: [Tag] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let tag = parseTagRow(statement) {
                tags.append(tag)
            }
        }

        return tags
    }

    /// Parse a tag row
    private func parseTagRow(_ statement: OpaquePointer) -> Tag? {
        guard let id = sqlite3_column_text(statement, 0).map({ String(cString: $0) }),
              let groupId = sqlite3_column_text(statement, 1).map({ String(cString: $0) }),
              let name = sqlite3_column_text(statement, 2).map({ String(cString: $0) }),
              let slug = sqlite3_column_text(statement, 3).map({ String(cString: $0) }),
              let createdBy = sqlite3_column_text(statement, 8).map({ String(cString: $0) }) else {
            return nil
        }

        let color = sqlite3_column_text(statement, 4).flatMap { String(cString: $0) }
        let parentTagId = sqlite3_column_text(statement, 5).flatMap { String(cString: $0) }
        let usageCount = Int(sqlite3_column_int(statement, 6))

        return Tag(
            id: id,
            groupId: groupId,
            name: name,
            slug: slug,
            color: color?.isEmpty == false ? color : nil,
            parentTagId: parentTagId?.isEmpty == false ? parentTagId : nil,
            usageCount: usageCount,
            createdBy: createdBy
        )
    }

    // MARK: - Saved Search Operations

    /// Save a saved search
    public func saveSavedSearch(_ search: SavedSearch) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let scopeJSON = try encoder.encode(search.scope).utf8String ?? ""
        let filtersJSON = try? encoder.encode(search.filters).utf8String

        let sql = """
            INSERT OR REPLACE INTO search_saved_searches
            (id, user_pubkey, name, query, scope_json, filters_json, created_at, updated_at, last_used_at, use_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, search.id.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, search.userPubkey.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, search.name.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, search.query.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, scopeJSON.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 6, (filtersJSON ?? "").cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 7, search.createdAt)
        sqlite3_bind_int64(statement, 8, search.updatedAt)
        if let lastUsedAt = search.lastUsedAt {
            sqlite3_bind_int64(statement, 9, lastUsedAt)
        } else {
            sqlite3_bind_null(statement, 9)
        }
        sqlite3_bind_int(statement, 10, Int32(search.useCount))

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Get saved searches for a user
    public func getSavedSearches(userPubkey: String) throws -> [SavedSearch] {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = "SELECT * FROM search_saved_searches WHERE user_pubkey = ? ORDER BY use_count DESC, updated_at DESC"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, userPubkey.cString, -1, SQLITE_TRANSIENT)

        var searches: [SavedSearch] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let search = parseSavedSearchRow(statement) {
                searches.append(search)
            }
        }

        return searches
    }

    /// Parse a saved search row
    private func parseSavedSearchRow(_ statement: OpaquePointer) -> SavedSearch? {
        guard let id = sqlite3_column_text(statement, 0).map({ String(cString: $0) }),
              let userPubkey = sqlite3_column_text(statement, 1).map({ String(cString: $0) }),
              let name = sqlite3_column_text(statement, 2).map({ String(cString: $0) }),
              let query = sqlite3_column_text(statement, 3).map({ String(cString: $0) }),
              let scopeJSON = sqlite3_column_text(statement, 4).map({ String(cString: $0) }) else {
            return nil
        }

        guard let scopeData = scopeJSON.data(using: .utf8),
              let scope = try? decoder.decode(SearchScope.self, from: scopeData) else {
            return nil
        }

        let filtersJSON = sqlite3_column_text(statement, 5).flatMap { String(cString: $0) }
        var filters: FacetFilters?
        if let json = filtersJSON, !json.isEmpty, let data = json.data(using: .utf8) {
            filters = try? decoder.decode(FacetFilters.self, from: data)
        }

        var search = SavedSearch(
            id: id,
            userPubkey: userPubkey,
            name: name,
            query: query,
            scope: scope,
            filters: filters
        )

        search.useCount = Int(sqlite3_column_int(statement, 9))
        if sqlite3_column_type(statement, 8) != SQLITE_NULL {
            search.lastUsedAt = sqlite3_column_int64(statement, 8)
        }

        return search
    }

    // MARK: - Recent Search Operations

    /// Add a recent search
    public func addRecentSearch(_ search: RecentSearch) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let scopeJSON = try encoder.encode(search.scope).utf8String ?? ""

        let sql = """
            INSERT INTO search_recent_searches
            (id, user_pubkey, query, scope_json, timestamp, result_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, search.id.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, search.userPubkey.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, search.query.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, scopeJSON.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(statement, 5, search.timestamp)
        sqlite3_bind_int(statement, 6, Int32(search.resultCount))

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SearchDatabaseError.insertFailed(String(cString: sqlite3_errmsg(db)))
        }

        // Prune old searches (keep only last 50)
        try pruneRecentSearches(userPubkey: search.userPubkey, limit: 50)
    }

    /// Prune old recent searches
    private func pruneRecentSearches(userPubkey: String, limit: Int) throws {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = """
            DELETE FROM search_recent_searches
            WHERE user_pubkey = ? AND id NOT IN (
                SELECT id FROM search_recent_searches
                WHERE user_pubkey = ?
                ORDER BY timestamp DESC
                LIMIT ?
            )
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.deleteFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, userPubkey.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, userPubkey.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(statement, 3, Int32(limit))

        sqlite3_step(statement)
    }

    /// Get recent searches for a user
    public func getRecentSearches(userPubkey: String, limit: Int = 20) throws -> [RecentSearch] {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        let sql = "SELECT * FROM search_recent_searches WHERE user_pubkey = ? ORDER BY timestamp DESC LIMIT ?"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, userPubkey.cString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(statement, 2, Int32(limit))

        var searches: [RecentSearch] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let search = parseRecentSearchRow(statement) {
                searches.append(search)
            }
        }

        return searches
    }

    /// Parse a recent search row
    private func parseRecentSearchRow(_ statement: OpaquePointer) -> RecentSearch? {
        guard let userPubkey = sqlite3_column_text(statement, 1).map({ String(cString: $0) }),
              let query = sqlite3_column_text(statement, 2).map({ String(cString: $0) }),
              let scopeJSON = sqlite3_column_text(statement, 3).map({ String(cString: $0) }) else {
            return nil
        }

        guard let scopeData = scopeJSON.data(using: .utf8),
              let scope = try? decoder.decode(SearchScope.self, from: scopeData) else {
            return nil
        }

        let resultCount = Int(sqlite3_column_int(statement, 5))

        return RecentSearch(
            userPubkey: userPubkey,
            query: query,
            scope: scope,
            resultCount: resultCount
        )
    }

    // MARK: - Statistics

    /// Get index statistics
    public func getStats() throws -> IndexStats {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        var totalDocuments = 0
        var byModuleType: [String: Int] = [:]
        var byGroup: [String: Int] = [:]
        var uniqueTerms = 0

        // Total documents
        if let count = try queryInt("SELECT COUNT(*) FROM search_documents_meta") {
            totalDocuments = count
        }

        // By module type
        let moduleQuery = "SELECT module_type, COUNT(*) FROM search_documents_meta GROUP BY module_type"
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, moduleQuery, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                if let moduleType = sqlite3_column_text(statement, 0).map({ String(cString: $0) }) {
                    byModuleType[moduleType] = Int(sqlite3_column_int(statement, 1))
                }
            }
            sqlite3_finalize(statement)
        }

        // By group
        let groupQuery = "SELECT group_id, COUNT(*) FROM search_documents_meta GROUP BY group_id"
        if sqlite3_prepare_v2(db, groupQuery, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                if let groupId = sqlite3_column_text(statement, 0).map({ String(cString: $0) }) {
                    byGroup[groupId] = Int(sqlite3_column_int(statement, 1))
                }
            }
            sqlite3_finalize(statement)
        }

        // Unique terms
        if let count = try queryInt("SELECT COUNT(*) FROM search_term_index") {
            uniqueTerms = count
        }

        // Estimate size (rough estimate based on content)
        let sizeEstimate = try queryInt("SELECT SUM(LENGTH(content)) FROM search_documents") ?? 0

        return IndexStats(
            totalDocuments: totalDocuments,
            byModuleType: byModuleType,
            byGroup: byGroup,
            uniqueTerms: uniqueTerms,
            sizeBytes: sizeEstimate
        )
    }

    /// Query a single integer value
    private func queryInt(_ sql: String) throws -> Int? {
        guard let db = db else { throw SearchDatabaseError.databaseNotOpen }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SearchDatabaseError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        if sqlite3_step(statement) == SQLITE_ROW {
            return Int(sqlite3_column_int64(statement, 0))
        }
        return nil
    }

    // MARK: - Maintenance

    /// Clear all data from the search index
    public func clearAll() throws {
        try execute("DELETE FROM search_documents")
        try execute("DELETE FROM search_documents_meta")
        try execute("DELETE FROM search_tags")
        try execute("DELETE FROM search_entity_tags")
        try execute("DELETE FROM search_saved_searches")
        try execute("DELETE FROM search_recent_searches")
        try execute("DELETE FROM search_term_index")

        logger.info("Cleared all search data")
    }

    /// Optimize the database
    public func optimize() throws {
        try execute("INSERT INTO search_documents(search_documents) VALUES('optimize')")
        try execute("VACUUM")

        logger.info("Optimized search database")
    }

    // MARK: - Schema SQL

    private func getSchemaSQL() -> String {
        return """
        CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
            id,
            module_type,
            entity_id,
            group_id,
            title,
            content,
            tags,
            excerpt,
            author_pubkey,
            facets_json,
            created_at,
            updated_at,
            indexed_at,
            tokenize = 'porter unicode61 remove_diacritics 1',
            content_rowid = 'rowid'
        );

        CREATE TABLE IF NOT EXISTS search_documents_meta (
            rowid INTEGER PRIMARY KEY,
            id TEXT UNIQUE NOT NULL,
            module_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            author_pubkey TEXT,
            facets_json TEXT,
            vector_json TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            indexed_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_documents_meta_module_type ON search_documents_meta(module_type);
        CREATE INDEX IF NOT EXISTS idx_documents_meta_group_id ON search_documents_meta(group_id);
        CREATE INDEX IF NOT EXISTS idx_documents_meta_author ON search_documents_meta(author_pubkey);
        CREATE INDEX IF NOT EXISTS idx_documents_meta_created ON search_documents_meta(created_at);
        CREATE INDEX IF NOT EXISTS idx_documents_meta_updated ON search_documents_meta(updated_at);

        CREATE TABLE IF NOT EXISTS search_tags (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            color TEXT,
            parent_tag_id TEXT,
            usage_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tags_group ON search_tags(group_id);
        CREATE INDEX IF NOT EXISTS idx_tags_slug ON search_tags(slug);
        CREATE INDEX IF NOT EXISTS idx_tags_parent ON search_tags(parent_tag_id);

        CREATE TABLE IF NOT EXISTS search_entity_tags (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            created_by TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON search_entity_tags(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON search_entity_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_entity_tags_group ON search_entity_tags(group_id);

        CREATE TABLE IF NOT EXISTS search_saved_searches (
            id TEXT PRIMARY KEY,
            user_pubkey TEXT NOT NULL,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            scope_json TEXT NOT NULL,
            filters_json TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_used_at INTEGER,
            use_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON search_saved_searches(user_pubkey);

        CREATE TABLE IF NOT EXISTS search_recent_searches (
            id TEXT PRIMARY KEY,
            user_pubkey TEXT NOT NULL,
            query TEXT NOT NULL,
            scope_json TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            result_count INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON search_recent_searches(user_pubkey);
        CREATE INDEX IF NOT EXISTS idx_recent_searches_timestamp ON search_recent_searches(timestamp);

        CREATE TABLE IF NOT EXISTS search_term_index (
            term TEXT NOT NULL,
            document_count INTEGER DEFAULT 0,
            idf_score REAL,
            PRIMARY KEY (term)
        );

        CREATE TABLE IF NOT EXISTS search_index_stats (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        """
    }
}

// MARK: - Helper Extensions

private extension String {
    var cString: UnsafePointer<CChar>? {
        (self as NSString).utf8String
    }
}

private extension Data {
    var utf8String: String? {
        String(data: self, encoding: .utf8)
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
