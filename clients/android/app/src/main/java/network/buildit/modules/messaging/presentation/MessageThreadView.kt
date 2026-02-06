package network.buildit.modules.messaging.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import network.buildit.core.storage.MessageEntity
import java.text.SimpleDateFormat
import java.util.*

/**
 * Thread reply indicator shown on a message that is a reply.
 *
 * Displays a compact reference to the parent message with an option
 * to navigate to the parent.
 */
@Composable
fun ThreadReplyIndicator(
    parentMessage: MessageEntity?,
    parentSenderName: String?,
    onNavigateToParent: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (parentMessage == null) return

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onNavigateToParent),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Reply indicator bar
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(32.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(MaterialTheme.colorScheme.primary)
            )

            Spacer(modifier = Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                // Sender name
                Text(
                    text = parentSenderName ?: parentMessage.senderPubkey.take(8) + "...",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                // Message preview
                Text(
                    text = parentMessage.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Icon(
                Icons.Default.KeyboardArrowUp,
                contentDescription = "Go to original",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Reply count badge displayed on messages that have replies.
 *
 * Tapping opens the thread view showing all replies.
 */
@Composable
fun ThreadReplyCountBadge(
    replyCount: Int,
    lastReplyTimestamp: Long?,
    lastReplySenderName: String?,
    onOpenThread: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (replyCount <= 0) return

    Surface(
        modifier = modifier.clickable(onClick = onOpenThread),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                Icons.AutoMirrored.Filled.Reply,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "$replyCount repl${if (replyCount == 1) "y" else "ies"}",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            lastReplySenderName?.let { sender ->
                Text(
                    text = "- $sender",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            lastReplyTimestamp?.let { timestamp ->
                Text(
                    text = formatThreadTime(timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Thread view screen showing a message and all its replies.
 *
 * Features:
 * - Original message at top
 * - Chronological list of replies
 * - Inline reply composer at bottom
 * - Navigate to parent thread if nested
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageThreadScreen(
    parentMessage: MessageEntity,
    replies: List<MessageEntity>,
    parentSenderName: String?,
    senderNames: Map<String, String>, // pubkey -> display name
    currentUserPubkey: String,
    replyText: String,
    onReplyTextChanged: (String) -> Unit,
    onSendReply: () -> Unit,
    onBackClick: () -> Unit,
    onMessageLongPress: (MessageEntity) -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Thread")
                        Text(
                            text = "${replies.size} repl${if (replies.size == 1) "y" else "ies"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            // Reply composer
            ThreadReplyComposer(
                replyText = replyText,
                onReplyTextChanged = onReplyTextChanged,
                onSend = onSendReply
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Original message (highlighted)
            item(key = parentMessage.id) {
                ThreadOriginalMessage(
                    message = parentMessage,
                    senderName = parentSenderName
                        ?: senderNames[parentMessage.senderPubkey]
                        ?: parentMessage.senderPubkey.take(8) + "...",
                    isOwnMessage = parentMessage.senderPubkey == currentUserPubkey
                )
            }

            // Separator
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f))
                    Text(
                        text = "${replies.size} repl${if (replies.size == 1) "y" else "ies"}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f))
                }
            }

            // Replies
            items(replies.sortedBy { it.timestamp }, key = { it.id }) { reply ->
                ThreadReplyMessage(
                    message = reply,
                    senderName = senderNames[reply.senderPubkey]
                        ?: reply.senderPubkey.take(8) + "...",
                    isOwnMessage = reply.senderPubkey == currentUserPubkey,
                    onLongPress = { onMessageLongPress(reply) }
                )
            }

            // Empty state
            if (replies.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.AutoMirrored.Filled.Reply,
                                contentDescription = null,
                                modifier = Modifier.size(36.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No replies yet",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Be the first to reply",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The original (parent) message displayed at the top of the thread.
 */
@Composable
private fun ThreadOriginalMessage(
    message: MessageEntity,
    senderName: String,
    isOwnMessage: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Sender and time
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = senderName,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isOwnMessage) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = formatThreadTimestamp(message.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Message content
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

/**
 * A reply message in the thread.
 */
@Composable
private fun ThreadReplyMessage(
    message: MessageEntity,
    senderName: String,
    isOwnMessage: Boolean,
    onLongPress: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onLongPress),
        horizontalArrangement = if (isOwnMessage) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 300.dp),
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isOwnMessage) 12.dp else 4.dp,
                bottomEnd = if (isOwnMessage) 4.dp else 12.dp
            ),
            color = if (isOwnMessage) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.surfaceVariant
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (!isOwnMessage) {
                    Text(
                        text = senderName,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                }

                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isOwnMessage) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = formatThreadTime(message.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isOwnMessage) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Inline reply composer at the bottom of the thread screen.
 */
@Composable
private fun ThreadReplyComposer(
    replyText: String,
    onReplyTextChanged: (String) -> Unit,
    onSend: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = replyText,
                onValueChange = onReplyTextChanged,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Reply in thread...") },
                maxLines = 4,
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                )
            )

            Spacer(modifier = Modifier.width(8.dp))

            FilledIconButton(
                onClick = onSend,
                enabled = replyText.isNotBlank()
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send reply")
            }
        }
    }
}

private fun formatThreadTimestamp(timestamp: Long): String {
    val formatter = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
    return formatter.format(Date(timestamp))
}

private fun formatThreadTime(timestamp: Long): String {
    val formatter = SimpleDateFormat("h:mm a", Locale.getDefault())
    return formatter.format(Date(timestamp))
}
