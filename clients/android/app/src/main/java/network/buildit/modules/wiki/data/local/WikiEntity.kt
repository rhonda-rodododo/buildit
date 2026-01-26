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
 * Status of an edit suggestion.
 */
enum class SuggestionStatus {
    PENDING,
    APPROVED,
    REJECTED,
    MERGED,
    SUPERSEDED
}

/**
 * Role-based access control for wiki pages (stored as JSON).
 */
@Serializable
data class PagePermissions(
    val editRoles: List<String>? = null,
    val viewRoles: List<String>? = null,
    val allowComments: Boolean = true,
    val allowSuggestions: Boolean = true
)

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
    val permissionsJson: String? = null, // JSON encoded PagePermissions
    val tagsJson: String = "[]", // JSON encoded tags list
    val aliasesJson: String? = null, // JSON encoded aliases list
    val createdBy: String,
    val lastEditedBy: String?,
    val contributorsJson: String = "[]", // JSON encoded contributors list
    val lockedBy: String? = null,
    val lockedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null,
    val publishedAt: Long? = null,
    val archivedAt: Long? = null,
    val deletedAt: Long? = null,
    val metadataJson: String? = null // JSON encoded metadata
) {
    val tags: List<String>
        get() = try {
            Json.decodeFromString(tagsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val aliases: List<String>
        get() = aliasesJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (_: Exception) {
                emptyList()
            }
        } ?: emptyList()

    val contributors: List<String>
        get() = try {
            Json.decodeFromString(contributorsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val permissions: PagePermissions?
        get() = permissionsJson?.let {
            try {
                Json.decodeFromString<PagePermissions>(it)
            } catch (_: Exception) {
                null
            }
        }

    val isPublished: Boolean
        get() = status == PageStatus.PUBLISHED

    val isLocked: Boolean
        get() = lockedBy != null

    val isDeleted: Boolean
        get() = deletedAt != null

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

/**
 * Room entity for wiki page links.
 */
@Entity(
    tableName = "wiki_links",
    indices = [
        Index("sourcePageId"),
        Index("targetPageId"),
        Index("targetSlug")
    ]
)
data class WikiLinkEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val sourcePageId: String,
    val targetPageId: String?,
    val targetSlug: String,
    val context: String?,
    val isBroken: Boolean = false,
    val createdAt: Long = System.currentTimeMillis() / 1000
)

/**
 * Room entity for page comments.
 */
@Entity(
    tableName = "page_comments",
    indices = [
        Index("pageId"),
        Index("authorId"),
        Index("parentId")
    ]
)
data class PageCommentEntity(
    @PrimaryKey
    val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val pageId: String,
    val parentId: String?, // For threaded replies
    val content: String,
    val authorId: String,
    val resolved: Boolean = false,
    val resolvedBy: String? = null,
    val resolvedAt: Long? = null,
    val editedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val deletedAt: Long? = null
) {
    val isReply: Boolean
        get() = parentId != null

    val isDeleted: Boolean
        get() = deletedAt != null
}

/**
 * Room entity for edit suggestions.
 */
@Entity(
    tableName = "edit_suggestions",
    indices = [
        Index("pageId"),
        Index("suggestedBy"),
        Index("status")
    ]
)
data class EditSuggestionEntity(
    @PrimaryKey
    val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val pageId: String,
    val baseVersion: Int,
    val title: String?,
    val content: String,
    val summary: String?,
    val diff: String?,
    val suggestedBy: String,
    val status: SuggestionStatus = SuggestionStatus.PENDING,
    val reviewedBy: String? = null,
    val reviewedAt: Long? = null,
    val reviewComment: String? = null,
    val createdAt: Long = System.currentTimeMillis() / 1000
) {
    val isPending: Boolean
        get() = status == SuggestionStatus.PENDING

    val isReviewed: Boolean
        get() = reviewedBy != null
}

/**
 * Type converters for Room.
 */
class WikiConverters {
    @androidx.room.TypeConverter
    fun fromPageStatus(value: PageStatus): String = value.name

    @androidx.room.TypeConverter
    fun toPageStatus(value: String): PageStatus = PageStatus.valueOf(value)

    @androidx.room.TypeConverter
    fun fromPageVisibility(value: PageVisibility): String = value.name

    @androidx.room.TypeConverter
    fun toPageVisibility(value: String): PageVisibility = PageVisibility.valueOf(value)

    @androidx.room.TypeConverter
    fun fromEditType(value: EditType): String = value.name

    @androidx.room.TypeConverter
    fun toEditType(value: String): EditType = EditType.valueOf(value)

    @androidx.room.TypeConverter
    fun fromSuggestionStatus(value: SuggestionStatus): String = value.name

    @androidx.room.TypeConverter
    fun toSuggestionStatus(value: String): SuggestionStatus = SuggestionStatus.valueOf(value)
}
