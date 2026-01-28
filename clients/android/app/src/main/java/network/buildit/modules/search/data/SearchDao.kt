package network.buildit.modules.search.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for search documents and FTS operations.
 */
@Dao
interface SearchDocumentDao {
    // ============== Search Document Operations ==============

    @Query("SELECT * FROM search_documents WHERE id = :id")
    suspend fun getDocument(id: String): SearchDocumentEntity?

    @Query("SELECT * FROM search_documents WHERE id = :id")
    fun observeDocument(id: String): Flow<SearchDocumentEntity?>

    @Query("SELECT * FROM search_documents WHERE moduleType = :moduleType AND entityId = :entityId")
    suspend fun getDocumentByEntity(moduleType: String, entityId: String): SearchDocumentEntity?

    @Query("SELECT * FROM search_documents WHERE groupId = :groupId ORDER BY updatedAt DESC")
    fun getDocumentsByGroup(groupId: String): Flow<List<SearchDocumentEntity>>

    @Query("SELECT * FROM search_documents WHERE moduleType = :moduleType ORDER BY updatedAt DESC")
    fun getDocumentsByModule(moduleType: String): Flow<List<SearchDocumentEntity>>

    @Query("SELECT * FROM search_documents WHERE groupId = :groupId AND moduleType = :moduleType ORDER BY updatedAt DESC")
    fun getDocumentsByGroupAndModule(groupId: String, moduleType: String): Flow<List<SearchDocumentEntity>>

    @Query("SELECT * FROM search_documents ORDER BY updatedAt DESC LIMIT :limit OFFSET :offset")
    suspend fun getAllDocuments(limit: Int, offset: Int): List<SearchDocumentEntity>

    @Query("SELECT COUNT(*) FROM search_documents")
    suspend fun getDocumentCount(): Int

    @Query("SELECT COUNT(*) FROM search_documents WHERE moduleType = :moduleType")
    suspend fun getDocumentCountByModule(moduleType: String): Int

