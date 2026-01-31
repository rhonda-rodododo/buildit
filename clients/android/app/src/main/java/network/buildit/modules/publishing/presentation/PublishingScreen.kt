package network.buildit.modules.publishing.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import network.buildit.modules.publishing.data.local.*
import java.text.SimpleDateFormat
import java.util.*

// ============== Articles List Screen ==============

/**
 * Articles list screen showing published articles.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticlesListScreen(
    viewModel: ArticlesListViewModel = hiltViewModel(),
    publicationId: String? = null,
    onArticleClick: (String) -> Unit = {},
    onCreateClick: () -> Unit = {},
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(publicationId) {
        viewModel.loadArticles(publicationId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Articles") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onCreateClick) {
                        Icon(Icons.Default.Add, contentDescription = "New Article")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = {
                    searchQuery = it
                    viewModel.searchArticles(it)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search articles...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = {
                            searchQuery = ""
                            viewModel.loadArticles(publicationId)
                        }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true
            )

            when (uiState) {
                is ArticlesListUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                is ArticlesListUiState.Success -> {
                    val state = uiState as ArticlesListUiState.Success
                    if (state.articles.isEmpty()) {
                        EmptyArticlesView(onCreateClick = onCreateClick)
                    } else {
                        ArticlesList(
                            articles = state.articles,
                            onArticleClick = onArticleClick
                        )
                    }
                }

                is ArticlesListUiState.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (uiState as ArticlesListUiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ArticlesList(
    articles: List<ArticleEntity>,
    onArticleClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(articles, key = { it.id }) { article ->
            ArticleCard(
                article = article,
                onClick = { onArticleClick(article.id) }
            )
        }
    }
}

@Composable
private fun ArticleCard(
    article: ArticleEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Cover image
            article.coverImage?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    contentScale = ContentScale.Crop
                )
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Status badge for drafts
                if (article.status != ArticleStatus.PUBLISHED) {
                    AssistChip(
                        onClick = { },
                        label = { Text(article.status.name) },
                        modifier = Modifier.padding(bottom = 8.dp),
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = when (article.status) {
                                ArticleStatus.DRAFT -> MaterialTheme.colorScheme.secondaryContainer
                                ArticleStatus.ARCHIVED -> MaterialTheme.colorScheme.surfaceVariant
                                else -> MaterialTheme.colorScheme.primaryContainer
                            }
                        )
                    )
                }

                // Title
                Text(
                    text = article.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Subtitle
                article.subtitle?.let { subtitle ->
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                // Excerpt
                article.excerpt?.let { excerpt ->
                    Text(
                        text = excerpt,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                // Tags
                if (article.tags.isNotEmpty()) {
                    LazyRow(
                        modifier = Modifier.padding(top = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(article.tags.take(3)) { tag ->
                            SuggestionChip(
                                onClick = { },
                                label = { Text(tag, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                }

                // Meta info
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Author and date
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = article.authorName ?: article.authorPubkey.take(8) + "...",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        article.publishedAt?.let { timestamp ->
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = formatDate(timestamp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    // Reading time
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Schedule,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${article.calculatedReadingTime} min read",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyArticlesView(onCreateClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                Icons.Default.Article,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "No Articles Yet",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "Start writing to share your ideas with the community",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Button(onClick = onCreateClick) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Write Article")
            }
        }
    }
}

// ============== Article Editor Screen ==============

/**
 * Article editor screen with rich text editing support.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleEditorScreen(
    viewModel: ArticleEditorViewModel = hiltViewModel(),
    articleId: String? = null,
    publicationId: String? = null,
    onBackClick: () -> Unit = {},
    onSaved: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var showSeoDialog by remember { mutableStateOf(false) }
    var showTagsDialog by remember { mutableStateOf(false) }

    LaunchedEffect(articleId, publicationId) {
        if (articleId != null) {
            viewModel.loadArticle(articleId)
        } else {
            viewModel.newArticle(publicationId)
        }
    }

    // Handle saved state
    LaunchedEffect(uiState) {
        if (uiState is ArticleEditorUiState.Saved) {
            onSaved((uiState as ArticleEditorUiState.Saved).article.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (articleId != null) "Edit Article" else "New Article") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // SEO settings
                    IconButton(onClick = { showSeoDialog = true }) {
                        Icon(Icons.Default.TravelExplore, contentDescription = "SEO Settings")
                    }

                    // Tags
                    IconButton(onClick = { showTagsDialog = true }) {
                        Icon(Icons.Default.Tag, contentDescription = "Tags")
                    }

                    // Save draft
                    TextButton(onClick = { viewModel.saveDraft() }) {
                        Text("Save Draft")
                    }

                    // Publish
                    Button(onClick = { viewModel.publish() }) {
                        Text("Publish")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is ArticleEditorUiState.Loading, ArticleEditorUiState.Empty -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is ArticleEditorUiState.Saving -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Saving...")
                    }
                }
            }

            is ArticleEditorUiState.New -> {
                val state = uiState as ArticleEditorUiState.New
                EditorContent(
                    title = state.title,
                    content = state.content,
                    subtitle = state.subtitle,
                    coverImage = state.coverImage,
                    onTitleChange = { viewModel.updateTitle(it) },
                    onContentChange = { viewModel.updateContent(it) },
                    onSubtitleChange = { viewModel.updateSubtitle(it) },
                    onCoverImageChange = { viewModel.updateCoverImage(it) },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            is ArticleEditorUiState.Editing -> {
                val state = uiState as ArticleEditorUiState.Editing
                EditorContent(
                    title = state.title,
                    content = state.content,
                    subtitle = state.subtitle,
                    coverImage = state.coverImage,
                    onTitleChange = { viewModel.updateTitle(it) },
                    onContentChange = { viewModel.updateContent(it) },
                    onSubtitleChange = { viewModel.updateSubtitle(it) },
                    onCoverImageChange = { viewModel.updateCoverImage(it) },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            is ArticleEditorUiState.Saved -> {
                // Handled by LaunchedEffect
            }

            is ArticleEditorUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (uiState as ArticleEditorUiState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }

    // SEO Dialog
    if (showSeoDialog) {
        SEOSettingsDialog(
            currentSeo = when (val state = uiState) {
                is ArticleEditorUiState.New -> state.seo
                is ArticleEditorUiState.Editing -> state.seo
                else -> null
            },
            onDismiss = { showSeoDialog = false },
            onSave = { seo ->
                viewModel.updateSeo(seo)
                showSeoDialog = false
            }
        )
    }

    // Tags Dialog
    if (showTagsDialog) {
        TagsDialog(
            currentTags = when (val state = uiState) {
                is ArticleEditorUiState.New -> state.tags
                is ArticleEditorUiState.Editing -> state.tags
                else -> emptyList()
            },
            onDismiss = { showTagsDialog = false },
            onSave = { tags ->
                viewModel.updateTags(tags)
                showTagsDialog = false
            }
        )
    }
}

@Composable
private fun EditorContent(
    title: String,
    content: String,
    subtitle: String?,
    coverImage: String?,
    onTitleChange: (String) -> Unit,
    onContentChange: (String) -> Unit,
    onSubtitleChange: (String?) -> Unit,
    onCoverImageChange: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Cover image
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .clickable { /* TODO: Image picker */ },
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            if (coverImage != null) {
                AsyncImage(
                    model = coverImage,
                    contentDescription = "Cover image",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Image,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Add cover image",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Title
        OutlinedTextField(
            value = title,
            onValueChange = onTitleChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Article title") },
            textStyle = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold
            ),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent
            )
        )

        // Subtitle
        OutlinedTextField(
            value = subtitle ?: "",
            onValueChange = { onSubtitleChange(it.ifBlank { null }) },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Add a subtitle (optional)") },
            textStyle = MaterialTheme.typography.titleMedium,
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent
            )
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Content editor (markdown)
        MarkdownEditor(
            content = content,
            onContentChange = onContentChange,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )
    }
}

