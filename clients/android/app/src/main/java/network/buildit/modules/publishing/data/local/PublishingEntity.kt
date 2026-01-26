package network.buildit.modules.publishing.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Status of an article.
 */
enum class ArticleStatus(val value: String) {
    DRAFT("draft"),
    PUBLISHED("published"),
    ARCHIVED("archived")
}

/**
 * Visibility of an article or publication.
 */
enum class PublishingVisibility(val value: String) {
    PRIVATE("private"),
    GROUP("group"),
    PUBLIC("public")
}

/**
 * SEO metadata for articles.
 */
@Serializable
data class SEOMetadata(
    val metaTitle: String? = null,
    val metaDescription: String? = null,
    val ogImage: String? = null,
    val keywords: List<String>? = null
)

/**
 * Room entity for articles/blog posts.
 */
@Entity(
    tableName = "publishing_articles",
    indices = [
        Index("authorPubkey"),
        Index("publicationId"),
        Index("status"),
        Index("publishedAt"),
        Index("slug"),
        Index("groupId"),
        Index(value = ["publicationId", "slug"], unique = true)
    ]
)
data class ArticleEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val title: String,
    val slug: String?,
    val subtitle: String?,
    val content: String,
    val excerpt: String?,
    val coverImage: String?,
    val tagsJson: String = "[]",
    val categoriesJson: String = "[]",
    val status: ArticleStatus = ArticleStatus.DRAFT,
    val visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
    val groupId: String?,
    val publicationId: String?,
    val publishedAt: Long?,
    val authorPubkey: String,
    val authorName: String?,
    val coauthorsJson: String = "[]",
    val readingTime: Int?,
    val viewCount: Int = 0,
    val canonicalUrl: String?,
    val seoJson: String?,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null
) {
    /**
     * Gets parsed tags list.
     */
    val tags: List<String>
        get() = try {
            Json.decodeFromString(tagsJson)
        } catch (_: Exception) {
            emptyList()
        }

    /**
     * Gets parsed categories list.
     */
    val categories: List<String>
        get() = try {
            Json.decodeFromString(categoriesJson)
        } catch (_: Exception) {
            emptyList()
        }

    /**
     * Gets parsed coauthors list.
     */
    val coauthors: List<String>
        get() = try {
            Json.decodeFromString(coauthorsJson)
        } catch (_: Exception) {
            emptyList()
        }

    /**
     * Gets parsed SEO metadata.
     */
    val seo: SEOMetadata?
        get() = seoJson?.let {
            try {
                Json.decodeFromString(it)
            } catch (_: Exception) {
                null
            }
        }

    /**
     * Calculates word count from content.
     */
    val wordCount: Int
        get() = content.split(Regex("\\s+")).filter { it.isNotBlank() }.size

    /**
     * Calculates reading time in minutes (assuming 200 words per minute).
     */
    val calculatedReadingTime: Int
        get() = readingTime ?: maxOf(1, wordCount / 200)

    companion object {
        /**
         * Creates an ArticleEntity from article data.
         */
        fun create(
            id: String,
            title: String,
            content: String,
            authorPubkey: String,
            slug: String? = null,
            subtitle: String? = null,
            excerpt: String? = null,
            coverImage: String? = null,
            tags: List<String> = emptyList(),
            categories: List<String> = emptyList(),
            status: ArticleStatus = ArticleStatus.DRAFT,
            visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
            groupId: String? = null,
            publicationId: String? = null,
            authorName: String? = null,
            coauthors: List<String> = emptyList(),
            readingTime: Int? = null,
            canonicalUrl: String? = null,
            seo: SEOMetadata? = null
        ): ArticleEntity {
            val now = System.currentTimeMillis() / 1000
            return ArticleEntity(
                id = id,
                title = title,
                slug = slug ?: generateSlug(title),
                subtitle = subtitle,
                content = content,
                excerpt = excerpt ?: generateExcerpt(content),
                coverImage = coverImage,
                tagsJson = Json.encodeToString(tags),
                categoriesJson = Json.encodeToString(categories),
                status = status,
                visibility = visibility,
                groupId = groupId,
                publicationId = publicationId,
                publishedAt = if (status == ArticleStatus.PUBLISHED) now else null,
                authorPubkey = authorPubkey,
                authorName = authorName,
                coauthorsJson = Json.encodeToString(coauthors),
                readingTime = readingTime,
                canonicalUrl = canonicalUrl,
                seoJson = seo?.let { Json.encodeToString(it) },
                createdAt = now
            )
        }

        /**
         * Generates URL-friendly slug from title.
         */
        fun generateSlug(title: String): String {
            return title.lowercase()
                .replace(Regex("[^a-z0-9\\s-]"), "")
                .replace(Regex("\\s+"), "-")
                .replace(Regex("-+"), "-")
                .trim('-')
                .take(256)
        }

        /**
         * Generates excerpt from content.
         */
        fun generateExcerpt(content: String, maxLength: Int = 160): String {
            val plainText = content
                .replace(Regex("#+ "), "")
                .replace(Regex("\\*\\*|__"), "")
                .replace(Regex("\\*|_"), "")
                .replace(Regex("```[\\s\\S]*?```"), "")
                .replace(Regex("`[^`]+`"), "")
                .replace(Regex("\\[([^]]+)]\\([^)]+\\)"), "$1")
                .replace(Regex("\\n+"), " ")
                .trim()

            return if (plainText.length <= maxLength) {
                plainText
            } else {
                plainText.take(maxLength - 3).trim() + "..."
            }
        }
    }
}

