package network.buildit.modules.publishing.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.publishing.data.local.*
import network.buildit.modules.publishing.domain.ArticleOptions
import network.buildit.modules.publishing.domain.PublicationOptions
import network.buildit.modules.publishing.domain.PublishingUseCase
import javax.inject.Inject

/**
 * ViewModel for the articles list screen.
 */
@HiltViewModel
class ArticlesListViewModel @Inject constructor(
    private val publishingUseCase: PublishingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArticlesListUiState>(ArticlesListUiState.Loading)
    val uiState: StateFlow<ArticlesListUiState> = _uiState.asStateFlow()

    private var currentPublicationId: String? = null

    /**
     * Loads articles for a publication.
     */
    fun loadArticles(publicationId: String?) {
        currentPublicationId = publicationId
        viewModelScope.launch {
            _uiState.value = ArticlesListUiState.Loading

            val articlesFlow = if (publicationId != null) {
                publishingUseCase.getArticlesByPublication(publicationId)
            } else {
                publishingUseCase.getPublicArticles()
            }

            articlesFlow.collect { articles ->
                _uiState.value = ArticlesListUiState.Success(
                    articles = articles,
                    publicationId = publicationId
                )
            }
        }
    }

    /**
     * Loads the current user's articles.
     */
    fun loadMyArticles() {
        viewModelScope.launch {
            _uiState.value = ArticlesListUiState.Loading

            publishingUseCase.getMyArticles().collect { articles ->
                _uiState.value = ArticlesListUiState.Success(
                    articles = articles,
                    publicationId = null
                )
            }
        }
    }

    /**
     * Loads the current user's drafts.
     */
    fun loadMyDrafts() {
        viewModelScope.launch {
            _uiState.value = ArticlesListUiState.Loading

            publishingUseCase.getMyDrafts().collect { drafts ->
                _uiState.value = ArticlesListUiState.Success(
                    articles = drafts,
                    publicationId = null
                )
            }
        }
    }

    /**
     * Searches articles.
     */
    fun searchArticles(query: String) {
        if (query.isBlank()) {
            loadArticles(currentPublicationId)
            return
        }

        viewModelScope.launch {
            _uiState.value = ArticlesListUiState.Loading

            val results = publishingUseCase.searchArticles(query)
            _uiState.value = ArticlesListUiState.Success(
                articles = results,
                publicationId = currentPublicationId,
                searchQuery = query
            )
        }
    }

    /**
     * Deletes an article.
     */
    fun deleteArticle(articleId: String) {
        viewModelScope.launch {
            when (val result = publishingUseCase.deleteArticle(articleId)) {
                is ModuleResult.Success -> loadArticles(currentPublicationId)
                is ModuleResult.Error -> {
                    _uiState.value = ArticlesListUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = ArticlesListUiState.Error("Publishing module not enabled")
                }
            }
        }
    }
}

/**
 * UI state for articles list.
 */
sealed class ArticlesListUiState {
    data object Loading : ArticlesListUiState()
    data class Success(
        val articles: List<ArticleEntity>,
        val publicationId: String?,
        val searchQuery: String? = null
    ) : ArticlesListUiState()
    data class Error(val message: String) : ArticlesListUiState()
}

/**
 * ViewModel for the article editor screen.
 */
