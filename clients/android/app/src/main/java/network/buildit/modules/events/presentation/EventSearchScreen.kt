package network.buildit.modules.events.presentation

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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import network.buildit.generated.schemas.events.Event
import java.text.SimpleDateFormat
import java.util.*

/**
 * Sort options for event search results.
 */
enum class EventSortOption(val label: String) {
    DATE_ASC("Date (earliest)"),
    DATE_DESC("Date (latest)"),
    TITLE_ASC("Title (A-Z)"),
    RELEVANCE("Relevance")
}

/**
 * Filter criteria for event search.
 */
data class EventSearchFilters(
    val query: String = "",
    val dateRangeStart: Long? = null,
    val dateRangeEnd: Long? = null,
    val groupId: String? = null,
    val category: String? = null,
    val isUpcoming: Boolean? = null, // true = upcoming only, false = past only, null = all
    val sortBy: EventSortOption = EventSortOption.DATE_DESC
)

/**
 * Event search and filtering screen.
 *
 * Features:
 * - Search by title and description
 * - Filter by date range
 * - Filter by group
 * - Filter by category
 * - Toggle upcoming/past/all
 * - Sort by date, title, or relevance
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventSearchScreen(
    events: List<Event>,
    groups: List<GroupInfo> = emptyList(),
    onEventClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    var filters by remember { mutableStateOf(EventSearchFilters()) }
    var showFilters by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    // Apply filters
    val filteredEvents = remember(events, filters) {
        filterAndSortEvents(events, filters)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = filters.query,
                        onValueChange = { filters = filters.copy(query = it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester),
                        placeholder = { Text("Search events...") },
                        singleLine = true,
                        trailingIcon = {
                            if (filters.query.isNotEmpty()) {
                                IconButton(onClick = { filters = filters.copy(query = "") }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedBorderColor = MaterialTheme.colorScheme.surface,
                            focusedBorderColor = MaterialTheme.colorScheme.surface
                        )
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showFilters = !showFilters }) {
                        BadgedBox(
                            badge = {
                                val activeFilters = countActiveFilters(filters)
                                if (activeFilters > 0) {
                                    Badge { Text(activeFilters.toString()) }
                                }
                            }
                        ) {
                            Icon(
                                Icons.Default.FilterList,
                                contentDescription = "Filters"
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Filter panel (collapsible)
            if (showFilters) {
                EventFilterPanel(
                    filters = filters,
                    groups = groups,
                    onFiltersChanged = { filters = it },
                    onClearAll = { filters = EventSearchFilters() }
                )
                HorizontalDivider()
            }

            // Quick filter chips
            EventQuickFilters(
                filters = filters,
                onFiltersChanged = { filters = it }
            )

            // Results count
            Text(
                text = "${filteredEvents.size} event${if (filteredEvents.size != 1) "s" else ""}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            // Results
            if (filteredEvents.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.EventBusy,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No events found",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (filters != EventSearchFilters()) {
                            TextButton(onClick = { filters = EventSearchFilters() }) {
                                Text("Clear filters")
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredEvents, key = { it.id }) { event ->
                        EventSearchResultCard(
                            event = event,
                            searchQuery = filters.query,
                            onClick = { onEventClick(event.id) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Collapsible filter panel with date range, group, and category selectors.
 */
