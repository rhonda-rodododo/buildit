package network.buildit.modules.publishing.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for articles.
 */
@Dao
interface ArticlesDao {
    @Query("SELECT * FROM publishing_articles WHERE publicationId = :publicationId ORDER BY publishedAt DESC, createdAt DESC")
    fun getArticlesByPublication(publicationId: String): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE authorPubkey = :pubkey ORDER BY createdAt DESC")
    fun getArticlesByAuthor(pubkey: String): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE status = :status ORDER BY publishedAt DESC, createdAt DESC")
    fun getArticlesByStatus(status: ArticleStatus): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE groupId = :groupId AND status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun getPublishedArticlesByGroup(groupId: String): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE visibility = 'PUBLIC' AND status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun getPublicArticles(): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE id = :id")
    suspend fun getArticle(id: String): ArticleEntity?

    @Query("SELECT * FROM publishing_articles WHERE id = :id")
    fun observeArticle(id: String): Flow<ArticleEntity?>

    @Query("SELECT * FROM publishing_articles WHERE slug = :slug AND publicationId = :publicationId")
    suspend fun getArticleBySlug(slug: String, publicationId: String): ArticleEntity?

    @Query("SELECT * FROM publishing_articles WHERE tagsJson LIKE '%' || :tag || '%' AND status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun getArticlesByTag(tag: String): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM publishing_articles WHERE categoriesJson LIKE '%' || :category || '%' AND status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun getArticlesByCategory(category: String): Flow<List<ArticleEntity>>

    @Query("""
        SELECT * FROM publishing_articles
        WHERE (title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%' OR excerpt LIKE '%' || :query || '%')
        AND status = 'PUBLISHED'
        ORDER BY publishedAt DESC
        LIMIT :limit
    """)
    suspend fun searchArticles(query: String, limit: Int = 50): List<ArticleEntity>

    @Query("SELECT * FROM publishing_articles WHERE authorPubkey = :pubkey AND status = 'DRAFT' ORDER BY updatedAt DESC, createdAt DESC")
    fun getDraftsByAuthor(pubkey: String): Flow<List<ArticleEntity>>

    @Query("SELECT COUNT(*) FROM publishing_articles WHERE publicationId = :publicationId AND status = 'PUBLISHED'")
    suspend fun getPublishedArticleCount(publicationId: String): Int

    @Query("SELECT COUNT(*) FROM publishing_articles WHERE authorPubkey = :pubkey")
    suspend fun getArticleCountByAuthor(pubkey: String): Int

    @Query("UPDATE publishing_articles SET viewCount = viewCount + 1 WHERE id = :id")
    suspend fun incrementViewCount(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertArticle(article: ArticleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertArticles(articles: List<ArticleEntity>)

    @Update
    suspend fun updateArticle(article: ArticleEntity)

    @Delete
    suspend fun deleteArticle(article: ArticleEntity)

    @Query("DELETE FROM publishing_articles WHERE id = :id")
    suspend fun deleteArticleById(id: String)

    @Query("SELECT * FROM publishing_articles ORDER BY publishedAt DESC LIMIT :limit")
    fun getRecentArticles(limit: Int = 20): Flow<List<ArticleEntity>>
}

/**
 * Data Access Object for comments.
 */
@Dao
interface CommentsDao {
    @Query("SELECT * FROM publishing_comments WHERE articleId = :articleId AND parentId IS NULL ORDER BY createdAt ASC")
    fun getTopLevelComments(articleId: String): Flow<List<CommentEntity>>

    @Query("SELECT * FROM publishing_comments WHERE articleId = :articleId ORDER BY createdAt ASC")
    fun getAllComments(articleId: String): Flow<List<CommentEntity>>

    @Query("SELECT * FROM publishing_comments WHERE parentId = :parentId ORDER BY createdAt ASC")
    fun getReplies(parentId: String): Flow<List<CommentEntity>>

    @Query("SELECT * FROM publishing_comments WHERE id = :id")
    suspend fun getComment(id: String): CommentEntity?

    @Query("SELECT * FROM publishing_comments WHERE authorPubkey = :pubkey ORDER BY createdAt DESC")
    fun getCommentsByAuthor(pubkey: String): Flow<List<CommentEntity>>

    @Query("SELECT COUNT(*) FROM publishing_comments WHERE articleId = :articleId")
    suspend fun getCommentCount(articleId: String): Int

    @Query("SELECT COUNT(*) FROM publishing_comments WHERE parentId = :parentId")
    suspend fun getReplyCount(parentId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertComment(comment: CommentEntity)

    @Update
    suspend fun updateComment(comment: CommentEntity)

    @Delete
    suspend fun deleteComment(comment: CommentEntity)

    @Query("DELETE FROM publishing_comments WHERE id = :id")
    suspend fun deleteCommentById(id: String)

    @Query("DELETE FROM publishing_comments WHERE articleId = :articleId")
    suspend fun deleteCommentsByArticle(articleId: String)
}

/**
 * Data Access Object for publications.
 */
@Dao
interface PublicationsDao {
    @Query("SELECT * FROM publishing_publications ORDER BY name ASC")
    fun getAllPublications(): Flow<List<PublicationEntity>>

    @Query("SELECT * FROM publishing_publications WHERE ownerPubkey = :pubkey ORDER BY createdAt DESC")
    fun getPublicationsByOwner(pubkey: String): Flow<List<PublicationEntity>>

    @Query("SELECT * FROM publishing_publications WHERE editorsJson LIKE '%' || :pubkey || '%' ORDER BY name ASC")
    fun getPublicationsByEditor(pubkey: String): Flow<List<PublicationEntity>>

    @Query("SELECT * FROM publishing_publications WHERE groupId = :groupId ORDER BY name ASC")
    fun getPublicationsByGroup(groupId: String): Flow<List<PublicationEntity>>

    @Query("SELECT * FROM publishing_publications WHERE visibility = 'PUBLIC' ORDER BY name ASC")
    fun getPublicPublications(): Flow<List<PublicationEntity>>

    @Query("SELECT * FROM publishing_publications WHERE id = :id")
    suspend fun getPublication(id: String): PublicationEntity?

    @Query("SELECT * FROM publishing_publications WHERE id = :id")
    fun observePublication(id: String): Flow<PublicationEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPublication(publication: PublicationEntity)

    @Update
    suspend fun updatePublication(publication: PublicationEntity)

    @Delete
    suspend fun deletePublication(publication: PublicationEntity)

    @Query("DELETE FROM publishing_publications WHERE id = :id")
    suspend fun deletePublicationById(id: String)
}

/**
 * Data Access Object for subscribers.
 */
@Dao
interface SubscribersDao {
    @Query("SELECT * FROM publishing_subscribers WHERE publicationId = :publicationId ORDER BY subscribedAt DESC")
    fun getSubscribers(publicationId: String): Flow<List<SubscriberEntity>>

    @Query("SELECT * FROM publishing_subscribers WHERE pubkey = :pubkey ORDER BY subscribedAt DESC")
    fun getSubscriptionsByUser(pubkey: String): Flow<List<SubscriberEntity>>

    @Query("SELECT * FROM publishing_subscribers WHERE publicationId = :publicationId AND pubkey = :pubkey")
    suspend fun getSubscription(publicationId: String, pubkey: String): SubscriberEntity?

    @Query("SELECT COUNT(*) FROM publishing_subscribers WHERE publicationId = :publicationId")
    suspend fun getSubscriberCount(publicationId: String): Int

    @Query("SELECT EXISTS(SELECT 1 FROM publishing_subscribers WHERE publicationId = :publicationId AND pubkey = :pubkey)")
    suspend fun isSubscribed(publicationId: String, pubkey: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubscriber(subscriber: SubscriberEntity)

    @Delete
    suspend fun deleteSubscriber(subscriber: SubscriberEntity)

    @Query("DELETE FROM publishing_subscribers WHERE publicationId = :publicationId AND pubkey = :pubkey")
    suspend fun unsubscribe(publicationId: String, pubkey: String)

    @Query("UPDATE publishing_subscribers SET notificationsEnabled = :enabled WHERE publicationId = :publicationId AND pubkey = :pubkey")
    suspend fun updateNotifications(publicationId: String, pubkey: String, enabled: Boolean)
}
