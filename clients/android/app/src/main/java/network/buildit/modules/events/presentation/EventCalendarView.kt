package network.buildit.modules.events.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.generated.schemas.events.Event
import java.text.SimpleDateFormat
import java.util.*

/**
 * Calendar view mode toggle.
 */
enum class CalendarViewMode {
    MONTH,
    WEEK
}

/**
 * Calendar day with events.
 */
data class CalendarDay(
    val date: Calendar,
    val events: List<Event>,
    val isCurrentMonth: Boolean,
    val isToday: Boolean,
    val isSelected: Boolean
)

/**
 * Event calendar screen showing month view with event indicators on dates.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventCalendarView(
    groupId: String,
    onEventClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: EventsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var viewMode by remember { mutableStateOf(CalendarViewMode.MONTH) }
    var currentMonth by remember { mutableStateOf(Calendar.getInstance()) }
    var selectedDate by remember { mutableStateOf<Calendar?>(null) }

    // Load events for visible range
    LaunchedEffect(currentMonth, viewMode) {
        val (start, end) = getVisibleRange(currentMonth, viewMode)
        viewModel.loadEventsInRange(groupId, start, end)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    val formatter = SimpleDateFormat("MMMM yyyy", Locale.getDefault())
                    Text(formatter.format(currentMonth.time))
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // View mode toggle
                    IconButton(onClick = {
                        viewMode = if (viewMode == CalendarViewMode.MONTH)
                            CalendarViewMode.WEEK else CalendarViewMode.MONTH
                    }) {
                        Icon(
                            if (viewMode == CalendarViewMode.MONTH) Icons.Default.ViewWeek
                            else Icons.Default.CalendarViewMonth,
                            contentDescription = "Toggle view"
                        )
                    }

                    // Jump to today
                    IconButton(onClick = {
                        currentMonth = Calendar.getInstance()
                        selectedDate = Calendar.getInstance()
                    }) {
                        Icon(Icons.Default.Today, contentDescription = "Today")
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
            // Navigation arrows
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    currentMonth = (currentMonth.clone() as Calendar).apply {
                        if (viewMode == CalendarViewMode.MONTH) add(Calendar.MONTH, -1)
                        else add(Calendar.WEEK_OF_YEAR, -1)
                    }
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Previous")
                }

                Text(
                    text = if (viewMode == CalendarViewMode.WEEK) {
                        val formatter = SimpleDateFormat("MMM d", Locale.getDefault())
                        val weekStart = getWeekStart(currentMonth)
                        val weekEnd = (weekStart.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 6) }
                        "${formatter.format(weekStart.time)} - ${formatter.format(weekEnd.time)}"
                    } else "",
                    style = MaterialTheme.typography.bodyMedium
                )

                IconButton(onClick = {
                    currentMonth = (currentMonth.clone() as Calendar).apply {
                        if (viewMode == CalendarViewMode.MONTH) add(Calendar.MONTH, 1)
                        else add(Calendar.WEEK_OF_YEAR, 1)
                    }
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Next")
                }
            }

            // Day labels
            DayLabelsRow()

            // Calendar grid
            val events = when (val state = uiState) {
                is EventsUiState.EventList -> state.events
                else -> emptyList()
            }

            val calendarDays = generateCalendarDays(
                currentMonth = currentMonth,
                viewMode = viewMode,
                events = events,
                selectedDate = selectedDate
            )

            when (viewMode) {
                CalendarViewMode.MONTH -> MonthGrid(
                    days = calendarDays,
                    onDayClick = { day ->
                        selectedDate = day.date
                    }
                )
                CalendarViewMode.WEEK -> WeekGrid(
                    days = calendarDays,
                    onDayClick = { day ->
                        selectedDate = day.date
                    }
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Events for selected date
            val selectedDayEvents = selectedDate?.let { selected ->
                calendarDays.find { isSameDay(it.date, selected) }?.events
            } ?: emptyList()

            if (selectedDate != null) {
                val formatter = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault())
                Text(
                    text = formatter.format(selectedDate!!.time),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            if (selectedDayEvents.isEmpty() && selectedDate != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No events on this day",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(selectedDayEvents) { event ->
                        EventDayCard(event = event, onClick = { onEventClick(event.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun DayLabelsRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach { day ->
            Text(
                text = day,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun MonthGrid(
    days: List<CalendarDay>,
    onDayClick: (CalendarDay) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(7),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        contentPadding = PaddingValues(4.dp),
        userScrollEnabled = false
    ) {
        items(days) { day ->
            CalendarDayCell(day = day, onClick = { onDayClick(day) })
        }
    }
}

@Composable
private fun WeekGrid(
    days: List<CalendarDay>,
    onDayClick: (CalendarDay) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        days.take(7).forEach { day ->
            CalendarDayCell(
                day = day,
                onClick = { onDayClick(day) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun CalendarDayCell(
    day: CalendarDay,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val dayOfMonth = day.date.get(Calendar.DAY_OF_MONTH)

    Column(
        modifier = modifier
            .padding(2.dp)
            .clip(MaterialTheme.shapes.small)
            .clickable(onClick = onClick)
            .then(
                if (day.isSelected) Modifier.background(
                    MaterialTheme.colorScheme.primaryContainer,
                    MaterialTheme.shapes.small
                ) else Modifier
            )
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = dayOfMonth.toString(),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (day.isToday) FontWeight.Bold else FontWeight.Normal,
            color = when {
                day.isToday -> MaterialTheme.colorScheme.primary
                !day.isCurrentMonth -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                else -> MaterialTheme.colorScheme.onSurface
            },
            textAlign = TextAlign.Center
        )

        // Event indicator dots
        if (day.events.isNotEmpty()) {
            Spacer(modifier = Modifier.height(2.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.height(6.dp)
            ) {
                val dotCount = minOf(day.events.size, 3)
                repeat(dotCount) {
                    Box(
                        modifier = Modifier
                            .size(4.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                    )
                }
            }
        } else {
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun EventDayCard(
    event: Event,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Time indicator
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(56.dp)
            ) {
                val formatter = SimpleDateFormat("h:mm", Locale.getDefault())
                val amPmFormatter = SimpleDateFormat("a", Locale.getDefault())
                Text(
                    text = formatter.format(Date(event.startAt * 1000)),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = amPmFormatter.format(Date(event.startAt * 1000)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                event.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

// Helper functions

private fun getVisibleRange(month: Calendar, viewMode: CalendarViewMode): Pair<Long, Long> {
    val start = (month.clone() as Calendar).apply {
        if (viewMode == CalendarViewMode.MONTH) {
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.DAY_OF_MONTH, -7) // Include prev month overflow
        } else {
            set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
        }
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
    }

    val end = (month.clone() as Calendar).apply {
        if (viewMode == CalendarViewMode.MONTH) {
            set(Calendar.DAY_OF_MONTH, getActualMaximum(Calendar.DAY_OF_MONTH))
            add(Calendar.DAY_OF_MONTH, 7) // Include next month overflow
        } else {
            set(Calendar.DAY_OF_WEEK, Calendar.SATURDAY)
        }
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
    }

    return Pair(start.timeInMillis / 1000, end.timeInMillis / 1000)
}

private fun getWeekStart(cal: Calendar): Calendar {
    return (cal.clone() as Calendar).apply {
        set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
    }
}

private fun generateCalendarDays(
    currentMonth: Calendar,
    viewMode: CalendarViewMode,
    events: List<Event>,
    selectedDate: Calendar?
): List<CalendarDay> {
    val today = Calendar.getInstance()
    val days = mutableListOf<CalendarDay>()

    when (viewMode) {
        CalendarViewMode.MONTH -> {
            val firstDayOfMonth = (currentMonth.clone() as Calendar).apply {
                set(Calendar.DAY_OF_MONTH, 1)
            }
            val startOffset = firstDayOfMonth.get(Calendar.DAY_OF_WEEK) - 1

            val startDate = (firstDayOfMonth.clone() as Calendar).apply {
                add(Calendar.DAY_OF_MONTH, -startOffset)
            }

            repeat(42) { i -> // 6 weeks max
                val date = (startDate.clone() as Calendar).apply {
                    add(Calendar.DAY_OF_MONTH, i)
                }

                val dayEvents = events.filter { event ->
                    isSameDay(date, Calendar.getInstance().apply {
                        timeInMillis = event.startAt * 1000
                    })
                }

                days.add(CalendarDay(
                    date = date,
                    events = dayEvents,
                    isCurrentMonth = date.get(Calendar.MONTH) == currentMonth.get(Calendar.MONTH),
                    isToday = isSameDay(date, today),
                    isSelected = selectedDate != null && isSameDay(date, selectedDate)
                ))
            }
        }
        CalendarViewMode.WEEK -> {
            val weekStart = getWeekStart(currentMonth)

            repeat(7) { i ->
                val date = (weekStart.clone() as Calendar).apply {
                    add(Calendar.DAY_OF_MONTH, i)
                }

                val dayEvents = events.filter { event ->
                    isSameDay(date, Calendar.getInstance().apply {
                        timeInMillis = event.startAt * 1000
                    })
                }

                days.add(CalendarDay(
                    date = date,
                    events = dayEvents,
                    isCurrentMonth = true,
                    isToday = isSameDay(date, today),
                    isSelected = selectedDate != null && isSameDay(date, selectedDate)
                ))
            }
        }
    }

    return days
}

private fun isSameDay(cal1: Calendar, cal2: Calendar): Boolean {
    return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
        cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
}
