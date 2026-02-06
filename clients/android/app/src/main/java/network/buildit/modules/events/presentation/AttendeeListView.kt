package network.buildit.modules.events.presentation

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.generated.schemas.events.Rsvp
import network.buildit.generated.schemas.events.Status

/**
 * Attendee list view showing attendees grouped by RSVP status.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendeeListView(
    eventId: String,
    maxAttendees: Long? = null,
    onBackClick: () -> Unit,
    onInviteClick: (() -> Unit)? = null,
    viewModel: EventsViewModel = hiltViewModel()
) {
    val detailState by viewModel.eventDetailState.collectAsState()

    LaunchedEffect(eventId) {
        viewModel.loadEventDetail(eventId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Attendees") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (onInviteClick != null) {
                        IconButton(onClick = onInviteClick) {
                            Icon(Icons.Default.PersonAdd, contentDescription = "Invite")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        when (val state = detailState) {
            is EventDetailState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is EventDetailState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
            is EventDetailState.Success -> {
                val grouped = state.rsvps.groupBy { it.status }
                val goingList = grouped[Status.Going] ?: emptyList()
                val maybeList = grouped[Status.Maybe] ?: emptyList()
                val notGoingList = grouped[Status.NotGoing] ?: emptyList()

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Capacity indicator
                    CapacityIndicator(
                        going = goingList.size,
                        maxAttendees = maxAttendees,
                        modifier = Modifier.padding(16.dp)
                    )

                    // Summary chips
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        StatusSummaryChip(
                            label = "Going",
                            count = goingList.size,
                            color = Color(0xFF4CAF50)
                        )
                        StatusSummaryChip(
                            label = "Maybe",
                            count = maybeList.size,
                            color = Color(0xFFFF9800)
                        )
                        StatusSummaryChip(
                            label = "Declined",
                            count = notGoingList.size,
                            color = Color(0xFFF44336)
                        )
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    // Grouped attendee lists
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (goingList.isNotEmpty()) {
                            item {
                                AttendeeGroupHeader(
                                    title = "Going",
                                    count = goingList.size,
                                    icon = Icons.Default.CheckCircle,
                                    color = Color(0xFF4CAF50)
                                )
                            }
                            items(goingList) { rsvp ->
                                AttendeeRow(rsvp = rsvp, statusColor = Color(0xFF4CAF50))
                            }
                            item { Spacer(modifier = Modifier.height(12.dp)) }
                        }

                        if (maybeList.isNotEmpty()) {
                            item {
                                AttendeeGroupHeader(
                                    title = "Maybe",
                                    count = maybeList.size,
                                    icon = Icons.Default.Help,
                                    color = Color(0xFFFF9800)
                                )
                            }
                            items(maybeList) { rsvp ->
                                AttendeeRow(rsvp = rsvp, statusColor = Color(0xFFFF9800))
                            }
                            item { Spacer(modifier = Modifier.height(12.dp)) }
                        }

                        if (notGoingList.isNotEmpty()) {
                            item {
                                AttendeeGroupHeader(
                                    title = "Declined",
                                    count = notGoingList.size,
                                    icon = Icons.Default.Cancel,
                                    color = Color(0xFFF44336)
                                )
                            }
                            items(notGoingList) { rsvp ->
                                AttendeeRow(rsvp = rsvp, statusColor = Color(0xFFF44336))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CapacityIndicator(
    going: Int,
    maxAttendees: Long?,
    modifier: Modifier = Modifier
) {
    if (maxAttendees == null) return

    val progress = going.toFloat() / maxAttendees.toFloat()
    val isFull = going >= maxAttendees

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isFull) MaterialTheme.colorScheme.errorContainer
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (isFull) "Event Full" else "Capacity",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "$going / $maxAttendees",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { minOf(progress, 1f) },
                modifier = Modifier.fillMaxWidth(),
                color = if (isFull) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun StatusSummaryChip(
    label: String,
    count: Int,
    color: Color
) {
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = color
            )
        }
    }
}

@Composable
private fun AttendeeGroupHeader(
    title: String,
    count: Int,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color
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
            tint = color
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "$title ($count)",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

@Composable
private fun AttendeeRow(
    rsvp: Rsvp,
    statusColor: Color
) {
    ListItem(
        headlineContent = {
            Text(
                text = rsvp.pubkey.take(8) + "...",
                style = MaterialTheme.typography.bodyMedium
            )
        },
        supportingContent = {
            rsvp.note?.let { note ->
                Text(
                    text = note,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        },
        leadingContent = {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                tint = statusColor
            )
        },
        trailingContent = {
            rsvp.guestCount?.let { guests ->
                if (guests > 0) {
                    Text(
                        text = "+$guests",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    )
}
