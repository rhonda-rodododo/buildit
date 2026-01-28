package network.buildit.modules.search.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.HowToVote
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import network.buildit.modules.search.models.FormattedSearchResult
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Search results list component.
 *
 * Displays search results with:
 * - Module type icons
 * - Highlighted excerpts
 * - Timestamps
 * - Score indicators (optional)
 */
@Composable
fun ResultList(
    results: List<FormattedSearchResult>,
    onResultClick: (FormattedSearchResult) -> Unit,
    modifier: Modifier = Modifier,
    showScores: Boolean = false,
    contentPadding: PaddingValues = PaddingValues(16.dp)
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(results, key = { it.id }) { result ->
            ResultCard(
                result = result,
                onClick = { onResultClick(result) },
                showScore = showScores
            )
        }
    }
}

/**
 * Individual search result card.
 */
@Composable
fun ResultCard(
    result: FormattedSearchResult,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showScore: Boolean = false
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Module type icon
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = getModuleColor(result.moduleType).copy(alpha = 0.1f),
                modifier = Modifier.size(40.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = getModuleIcon(result.moduleType),
                        contentDescription = result.moduleType,
                        tint = getModuleColor(result.moduleType),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Content
            Column(modifier = Modifier.weight(1f)) {
                // Title
                Text(
                    text = result.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Subtitle
                result.subtitle?.let { subtitle ->
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Excerpt with highlighting
                val excerptText = result.highlightedExcerpt ?: result.excerpt
                excerptText?.let { excerpt ->
                    Spacer(modifier = Modifier.height(4.dp))
                    HighlightedText(
                        text = excerpt,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                        maxLines = 2
                    )
                }

                // Footer with metadata
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Module type label
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = getModuleColor(result.moduleType).copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = formatModuleType(result.moduleType),
                            style = MaterialTheme.typography.labelSmall,
                            color = getModuleColor(result.moduleType),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    // Timestamp
                    result.timestamp?.let { timestamp ->
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = formatTimestamp(timestamp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    }

                    // Score (debug)
                    if (showScore) {
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            text = "%.2f".format(result.score),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Text component with HTML-like bold highlighting.
 * Parses <b>text</b> tags and renders them as bold.
 */
@Composable
fun HighlightedText(
    text: String,
    style: androidx.compose.ui.text.TextStyle,
    color: androidx.compose.ui.graphics.Color,
    maxLines: Int = Int.MAX_VALUE,
    modifier: Modifier = Modifier
) {
    val annotatedString = remember(text) {
        buildAnnotatedString {
            var currentIndex = 0
            val boldRegex = Regex("<b>(.*?)</b>")

            boldRegex.findAll(text).forEach { match ->
                // Append text before the match
                append(text.substring(currentIndex, match.range.first))

                // Append bold text
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(match.groupValues[1])
                }

                currentIndex = match.range.last + 1
            }

            // Append remaining text
            if (currentIndex < text.length) {
                append(text.substring(currentIndex))
            }
        }
    }

    Text(
        text = annotatedString,
        style = style,
        color = color,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
    )
}

/**
 * Empty search results state.
 */
@Composable
fun EmptyResults(
    query: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.SearchOff,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(64.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "No results found",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Try different keywords or remove filters",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Loading state for search.
 */
@Composable
fun SearchLoading(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

/**
 * Search results header showing count and time.
 */
@Composable
fun ResultsHeader(
    totalCount: Int,
    searchTimeMs: Double,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$totalCount results",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = "(%.0f ms)".format(searchTimeMs),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
    }
}

// ============== Helper Functions ==============

@Composable
private fun getModuleIcon(moduleType: String): ImageVector {
    return when (moduleType.lowercase()) {
        "events" -> Icons.Default.CalendarMonth
        "messaging" -> Icons.Default.Forum
        "documents" -> Icons.Default.Description
        "wiki" -> Icons.Default.MenuBook
        "mutualaid", "mutual-aid" -> Icons.Default.Handshake
        "governance" -> Icons.Default.HowToVote
        "publishing" -> Icons.Default.Article
        "groups" -> Icons.Default.Groups
        else -> Icons.Default.Description
    }
}

@Composable
private fun getModuleColor(moduleType: String): androidx.compose.ui.graphics.Color {
    return when (moduleType.lowercase()) {
        "events" -> MaterialTheme.colorScheme.tertiary
        "messaging" -> MaterialTheme.colorScheme.primary
        "documents" -> MaterialTheme.colorScheme.secondary
        "wiki" -> MaterialTheme.colorScheme.primary
        "mutualaid", "mutual-aid" -> MaterialTheme.colorScheme.tertiary
        "governance" -> MaterialTheme.colorScheme.secondary
        "publishing" -> MaterialTheme.colorScheme.primary
        "groups" -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }
}

private fun formatModuleType(moduleType: String): String {
    return when (moduleType.lowercase()) {
        "mutualaid" -> "Mutual Aid"
        else -> moduleType.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase(Locale.getDefault())
            else it.toString()
        }
    }
}

private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> "Just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        diff < 604_800_000 -> "${diff / 86_400_000}d ago"
        else -> {
            val dateFormat = SimpleDateFormat("MMM d", Locale.getDefault())
            dateFormat.format(Date(timestamp))
        }
    }
}