/**
 * Room entity for comments on articles.
 */
@Entity(
    tableName = "publishing_comments",
    indices = [
        Index("articleId"),
        Index("parentId"),
        Index("authorPubkey"),
        Index("createdAt")
    ]
)
data class CommentEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val articleId: String,
    val parentId: String?,
    val content: String,
    val authorPubkey: String,
    val authorName: String?,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null
)

/**
 * Room entity for publications (blog/newsletter collections).
 */
@Entity(
    tableName = "publishing_publications",
    indices = [
        Index("ownerPubkey"),
        Index("groupId"),
        Index("visibility")
    ]
)
data class PublicationEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val name: String,
    val description: String?,
    val logo: String?,
    val coverImage: String?,
    val groupId: String?,
    val visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
    val editorsJson: String = "[]",
    val ownerPubkey: String,
    val createdAt: Long = System.currentTimeMillis() / 1000
) {
    /**
     * Gets parsed editors list.
     */
    val editors: List<String>
        get() = try {
            Json.decodeFromString(editorsJson)
        } catch (_: Exception) {
            emptyList()
        }

    companion object {
        /**
         * Creates a PublicationEntity.
         */
        fun create(
            id: String,
            name: String,
            ownerPubkey: String,
            description: String? = null,
            logo: String? = null,
            coverImage: String? = null,
            groupId: String? = null,
            visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
            editors: List<String> = emptyList()
        ): PublicationEntity {
            return PublicationEntity(
                id = id,
                name = name,
                description = description,
                logo = logo,
                coverImage = coverImage,
                groupId = groupId,
                visibility = visibility,
                editorsJson = Json.encodeToString(editors),
                ownerPubkey = ownerPubkey,
                createdAt = System.currentTimeMillis() / 1000
            )
        }
    }
}

/**
 * Room entity for publication subscribers.
 */
@Entity(
    tableName = "publishing_subscribers",
    primaryKeys = ["publicationId", "pubkey"],
    indices = [
        Index("publicationId"),
        Index("pubkey"),
        Index("subscribedAt")
    ]
)
data class SubscriberEntity(
    val publicationId: String,
    val pubkey: String,
    val displayName: String?,
    val email: String?,
    val subscribedAt: Long = System.currentTimeMillis() / 1000,
    val notificationsEnabled: Boolean = true
)

/**
 * Article with publication info for display.
 */
data class ArticleWithPublication(
    val article: ArticleEntity,
    val publication: PublicationEntity?
)

/**
 * Comment with reply count for display.
 */
data class CommentWithReplies(
    val comment: CommentEntity,
    val replyCount: Int,
    val replies: List<CommentEntity> = emptyList()
)