@HiltViewModel
class ArticleEditorViewModel @Inject constructor(
    private val publishingUseCase: PublishingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArticleEditorUiState>(ArticleEditorUiState.Empty)
    val uiState: StateFlow<ArticleEditorUiState> = _uiState.asStateFlow()

    private var editingArticleId: String? = null

    /**
     * Loads an existing article for editing.
     */
    fun loadArticle(articleId: String) {
        editingArticleId = articleId
        viewModelScope.launch {
            _uiState.value = ArticleEditorUiState.Loading

            val article = publishingUseCase.getArticle(articleId)
            if (article != null) {
                _uiState.value = ArticleEditorUiState.Editing(
                    article = article,
                    title = article.title,
                    content = article.content,
                    subtitle = article.subtitle,
                    excerpt = article.excerpt,
                    coverImage = article.coverImage,
                    tags = article.tags,
                    categories = article.categories,
                    seo = article.seo,
                    isDirty = false
                )
            } else {
                _uiState.value = ArticleEditorUiState.Error("Article not found")
            }
        }
    }

    /**
     * Starts a new article.
     */
    fun newArticle(publicationId: String? = null) {
        editingArticleId = null
        _uiState.value = ArticleEditorUiState.New(
            publicationId = publicationId,
            title = "",
            content = "",
            subtitle = null,
            excerpt = null,
            coverImage = null,
            tags = emptyList(),
            categories = emptyList(),
            seo = null,
            isDirty = false
        )
    }

    /**
     * Updates the title.
     */
    fun updateTitle(title: String) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(title = title, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(title = title, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Updates the content.
     */
    fun updateContent(content: String) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(content = content, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(content = content, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Updates the subtitle.
     */
    fun updateSubtitle(subtitle: String?) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(subtitle = subtitle, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(subtitle = subtitle, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Updates the cover image.
     */
    fun updateCoverImage(coverImage: String?) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(coverImage = coverImage, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(coverImage = coverImage, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Updates tags.
     */
    fun updateTags(tags: List<String>) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(tags = tags, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(tags = tags, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Updates SEO metadata.
     */
    fun updateSeo(seo: SEOMetadata?) {
        val currentState = _uiState.value
        when (currentState) {
            is ArticleEditorUiState.New -> {
                _uiState.value = currentState.copy(seo = seo, isDirty = true)
            }
            is ArticleEditorUiState.Editing -> {
                _uiState.value = currentState.copy(seo = seo, isDirty = true)
            }
            else -> {}
        }
    }

    /**
     * Saves as draft.
     */
    fun saveDraft() {
        save(ArticleStatus.DRAFT)
    }

    /**
     * Publishes the article.
     */
    fun publish() {
        save(ArticleStatus.PUBLISHED)
    }

    private fun save(status: ArticleStatus) {
        viewModelScope.launch {
            val currentState = _uiState.value

            when (currentState) {
                is ArticleEditorUiState.New -> {
                    _uiState.value = ArticleEditorUiState.Saving

                    val result = publishingUseCase.createArticle(
                        title = currentState.title,
                        content = currentState.content,
                        publicationId = currentState.publicationId,
                        status = status,
                        options = ArticleOptions(
                            subtitle = currentState.subtitle,
                            excerpt = currentState.excerpt,
                            coverImage = currentState.coverImage,
                            tags = currentState.tags,
                            categories = currentState.categories,
                            seo = currentState.seo
                        )
                    )

                    handleSaveResult(result)
                }

                is ArticleEditorUiState.Editing -> {
                    _uiState.value = ArticleEditorUiState.Saving

                    val updatedArticle = currentState.article.copy(
                        title = currentState.title,
                        content = currentState.content,
                        subtitle = currentState.subtitle,
                        excerpt = currentState.excerpt,
                        coverImage = currentState.coverImage,
                        tagsJson = Json.encodeToString(
                            ListSerializer(String.serializer()),
                            currentState.tags
                        ),
                        categoriesJson = Json.encodeToString(
                            ListSerializer(String.serializer()),
                            currentState.categories
                        ),
                        seoJson = currentState.seo?.let {
                            Json.encodeToString(SEOMetadata.serializer(), it)
                        },
                        status = status,
                        publishedAt = if (status == ArticleStatus.PUBLISHED && currentState.article.publishedAt == null) {
                            System.currentTimeMillis() / 1000
                        } else {
                            currentState.article.publishedAt
                        }
                    )

                    val result = publishingUseCase.updateArticle(updatedArticle)
                    handleSaveResult(result)
                }

                else -> {}
            }
        }
    }

    private fun handleSaveResult(result: ModuleResult<ArticleEntity>) {
        when (result) {
            is ModuleResult.Success -> {
                _uiState.value = ArticleEditorUiState.Saved(result.data)
            }
            is ModuleResult.Error -> {
                _uiState.value = ArticleEditorUiState.Error(result.message)
            }
            ModuleResult.NotEnabled -> {
                _uiState.value = ArticleEditorUiState.Error("Publishing module not enabled")
            }
        }
    }
}

/**
 * UI state for article editor.
 */
sealed class ArticleEditorUiState {
    data object Empty : ArticleEditorUiState()
    data object Loading : ArticleEditorUiState()
    data object Saving : ArticleEditorUiState()

    data class New(
        val publicationId: String?,
        val title: String,
        val content: String,
        val subtitle: String?,
        val excerpt: String?,
        val coverImage: String?,
        val tags: List<String>,
        val categories: List<String>,
        val seo: SEOMetadata?,
        val isDirty: Boolean
    ) : ArticleEditorUiState()

    data class Editing(
        val article: ArticleEntity,
        val title: String,
        val content: String,
        val subtitle: String?,
        val excerpt: String?,
        val coverImage: String?,
        val tags: List<String>,
        val categories: List<String>,
        val seo: SEOMetadata?,
        val isDirty: Boolean
    ) : ArticleEditorUiState()

    data class Saved(val article: ArticleEntity) : ArticleEditorUiState()
    data class Error(val message: String) : ArticleEditorUiState()
}

/**
 * ViewModel for article preview/detail screen.
 */
@HiltViewModel
class ArticlePreviewViewModel @Inject constructor(
    private val publishingUseCase: PublishingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArticlePreviewUiState>(ArticlePreviewUiState.Loading)
    val uiState: StateFlow<ArticlePreviewUiState> = _uiState.asStateFlow()

    /**
     * Loads an article for preview.
     */
    fun loadArticle(articleId: String) {
        viewModelScope.launch {
            _uiState.value = ArticlePreviewUiState.Loading

            publishingUseCase.observeArticle(articleId).collect { article ->
                if (article == null) {
                    _uiState.value = ArticlePreviewUiState.Error("Article not found")
                    return@collect
                }

                // Record view
                publishingUseCase.recordView(articleId)

                // Get comment count
                val commentCount = publishingUseCase.getCommentCount(articleId)

                // Get publication if exists
                val publication = article.publicationId?.let {
                    publishingUseCase.getPublication(it)
                }

                _uiState.value = ArticlePreviewUiState.Success(
                    article = article,
                    publication = publication,
                    commentCount = commentCount
                )
            }
        }
    }

    /**
     * Loads comments for the article.
     */
    fun loadComments(articleId: String) {
        viewModelScope.launch {
            publishingUseCase.getComments(articleId).collect { comments ->
                val currentState = _uiState.value
                if (currentState is ArticlePreviewUiState.Success) {
                    _uiState.value = currentState.copy(
                        comments = comments,
                        commentCount = comments.size
                    )
                }
            }
        }
    }

    /**
     * Adds a comment.
     */
    fun addComment(articleId: String, content: String, parentId: String? = null) {
        viewModelScope.launch {
            when (val result = publishingUseCase.addComment(articleId, content, parentId)) {
                is ModuleResult.Success -> {
                    loadComments(articleId)
                }
                is ModuleResult.Error -> {
                    // Handle error
                }
                ModuleResult.NotEnabled -> {
                    // Handle not enabled
                }
            }
        }
    }
}

/**
 * UI state for article preview.
 */
sealed class ArticlePreviewUiState {
    data object Loading : ArticlePreviewUiState()
    data class Success(
        val article: ArticleEntity,
        val publication: PublicationEntity?,
        val commentCount: Int,
        val comments: List<CommentEntity> = emptyList()
    ) : ArticlePreviewUiState()
    data class Error(val message: String) : ArticlePreviewUiState()
}

/**
 * ViewModel for publication settings.
 */
@HiltViewModel
class PublicationSettingsViewModel @Inject constructor(
    private val publishingUseCase: PublishingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<PublicationSettingsUiState>(PublicationSettingsUiState.Loading)
    val uiState: StateFlow<PublicationSettingsUiState> = _uiState.asStateFlow()

    /**
     * Loads a publication for editing.
     */
    fun loadPublication(publicationId: String) {
        viewModelScope.launch {
            _uiState.value = PublicationSettingsUiState.Loading

            val publication = publishingUseCase.getPublication(publicationId)
            if (publication != null) {
                val subscriberCount = publishingUseCase.getSubscriberCount(publicationId)
                _uiState.value = PublicationSettingsUiState.Success(
                    publication = publication,
                    subscriberCount = subscriberCount
                )
            } else {
                _uiState.value = PublicationSettingsUiState.Error("Publication not found")
            }
        }
    }

    /**
     * Creates a new publication.
     */
    fun createPublication(
        name: String,
        description: String?,
        options: PublicationOptions
    ) {
        viewModelScope.launch {
            _uiState.value = PublicationSettingsUiState.Saving

            when (val result = publishingUseCase.createPublication(name, description, options)) {
                is ModuleResult.Success -> {
                    _uiState.value = PublicationSettingsUiState.Saved(result.data)
                }
                is ModuleResult.Error -> {
                    _uiState.value = PublicationSettingsUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = PublicationSettingsUiState.Error("Publishing module not enabled")
                }
            }
        }
    }

    /**
     * Updates a publication.
     */
    fun updatePublication(publication: PublicationEntity) {
        viewModelScope.launch {
            _uiState.value = PublicationSettingsUiState.Saving

            when (val result = publishingUseCase.updatePublication(publication)) {
                is ModuleResult.Success -> {
                    _uiState.value = PublicationSettingsUiState.Saved(result.data)
                }
                is ModuleResult.Error -> {
                    _uiState.value = PublicationSettingsUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = PublicationSettingsUiState.Error("Publishing module not enabled")
                }
            }
        }
    }

    /**
     * Deletes a publication.
     */
    fun deletePublication(publicationId: String) {
        viewModelScope.launch {
            when (val result = publishingUseCase.deletePublication(publicationId)) {
                is ModuleResult.Success -> {
                    _uiState.value = PublicationSettingsUiState.Deleted
                }
                is ModuleResult.Error -> {
                    _uiState.value = PublicationSettingsUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = PublicationSettingsUiState.Error("Publishing module not enabled")
                }
            }
        }
    }
}

/**
 * UI state for publication settings.
 */
sealed class PublicationSettingsUiState {
    data object Loading : PublicationSettingsUiState()
    data object Saving : PublicationSettingsUiState()
    data object Deleted : PublicationSettingsUiState()
    data class Success(
        val publication: PublicationEntity,
        val subscriberCount: Int
    ) : PublicationSettingsUiState()
    data class Saved(val publication: PublicationEntity) : PublicationSettingsUiState()
    data class Error(val message: String) : PublicationSettingsUiState()
}

/**
 * ViewModel for subscribers screen.
 */
@HiltViewModel
class SubscribersViewModel @Inject constructor(
    private val publishingUseCase: PublishingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<SubscribersUiState>(SubscribersUiState.Loading)
    val uiState: StateFlow<SubscribersUiState> = _uiState.asStateFlow()

    /**
     * Loads subscribers for a publication.
     */
    fun loadSubscribers(publicationId: String) {
        viewModelScope.launch {
            _uiState.value = SubscribersUiState.Loading

            publishingUseCase.getSubscribers(publicationId).collect { subscribers ->
                _uiState.value = SubscribersUiState.Success(
                    subscribers = subscribers,
                    publicationId = publicationId
                )
            }
        }
    }
}

/**
 * UI state for subscribers.
 */
sealed class SubscribersUiState {
    data object Loading : SubscribersUiState()
    data class Success(
        val subscribers: List<SubscriberEntity>,
        val publicationId: String
    ) : SubscribersUiState()
    data class Error(val message: String) : SubscribersUiState()
}
