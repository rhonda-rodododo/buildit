package network.buildit.modules.wiki.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.wiki.data.local.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main wiki list screen showing categories and pages.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiListScreen(
    groupId: String,
    onPageClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: WikiListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showSearch by remember { mutableStateOf(false) }

    LaunchedEffect(groupId) {
        viewModel.loadWiki(groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Knowledge Base") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        showSearch = !showSearch
                        if (!showSearch) {
                            viewModel.clearSearch()
                        }
                    }) {
                        Icon(
                            if (showSearch) Icons.Default.SearchOff else Icons.Default.Search,
                            contentDescription = if (showSearch) "Hide search" else "Search"
                        )
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
            // Search bar (toggleable)
            if (showSearch) {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { viewModel.search(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    placeholder = { Text("Search pages...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.clearSearch() }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear")
                            }
                        }
                    },
                    singleLine = true
                )
            }

            // Show search results or regular content
            if (showSearch && uiState.searchQuery.isNotEmpty()) {
                SearchResultsList(
                    results = uiState.searchResults,
                    isSearching = uiState.isSearching,
                    onResultClick = onPageClick
                )
            } else {
                // Categories filter chips
                if (uiState.categories.isNotEmpty()) {
                    CategoryChips(
                        categories = uiState.categories,
                        selectedCategoryId = uiState.selectedCategoryId,
                        onCategorySelected = { viewModel.selectCategory(it) }
                    )
                }

                // Recent pages section (when no category selected)
                if (uiState.selectedCategoryId == null && uiState.recentPages.isNotEmpty()) {
                    RecentPagesSection(
                        pages = uiState.recentPages,
                        onPageClick = onPageClick
                    )
                }

                // Main pages list
                if (uiState.isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else if (uiState.pages.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No pages yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    PagesList(
                        pages = uiState.pages,
                        onPageClick = onPageClick
                    )
                }
            }
        }

        // Error snackbar
        uiState.error?.let { error ->
            LaunchedEffect(error) {
                // Show snackbar
                viewModel.clearError()
            }
        }
    }
}

@Composable
private fun CategoryChips(
    categories: List<WikiCategoryEntity>,
    selectedCategoryId: String?,
    onCategorySelected: (String?) -> Unit
) {
    LazyRow(
        modifier = Modifier.padding(vertical = 8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = selectedCategoryId == null,
                onClick = { onCategorySelected(null) },
                label = { Text("All") }
            )
        }
        items(categories) { category ->
            FilterChip(
                selected = selectedCategoryId == category.id,
                onClick = { onCategorySelected(category.id) },
                label = { Text(category.name) },
                leadingIcon = category.icon?.let { icon ->
                    { Text(icon) }
                }
            )
        }
    }
}

@Composable
private fun RecentPagesSection(
    pages: List<WikiPageEntity>,
    onPageClick: (String) -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = "Recent Updates",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        pages.forEach { page ->
            RecentPageItem(page = page, onClick = { onPageClick(page.id) })
        }
    }
    HorizontalDivider()
}

@Composable
private fun RecentPageItem(
    page: WikiPageEntity,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Default.Description,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = page.title,
                style = MaterialTheme.typography.bodyMedium
            )
            page.updatedAt?.let { updated ->
                Text(
                    text = formatDate(updated),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PagesList(
    pages: List<WikiPageEntity>,
    onPageClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(pages, key = { it.id }) { page ->
            PageCard(page = page, onClick = { onPageClick(page.id) })
        }
    }
}

@Composable
private fun PageCard(
    page: WikiPageEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = page.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            page.summary?.let { summary ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }

            if (page.tags.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(page.tags.take(3)) { tag ->
                        AssistChip(
                            onClick = { },
                            label = { Text(tag, style = MaterialTheme.typography.labelSmall) },
                            modifier = Modifier.height(24.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "v${page.version}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${page.readingTimeMinutes} min read",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun SearchResultsList(
    results: List<WikiSearchResult>,
    isSearching: Boolean,
    onResultClick: (String) -> Unit
) {
    if (isSearching) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    } else if (results.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.SearchOff,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No results found",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(results) { result ->
                SearchResultCard(result = result, onClick = { onResultClick(result.pageId) })
            }
        }
    }
}

@Composable
private fun SearchResultCard(
    result: WikiSearchResult,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = result.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            result.excerpt?.let { excerpt ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = excerpt,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }

            if (result.matchedTags.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Matched tags: ${result.matchedTags.joinToString(", ")}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Wiki page detail screen with markdown rendering.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiPageScreen(
    pageId: String,
    onBackClick: () -> Unit,
    viewModel: WikiPageViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showToc by remember { mutableStateOf(false) }
    var showHistory by remember { mutableStateOf(false) }

    LaunchedEffect(pageId) {
        viewModel.loadPage(pageId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.page?.title ?: "Loading...") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState.tableOfContents.isNotEmpty()) {
                        IconButton(onClick = { showToc = !showToc }) {
                            Icon(Icons.Default.List, contentDescription = "Table of Contents")
                        }
                    }
                    IconButton(onClick = { showHistory = true }) {
                        Icon(Icons.Default.History, contentDescription = "View History")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (uiState.error != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Error,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.error ?: "Unknown error",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        } else {
            uiState.page?.let { page ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Header section
                    PageHeader(page = page)

                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))

                    // Table of Contents (expandable)
                    if (showToc && uiState.tableOfContents.isNotEmpty()) {
                        TableOfContentsSection(entries = uiState.tableOfContents)
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    }

                    // Content
                    SelectionContainer {
                        MarkdownContent(
                            content = page.content,
                            modifier = Modifier.padding(16.dp)
                        )
                    }

                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))

                    // Footer
                    PageFooter(page = page)
                }
            }
        }
    }

    // History bottom sheet
    if (showHistory) {
        ModalBottomSheet(
            onDismissRequest = { showHistory = false }
        ) {
            RevisionHistorySheet(
                revisions = uiState.revisions,
                pageTitle = uiState.page?.title ?: "",
                onDismiss = { showHistory = false }
            )
        }
    }
}

