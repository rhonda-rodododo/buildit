package network.buildit.modules.publishing

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.publishing.data.PublishingRepository
import network.buildit.modules.publishing.data.local.*
import network.buildit.modules.publishing.domain.PublishingUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Publishing module for BuildIt.
 *
 * Provides article creation, blog publishing, and newsletter functionality.
 */
class PublishingModuleImpl @Inject constructor(
    private val publishingUseCase: PublishingUseCase,
    private val repository: PublishingRepository,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "publishing"
    override val version: String = "1.0.0"
    override val displayName: String = "Publishing"
    override val description: String = "Create and publish articles, blogs, and newsletters"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to publishing-related Nostr events
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 604800 // Last 7 days
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            PublishingUseCase.KIND_ARTICLE -> {
                handleArticleEvent(event)
                true
            }
            PublishingUseCase.KIND_COMMENT -> {
                handleCommentEvent(event)
                true
            }
            PublishingUseCase.KIND_PUBLICATION -> {
                handlePublicationEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeletionEvent(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "publishing",
                title = "Articles",
                icon = Icons.Default.Article,
                showInNavigation = true,
                content = { args ->
                    // ArticlesListScreen(publicationId = args["publicationId"])
                }
            ),
            ModuleRoute(
                route = "publishing/articles/{articleId}",
                title = "Article",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val articleId = args["articleId"] ?: return@ModuleRoute
                    // ArticlePreviewScreen(articleId = articleId)
                }
            ),
            ModuleRoute(
                route = "publishing/editor",
                title = "Write Article",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val articleId = args["articleId"]
                    val publicationId = args["publicationId"]
                    // ArticleEditorScreen(articleId = articleId, publicationId = publicationId)
                }
            ),
            ModuleRoute(
                route = "publishing/publications/{publicationId}",
                title = "Publication",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val publicationId = args["publicationId"] ?: return@ModuleRoute
                    // PublicationSettingsScreen(publicationId = publicationId)
                }
            ),
            ModuleRoute(
                route = "publishing/publications/{publicationId}/subscribers",
                title = "Subscribers",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val publicationId = args["publicationId"] ?: return@ModuleRoute
                    // SubscribersScreen(publicationId = publicationId)
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            PublishingUseCase.KIND_ARTICLE,
            PublishingUseCase.KIND_COMMENT,
            PublishingUseCase.KIND_PUBLICATION,
            NostrClient.KIND_DELETE
        )
    }

    /**
     * Handles incoming article event from Nostr.
     */
    private suspend fun handleArticleEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = nostrEvent.content

            // Parse article data from content
            val articleData = json.decodeFromString<ArticleNostrContent>(content)

            // Extract publication ID and group ID from tags
            val publicationId = nostrEvent.tags.find { it.firstOrNull() == "publication" }?.getOrNull(1)
            val groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)

            val article = ArticleEntity(
                id = articleData.id,
                schemaVersion = articleData.v,
                title = articleData.title,
                slug = articleData.slug,
                subtitle = articleData.subtitle,
                content = articleData.content,
                excerpt = articleData.excerpt,
                coverImage = articleData.coverImage,
                tagsJson = articleData.tags?.let { Json.encodeToString(kotlinx.serialization.builtins.ListSerializer(kotlinx.serialization.builtins.serializer<String>()), it) } ?: "[]",
                categoriesJson = articleData.categories?.let { Json.encodeToString(kotlinx.serialization.builtins.ListSerializer(kotlinx.serialization.builtins.serializer<String>()), it) } ?: "[]",
                status = ArticleStatus.entries.find { it.value == articleData.status } ?: ArticleStatus.PUBLISHED,
                visibility = PublishingVisibility.entries.find { it.value == articleData.visibility } ?: PublishingVisibility.PUBLIC,
                groupId = groupId,
                publicationId = publicationId,
                publishedAt = articleData.publishedAt,
                authorPubkey = articleData.authorPubkey,
                authorName = articleData.authorName,
                coauthorsJson = articleData.coauthors?.let { Json.encodeToString(kotlinx.serialization.builtins.ListSerializer(kotlinx.serialization.builtins.serializer<String>()), it) } ?: "[]",
                readingTime = articleData.readingTime?.toInt(),
                viewCount = articleData.viewCount?.toInt() ?: 0,
                canonicalUrl = articleData.canonicalUrl,
                seoJson = articleData.seo?.let { Json.encodeToString(SEOMetadata.serializer(), it) },
                createdAt = articleData.createdAt,
                updatedAt = articleData.updatedAt
            )

            repository.saveArticle(article)
        } catch (e: Exception) {
            android.util.Log.e("PublishingModule", "Failed to handle article event", e)
        }
    }

    /**
     * Handles incoming comment event from Nostr.
     */
    private suspend fun handleCommentEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val commentData = json.decodeFromString<CommentNostrContent>(nostrEvent.content)

            val comment = CommentEntity(
                id = commentData.id,
                schemaVersion = commentData.v,
                articleId = commentData.articleId,
                parentId = commentData.parentId,
                content = commentData.content,
                authorPubkey = commentData.authorPubkey,
                authorName = commentData.authorName,
                createdAt = commentData.createdAt,
                updatedAt = commentData.updatedAt
            )

            repository.saveComment(comment)
        } catch (e: Exception) {
            android.util.Log.e("PublishingModule", "Failed to handle comment event", e)
        }
    }

    /**
     * Handles incoming publication event from Nostr.
     */
    private suspend fun handlePublicationEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val pubData = json.decodeFromString<PublicationNostrContent>(nostrEvent.content)

            // Extract group ID from tags
            val groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)

            val publication = PublicationEntity(
                id = pubData.id,
                schemaVersion = pubData.v,
                name = pubData.name,
                description = pubData.description,
                logo = pubData.logo,
                coverImage = pubData.coverImage,
                groupId = groupId,
                visibility = PublishingVisibility.entries.find { it.value == pubData.visibility } ?: PublishingVisibility.PUBLIC,
                editorsJson = pubData.editors?.let { Json.encodeToString(kotlinx.serialization.builtins.ListSerializer(kotlinx.serialization.builtins.serializer<String>()), it) } ?: "[]",
                ownerPubkey = pubData.ownerPubkey,
                createdAt = pubData.createdAt
            )

            repository.savePublication(publication)
        } catch (e: Exception) {
            android.util.Log.e("PublishingModule", "Failed to handle publication event", e)
        }
    }

    /**
     * Handles deletion events from Nostr.
     */
    private suspend fun handleDeletionEvent(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            eventIds.forEach { eventId ->
                // Try to delete as article
                try {
                    repository.deleteArticle(eventId)
                } catch (_: Exception) { }

                // Try to delete as comment
                try {
                    repository.deleteComment(eventId)
                } catch (_: Exception) { }

                // Try to delete as publication
                try {
                    repository.deletePublication(eventId)
                } catch (_: Exception) { }
            }
        } catch (e: Exception) {
            android.util.Log.e("PublishingModule", "Failed to handle deletion event", e)
        }
    }
}

