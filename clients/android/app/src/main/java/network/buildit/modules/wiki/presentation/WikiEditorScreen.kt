package network.buildit.modules.wiki.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Wiki editor mode - edit raw markdown or preview rendered content.
 */
enum class WikiEditorMode {
    EDIT,
    PREVIEW,
    SPLIT
}

/**
 * Markdown editor screen for creating/editing wiki pages.
 *
 * Features:
 * - Full markdown editing with syntax highlighting hints
 * - Live preview toggle (edit/preview/split)
 * - Markdown toolbar (bold, italic, headers, lists, links, code)
 * - Auto-save drafts
 * - Category and tag selection
 * - Summary field for edit description
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiEditorScreen(
    pageId: String? = null, // null for new page
    groupId: String,
    onBackClick: () -> Unit,
    onSaved: (String) -> Unit, // Called with page ID on save
    viewModel: WikiEditorViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(pageId, groupId) {
        viewModel.initialize(pageId, groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (pageId == null) "New Page" else "Edit Page")
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Editor mode toggle
                    IconButton(onClick = { viewModel.toggleEditorMode() }) {
                        Icon(
                            when (uiState.editorMode) {
                                WikiEditorMode.EDIT -> Icons.Default.Visibility
                                WikiEditorMode.PREVIEW -> Icons.Default.Edit
                                WikiEditorMode.SPLIT -> Icons.Default.VerticalSplit
                            },
                            contentDescription = when (uiState.editorMode) {
                                WikiEditorMode.EDIT -> "Preview"
                                WikiEditorMode.PREVIEW -> "Edit"
                                WikiEditorMode.SPLIT -> "Split view"
                            }
                        )
                    }

                    // Save button
                    IconButton(
                        onClick = {
                            viewModel.save { savedId ->
                                onSaved(savedId)
                            }
                        },
                        enabled = uiState.canSave
                    ) {
                        Icon(Icons.Default.Save, contentDescription = "Save")
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
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Title field
                OutlinedTextField(
                    value = uiState.title,
                    onValueChange = { viewModel.updateTitle(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    label = { Text("Page Title") },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.titleLarge
                )

                // Markdown toolbar
                if (uiState.editorMode != WikiEditorMode.PREVIEW) {
                    MarkdownToolbar(
                        onInsert = { viewModel.insertMarkdown(it) }
                    )
                }

                // Editor / Preview content
                when (uiState.editorMode) {
                    WikiEditorMode.EDIT -> {
                        EditorPane(
                            content = uiState.content,
                            onContentChange = { viewModel.updateContent(it) },
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                        )
                    }
                    WikiEditorMode.PREVIEW -> {
                        PreviewPane(
                            content = uiState.content,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                        )
                    }
                    WikiEditorMode.SPLIT -> {
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                        ) {
                            EditorPane(
                                content = uiState.content,
                                onContentChange = { viewModel.updateContent(it) },
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                            )
                            VerticalDivider()
                            PreviewPane(
                                content = uiState.content,
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                            )
                        }
                    }
                }

                HorizontalDivider()

                // Metadata section (collapsible)
                MetadataSection(
                    summary = uiState.editSummary,
                    onSummaryChange = { viewModel.updateEditSummary(it) },
                    tags = uiState.tags,
                    onTagsChange = { viewModel.updateTags(it) },
                    selectedCategoryId = uiState.categoryId,
                    categories = uiState.availableCategories,
                    onCategorySelected = { viewModel.updateCategory(it) }
                )
            }
        }

        // Error snackbar
        uiState.error?.let { error ->
            LaunchedEffect(error) {
                viewModel.clearError()
            }
        }
    }
}

/**
 * Markdown formatting toolbar with common formatting actions.
 */
@Composable
private fun MarkdownToolbar(
    onInsert: (MarkdownInsert) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceVariant,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            ToolbarButton(
                icon = Icons.Default.FormatBold,
                description = "Bold",
                onClick = { onInsert(MarkdownInsert.BOLD) }
            )
            ToolbarButton(
                icon = Icons.Default.FormatItalic,
                description = "Italic",
                onClick = { onInsert(MarkdownInsert.ITALIC) }
            )
            ToolbarButton(
                icon = Icons.Default.Title,
                description = "Heading",
                onClick = { onInsert(MarkdownInsert.HEADING) }
            )

            VerticalDivider(modifier = Modifier.height(32.dp))

            ToolbarButton(
                icon = Icons.Default.FormatListBulleted,
                description = "Bullet list",
                onClick = { onInsert(MarkdownInsert.BULLET_LIST) }
            )
            ToolbarButton(
                icon = Icons.Default.FormatListNumbered,
                description = "Numbered list",
                onClick = { onInsert(MarkdownInsert.NUMBERED_LIST) }
            )
            ToolbarButton(
                icon = Icons.Default.CheckBox,
                description = "Checklist",
                onClick = { onInsert(MarkdownInsert.CHECKLIST) }
            )

            VerticalDivider(modifier = Modifier.height(32.dp))

            ToolbarButton(
                icon = Icons.Default.Link,
                description = "Link",
                onClick = { onInsert(MarkdownInsert.LINK) }
            )
            ToolbarButton(
                icon = Icons.Default.Code,
                description = "Code",
                onClick = { onInsert(MarkdownInsert.CODE) }
            )
            ToolbarButton(
                icon = Icons.Default.DataObject,
                description = "Code block",
                onClick = { onInsert(MarkdownInsert.CODE_BLOCK) }
            )
            ToolbarButton(
                icon = Icons.Default.FormatQuote,
                description = "Blockquote",
                onClick = { onInsert(MarkdownInsert.BLOCKQUOTE) }
            )
            ToolbarButton(
                icon = Icons.Default.HorizontalRule,
                description = "Horizontal rule",
                onClick = { onInsert(MarkdownInsert.HORIZONTAL_RULE) }
            )
        }
    }
}

