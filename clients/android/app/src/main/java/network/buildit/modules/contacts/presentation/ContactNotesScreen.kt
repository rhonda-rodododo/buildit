package network.buildit.modules.contacts.presentation

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.contacts.data.local.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Screen for viewing and managing notes for a contact.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactNotesScreen(
    contactPubkey: String,
    contactDisplayName: String?,
    onBackClick: () -> Unit,
    viewModel: ContactNotesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddNote by remember { mutableStateOf(false) }
    var editingNote by remember { mutableStateOf<ContactNoteEntity?>(null) }

    LaunchedEffect(contactPubkey) {
        viewModel.loadNotes(contactPubkey)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notes") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showAddNote = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Note")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (uiState.notes.isEmpty()) {
            EmptyNotesView(
                contactName = contactDisplayName ?: "this contact",
                onAddClick = { showAddNote = true },
                modifier = Modifier.padding(paddingValues)
            )
        } else {
            LazyColumn(
                modifier = Modifier.padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.notes, key = { it.id }) { note ->
                    NoteCard(
                        note = note,
                        onClick = { editingNote = note },
                        onDelete = { viewModel.deleteNote(note.id) }
                    )
                }
            }
        }
    }

    // Add note dialog
    if (showAddNote) {
        NoteEditorDialog(
            onDismiss = { showAddNote = false },
            onSave = { content, category ->
                viewModel.createNote(content, category)
                showAddNote = false
            }
        )
    }

    // Edit note dialog
    editingNote?.let { note ->
        NoteEditorDialog(
            existingNote = note,
            onDismiss = { editingNote = null },
            onSave = { content, category ->
                viewModel.updateNote(note, content, category)
                editingNote = null
            }
        )
    }
}

@Composable
private fun EmptyNotesView(
    contactName: String,
    onAddClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.Notes,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Text(
                text = "No notes yet",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Add notes to track conversations and follow-ups with $contactName",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 32.dp)
            )
            Button(onClick = onAddClick) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Note")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteCard(
    note: ContactNoteEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                AssistChip(
                    onClick = { },
                    label = { Text(note.category.displayName) },
                    leadingIcon = {
                        Icon(
                            getCategoryIcon(note.category),
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    modifier = Modifier.height(28.dp)
                )

                IconButton(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = note.content,
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = formatRelativeTime(note.updatedAt ?: note.createdAt),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Note") },
            text = { Text("Are you sure you want to delete this note?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDelete()
                        showDeleteConfirm = false
                    }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteEditorDialog(
    existingNote: ContactNoteEntity? = null,
    onDismiss: () -> Unit,
    onSave: (String, NoteCategory) -> Unit
) {
    var content by remember { mutableStateOf(existingNote?.content ?: "") }
    var category by remember { mutableStateOf(existingNote?.category ?: NoteCategory.GENERAL) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existingNote != null) "Edit Note" else "New Note") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("Note") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp),
                    maxLines = 6
                )

                Text(
                    text = "Category",
                    style = MaterialTheme.typography.labelMedium
                )

                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(NoteCategory.entries) { cat ->
                        FilterChip(
                            selected = category == cat,
                            onClick = { category = cat },
                            label = { Text(cat.displayName) },
                            leadingIcon = if (category == cat) {
                                {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            } else null
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(content.trim(), category) },
                enabled = content.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Screen for managing tags assigned to a contact.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactTagsScreen(
    contactPubkey: String,
    onBackClick: () -> Unit,
    viewModel: ContactTagsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showCreateTag by remember { mutableStateOf(false) }

    LaunchedEffect(contactPubkey) {
        viewModel.loadTags(contactPubkey)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tags") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier.padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(uiState.allTags, key = { it.id }) { tag ->
                TagSelectionRow(
                    tag = tag,
                    isSelected = tag.id in uiState.assignedTagIds,
                    onToggle = { viewModel.toggleTag(tag.id) }
                )
            }

            item {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { showCreateTag = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Create New Tag")
                }
            }
        }
    }

    if (showCreateTag) {
        TagEditorDialog(
            onDismiss = { showCreateTag = false },
            onSave = { name, color ->
                viewModel.createTag(name, color)
                showCreateTag = false
            }
        )
    }
}

@Composable
private fun TagSelectionRow(
    tag: ContactTagEntity,
    isSelected: Boolean,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = parseColor(tag.color),
                modifier = Modifier.size(16.dp)
            ) { }

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = tag.name,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f)
            )

            if (isSelected) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TagEditorDialog(
    existingTag: ContactTagEntity? = null,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit
) {
    var name by remember { mutableStateOf(existingTag?.name ?: "") }
    var selectedColor by remember { mutableStateOf(existingTag?.color ?: "#3B82F6") }

    val colorOptions = listOf(
        "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
        "#8B5CF6", "#EC4899", "#06B6D4", "#14B8A6",
        "#6B7280", "#DC2626", "#D97706", "#059669"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existingTag != null) "Edit Tag" else "New Tag") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tag Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Color",
                    style = MaterialTheme.typography.labelMedium
                )

                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(colorOptions) { color ->
                        ColorPickerButton(
                            color = color,
                            isSelected = selectedColor == color,
                            onSelect = { selectedColor = color }
                        )
                    }
                }

                // Preview
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                ) {
                    Text(
                        text = "Preview: ",
                        style = MaterialTheme.typography.labelMedium
                    )
                    TagChip(
                        name = name.ifBlank { "Tag" },
                        color = selectedColor
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), selectedColor) },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun ColorPickerButton(
    color: String,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = parseColor(color),
        modifier = Modifier
            .size(36.dp)
            .clickable(onClick = onSelect),
        border = if (isSelected) {
            ButtonDefaults.outlinedButtonBorder
        } else null
    ) {
        if (isSelected) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun TagChip(
    name: String,
    color: String,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Surface(
                shape = MaterialTheme.shapes.extraSmall,
                color = parseColor(color),
                modifier = Modifier.size(8.dp)
            ) { }
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = name,
                style = MaterialTheme.typography.labelMedium
            )
        }
    }
}

@Composable
fun TagChipsRow(
    tags: List<ContactTagEntity>,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        items(tags) { tag ->
            TagChip(name = tag.name, color = tag.color)
        }
    }
}

// Helper functions

private fun getCategoryIcon(category: NoteCategory) = when (category) {
    NoteCategory.GENERAL -> Icons.Default.Notes
    NoteCategory.MEETING -> Icons.Default.People
    NoteCategory.FOLLOW_UP -> Icons.Default.ArrowForward
    NoteCategory.CONCERN -> Icons.Default.Warning
    NoteCategory.POSITIVE -> Icons.Default.Star
    NoteCategory.TASK -> Icons.Default.Checklist
}

private fun parseColor(hex: String): Color {
    return try {
        Color(android.graphics.Color.parseColor(hex))
    } catch (e: Exception) {
        Color.Blue
    }
}

private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> "Just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        diff < 604800_000 -> "${diff / 86400_000}d ago"
        else -> {
            val formatter = SimpleDateFormat("MMM d", Locale.getDefault())
            formatter.format(Date(timestamp))
        }
    }
}
