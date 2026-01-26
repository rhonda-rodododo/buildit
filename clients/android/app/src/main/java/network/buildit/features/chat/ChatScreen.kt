package network.buildit.features.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.R
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.MessageStatus
import network.buildit.core.transport.TransportStatus
import network.buildit.ui.components.MessageBubble
import network.buildit.ui.theme.BuildItColors
import network.buildit.ui.theme.BuildItTheme

/**
 * Main chat screen showing conversation list or active conversation.
 *
 * @param viewModel The chat view model
 * @param onNavigateToContactPicker Called when user wants to start a new chat
 */
@Composable
fun ChatScreen(
    viewModel: ChatViewModel = hiltViewModel(),
    onNavigateToContactPicker: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val typingUser by viewModel.isTyping.collectAsState()

    when (val state = uiState) {
        is ChatUiState.ConversationList -> {
            ConversationListScreen(
                conversations = state.conversations,
                transportStatus = state.transportStatus,
                onConversationClick = { viewModel.openConversation(it) },
                onNewChat = onNavigateToContactPicker
            )
        }
        is ChatUiState.ActiveConversation -> {
            ActiveConversationScreen(
                conversation = state.conversation,
                messages = state.messages,
                inputText = state.inputText,
                isSending = state.isSending,
                transportStatus = state.transportStatus,
                typingUser = typingUser,
                replyToMessage = state.replyToMessage,
                onInputChanged = { viewModel.updateInput(it) },
                onSend = { viewModel.sendMessage() },
                onBack = { viewModel.closeConversation() },
                onReplyToMessage = { viewModel.setReplyTo(it) },
                onClearReply = { viewModel.clearReplyTo() }
            )
        }
        is ChatUiState.Loading -> {
            LoadingScreen()
        }
    }
}

/**
 * Screen showing the list of conversations.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationListScreen(
    conversations: List<ConversationWithPreview>,
    transportStatus: TransportStatus,
    onConversationClick: (String) -> Unit,
    onNewChat: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.chat_title)) },
                actions = {
                    TransportStatusIndicator(transportStatus)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNewChat,
                containerColor = MaterialTheme.colorScheme.primary,
                modifier = Modifier.semantics {
                    contentDescription = "Start new conversation"
                }
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
            }
        }
    ) { padding ->
        if (conversations.isEmpty()) {
            EmptyConversationsView(modifier = Modifier.padding(padding))
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(conversations, key = { it.conversation.id }) { item ->
                    ConversationListItem(
                        item = item,
                        onClick = { onConversationClick(item.conversation.id) }
                    )
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 72.dp),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }
            }
        }
    }
}

/**
 * A single conversation item in the list.
 */
