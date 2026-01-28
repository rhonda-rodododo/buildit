package network.buildit.modules.events.presentation.ui

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.VideoCall
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import network.buildit.modules.events.domain.model.BreakoutRoomConfig
import network.buildit.modules.events.domain.model.EventVirtualConfig

/**
 * Screen for configuring virtual event settings.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VirtualEventConfigScreen(
    initialConfig: EventVirtualConfig = EventVirtualConfig(),
    onSave: (EventVirtualConfig) -> Unit,
    onBack: () -> Unit
) {
    var config by remember { mutableStateOf(initialConfig) }
    var showBreakoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Virtual Event Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    TextButton(onClick = { onSave(config) }) {
                        Text("Save")
                    }
                }
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
            // Virtual Event Toggle
            SettingCard(
                icon = Icons.Default.VideoCall,
                title = "Enable Virtual Attendance",
                description = "Allow attendees to join remotely via video conference"
            ) {
                Switch(
                    checked = config.enabled,
                    onCheckedChange = { config = config.copy(enabled = it) }
                )
            }

            if (config.enabled) {
                // Auto-start timing
                SettingCard(
                    icon = Icons.Default.Schedule,
                    title = "Auto-start Conference",
                    description = "Start conference room ${config.autoStartMinutes} minutes before event"
                ) {
                    var sliderValue by remember { mutableFloatStateOf(config.autoStartMinutes.toFloat()) }

                    Column(
                        horizontalAlignment = Alignment.End
                    ) {
                        Text(
                            text = "${sliderValue.toInt()} min",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Slider(
                            value = sliderValue,
                            onValueChange = {
                                sliderValue = it
                                config = config.copy(autoStartMinutes = it.toInt())
                            },
                            valueRange = 5f..60f,
                            steps = 10,
                            modifier = Modifier.width(150.dp)
                        )
                    }
                }

                // Waiting Room
                SettingCard(
                    icon = Icons.Default.Person,
                    title = "Waiting Room",
                    description = "Hold attendees in waiting room until host admits them"
                ) {
                    Switch(
                        checked = config.waitingRoomEnabled,
                        onCheckedChange = { config = config.copy(waitingRoomEnabled = it) }
                    )
                }

                // Recording
                SettingCard(
                    icon = Icons.Default.Videocam,
                    title = "Enable Recording",
                    description = "Record the conference for later viewing"
                ) {
                    Switch(
                        checked = config.recordingEnabled,
                        onCheckedChange = { config = config.copy(recordingEnabled = it) }
                    )
                }

                if (config.recordingEnabled) {
                    SettingCard(
                        icon = Icons.Default.Lock,
                        title = "Recording Consent",
                        description = "Require attendees to consent before recording"
                    ) {
                        Switch(
                            checked = config.recordingConsentRequired,
                            onCheckedChange = { config = config.copy(recordingConsentRequired = it) }
                        )
                    }
                }

                // E2EE
                SettingCard(
                    icon = Icons.Default.Lock,
                    title = "End-to-End Encryption",
                    description = "Require E2EE for all conference communications"
                ) {
                    Switch(
                        checked = config.e2eeRequired,
                        onCheckedChange = { config = config.copy(e2eeRequired = it) }
                    )
                }

                // Max Attendees
                SettingCard(
                    icon = Icons.Default.Groups,
                    title = "Maximum Virtual Attendees",
                    description = "Limit the number of remote participants"
                ) {
                    var maxText by remember {
                        mutableStateOf(config.maxVirtualAttendees?.toString() ?: "")
                    }

                    OutlinedTextField(
                        value = maxText,
                        onValueChange = { value ->
                            maxText = value
                            val max = value.toIntOrNull()
                            config = config.copy(maxVirtualAttendees = max)
                        },
                        modifier = Modifier.width(100.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        placeholder = { Text("No limit") }
                    )
                }

                // Breakout Rooms
                SettingCard(
                    icon = Icons.Default.Groups,
                    title = "Breakout Rooms",
                    description = if (config.breakoutRoomsEnabled) {
                        "Enabled - ${config.breakoutConfig?.roomCount ?: 0} rooms"
                    } else {
                        "Split attendees into smaller groups for discussion"
                    }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (config.breakoutRoomsEnabled) {
                            TextButton(onClick = { showBreakoutDialog = true }) {
                                Text("Configure")
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Switch(
                            checked = config.breakoutRoomsEnabled,
                            onCheckedChange = {
                                config = config.copy(
                                    breakoutRoomsEnabled = it,
                                    breakoutConfig = if (it && config.breakoutConfig == null) {
                                        BreakoutRoomConfig(enabled = true, roomCount = 2)
                                    } else {
                                        config.breakoutConfig?.copy(enabled = it)
                                    }
                                )
                            }
                        )
                    }
                }
            }
        }
    }

    // Breakout Room Configuration Dialog
    if (showBreakoutDialog) {
        BreakoutRoomConfigDialog(
            config = config.breakoutConfig ?: BreakoutRoomConfig(enabled = true, roomCount = 2),
            onDismiss = { showBreakoutDialog = false },
            onConfirm = { breakoutConfig ->
                config = config.copy(breakoutConfig = breakoutConfig)
                showBreakoutDialog = false
            }
        )
    }
}

@Composable
private fun SettingCard(
    icon: ImageVector,
    title: String,
    description: String,
    action: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            action()
        }
    }
}

@Composable
private fun BreakoutRoomConfigDialog(
    config: BreakoutRoomConfig,
    onDismiss: () -> Unit,
    onConfirm: (BreakoutRoomConfig) -> Unit
) {
    var roomCount by remember { mutableStateOf(config.roomCount?.toString() ?: "2") }
    var autoAssign by remember { mutableStateOf(config.autoAssign) }
    var allowSelfSelect by remember { mutableStateOf(config.allowSelfSelect) }
    var durationMinutes by remember { mutableStateOf(config.durationMinutes?.toString() ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Breakout Room Settings") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedTextField(
                    value = roomCount,
                    onValueChange = { roomCount = it },
                    label = { Text("Number of Rooms") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Auto-assign participants")
                    Switch(
                        checked = autoAssign,
                        onCheckedChange = { autoAssign = it }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Allow self-selection")
                    Switch(
                        checked = allowSelfSelect,
                        onCheckedChange = { allowSelfSelect = it }
                    )
                }

                OutlinedTextField(
                    value = durationMinutes,
                    onValueChange = { durationMinutes = it },
                    label = { Text("Duration (minutes)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("No limit") }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        BreakoutRoomConfig(
                            enabled = true,
                            autoAssign = autoAssign,
                            roomCount = roomCount.toIntOrNull(),
                            roomNames = null,
                            allowSelfSelect = allowSelfSelect,
                            durationMinutes = durationMinutes.toIntOrNull()
                        )
                    )
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
