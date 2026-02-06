package network.buildit.modules.polls.presentation

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.polls.data.local.PollEntity
import network.buildit.modules.polls.data.local.PollStatus
import network.buildit.modules.polls.data.local.PollType
import network.buildit.modules.polls.domain.PollResults
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main polls list screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PollsScreen(
    groupId: String,
    onPollClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: PollsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }

    LaunchedEffect(groupId) {
        viewModel.loadPolls(groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Polls") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(onClick = { viewModel.toggleActiveFilter() }) {
                        Text(if (uiState.showActiveOnly) "Show All" else "Active Only")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Create poll")
            }
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
        } else if (uiState.polls.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Poll,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "No polls yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.polls, key = { it.id }) { poll ->
                    PollCard(
                        poll = poll,
                        onClick = { onPollClick(poll.id) }
                    )
                }
            }
        }
    }

    if (showCreateDialog) {
        CreatePollDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { title, description, options, pollType, isAnonymous, closesAt ->
                viewModel.createPoll(title, description, options, pollType, isAnonymous, closesAt, null)
                showCreateDialog = false
            }
        )
    }
}

@Composable
private fun PollCard(
    poll: PollEntity,
    onClick: () -> Unit
) {
    val options = try {
        kotlinx.serialization.json.Json.decodeFromString<List<String>>(poll.optionsJson)
    } catch (_: Exception) {
        emptyList()
    }

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
                Text(
                    text = poll.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                StatusBadge(status = poll.status)
            }

            poll.description?.let { desc ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Options preview
            options.take(3).forEach { option ->
                Text(
                    text = "- $option",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (options.size > 3) {
                Text(
                    text = "+${options.size - 3} more options",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (poll.isAnonymous) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = poll.pollType.displayName(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                poll.closesAt?.let { closesAt ->
                    val formatter = SimpleDateFormat("MMM d 'at' h:mm a", Locale.getDefault())
                    Text(
                        text = "Closes ${formatter.format(Date(closesAt * 1000))}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: PollStatus) {
    val color = when (status) {
        PollStatus.DRAFT -> MaterialTheme.colorScheme.surfaceVariant
        PollStatus.ACTIVE -> MaterialTheme.colorScheme.primaryContainer
        PollStatus.CLOSED -> MaterialTheme.colorScheme.errorContainer
        PollStatus.CANCELLED -> MaterialTheme.colorScheme.surfaceVariant
    }

    Surface(
        color = color,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = status.name,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )
    }
}

/**
 * Poll results visualization with animated bars.
 */
@Composable
fun PollResultsView(
    results: PollResults,
    userSelections: List<Int> = emptyList()
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        results.options.forEachIndexed { index, option ->
            val percentage = results.getPercentage(index)
            val animatedProgress by animateFloatAsState(
                targetValue = percentage / 100f,
                label = "progress"
            )
            val isSelected = index in userSelections
            val isWinner = index == results.winningOptionIndex

            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = option,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (isWinner) FontWeight.Bold else FontWeight.Normal
                    )
                    Text(
                        text = "${percentage.toInt()}% (${results.voteCounts[index]})",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = if (isWinner) FontWeight.Bold else FontWeight.Normal
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                LinearProgressIndicator(
                    progress = { animatedProgress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(MaterialTheme.shapes.small),
                    color = if (isSelected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.primaryContainer,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "${results.totalVoters} voter${if (results.totalVoters != 1) "s" else ""}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CreatePollDialog(
    onDismiss: () -> Unit,
    onCreate: (
        title: String,
        description: String?,
        options: List<String>,
        pollType: PollType,
        isAnonymous: Boolean,
        closesAt: Long?
    ) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var options by remember { mutableStateOf(listOf("", "")) }
    var pollType by remember { mutableStateOf(PollType.SINGLE_CHOICE) }
    var isAnonymous by remember { mutableStateOf(false) }
    var titleError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Poll", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it; titleError = false },
                    label = { Text("Question") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = titleError
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 2
                )

                Text("Options", style = MaterialTheme.typography.titleSmall)

                options.forEachIndexed { index, option ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = option,
                            onValueChange = { newValue ->
                                options = options.toMutableList().also { it[index] = newValue }
                            },
                            label = { Text("Option ${index + 1}") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        if (options.size > 2) {
                            IconButton(onClick = {
                                options = options.toMutableList().also { it.removeAt(index) }
                            }) {
                                Icon(Icons.Default.Remove, contentDescription = "Remove option")
                            }
                        }
                    }
                }

                TextButton(onClick = { options = options + "" }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Option")
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Anonymous voting", style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = isAnonymous, onCheckedChange = { isAnonymous = it })
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (title.isBlank()) {
                    titleError = true
                    return@Button
                }
                val validOptions = options.filter { it.isNotBlank() }
                if (validOptions.size < 2) return@Button

                onCreate(
                    title.trim(),
                    description.ifBlank { null },
                    validOptions,
                    pollType,
                    isAnonymous,
                    null
                )
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

private fun PollType.displayName(): String = when (this) {
    PollType.SINGLE_CHOICE -> "Single Choice"
    PollType.MULTIPLE_CHOICE -> "Multiple Choice"
    PollType.RANKED_CHOICE -> "Ranked Choice"
}
