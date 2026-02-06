package network.buildit.modules.messaging.presentation

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlin.math.sin
import kotlin.random.Random

/**
 * Recording state for voice messages.
 */
enum class VoiceRecordingState {
    IDLE,
    RECORDING,
    RECORDED,
    PLAYING
}

/**
 * Voice message recorder component.
 *
 * Features:
 * - Record audio with MediaRecorder
 * - Waveform visualization during recording
 * - Playback with waveform display
 * - Duration display
 * - Send/cancel actions
 */
@Composable
fun VoiceMessageRecorder(
    recordingState: VoiceRecordingState,
    duration: Long, // Duration in milliseconds
    amplitudes: List<Float> = emptyList(), // Normalized amplitudes (0-1)
    playbackProgress: Float = 0f, // 0-1
    onStartRecording: () -> Unit,
    onStopRecording: () -> Unit,
    onPlayPause: () -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant,
        shadowElevation = 2.dp
    ) {
        when (recordingState) {
            VoiceRecordingState.IDLE -> {
                IdleState(onStartRecording = onStartRecording)
            }
            VoiceRecordingState.RECORDING -> {
                RecordingState(
                    duration = duration,
                    amplitudes = amplitudes,
                    onStop = onStopRecording,
                    onCancel = onCancel
                )
            }
            VoiceRecordingState.RECORDED, VoiceRecordingState.PLAYING -> {
                RecordedState(
                    duration = duration,
                    amplitudes = amplitudes,
                    isPlaying = recordingState == VoiceRecordingState.PLAYING,
                    playbackProgress = playbackProgress,
                    onPlayPause = onPlayPause,
                    onCancel = onCancel,
                    onSend = onSend
                )
            }
        }
    }
}

@Composable
private fun IdleState(
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
            Icon(Icons.Default.Mic, contentDescription = "Record")
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "Tap to record",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RecordingState(
    duration: Long,
    amplitudes: List<Float>,
    onStop: () -> Unit,
    onCancel: () -> Unit
) {
    // Pulsing animation for recording indicator
    val infiniteTransition = rememberInfiniteTransition(label = "recording_pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Cancel button
        IconButton(onClick = onCancel) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Cancel",
                tint = MaterialTheme.colorScheme.error
            )
        }

        // Recording indicator + waveform
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Red dot indicator
            Canvas(modifier = Modifier.size(12.dp)) {
                drawCircle(
                    color = Color.Red.copy(alpha = pulseAlpha),
                    radius = size.minDimension / 2
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Duration
            Text(
                text = formatDuration(duration),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Waveform
            WaveformView(
                amplitudes = amplitudes,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .weight(1f)
                    .height(32.dp)
            )
        }

        // Stop button
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

@Composable
private fun RecordedState(
    duration: Long,
    amplitudes: List<Float>,
    isPlaying: Boolean,
    playbackProgress: Float,
    onPlayPause: () -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Cancel button
        IconButton(onClick = onCancel) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Cancel",
                tint = MaterialTheme.colorScheme.error
            )
        }

        // Play/pause button
        IconButton(onClick = onPlayPause) {
            Icon(
                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (isPlaying) "Pause" else "Play"
            )
        }

        // Waveform with progress
        Column(
            modifier = Modifier.weight(1f)
        ) {
            WaveformView(
                amplitudes = amplitudes,
                color = MaterialTheme.colorScheme.primary,
                progress = playbackProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(32.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = formatDuration(duration),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Send button
        FilledIconButton(
            onClick = onSend,
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            Icon(Icons.Default.Send, contentDescription = "Send")
        }
    }
}

/**
 * Waveform visualization component.
 *
 * Draws amplitude bars that represent the audio waveform.
 */
@Composable
fun WaveformView(
    amplitudes: List<Float>,
    color: Color,
    modifier: Modifier = Modifier,
    progress: Float = 1f,
    barWidth: Float = 3f,
    barSpacing: Float = 2f
) {
    val displayAmplitudes = if (amplitudes.isEmpty()) {
        // Generate placeholder waveform
        List(40) { Random.nextFloat() * 0.5f + 0.1f }
    } else {
        amplitudes
    }

    Canvas(modifier = modifier) {
        val totalBarWidth = barWidth + barSpacing
        val barCount = (size.width / totalBarWidth).toInt()
        val centerY = size.height / 2

        // Resample amplitudes to fit the display
        val sampledAmplitudes = resampleAmplitudes(displayAmplitudes, barCount)

        sampledAmplitudes.forEachIndexed { index, amplitude ->
            val x = index * totalBarWidth + barWidth / 2
            val barHeight = amplitude * size.height * 0.8f
            val halfHeight = barHeight / 2

            val progressRatio = if (barCount > 0) index.toFloat() / barCount else 0f
            val barColor = if (progressRatio <= progress) color else color.copy(alpha = 0.3f)

            drawLine(
                color = barColor,
                start = Offset(x, centerY - halfHeight),
                end = Offset(x, centerY + halfHeight),
                strokeWidth = barWidth,
                cap = StrokeCap.Round
            )
        }
    }
}

private fun resampleAmplitudes(amplitudes: List<Float>, targetCount: Int): List<Float> {
    if (amplitudes.isEmpty() || targetCount <= 0) return emptyList()
    if (amplitudes.size == targetCount) return amplitudes

    return List(targetCount) { index ->
        val sourceIndex = (index.toFloat() / targetCount * amplitudes.size).toInt()
            .coerceIn(0, amplitudes.size - 1)
        amplitudes[sourceIndex].coerceIn(0.05f, 1f)
    }
}

private fun formatDuration(millis: Long): String {
    val totalSeconds = millis / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
