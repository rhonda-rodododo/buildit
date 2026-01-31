package network.buildit.features.events

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.VideoCall
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.generated.schemas.events.Event
import network.buildit.generated.schemas.events.LocationClass
import network.buildit.generated.schemas.events.Visibility
import network.buildit.modules.events.presentation.EventsViewModel
import network.buildit.ui.theme.BuildItTheme
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Screen for creating a new event.
 */
@Composable
fun CreateEventScreen(
    viewModel: EventsViewModel = hiltViewModel(),
    groupId: String? = null,
    onNavigateBack: () -> Unit = {},
    onEventCreated: (String) -> Unit = {}
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var startDate by remember { mutableLongStateOf(System.currentTimeMillis() + 86400000) } // Tomorrow
    var endDate by remember { mutableLongStateOf(System.currentTimeMillis() + 90000000) } // Tomorrow + 1hr
    var allDay by remember { mutableStateOf(false) }
    var locationName by remember { mutableStateOf("") }
    var locationAddress by remember { mutableStateOf("") }
    var virtualUrl by remember { mutableStateOf("") }
    var maxAttendees by remember { mutableStateOf("") }
    var isVirtual by remember { mutableStateOf(false) }

    CreateEventContent(
        title = title,
        onTitleChange = { title = it },
        description = description,
        onDescriptionChange = { description = it },
        startDate = startDate,
        onStartDateChange = { startDate = it },
        endDate = endDate,
        onEndDateChange = { endDate = it },
        allDay = allDay,
        onAllDayChange = { allDay = it },
        locationName = locationName,
        onLocationNameChange = { locationName = it },
        locationAddress = locationAddress,
        onLocationAddressChange = { locationAddress = it },
        virtualUrl = virtualUrl,
        onVirtualUrlChange = { virtualUrl = it },
        maxAttendees = maxAttendees,
        onMaxAttendeesChange = { maxAttendees = it },
        isVirtual = isVirtual,
        onIsVirtualChange = { isVirtual = it },
        onBackClick = onNavigateBack,
        onCreateClick = {
            val eventId = UUID.randomUUID().toString()
            val event = Event(
                v = "1.0.0",
                id = eventId,
                title = title,
                description = description.ifBlank { null },
                startAt = startDate / 1000,
                endAt = if (allDay) null else endDate / 1000,
                allDay = allDay,
                location = if (!isVirtual && (locationName.isNotBlank() || locationAddress.isNotBlank())) {
                    LocationClass(
                        name = locationName.ifBlank { null },
                        address = locationAddress.ifBlank { null },
                        coordinates = null,
                        instructions = null
                    )
                } else null,
                virtualURL = if (isVirtual && virtualUrl.isNotBlank()) virtualUrl else null,
                maxAttendees = maxAttendees.toLongOrNull(),
                visibility = Visibility.Group,
                createdBy = "", // Will be filled by the use case
                createdAt = System.currentTimeMillis() / 1000
            )
            viewModel.createEvent(event, groupId)
            onEventCreated(eventId)
        },
        isValid = title.isNotBlank()
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateEventContent(
    title: String,
    onTitleChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    startDate: Long,
    onStartDateChange: (Long) -> Unit,
    endDate: Long,
    onEndDateChange: (Long) -> Unit,
    allDay: Boolean,
    onAllDayChange: (Boolean) -> Unit,
    locationName: String,
    onLocationNameChange: (String) -> Unit,
    locationAddress: String,
    onLocationAddressChange: (String) -> Unit,
    virtualUrl: String,
    onVirtualUrlChange: (String) -> Unit,
    maxAttendees: String,
    onMaxAttendeesChange: (String) -> Unit,
    isVirtual: Boolean,
    onIsVirtualChange: (Boolean) -> Unit,
    onBackClick: () -> Unit,
    onCreateClick: () -> Unit,
    isValid: Boolean
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Event") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Title
            OutlinedTextField(
                value = title,
                onValueChange = onTitleChange,
                label = { Text("Event Title *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = onDescriptionChange,
                label = { Text("Description") },
                minLines = 3,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth()
            )

            // Date & Time Section
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Date & Time",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // All day toggle
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onAllDayChange(!allDay) }
                    ) {
                        Checkbox(
                            checked = allDay,
                            onCheckedChange = onAllDayChange
                        )
                        Text("All day event")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Start Date/Time
                    DateTimePicker(
                        label = "Start",
                        timestamp = startDate,
                        onDateTimeChange = onStartDateChange,
                        showTime = !allDay,
                        context = context
                    )

                    // End Date/Time
                    if (!allDay) {
                        Spacer(modifier = Modifier.height(8.dp))
                        DateTimePicker(
                            label = "End",
                            timestamp = endDate,
                            onDateTimeChange = onEndDateChange,
                            showTime = true,
                            context = context
                        )
                    }
                }
            }

            // Location Section
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Location",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Virtual toggle
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onIsVirtualChange(!isVirtual) }
                    ) {
                        Checkbox(
                            checked = isVirtual,
                            onCheckedChange = onIsVirtualChange
                        )
                        Icon(Icons.Default.VideoCall, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Virtual event")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (isVirtual) {
                        OutlinedTextField(
                            value = virtualUrl,
                            onValueChange = onVirtualUrlChange,
                            label = { Text("Meeting URL") },
                            leadingIcon = { Icon(Icons.Default.VideoCall, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        OutlinedTextField(
                            value = locationName,
                            onValueChange = onLocationNameChange,
                            label = { Text("Location Name") },
                            leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = locationAddress,
                            onValueChange = onLocationAddressChange,
                            label = { Text("Address") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            // Capacity
            OutlinedTextField(
                value = maxAttendees,
                onValueChange = { if (it.all { char -> char.isDigit() }) onMaxAttendeesChange(it) },
                label = { Text("Max Attendees (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Create Button
            Button(
                onClick = onCreateClick,
                enabled = isValid,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Create Event")
            }
        }
    }
}

@Composable
private fun DateTimePicker(
    label: String,
    timestamp: Long,
    onDateTimeChange: (Long) -> Unit,
    showTime: Boolean,
    context: Context
) {
    val calendar = remember { Calendar.getInstance().apply { timeInMillis = timestamp } }
    val dateFormat = SimpleDateFormat(
        if (showTime) "EEE, MMM d, yyyy 'at' h:mm a" else "EEE, MMM d, yyyy",
        Locale.getDefault()
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$label:",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.width(48.dp)
        )

        Row(
            modifier = Modifier
                .weight(1f)
                .clickable {
                    DatePickerDialog(
                        context,
                        { _, year, month, day ->
                            calendar.set(Calendar.YEAR, year)
                            calendar.set(Calendar.MONTH, month)
                            calendar.set(Calendar.DAY_OF_MONTH, day)

                            if (showTime) {
                                TimePickerDialog(
                                    context,
                                    { _, hour, minute ->
                                        calendar.set(Calendar.HOUR_OF_DAY, hour)
                                        calendar.set(Calendar.MINUTE, minute)
                                        onDateTimeChange(calendar.timeInMillis)
                                    },
                                    calendar.get(Calendar.HOUR_OF_DAY),
                                    calendar.get(Calendar.MINUTE),
                                    false
                                ).show()
                            } else {
                                onDateTimeChange(calendar.timeInMillis)
                            }
                        },
                        calendar.get(Calendar.YEAR),
                        calendar.get(Calendar.MONTH),
                        calendar.get(Calendar.DAY_OF_MONTH)
                    ).show()
                }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.CalendarMonth,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = dateFormat.format(Date(timestamp)),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun CreateEventPreview() {
    BuildItTheme {
        CreateEventContent(
            title = "",
            onTitleChange = {},
            description = "",
            onDescriptionChange = {},
            startDate = System.currentTimeMillis(),
            onStartDateChange = {},
            endDate = System.currentTimeMillis(),
            onEndDateChange = {},
            allDay = false,
            onAllDayChange = {},
            locationName = "",
            onLocationNameChange = {},
            locationAddress = "",
            onLocationAddressChange = {},
            virtualUrl = "",
            onVirtualUrlChange = {},
            maxAttendees = "",
            onMaxAttendeesChange = {},
            isVirtual = false,
            onIsVirtualChange = {},
            onBackClick = {},
            onCreateClick = {},
            isValid = false
        )
    }
}
