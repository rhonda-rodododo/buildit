package network.buildit.features.social

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import android.net.Uri
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import network.buildit.generated.schemas.content.LinkPreview
import network.buildit.modules.content.services.LinkPreviewService
import network.buildit.ui.components.LinkPreviewStrip
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
    var linkPreviews by remember { mutableStateOf<List<LinkPreview>>(emptyList()) }
    var isGeneratingPreviews by remember { mutableStateOf(false) }
    val linkPreviewService = remember { LinkPreviewService() }
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        selectedImageUri = uri
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    // Debounced URL detection and preview generation
    LaunchedEffect(content) {
        delay(500) // Debounce
        val urls = LinkPreviewService.extractUrls(content)
        if (urls.isNotEmpty()) {
            val existingUrls = linkPreviews.map { it.url }.toSet()
            val newUrls = urls.filter { it !in existingUrls }
            if (newUrls.isNotEmpty()) {
                isGeneratingPreviews = true
                val newPreviews = linkPreviewService.generatePreviews(newUrls)
                linkPreviews = (linkPreviews + newPreviews).distinctBy { it.url }
                isGeneratingPreviews = false
            }
            // Remove previews for URLs no longer in the text
            linkPreviews = linkPreviews.filter { it.url in urls.toSet() }
        } else {
            linkPreviews = emptyList()
        }
    }

    PostComposerContent(
        content = content,
        onContentChange = { content = it },
        isPosting = uiState.isPosting,
        isReply = replyToPostId != null,
        linkPreviews = linkPreviews,
        isGeneratingPreviews = isGeneratingPreviews,
        onRemovePreview = { url -> linkPreviews = linkPreviews.filter { it.url != url } },
        selectedImageUri = selectedImageUri,
        onImagePickerClick = {
            photoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        },
        onRemoveImage = { selectedImageUri = null },
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
    linkPreviews: List<LinkPreview> = emptyList(),
    isGeneratingPreviews: Boolean = false,
    onRemovePreview: (String) -> Unit = {},
    selectedImageUri: Uri? = null,
    onImagePickerClick: () -> Unit = {},
    onRemoveImage: () -> Unit = {},
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
                            enabled = (content.isNotBlank() || selectedImageUri != null) && content.length <= maxLength,
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

            // Image preview
            if (selectedImageUri != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Box {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(selectedImageUri)
                            .crossfade(true)
                            .build(),
                        contentDescription = "Selected image",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Crop
                    )
                    IconButton(
                        onClick = onRemoveImage,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Image,
                            contentDescription = "Remove image",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Link previews
            if (linkPreviews.isNotEmpty() || isGeneratingPreviews) {
                Spacer(modifier = Modifier.height(8.dp))
                LinkPreviewStrip(
                    previews = linkPreviews,
                    isLoading = isGeneratingPreviews,
                    onRemove = onRemovePreview
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Bottom toolbar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row {
                    IconButton(onClick = onImagePickerClick) {
                        Icon(
                            Icons.Default.Image,
                            contentDescription = "Add Image",
                            tint = if (selectedImageUri != null) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
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
