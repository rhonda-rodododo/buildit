package network.buildit.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import network.buildit.core.storage.MessageStatus
import network.buildit.ui.theme.BuildItColors
import network.buildit.ui.theme.BuildItTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Message bubble component for displaying chat messages.
 *
 * Features:
 * - Different styling for sent vs received messages
 * - Delivery status indicators
 * - Timestamp display
 * - Reply threading support
 * - Long-press actions
 */
@Composable
fun MessageBubble(
    content: String,
    timestamp: Long,
    isSent: Boolean,
    status: MessageStatus = MessageStatus.SENT,
    senderName: String? = null,
    replyToContent: String? = null,
    modifier: Modifier = Modifier
) {
    val bubbleColor by animateColorAsState(
        targetValue = if (isSent) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.surfaceVariant
        },
        label = "bubbleColor"
    )

    val textColor = if (isSent) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

    val bubbleShape = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = if (isSent) 16.dp else 4.dp,
        bottomEnd = if (isSent) 4.dp else 16.dp
    )

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = if (isSent) Alignment.End else Alignment.Start
    ) {
        // Sender name for group chats
        if (!isSent && senderName != null) {
            Text(
                text = senderName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(
                    start = if (!isSent) 12.dp else 0.dp,
                    bottom = 2.dp
                )
            )
        }

        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(bubbleShape)
                .background(bubbleColor)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Column {
                // Reply preview
                if (replyToContent != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (isSent) {
                                    Color.White.copy(alpha = 0.2f)
                                } else {
                                    MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)
                                }
                            )
                            .padding(8.dp)
                    ) {
                        Text(
                            text = replyToContent,
                            style = MaterialTheme.typography.bodySmall,
                            color = textColor.copy(alpha = 0.8f),
                            maxLines = 2
                        )
                    }
                    Spacer(modifier = Modifier.size(8.dp))
                }

                // Message content
                Text(
                    text = content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = textColor
                )

                // Timestamp and status
                Row(
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatTimestamp(timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = textColor.copy(alpha = 0.7f)
                    )

                    if (isSent) {
                        Spacer(modifier = Modifier.width(4.dp))
                        MessageStatusIcon(
                            status = status,
                            tint = textColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Displays the message delivery status icon.
 */
@Composable
private fun MessageStatusIcon(
    status: MessageStatus,
    tint: Color,
    modifier: Modifier = Modifier
) {
    val icon = when (status) {
        MessageStatus.PENDING -> Icons.Default.Schedule
        MessageStatus.SENT -> Icons.Default.Check
        MessageStatus.DELIVERED -> Icons.Default.DoneAll
        MessageStatus.READ -> Icons.Default.DoneAll
        MessageStatus.FAILED -> Icons.Default.Warning
    }

    val iconTint = when (status) {
        MessageStatus.READ -> BuildItColors.Online
        MessageStatus.FAILED -> MaterialTheme.colorScheme.error
        else -> tint
    }

    Icon(
        imageVector = icon,
        contentDescription = status.name,
        modifier = modifier.size(14.dp),
        tint = iconTint
    )
}

/**
 * Formats a timestamp for display.
 */
private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    val format = when {
        diff < 24 * 60 * 60 * 1000 -> SimpleDateFormat("HH:mm", Locale.getDefault())
        diff < 7 * 24 * 60 * 60 * 1000 -> SimpleDateFormat("EEE HH:mm", Locale.getDefault())
        else -> SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())
    }

    return format.format(Date(timestamp))
}

/**
 * Date separator between message groups.
 */
@Composable
fun DateSeparator(
    date: Long,
    modifier: Modifier = Modifier
) {
    val text = formatDateSeparator(date)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )
        }
    }
}

/**
 * Formats a date for the date separator.
 */
private fun formatDateSeparator(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val dayMs = 24 * 60 * 60 * 1000

    return when {
        diff < dayMs -> "Today"
        diff < 2 * dayMs -> "Yesterday"
        diff < 7 * dayMs -> SimpleDateFormat("EEEE", Locale.getDefault()).format(Date(timestamp))
        else -> SimpleDateFormat("MMMM d, yyyy", Locale.getDefault()).format(Date(timestamp))
    }
}

/**
 * Typing indicator shown when someone is typing.
 */
@Composable
fun TypingIndicator(
    senderName: String? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Animated dots would go here
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
        )
        Spacer(modifier = Modifier.width(4.dp))
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
        )
        Spacer(modifier = Modifier.width(4.dp))
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
        )

        if (senderName != null) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "$senderName is typing...",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun MessageBubblePreview() {
    BuildItTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            MessageBubble(
                content = "Hey! How are you?",
                timestamp = System.currentTimeMillis() - 60000,
                isSent = false
            )
            MessageBubble(
                content = "I'm doing great, thanks for asking! Working on the BuildIt app.",
                timestamp = System.currentTimeMillis() - 30000,
                isSent = true,
                status = MessageStatus.DELIVERED
            )
            MessageBubble(
                content = "That's awesome!",
                timestamp = System.currentTimeMillis(),
                isSent = false,
                replyToContent = "I'm doing great, thanks for asking!"
            )
        }
    }
}
