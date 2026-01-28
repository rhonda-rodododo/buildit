package network.buildit.modules.search.data

import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.FacetValue
import network.buildit.modules.search.models.SEARCH_SCHEMA_VERSION
import network.buildit.modules.search.models.SearchDocument
import network.buildit.modules.search.models.SearchScope
import network.buildit.modules.search.models.SparseVector

/**
 * Room entity for search documents.
 * Contains the main searchable content and metadata.
 */
@Entity(
    tableName = "search_documents",
    indices = [
        Index("moduleType"),
        Index("entityId"),
        Index("groupId"),
        Index("authorPubkey"),
        Index("createdAt"),
        Index("updatedAt"),
        Index("indexedAt")
    ]
)
data class SearchDocumentEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val moduleType: String,
    val entityId: String,
    val groupId: String,
    val title: String,
    val content: String,
    val tagsJson: String?, // JSON array of tags
    val excerpt: String?,
    val authorPubkey: String?,
    val facetsJson: String?, // JSON map of facets
    val vectorJson: String?, // JSON sparse vector
    val createdAt: Long,
    val updatedAt: Long,
    val indexedAt: Long
) {
    /**
     * Converts this entity to a SearchDocument model.
     */
    fun toSearchDocument(): SearchDocument {
        return SearchDocument(
            schemaVersion = schemaVersion,
            id = id,
            moduleType = moduleType,
            entityId = entityId,
            groupId = groupId,
            title = title,
            content = content,
            tags = tagsJson?.let { Json.decodeFromString<List<String>>(it) } ?: emptyList(),
            excerpt = excerpt,
            authorPubkey = authorPubkey,
            facets = facetsJson?.let {
                try {
                    Json.decodeFromString<Map<String, FacetValue>>(it)
                } catch (e: Exception) {
                    emptyMap()
                }
            } ?: emptyMap(),
            vector = vectorJson?.let { Json.decodeFromString<SparseVector>(it) },
            createdAt = createdAt,
            updatedAt = updatedAt,
            indexedAt = indexedAt
        )
    }

    companion object {
        /**
         * Creates an entity from a SearchDocument model.
         */
        fun from(document: SearchDocument): SearchDocumentEntity {
            return SearchDocumentEntity(
                id = document.id,
                schemaVersion = document.schemaVersion,
                moduleType = document.moduleType,
                entityId = document.entityId,
                groupId = document.groupId,
                title = document.title,
                content = document.content,
                tagsJson = if (document.tags.isNotEmpty()) Json.encodeToString(document.tags) else null,
                excerpt = document.excerpt,
                authorPubkey = document.authorPubkey,
                facetsJson = if (document.facets.isNotEmpty()) Json.encodeToString(document.facets) else null,
                vectorJson = document.vector?.let { Json.encodeToString(it) },
                createdAt = document.createdAt,
                updatedAt = document.updatedAt,
                indexedAt = document.indexedAt
            )
        }
    }
}

/**
 * FTS4 virtual table for full-text search.
 * Contains searchable text content for fast querying.
 */
@Entity(tableName = "search_fts")
@Fts4(contentEntity = SearchDocumentEntity::class)
data class SearchFtsEntity(
    val title: String,
    val content: String,
    val tagsJson: String?
)

/**
 * Room entity for tags.
 */
@Entity(
    tableName = "tags",
    indices = [
        Index("groupId"),
        Index("slug"),
        Index("parentTagId")
    ]
)
data class TagEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val groupId: String,
    val name: String,
    val slug: String,
    val color: String?,
    val parentTagId: String?,
    val usageCount: Int,
    val createdAt: Long,
    val createdBy: String,
    val updatedAt: Long
)

/**
 * Room entity for entity-tag associations.
 */
@Entity(
    tableName = "entity_tags",
    primaryKeys = ["entityType", "entityId", "tagId"],
    indices = [
        Index("tagId"),
        Index("groupId"),
        Index("entityType", "entityId")
    ]
)
data class EntityTagEntity(
    val id: String,
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val entityType: String,
    val entityId: String,
    val tagId: String,
    val groupId: String,
    val createdAt: Long,
    val createdBy: String
)

