package network.buildit.modules.calling.ui

import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.calling.data.local.ActiveCallState
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

/**
 * Main active call screen.
 *
 * Displays:
 * - Remote video (full screen when in video call)
 * - Local video preview (picture-in-picture)
 * - Call controls (mute, video, speaker, end)
 * - Call duration and status
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallScreen(
    callId: String,
    viewModel: CallViewModel = hiltViewModel(),
    onCallEnded: () -> Unit = {}
) {
    val callState by viewModel.callState.collectAsState()
    val isMuted by viewModel.isMuted.collectAsState()
    val isVideoEnabled by viewModel.isVideoEnabled.collectAsState()
    val isSpeakerOn by viewModel.isSpeakerOn.collectAsState()
    val duration by viewModel.callDuration.collectAsState()
    val remoteVideoTrack by viewModel.remoteVideoTrack.collectAsState()
    val localVideoTrack by viewModel.localVideoTrack.collectAsState()

    LaunchedEffect(callId) {
        viewModel.setCallId(callId)
    }

    LaunchedEffect(callState) {
        if (callState?.state == "ended") {
            onCallEnded()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Remote video (full screen) or avatar
        if (callState?.callType == "video" && remoteVideoTrack != null) {
            RemoteVideoView(
                videoTrack = remoteVideoTrack,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Audio call or no video - show avatar
            AudioCallView(
                callState = callState,
                modifier = Modifier.fillMaxSize()
            )
        }

        // Local video preview (picture-in-picture)
        if (isVideoEnabled && localVideoTrack != null) {
            LocalVideoPreview(
                videoTrack = localVideoTrack,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
                    .size(120.dp, 160.dp)
            )
        }

        // Call info and controls overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top: Call status
            CallStatusBar(
                callState = callState,
                duration = duration
            )

            Spacer(modifier = Modifier.weight(1f))

            // Bottom: Controls
            CallControls(
                isMuted = isMuted,
                isVideoEnabled = isVideoEnabled,
                isSpeakerOn = isSpeakerOn,
                isVideoCall = callState?.callType == "video",
                onMuteToggle = { viewModel.toggleMute() },
                onVideoToggle = { viewModel.toggleVideo() },
                onSpeakerToggle = { viewModel.toggleSpeaker() },
                onSwitchCamera = { viewModel.switchCamera() },
                onEndCall = { viewModel.endCall() }
            )
        }
    }
}

/**
 * Call status bar at the top.
 */
@Composable
private fun CallStatusBar(
    callState: ActiveCallState?,
    duration: Long
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        // Status text
        Text(
            text = when (callState?.state) {
                "initiating" -> "Calling..."
                "ringing" -> "Ringing..."
                "connecting" -> "Connecting..."
                "connected" -> formatDuration(duration)
                "reconnecting" -> "Reconnecting..."
                "on_hold" -> "On Hold"
                else -> ""
            },
            style = MaterialTheme.typography.titleMedium,
            color = Color.White
        )

        // Encryption indicator
        if (callState?.isEncrypted == true) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Encrypted",
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "End-to-end encrypted",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF4CAF50)
                )
            }
        }
    }
}

/**
 * Audio call view with avatar and name.
 */
@Composable
private fun AudioCallView(
    callState: ActiveCallState?,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Avatar placeholder
        Surface(
            modifier = Modifier.size(120.dp),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Contact name
        Text(
            text = callState?.remoteName ?: "Unknown",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Call type indicator
        Text(
            text = if (callState?.callType == "video") "Video Call" else "Voice Call",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.7f)
        )
    }
}

/**
 * Call control buttons.
 */
@Composable
private fun CallControls(
    isMuted: Boolean,
    isVideoEnabled: Boolean,
    isSpeakerOn: Boolean,
    isVideoCall: Boolean,
    onMuteToggle: () -> Unit,
    onVideoToggle: () -> Unit,
    onSpeakerToggle: () -> Unit,
    onSwitchCamera: () -> Unit,
    onEndCall: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Mute button
        CallControlButton(
            icon = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
            label = if (isMuted) "Unmute" else "Mute",
            isActive = !isMuted,
            onClick = onMuteToggle
        )

        // Video toggle (only for video calls)
        if (isVideoCall) {
            CallControlButton(
                icon = if (isVideoEnabled) Icons.Default.Videocam else Icons.Default.VideocamOff,
                label = if (isVideoEnabled) "Camera Off" else "Camera On",
                isActive = isVideoEnabled,
                onClick = onVideoToggle
            )
        }

        // End call button
        Surface(
            modifier = Modifier.size(72.dp),
            shape = CircleShape,
            color = Color(0xFFE53935),
            onClick = onEndCall
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.CallEnd,
                    contentDescription = "End Call",
                    tint = Color.White,
                    modifier = Modifier.size(32.dp)
                )
            }
        }

        // Speaker toggle
        CallControlButton(
            icon = if (isSpeakerOn) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
            label = if (isSpeakerOn) "Speaker Off" else "Speaker On",
            isActive = isSpeakerOn,
            onClick = onSpeakerToggle
        )

        // Switch camera (only for video calls with camera enabled)
        if (isVideoCall && isVideoEnabled) {
            CallControlButton(
                icon = Icons.Default.Cameraswitch,
                label = "Switch",
                isActive = true,
                onClick = onSwitchCamera
            )
        } else if (!isVideoCall) {
            // Placeholder for alignment
            CallControlButton(
                icon = Icons.Default.MoreVert,
                label = "More",
                isActive = true,
                onClick = { }
            )
        }
    }
}

/**
 * Individual call control button.
 */
@Composable
private fun CallControlButton(
    icon: ImageVector,
    label: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            modifier = Modifier.size(56.dp),
            shape = CircleShape,
            color = if (isActive) Color.White.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.4f),
            onClick = onClick
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.7f)
        )
    }
}

/**
 * Remote video view using WebRTC SurfaceViewRenderer.
 */
@Composable
private fun RemoteVideoView(
    videoTrack: VideoTrack?,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    AndroidView(
        factory = { ctx ->
            SurfaceViewRenderer(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setScalingType(org.webrtc.RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                setMirror(false)
            }
        },
        modifier = modifier,
        update = { renderer ->
            videoTrack?.addSink(renderer)
        }
    )
}

/**
 * Local video preview (picture-in-picture).
 */
@Composable
private fun LocalVideoPreview(
    videoTrack: VideoTrack?,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        shadowElevation = 8.dp
    ) {
        AndroidView(
            factory = { ctx ->
                SurfaceViewRenderer(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setScalingType(org.webrtc.RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                    setMirror(true) // Mirror local preview
                }
            },
            modifier = Modifier.fillMaxSize(),
            update = { renderer ->
                videoTrack?.addSink(renderer)
            }
        )
    }
}

/**
 * Format duration as MM:SS or HH:MM:SS.
 */
private fun formatDuration(seconds: Long): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val secs = seconds % 60

    return if (hours > 0) {
        String.format("%02d:%02d:%02d", hours, minutes, secs)
    } else {
        String.format("%02d:%02d", minutes, secs)
    }
}