@Composable
private fun ToolbarButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    onClick: () -> Unit
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(36.dp)
    ) {
        Icon(
            icon,
            contentDescription = description,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * The raw markdown editing pane.
 */
@Composable
private fun EditorPane(
    content: String,
    onContentChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    BasicTextField(
        value = content,
        onValueChange = onContentChange,
        modifier = modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        textStyle = TextStyle(
            fontFamily = FontFamily.Monospace,
            fontSize = MaterialTheme.typography.bodyMedium.fontSize,
            color = MaterialTheme.colorScheme.onSurface
        ),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        decorationBox = { innerTextField ->
            if (content.isEmpty()) {
                Text(
                    text = "Start writing your page content in Markdown...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    fontFamily = FontFamily.Monospace
                )
            }
            innerTextField()
        }
    )
}

/**
 * The rendered markdown preview pane.
 */
@Composable
private fun PreviewPane(
    content: String,
    modifier: Modifier = Modifier
) {
    SelectionContainer {
        Column(
            modifier = modifier
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            if (content.isEmpty()) {
                Text(
                    text = "Nothing to preview yet",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                // Reuse the MarkdownContent composable from WikiScreen
                MarkdownContentPreview(content = content)
            }
        }
    }
}

/**
 * Simplified markdown renderer for the editor preview.
 */
@Composable
private fun MarkdownContentPreview(content: String) {
    val lines = content.split("\n")
    var inCodeBlock = false
    val codeBlockContent = StringBuilder()

    lines.forEach { line ->
        val trimmed = line.trim()

        if (trimmed.startsWith("```")) {
            if (inCodeBlock) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = codeBlockContent.toString(),
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace
                        ),
                        modifier = Modifier.padding(12.dp)
                    )
                }
                codeBlockContent.clear()
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
            trimmed.startsWith("### ") -> Text(
                text = trimmed.removePrefix("### "),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
            )
            trimmed.startsWith("## ") -> Text(
                text = trimmed.removePrefix("## "),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
            )
            trimmed.startsWith("# ") -> Text(
                text = trimmed.removePrefix("# "),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
            )
            trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                Row(modifier = Modifier.padding(vertical = 2.dp)) {
                    Text("  ", style = MaterialTheme.typography.bodyMedium)
                    Text(trimmed.drop(2), style = MaterialTheme.typography.bodyMedium)
                }
            }
            trimmed.startsWith("> ") -> {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = trimmed.removePrefix("> "),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(8.dp)
                    )
                }
            }
            trimmed.isEmpty() -> Spacer(modifier = Modifier.height(8.dp))
            else -> Text(
                text = trimmed,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(vertical = 2.dp)
            )
        }
    }
}

/**
 * Metadata section at the bottom of the editor for tags, category, summary.
 */
@Composable
private fun MetadataSection(
    summary: String,
    onSummaryChange: (String) -> Unit,
    tags: List<String>,
    onTagsChange: (List<String>) -> Unit,
    selectedCategoryId: String?,
    categories: List<CategoryOption>,
    onCategorySelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var tagInput by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Expand/collapse toggle
        TextButton(
            onClick = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("Page Settings")
        }

        if (expanded) {
            // Edit summary
            OutlinedTextField(
                value = summary,
                onValueChange = onSummaryChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Edit Summary") },
                placeholder = { Text("Describe your changes...") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Category selector
            if (categories.isNotEmpty()) {
                var categoryExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = categoryExpanded,
                    onExpandedChange = { categoryExpanded = it }
                ) {
                    OutlinedTextField(
                        value = categories.find { it.id == selectedCategoryId }?.name ?: "No category",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        label = { Text("Category") },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded)
                        },
                        textStyle = MaterialTheme.typography.bodySmall
                    )
                    ExposedDropdownMenu(
                        expanded = categoryExpanded,
                        onDismissRequest = { categoryExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("No category") },
                            onClick = {
                                onCategorySelected(null)
                                categoryExpanded = false
                            }
                        )
                        categories.forEach { category ->
                            DropdownMenuItem(
                                text = { Text(category.name) },
                                onClick = {
                                    onCategorySelected(category.id)
                                    categoryExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
            }

            // Tags
            OutlinedTextField(
                value = tagInput,
                onValueChange = { tagInput = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Add Tag") },
                placeholder = { Text("Press enter to add tag") },
                singleLine = true,
                trailingIcon = {
                    if (tagInput.isNotBlank()) {
                        IconButton(onClick = {
                            if (tagInput.isNotBlank() && tagInput !in tags) {
                                onTagsChange(tags + tagInput.trim())
                                tagInput = ""
                            }
                        }) {
                            Icon(Icons.Default.Add, contentDescription = "Add tag")
                        }
                    }
                },
                textStyle = MaterialTheme.typography.bodySmall
            )

            if (tags.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    tags.forEach { tag ->
                        InputChip(
                            selected = false,
                            onClick = {
                                onTagsChange(tags - tag)
                            },
                            label = { Text(tag, style = MaterialTheme.typography.labelSmall) },
                            trailingIcon = {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Remove $tag",
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Types of markdown formatting that can be inserted.
 */
enum class MarkdownInsert {
    BOLD,
    ITALIC,
    HEADING,
    BULLET_LIST,
    NUMBERED_LIST,
    CHECKLIST,
    LINK,
    CODE,
    CODE_BLOCK,
    BLOCKQUOTE,
    HORIZONTAL_RULE
}

/**
 * Simple data class for category options in the dropdown.
 */
data class CategoryOption(
    val id: String,
    val name: String
)
