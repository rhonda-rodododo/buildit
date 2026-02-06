package network.buildit.modules.tasks.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import network.buildit.modules.tasks.data.local.TaskPriority

/**
 * Dialog for creating or editing a task.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskCreateDialog(
    onDismiss: () -> Unit,
    onCreate: (
        title: String,
        description: String?,
        assigneePubkey: String?,
        dueDate: Long?,
        priority: TaskPriority
    ) -> Unit,
    initialTitle: String = "",
    initialDescription: String? = null,
    initialPriority: TaskPriority = TaskPriority.Medium
) {
    var title by remember { mutableStateOf(initialTitle) }
    var description by remember { mutableStateOf(initialDescription ?: "") }
    var priority by remember { mutableStateOf(initialPriority) }
    var showPriorityMenu by remember { mutableStateOf(false) }
    var titleError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (initialTitle.isEmpty()) "Create Task" else "Edit Task",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Title field
                OutlinedTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        titleError = false
                    },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = titleError,
                    supportingText = if (titleError) {
                        { Text("Title is required") }
                    } else null
                )

                // Description field
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    maxLines = 5
                )

                // Priority selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Flag,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "Priority:",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Box {
                        AssistChip(
                            onClick = { showPriorityMenu = true },
                            label = {
                                Text(priority.name.lowercase().replaceFirstChar { it.uppercase() })
                            }
                        )

                        DropdownMenu(
                            expanded = showPriorityMenu,
                            onDismissRequest = { showPriorityMenu = false }
                        ) {
                            TaskPriority.entries.forEach { p ->
                                DropdownMenuItem(
                                    text = {
                                        Text(p.name.lowercase().replaceFirstChar { it.uppercase() })
                                    },
                                    onClick = {
                                        priority = p
                                        showPriorityMenu = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isBlank()) {
                        titleError = true
                        return@Button
                    }
                    onCreate(
                        title.trim(),
                        description.ifBlank { null },
                        null, // Assignee can be set in detail view
                        null, // Due date can be set in detail view
                        priority
                    )
                }
            ) {
                Text(if (initialTitle.isEmpty()) "Create" else "Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
