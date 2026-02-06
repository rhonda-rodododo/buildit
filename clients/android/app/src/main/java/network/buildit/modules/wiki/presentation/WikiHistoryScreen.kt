package network.buildit.modules.wiki.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.wiki.data.local.EditType
import network.buildit.modules.wiki.data.local.PageRevisionEntity
import java.text.SimpleDateFormat
import java.util.*

/**
 * Standalone revision history screen for a wiki page.
 *
 * Features:
 * - Chronological list of all revisions
 * - Edit type badges (create, edit, revert, merge, move)
 * - Diff viewer for comparing revisions
 * - Revert action for page admins
 * - Version comparison selection
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiHistoryScreen(
    pageId: String,
    onBackClick: () -> Unit,
    onRevisionClick: (String) -> Unit, // Navigate to view specific revision
    viewModel: WikiPageViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedRevisionId by remember { mutableStateOf<String?>(null) }
    var showDiffDialog by remember { mutableStateOf(false) }
    var compareFromVersion by remember { mutableStateOf<Int?>(null) }
    var compareToVersion by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(pageId) {
        viewModel.loadPage(pageId)
        viewModel.loadRevisions(pageId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Revision History")
                        uiState.page?.let { page ->
                            Text(
                                text = page.title,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.revisions.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.History,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No revision history",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Summary card
                    item {
                        RevisionSummaryCard(
                            totalRevisions = uiState.revisions.size,
                            currentVersion = uiState.page?.version ?: 1
                        )
                    }

                    // Revision list
                    items(uiState.revisions.sortedByDescending { it.version }) { revision ->
                        RevisionHistoryCard(
                            revision = revision,
                            isSelected = revision.id == selectedRevisionId,
                            isCurrent = revision.version == uiState.page?.version,
                            onClick = {
                                selectedRevisionId = revision.id
                                onRevisionClick(revision.id)
                            },
                            onCompare = {
                                if (compareFromVersion == null) {
                                    compareFromVersion = revision.version
                                } else {
                                    compareToVersion = revision.version
                                    showDiffDialog = true
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    // Diff comparison dialog
    if (showDiffDialog && compareFromVersion != null && compareToVersion != null) {
        DiffComparisonDialog(
            fromVersion = compareFromVersion!!,
            toVersion = compareToVersion!!,
            revisions = uiState.revisions,
            onDismiss = {
                showDiffDialog = false
                compareFromVersion = null
                compareToVersion = null
            }
        )
    }
}

@Composable
private fun RevisionSummaryCard(
    totalRevisions: Int,
    currentVersion: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = currentVersion.toString(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "Current Version",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = totalRevisions.toString(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "Total Revisions",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun RevisionHistoryCard(
    revision: PageRevisionEntity,
    isSelected: Boolean,
    isCurrent: Boolean,
    onClick: () -> Unit,
    onCompare: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = when {
                isSelected -> MaterialTheme.colorScheme.secondaryContainer
                isCurrent -> MaterialTheme.colorScheme.surfaceVariant
                else -> MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header row with version and badges
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "v${revision.version}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (isCurrent) {
                        AssistChip(
                            onClick = {},
                            label = { Text("Current", style = MaterialTheme.typography.labelSmall) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            ),
                            modifier = Modifier.height(24.dp)
                        )
                    }
                    EditTypeBadge(editType = revision.editType)
                }

                IconButton(
                    onClick = onCompare,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Compare,
                        contentDescription = "Compare",
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            // Summary
            revision.summary?.let { summary ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Footer with author and date
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = revision.editedBy.take(8) + "...",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = formatRevisionDate(revision.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Revert info
            if (revision.editType == EditType.REVERT && revision.revertedFrom != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Reverted from v${revision.revertedFrom}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }
        }
    }
}

@Composable
private fun EditTypeBadge(editType: EditType) {
    val (color, icon) = when (editType) {
        EditType.CREATE -> Pair(
            MaterialTheme.colorScheme.primary,
            Icons.Default.Add
        )
        EditType.EDIT -> Pair(
            MaterialTheme.colorScheme.secondary,
            Icons.Default.Edit
        )
        EditType.REVERT -> Pair(
            MaterialTheme.colorScheme.tertiary,
            Icons.Default.Undo
        )
        EditType.MERGE -> Pair(
            MaterialTheme.colorScheme.secondary,
            Icons.Default.Merge
        )
        EditType.MOVE -> Pair(
            MaterialTheme.colorScheme.secondary,
            Icons.Default.DriveFileMove
        )
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.extraSmall
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(12.dp),
                tint = color
            )
            Text(
                text = editType.name.lowercase().replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}

/**
 * Dialog showing a side-by-side diff between two revisions.
 */
@Composable
private fun DiffComparisonDialog(
    fromVersion: Int,
    toVersion: Int,
    revisions: List<PageRevisionEntity>,
    onDismiss: () -> Unit
) {
    val fromRevision = revisions.find { it.version == fromVersion }
    val toRevision = revisions.find { it.version == toVersion }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Compare v$fromVersion to v$toVersion")
        },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 400.dp)
            ) {
                if (fromRevision != null && toRevision != null) {
                    // Show diff summary
                    Text(
                        text = "Title changes:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (fromRevision.title != toRevision.title) {
                        Text(
                            text = "- ${fromRevision.title}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = "+ ${toRevision.title}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    } else {
                        Text(
                            text = "(no change)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Content diff:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )

                    // Show the diff if available
                    toRevision.diff?.let { diff ->
                        Text(
                            text = diff,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    } ?: Text(
                        text = "No diff available. Content length: ${fromRevision.content.length} -> ${toRevision.content.length} chars",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = "Could not load revisions for comparison",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

private fun formatRevisionDate(timestamp: Long): String {
    val adjustedTimestamp = if (timestamp < 10_000_000_000L) timestamp * 1000 else timestamp
    val formatter = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault())
    return formatter.format(Date(adjustedTimestamp))
}
