package network.buildit.modules.publishing.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.modules.publishing.data.PublishingRepository
import network.buildit.modules.publishing.data.local.*
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for publishing module operations.
 *
 * Handles all business logic for:
 * - Creating and managing articles
 * - Managing publications
 * - Comment handling
 * - Subscriber management
 * - Nostr event publishing
 */
@Singleton
class PublishingUseCase @Inject constructor(
    private val repository: PublishingRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    // ============== Articles ==============

    /**
     * Creates a new article.
     *
     * @param title Article title
     * @param content Article content (markdown)
     * @param publicationId Optional publication ID
     * @param status Article status
     * @param options Additional article options
     * @return Result containing the created article
     */
    suspend fun createArticle(
        title: String,
        content: String,
        publicationId: String? = null,
        status: ArticleStatus = ArticleStatus.DRAFT,
        options: ArticleOptions = ArticleOptions()
    ): ModuleResult<ArticleEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val article = ArticleEntity.create(
                id = UUID.randomUUID().toString(),
                title = title,
                content = content,
                authorPubkey = pubkey,
                slug = options.slug,
                subtitle = options.subtitle,
                excerpt = options.excerpt,
                coverImage = options.coverImage,
                tags = options.tags,
                categories = options.categories,
                status = status,
                visibility = options.visibility,
                groupId = options.groupId,
                publicationId = publicationId,
                authorName = options.authorName,
                coauthors = options.coauthors,
                canonicalUrl = options.canonicalUrl,
                seo = options.seo
            )

            repository.saveArticle(article)

            // Publish to Nostr if the article is published
            if (status == ArticleStatus.PUBLISHED) {
                publishArticleToNostr(article)
            }

            article
        }.toModuleResult()
    }

    /**
     * Updates an existing article.
     *
     * @param article The updated article
     * @return Result containing the updated article
     */
    suspend fun updateArticle(article: ArticleEntity): ModuleResult<ArticleEntity> {
        return runCatching {
            val updatedArticle = article.copy(
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateArticle(updatedArticle)

            // Publish update to Nostr if article is published
            if (updatedArticle.status == ArticleStatus.PUBLISHED) {
                publishArticleToNostr(updatedArticle)
            }

            updatedArticle
        }.toModuleResult()
    }

    /**
     * Publishes a draft article.
     *
     * @param articleId The article ID
     * @return Result containing the published article
     */
    suspend fun publishArticle(articleId: String): ModuleResult<ArticleEntity> {
        return runCatching {
            val article = repository.getArticle(articleId)
                ?: throw IllegalArgumentException("Article not found")

            val now = System.currentTimeMillis() / 1000
            val publishedArticle = article.copy(
                status = ArticleStatus.PUBLISHED,
                publishedAt = now,
                updatedAt = now
            )

            repository.updateArticle(publishedArticle)
            publishArticleToNostr(publishedArticle)

            publishedArticle
        }.toModuleResult()
    }

    /**
     * Archives an article.
     *
     * @param articleId The article ID
     * @return Result indicating success
     */
    suspend fun archiveArticle(articleId: String): ModuleResult<Unit> {
        return runCatching {
            val article = repository.getArticle(articleId)
                ?: throw IllegalArgumentException("Article not found")

            val archivedArticle = article.copy(
                status = ArticleStatus.ARCHIVED,
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateArticle(archivedArticle)
        }.toModuleResult()
    }

    /**
     * Deletes an article.
     *
     * @param articleId The article ID
     * @return Result indicating success
     */
    suspend fun deleteArticle(articleId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteArticle(articleId)

            // Publish deletion event to Nostr
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val deleteEvent = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = NostrClient.KIND_DELETE,
                tags = listOf(listOf("e", articleId)),
                content = ""
            )

            val signed = cryptoManager.signEvent(deleteEvent)
            if (signed != null) {
                nostrClient.publishEvent(
                    NostrEvent(
                        id = signed.id,
                        pubkey = signed.pubkey,
                        createdAt = signed.createdAt,
                        kind = signed.kind,
                        tags = signed.tags,
                        content = signed.content,
                        sig = signed.sig
                    )
                )
            }
        }.toModuleResult()
    }

    /**
     * Gets articles for a publication.
     */
    fun getArticlesByPublication(publicationId: String): Flow<List<ArticleEntity>> {
        return repository.getArticlesByPublication(publicationId)
    }

    /**
     * Gets articles by the current user.
     */
    fun getMyArticles(): Flow<List<ArticleEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getArticlesByAuthor(pubkey)
    }

    /**
     * Gets draft articles by the current user.
     */
    fun getMyDrafts(): Flow<List<ArticleEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getDraftsByAuthor(pubkey)
    }

    /**
     * Gets a specific article.
     */
    suspend fun getArticle(id: String): ArticleEntity? {
        return repository.getArticle(id)
    }

    /**
     * Observes a specific article.
     */
    fun observeArticle(id: String): Flow<ArticleEntity?> {
        return repository.observeArticle(id)
    }

    /**
     * Searches articles.
     */
    suspend fun searchArticles(query: String): List<ArticleEntity> {
        return repository.searchArticles(query)
    }

    /**
     * Gets public articles.
     */
    fun getPublicArticles(): Flow<List<ArticleEntity>> {
        return repository.getPublicArticles()
    }

    /**
     * Gets recent articles.
     */
    fun getRecentArticles(limit: Int = 20): Flow<List<ArticleEntity>> {
        return repository.getRecentArticles(limit)
    }

    /**
     * Increments view count.
     */
    suspend fun recordView(articleId: String) {
        repository.incrementViewCount(articleId)
    }

    // ============== Comments ==============

    /**
     * Adds a comment to an article.
     *
     * @param articleId The article ID
     * @param content Comment content
     * @param parentId Optional parent comment ID for replies
     * @return Result containing the created comment
     */
    suspend fun addComment(
        articleId: String,
        content: String,
        parentId: String? = null
    ): ModuleResult<CommentEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val comment = CommentEntity(
                id = UUID.randomUUID().toString(),
                articleId = articleId,
                parentId = parentId,
                content = content,
                authorPubkey = pubkey,
                authorName = null // Could be fetched from profile
            )

            repository.saveComment(comment)
            publishCommentToNostr(comment)

            comment
        }.toModuleResult()
    }

    /**
     * Updates a comment.
     */
    suspend fun updateComment(comment: CommentEntity): ModuleResult<CommentEntity> {
        return runCatching {
            val updatedComment = comment.copy(
                updatedAt = System.currentTimeMillis() / 1000
            )
            repository.updateComment(updatedComment)
            updatedComment
        }.toModuleResult()
    }

    /**
     * Deletes a comment.
     */
    suspend fun deleteComment(commentId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteComment(commentId)
        }.toModuleResult()
    }

    /**
     * Gets comments for an article.
     */
    fun getComments(articleId: String): Flow<List<CommentEntity>> {
        return repository.getTopLevelComments(articleId)
    }

    /**
     * Gets replies to a comment.
     */
    fun getReplies(parentId: String): Flow<List<CommentEntity>> {
        return repository.getReplies(parentId)
    }

    /**
     * Gets comment count for an article.
     */
    suspend fun getCommentCount(articleId: String): Int {
        return repository.getCommentCount(articleId)
    }

    // ============== Publications ==============

    /**
     * Creates a new publication.
     *
     * @param name Publication name
     * @param description Publication description
     * @param options Additional publication options
     * @return Result containing the created publication
     */
    suspend fun createPublication(
        name: String,
        description: String? = null,
        options: PublicationOptions = PublicationOptions()
    ): ModuleResult<PublicationEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val publication = PublicationEntity.create(
                id = UUID.randomUUID().toString(),
                name = name,
                ownerPubkey = pubkey,
                description = description,
                logo = options.logo,
                coverImage = options.coverImage,
                groupId = options.groupId,
                visibility = options.visibility,
                editors = options.editors
            )

            repository.savePublication(publication)
            publishPublicationToNostr(publication)

            publication
        }.toModuleResult()
    }

    /**
     * Updates a publication.
     */
    suspend fun updatePublication(publication: PublicationEntity): ModuleResult<PublicationEntity> {
        return runCatching {
            repository.updatePublication(publication)
            publishPublicationToNostr(publication)
            publication
        }.toModuleResult()
    }

    /**
     * Deletes a publication.
     */
    suspend fun deletePublication(publicationId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deletePublication(publicationId)
        }.toModuleResult()
    }

    /**
     * Gets publications owned by the current user.
     */
    fun getMyPublications(): Flow<List<PublicationEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getPublicationsByOwner(pubkey)
    }

    /**
     * Gets a specific publication.
     */
    suspend fun getPublication(id: String): PublicationEntity? {
        return repository.getPublication(id)
    }

    /**
     * Observes a specific publication.
     */
    fun observePublication(id: String): Flow<PublicationEntity?> {
        return repository.observePublication(id)
    }

    /**
     * Gets public publications.
     */
    fun getPublicPublications(): Flow<List<PublicationEntity>> {
        return repository.getPublicPublications()
    }

    // ============== Subscribers ==============

    /**
     * Subscribes to a publication.
     */
    suspend fun subscribe(publicationId: String): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val subscriber = SubscriberEntity(
                publicationId = publicationId,
                pubkey = pubkey,
                displayName = null,
                email = null
            )

            repository.subscribe(subscriber)
        }.toModuleResult()
    }

    /**
     * Unsubscribes from a publication.
     */
    suspend fun unsubscribe(publicationId: String): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            repository.unsubscribe(publicationId, pubkey)
        }.toModuleResult()
    }

    /**
     * Checks if the current user is subscribed.
     */
    suspend fun isSubscribed(publicationId: String): Boolean {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return false
        return repository.isSubscribed(publicationId, pubkey)
    }

    /**
     * Gets subscribers for a publication.
     */
    fun getSubscribers(publicationId: String): Flow<List<SubscriberEntity>> {
        return repository.getSubscribers(publicationId)
    }

    /**
     * Gets subscriber count for a publication.
     */
    suspend fun getSubscriberCount(publicationId: String): Int {
        return repository.getSubscriberCount(publicationId)
    }

    /**
     * Updates notification settings.
     */
    suspend fun updateNotifications(publicationId: String, enabled: Boolean): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            repository.updateNotifications(publicationId, pubkey, enabled)
        }.toModuleResult()
    }

    // ============== Nostr Publishing ==============

    /**
     * Publishes an article to Nostr relays.
     */
    private suspend fun publishArticleToNostr(article: ArticleEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        // Build article content
        val articleContent = buildString {
            append("""{"_v":"${article.schemaVersion}"""")
            append(""","id":"${article.id}"""")
            append(""","title":"${escapeJson(article.title)}"""")
            article.slug?.let { append(""","slug":"$it"""") }
            article.subtitle?.let { append(""","subtitle":"${escapeJson(it)}"""") }
            append(""","content":"${escapeJson(article.content)}"""")
            article.excerpt?.let { append(""","excerpt":"${escapeJson(it)}"""") }
            article.coverImage?.let { append(""","coverImage":"$it"""") }
            if (article.tags.isNotEmpty()) {
                append(""","tags":${article.tagsJson}""")
            }
            if (article.categories.isNotEmpty()) {
                append(""","categories":${article.categoriesJson}""")
            }
            append(""","status":"${article.status.value}"""")
            append(""","visibility":"${article.visibility.value}"""")
            article.publishedAt?.let { append(""","publishedAt":$it""") }
            append(""","authorPubkey":"${article.authorPubkey}"""")
            article.authorName?.let { append(""","authorName":"${escapeJson(it)}"""") }
            if (article.coauthors.isNotEmpty()) {
                append(""","coauthors":${article.coauthorsJson}""")
            }
            article.calculatedReadingTime.let { append(""","readingTime":$it""") }
            append(""","viewCount":${article.viewCount}""")
            article.canonicalUrl?.let { append(""","canonicalUrl":"$it"""") }
            article.seoJson?.let { append(""","seo":$it""") }
            append(""","createdAt":${article.createdAt}""")
            article.updatedAt?.let { append(""","updatedAt":$it""") }
            append("}")
        }

        // Build tags
        val tags = mutableListOf<List<String>>()
        tags.add(listOf("d", article.id))
        tags.add(listOf("module", "publishing"))
        article.publicationId?.let { tags.add(listOf("publication", it)) }
        article.groupId?.let { tags.add(listOf("g", it)) }
        article.tags.forEach { tag -> tags.add(listOf("t", tag)) }

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = article.publishedAt ?: article.createdAt,
            kind = KIND_ARTICLE,
            tags = tags,
            content = articleContent
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    /**
     * Publishes a comment to Nostr relays.
     */
    private suspend fun publishCommentToNostr(comment: CommentEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val commentContent = buildString {
            append("""{"_v":"${comment.schemaVersion}"""")
            append(""","id":"${comment.id}"""")
            append(""","articleId":"${comment.articleId}"""")
            comment.parentId?.let { append(""","parentId":"$it"""") }
            append(""","content":"${escapeJson(comment.content)}"""")
            append(""","authorPubkey":"${comment.authorPubkey}"""")
            comment.authorName?.let { append(""","authorName":"${escapeJson(it)}"""") }
            append(""","createdAt":${comment.createdAt}""")
            comment.updatedAt?.let { append(""","updatedAt":$it""") }
            append("}")
        }

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("e", comment.articleId))
        tags.add(listOf("module", "publishing"))
        comment.parentId?.let { tags.add(listOf("e", it, "", "reply")) }

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = comment.createdAt,
            kind = KIND_COMMENT,
            tags = tags,
            content = commentContent
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    /**
     * Publishes a publication to Nostr relays.
     */
    private suspend fun publishPublicationToNostr(publication: PublicationEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val publicationContent = buildString {
            append("""{"_v":"${publication.schemaVersion}"""")
            append(""","id":"${publication.id}"""")
            append(""","name":"${escapeJson(publication.name)}"""")
            publication.description?.let { append(""","description":"${escapeJson(it)}"""") }
            publication.logo?.let { append(""","logo":"$it"""") }
            publication.coverImage?.let { append(""","coverImage":"$it"""") }
            publication.groupId?.let { append(""","groupId":"$it"""") }
            append(""","visibility":"${publication.visibility.value}"""")
            if (publication.editors.isNotEmpty()) {
                append(""","editors":${publication.editorsJson}""")
            }
            append(""","ownerPubkey":"${publication.ownerPubkey}"""")
            append(""","createdAt":${publication.createdAt}""")
            append("}")
        }

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("d", publication.id))
        tags.add(listOf("module", "publishing"))
        publication.groupId?.let { tags.add(listOf("g", it)) }

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = publication.createdAt,
            kind = KIND_PUBLICATION,
            tags = tags,
            content = publicationContent
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private fun escapeJson(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    companion object {
        const val KIND_ARTICLE = 40071
        const val KIND_COMMENT = 40072
        const val KIND_PUBLICATION = 40073
    }
}

/**
 * Options for creating an article.
 */
data class ArticleOptions(
    val slug: String? = null,
    val subtitle: String? = null,
    val excerpt: String? = null,
    val coverImage: String? = null,
    val tags: List<String> = emptyList(),
    val categories: List<String> = emptyList(),
    val visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
    val groupId: String? = null,
    val authorName: String? = null,
    val coauthors: List<String> = emptyList(),
    val canonicalUrl: String? = null,
    val seo: SEOMetadata? = null
)

/**
 * Options for creating a publication.
 */
data class PublicationOptions(
    val logo: String? = null,
    val coverImage: String? = null,
    val groupId: String? = null,
    val visibility: PublishingVisibility = PublishingVisibility.PUBLIC,
    val editors: List<String> = emptyList()
)