/**
 * Data class for parsing article content from Nostr events.
 */
@kotlinx.serialization.Serializable
private data class ArticleNostrContent(
    @kotlinx.serialization.SerialName("_v") val v: String,
    val id: String,
    val title: String,
    val slug: String? = null,
    val subtitle: String? = null,
    val content: String,
    val excerpt: String? = null,
    val coverImage: String? = null,
    val tags: List<String>? = null,
    val categories: List<String>? = null,
    val status: String? = null,
    val visibility: String? = null,
    val publishedAt: Long? = null,
    val authorPubkey: String,
    val authorName: String? = null,
    val coauthors: List<String>? = null,
    val readingTime: Long? = null,
    val viewCount: Long? = null,
    val canonicalUrl: String? = null,
    val seo: SEOMetadata? = null,
    val createdAt: Long,
    val updatedAt: Long? = null
)

/**
 * Data class for parsing comment content from Nostr events.
 */
@kotlinx.serialization.Serializable
private data class CommentNostrContent(
    @kotlinx.serialization.SerialName("_v") val v: String,
    val id: String,
    val articleId: String,
    val parentId: String? = null,
    val content: String,
    val authorPubkey: String,
    val authorName: String? = null,
    val createdAt: Long,
    val updatedAt: Long? = null
)

/**
 * Data class for parsing publication content from Nostr events.
 */
@kotlinx.serialization.Serializable
private data class PublicationNostrContent(
    @kotlinx.serialization.SerialName("_v") val v: String,
    val id: String,
    val name: String,
    val description: String? = null,
    val logo: String? = null,
    val coverImage: String? = null,
    val visibility: String? = null,
    val editors: List<String>? = null,
    val ownerPubkey: String,
    val createdAt: Long
)

/**
 * Hilt module for Publishing dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class PublishingHiltModule {
    @Binds
    @IntoSet
    abstract fun bindPublishingModule(impl: PublishingModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Publishing module.
 */
@Module
@InstallIn(SingletonComponent::class)
object PublishingDaoModule {
    @Provides
    @Singleton
    fun provideArticlesDao(database: BuildItDatabase): ArticlesDao = database.articlesDao()

    @Provides
    @Singleton
    fun provideCommentsDao(database: BuildItDatabase): CommentsDao = database.commentsDao()

    @Provides
    @Singleton
    fun providePublicationsDao(database: BuildItDatabase): PublicationsDao = database.publicationsDao()

    @Provides
    @Singleton
    fun provideSubscribersDao(database: BuildItDatabase): SubscribersDao = database.subscribersDao()
}
