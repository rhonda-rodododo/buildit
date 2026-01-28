package network.buildit.modules.crm.presentation.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhoneMissed
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Voicemail
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.Flow
import network.buildit.modules.crm.integration.CallDirection
import network.buildit.modules.crm.integration.CallHistoryRecord
import network.buildit.modules.crm.integration.CallStatus
import network.buildit.modules.crm.integration.ContactCallStats
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Screen displaying call history for a CRM contact.
 *
 * @param contactId The contact ID.
 * @param contactName The contact's display name.
 * @param callHistory Flow of call history records.
 * @param callStats Call statistics for the contact.
 * @param onBack Navigation callback.
 * @param onCallContact Callback to initiate a call.
 * @param onPlayRecording Callback to play a recording.
 * @param onAddNotes Callback to add notes to a call.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactCallHistoryScreen(
    contactId: String,
    contactName: String,
    callHistory: Flow<List<CallHistoryRecord>>,
    callStats: ContactCallStats?,
    onBack: () -> Unit,
    onCallContact: () -> Unit,
    onPlayRecording: (String) -> Unit,
    onAddNotes: (String) -> Unit
) {
    val calls by callHistory.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Call History",
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = contactName,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCallContact,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Call,
                    contentDescription = "Call Contact"
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Stats Summary
            callStats?.let { stats ->
                CallStatsSummary(stats = stats)
            }

            // Call History List
            if (calls.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No call history",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(calls, key = { it.id }) { call ->
                        CallHistoryItem(
                            call = call,
                            onPlayRecording = { call.recordingUrl?.let { onPlayRecording(it) } },
                            onAddNotes = { onAddNotes(call.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CallStatsSummary(stats: ContactCallStats) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatItem(
                value = stats.totalCalls.toString(),
                label = "Total Calls"
            )
            StatItem(
                value = stats.inboundCalls.toString(),
                label = "Inbound"
            )
            StatItem(
                value = stats.outboundCalls.toString(),
                label = "Outbound"
            )
            StatItem(
                value = formatDuration(stats.averageDuration),
                label = "Avg Duration"
            )
        }
    }
}

@Composable
private fun StatItem(value: String, label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CallHistoryItem(
    call: CallHistoryRecord,
    onPlayRecording: () -> Unit,
    onAddNotes: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Direction and Status Icon
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(getCallStatusColor(call.status, call.direction).copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getCallIcon(call.status, call.direction),
                    contentDescription = null,
                    tint = getCallStatusColor(call.status, call.direction),
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Call Details
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = getCallStatusText(call.status, call.direction),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium
                    )

                    if (call.hotlineId != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "via Hotline",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier
                                .background(
                                    MaterialTheme.colorScheme.secondaryContainer,
                                    RoundedCornerShape(4.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatDate(call.startedAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (call.status == CallStatus.COMPLETED) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = formatDuration(call.duration),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Notes preview
                call.notes?.let { notes ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Recording indicator and menu
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (call.recordingUrl != null) {
                    IconButton(
                        onClick = onPlayRecording
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Play recording",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                if (call.transcriptUrl != null) {
                    Icon(
                        imageVector = Icons.Default.GraphicEq,
                        contentDescription = "Transcript available",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.secondary
                    )
                }

                Box {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More options"
                        )
                    }

                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Add Notes") },
                            onClick = {
                                showMenu = false
                                onAddNotes()
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Edit, contentDescription = null)
                            }
                        )
                        if (call.recordingUrl != null) {
                            DropdownMenuItem(
                                text = { Text("Play Recording") },
                                onClick = {
                                    showMenu = false
                                    onPlayRecording()
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun getCallIcon(status: CallStatus, direction: CallDirection): ImageVector {
    return when (status) {
        CallStatus.COMPLETED -> when (direction) {
            CallDirection.INBOUND -> Icons.AutoMirrored.Filled.CallReceived
            CallDirection.OUTBOUND -> Icons.AutoMirrored.Filled.CallMade
        }
        CallStatus.MISSED -> Icons.Default.PhoneMissed
        CallStatus.VOICEMAIL -> Icons.Default.Voicemail
        CallStatus.FAILED -> Icons.Default.CallEnd
    }
}

@Composable
private fun getCallStatusColor(status: CallStatus, direction: CallDirection): androidx.compose.ui.graphics.Color {
    return when (status) {
        CallStatus.COMPLETED -> MaterialTheme.colorScheme.tertiary
        CallStatus.MISSED -> MaterialTheme.colorScheme.error
        CallStatus.VOICEMAIL -> MaterialTheme.colorScheme.secondary
        CallStatus.FAILED -> MaterialTheme.colorScheme.error
    }
}

private fun getCallStatusText(status: CallStatus, direction: CallDirection): String {
    return when (status) {
        CallStatus.COMPLETED -> when (direction) {
            CallDirection.INBOUND -> "Incoming Call"
            CallDirection.OUTBOUND -> "Outgoing Call"
        }
        CallStatus.MISSED -> "Missed Call"
        CallStatus.VOICEMAIL -> "Voicemail"
        CallStatus.FAILED -> "Failed Call"
    }
}

private fun formatDate(timestamp: Long): String {
    val date = Date(timestamp)
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 86400000 -> SimpleDateFormat("h:mm a", Locale.getDefault()).format(date)
        diff < 604800000 -> SimpleDateFormat("EEE h:mm a", Locale.getDefault()).format(date)
        else -> SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(date)
    }
}

private fun formatDuration(seconds: Int): String {
    return when {
        seconds < 60 -> "${seconds}s"
        seconds < 3600 -> {
            val mins = seconds / 60
            val secs = seconds % 60
            "${mins}m ${secs}s"
        }
        else -> {
            val hours = seconds / 3600
            val mins = (seconds % 3600) / 60
            "${hours}h ${mins}m"
        }
    }
}
