package network.buildit.modules.search.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Schema version for search module models.
 */
const val SEARCH_SCHEMA_VERSION = "1.0.0"

/**
 * A document indexed for search - internal representation stored in search index.
 * Aligned with protocol/schemas/modules/search/v1.json
 */
@Serializable
data class SearchDocument(
    @SerialName("_v")
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val id: String,
    val moduleType: String,
    val entityId: String,
    val groupId: String,
    val title: String,
    val content: String,
    val tags: List<String> = emptyList(),
    val excerpt: String? = null,
    val authorPubkey: String? = null,
    val facets: Map<String, FacetValue> = emptyMap(),
    val vector: SparseVector? = null,
    val createdAt: Long,
    val updatedAt: Long,
    val indexedAt: Long
)

/**
 * Facet value types - string, number, boolean, string array, or range.
 */
@Serializable
sealed class FacetValue {
    @Serializable
    @SerialName("string")
    data class StringValue(val value: String) : FacetValue()

    @Serializable
    @SerialName("number")
    data class NumberValue(val value: Double) : FacetValue()

    @Serializable
    @SerialName("boolean")
    data class BooleanValue(val value: Boolean) : FacetValue()

    @Serializable
    @SerialName("stringArray")
    data class StringArrayValue(val value: List<String>) : FacetValue()

    @Serializable
    @SerialName("range")
    data class RangeValue(val min: Double, val max: Double) : FacetValue()
}

/**
 * Sparse vector representation for TF-IDF - maps term index to weight.
 */
typealias SparseVector = Map<String, Double>

/**
 * Defines a filterable facet for a module.
 */
@Serializable
data class FacetDefinition(
    val key: String,
    val label: String,
    val type: FacetType,
    val parentKey: String? = null,
    val multiSelect: Boolean
)

/**
 * Type of facet.
 */
@Serializable
enum class FacetType {
    @SerialName("keyword")
    KEYWORD,
    @SerialName("range")
    RANGE,
    @SerialName("date")
    DATE,
    @SerialName("boolean")
    BOOLEAN,
    @SerialName("hierarchy")
    HIERARCHY
}

/**
 * Defines the scope of a search query.
 */
@Serializable
sealed class SearchScope {
    @Serializable
    @SerialName("global")
    data object Global : SearchScope()

    @Serializable
    @SerialName("group")
    data class Group(val groupId: String) : SearchScope()

    @Serializable
    @SerialName("module")
    data class Module(val moduleType: String) : SearchScope()

    @Serializable
    @SerialName("module-in-group")
    data class ModuleInGroup(val moduleType: String, val groupId: String) : SearchScope()
}

/**
 * Filter operator for queries.
 */
@Serializable
enum class FilterOperator {
    @SerialName("eq")
    EQ,
    @SerialName("ne")
    NE,
    @SerialName("gt")
    GT,
    @SerialName("lt")
    LT,
    @SerialName("gte")
    GTE,
    @SerialName("lte")
    LTE,
    @SerialName("contains")
    CONTAINS,
    @SerialName("in")
    IN,
    @SerialName("range")
    RANGE
}

/**
 * Filter extracted from query or applied via UI.
 */
@Serializable
data class QueryFilter(
    val field: String,
    val operator: FilterOperator,
    val value: FacetValue
)

/**
 * Parsed and normalized search query.
 */
@Serializable
data class ParsedQuery(
    val raw: String,
    val keywords: List<String>,
    val phrases: List<String>,
    val expandedTerms: List<String> = emptyList(),
    val filters: List<QueryFilter>,
    val scope: SearchScope
)

/**
 * A search result with relevance scoring.
 */
@Serializable
data class SearchResult(
    val document: SearchDocument,
    val score: Double,
    val matchedTerms: List<String>,
    val matchedFields: List<String>,
    val highlightedExcerpt: String? = null
)

/**
 * Aggregated search results.
 */
@Serializable
data class SearchResults(
    val results: List<SearchResult>,
    val totalCount: Int,
    val facetCounts: FacetCounts? = null,
    val searchTimeMs: Double,
    val query: ParsedQuery
)

