package network.buildit.features.share

import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SheetState
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import network.buildit.R

/**
 * Share composer screen displayed as a bottom sheet.
 *
 * Allows the user to:
 * - Preview shared content
 * - Select destinations (recent conversations, search contacts)
 * - Add an optional message
 * - Send with encryption
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareComposerScreen(
    viewModel: ShareViewModel = hiltViewModel(),
    onDismiss: () -> Unit,
    onSendComplete: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Handle send completion
    LaunchedEffect(uiState.sendComplete) {
        if (uiState.sendComplete) {
            onSendComplete()
        }
    }

    // Handle errors
    LaunchedEffect(uiState.error) {
        uiState.error?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            ShareTopBar(
                onClose = onDismiss,
                canSend = uiState.selectedDestinations.isNotEmpty() && uiState.sharedContent.hasContent,
                isSending = uiState.isSending,
                onSend = { viewModel.send() }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        ShareComposerContent(
            uiState = uiState,
            modifier = Modifier.padding(padding),
            onSearchQueryChanged = viewModel::updateSearchQuery,
            onDestinationSelected = viewModel::selectDestination,
            onMessageChanged = viewModel::updateMessageText,
            onRemoveMedia = viewModel::removeSharedMedia
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareTopBar(
    onClose: () -> Unit,
    canSend: Boolean,
    isSending: Boolean,
    onSend: () -> Unit
) {
    TopAppBar(
        title = {
            Text(stringResource(R.string.share_title))
        },
        navigationIcon = {
            IconButton(onClick = onClose) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = stringResource(R.string.action_cancel)
                )
            }
        },
        actions = {
            if (isSending) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .size(24.dp)
                        .padding(end = 16.dp),
                    strokeWidth = 2.dp
                )
            } else {
                IconButton(
                    onClick = onSend,
                    enabled = canSend
                ) {
                    Icon(
                        Icons.Default.Send,
                        contentDescription = stringResource(R.string.share_send),
                        tint = if (canSend) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                        }
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShareComposerContent(
    uiState: ShareUiState,
    modifier: Modifier = Modifier,
    onSearchQueryChanged: (String) -> Unit,
    onDestinationSelected: (ShareDestination) -> Unit,
    onMessageChanged: (String) -> Unit,
    onRemoveMedia: (SharedMediaItem) -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Selected destinations chips
        if (uiState.selectedDestinations.isNotEmpty()) {
            SelectedDestinationsSection(
                destinations = uiState.selectedDestinations,
                onRemove = onDestinationSelected
            )

            HorizontalDivider()
        }

        // Shared content preview
        SharedContentPreview(
            content = uiState.sharedContent,
            onRemoveMedia = onRemoveMedia
        )

        HorizontalDivider()

        // Additional message input
        AdditionalMessageInput(
            message = uiState.additionalMessage,
            onMessageChanged = onMessageChanged
        )

        HorizontalDivider()

        // Encryption indicator
        EncryptionIndicator()

        HorizontalDivider()

        // Destination search
        DestinationSearchBar(
            query = uiState.searchQuery,
            onQueryChanged = onSearchQueryChanged
        )

        // Search results or recent destinations
        if (uiState.searchQuery.isNotBlank() && uiState.searchResults.isNotEmpty()) {
            SearchResultsList(
                results = uiState.searchResults,
                selectedIds = uiState.selectedDestinations.map { it.id }.toSet(),
                onSelect = onDestinationSelected
            )
        } else {
            RecentDestinationsSection(
                destinations = uiState.recentDestinations,
                selectedIds = uiState.selectedDestinations.map { it.id }.toSet(),
                onSelect = onDestinationSelected,
                isLoading = uiState.isLoading
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SelectedDestinationsSection(
    destinations: List<ShareDestination>,
    onRemove: (ShareDestination) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = stringResource(R.string.share_sending_to),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            destinations.forEach { destination ->
                FilterChip(
                    selected = true,
                    onClick = { onRemove(destination) },
                    label = { Text(destination.displayName) },
                    leadingIcon = {
                        Icon(
                            when (destination.type) {
                                DestinationType.GROUP -> Icons.Default.Group
                                else -> Icons.Default.Person
                            },
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    },
                    trailingIcon = {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = stringResource(R.string.action_delete),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun SharedContentPreview(
    content: SharedContent,
    onRemoveMedia: (SharedMediaItem) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = stringResource(R.string.share_content_preview),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Text preview
        content.subject?.let { subject ->
            if (subject.isNotBlank()) {
                Text(
                    text = subject,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        }

        content.text?.let { text ->
            if (text.isNotBlank()) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = text,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier
                            .padding(12.dp)
                            .heightIn(max = 120.dp),
                        maxLines = 6,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        // Media previews
        if (content.mediaItems.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(content.mediaItems) { item ->
                    MediaItemPreview(
                        item = item,
                        onRemove = { onRemoveMedia(item) }
                    )
                }
            }
        }
    }
}

@Composable
private fun MediaItemPreview(
    item: SharedMediaItem,
    onRemove: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(80.dp)
            .clip(RoundedCornerShape(8.dp))
    ) {
        when (item.type) {
            SharedMediaType.IMAGE -> {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(item.uri)
                        .crossfade(true)
                        .build(),
                    contentDescription = item.fileName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }
            else -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        getMediaTypeIcon(item.type),
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Remove button
        IconButton(
            onClick = onRemove,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(24.dp)
                .background(
                    MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                    CircleShape
                )
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = stringResource(R.string.action_delete),
                modifier = Modifier.size(16.dp)
            )
        }

        // File name overlay for non-images
        if (item.type != SharedMediaType.IMAGE && item.fileName != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)
                    )
                    .padding(4.dp)
            ) {
                Text(
                    text = item.fileName,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun getMediaTypeIcon(type: SharedMediaType): ImageVector {
    return when (type) {
        SharedMediaType.IMAGE -> Icons.Default.Image
        SharedMediaType.VIDEO -> Icons.Default.Videocam
        SharedMediaType.AUDIO -> Icons.Default.MusicNote
        SharedMediaType.FILE -> Icons.Default.Description
    }
}

@Composable
private fun AdditionalMessageInput(
    message: String,
    onMessageChanged: (String) -> Unit
) {
    OutlinedTextField(
        value = message,
        onValueChange = onMessageChanged,
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        placeholder = {
            Text(stringResource(R.string.share_add_message_placeholder))
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = Color.Transparent
        ),
        shape = RoundedCornerShape(12.dp),
        minLines = 2,
        maxLines = 4
    )
}

@Composable
private fun EncryptionIndicator() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = stringResource(R.string.share_encrypted_message),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun DestinationSearchBar(
    query: String,
    onQueryChanged: (String) -> Unit
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChanged,
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        placeholder = {
            Text(stringResource(R.string.share_search_contacts_placeholder))
        },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChanged("") }) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = stringResource(R.string.action_cancel),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent
        ),
        shape = RoundedCornerShape(24.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search)
    )
}

@Composable
private fun RecentDestinationsSection(
    destinations: List<ShareDestination>,
    selectedIds: Set<String>,
    onSelect: (ShareDestination) -> Unit,
    isLoading: Boolean
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.share_recent_conversations),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (destinations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stringResource(R.string.share_no_recent_conversations),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            destinations.forEach { destination ->
                DestinationListItem(
                    destination = destination,
                    isSelected = destination.id in selectedIds,
                    onSelect = { onSelect(destination) }
                )
            }
        }
    }
}

@Composable
private fun SearchResultsList(
    results: List<ShareDestination>,
    selectedIds: Set<String>,
    onSelect: (ShareDestination) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.share_search_results),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        if (results.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stringResource(R.string.share_no_results),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            results.forEach { destination ->
                DestinationListItem(
                    destination = destination,
                    isSelected = destination.id in selectedIds,
                    onSelect = { onSelect(destination) }
                )
            }
        }
    }
}

@Composable
private fun DestinationListItem(
    destination: ShareDestination,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    ListItem(
        modifier = Modifier
            .clickable(onClick = onSelect)
            .then(
                if (isSelected) {
                    Modifier.background(
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                    )
                } else {
                    Modifier
                }
            ),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.secondaryContainer
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (destination.avatarUrl != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(destination.avatarUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = destination.displayName,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        when (destination.type) {
                            DestinationType.GROUP -> Icons.Default.Group
                            else -> Icons.Default.Person
                        },
                        contentDescription = null,
                        tint = if (isSelected) {
                            MaterialTheme.colorScheme.onPrimary
                        } else {
                            MaterialTheme.colorScheme.onSecondaryContainer
                        }
                    )
                }
            }
        },
        headlineContent = {
            Text(
                text = destination.displayName,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        supportingContent = {
            Text(
                text = when (destination.type) {
                    DestinationType.GROUP -> stringResource(R.string.share_destination_group)
                    DestinationType.DIRECT -> stringResource(R.string.share_destination_dm)
                    DestinationType.CONTACT -> stringResource(R.string.share_destination_contact)
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingContent = {
            AnimatedVisibility(
                visible = isSelected,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    )
}
