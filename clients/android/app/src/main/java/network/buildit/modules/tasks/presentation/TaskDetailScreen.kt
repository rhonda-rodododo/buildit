package network.buildit.modules.tasks.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.tasks.data.local.TaskEntity
import network.buildit.modules.tasks.data.local.TaskPriority
import network.buildit.modules.tasks.data.local.TaskStatus
import java.text.SimpleDateFormat
import java.util.*

/**
 * Task detail screen showing full task information with subtasks.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    taskId: String,
    onBackClick: () -> Unit,
    onSubtaskClick: (String) -> Unit,
    viewModel: TasksViewModel = hiltViewModel()
) {
    val detailState by viewModel.detailState.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showStatusMenu by remember { mutableStateOf(false) }

    LaunchedEffect(taskId) {
        viewModel.loadTaskDetail(taskId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Task Details") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showDeleteConfirm = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (detailState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (detailState.error != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = detailState.error ?: "Unknown error",
                    color = MaterialTheme.colorScheme.error
                )
            }
        } else {
            detailState.task?.let { task ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Title and status
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = task.title,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            textDecoration = if (task.status == TaskStatus.Done) TextDecoration.LineThrough else null
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Status selector
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Status:",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Box {
                                AssistChip(
                                    onClick = { showStatusMenu = true },
                                    label = { Text(task.status.displayName()) },
                                    leadingIcon = {
                                        Icon(
                                            when (task.status) {
                                                TaskStatus.Todo -> Icons.Default.RadioButtonUnchecked
                                                TaskStatus.InProgress -> Icons.Default.Pending
                                                TaskStatus.Done -> Icons.Default.CheckCircle
                                                TaskStatus.Cancelled -> Icons.Default.Cancel
                                            },
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                )

                                DropdownMenu(
                                    expanded = showStatusMenu,
                                    onDismissRequest = { showStatusMenu = false }
                                ) {
                                    TaskStatus.entries.forEach { status ->
                                        DropdownMenuItem(
                                            text = { Text(status.displayName()) },
                                            onClick = {
                                                viewModel.updateTaskStatus(task.id, status)
                                                showStatusMenu = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider()

                    // Description
                    task.description?.let { description ->
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Description",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = description,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        HorizontalDivider()
                    }

                    // Details section
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Details",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        // Priority
                        DetailRow(
                            icon = Icons.Default.Flag,
                            label = "Priority",
                            value = task.priority.name.lowercase().replaceFirstChar { it.uppercase() },
                            valueColor = when (task.priority) {
                                TaskPriority.Low -> MaterialTheme.colorScheme.onSurfaceVariant
                                TaskPriority.Medium -> Color(0xFF4CAF50)
                                TaskPriority.High -> Color(0xFFFF9800)
                                TaskPriority.Urgent -> Color(0xFFF44336)
                            }
                        )

                        // Due date
                        task.dueDate?.let { dueDate ->
                            val formatter = SimpleDateFormat("EEEE, MMM d, yyyy", Locale.getDefault())
                            val now = System.currentTimeMillis() / 1000
                            val isOverdue = dueDate < now && task.status != TaskStatus.Done

                            DetailRow(
                                icon = Icons.Default.CalendarToday,
                                label = "Due Date",
                                value = formatter.format(Date(dueDate * 1000)),
                                valueColor = if (isOverdue) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.onSurface
                            )
                        }

                        // Assignee
                        DetailRow(
                            icon = Icons.Default.Person,
                            label = "Assignee",
                            value = task.assigneePubkey?.take(8)?.let { "$it..." } ?: "Unassigned"
                        )

                        // Created
                        val createdFormatter = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault())
                        DetailRow(
                            icon = Icons.Default.AccessTime,
                            label = "Created",
                            value = createdFormatter.format(Date(task.createdAt * 1000))
                        )

                        // Completed
                        task.completedAt?.let { completedAt ->
                            DetailRow(
                                icon = Icons.Default.Done,
                                label = "Completed",
                                value = createdFormatter.format(Date(completedAt * 1000))
                            )
                        }
                    }

                    // Subtasks section
                    if (detailState.subtasks.isNotEmpty()) {
                        HorizontalDivider()
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Subtasks (${detailState.subtasks.size})",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(8.dp))

                            detailState.subtasks.forEach { subtask ->
                                SubtaskRow(
                                    subtask = subtask,
                                    onClick = { onSubtaskClick(subtask.id) },
                                    onStatusChange = { status ->
                                        viewModel.updateTaskStatus(subtask.id, status)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Task") },
            text = { Text("Are you sure you want to delete this task? This action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteTask(taskId)
                    showDeleteConfirm = false
                    onBackClick()
                }) {
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

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(80.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = valueColor,
            fontWeight = FontWeight.Medium
        )
    }
}

private fun TaskStatus.displayName(): String = when (this) {
    TaskStatus.Todo -> "To Do"
    TaskStatus.InProgress -> "In Progress"
    TaskStatus.Done -> "Done"
    TaskStatus.Cancelled -> "Cancelled"
}

@Composable
private fun SubtaskRow(
    subtask: TaskEntity,
    onClick: () -> Unit,
    onStatusChange: (TaskStatus) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = subtask.status == TaskStatus.Done,
            onCheckedChange = { checked ->
                onStatusChange(if (checked) TaskStatus.Done else TaskStatus.Todo)
            }
        )
        Text(
            text = subtask.title,
            style = MaterialTheme.typography.bodyMedium,
            textDecoration = if (subtask.status == TaskStatus.Done) TextDecoration.LineThrough else null,
            modifier = Modifier
                .weight(1f)
                .clickable(onClick = onClick)
        )
    }
}