@Composable
private fun EventFilterPanel(
    filters: EventSearchFilters,
    groups: List<GroupInfo>,
    onFiltersChanged: (EventSearchFilters) -> Unit,
    onClearAll: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filters",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onClearAll) {
                    Text("Clear all")
                }
            }

            // Sort by
            var sortExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = sortExpanded,
                onExpandedChange = { sortExpanded = it }
            ) {
                OutlinedTextField(
                    value = filters.sortBy.label,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    label = { Text("Sort by") },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = sortExpanded)
                    }
                )
                ExposedDropdownMenu(
                    expanded = sortExpanded,
                    onDismissRequest = { sortExpanded = false }
                ) {
                    EventSortOption.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = {
                                onFiltersChanged(filters.copy(sortBy = option))
                                sortExpanded = false
                            }
                        )
                    }
                }
            }

            // Group filter
            if (groups.isNotEmpty()) {
                var groupExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = groupExpanded,
                    onExpandedChange = { groupExpanded = it }
                ) {
                    OutlinedTextField(
                        value = groups.find { it.id == filters.groupId }?.name ?: "All groups",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        label = { Text("Group") },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = groupExpanded)
                        }
                    )
                    ExposedDropdownMenu(
                        expanded = groupExpanded,
                        onDismissRequest = { groupExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("All groups") },
                            onClick = {
                                onFiltersChanged(filters.copy(groupId = null))
                                groupExpanded = false
                            }
                        )
                        groups.forEach { group ->
                            DropdownMenuItem(
                                text = { Text(group.name) },
                                onClick = {
                                    onFiltersChanged(filters.copy(groupId = group.id))
                                    groupExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Quick filter chips for common event filtering operations.
 */
@Composable
private fun EventQuickFilters(
    filters: EventSearchFilters,
    onFiltersChanged: (EventSearchFilters) -> Unit
) {
    LazyRow(
        modifier = Modifier.padding(vertical = 8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = filters.isUpcoming == null,
                onClick = { onFiltersChanged(filters.copy(isUpcoming = null)) },
                label = { Text("All") }
            )
        }
        item {
            FilterChip(
                selected = filters.isUpcoming == true,
                onClick = {
                    onFiltersChanged(filters.copy(
                        isUpcoming = if (filters.isUpcoming == true) null else true
                    ))
                },
                label = { Text("Upcoming") },
                leadingIcon = if (filters.isUpcoming == true) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }
        item {
            FilterChip(
                selected = filters.isUpcoming == false,
                onClick = {
                    onFiltersChanged(filters.copy(
                        isUpcoming = if (filters.isUpcoming == false) null else false
                    ))
                },
                label = { Text("Past") },
                leadingIcon = if (filters.isUpcoming == false) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }
        item {
            FilterChip(
                selected = filters.sortBy == EventSortOption.DATE_ASC,
                onClick = {
                    onFiltersChanged(filters.copy(
                        sortBy = if (filters.sortBy == EventSortOption.DATE_ASC) EventSortOption.DATE_DESC
                        else EventSortOption.DATE_ASC
                    ))
                },
                label = {
                    Text(if (filters.sortBy == EventSortOption.DATE_ASC) "Earliest first" else "Latest first")
                }
            )
        }
    }
}

@Composable
private fun EventSearchResultCard(
    event: Event,
    searchQuery: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Title
            Text(
                text = event.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // Date/time
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    Icons.Default.CalendarToday,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = formatEventDate(event.startTime),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
                event.endTime?.let { endTime ->
                    Text(
                        text = "- ${formatEventTime(endTime)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Location
            event.location?.let { location ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = location,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Description preview
            event.description?.let { description ->
                if (description.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

/**
 * Simple data class for group info used in the filter dropdown.
 */
data class GroupInfo(
    val id: String,
    val name: String
)

/**
 * Apply filters and sorting to a list of events.
 */
private fun filterAndSortEvents(
    events: List<Event>,
    filters: EventSearchFilters
): List<Event> {
    val now = System.currentTimeMillis() / 1000

    return events.filter { event ->
        // Query filter
        val matchesQuery = filters.query.isBlank() ||
            event.title.contains(filters.query, ignoreCase = true) ||
            (event.description?.contains(filters.query, ignoreCase = true) == true) ||
            (event.location?.contains(filters.query, ignoreCase = true) == true)

        // Upcoming/past filter
        val matchesTiming = when (filters.isUpcoming) {
            true -> event.startTime > now
            false -> event.startTime <= now
            null -> true
        }

        // Date range filter
        val matchesDateRange = (filters.dateRangeStart == null || event.startTime >= filters.dateRangeStart) &&
            (filters.dateRangeEnd == null || event.startTime <= filters.dateRangeEnd)

        matchesQuery && matchesTiming && matchesDateRange
    }.let { filtered ->
        when (filters.sortBy) {
            EventSortOption.DATE_ASC -> filtered.sortedBy { it.startTime }
            EventSortOption.DATE_DESC -> filtered.sortedByDescending { it.startTime }
            EventSortOption.TITLE_ASC -> filtered.sortedBy { it.title.lowercase() }
            EventSortOption.RELEVANCE -> {
                if (filters.query.isBlank()) {
                    filtered.sortedByDescending { it.startTime }
                } else {
                    val query = filters.query.lowercase()
                    filtered.sortedByDescending { event ->
                        var score = 0
                        if (event.title.lowercase().contains(query)) score += 10
                        if (event.description?.lowercase()?.contains(query) == true) score += 5
                        if (event.location?.lowercase()?.contains(query) == true) score += 3
                        score
                    }
                }
            }
        }
    }
}

private fun countActiveFilters(filters: EventSearchFilters): Int {
    var count = 0
    if (filters.isUpcoming != null) count++
    if (filters.dateRangeStart != null) count++
    if (filters.dateRangeEnd != null) count++
    if (filters.groupId != null) count++
    if (filters.category != null) count++
    if (filters.sortBy != EventSortOption.DATE_DESC) count++
    return count
}

private fun formatEventDate(timestamp: Long): String {
    val adjustedTimestamp = if (timestamp < 10_000_000_000L) timestamp * 1000 else timestamp
    val formatter = SimpleDateFormat("EEE, MMM d 'at' h:mm a", Locale.getDefault())
    return formatter.format(Date(adjustedTimestamp))
}

private fun formatEventTime(timestamp: Long): String {
    val adjustedTimestamp = if (timestamp < 10_000_000_000L) timestamp * 1000 else timestamp
    val formatter = SimpleDateFormat("h:mm a", Locale.getDefault())
    return formatter.format(Date(adjustedTimestamp))
}
