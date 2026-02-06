package network.buildit.modules.messaging.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Video recording state.
 */
enum class VideoRecordingState {
    IDLE,
    RECORDING,
    PREVIEW,
    PROCESSING
}

/**
 * Video message recorder component.
 *
 * Features:
 * - Record short video (max 60 seconds)
 * - Preview before sending
 * - Duration countdown display
 * - Thumbnail generation
 * - Send/cancel/retake actions
 */
@Composable
fun VideoMessageRecorder(
    recordingState: VideoRecordingState,
    duration: Long, // Duration in milliseconds
    maxDuration: Long = 60_000, // 60 seconds max
    thumbnailUri: String? = null,
    onStartRecording: () -> Unit,
    onStopRecording: () -> Unit,
    onCancel: () -> Unit,
    onRetake: () -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        when (recordingState) {
            VideoRecordingState.IDLE -> {
                VideoIdleState(onStartRecording = onStartRecording)
            }
            VideoRecordingState.RECORDING -> {
                VideoRecordingActiveState(
                    duration = duration,
                    maxDuration = maxDuration,
                    onStop = onStopRecording,
                    onCancel = onCancel
                )
            }
            VideoRecordingState.PREVIEW -> {
                VideoPreviewState(
                    duration = duration,
                    onRetake = onRetake,
                    onCancel = onCancel,
                    onSend = onSend
                )
            }
            VideoRecordingState.PROCESSING -> {
                VideoProcessingState()
            }
        }
    }
}

@Composable
private fun VideoIdleState(
    onStartRecording: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        FilledIconButton(
            onClick = onStartRecording,
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = MaterialTheme.colorScheme.error
            )
        ) {
            Icon(Icons.Default.Videocam, contentDescription = "Record video")
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "Tap to record video (max 60s)",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun VideoRecordingActiveState(
    duration: Long,
    maxDuration: Long,
    onStop: () -> Unit,
    onCancel: () -> Unit
) {
    val progress = (duration.toFloat() / maxDuration).coerceIn(0f, 1f)
    val remainingSeconds = ((maxDuration - duration) / 1000).coerceAtLeast(0)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
    ) {
        // Recording progress bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp),
            color = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Cancel
            IconButton(onClick = onCancel) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Cancel",
                    tint = MaterialTheme.colorScheme.error
                )
            }

            // Recording info
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Default.FiberManualRecord,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                    tint = Color.Red
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = formatVideoDuration(duration),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${remainingSeconds}s left",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Stop
            FilledIconButton(
                onClick = onStop,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.Stop, contentDescription = "Stop recording")
            }
        }
    }
}

@Composable
private fun VideoPreviewState(
    duration: Long,
    onRetake: () -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
    ) {
        // Placeholder for video preview (actual CameraX preview would be here)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .background(
                    MaterialTheme.colorScheme.surfaceContainerHighest,
                    MaterialTheme.shapes.medium
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.VideoFile,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatVideoDuration(duration),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            // Cancel
            OutlinedButton(onClick = onCancel) {
                Icon(Icons.Default.Delete, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Cancel")
            }

            // Retake
            OutlinedButton(onClick = onRetake) {
                Icon(Icons.Default.Replay, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Retake")
            }

            // Send
            Button(onClick = onSend) {
                Icon(Icons.Default.Send, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Send")
            }
        }
    }
}

@Composable
private fun VideoProcessingState() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "Processing video...",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun formatVideoDuration(millis: Long): String {
    val totalSeconds = millis / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
