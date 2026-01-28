package network.buildit.modules.search.domain

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import network.buildit.modules.search.data.EntityTagDao
import network.buildit.modules.search.data.EntityTagEntity
import network.buildit.modules.search.data.RecentSearchDao
import network.buildit.modules.search.data.RecentSearchEntity
import network.buildit.modules.search.data.SavedSearchDao
import network.buildit.modules.search.data.SavedSearchEntity
import network.buildit.modules.search.data.SearchDocumentDao
import network.buildit.modules.search.data.SearchDocumentEntity
import network.buildit.modules.search.data.TagDao
import network.buildit.modules.search.data.TagEntity
import network.buildit.modules.search.models.EntityTag
import network.buildit.modules.search.models.FacetCounts
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.IndexStats
import network.buildit.modules.search.models.ParsedQuery
import network.buildit.modules.search.models.RecentSearch
import network.buildit.modules.search.models.SEARCH_SCHEMA_VERSION
import network.buildit.modules.search.models.SavedSearch
import network.buildit.modules.search.models.SearchDocument
import network.buildit.modules.search.models.SearchOptions
import network.buildit.modules.search.models.SearchResult
import network.buildit.modules.search.models.SearchResults
import network.buildit.modules.search.models.SearchScope
import network.buildit.modules.search.models.Tag
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for search operations.
 *
 * Provides a clean API for:
 * - Document indexing and retrieval
 * - Full-text search with faceting
 * - Tag management
 * - Saved and recent search management
 */
