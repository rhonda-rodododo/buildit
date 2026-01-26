package network.buildit.modules.wiki.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Status of a wiki page.
 */
enum class PageStatus(val displayName: String) {
    DRAFT("Draft"),
    REVIEW("In Review"),
    PUBLISHED("Published"),
    ARCHIVED("Archived"),
    DELETED("Deleted")
}

/**
 * Visibility of a wiki page.
 */
enum class PageVisibility(val displayName: String) {
    PUBLIC("Public"),
    GROUP("Group Only"),
    PRIVATE("Private"),
    ROLE_RESTRICTED("Role Restricted")
}

/**
 * Type of edit made to a page.
 */
enum class EditType {
    CREATE,
    EDIT,
    REVERT,
    MERGE,
    MOVE
}

/**
 * Room entity for wiki pages.
 */
@Entity(
    tableName = "wiki_pages",
    indices = [
        Index("groupId"),
        Index("slug"),
        Index("categoryId"),
        Index("status"),
        Index(value = ["groupId", "slug"], unique = true)
    ]
)
data class WikiPageEntity(
    @PrimaryKey
    val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String,
    val slug: String,
    val title: String,
    val content: String,
    val summary: String?,
    val version: Int = 1,
    val parentId: String?,
    val categoryId: String?,
    val status: PageStatus = PageStatus.DRAFT,
    val visibility: PageVisibility = PageVisibility.GROUP,
    val tagsJson: String = "[]", // JSON encoded tags list
    val createdBy: String,
    val lastEditedBy: String?,
    val contributorsJson: String = "[]", // JSON encoded contributors list
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null,
    val publishedAt: Long? = null,
    val archivedAt: Long? = null
) {
    val tags: List<String>
        get() = try {
            Json.decodeFromString(tagsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val contributors: List<String>
        get() = try {
            Json.decodeFromString(contributorsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val isPublished: Boolean
        get() = status == PageStatus.PUBLISHED

    val wordCount: Int
        get() = content.split(Regex("\\s+")).size

    val readingTimeMinutes: Int
        get() = maxOf(1, wordCount / 200)
}

/**
 * Room entity for wiki categories.
 */
@Entity(
    tableName = "wiki_categories",
    indices = [
        Index("groupId"),
        Index("slug"),
        Index(value = ["groupId", "slug"], unique = true)
    ]
)
data class WikiCategoryEntity(
    @PrimaryKey
    val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String,
    val name: String,
    val slug: String,
    val description: String?,
    val parentId: String?,
    val icon: String?,
    val color: String?,
    val order: Int = 0,
    val pageCount: Int = 0,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null
)

/**
 * Room entity for page revisions.
 */
@Entity(
    tableName = "page_revisions",
    indices = [
        Index("pageId"),
        Index(value = ["pageId", "version"], unique = true)
    ]
)
data class PageRevisionEntity(
    @PrimaryKey
    val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val pageId: String,
    val version: Int,
    val title: String,
    val content: String,
    val summary: String?,
    val diff: String?,
    val editedBy: String,
    val editType: EditType = EditType.EDIT,
    val revertedFrom: Int?,
    val createdAt: Long = System.currentTimeMillis() / 1000
)

/**
 * Search result data class (not an entity, computed from pages).
 */
data class WikiSearchResult(
    val pageId: String,
    val title: String,
    val slug: String,
    val summary: String?,
    val excerpt: String?,
    val score: Double,
    val matchedTags: List<String>,
    val categoryName: String?,
    val updatedAt: Long?
)

/**
 * Table of contents entry extracted from page content.
 */
data class TableOfContentsEntry(
    val id: String = java.util.UUID.randomUUID().toString(),
    val title: String,
    val level: Int,
    val anchor: String
)
