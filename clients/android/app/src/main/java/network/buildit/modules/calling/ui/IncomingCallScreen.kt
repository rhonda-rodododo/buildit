package network.buildit.modules.calling.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.generated.schemas.calling.CallType

/**
 * Incoming call screen.
 *
 * Displays caller information and accept/decline buttons.
 * Shown as a full-screen overlay when receiving a call.
 */
@Composable
fun IncomingCallScreen(
    callId: String,
    callerName: String? = null,
    callerPubkey: String? = null,
    callType: CallType = CallType.Voice,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    viewModel: IncomingCallViewModel = hiltViewModel()
) {
    val callerInfo by viewModel.callerInfo.collectAsState()

    LaunchedEffect(callId) {
        viewModel.loadCallerInfo(callId)
    }

    // Pulsing animation for the avatar
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1A1A2E),
                        Color(0xFF16213E)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top section: Call type indicator
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 48.dp)
            ) {
                Icon(
                    imageVector = if (callType == CallType.Video) Icons.Default.Videocam else Icons.Default.Call,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.size(32.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = if (callType == CallType.Video) "Incoming Video Call" else "Incoming Call",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White.copy(alpha = 0.7f)
                )
            }

            // Center section: Caller info
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Animated avatar with ring effect
                Box(
                    contentAlignment = Alignment.Center
                ) {
                    // Outer pulsing ring
                    Surface(
                        modifier = Modifier
                            .size(160.dp)
                            .scale(scale),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                    ) {}

                    // Middle ring
                    Surface(
                        modifier = Modifier.size(140.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                    ) {}

                    // Avatar
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
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Caller name
                Text(
                    text = callerInfo?.name ?: callerName ?: "Unknown Caller",
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Caller pubkey (truncated)
                val pubkeyDisplay = callerInfo?.pubkey ?: callerPubkey
                if (pubkeyDisplay != null) {
                    Text(
                        text = truncatePubkey(pubkeyDisplay),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.5f)
                    )
                }

                // E2EE indicator
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Encrypted",
                        tint = Color(0xFF4CAF50),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "End-to-end encrypted",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF4CAF50)
                    )
                }
            }

            // Bottom section: Action buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 48.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Decline button
                CallActionButton(
                    icon = Icons.Default.CallEnd,
                    label = "Decline",
                    backgroundColor = Color(0xFFE53935),
                    onClick = {
                        viewModel.declineCall()
                        onDecline()
                    }
                )

                // Accept button
                if (callType == CallType.Video) {
                    // Video call: Accept with video
                    CallActionButton(
                        icon = Icons.Default.Videocam,
                        label = "Accept",
                        backgroundColor = Color(0xFF4CAF50),
                        onClick = {
                            viewModel.acceptCall(withVideo = true)
                            onAccept()
                        }
                    )
                } else {
                    // Voice call: Accept
                    CallActionButton(
                        icon = Icons.Default.Call,
                        label = "Accept",
                        backgroundColor = Color(0xFF4CAF50),
                        onClick = {
                            viewModel.acceptCall(withVideo = false)
                            onAccept()
                        }
                    )
                }
            }
        }

        // Quick actions (message, remind me later)
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            QuickActionButton(
                icon = Icons.Default.Message,
                label = "Message",
                onClick = {
                    // Would open quick message composer
                }
            )

            QuickActionButton(
                icon = Icons.Default.Alarm,
                label = "Remind Me",
                onClick = {
                    // Would set a reminder
                }
            )
        }
    }
}

/**
 * Large action button for accept/decline.
 */
@Composable
private fun CallActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    backgroundColor: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            modifier = Modifier.size(72.dp),
            shape = CircleShape,
            color = backgroundColor,
            onClick = onClick,
            shadowElevation = 8.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = Color.White,
                    modifier = Modifier.size(32.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White
        )
    }
}

/**
 * Small quick action button.
 */
@Composable
private fun QuickActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            modifier = Modifier.size(48.dp),
            shape = CircleShape,
            color = Color.White.copy(alpha = 0.1f),
            onClick = onClick
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.5f)
        )
    }
}

/**
 * Truncate pubkey for display.
 */
private fun truncatePubkey(pubkey: String): String {
    if (pubkey.length <= 16) return pubkey
    return "${pubkey.take(8)}...${pubkey.takeLast(8)}"
}