@Singleton
class SearchRepository @Inject constructor(
    private val searchDocumentDao: SearchDocumentDao,
    private val tagDao: TagDao,
    private val entityTagDao: EntityTagDao,
    private val savedSearchDao: SavedSearchDao,
    private val recentSearchDao: RecentSearchDao,
    private val tfidfEngine: TFIDFEngine
) {
    // ============== Document Operations ==============

    /**
     * Indexes a document for search.
     */
    suspend fun indexDocument(document: SearchDocument): SearchDocument = withContext(Dispatchers.IO) {
        // Compute TF-IDF vector
        val vector = tfidfEngine.indexDocument(document)

        // Create document with vector
        val documentWithVector = document.copy(
            vector = vector,
            indexedAt = System.currentTimeMillis()
        )

        // Save to database
        searchDocumentDao.insertDocument(SearchDocumentEntity.from(documentWithVector))

        documentWithVector
    }

    /**
     * Indexes multiple documents.
     */
    suspend fun indexDocuments(documents: List<SearchDocument>) = withContext(Dispatchers.IO) {
        documents.forEach { document ->
            indexDocument(document)
        }
    }

    /**
     * Gets a document by ID.
     */
    suspend fun getDocument(id: String): SearchDocument? {
        return searchDocumentDao.getDocument(id)?.toSearchDocument()
    }

    /**
     * Gets a document by entity reference.
     */
    suspend fun getDocumentByEntity(moduleType: String, entityId: String): SearchDocument? {
        return searchDocumentDao.getDocumentByEntity(moduleType, entityId)?.toSearchDocument()
    }

    /**
     * Observes a document.
     */
    fun observeDocument(id: String): Flow<SearchDocument?> {
        return searchDocumentDao.observeDocument(id).map { it?.toSearchDocument() }
    }

    /**
     * Gets documents by group.
     */
    fun getDocumentsByGroup(groupId: String): Flow<List<SearchDocument>> {
        return searchDocumentDao.getDocumentsByGroup(groupId).map { entities ->
            entities.map { it.toSearchDocument() }
        }
    }

    /**
     * Gets documents by module.
     */
    fun getDocumentsByModule(moduleType: String): Flow<List<SearchDocument>> {
        return searchDocumentDao.getDocumentsByModule(moduleType).map { entities ->
            entities.map { it.toSearchDocument() }
        }
    }

    /**
     * Removes a document from the index.
     */
    suspend fun removeDocument(id: String) = withContext(Dispatchers.IO) {
        searchDocumentDao.deleteDocumentById(id)
        tfidfEngine.removeDocument(id)
    }

    /**
     * Removes a document by entity reference.
     */
    suspend fun removeDocumentByEntity(moduleType: String, entityId: String) = withContext(Dispatchers.IO) {
        val document = searchDocumentDao.getDocumentByEntity(moduleType, entityId)
        if (document != null) {
            searchDocumentDao.deleteDocumentByEntity(moduleType, entityId)
            tfidfEngine.removeDocument(document.id)
        }
    }

    /**
     * Removes all documents for a group.
     */
    suspend fun removeDocumentsByGroup(groupId: String) = withContext(Dispatchers.IO) {
        searchDocumentDao.deleteDocumentsByGroup(groupId)
    }

    /**
     * Clears the entire search index.
     */
    suspend fun clearIndex() = withContext(Dispatchers.IO) {
        searchDocumentDao.deleteAllDocuments()
    }

    // ============== Search Operations ==============

    /**
     * Performs a search with the given query and options.
     */
    suspend fun search(
        query: ParsedQuery,
        options: SearchOptions = SearchOptions(),
        filters: FacetFilters? = null
    ): SearchResults = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()

        // Build FTS query
        val ftsQuery = buildFtsQuery(query)

        // Execute FTS search based on scope
        val ftsResults = executeFtsSearch(ftsQuery, query.scope, options)

        // Apply facet filters
        val filteredResults = applyFilters(ftsResults, filters)

        // Compute semantic scores if enabled
        val scoredResults = if (options.semantic && query.keywords.isNotEmpty()) {
            computeSemanticScores(query.raw, filteredResults, options)
        } else {
            filteredResults.mapIndexed { index, doc ->
                SearchResult(
                    document = doc,
                    score = 1.0 - (index * 0.01), // FTS order score
                    matchedTerms = query.keywords,
                    matchedFields = listOf("title", "content"),
                    highlightedExcerpt = if (options.highlight) highlightExcerpt(doc, query.keywords) else null
                )
            }
        }

        // Get total count
        val totalCount = if (ftsQuery.isNotBlank()) {
            searchDocumentDao.countFtsResults(ftsQuery)
        } else {
            searchDocumentDao.getDocumentCount()
        }

        // Compute facet counts
        val facetCounts = computeFacetCounts(ftsQuery)

        val endTime = System.currentTimeMillis()

        SearchResults(
            results = scoredResults.take(options.limit),
            totalCount = totalCount,
            facetCounts = facetCounts,
            searchTimeMs = (endTime - startTime).toDouble(),
            query = query
        )
    }

    /**
     * Builds an FTS4 query string from a parsed query.
     */
    private fun buildFtsQuery(query: ParsedQuery): String {
        val parts = mutableListOf<String>()

        // Add exact phrase matches
        for (phrase in query.phrases) {
            parts.add("\"$phrase\"")
        }

        // Add keywords with prefix matching
        for (keyword in query.keywords) {
            parts.add("$keyword*")
        }

        // Add expanded terms
        for (term in query.expandedTerms) {
            parts.add(term)
        }

        return parts.joinToString(" ")
    }

    /**
     * Executes FTS search based on scope.
     */
    private suspend fun executeFtsSearch(
        ftsQuery: String,
        scope: SearchScope,
        options: SearchOptions
    ): List<SearchDocument> {
        if (ftsQuery.isBlank()) {
            return searchDocumentDao.getAllDocuments(options.limit, options.offset)
                .map { it.toSearchDocument() }
        }

        val entities = when (scope) {
            is SearchScope.Global -> {
                searchDocumentDao.searchFts(ftsQuery, options.limit, options.offset)
            }
            is SearchScope.Group -> {
                searchDocumentDao.searchFtsInGroup(ftsQuery, scope.groupId, options.limit, options.offset)
            }
            is SearchScope.Module -> {
                searchDocumentDao.searchFtsInModule(ftsQuery, scope.moduleType, options.limit, options.offset)
            }
            is SearchScope.ModuleInGroup -> {
                searchDocumentDao.searchFtsInModuleAndGroup(
                    ftsQuery,
                    scope.moduleType,
                    scope.groupId,
                    options.limit,
                    options.offset
                )
            }
        }

        return entities.map { it.toSearchDocument() }
    }

    /**
     * Applies facet filters to search results.
     */
    private fun applyFilters(
        documents: List<SearchDocument>,
        filters: FacetFilters?
    ): List<SearchDocument> {
        if (filters == null) return documents

        return documents.filter { doc ->
            // Filter by module types
            if (filters.moduleTypes.isNotEmpty() && doc.moduleType !in filters.moduleTypes) {
                return@filter false
            }

            // Filter by groups
            if (filters.groupIds.isNotEmpty() && doc.groupId !in filters.groupIds) {
                return@filter false
            }

            // Filter by tags
            if (filters.tags.isNotEmpty() && !doc.tags.any { it in filters.tags }) {
                return@filter false
            }

            // Filter by date range
            filters.dateRange?.let { range ->
                if (doc.createdAt < range.start || doc.createdAt > range.end) {
                    return@filter false
                }
            }

            // Filter by authors
            if (filters.authors.isNotEmpty()) {
                if (doc.authorPubkey == null || doc.authorPubkey !in filters.authors) {
                    return@filter false
                }
            }

            true
        }
    }

    /**
     * Computes semantic scores using TF-IDF.
     */
    private suspend fun computeSemanticScores(
        queryText: String,
        documents: List<SearchDocument>,
        options: SearchOptions
    ): List<SearchResult> {
        val semanticScores = tfidfEngine.semanticSearch(queryText, documents, documents.size)
        val scoreMap = semanticScores.toMap()

        return documents.mapIndexed { index, doc ->
            val ftsScore = 1.0 - (index * 0.01) // FTS order provides base score
            val semanticScore = scoreMap[doc.id] ?: 0.0

            // Blend FTS and semantic scores
            val blendedScore = (1 - options.semanticWeight) * ftsScore + options.semanticWeight * semanticScore

            SearchResult(
                document = doc,
                score = blendedScore,
                matchedTerms = tfidfEngine.tokenize(queryText),
                matchedFields = listOf("title", "content"),
                highlightedExcerpt = if (options.highlight) {
                    highlightExcerpt(doc, tfidfEngine.tokenize(queryText))
                } else null
            )
        }.sortedByDescending { it.score }
    }

    /**
     * Highlights matched terms in an excerpt.
     */
    private fun highlightExcerpt(document: SearchDocument, terms: List<String>): String {
        val text = document.excerpt ?: document.content.take(200)

        var highlighted = text
        for (term in terms) {
            val regex = Regex("\\b($term\\w*)\\b", RegexOption.IGNORE_CASE)
            highlighted = highlighted.replace(regex) { match ->
                "<b>${match.value}</b>"
            }
        }

        return highlighted
    }

    /**
     * Computes facet counts for a query.
     */
    private suspend fun computeFacetCounts(ftsQuery: String): FacetCounts {
        val moduleTypeCounts = if (ftsQuery.isNotBlank()) {
            searchDocumentDao.getModuleTypeCountsForQuery(ftsQuery)
        } else {
            searchDocumentDao.getModuleTypeCounts()
        }

        val groupCounts = if (ftsQuery.isNotBlank()) {
            searchDocumentDao.getGroupCountsForQuery(ftsQuery)
        } else {
            searchDocumentDao.getGroupCounts()
        }

        val authorCounts = searchDocumentDao.getAuthorCounts()

        return FacetCounts(
            moduleType = moduleTypeCounts.associate { it.moduleType to it.count },
            groups = groupCounts.associate { it.groupId to it.count },
            authors = authorCounts.associate { it.authorPubkey to it.count }
        )
    }

    // ============== Tag Operations ==============

    /**
     * Creates a new tag.
     */
    suspend fun createTag(
        groupId: String,
        name: String,
        createdBy: String,
        color: String? = null,
        parentTagId: String? = null
    ): Tag = withContext(Dispatchers.IO) {
        val tag = Tag(
            id = UUID.randomUUID().toString(),
            groupId = groupId,
            name = name,
            slug = name.lowercase().replace(Regex("[^a-z0-9]+"), "-"),
            color = color,
            parentTagId = parentTagId,
            usageCount = 0,
            createdAt = System.currentTimeMillis(),
            createdBy = createdBy,
            updatedAt = System.currentTimeMillis()
        )

        tagDao.insertTag(
            TagEntity(
                id = tag.id,
                schemaVersion = tag.schemaVersion,
                groupId = tag.groupId,
                name = tag.name,
                slug = tag.slug,
                color = tag.color,
                parentTagId = tag.parentTagId,
                usageCount = tag.usageCount,
                createdAt = tag.createdAt,
                createdBy = tag.createdBy,
                updatedAt = tag.updatedAt
            )
        )

        tag
    }

    /**
     * Gets tags for a group.
     */
    fun getTagsByGroup(groupId: String): Flow<List<Tag>> {
        return tagDao.getTagsByGroup(groupId).map { entities ->
            entities.map { entity ->
                Tag(
                    id = entity.id,
                    groupId = entity.groupId,
                    name = entity.name,
                    slug = entity.slug,
                    color = entity.color,
                    parentTagId = entity.parentTagId,
                    usageCount = entity.usageCount,
                    createdAt = entity.createdAt,
                    createdBy = entity.createdBy,
                    updatedAt = entity.updatedAt
                )
            }
        }
    }

    /**
     * Searches tags.
     */
    suspend fun searchTags(groupId: String, query: String, limit: Int = 20): List<Tag> {
        return tagDao.searchTags(groupId, query, limit).map { entity ->
            Tag(
                id = entity.id,
                groupId = entity.groupId,
                name = entity.name,
                slug = entity.slug,
                color = entity.color,
                parentTagId = entity.parentTagId,
                usageCount = entity.usageCount,
                createdAt = entity.createdAt,
                createdBy = entity.createdBy,
                updatedAt = entity.updatedAt
            )
        }
    }

    /**
     * Gets popular tags for a group.
     */
    suspend fun getPopularTags(groupId: String, limit: Int = 10): List<Tag> {
        return tagDao.getPopularTags(groupId, limit).map { entity ->
            Tag(
                id = entity.id,
                groupId = entity.groupId,
                name = entity.name,
                slug = entity.slug,
                color = entity.color,
                parentTagId = entity.parentTagId,
                usageCount = entity.usageCount,
                createdAt = entity.createdAt,
                createdBy = entity.createdBy,
                updatedAt = entity.updatedAt
            )
        }
    }

    /**
     * Adds a tag to an entity.
     */
    suspend fun tagEntity(
        entityType: String,
        entityId: String,
        tagId: String,
        groupId: String,
        createdBy: String
    ) = withContext(Dispatchers.IO) {
        val entityTag = EntityTagEntity(
            id = UUID.randomUUID().toString(),
            schemaVersion = SEARCH_SCHEMA_VERSION,
            entityType = entityType,
            entityId = entityId,
            tagId = tagId,
            groupId = groupId,
            createdAt = System.currentTimeMillis(),
            createdBy = createdBy
        )

        entityTagDao.insertEntityTag(entityTag)
        tagDao.incrementUsageCount(tagId)
    }

    /**
     * Removes a tag from an entity.
     */
    suspend fun untagEntity(entityType: String, entityId: String, tagId: String) = withContext(Dispatchers.IO) {
        entityTagDao.removeTagFromEntity(entityType, entityId, tagId)
        tagDao.decrementUsageCount(tagId)
    }

    /**
     * Gets tags for an entity.
     */
    fun getTagsForEntity(entityType: String, entityId: String): Flow<List<EntityTag>> {
        return entityTagDao.getTagsForEntity(entityType, entityId).map { entities ->
            entities.map { entity ->
                EntityTag(
                    id = entity.id,
                    entityType = entity.entityType,
                    entityId = entity.entityId,
                    tagId = entity.tagId,
                    groupId = entity.groupId,
                    createdAt = entity.createdAt,
                    createdBy = entity.createdBy
                )
            }
        }
    }

    /**
     * Deletes a tag and all its associations.
     */
    suspend fun deleteTag(tagId: String) = withContext(Dispatchers.IO) {
        entityTagDao.deleteByTag(tagId)
        tagDao.deleteTagById(tagId)
    }

    // ============== Saved Search Operations ==============

    /**
     * Saves a search for quick access.
     */
    suspend fun saveSearch(
        userPubkey: String,
        name: String,
        query: String,
        scope: SearchScope,
        filters: FacetFilters? = null
    ): SavedSearch = withContext(Dispatchers.IO) {
        val savedSearch = SavedSearch(
            id = UUID.randomUUID().toString(),
            userPubkey = userPubkey,
            name = name,
            query = query,
            scope = scope,
            filters = filters,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            useCount = 0
        )

        savedSearchDao.insertSavedSearch(SavedSearchEntity.from(savedSearch))
        savedSearch
    }

    /**
     * Gets saved searches for a user.
     */
    fun getSavedSearches(userPubkey: String): Flow<List<SavedSearch>> {
        return savedSearchDao.getSavedSearchesByUser(userPubkey).map { entities ->
            entities.map { it.toSavedSearch() }
        }
    }

    /**
     * Uses a saved search (increments count).
     */
    suspend fun useSavedSearch(id: String) = withContext(Dispatchers.IO) {
        savedSearchDao.incrementUseCount(id, System.currentTimeMillis())
    }

    /**
     * Deletes a saved search.
     */
    suspend fun deleteSavedSearch(id: String) = withContext(Dispatchers.IO) {
        savedSearchDao.deleteSavedSearchById(id)
    }

    // ============== Recent Search Operations ==============

    /**
     * Records a recent search.
     */
    suspend fun recordRecentSearch(
        userPubkey: String,
        query: String,
        scope: SearchScope,
        resultCount: Int
    ) = withContext(Dispatchers.IO) {
        val recentSearch = RecentSearch(
            id = UUID.randomUUID().toString(),
            userPubkey = userPubkey,
            query = query,
            scope = scope,
            timestamp = System.currentTimeMillis(),
            resultCount = resultCount
        )

        recentSearchDao.insertRecentSearch(RecentSearchEntity.from(recentSearch))

        // Trim old entries
        recentSearchDao.trimRecentSearches(userPubkey, 50)
    }

    /**
     * Gets recent searches for a user.
     */
    fun getRecentSearches(userPubkey: String, limit: Int = 10): Flow<List<RecentSearch>> {
        return recentSearchDao.getRecentSearches(userPubkey, limit).map { entities ->
            entities.map { it.toRecentSearch() }
        }
    }

    /**
     * Clears recent search history.
     */
    suspend fun clearRecentSearches(userPubkey: String) = withContext(Dispatchers.IO) {
        recentSearchDao.clearRecentSearches(userPubkey)
    }

    // ============== Index Statistics ==============

    /**
     * Gets search index statistics.
     */
    suspend fun getIndexStats(): IndexStats = withContext(Dispatchers.IO) {
        val moduleTypeCounts = searchDocumentDao.getModuleTypeCounts()
        val groupCounts = searchDocumentDao.getGroupCounts()
        val tfidfStats = tfidfEngine.getIndexStats()

        IndexStats(
            totalDocuments = searchDocumentDao.getDocumentCount(),
            byModuleType = moduleTypeCounts.associate { it.moduleType to it.count },
            byGroup = groupCounts.associate { it.groupId to it.count },
            uniqueTerms = tfidfStats.uniqueTerms,
            sizeBytes = 0, // Would need to query database file size
            lastFullReindex = null,
            lastIncrementalUpdate = System.currentTimeMillis()
        )
    }

    /**
     * Rebuilds the TF-IDF index.
     */
    suspend fun rebuildTfIdfIndex() {
        tfidfEngine.rebuildIndex()
    }
}
