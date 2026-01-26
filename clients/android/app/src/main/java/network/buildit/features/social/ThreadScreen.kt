package network.buildit.features.social

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import network.buildit.ui.theme.BuildItTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Screen showing a post thread with replies.
 */
@Composable
fun ThreadScreen(
    postId: String,
    viewModel: SocialViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {},
    onNavigateToReply: (postId: String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val posts by viewModel.posts.collectAsState()

    // Find the main post
    val post = posts.find { it.id == postId }

    LaunchedEffect(postId) {
        viewModel.loadReplies(postId)
    }

    ThreadContent(
        post = post,
        isLoading = uiState.loadingReplies,
        onBackClick = onNavigateBack,
        onReplyClick = { onNavigateToReply(postId) },
        onReactClick = { post?.let { viewModel.reactToPost(it.id) } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThreadContent(
    post: Post?,
    isLoading: Boolean,
    onBackClick: () -> Unit,
    onReplyClick: () -> Unit,
    onReactClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Thread") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onReplyClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Reply")
            }
        }
    ) { padding ->
        if (post == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                if (isLoading) {
                    CircularProgressIndicator()
                } else {
                    Text("Post not found")
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                // Main post (expanded)
                item(key = "main") {
                    MainPostCard(
                        post = post,
                        onReactClick = onReactClick
                    )
                }

                // Divider
                item(key = "divider") {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
                    Text(
                        text = "${post.replies.size} ${if (post.replies.size == 1) "Reply" else "Replies"}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                // Replies
                items(post.replies, key = { it.id }) { reply ->
                    ReplyCard(reply = reply)
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Loading indicator
                if (isLoading) {
                    item(key = "loading") {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(strokeWidth = 2.dp)
                        }
                    }
                }

                // Bottom padding for FAB
                item(key = "spacer") {
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }
        }
    }
}

@Composable
private fun MainPostCard(
    post: Post,
    onReactClick: () -> Unit
) {
    Column {
        // Author row
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Avatar
            if (post.authorAvatar != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(post.authorAvatar)
                        .crossfade(true)
                        .build(),
                    contentDescription = "Avatar",
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (post.authorName ?: post.authorPubkey).take(1).uppercase(),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = post.authorName ?: post.authorPubkey.take(12) + "...",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault())
                        .format(Date(post.createdAt * 1000)),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Content
        Text(
            text = post.content,
            style = MaterialTheme.typography.bodyLarge
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Stats and actions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Replies count
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.ChatBubbleOutline,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${post.replyCount}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Reactions
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clip(CircleShape)
            ) {
                IconButton(onClick = onReactClick, modifier = Modifier.size(32.dp)) {
                    Icon(
                        if (post.userReacted) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "React",
                        tint = if (post.userReacted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = "${post.reactionCount}",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (post.userReacted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ReplyCard(reply: Post) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Author row
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Avatar
                if (reply.authorAvatar != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(reply.authorAvatar)
                            .crossfade(true)
                            .build(),
                        contentDescription = "Avatar",
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (reply.authorName ?: reply.authorPubkey).take(1).uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = reply.authorName ?: reply.authorPubkey.take(8) + "...",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                Text(
                    text = formatRelativeTime(reply.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Content
            Text(
                text = reply.content,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis() / 1000
    val diff = now - timestamp

    return when {
        diff < 60 -> "now"
        diff < 3600 -> "${diff / 60}m"
        diff < 86400 -> "${diff / 3600}h"
        diff < 604800 -> "${diff / 86400}d"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(timestamp * 1000))
    }
}

@Preview(showBackground = true)
@Composable
private fun ThreadPreview() {
    BuildItTheme {
        // Preview would need mock data
    }
}
