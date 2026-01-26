package network.buildit.features.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.BuildConfig
import network.buildit.R
import network.buildit.ui.theme.BuildItTheme

/**
 * Settings screen for app configuration.
 */
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDisplayNameDialog by remember { mutableStateOf(false) }

    SettingsContent(
        uiState = uiState,
        onDisplayNameClick = { showDisplayNameDialog = true },
        onBleToggle = { viewModel.toggleBle(it) },
        onBiometricToggle = { viewModel.toggleBiometric(it) },
        onExportKeys = { viewModel.exportKeys() },
        onRelayClick = { /* Navigate to relay management */ }
    )

    if (showDisplayNameDialog) {
        DisplayNameDialog(
            currentName = uiState.displayName ?: "",
            onDismiss = { showDisplayNameDialog = false },
            onSave = { name ->
                viewModel.updateDisplayName(name)
                showDisplayNameDialog = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsContent(
    uiState: SettingsUiState,
    onDisplayNameClick: () -> Unit,
    onBleToggle: (Boolean) -> Unit,
    onBiometricToggle: (Boolean) -> Unit,
    onExportKeys: () -> Unit,
    onRelayClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.settings_title)) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Profile Section
            item {
                SettingsSection(title = stringResource(R.string.settings_profile)) {
                    SettingsItem(
                        icon = Icons.Default.Person,
                        title = stringResource(R.string.settings_display_name),
                        subtitle = uiState.displayName ?: "Not set",
                        onClick = onDisplayNameClick
                    )

                    HorizontalDivider(modifier = Modifier.padding(start = 56.dp))

                    SettingsItem(
                        icon = Icons.Default.Key,
                        title = "Public Key",
                        subtitle = uiState.publicKey?.take(16)?.plus("...") ?: "Loading...",
                        onClick = { /* Copy to clipboard */ }
                    )
                }
            }

            // Network Section
            item {
                SettingsSection(title = stringResource(R.string.settings_network)) {
                    SettingsToggleItem(
                        icon = Icons.Default.Bluetooth,
                        title = stringResource(R.string.settings_ble_enabled),
                        subtitle = if (uiState.bleEnabled) "Connected to mesh" else "Disabled",
                        checked = uiState.bleEnabled,
                        onCheckedChange = onBleToggle
                    )

                    HorizontalDivider(modifier = Modifier.padding(start = 56.dp))

                    SettingsItem(
                        icon = Icons.Default.Cloud,
                        title = stringResource(R.string.settings_nostr_relays),
                        subtitle = "${uiState.connectedRelays} of ${uiState.totalRelays} connected",
                        onClick = onRelayClick
                    )
                }
            }

            // Security Section
            item {
                SettingsSection(title = stringResource(R.string.settings_security)) {
                    SettingsToggleItem(
                        icon = Icons.Default.Fingerprint,
                        title = stringResource(R.string.settings_biometric),
                        subtitle = if (uiState.biometricAvailable) {
                            if (uiState.biometricEnabled) "Enabled" else "Disabled"
                        } else {
                            "Not available on this device"
                        },
                        checked = uiState.biometricEnabled,
                        onCheckedChange = onBiometricToggle,
                        enabled = uiState.biometricAvailable
                    )

                    HorizontalDivider(modifier = Modifier.padding(start = 56.dp))

                    SettingsItem(
                        icon = Icons.Default.Security,
                        title = stringResource(R.string.settings_export_keys),
                        subtitle = "Backup your identity keys",
                        onClick = onExportKeys,
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            // About Section
            item {
                SettingsSection(title = stringResource(R.string.settings_about)) {
                    SettingsItem(
                        icon = Icons.Default.Info,
                        title = stringResource(R.string.settings_version),
                        subtitle = BuildConfig.VERSION_NAME,
                        onClick = { }
                    )
                }
            }

            // Bottom spacing
            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

/**
 * Settings section with title.
 */
@Composable
private fun SettingsSection(
    title: String,
    content: @Composable () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .padding(vertical = 8.dp)
                .semantics { heading() }
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            content()
        }
    }
}

/**
 * Standard settings item with icon and optional navigation arrow.
 */
@Composable
private fun SettingsItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant
) {
    ListItem(
        modifier = Modifier
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "$title. $subtitle"
            },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(24.dp)
            )
        },
        headlineContent = {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
        },
        supportingContent = {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        trailingContent = {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    )
}

/**
 * Settings item with toggle switch.
 */
@Composable
private fun SettingsToggleItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true
) {
    ListItem(
        modifier = Modifier
            .clickable(enabled = enabled) { onCheckedChange(!checked) }
            .semantics(mergeDescendants = true) {
                contentDescription = "$title. $subtitle"
                stateDescription = if (checked) "On" else "Off"
            },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (enabled) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f)
                },
                modifier = Modifier.size(24.dp)
            )
        },
        headlineContent = {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                color = if (enabled) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                }
            )
        },
        supportingContent = {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = if (enabled) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f)
                }
            )
        },
        trailingContent = {
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                enabled = enabled
            )
        }
    )
}

/**
 * Dialog for editing display name.
 */
@Composable
private fun DisplayNameDialog(
    currentName: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var name by remember { mutableStateOf(currentName) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.settings_display_name)) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            Button(
                onClick = { onSave(name) },
                enabled = name.isNotBlank()
            ) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}

@Preview(showBackground = true)
@Composable
private fun SettingsScreenPreview() {
    BuildItTheme {
        SettingsContent(
            uiState = SettingsUiState(
                displayName = "Alice",
                publicKey = "npub1abcdef123456789",
                bleEnabled = true,
                biometricEnabled = false,
                biometricAvailable = true,
                connectedRelays = 2,
                totalRelays = 3
            ),
            onDisplayNameClick = {},
            onBleToggle = {},
            onBiometricToggle = {},
            onExportKeys = {},
            onRelayClick = {}
        )
    }
}
