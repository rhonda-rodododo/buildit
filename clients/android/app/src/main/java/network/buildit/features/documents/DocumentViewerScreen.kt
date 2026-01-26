package network.buildit.features.documents

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import network.buildit.ui.theme.BuildItTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Document viewer screen with markdown rendering.
 */
@Composable
fun DocumentViewerScreen(
    document: Document,
    onNavigateBack: () -> Unit = {}
) {
    val context = LocalContext.current

    DocumentViewerContent(
        document = document,
        onBackClick = onNavigateBack,
        onShareClick = {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, document.title)
                putExtra(Intent.EXTRA_TEXT, document.content)
            }
            context.startActivity(Intent.createChooser(shareIntent, "Share Document"))
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DocumentViewerContent(
    document: Document,
    onBackClick: () -> Unit,
    onShareClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(document.title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onShareClick) {
                        Icon(Icons.Default.Share, contentDescription = "Share")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        SelectionContainer {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                // Document metadata
                Text(
                    text = "Last updated ${formatDate(document.updatedAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(16.dp))

                HorizontalDivider()

                Spacer(modifier = Modifier.height(16.dp))

                // Rendered content
                when (document.type) {
                    DocumentType.MARKDOWN -> MarkdownText(content = document.content)
                    else -> PlainText(content = document.content)
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

/**
 * Simple markdown renderer.
 * Supports: headers, bold, italic, links, code blocks, lists.
 */
@Composable
private fun MarkdownText(content: String) {
    val lines = content.split("\n")

    Column(modifier = Modifier.fillMaxWidth()) {
        lines.forEach { line ->
            when {
                // Headers
                line.startsWith("# ") -> {
                    Text(
                        text = line.removePrefix("# "),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
                line.startsWith("## ") -> {
                    Text(
                        text = line.removePrefix("## "),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                }
                line.startsWith("### ") -> {
                    Text(
                        text = line.removePrefix("### "),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }

                // Code block
                line.startsWith("```") || line.startsWith("    ") -> {
                    Text(
                        text = line.removePrefix("```").removePrefix("    "),
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }

                // List items
                line.startsWith("- ") || line.startsWith("* ") -> {
                    Text(
                        text = "• ${line.removePrefix("- ").removePrefix("* ")}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp, bottom = 4.dp)
                    )
                }

                // Numbered list
                line.matches(Regex("^\\d+\\.\\s.*")) -> {
                    Text(
                        text = line,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp, bottom = 4.dp)
                    )
                }

                // Checkbox list
                line.startsWith("- [ ] ") -> {
                    Text(
                        text = "☐ ${line.removePrefix("- [ ] ")}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp, bottom = 4.dp)
                    )
                }
                line.startsWith("- [x] ") || line.startsWith("- [X] ") -> {
                    Text(
                        text = "☑ ${line.removePrefix("- [x] ").removePrefix("- [X] ")}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp, bottom = 4.dp)
                    )
                }

                // Horizontal rule
                line.matches(Regex("^---+$")) || line.matches(Regex("^\\*\\*\\*+$")) -> {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                }

                // Empty line
                line.isBlank() -> {
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Regular text with inline formatting
                else -> {
                    Text(
                        text = parseInlineMarkdown(line),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
            }
        }
    }
}

/**
 * Parses inline markdown (bold, italic, code, links).
 */
@Composable
private fun parseInlineMarkdown(text: String): androidx.compose.ui.text.AnnotatedString {
    return buildAnnotatedString {
        var i = 0
        while (i < text.length) {
            when {
                // Bold: **text**
                text.substring(i).startsWith("**") -> {
                    val endIndex = text.indexOf("**", i + 2)
                    if (endIndex != -1) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                            append(text.substring(i + 2, endIndex))
                        }
                        i = endIndex + 2
                    } else {
                        append(text[i])
                        i++
                    }
                }

                // Italic: *text* or _text_
                text.substring(i).startsWith("*") && !text.substring(i).startsWith("**") -> {
                    val endIndex = text.indexOf("*", i + 1)
                    if (endIndex != -1) {
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                            append(text.substring(i + 1, endIndex))
                        }
                        i = endIndex + 1
                    } else {
                        append(text[i])
                        i++
                    }
                }

                // Inline code: `code`
                text.substring(i).startsWith("`") -> {
                    val endIndex = text.indexOf("`", i + 1)
                    if (endIndex != -1) {
                        withStyle(SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color.Gray.copy(alpha = 0.2f)
                        )) {
                            append(text.substring(i + 1, endIndex))
                        }
                        i = endIndex + 1
                    } else {
                        append(text[i])
                        i++
                    }
                }

                else -> {
                    append(text[i])
                    i++
                }
            }
        }
    }
}

@Composable
private fun PlainText(content: String) {
    Text(
        text = content,
        style = MaterialTheme.typography.bodyMedium
    )
}

private fun formatDate(timestamp: Long): String {
    return SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault()).format(Date(timestamp))
}

@Preview(showBackground = true)
@Composable
private fun DocumentViewerPreview() {
    BuildItTheme {
        DocumentViewerContent(
            document = Document(
                id = "1",
                title = "Sample Document",
                content = """
                    # Hello World

                    This is a **bold** and *italic* text.

                    ## Features

                    - Item 1
                    - Item 2
                    - Item 3

                    `inline code`
                """.trimIndent(),
                type = DocumentType.MARKDOWN,
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                groupId = null
            ),
            onBackClick = {},
            onShareClick = {}
        )
    }
}