@Composable
private fun MarkdownEditor(
    content: String,
    onContentChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showToolbar by remember { mutableStateOf(true) }

    Column(modifier = modifier) {
        // Formatting toolbar
        if (showToolbar) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                MarkdownToolbarButton(
                    icon = Icons.Default.FormatBold,
                    contentDescription = "Bold",
                    onClick = { onContentChange("$content**bold text**") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.FormatItalic,
                    contentDescription = "Italic",
                    onClick = { onContentChange("$content*italic text*") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.Title,
                    contentDescription = "Heading",
                    onClick = { onContentChange("$content\n## Heading\n") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.FormatListBulleted,
                    contentDescription = "Bullet list",
                    onClick = { onContentChange("$content\n- Item 1\n- Item 2\n") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.FormatListNumbered,
                    contentDescription = "Numbered list",
                    onClick = { onContentChange("$content\n1. Item 1\n2. Item 2\n") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.Code,
                    contentDescription = "Code",
                    onClick = { onContentChange("$content`code`") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.Link,
                    contentDescription = "Link",
                    onClick = { onContentChange("$content[link text](url)") }
                )
                MarkdownToolbarButton(
                    icon = Icons.Default.FormatQuote,
                    contentDescription = "Quote",
                    onClick = { onContentChange("$content\n> Quote\n") }
                )
            }
        }

        // Editor
        OutlinedTextField(
            value = content,
            onValueChange = onContentChange,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            placeholder = { Text("Write your article content in markdown...") },
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                fontFamily = FontFamily.Default
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent
            )
        )
    }
}

@Composable
private fun MarkdownToolbarButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(36.dp)
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun SEOSettingsDialog(
    currentSeo: SEOMetadata?,
    onDismiss: () -> Unit,
    onSave: (SEOMetadata?) -> Unit
) {
    var metaTitle by remember { mutableStateOf(currentSeo?.metaTitle ?: "") }
    var metaDescription by remember { mutableStateOf(currentSeo?.metaDescription ?: "") }
    var ogImage by remember { mutableStateOf(currentSeo?.ogImage ?: "") }
    var keywords by remember { mutableStateOf(currentSeo?.keywords?.joinToString(", ") ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("SEO Settings") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = metaTitle,
                    onValueChange = { metaTitle = it },
                    label = { Text("Meta Title") },
                    placeholder = { Text("Max 60 characters") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = metaDescription,
                    onValueChange = { metaDescription = it },
                    label = { Text("Meta Description") },
                    placeholder = { Text("Max 160 characters") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = ogImage,
                    onValueChange = { ogImage = it },
                    label = { Text("OG Image URL") },
                    placeholder = { Text("https://...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = keywords,
                    onValueChange = { keywords = it },
                    label = { Text("Keywords") },
                    placeholder = { Text("Comma-separated") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val seo = if (metaTitle.isBlank() && metaDescription.isBlank() && ogImage.isBlank() && keywords.isBlank()) {
                        null
                    } else {
                        SEOMetadata(
                            metaTitle = metaTitle.ifBlank { null },
                            metaDescription = metaDescription.ifBlank { null },
                            ogImage = ogImage.ifBlank { null },
                            keywords = keywords.split(",").map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { null }
                        )
                    }
                    onSave(seo)
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun TagsDialog(
    currentTags: List<String>,
    onDismiss: () -> Unit,
    onSave: (List<String>) -> Unit
) {
    var tagsText by remember { mutableStateOf(currentTags.joinToString(", ")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Tags") },
        text = {
            Column {
                Text(
                    "Add tags to help readers discover your article",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = tagsText,
                    onValueChange = { tagsText = it },
                    label = { Text("Tags") },
                    placeholder = { Text("Comma-separated, e.g., tech, tutorial, guide") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val tags = tagsText.split(",").map { it.trim() }.filter { it.isNotBlank() }
                    onSave(tags)
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============== Article Preview Screen ==============

/**
 * Article preview/detail screen with markdown rendering.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticlePreviewScreen(
    viewModel: ArticlePreviewViewModel = hiltViewModel(),
    articleId: String,
    onBackClick: () -> Unit = {},
    onEditClick: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var showComments by remember { mutableStateOf(false) }
    var commentText by remember { mutableStateOf("") }

    LaunchedEffect(articleId) {
        viewModel.loadArticle(articleId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Article") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showComments = !showComments }) {
                        BadgedBox(
                            badge = {
                                if ((uiState as? ArticlePreviewUiState.Success)?.commentCount ?: 0 > 0) {
                                    Badge {
                                        Text("${(uiState as ArticlePreviewUiState.Success).commentCount}")
                                    }
                                }
                            }
                        ) {
                            Icon(Icons.Default.Comment, contentDescription = "Comments")
                        }
                    }
                    IconButton(onClick = { onEditClick(articleId) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit")
                    }
                    IconButton(onClick = { /* TODO: Share */ }) {
                        Icon(Icons.Default.Share, contentDescription = "Share")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is ArticlePreviewUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is ArticlePreviewUiState.Success -> {
                val state = uiState as ArticlePreviewUiState.Success

                if (showComments) {
                    CommentsSection(
                        comments = state.comments,
                        commentText = commentText,
                        onCommentTextChange = { commentText = it },
                        onSubmitComment = {
                            viewModel.addComment(articleId, commentText)
                            commentText = ""
                        },
                        modifier = Modifier.padding(paddingValues)
                    )
                } else {
                    ArticleContent(
                        article = state.article,
                        publication = state.publication,
                        modifier = Modifier.padding(paddingValues)
                    )
                }
            }

            is ArticlePreviewUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (uiState as ArticlePreviewUiState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun ArticleContent(
    article: ArticleEntity,
    publication: PublicationEntity?,
    modifier: Modifier = Modifier
) {
    SelectionContainer {
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Cover image
            article.coverImage?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentScale = ContentScale.Crop
                )
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Publication badge
                publication?.let { pub ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 12.dp)
                    ) {
                        pub.logo?.let { logo ->
                            AsyncImage(
                                model = logo,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(
                            text = pub.name,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                // Title
                Text(
                    text = article.title,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )

                // Subtitle
                article.subtitle?.let { subtitle ->
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                // Author and meta
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Author avatar placeholder
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (article.authorName?.firstOrNull() ?: 'A').uppercase(),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = article.authorName ?: "Anonymous",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Medium
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            article.publishedAt?.let { timestamp ->
                                Text(
                                    text = formatDate(timestamp),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = " - ",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = "${article.calculatedReadingTime} min read",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                HorizontalDivider()

                // Content (markdown rendered)
                Spacer(modifier = Modifier.height(16.dp))
                MarkdownContent(
                    content = article.content,
                    modifier = Modifier.fillMaxWidth()
                )

                // Tags
                if (article.tags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(24.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(16.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(article.tags) { tag ->
                            AssistChip(
                                onClick = { },
                                label = { Text(tag) }
                            )
                        }
                    }
                }

                // View count
                Spacer(modifier = Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Visibility,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${article.viewCount} views",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun MarkdownContent(
    content: String,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        val lines = content.split("\n")
        var inCodeBlock = false
        var codeBlockContent = StringBuilder()

        lines.forEach { line ->
            val trimmed = line.trim()

            // Code block handling
            if (trimmed.startsWith("```")) {
                if (inCodeBlock) {
                    CodeBlock(code = codeBlockContent.toString())
                    codeBlockContent = StringBuilder()
                }
                inCodeBlock = !inCodeBlock
                return@forEach
            }

            if (inCodeBlock) {
                if (codeBlockContent.isNotEmpty()) codeBlockContent.append("\n")
                codeBlockContent.append(line)
                return@forEach
            }

            when {
                trimmed.startsWith("######") -> MarkdownHeader(trimmed.removePrefix("######").trim(), 6)
                trimmed.startsWith("#####") -> MarkdownHeader(trimmed.removePrefix("#####").trim(), 5)
                trimmed.startsWith("####") -> MarkdownHeader(trimmed.removePrefix("####").trim(), 4)
                trimmed.startsWith("###") -> MarkdownHeader(trimmed.removePrefix("###").trim(), 3)
                trimmed.startsWith("##") -> MarkdownHeader(trimmed.removePrefix("##").trim(), 2)
                trimmed.startsWith("#") -> MarkdownHeader(trimmed.removePrefix("#").trim(), 1)
                trimmed.startsWith("- ") || trimmed.startsWith("* ") -> BulletPoint(trimmed.drop(2))
                trimmed.matches(Regex("^\\d+\\.\\s.*")) -> BulletPoint(trimmed.replaceFirst(Regex("^\\d+\\.\\s"), ""))
                trimmed.startsWith("> ") -> BlockQuote(trimmed.removePrefix("> "))
                trimmed.isEmpty() -> Spacer(modifier = Modifier.height(8.dp))
                else -> MarkdownParagraph(trimmed)
            }
        }
    }
}

@Composable
private fun MarkdownHeader(text: String, level: Int) {
    val style = when (level) {
        1 -> MaterialTheme.typography.titleLarge
        2 -> MaterialTheme.typography.titleMedium
        else -> MaterialTheme.typography.titleSmall
    }

    Text(
        text = text,
        style = style,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = if (level == 1) 16.dp else 12.dp, bottom = 4.dp)
    )
}

@Composable
private fun MarkdownParagraph(text: String) {
    Text(
        text = buildAnnotatedMarkdown(text),
        style = MaterialTheme.typography.bodyLarge,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun BulletPoint(text: String) {
    Row(
        modifier = Modifier.padding(start = 8.dp, top = 2.dp, bottom = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "\u2022",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = buildAnnotatedMarkdown(text),
            style = MaterialTheme.typography.bodyLarge
        )
    }
}

@Composable
private fun BlockQuote(text: String) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = MaterialTheme.shapes.small
    ) {
        Row {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(IntrinsicSize.Min)
                    .background(MaterialTheme.colorScheme.primary)
            )
            Text(
                text = buildAnnotatedMarkdown(text),
                style = MaterialTheme.typography.bodyLarge.copy(fontStyle = FontStyle.Italic),
                modifier = Modifier.padding(12.dp)
            )
        }
    }
}

@Composable
private fun CodeBlock(code: String) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = code,
            style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
            modifier = Modifier.padding(12.dp)
        )
    }
}

@Composable
private fun buildAnnotatedMarkdown(text: String) = buildAnnotatedString {
    var remaining = text
    var index = 0

    while (remaining.isNotEmpty() && index < 10000) {
        when {
            remaining.startsWith("**") -> {
                val endIndex = remaining.indexOf("**", 2)
                if (endIndex > 0) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(remaining.substring(2, endIndex))
                    }
                    remaining = remaining.substring(endIndex + 2)
                } else {
                    append("**")
                    remaining = remaining.substring(2)
                }
            }

            remaining.startsWith("*") && !remaining.startsWith("**") -> {
                val endIndex = remaining.indexOf("*", 1)
                if (endIndex > 0) {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(remaining.substring(1, endIndex))
                    }
                    remaining = remaining.substring(endIndex + 1)
                } else {
                    append("*")
                    remaining = remaining.substring(1)
                }
            }

            remaining.startsWith("`") -> {
                val endIndex = remaining.indexOf("`", 1)
                if (endIndex > 0) {
                    withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = Color.LightGray.copy(alpha = 0.3f))) {
                        append(remaining.substring(1, endIndex))
                    }
                    remaining = remaining.substring(endIndex + 1)
                } else {
                    append("`")
                    remaining = remaining.substring(1)
                }
            }

            else -> {
                append(remaining.first())
                remaining = remaining.substring(1)
            }
        }
        index++
    }
}

@Composable
private fun CommentsSection(
    comments: List<CommentEntity>,
    commentText: String,
    onCommentTextChange: (String) -> Unit,
    onSubmitComment: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize()) {
        // Comment input
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = commentText,
                onValueChange = onCommentTextChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Write a comment...") },
                maxLines = 3
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = onSubmitComment,
                enabled = commentText.isNotBlank()
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send")
            }
        }

        HorizontalDivider()

        // Comments list
        if (comments.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No comments yet. Be the first to comment!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(comments, key = { it.id }) { comment ->
                    CommentItem(comment = comment)
                }
            }
        }
    }
}

@Composable
private fun CommentItem(comment: CommentEntity) {
    Row(modifier = Modifier.fillMaxWidth()) {
        // Avatar
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = (comment.authorName?.firstOrNull() ?: 'A').uppercase(),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = comment.authorName ?: "Anonymous",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = formatDate(comment.createdAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = comment.content,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

// ============== Publication Settings Screen ==============

/**
 * Publication settings screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicationSettingsScreen(
    viewModel: PublicationSettingsViewModel = hiltViewModel(),
    publicationId: String? = null,
    onBackClick: () -> Unit = {},
    onSaved: () -> Unit = {},
    onDeleted: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var logo by remember { mutableStateOf("") }
    var coverImage by remember { mutableStateOf("") }

    LaunchedEffect(publicationId) {
        if (publicationId != null) {
            viewModel.loadPublication(publicationId)
        }
    }

    LaunchedEffect(uiState) {
        when (uiState) {
            is PublicationSettingsUiState.Success -> {
                val pub = (uiState as PublicationSettingsUiState.Success).publication
                name = pub.name
                description = pub.description ?: ""
                logo = pub.logo ?: ""
                coverImage = pub.coverImage ?: ""
            }
            is PublicationSettingsUiState.Saved -> onSaved()
            is PublicationSettingsUiState.Deleted -> onDeleted()
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (publicationId != null) "Edit Publication" else "New Publication") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (publicationId != null) {
                        IconButton(onClick = { viewModel.deletePublication(publicationId) }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Publication Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 5
            )

            OutlinedTextField(
                value = logo,
                onValueChange = { logo = it },
                label = { Text("Logo URL") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = coverImage,
                onValueChange = { coverImage = it },
                label = { Text("Cover Image URL") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Subscriber count
            if (uiState is PublicationSettingsUiState.Success) {
                val count = (uiState as PublicationSettingsUiState.Success).subscriberCount
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.People, contentDescription = null)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "$count Subscribers",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "People following this publication",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = {
                    if (publicationId != null) {
                        val currentPub = (uiState as? PublicationSettingsUiState.Success)?.publication
                        currentPub?.let {
                            viewModel.updatePublication(
                                it.copy(
                                    name = name,
                                    description = description.ifBlank { null },
                                    logo = logo.ifBlank { null },
                                    coverImage = coverImage.ifBlank { null }
                                )
                            )
                        }
                    } else {
                        viewModel.createPublication(
                            name = name,
                            description = description.ifBlank { null },
                            options = network.buildit.modules.publishing.domain.PublicationOptions(
                                logo = logo.ifBlank { null },
                                coverImage = coverImage.ifBlank { null }
                            )
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        }
    }
}

// ============== Subscribers Screen ==============

/**
 * Subscribers list screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscribersScreen(
    viewModel: SubscribersViewModel = hiltViewModel(),
    publicationId: String,
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(publicationId) {
        viewModel.loadSubscribers(publicationId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscribers") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is SubscribersUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is SubscribersUiState.Success -> {
                val state = uiState as SubscribersUiState.Success
                if (state.subscribers.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.People,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No subscribers yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(paddingValues),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.subscribers, key = { it.pubkey }) { subscriber ->
                            SubscriberItem(subscriber = subscriber)
                        }
                    }
                }
            }

            is SubscribersUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (uiState as SubscribersUiState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun SubscriberItem(subscriber: SubscriberEntity) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = (subscriber.displayName?.firstOrNull() ?: 'S').uppercase(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = subscriber.displayName ?: subscriber.pubkey.take(12) + "...",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Subscribed ${formatDate(subscriber.subscribedAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (subscriber.notificationsEnabled) {
                Icon(
                    Icons.Default.Notifications,
                    contentDescription = "Notifications enabled",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
            } else {
                Icon(
                    Icons.Default.NotificationsOff,
                    contentDescription = "Notifications disabled",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

// ============== Utility ==============

private fun formatDate(timestamp: Long): String {
    val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    return formatter.format(Date(timestamp * 1000))
}