@Composable
private fun ConversationListItem(
    item: ConversationWithPreview,
    onClick: () -> Unit
) {
    val accessibilityDescription = buildString {
        append("Conversation with ${item.displayName}")
        if (item.conversation.unreadCount > 0) {
            append(". ${item.conversation.unreadCount} unread ${if (item.conversation.unreadCount == 1) "message" else "messages"}")
        }
        item.lastMessagePreview?.let { append(". Last message: $it") }
        item.conversation.lastMessageAt?.let { append(". ${formatRelativeTime(it)}") }
    }

    ListItem(
        modifier = Modifier
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = accessibilityDescription
            },
        colors = ListItemDefaults.colors(
            containerColor = if (item.conversation.isPinned) {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
            } else {
                Color.Transparent
            }
        ),
        leadingContent = {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = item.displayName.take(2).uppercase(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        },
        headlineContent = {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (item.conversation.unreadCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Badge {
                        Text(item.conversation.unreadCount.toString())
                    }
                }
            }
        },
        supportingContent = {
            item.lastMessagePreview?.let { preview ->
                Text(
                    text = preview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        },
        trailingContent = {
            item.conversation.lastMessageAt?.let { timestamp ->
                Text(
                    text = formatRelativeTime(timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    )
}

/**
 * Screen showing an active conversation with messages.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun ActiveConversationScreen(
    conversation: ConversationEntity,
    messages: List<MessageEntity>,
    inputText: String,
    isSending: Boolean,
    transportStatus: TransportStatus,
    typingUser: String? = null,
    replyToMessage: MessageEntity? = null,
    onInputChanged: (String) -> Unit,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onReplyToMessage: (MessageEntity) -> Unit = {},
    onClearReply: () -> Unit = {}
) {
    val listState = rememberLazyListState()

    // Scroll to bottom when new messages arrive
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(0)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Encrypted",
                            tint = BuildItColors.Encrypted,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(conversation.title ?: "Chat")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    TransportStatusIndicator(transportStatus)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            Column(modifier = Modifier.imePadding()) {
                // Reply preview
                AnimatedVisibility(
                    visible = replyToMessage != null,
                    enter = slideInVertically { it },
                    exit = slideOutVertically { it }
                ) {
                    replyToMessage?.let { message ->
                        ReplyPreview(
                            message = message,
                            onDismiss = onClearReply
                        )
                    }
                }

                // Typing indicator
                AnimatedVisibility(
                    visible = typingUser != null,
                    enter = slideInVertically { it },
                    exit = slideOutVertically { it }
                ) {
                    TypingIndicatorView(userName = typingUser ?: "")
                }

                MessageInput(
                    text = inputText,
                    onTextChanged = onInputChanged,
                    onSend = onSend,
                    isSending = isSending
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            state = listState,
            reverseLayout = true,
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                // Find the original message if this is a reply
                val originalMessage = message.replyToId?.let { replyId ->
                    messages.find { it.id == replyId }
                }

                Box(
                    modifier = Modifier.combinedClickable(
                        onClick = {},
                        onLongClick = { onReplyToMessage(message) }
                    )
                ) {
                    MessageBubble(
                        content = message.content,
                        timestamp = message.timestamp,
                        isSent = message.senderPubkey == "self", // Replace with actual check
                        status = message.status,
                        replyToContent = originalMessage?.content
                    )
                }
            }
        }
    }
}

/**
 * Typing indicator showing who is typing.
 */
@Composable
private fun TypingIndicatorView(userName: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$userName is typing...",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Preview of the message being replied to.
 */
@Composable
private fun ReplyPreview(
    message: MessageEntity,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.AutoMirrored.Filled.Reply,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = "Replying to",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Cancel reply",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Message input field with send button.
 */
@Composable
private fun MessageInput(
    text: String,
    onTextChanged: (String) -> Unit,
    onSend: () -> Unit,
    isSending: Boolean,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        tonalElevation = 3.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextField(
                value = text,
                onValueChange = onTextChanged,
                modifier = Modifier.weight(1f),
                placeholder = {
                    Text(stringResource(R.string.chat_input_placeholder))
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                shape = RoundedCornerShape(24.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { onSend() }),
                maxLines = 4
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = onSend,
                enabled = text.isNotBlank() && !isSending,
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .semantics {
                        contentDescription = if (isSending) {
                            "Sending message"
                        } else if (text.isNotBlank()) {
                            "Send message"
                        } else {
                            "Send message, disabled. Enter a message first"
                        }
                    }
            ) {
                if (isSending) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = null,
                        tint = if (text.isNotBlank()) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            }
        }
    }
}

/**
 * Transport status indicator showing BLE and Nostr connectivity.
 */
@Composable
private fun TransportStatusIndicator(status: TransportStatus) {
    Row(
        modifier = Modifier
            .padding(end = 8.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = buildString {
                    append("Connection status: ")
                    append(if (status.bleAvailable) "Bluetooth connected" else "Bluetooth disconnected")
                    append(", ")
                    append(if (status.nostrAvailable) "Internet connected" else "Internet disconnected")
                }
            },
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            Icons.Default.Bluetooth,
            contentDescription = null,
            tint = if (status.bleAvailable) BuildItColors.BleConnected else BuildItColors.Offline,
            modifier = Modifier.size(20.dp)
        )
        Icon(
            Icons.Default.Cloud,
            contentDescription = null,
            tint = if (status.nostrAvailable) BuildItColors.Online else BuildItColors.Offline,
            modifier = Modifier.size(20.dp)
        )
    }
}

/**
 * Empty state view when there are no conversations.
 */
@Composable
private fun EmptyConversationsView(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = stringResource(R.string.chat_no_messages),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Loading screen.
 */
@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

/**
 * Formats a timestamp as relative time.
 */
private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / (60 * 1000)
    val hours = diff / (60 * 60 * 1000)
    val days = diff / (24 * 60 * 60 * 1000)

    return when {
        minutes < 1 -> "now"
        minutes < 60 -> "${minutes}m"
        hours < 24 -> "${hours}h"
        days < 7 -> "${days}d"
        else -> "${days / 7}w"
    }
}

/**
 * Conversation with preview data for the list.
 */
data class ConversationWithPreview(
    val conversation: ConversationEntity,
    val displayName: String,
    val lastMessagePreview: String?
)

@Preview(showBackground = true)
@Composable
private fun ChatScreenPreview() {
    BuildItTheme {
        MessageInput(
            text = "Hello!",
            onTextChanged = {},
            onSend = {},
            isSending = false
        )
    }
}