/**
 * Room entity for saved searches.
 */
@Entity(
    tableName = "saved_searches",
    indices = [
        Index("userPubkey"),
        Index("useCount")
    ]
)
data class SavedSearchEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val userPubkey: String,
    val name: String,
    val query: String,
    val scopeJson: String, // JSON SearchScope
    val filtersJson: String?, // JSON FacetFilters
    val createdAt: Long,
    val updatedAt: Long,
    val lastUsedAt: Long?,
    val useCount: Int
) {
    fun toSavedSearch(): network.buildit.modules.search.models.SavedSearch {
        return network.buildit.modules.search.models.SavedSearch(
            schemaVersion = schemaVersion,
            id = id,
            userPubkey = userPubkey,
            name = name,
            query = query,
            scope = Json.decodeFromString<SearchScope>(scopeJson),
            filters = filtersJson?.let { Json.decodeFromString<FacetFilters>(it) },
            createdAt = createdAt,
            updatedAt = updatedAt,
            lastUsedAt = lastUsedAt,
            useCount = useCount
        )
    }

    companion object {
        fun from(savedSearch: network.buildit.modules.search.models.SavedSearch): SavedSearchEntity {
            return SavedSearchEntity(
                id = savedSearch.id,
                schemaVersion = savedSearch.schemaVersion,
                userPubkey = savedSearch.userPubkey,
                name = savedSearch.name,
                query = savedSearch.query,
                scopeJson = Json.encodeToString(savedSearch.scope),
                filtersJson = savedSearch.filters?.let { Json.encodeToString(it) },
                createdAt = savedSearch.createdAt,
                updatedAt = savedSearch.updatedAt,
                lastUsedAt = savedSearch.lastUsedAt,
                useCount = savedSearch.useCount
            )
        }
    }
}

/**
 * Room entity for recent search history.
 */
@Entity(
    tableName = "recent_searches",
    indices = [
        Index("userPubkey"),
        Index("timestamp")
    ]
)
data class RecentSearchEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val userPubkey: String,
    val query: String,
    val scopeJson: String, // JSON SearchScope
    val timestamp: Long,
    val resultCount: Int
) {
    fun toRecentSearch(): network.buildit.modules.search.models.RecentSearch {
        return network.buildit.modules.search.models.RecentSearch(
            schemaVersion = schemaVersion,
            id = id,
            userPubkey = userPubkey,
            query = query,
            scope = Json.decodeFromString<SearchScope>(scopeJson),
            timestamp = timestamp,
            resultCount = resultCount
        )
    }

    companion object {
        fun from(recentSearch: network.buildit.modules.search.models.RecentSearch): RecentSearchEntity {
            return RecentSearchEntity(
                id = recentSearch.id,
                schemaVersion = recentSearch.schemaVersion,
                userPubkey = recentSearch.userPubkey,
                query = recentSearch.query,
                scopeJson = Json.encodeToString(recentSearch.scope),
                timestamp = recentSearch.timestamp,
                resultCount = recentSearch.resultCount
            )
        }
    }
}

/**
 * Room entity for term frequency storage (TF-IDF).
 * Stores document-term frequencies for semantic ranking.
 */
@Entity(
    tableName = "term_frequencies",
    primaryKeys = ["documentId", "term"],
    indices = [
        Index("term"),
        Index("groupId")
    ]
)
data class TermFrequencyEntity(
    val documentId: String,
    val term: String,
    val groupId: String,
    val frequency: Int,
    val normalizedFrequency: Double
)

/**
 * Room entity for inverse document frequencies.
 * Stores global IDF values for terms.
 */
@Entity(
    tableName = "inverse_document_frequencies",
    indices = [Index("documentCount")]
)
data class InverseDocumentFrequencyEntity(
    @PrimaryKey
    val term: String,
    val documentCount: Int,
    val idfValue: Double,
    val lastUpdated: Long
)
