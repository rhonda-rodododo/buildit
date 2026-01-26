package network.buildit.features.social

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.ui.theme.BuildItTheme

/**
 * Screen for composing a new post or reply.
 */
@Composable
fun PostComposerScreen(
    viewModel: SocialViewModel = hiltViewModel(),
    replyToPostId: String? = null,
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var content by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    PostComposerContent(
        content = content,
        onContentChange = { content = it },
        isPosting = uiState.isPosting,
        isReply = replyToPostId != null,
        onBackClick = onNavigateBack,
        onPostClick = {
            if (replyToPostId != null) {
                viewModel.replyToPost(replyToPostId, content)
            } else {
                viewModel.createPost(content)
            }
            onNavigateBack()
        },
        focusRequester = focusRequester
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostComposerContent(
    content: String,
    onContentChange: (String) -> Unit,
    isPosting: Boolean,
    isReply: Boolean,
    onBackClick: () -> Unit,
    onPostClick: () -> Unit,
    focusRequester: FocusRequester
) {
    val maxLength = 1000

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isReply) "Reply" else "New Post") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (isPosting) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(end = 16.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Button(
                            onClick = onPostClick,
                            enabled = content.isNotBlank() && content.length <= maxLength,
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = null,
                                modifier = Modifier.padding(end = 4.dp)
                            )
                            Text(if (isReply) "Reply" else "Post")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            OutlinedTextField(
                value = content,
                onValueChange = { if (it.length <= maxLength) onContentChange(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .focusRequester(focusRequester),
                placeholder = {
                    Text(
                        if (isReply) "Write your reply..." else "What's happening?"
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.surface,
                    unfocusedBorderColor = MaterialTheme.colorScheme.surface
                ),
                textStyle = MaterialTheme.typography.bodyLarge
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Bottom toolbar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row {
                    IconButton(onClick = { /* TODO: Add image */ }) {
                        Icon(
                            Icons.Default.Image,
                            contentDescription = "Add Image",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                // Character count
                Text(
                    text = "${content.length}/$maxLength",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (content.length > maxLength * 0.9) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun PostComposerPreview() {
    BuildItTheme {
        PostComposerContent(
            content = "",
            onContentChange = {},
            isPosting = false,
            isReply = false,
            onBackClick = {},
            onPostClick = {},
            focusRequester = remember { FocusRequester() }
        )
    }
}
