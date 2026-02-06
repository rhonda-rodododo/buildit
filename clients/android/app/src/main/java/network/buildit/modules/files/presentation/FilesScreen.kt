package network.buildit.modules.files.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.files.data.local.FileEntity
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main files screen with folder navigation and search.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilesScreen(
    groupId: String,
    onFileClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: FilesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showCreateFolderDialog by remember { mutableStateOf(false) }

    LaunchedEffect(groupId) {
        viewModel.loadFiles(groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Files") },
                navigationIcon = {
                    IconButton(onClick = {
                        if (uiState.currentFolderId != null) {
                            viewModel.navigateUp()
                        } else {
                            onBackClick()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            Column {
                SmallFloatingActionButton(onClick = { showCreateFolderDialog = true }) {
                    Icon(Icons.Default.CreateNewFolder, contentDescription = "New folder")
                }
                Spacer(modifier = Modifier.height(8.dp))
                FloatingActionButton(onClick = { /* File upload handled externally */ }) {
                    Icon(Icons.Default.Upload, contentDescription = "Upload file")
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.search(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search files...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (uiState.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.search("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true
            )

            // Breadcrumbs
            if (uiState.breadcrumbs.size > 1 && uiState.searchQuery.isEmpty()) {
                BreadcrumbBar(
                    breadcrumbs = uiState.breadcrumbs,
                    onBreadcrumbClick = { item ->
                        if (item.id == null) {
                            viewModel.loadFiles(groupId)
                        } else {
                            viewModel.openFolder(item.id)
                        }
                    }
                )
            }

            // Storage info
            if (uiState.searchQuery.isEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${uiState.fileCount} files",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatSize(uiState.totalSize),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Content
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                val displayFiles = if (uiState.searchQuery.isNotEmpty()) {
                    uiState.searchResults
                } else {
                    uiState.files
                }

                if (displayFiles.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                if (uiState.searchQuery.isNotEmpty()) Icons.Default.SearchOff
                                else Icons.Default.FolderOpen,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = if (uiState.searchQuery.isNotEmpty()) "No matching files"
                                else "No files yet",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    FileList(
                        files = displayFiles,
                        onFileClick = { file ->
                            if (file.isFolder) {
                                viewModel.openFolder(file.id)
                            } else {
                                onFileClick(file.id)
                            }
                        },
                        onDeleteClick = { viewModel.deleteFile(it.id) }
                    )
                }
            }
        }
    }

    if (showCreateFolderDialog) {
        CreateFolderDialog(
            onDismiss = { showCreateFolderDialog = false },
            onCreate = { name ->
                viewModel.createFolder(name)
                showCreateFolderDialog = false
            }
        )
    }
}

@Composable
private fun BreadcrumbBar(
    breadcrumbs: List<BreadcrumbItem>,
    onBreadcrumbClick: (BreadcrumbItem) -> Unit
) {
    LazyRow(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        items(breadcrumbs) { crumb ->
            TextButton(
                onClick = { onBreadcrumbClick(crumb) },
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
            ) {
                Text(
                    text = crumb.name,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (crumb == breadcrumbs.last()) FontWeight.Bold else FontWeight.Normal
                )
            }
            if (crumb != breadcrumbs.last()) {
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun FileList(
    files: List<FileEntity>,
    onFileClick: (FileEntity) -> Unit,
    onDeleteClick: (FileEntity) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items(files, key = { it.id }) { file ->
            FileRow(
                file = file,
                onClick = { onFileClick(file) },
                onDeleteClick = { onDeleteClick(file) }
            )
        }
    }
}

@Composable
private fun FileRow(
    file: FileEntity,
    onClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    ListItem(
        headlineContent = {
            Text(
                text = file.name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = if (file.isFolder) FontWeight.Medium else FontWeight.Normal
            )
        },
        supportingContent = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!file.isFolder) {
                    Text(
                        text = file.formattedSize,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
                Text(
                    text = formatter.format(Date(file.createdAt * 1000)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        leadingContent = {
            Icon(
                imageVector = if (file.isFolder) Icons.Default.Folder
                else fileIcon(file.mimeType),
                contentDescription = null,
                tint = if (file.isFolder) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingContent = {
            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "More options")
                }
                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Delete") },
                        onClick = {
                            showMenu = false
                            onDeleteClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Delete, contentDescription = null)
                        }
                    )
                }
            }
        },
        modifier = Modifier.clickable(onClick = onClick)
    )
}

@Composable
private fun CreateFolderDialog(
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Folder") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = {
                    name = it
                    nameError = false
                },
                label = { Text("Folder name") },
                singleLine = true,
                isError = nameError,
                supportingText = if (nameError) {
                    { Text("Name is required") }
                } else null
            )
        },
        confirmButton = {
            Button(onClick = {
                if (name.isBlank()) {
                    nameError = true
                    return@Button
                }
                onCreate(name.trim())
            }) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

private fun fileIcon(mimeType: String?) = when {
    mimeType == null -> Icons.Default.InsertDriveFile
    mimeType.startsWith("image/") -> Icons.Default.Image
    mimeType.startsWith("video/") -> Icons.Default.VideoFile
    mimeType.startsWith("audio/") -> Icons.Default.AudioFile
    mimeType == "application/pdf" -> Icons.Default.PictureAsPdf
    else -> Icons.Default.InsertDriveFile
}

private fun formatSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${bytes / (1024 * 1024 * 1024)} GB"
    }
}