@Composable
private fun PageHeader(page: WikiPageEntity) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = page.title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        page.summary?.let { summary ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = summary,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (page.tags.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(page.tags) { tag ->
                    AssistChip(
                        onClick = { },
                        label = { Text(tag) }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Description,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "v${page.version}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${page.readingTimeMinutes} min read",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.TextFields,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${page.wordCount} words",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun TableOfContentsSection(entries: List<TableOfContentsEntry>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Table of Contents",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            entries.forEach { entry ->
                TocEntryRow(entry = entry)
            }
        }
    }
}

@Composable
private fun TocEntryRow(entry: TableOfContentsEntry) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = ((entry.level - 1) * 16).dp,
                top = 4.dp,
                bottom = 4.dp
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Default.Circle,
            contentDescription = null,
            modifier = Modifier.size(6.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = entry.title,
            style = if (entry.level == 1) {
                MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
            } else {
                MaterialTheme.typography.bodySmall
            },
            color = if (entry.level == 1) {
                MaterialTheme.colorScheme.onSurface
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            }
        )
    }
}

@Composable
private fun PageFooter(page: WikiPageEntity) {
    Column(modifier = Modifier.padding(16.dp)) {
        if (page.contributors.isNotEmpty()) {
            Text(
                text = "${page.contributors.size} contributor${if (page.contributors.size == 1) "" else "s"}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        page.updatedAt?.let { updated ->
            Text(
                text = "Last updated: ${formatDate(updated)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Text(
            text = "Created: ${formatDate(page.createdAt)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
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
                    // End code block
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
                // Headers
                trimmed.startsWith("######") -> MarkdownHeader(trimmed.removePrefix("######").trim(), 6)
                trimmed.startsWith("#####") -> MarkdownHeader(trimmed.removePrefix("#####").trim(), 5)
                trimmed.startsWith("####") -> MarkdownHeader(trimmed.removePrefix("####").trim(), 4)
                trimmed.startsWith("###") -> MarkdownHeader(trimmed.removePrefix("###").trim(), 3)
                trimmed.startsWith("##") -> MarkdownHeader(trimmed.removePrefix("##").trim(), 2)
                trimmed.startsWith("#") -> MarkdownHeader(trimmed.removePrefix("#").trim(), 1)

                // Bullet points
                trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                    BulletPoint(text = trimmed.drop(2))
                }

                // Numbered list
                trimmed.matches(Regex("^\\d+\\.\\s.*")) -> {
                    val text = trimmed.replaceFirst(Regex("^\\d+\\.\\s"), "")
                    BulletPoint(text = text)
                }

                // Empty line
                trimmed.isEmpty() -> Spacer(modifier = Modifier.height(8.dp))

                // Regular paragraph
                else -> MarkdownParagraph(text = trimmed)
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
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun BulletPoint(text: String) {
    Row(
        modifier = Modifier.padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "•",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = buildAnnotatedMarkdown(text),
            style = MaterialTheme.typography.bodyMedium
        )
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
            style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
            modifier = Modifier.padding(12.dp)
        )
    }
}

@Composable
private fun buildAnnotatedMarkdown(text: String) = buildAnnotatedString {
    var remaining = text
    var index = 0

    while (remaining.isNotEmpty()) {
        when {
            // Bold: **text**
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

            // Italic: *text*
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

            // Inline code: `text`
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
        if (index > 10000) break // Safety limit
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RevisionHistorySheet(
    revisions: List<PageRevisionEntity>,
    pageTitle: String,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = "Revision History",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = pageTitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (revisions.isEmpty()) {
            Text(
                text = "No revision history available",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.heightIn(max = 400.dp)
            ) {
                items(revisions) { revision ->
                    RevisionRow(revision = revision)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(
            onClick = onDismiss,
            modifier = Modifier.align(Alignment.End)
        ) {
            Text("Done")
        }
    }
}

@Composable
private fun RevisionRow(revision: PageRevisionEntity) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Version ${revision.version}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                AssistChip(
                    onClick = { },
                    label = {
                        Text(
                            text = revision.editType.name.lowercase().replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelSmall
                        )
                    },
                    modifier = Modifier.height(24.dp)
                )
            }

            revision.summary?.let { summary ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = formatDate(revision.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatDate(timestamp: Long): String {
    val formatter = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault())
    return formatter.format(Date(timestamp))
}
