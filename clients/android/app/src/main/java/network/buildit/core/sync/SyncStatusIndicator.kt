package network.buildit.core.sync

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.NetworkCell
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SignalWifi4Bar
import androidx.compose.material.icons.filled.SignalWifiOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Compact sync status indicator for app bars.
 */
@Composable
fun SyncStatusIndicator(
    syncManager: SyncManager,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    val syncStatus by syncManager.syncStatus.collectAsState()
    val pendingCount by syncManager.pendingCount.collectAsState(initial = 0)
    val isSyncing by syncManager.isSyncing.collectAsState()

    Row(
        modifier = modifier
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        SyncIcon(
            syncStatus = syncStatus,
            isSyncing = isSyncing,
            modifier = Modifier.size(20.dp)
        )

        if (pendingCount > 0) {
            Badge(
                containerColor = getSyncStatusColor(syncStatus),
                contentColor = Color.White
            ) {
                Text(
                    text = pendingCount.toString(),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

/**
 * Animated sync icon that rotates when syncing.
 */
@Composable
private fun SyncIcon(
    syncStatus: SyncStatus,
    isSyncing: Boolean,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "sync")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    val icon = when (syncStatus) {
        is SyncStatus.Idle -> Icons.Filled.CheckCircle
        is SyncStatus.Syncing -> Icons.Filled.Sync
        is SyncStatus.Completed -> Icons.Filled.CheckCircle
        is SyncStatus.Error -> Icons.Filled.Warning
        is SyncStatus.Offline -> Icons.Filled.CloudOff
    }

    val color = getSyncStatusColor(syncStatus)

    Icon(
        imageVector = icon,
        contentDescription = "Sync status",
        tint = color,
        modifier = modifier
            .then(
                if (isSyncing) Modifier.rotate(rotation) else Modifier
            )
    )
}

/**
 * Get color for sync status.
 */
@Composable
private fun getSyncStatusColor(syncStatus: SyncStatus): Color {
    return when (syncStatus) {
        is SyncStatus.Idle, is SyncStatus.Completed -> MaterialTheme.colorScheme.primary
        is SyncStatus.Syncing -> MaterialTheme.colorScheme.tertiary
        is SyncStatus.Error -> MaterialTheme.colorScheme.error
        is SyncStatus.Offline -> MaterialTheme.colorScheme.outline
    }
}

/**
 * Detailed sync status view for settings or dedicated sync screen.
 */
@Composable
fun SyncStatusDetailView(
    syncManager: SyncManager,
    modifier: Modifier = Modifier
) {
    val networkState by syncManager.networkState.collectAsState()
    val syncStatus by syncManager.syncStatus.collectAsState()
    val pendingCount by syncManager.pendingCount.collectAsState(initial = 0)
    val lastSyncTime by syncManager.lastSyncTime.collectAsState()
    val conflicts by syncManager.conflicts.collectAsState()
    val isSyncing by syncManager.isSyncing.collectAsState()

    LazyColumn(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Network Status Card
        item {
            NetworkStatusCard(networkState = networkState)
        }

        // Sync Status Card
        item {
            SyncStatusCard(
                syncStatus = syncStatus,
                lastSyncTime = lastSyncTime,
                isSyncing = isSyncing
            )
        }

        // Quick Actions
        item {
            QuickActionsRow(
                networkState = networkState,
                isSyncing = isSyncing,
                onSyncNow = { syncManager.triggerImmediateSync() }
            )
        }

        // Pending Operations
        if (pendingCount > 0) {
            item {
                PendingOperationsCard(pendingCount = pendingCount)
            }
        }

        // Conflicts
        if (conflicts.isNotEmpty()) {
            item {
                Text(
                    text = "Sync Conflicts",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            items(conflicts) { conflict ->
                ConflictCard(
                    conflict = conflict,
                    onResolve = { resolution ->
                        // syncManager.resolveConflict(conflict.id, resolution)
                    }
                )
            }
        }
    }
}

/**
 * Network status card.
 */
@Composable
private fun NetworkStatusCard(
    networkState: NetworkState,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = getNetworkIcon(networkState),
                contentDescription = null,
                tint = if (networkState.isConnected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.outline
                },
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(
                    text = networkState.description,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = getNetworkDescription(networkState),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Get network icon based on state.
 */
private fun getNetworkIcon(state: NetworkState): ImageVector {
    return when (state) {
        NetworkState.WIFI -> Icons.Filled.SignalWifi4Bar
        NetworkState.CELLULAR -> Icons.Filled.NetworkCell
        NetworkState.OFFLINE -> Icons.Filled.SignalWifiOff
        NetworkState.UNKNOWN -> Icons.Filled.SignalWifiOff
    }
}

/**
 * Get network description based on state.
 */
private fun getNetworkDescription(state: NetworkState): String {
    return when (state) {
        NetworkState.WIFI -> "Connected via WiFi"
        NetworkState.CELLULAR -> "Connected via cellular"
        NetworkState.OFFLINE -> "No internet connection"
        NetworkState.UNKNOWN -> "Checking connection..."
    }
}

/**
 * Sync status card.
 */
@Composable
private fun SyncStatusCard(
    syncStatus: SyncStatus,
    lastSyncTime: Long?,
    isSyncing: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            SyncIcon(
                syncStatus = syncStatus,
                isSyncing = isSyncing,
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = syncStatus.description,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                lastSyncTime?.let { timestamp ->
                    Text(
                        text = "Last sync: ${formatRelativeTime(timestamp)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (syncStatus is SyncStatus.Syncing) {
                CircularProgressIndicator(
                    progress = { syncStatus.progress },
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp
                )
            }
        }
    }
}

/**
 * Quick actions row.
 */
@Composable
private fun QuickActionsRow(
    networkState: NetworkState,
    isSyncing: Boolean,
    onSyncNow: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Button(
            onClick = onSyncNow,
            enabled = networkState.isConnected && !isSyncing,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Filled.Sync,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Sync Now")
        }

        OutlinedButton(
            onClick = { /* Show queue */ },
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Filled.Refresh,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("View Queue")
        }
    }
}

/**
 * Pending operations card.
 */
@Composable
private fun PendingOperationsCard(
    pendingCount: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Pending Operations",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = pendingCount.toString(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "These items will sync when you're back online.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Conflict card.
 */
@Composable
private fun ConflictCard(
    conflict: SyncConflict,
    onResolve: (ConflictResolution) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = conflict.operationType.replace("_", " ").lowercase()
                        .replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = formatRelativeTime(conflict.localTimestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onResolve(ConflictResolution.CLIENT_WINS) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Keep Local", style = MaterialTheme.typography.labelSmall)
                }

                OutlinedButton(
                    onClick = { onResolve(ConflictResolution.SERVER_WINS) },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Keep Server", style = MaterialTheme.typography.labelSmall)
                }

                OutlinedButton(
                    onClick = { onResolve(ConflictResolution.MERGE) },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Merge", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

/**
 * Banner view for showing sync status at top of screens.
 */
@Composable
fun SyncStatusBanner(
    syncManager: SyncManager,
    modifier: Modifier = Modifier
) {
    val networkState by syncManager.networkState.collectAsState()
    val syncStatus by syncManager.syncStatus.collectAsState()
    val pendingCount by syncManager.pendingCount.collectAsState(initial = 0)

    val shouldShow = when (syncStatus) {
        is SyncStatus.Offline, is SyncStatus.Error, is SyncStatus.Syncing -> true
        else -> pendingCount > 0
    }

    AnimatedVisibility(
        visible = shouldShow,
        enter = expandVertically() + fadeIn(),
        exit = shrinkVertically() + fadeOut()
    ) {
        Surface(
            modifier = modifier.fillMaxWidth(),
            color = getBannerColor(syncStatus),
            tonalElevation = 2.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = getBannerIcon(syncStatus),
                    contentDescription = null,
                    tint = getBannerContentColor(syncStatus),
                    modifier = Modifier.size(18.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = getBannerText(syncStatus, pendingCount),
                    style = MaterialTheme.typography.bodySmall,
                    color = getBannerContentColor(syncStatus),
                    modifier = Modifier.weight(1f)
                )

                if (syncStatus is SyncStatus.Error) {
                    OutlinedButton(
                        onClick = { syncManager.triggerImmediateSync() },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = getBannerContentColor(syncStatus)
                        )
                    ) {
                        Text("Retry", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun getBannerColor(syncStatus: SyncStatus): Color {
    return when (syncStatus) {
        is SyncStatus.Offline -> MaterialTheme.colorScheme.surfaceVariant
        is SyncStatus.Syncing -> MaterialTheme.colorScheme.primaryContainer
        is SyncStatus.Error -> MaterialTheme.colorScheme.errorContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
}

@Composable
private fun getBannerContentColor(syncStatus: SyncStatus): Color {
    return when (syncStatus) {
        is SyncStatus.Offline -> MaterialTheme.colorScheme.onSurfaceVariant
        is SyncStatus.Syncing -> MaterialTheme.colorScheme.onPrimaryContainer
        is SyncStatus.Error -> MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

private fun getBannerIcon(syncStatus: SyncStatus): ImageVector {
    return when (syncStatus) {
        is SyncStatus.Offline -> Icons.Filled.CloudOff
        is SyncStatus.Syncing -> Icons.Filled.Sync
        is SyncStatus.Error -> Icons.Filled.Warning
        else -> Icons.Filled.Sync
    }
}

private fun getBannerText(syncStatus: SyncStatus, pendingCount: Int): String {
    return when (syncStatus) {
        is SyncStatus.Offline -> "You're offline"
        is SyncStatus.Syncing -> syncStatus.message
        is SyncStatus.Error -> syncStatus.message
        else -> "$pendingCount pending changes"
    }
}

/**
 * Format a timestamp as relative time.
 */
private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> "Just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(timestamp))
    }
}

// ============== Previews ==============

@Preview(showBackground = true)
@Composable
private fun PreviewSyncStatusCard() {
    MaterialTheme {
        SyncStatusCard(
            syncStatus = SyncStatus.Syncing(0.5f, "Processing messages..."),
            lastSyncTime = System.currentTimeMillis() - 3600_000,
            isSyncing = true
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun PreviewNetworkStatusCard() {
    MaterialTheme {
        NetworkStatusCard(networkState = NetworkState.WIFI)
    }
}

@Preview(showBackground = true)
@Composable
private fun PreviewPendingOperationsCard() {
    MaterialTheme {
        PendingOperationsCard(pendingCount = 5)
    }
}
