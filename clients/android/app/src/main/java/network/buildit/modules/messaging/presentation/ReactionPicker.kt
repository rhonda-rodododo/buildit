package network.buildit.modules.messaging.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddReaction
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Emoji categories for the reaction picker.
 */
private enum class EmojiCategory(val label: String, val emojis: List<String>) {
    FREQUENT("Recent", emptyList()), // Populated dynamically
    SMILEYS("Smileys", listOf(
        "\uD83D\uDE00", "\uD83D\uDE03", "\uD83D\uDE04", "\uD83D\uDE01", "\uD83D\uDE06",
        "\uD83D\uDE05", "\uD83D\uDE02", "\uD83E\uDD23", "\uD83D\uDE0A", "\uD83D\uDE07",
        "\uD83D\uDE42", "\uD83D\uDE43", "\uD83D\uDE09", "\uD83D\uDE0C", "\uD83D\uDE0D",
        "\uD83E\uDD70", "\uD83D\uDE18", "\uD83D\uDE17", "\uD83D\uDE19", "\uD83D\uDE1A",
        "\uD83D\uDE0B", "\uD83D\uDE1B", "\uD83D\uDE1C", "\uD83E\uDD2A", "\uD83D\uDE1D",
        "\uD83E\uDD11", "\uD83E\uDD17", "\uD83E\uDD2D", "\uD83E\uDD2B", "\uD83E\uDD14"
    )),
    GESTURES("Gestures", listOf(
        "\uD83D\uDC4D", "\uD83D\uDC4E", "\u270A", "\uD83D\uDC4A", "\uD83E\uDD1B",
        "\uD83E\uDD1C", "\uD83D\uDC4F", "\uD83D\uDE4C", "\uD83D\uDC4B", "\uD83E\uDD1A",
        "\uD83D\uDC4C", "\u270C\uFE0F", "\uD83E\uDD1E", "\uD83E\uDD1F", "\uD83E\uDD18",
        "\uD83D\uDC48", "\uD83D\uDC49", "\uD83D\uDC46", "\uD83D\uDC47", "\u261D\uFE0F",
        "\u270B", "\uD83E\uDD1A", "\uD83D\uDD96", "\uD83D\uDC4B", "\uD83E\uDD19"
    )),
    HEARTS("Hearts", listOf(
        "\u2764\uFE0F", "\uD83E\uDDE1", "\uD83D\uDC9B", "\uD83D\uDC9A", "\uD83D\uDC99",
        "\uD83D\uDC9C", "\uD83E\uDD0E", "\uD83D\uDDA4", "\uD83E\uDD0D", "\uD83D\uDC94",
        "\u2763\uFE0F", "\uD83D\uDC95", "\uD83D\uDC9E", "\uD83D\uDC93", "\uD83D\uDC97",
        "\uD83D\uDC96", "\uD83D\uDC98", "\uD83D\uDC9D", "\uD83D\uDC9F"
    )),
    OBJECTS("Objects", listOf(
        "\uD83D\uDD25", "\u2B50", "\uD83C\uDF1F", "\u2728", "\uD83C\uDF89",
        "\uD83C\uDF8A", "\uD83C\uDF88", "\uD83D\uDCA5", "\uD83D\uDCAF", "\u2705",
        "\u274C", "\u2753", "\u2757", "\uD83D\uDCAA", "\uD83D\uDE80",
        "\uD83C\uDF31", "\uD83C\uDF3B", "\uD83C\uDF3A", "\uD83C\uDF3E", "\uD83C\uDF52"
    ))
}

/**
 * Quick reaction bar shown on long-press of a message.
 *
 * Displays common reactions in a horizontal row.
 */
@Composable
fun QuickReactionBar(
    onReactionSelected: (String) -> Unit,
    onShowFullPicker: () -> Unit,
    modifier: Modifier = Modifier
) {
    val quickReactions = listOf(
        "\uD83D\uDC4D", // Thumbs up
        "\u2764\uFE0F", // Heart
        "\uD83D\uDE02", // Laughing
        "\uD83D\uDE2E", // Surprised
        "\uD83D\uDE22", // Crying
        "\uD83D\uDE21"  // Angry
    )

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.extraLarge,
        shadowElevation = 4.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            quickReactions.forEach { emoji ->
                TextButton(
                    onClick = { onReactionSelected(emoji) },
                    contentPadding = PaddingValues(4.dp),
                    modifier = Modifier.size(40.dp)
                ) {
                    Text(text = emoji, fontSize = 20.sp)
                }
            }

            IconButton(
                onClick = onShowFullPicker,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    Icons.Default.AddReaction,
                    contentDescription = "More reactions",
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

/**
 * Full emoji reaction picker displayed as a bottom sheet.
 *
 * Shows emoji categories with a grid layout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReactionPicker(
    recentEmojis: List<String> = emptyList(),
    onReactionSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var selectedCategory by remember {
        mutableStateOf(
            if (recentEmojis.isNotEmpty()) EmojiCategory.FREQUENT else EmojiCategory.SMILEYS
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = Modifier.fillMaxHeight(0.5f)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Category tabs
            ScrollableTabRow(
                selectedTabIndex = EmojiCategory.entries.indexOf(selectedCategory),
                edgePadding = 16.dp
            ) {
                EmojiCategory.entries.forEach { category ->
                    if (category == EmojiCategory.FREQUENT && recentEmojis.isEmpty()) return@forEach

                    Tab(
                        selected = selectedCategory == category,
                        onClick = { selectedCategory = category },
                        text = { Text(category.label, style = MaterialTheme.typography.labelSmall) }
                    )
                }
            }

            // Emoji grid
            val emojis = if (selectedCategory == EmojiCategory.FREQUENT) {
                recentEmojis
            } else {
                selectedCategory.emojis
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(8),
                contentPadding = PaddingValues(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(emojis) { emoji ->
                    TextButton(
                        onClick = { onReactionSelected(emoji) },
                        contentPadding = PaddingValues(2.dp),
                        modifier = Modifier.aspectRatio(1f)
                    ) {
                        Text(
                            text = emoji,
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

/**
 * Displays reaction counts on a message.
 *
 * Shows grouped reactions with emoji and count badges.
 */
@Composable
fun MessageReactions(
    reactions: Map<String, Int>,
    userReactions: Set<String> = emptySet(),
    onReactionClick: (String) -> Unit,
    onAddReaction: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (reactions.isEmpty()) return

    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        contentPadding = PaddingValues(horizontal = 4.dp)
    ) {
        items(reactions.entries.toList()) { (emoji, count) ->
            val isOwn = emoji in userReactions

            Surface(
                modifier = Modifier.clickable { onReactionClick(emoji) },
                shape = MaterialTheme.shapes.small,
                color = if (isOwn) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceVariant,
                border = if (isOwn) ButtonDefaults.outlinedButtonBorder
                else null
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(text = emoji, fontSize = 14.sp)
                    Text(
                        text = count.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (isOwn) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }

        item {
            Surface(
                modifier = Modifier.clickable(onClick = onAddReaction),
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Icon(
                    Icons.Default.AddReaction,
                    contentDescription = "Add reaction",
                    modifier = Modifier
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
