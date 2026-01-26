package network.buildit.modules.publishing.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.modules.publishing.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for publishing data.
 *
 * Provides a clean API for accessing articles, publications, comments, and subscribers
 * from local storage. In the future, this could be extended to sync with remote sources.
 */
@Singleton
class PublishingRepository @Inject constructor(
    private val articlesDao: ArticlesDao,
    private val commentsDao: CommentsDao,
    private val publicationsDao: PublicationsDao,
    private val subscribersDao: SubscribersDao
) {
    // ============== Articles ==============

    /**
     * Gets all articles for a publication.
     */
    fun getArticlesByPublication(publicationId: String): Flow<List<ArticleEntity>> {
        return articlesDao.getArticlesByPublication(publicationId)
    }

    /**
     * Gets all articles by a specific author.
     */
    fun getArticlesByAuthor(pubkey: String): Flow<List<ArticleEntity>> {
        return articlesDao.getArticlesByAuthor(pubkey)
    }

    /**
     * Gets articles by status.
     */
    fun getArticlesByStatus(status: ArticleStatus): Flow<List<ArticleEntity>> {
        return articlesDao.getArticlesByStatus(status)
    }

    /**
     * Gets published articles for a group.
     */
    fun getPublishedArticlesByGroup(groupId: String): Flow<List<ArticleEntity>> {
        return articlesDao.getPublishedArticlesByGroup(groupId)
    }

    /**
     * Gets all public published articles.
     */
    fun getPublicArticles(): Flow<List<ArticleEntity>> {
        return articlesDao.getPublicArticles()
    }

    /**
     * Gets a specific article by ID.
     */
    suspend fun getArticle(id: String): ArticleEntity? {
        return articlesDao.getArticle(id)
    }

    /**
     * Observes a specific article.
     */
    fun observeArticle(id: String): Flow<ArticleEntity?> {
        return articlesDao.observeArticle(id)
    }

    /**
     * Gets an article by its slug within a publication.
     */
    suspend fun getArticleBySlug(slug: String, publicationId: String): ArticleEntity? {
        return articlesDao.getArticleBySlug(slug, publicationId)
    }

    /**
     * Gets articles with a specific tag.
     */
    fun getArticlesByTag(tag: String): Flow<List<ArticleEntity>> {
        return articlesDao.getArticlesByTag(tag)
    }

    /**
     * Gets articles in a specific category.
     */
    fun getArticlesByCategory(category: String): Flow<List<ArticleEntity>> {
        return articlesDao.getArticlesByCategory(category)
    }

    /**
     * Searches articles by query.
     */
    suspend fun searchArticles(query: String, limit: Int = 50): List<ArticleEntity> {
        return articlesDao.searchArticles(query, limit)
    }

    /**
     * Gets draft articles by an author.
     */
    fun getDraftsByAuthor(pubkey: String): Flow<List<ArticleEntity>> {
        return articlesDao.getDraftsByAuthor(pubkey)
    }

    /**
     * Gets the count of published articles in a publication.
     */
    suspend fun getPublishedArticleCount(publicationId: String): Int {
        return articlesDao.getPublishedArticleCount(publicationId)
    }

    /**
     * Increments the view count for an article.
     */
    suspend fun incrementViewCount(articleId: String) {
        articlesDao.incrementViewCount(articleId)
    }

    /**
     * Saves an article to local storage.
     */
    suspend fun saveArticle(article: ArticleEntity) {
        articlesDao.insertArticle(article)
    }

    /**
     * Updates an existing article.
     */
    suspend fun updateArticle(article: ArticleEntity) {
        articlesDao.updateArticle(article)
    }

    /**
     * Deletes an article.
     */
    suspend fun deleteArticle(articleId: String) {
        articlesDao.deleteArticleById(articleId)
        commentsDao.deleteCommentsByArticle(articleId)
    }

    /**
     * Gets recent articles.
     */
    fun getRecentArticles(limit: Int = 20): Flow<List<ArticleEntity>> {
        return articlesDao.getRecentArticles(limit)
    }

    // ============== Comments ==============

    /**
     * Gets top-level comments for an article.
     */
    fun getTopLevelComments(articleId: String): Flow<List<CommentEntity>> {
        return commentsDao.getTopLevelComments(articleId)
    }

    /**
     * Gets all comments for an article.
     */
    fun getAllComments(articleId: String): Flow<List<CommentEntity>> {
        return commentsDao.getAllComments(articleId)
    }

    /**
     * Gets replies to a comment.
     */
    fun getReplies(parentId: String): Flow<List<CommentEntity>> {
        return commentsDao.getReplies(parentId)
    }

    /**
     * Gets a specific comment.
     */
    suspend fun getComment(id: String): CommentEntity? {
        return commentsDao.getComment(id)
    }

    /**
     * Gets comment count for an article.
     */
    suspend fun getCommentCount(articleId: String): Int {
        return commentsDao.getCommentCount(articleId)
    }

    /**
     * Gets reply count for a comment.
     */
    suspend fun getReplyCount(parentId: String): Int {
        return commentsDao.getReplyCount(parentId)
    }

    /**
     * Saves a comment.
     */
    suspend fun saveComment(comment: CommentEntity) {
        commentsDao.insertComment(comment)
    }

    /**
     * Updates a comment.
     */
    suspend fun updateComment(comment: CommentEntity) {
        commentsDao.updateComment(comment)
    }

    /**
     * Deletes a comment.
     */
    suspend fun deleteComment(commentId: String) {
        commentsDao.deleteCommentById(commentId)
    }

    // ============== Publications ==============

    /**
     * Gets all publications.
     */
    fun getAllPublications(): Flow<List<PublicationEntity>> {
        return publicationsDao.getAllPublications()
    }

    /**
     * Gets publications owned by a user.
     */
    fun getPublicationsByOwner(pubkey: String): Flow<List<PublicationEntity>> {
        return publicationsDao.getPublicationsByOwner(pubkey)
    }

    /**
     * Gets publications a user can edit.
     */
    fun getPublicationsByEditor(pubkey: String): Flow<List<PublicationEntity>> {
        return publicationsDao.getPublicationsByEditor(pubkey)
    }

    /**
     * Gets publications for a group.
     */
    fun getPublicationsByGroup(groupId: String): Flow<List<PublicationEntity>> {
        return publicationsDao.getPublicationsByGroup(groupId)
    }

    /**
     * Gets public publications.
     */
    fun getPublicPublications(): Flow<List<PublicationEntity>> {
        return publicationsDao.getPublicPublications()
    }

    /**
     * Gets a specific publication.
     */
    suspend fun getPublication(id: String): PublicationEntity? {
        return publicationsDao.getPublication(id)
    }

    /**
     * Observes a specific publication.
     */
    fun observePublication(id: String): Flow<PublicationEntity?> {
        return publicationsDao.observePublication(id)
    }

    /**
     * Saves a publication.
     */
    suspend fun savePublication(publication: PublicationEntity) {
        publicationsDao.insertPublication(publication)
    }

    /**
     * Updates a publication.
     */
    suspend fun updatePublication(publication: PublicationEntity) {
        publicationsDao.updatePublication(publication)
    }

    /**
     * Deletes a publication.
     */
    suspend fun deletePublication(publicationId: String) {
        publicationsDao.deletePublicationById(publicationId)
    }

    // ============== Subscribers ==============

    /**
     * Gets subscribers for a publication.
     */
    fun getSubscribers(publicationId: String): Flow<List<SubscriberEntity>> {
        return subscribersDao.getSubscribers(publicationId)
    }

    /**
     * Gets subscriptions for a user.
     */
    fun getSubscriptionsByUser(pubkey: String): Flow<List<SubscriberEntity>> {
        return subscribersDao.getSubscriptionsByUser(pubkey)
    }

    /**
     * Gets subscriber count for a publication.
     */
    suspend fun getSubscriberCount(publicationId: String): Int {
        return subscribersDao.getSubscriberCount(publicationId)
    }

    /**
     * Checks if a user is subscribed to a publication.
     */
    suspend fun isSubscribed(publicationId: String, pubkey: String): Boolean {
        return subscribersDao.isSubscribed(publicationId, pubkey)
    }

    /**
     * Subscribes a user to a publication.
     */
    suspend fun subscribe(subscriber: SubscriberEntity) {
        subscribersDao.insertSubscriber(subscriber)
    }

    /**
     * Unsubscribes a user from a publication.
     */
    suspend fun unsubscribe(publicationId: String, pubkey: String) {
        subscribersDao.unsubscribe(publicationId, pubkey)
    }

    /**
     * Updates notification settings for a subscription.
     */
    suspend fun updateNotifications(publicationId: String, pubkey: String, enabled: Boolean) {
        subscribersDao.updateNotifications(publicationId, pubkey, enabled)
    }
}