/**
 * Aggregated facet counts for filtering UI.
 */
@Serializable
data class FacetCounts(
    val moduleType: Map<String, Int> = emptyMap(),
    val groups: Map<String, Int> = emptyMap(),
    val tags: Map<String, Int> = emptyMap(),
    val dates: Map<String, Int> = emptyMap(),
    val authors: Map<String, Int> = emptyMap(),
    val custom: Map<String, Map<String, Int>> = emptyMap()
)

/**
 * Active facet filters for search.
 */
@Serializable
data class FacetFilters(
    val moduleTypes: List<String> = emptyList(),
    val groupIds: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val dateRange: DateRange? = null,
    val authors: List<String> = emptyList(),
    val custom: Map<String, List<FacetValue>> = emptyMap()
)

/**
 * Date range filter.
 */
@Serializable
data class DateRange(
    val start: Long,
    val end: Long
)

/**
 * User-defined tag for organizing content.
 */
@Serializable
data class Tag(
    @SerialName("_v")
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val id: String,
    val groupId: String,
    val name: String,
    val slug: String,
    val color: String? = null,
    val parentTagId: String? = null,
    val usageCount: Int,
    val createdAt: Long,
    val createdBy: String,
    val updatedAt: Long
)

/**
 * Association between an entity and a tag.
 */
@Serializable
data class EntityTag(
    @SerialName("_v")
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val id: String,
    val entityType: String,
    val entityId: String,
    val tagId: String,
    val groupId: String,
    val createdAt: Long,
    val createdBy: String
)

/**
 * Saved search query for quick access.
 */
@Serializable
data class SavedSearch(
    @SerialName("_v")
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val id: String,
    val userPubkey: String,
    val name: String,
    val query: String,
    val scope: SearchScope,
    val filters: FacetFilters? = null,
    val createdAt: Long,
    val updatedAt: Long,
    val lastUsedAt: Long? = null,
    val useCount: Int
)

/**
 * Recent search entry for history.
 */
@Serializable
data class RecentSearch(
    @SerialName("_v")
    val schemaVersion: String = SEARCH_SCHEMA_VERSION,
    val id: String,
    val userPubkey: String,
    val query: String,
    val scope: SearchScope,
    val timestamp: Long,
    val resultCount: Int
)

/**
 * Configuration for a module's search provider.
 */
@Serializable
data class SearchProviderConfig(
    val moduleType: String,
    val enabled: Boolean,
    val facetDefinitions: List<FacetDefinition>,
    val boost: Double = 1.0
)

/**
 * Options for fine-tuning search behavior.
 */
@Serializable
data class SearchOptions(
    val limit: Int = 50,
    val offset: Int = 0,
    val fuzzy: Boolean = false,
    val fuzzyThreshold: Double = 0.8,
    val prefix: Boolean = false,
    val boost: Map<String, Double> = emptyMap(),
    val semantic: Boolean = false,
    val semanticWeight: Double = 0.3,
    val highlight: Boolean = true
)

/**
 * Statistics about the search index.
 */
@Serializable
data class IndexStats(
    val totalDocuments: Int,
    val byModuleType: Map<String, Int>,
    val byGroup: Map<String, Int>,
    val uniqueTerms: Int,
    val sizeBytes: Long,
    val lastFullReindex: Long? = null,
    val lastIncrementalUpdate: Long? = null
)

/**
 * Concept expansion for semantic search in organizing contexts.
 */
@Serializable
data class ConceptExpansion(
    val term: String,
    val synonyms: List<String>,
    val broader: String? = null,
    val narrower: List<String> = emptyList()
)

/**
 * Formatted search result for display.
 */
data class FormattedSearchResult(
    val id: String,
    val moduleType: String,
    val title: String,
    val subtitle: String?,
    val excerpt: String?,
    val highlightedExcerpt: String?,
    val iconResId: Int?,
    val timestamp: Long?,
    val score: Double,
    val navigationRoute: String,
    val metadata: Map<String, String> = emptyMap()
)