    @Query("SELECT COUNT(*) FROM search_documents WHERE groupId = :groupId")
    suspend fun getDocumentCountByGroup(groupId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocument(document: SearchDocumentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocuments(documents: List<SearchDocumentEntity>)

    @Update
    suspend fun updateDocument(document: SearchDocumentEntity)

    @Delete
    suspend fun deleteDocument(document: SearchDocumentEntity)

    @Query("DELETE FROM search_documents WHERE id = :id")
    suspend fun deleteDocumentById(id: String)

    @Query("DELETE FROM search_documents WHERE moduleType = :moduleType AND entityId = :entityId")
    suspend fun deleteDocumentByEntity(moduleType: String, entityId: String)

    @Query("DELETE FROM search_documents WHERE groupId = :groupId")
    suspend fun deleteDocumentsByGroup(groupId: String)

    @Query("DELETE FROM search_documents WHERE moduleType = :moduleType")
    suspend fun deleteDocumentsByModule(moduleType: String)

    @Query("DELETE FROM search_documents")
    suspend fun deleteAllDocuments()

    // ============== FTS Search Operations ==============

    /**
     * Full-text search using FTS4.
     * Supports standard FTS query syntax (AND, OR, NOT, phrases, prefix).
     */
    @Query("""
        SELECT search_documents.* FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query
        ORDER BY bm25(search_fts) DESC
        LIMIT :limit OFFSET :offset
    """)
    suspend fun searchFts(query: String, limit: Int = 50, offset: Int = 0): List<SearchDocumentEntity>

    /**
     * FTS search within a specific group.
     */
    @Query("""
        SELECT search_documents.* FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query AND search_documents.groupId = :groupId
        ORDER BY bm25(search_fts) DESC
        LIMIT :limit OFFSET :offset
    """)
    suspend fun searchFtsInGroup(query: String, groupId: String, limit: Int = 50, offset: Int = 0): List<SearchDocumentEntity>

    /**
     * FTS search within a specific module.
     */
    @Query("""
        SELECT search_documents.* FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query AND search_documents.moduleType = :moduleType
        ORDER BY bm25(search_fts) DESC
        LIMIT :limit OFFSET :offset
    """)
    suspend fun searchFtsInModule(query: String, moduleType: String, limit: Int = 50, offset: Int = 0): List<SearchDocumentEntity>

    /**
     * FTS search within a specific module and group.
     */
    @Query("""
        SELECT search_documents.* FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query
            AND search_documents.moduleType = :moduleType
            AND search_documents.groupId = :groupId
        ORDER BY bm25(search_fts) DESC
        LIMIT :limit OFFSET :offset
    """)
    suspend fun searchFtsInModuleAndGroup(
        query: String,
        moduleType: String,
        groupId: String,
        limit: Int = 50,
        offset: Int = 0
    ): List<SearchDocumentEntity>

    /**
     * Count FTS search results.
     */
    @Query("""
        SELECT COUNT(*) FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query
    """)
    suspend fun countFtsResults(query: String): Int

    /**
     * Get snippet (highlighted excerpt) from FTS match.
     */
    @Query("""
        SELECT snippet(search_fts, '<b>', '</b>', '...', 1, 64) as snippet
        FROM search_fts
        WHERE search_fts MATCH :query AND rowid = :rowid
    """)
    suspend fun getSnippet(query: String, rowid: Long): String?

    // ============== Facet Aggregation Queries ==============

    @Query("SELECT moduleType, COUNT(*) as count FROM search_documents GROUP BY moduleType")
    suspend fun getModuleTypeCounts(): List<ModuleTypeCount>

    @Query("SELECT groupId, COUNT(*) as count FROM search_documents GROUP BY groupId")
    suspend fun getGroupCounts(): List<GroupCount>

    @Query("SELECT authorPubkey, COUNT(*) as count FROM search_documents WHERE authorPubkey IS NOT NULL GROUP BY authorPubkey")
    suspend fun getAuthorCounts(): List<AuthorCount>

    @Query("""
        SELECT moduleType, COUNT(*) as count FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query
        GROUP BY moduleType
    """)
    suspend fun getModuleTypeCountsForQuery(query: String): List<ModuleTypeCount>

    @Query("""
        SELECT groupId, COUNT(*) as count FROM search_documents
        JOIN search_fts ON search_documents.rowid = search_fts.rowid
        WHERE search_fts MATCH :query
        GROUP BY groupId
    """)
    suspend fun getGroupCountsForQuery(query: String): List<GroupCount>
}

data class ModuleTypeCount(
    val moduleType: String,
    val count: Int
)

data class GroupCount(
    val groupId: String,
    val count: Int
)

data class AuthorCount(
    val authorPubkey: String,
    val count: Int
)

/**
 * Data Access Object for tags.
 */
@Dao
interface TagDao {
    @Query("SELECT * FROM tags WHERE id = :id")
    suspend fun getTag(id: String): TagEntity?

    @Query("SELECT * FROM tags WHERE id = :id")
    fun observeTag(id: String): Flow<TagEntity?>

    @Query("SELECT * FROM tags WHERE groupId = :groupId ORDER BY name ASC")
    fun getTagsByGroup(groupId: String): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags WHERE groupId = :groupId AND parentTagId IS NULL ORDER BY name ASC")
    fun getRootTagsByGroup(groupId: String): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags WHERE parentTagId = :parentId ORDER BY name ASC")
    fun getChildTags(parentId: String): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags WHERE groupId = :groupId AND slug = :slug")
    suspend fun getTagBySlug(groupId: String, slug: String): TagEntity?

    @Query("SELECT * FROM tags WHERE groupId = :groupId AND name LIKE '%' || :query || '%' ORDER BY usageCount DESC LIMIT :limit")
    suspend fun searchTags(groupId: String, query: String, limit: Int = 20): List<TagEntity>

    @Query("SELECT * FROM tags WHERE groupId = :groupId ORDER BY usageCount DESC LIMIT :limit")
    suspend fun getPopularTags(groupId: String, limit: Int = 10): List<TagEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTag(tag: TagEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTags(tags: List<TagEntity>)

    @Update
    suspend fun updateTag(tag: TagEntity)

    @Query("UPDATE tags SET usageCount = usageCount + 1 WHERE id = :tagId")
    suspend fun incrementUsageCount(tagId: String)

    @Query("UPDATE tags SET usageCount = usageCount - 1 WHERE id = :tagId AND usageCount > 0")
    suspend fun decrementUsageCount(tagId: String)

    @Delete
    suspend fun deleteTag(tag: TagEntity)

    @Query("DELETE FROM tags WHERE id = :id")
    suspend fun deleteTagById(id: String)

    @Query("DELETE FROM tags WHERE groupId = :groupId")
    suspend fun deleteTagsByGroup(groupId: String)
}

/**
 * Data Access Object for entity-tag associations.
 */
@Dao
interface EntityTagDao {
    @Query("SELECT * FROM entity_tags WHERE entityType = :entityType AND entityId = :entityId")
    fun getTagsForEntity(entityType: String, entityId: String): Flow<List<EntityTagEntity>>

    @Query("SELECT * FROM entity_tags WHERE tagId = :tagId")
    fun getEntitiesForTag(tagId: String): Flow<List<EntityTagEntity>>

    @Query("SELECT * FROM entity_tags WHERE groupId = :groupId")
    fun getEntityTagsByGroup(groupId: String): Flow<List<EntityTagEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM entity_tags WHERE entityType = :entityType AND entityId = :entityId AND tagId = :tagId)")
    suspend fun hasTag(entityType: String, entityId: String, tagId: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntityTag(entityTag: EntityTagEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntityTags(entityTags: List<EntityTagEntity>)

    @Delete
    suspend fun deleteEntityTag(entityTag: EntityTagEntity)

    @Query("DELETE FROM entity_tags WHERE entityType = :entityType AND entityId = :entityId AND tagId = :tagId")
    suspend fun removeTagFromEntity(entityType: String, entityId: String, tagId: String)

    @Query("DELETE FROM entity_tags WHERE entityType = :entityType AND entityId = :entityId")
    suspend fun removeAllTagsFromEntity(entityType: String, entityId: String)

    @Query("DELETE FROM entity_tags WHERE tagId = :tagId")
    suspend fun deleteByTag(tagId: String)
}

/**
 * Data Access Object for saved searches.
 */
@Dao
interface SavedSearchDao {
    @Query("SELECT * FROM saved_searches WHERE id = :id")
    suspend fun getSavedSearch(id: String): SavedSearchEntity?

    @Query("SELECT * FROM saved_searches WHERE id = :id")
    fun observeSavedSearch(id: String): Flow<SavedSearchEntity?>

    @Query("SELECT * FROM saved_searches WHERE userPubkey = :userPubkey ORDER BY useCount DESC, updatedAt DESC")
    fun getSavedSearchesByUser(userPubkey: String): Flow<List<SavedSearchEntity>>

    @Query("SELECT * FROM saved_searches WHERE userPubkey = :userPubkey ORDER BY useCount DESC LIMIT :limit")
    suspend fun getTopSavedSearches(userPubkey: String, limit: Int = 5): List<SavedSearchEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSavedSearch(savedSearch: SavedSearchEntity)

    @Update
    suspend fun updateSavedSearch(savedSearch: SavedSearchEntity)

    @Query("UPDATE saved_searches SET useCount = useCount + 1, lastUsedAt = :timestamp WHERE id = :id")
    suspend fun incrementUseCount(id: String, timestamp: Long)

    @Delete
    suspend fun deleteSavedSearch(savedSearch: SavedSearchEntity)

    @Query("DELETE FROM saved_searches WHERE id = :id")
    suspend fun deleteSavedSearchById(id: String)

    @Query("DELETE FROM saved_searches WHERE userPubkey = :userPubkey")
    suspend fun deleteSavedSearchesByUser(userPubkey: String)
}

/**
 * Data Access Object for recent search history.
 */
@Dao
interface RecentSearchDao {
    @Query("SELECT * FROM recent_searches WHERE userPubkey = :userPubkey ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentSearches(userPubkey: String, limit: Int = 10): Flow<List<RecentSearchEntity>>

    @Query("SELECT * FROM recent_searches WHERE userPubkey = :userPubkey AND query LIKE '%' || :queryPrefix || '%' ORDER BY timestamp DESC LIMIT :limit")
    suspend fun searchRecentSearches(userPubkey: String, queryPrefix: String, limit: Int = 5): List<RecentSearchEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecentSearch(recentSearch: RecentSearchEntity)

    @Query("DELETE FROM recent_searches WHERE id = :id")
    suspend fun deleteRecentSearch(id: String)

    @Query("DELETE FROM recent_searches WHERE userPubkey = :userPubkey")
    suspend fun clearRecentSearches(userPubkey: String)

    @Query("DELETE FROM recent_searches WHERE userPubkey = :userPubkey AND timestamp < :timestamp")
    suspend fun deleteOldSearches(userPubkey: String, timestamp: Long)

    @Query("""
        DELETE FROM recent_searches WHERE userPubkey = :userPubkey
        AND id NOT IN (SELECT id FROM recent_searches WHERE userPubkey = :userPubkey ORDER BY timestamp DESC LIMIT :keepCount)
    """)
    suspend fun trimRecentSearches(userPubkey: String, keepCount: Int = 50)
}

/**
 * Data Access Object for TF-IDF term frequencies.
 */
@Dao
interface TermFrequencyDao {
    @Query("SELECT * FROM term_frequencies WHERE documentId = :documentId")
    suspend fun getTermsForDocument(documentId: String): List<TermFrequencyEntity>

    @Query("SELECT * FROM term_frequencies WHERE term = :term")
    suspend fun getDocumentsForTerm(term: String): List<TermFrequencyEntity>

    @Query("SELECT * FROM term_frequencies WHERE term = :term AND groupId = :groupId")
    suspend fun getDocumentsForTermInGroup(term: String, groupId: String): List<TermFrequencyEntity>

    @Query("SELECT DISTINCT term FROM term_frequencies")
    suspend fun getAllTerms(): List<String>

    @Query("SELECT COUNT(DISTINCT term) FROM term_frequencies")
    suspend fun getUniqueTermCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTermFrequency(termFrequency: TermFrequencyEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTermFrequencies(termFrequencies: List<TermFrequencyEntity>)

    @Query("DELETE FROM term_frequencies WHERE documentId = :documentId")
    suspend fun deleteTermsForDocument(documentId: String)

    @Query("DELETE FROM term_frequencies")
    suspend fun deleteAllTermFrequencies()
}

/**
 * Data Access Object for IDF values.
 */
@Dao
interface InverseDocumentFrequencyDao {
    @Query("SELECT * FROM inverse_document_frequencies WHERE term = :term")
    suspend fun getIdf(term: String): InverseDocumentFrequencyEntity?

    @Query("SELECT * FROM inverse_document_frequencies WHERE term IN (:terms)")
    suspend fun getIdfsForTerms(terms: List<String>): List<InverseDocumentFrequencyEntity>

    @Query("SELECT * FROM inverse_document_frequencies ORDER BY documentCount DESC LIMIT :limit")
    suspend fun getMostCommonTerms(limit: Int = 100): List<InverseDocumentFrequencyEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIdf(idf: InverseDocumentFrequencyEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIdfs(idfs: List<InverseDocumentFrequencyEntity>)

    @Query("DELETE FROM inverse_document_frequencies WHERE term = :term")
    suspend fun deleteIdf(term: String)

    @Query("DELETE FROM inverse_document_frequencies")
    suspend fun deleteAllIdfs()
}
