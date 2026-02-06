package network.buildit.modules.tasks.presentation

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.tasks.data.local.TaskEntity
import network.buildit.modules.tasks.data.local.TaskPriority
import network.buildit.modules.tasks.data.local.TaskStatus
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main tasks list screen with list/board view toggle.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    groupId: String,
    onTaskClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: TasksViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }

    LaunchedEffect(groupId) {
        viewModel.loadTasks(groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.toggleViewMode() }) {
                        Icon(
                            if (uiState.viewMode == TaskViewMode.LIST) Icons.Default.ViewColumn
                            else Icons.Default.ViewList,
                            contentDescription = "Toggle view"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Create task")
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
                placeholder = { Text("Search tasks...") },
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

            // Status filter chips
            StatusFilterChips(
                selectedStatus = uiState.selectedStatus,
                taskCounts = uiState.taskCounts,
                onStatusSelected = { viewModel.filterByStatus(it) }
            )

            // Content
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (uiState.filteredTasks.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (uiState.searchQuery.isNotEmpty()) "No matching tasks"
                            else "No tasks yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                when (uiState.viewMode) {
                    TaskViewMode.LIST -> TaskListView(
                        tasks = uiState.filteredTasks,
                        onTaskClick = onTaskClick,
                        onStatusChange = { taskId, status -> viewModel.updateTaskStatus(taskId, status) }
                    )
                    TaskViewMode.BOARD -> TaskBoardView(
                        tasks = uiState.filteredTasks,
                        onTaskClick = onTaskClick,
                        onStatusChange = { taskId, status -> viewModel.updateTaskStatus(taskId, status) }
                    )
                }
            }
        }
    }

    if (showCreateDialog) {
        TaskCreateDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { title, description, assignee, dueDate, priority ->
                viewModel.createTask(title, description, assignee, dueDate, priority)
                showCreateDialog = false
            }
        )
    }
}

@Composable
private fun StatusFilterChips(
    selectedStatus: TaskStatus?,
    taskCounts: Map<TaskStatus, Int>,
    onStatusSelected: (TaskStatus?) -> Unit
) {
    LazyRow(
        modifier = Modifier.padding(vertical = 4.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = selectedStatus == null,
                onClick = { onStatusSelected(null) },
                label = { Text("All") }
            )
        }
        items(TaskStatus.entries.toList()) { status ->
            val count = taskCounts[status] ?: 0
            FilterChip(
                selected = selectedStatus == status,
                onClick = { onStatusSelected(if (selectedStatus == status) null else status) },
                label = { Text("${status.displayLabel()} ($count)") },
                leadingIcon = {
                    Icon(
                        status.icon(),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                }
            )
        }
    }
}

@Composable
private fun TaskListView(
    tasks: List<TaskEntity>,
    onTaskClick: (String) -> Unit,
    onStatusChange: (String, TaskStatus) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(tasks, key = { it.id }) { task ->
            TaskCard(
                task = task,
                onClick = { onTaskClick(task.id) },
                onStatusChange = { status -> onStatusChange(task.id, status) }
            )
        }
    }
}

@Composable
private fun TaskBoardView(
    tasks: List<TaskEntity>,
    onTaskClick: (String) -> Unit,
    onStatusChange: (String, TaskStatus) -> Unit
) {
    val groupedTasks = tasks.groupBy { it.status }

    LazyRow(
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(listOf(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE)) { status ->
            BoardColumn(
                status = status,
                tasks = groupedTasks[status] ?: emptyList(),
                onTaskClick = onTaskClick,
                onStatusChange = onStatusChange
            )
        }
    }
}

@Composable
private fun BoardColumn(
    status: TaskStatus,
    tasks: List<TaskEntity>,
    onTaskClick: (String) -> Unit,
    onStatusChange: (String, TaskStatus) -> Unit
) {
    Card(
        modifier = Modifier
            .width(280.dp)
            .fillMaxHeight(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = status.displayLabel(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Badge { Text("${tasks.size}") }
            }

            Spacer(modifier = Modifier.height(12.dp))

            tasks.forEach { task ->
                TaskCard(
                    task = task,
                    onClick = { onTaskClick(task.id) },
                    onStatusChange = { newStatus -> onStatusChange(task.id, newStatus) },
                    compact = true
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun TaskCard(
    task: TaskEntity,
    onClick: () -> Unit,
    onStatusChange: (TaskStatus) -> Unit,
    compact: Boolean = false
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Status checkbox
            Checkbox(
                checked = task.status == TaskStatus.DONE,
                onCheckedChange = { checked ->
                    onStatusChange(
                        if (checked) TaskStatus.DONE else TaskStatus.TODO
                    )
                }
            )

            Spacer(modifier = Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    textDecoration = if (task.status == TaskStatus.DONE) TextDecoration.LineThrough else null,
                    maxLines = if (compact) 2 else Int.MAX_VALUE,
                    overflow = TextOverflow.Ellipsis
                )

                if (!compact && task.description != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = task.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Priority badge
                    PriorityBadge(priority = task.priority)

                    // Due date
                    task.dueDate?.let { dueDate ->
                        DueDateBadge(dueDate = dueDate, isDone = task.status == TaskStatus.DONE)
                    }

                    // Assignee indicator
                    task.assigneePubkey?.let {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = "Assigned",
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PriorityBadge(priority: TaskPriority) {
    val color = when (priority) {
        TaskPriority.LOW -> MaterialTheme.colorScheme.surfaceVariant
        TaskPriority.MEDIUM -> Color(0xFF4CAF50)
        TaskPriority.HIGH -> Color(0xFFFF9800)
        TaskPriority.URGENT -> Color(0xFFF44336)
    }

    Surface(
        color = color.copy(alpha = 0.2f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = priority.name.lowercase().replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun DueDateBadge(dueDate: Long, isDone: Boolean) {
    val now = System.currentTimeMillis() / 1000
    val isOverdue = dueDate < now && !isDone
    val formatter = SimpleDateFormat("MMM d", Locale.getDefault())
    val dateText = formatter.format(Date(dueDate * 1000))

    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            Icons.Default.Schedule,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = if (isOverdue) MaterialTheme.colorScheme.error
            else MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = dateText,
            style = MaterialTheme.typography.labelSmall,
            color = if (isOverdue) MaterialTheme.colorScheme.error
            else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// Extension functions for display

private fun TaskStatus.displayLabel(): String = when (this) {
    TaskStatus.TODO -> "To Do"
    TaskStatus.IN_PROGRESS -> "In Progress"
    TaskStatus.DONE -> "Done"
    TaskStatus.CANCELLED -> "Cancelled"
}

private fun TaskStatus.icon() = when (this) {
    TaskStatus.TODO -> Icons.Default.RadioButtonUnchecked
    TaskStatus.IN_PROGRESS -> Icons.Default.Pending
    TaskStatus.DONE -> Icons.Default.CheckCircle
    TaskStatus.CANCELLED -> Icons.Default.Cancel
}
