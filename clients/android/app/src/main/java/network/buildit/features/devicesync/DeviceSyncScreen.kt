package network.buildit.features.devicesync

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
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.PhoneIphone
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Web
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.R
import network.buildit.core.storage.DeviceType
import network.buildit.core.storage.LinkedDeviceEntity
import network.buildit.ui.components.QRCodeCard
import network.buildit.ui.theme.BuildItTheme

/**
 * Device sync screen for managing linked devices.
 */
@Composable
fun DeviceSyncScreen(
    viewModel: DeviceSyncViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showQrCode by remember { mutableStateOf(false) }
    var showScanner by remember { mutableStateOf(false) }
    var deviceToUnlink by remember { mutableStateOf<LinkedDeviceEntity?>(null) }

    DeviceSyncContent(
        linkedDevices = uiState.linkedDevices,
        isLoading = uiState.isLoading,
        onShowQrCode = { showQrCode = true },
        onScanQrCode = { showScanner = true },
        onUnlinkDevice = { deviceToUnlink = it },
        onSyncDevice = { viewModel.syncDevice(it) }
    )

    // QR Code Dialog
    if (showQrCode) {
        QRCodeDialog(
            syncCode = uiState.syncCode,
            onDismiss = { showQrCode = false }
        )
    }

    // Scanner Dialog
    if (showScanner) {
        QRScannerDialog(
            onDismiss = { showScanner = false },
            onScanned = { code ->
                viewModel.linkDevice(code)
                showScanner = false
            }
        )
    }

    // Unlink confirmation
    deviceToUnlink?.let { device ->
        UnlinkDeviceDialog(
            device = device,
            onDismiss = { deviceToUnlink = null },
            onConfirm = {
                viewModel.unlinkDevice(device.deviceId)
                deviceToUnlink = null
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeviceSyncContent(
    linkedDevices: List<LinkedDeviceEntity>,
    isLoading: Boolean,
    onShowQrCode: () -> Unit,
    onScanQrCode: () -> Unit,
    onUnlinkDevice: (LinkedDeviceEntity) -> Unit,
    onSyncDevice: (String) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.device_sync_title)) },
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
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Description card
            item {
                DescriptionCard()
            }

            // Link device buttons
            item {
                LinkDeviceSection(
                    onShowQrCode = onShowQrCode,
                    onScanQrCode = onScanQrCode
                )
            }

            // Linked devices section
            item {
                Text(
                    text = stringResource(R.string.device_sync_linked_devices),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.semantics { heading() }
                )
            }

            if (linkedDevices.isEmpty()) {
                item {
                    EmptyDevicesView()
                }
            } else {
                items(linkedDevices, key = { it.deviceId }) { device ->
                    LinkedDeviceCard(
                        device = device,
                        onUnlink = { onUnlinkDevice(device) },
                        onSync = { onSyncDevice(device.deviceId) }
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
 * Description card explaining device sync.
 */
@Composable
private fun DescriptionCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Sync,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(40.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = stringResource(R.string.device_sync_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Section with buttons to link a device.
 */
@Composable
private fun LinkDeviceSection(
    onShowQrCode: () -> Unit,
    onScanQrCode: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Button(
            onClick = onShowQrCode,
            modifier = Modifier
                .weight(1f)
                .semantics {
                    contentDescription = "Show QR code for device linking. Let another device scan this code to link."
                }
        ) {
            Icon(Icons.Default.QrCode, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.device_sync_show_qr))
        }

        OutlinedButton(
            onClick = onScanQrCode,
            modifier = Modifier
                .weight(1f)
                .semantics {
                    contentDescription = "Scan QR code from another device to link."
                }
        ) {
            Icon(Icons.Default.QrCodeScanner, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.device_sync_scan_qr))
        }
    }
}

/**
 * Card displaying a linked device.
 */
@Composable
private fun LinkedDeviceCard(
    device: LinkedDeviceEntity,
    onUnlink: () -> Unit,
    onSync: () -> Unit
) {
    val accessibilityLabel = buildString {
        append("${device.name}, ${device.deviceType.name}")
        device.lastSyncAt?.let {
            append(". Last synced: ${formatTimestamp(it)}")
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = accessibilityLabel
            },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        ListItem(
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            leadingContent = {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.secondaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = getDeviceIcon(device.deviceType),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            },
            headlineContent = {
                Text(
                    text = device.name,
                    style = MaterialTheme.typography.titleMedium
                )
            },
            supportingContent = {
                Column {
                    Text(
                        text = device.deviceType.name,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    device.lastSyncAt?.let { timestamp ->
                        Text(
                            text = "Last synced: ${formatTimestamp(timestamp)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            },
            trailingContent = {
                Row {
                    IconButton(
                        onClick = onSync,
                        modifier = Modifier.semantics {
                            contentDescription = "Sync ${device.name} now"
                        }
                    ) {
                        Icon(
                            Icons.Default.Sync,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(
                        onClick = onUnlink,
                        modifier = Modifier.semantics {
                            contentDescription = "Unlink ${device.name}"
                        }
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        )
    }
}

/**
 * Empty state when no devices are linked.
 */
@Composable
private fun EmptyDevicesView() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Text(
            text = stringResource(R.string.device_sync_no_devices),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(32.dp)
        )
    }
}

/**
 * Dialog showing the QR code for linking.
 */
@Composable
private fun QRCodeDialog(
    syncCode: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.device_sync_show_qr)) },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                QRCodeCard(
                    data = syncCode,
                    title = "",
                    description = "Scan this code with your other device"
                )

                Text(
                    text = "This code expires in 5 minutes",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_ok))
            }
        }
    )
}

/**
 * Dialog for scanning a QR code using CameraX.
 */
@Composable
private fun QRScannerDialog(
    onDismiss: () -> Unit,
    onScanned: (String) -> Unit
) {
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.device_sync_scan_qr)) },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                network.buildit.ui.components.QRScannerCard(
                    onQrCodeScanned = onScanned,
                    onError = { errorMessage = it }
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (errorMessage != null) {
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                } else {
                    Text(
                        text = "Point your camera at the QR code",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}

/**
 * Confirmation dialog for unlinking a device.
 */
@Composable
private fun UnlinkDeviceDialog(
    device: LinkedDeviceEntity,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Unlink Device?") },
        text = {
            Text("Are you sure you want to unlink \"${device.name}\"? This device will no longer sync with your account.")
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Unlink")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}

/**
 * Gets the appropriate icon for a device type.
 */
private fun getDeviceIcon(type: DeviceType): ImageVector {
    return when (type) {
        DeviceType.ANDROID -> Icons.Default.PhoneAndroid
        DeviceType.IOS -> Icons.Default.PhoneIphone
        DeviceType.DESKTOP -> Icons.Default.Computer
        DeviceType.WEB -> Icons.Default.Web
    }
}

/**
 * Formats a timestamp for display.
 */
private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / (60 * 1000)
    val hours = diff / (60 * 60 * 1000)
    val days = diff / (24 * 60 * 60 * 1000)

    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "$minutes minutes ago"
        hours < 24 -> "$hours hours ago"
        days < 7 -> "$days days ago"
        else -> java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.getDefault())
            .format(java.util.Date(timestamp))
    }
}

@Preview(showBackground = true)
@Composable
private fun DeviceSyncScreenPreview() {
    BuildItTheme {
        DeviceSyncContent(
            linkedDevices = listOf(
                LinkedDeviceEntity(
                    deviceId = "1",
                    name = "MacBook Pro",
                    deviceType = DeviceType.DESKTOP,
                    publicKey = "abc123",
                    lastSyncAt = System.currentTimeMillis() - 3600000
                ),
                LinkedDeviceEntity(
                    deviceId = "2",
                    name = "iPad",
                    deviceType = DeviceType.IOS,
                    publicKey = "def456",
                    lastSyncAt = System.currentTimeMillis() - 86400000
                )
            ),
            isLoading = false,
            onShowQrCode = {},
            onScanQrCode = {},
            onUnlinkDevice = {},
            onSyncDevice = {}
        )
    }
}
