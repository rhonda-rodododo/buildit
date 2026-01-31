package network.buildit.modules.calling.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import network.buildit.R
import network.buildit.modules.calling.service.MemberStatus
import network.buildit.modules.calling.service.PTTMember
import network.buildit.modules.calling.service.SpeakRequest

/**
 * PTT (Push-to-Talk) Screen.
 *
 * Displays:
 * - Channel header with member count and settings
 * - Large PTT button with visual feedback
 * - Current speaker indicator with audio level
 * - Speaker queue display
 * - VAD toggle control
 * - Members panel (online/offline)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PTTScreen(
    channelId: String,
    localPubkey: String,
    viewModel: PTTViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val uiEvent by viewModel.uiEvents.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Initialize ViewModel
    LaunchedEffect(channelId) {
        viewModel.initialize(channelId, localPubkey)
    }

    // Handle UI events
    LaunchedEffect(uiEvent) {
        when (val event = uiEvent) {
            is PTTUiEvent.ShowToast -> {
                scope.launch {
                    snackbarHostState.showSnackbar(event.message)
                }
            }
            is PTTUiEvent.NavigateBack -> {
                onNavigateBack()
            }
            PTTUiEvent.SpeakGranted -> {
                scope.launch {
                    snackbarHostState.showSnackbar("You can speak now")
                }
            }
            PTTUiEvent.SpeakTimeout -> {
                scope.launch {
                    snackbarHostState.showSnackbar("Speaking time expired")
                }
            }
            else -> { /* Ignore */ }
        }
        viewModel.clearUiEvent()
    }

    // Handle errors
    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { message ->
            scope.launch {
                snackbarHostState.showSnackbar(message)
                viewModel.dismissError()
            }
        }
    }

    Scaffold(
        topBar = {
            PTTTopBar(
                channelName = uiState.channelName,
                memberCount = uiState.memberCount,
                onBackClick = {
                    viewModel.leaveChannel()
                },
                onMembersClick = { viewModel.toggleMembersPanel() },
                onSettingsClick = { viewModel.toggleSettingsPanel() }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                PTTContent(
                    uiState = uiState,
                    onPTTPressed = { viewModel.onPTTButtonPressed() },
                    onPTTReleased = { viewModel.onPTTButtonReleased() },
                    onCancelRequest = { viewModel.cancelSpeakRequest() },
                    onToggleVAD = { viewModel.toggleVAD() }
                )
            }

            // Members Bottom Sheet
            if (uiState.showMembersPanel) {
                MembersBottomSheet(
                    onlineMembers = uiState.onlineMembers,
                    offlineMembers = uiState.offlineMembers,
                    currentSpeakerPubkey = uiState.currentSpeaker?.pubkey,
                    localPubkey = localPubkey,
                    onDismiss = { viewModel.toggleMembersPanel() }
                )
            }

            // Settings Bottom Sheet
            if (uiState.showSettingsPanel) {
                SettingsBottomSheet(
                    vadEnabled = uiState.vadEnabled,
                    onToggleVAD = { viewModel.toggleVAD() },
                    onDismiss = { viewModel.toggleSettingsPanel() }
                )
            }
        }
    }
}

/**
 * Top app bar with channel info and actions.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PTTTopBar(
    channelName: String,
    memberCount: Int,
    onBackClick: () -> Unit,
    onMembersClick: () -> Unit,
    onSettingsClick: () -> Unit
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    text = channelName.ifEmpty { stringResource(R.string.ptt_channel) },
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "$memberCount ${stringResource(R.string.ptt_members)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.ptt_leave_channel)
                )
            }
        },
        actions = {
            BadgedBox(
                badge = {
                    if (memberCount > 0) {
                        Badge { Text("$memberCount") }
                    }
                }
            ) {
                IconButton(onClick = onMembersClick) {
                    Icon(
                        imageVector = Icons.Default.People,
                        contentDescription = stringResource(R.string.ptt_members)
                    )
                }
            }
            IconButton(onClick = onSettingsClick) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = stringResource(R.string.ptt_settings)
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

/**
 * Main PTT content area.
 */
@Composable
private fun PTTContent(
    uiState: PTTUiState,
    onPTTPressed: () -> Unit,
    onPTTReleased: () -> Unit,
    onCancelRequest: () -> Unit,
    onToggleVAD: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Current speaker section
        CurrentSpeakerSection(
            currentSpeaker = uiState.currentSpeaker,
            audioLevel = uiState.audioLevel,
            isLocalUserSpeaking = uiState.isLocalUserSpeaking,
            speakTimeRemaining = uiState.speakTimeRemaining,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Speaker queue
        if (uiState.speakerQueue.isNotEmpty()) {
            SpeakerQueueSection(
                queue = uiState.speakerQueue,
                localPubkey = uiState.channelState?.members?.keys?.firstOrNull() ?: "",
                onCancelRequest = onCancelRequest,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        // Queue position indicator
        uiState.queuePosition?.let { position ->
            QueuePositionIndicator(
                position = position,
                onCancel = onCancelRequest
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        Spacer(modifier = Modifier.weight(1f))

        // PTT Button
        PTTButton(
            isPressed = uiState.isPTTButtonPressed,
            isSpeaking = uiState.isLocalUserSpeaking,
            audioLevel = uiState.audioLevel,
            onPress = onPTTPressed,
            onRelease = onPTTReleased
        )

        Spacer(modifier = Modifier.height(24.dp))

        // VAD Toggle
        VADToggle(
            enabled = uiState.vadEnabled,
            isSilent = uiState.isSilent,
            onToggle = onToggleVAD
        )

        Spacer(modifier = Modifier.height(16.dp))
    }
}

/**
 * Current speaker display with audio level visualization.
 */
@Composable
private fun CurrentSpeakerSection(
    currentSpeaker: PTTMember?,
    audioLevel: Float,
    isLocalUserSpeaking: Boolean,
    speakTimeRemaining: Long,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = if (currentSpeaker != null) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (currentSpeaker != null) {
                // Speaking indicator with audio level
                Box(contentAlignment = Alignment.Center) {
                    // Audio level ring
                    val animatedLevel by animateFloatAsState(
                        targetValue = audioLevel,
                        animationSpec = tween(100),
                        label = "audioLevel"
                    )

                    Canvas(modifier = Modifier.size(80.dp)) {
                        val ringWidth = 8.dp.toPx()
                        val radius = (size.minDimension - ringWidth) / 2

                        // Background ring
                        drawCircle(
                            color = Color.Gray.copy(alpha = 0.3f),
                            radius = radius,
                            style = Stroke(width = ringWidth, cap = StrokeCap.Round)
                        )

                        // Audio level ring
                        drawArc(
                            color = Color.Green,
                            startAngle = -90f,
                            sweepAngle = 360f * animatedLevel,
                            useCenter = false,
                            style = Stroke(width = ringWidth, cap = StrokeCap.Round)
                        )
                    }

                    // Speaker icon
                    Surface(
                        modifier = Modifier.size(56.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.VolumeUp,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = if (isLocalUserSpeaking) {
                        stringResource(R.string.ptt_you_are_speaking)
                    } else {
                        currentSpeaker.displayName ?: currentSpeaker.pubkey.take(8)
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                // Time remaining
                if (speakTimeRemaining > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.ptt_time_remaining, speakTimeRemaining / 1000),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    LinearProgressIndicator(
                        progress = { (speakTimeRemaining / 30000f).coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                    )
                }
            } else {
                // No one speaking
                Surface(
                    modifier = Modifier.size(64.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.MicOff,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.ptt_no_one_speaking),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = stringResource(R.string.ptt_press_to_talk),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        }
    }
}

/**
 * Speaker queue display.
 */
@Composable
private fun SpeakerQueueSection(
    queue: List<SpeakRequest>,
    localPubkey: String,
    onCancelRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Text(
                text = stringResource(R.string.ptt_queue),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            queue.forEachIndexed { index, request ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Position badge
                    Surface(
                        modifier = Modifier.size(24.dp),
                        shape = CircleShape,
                        color = when (request.priority) {
                            network.buildit.modules.calling.service.SpeakPriority.MODERATOR -> MaterialTheme.colorScheme.error
                            network.buildit.modules.calling.service.SpeakPriority.HIGH -> MaterialTheme.colorScheme.tertiary
                            else -> MaterialTheme.colorScheme.secondary
                        }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "${index + 1}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = if (request.pubkey == localPubkey) {
                            stringResource(R.string.ptt_you)
                        } else {
                            request.pubkey.take(8) + "..."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )

                    if (request.pubkey == localPubkey) {
                        Button(
                            onClick = onCancelRequest,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                                contentColor = MaterialTheme.colorScheme.onErrorContainer
                            )
                        ) {
                            Text(
                                text = stringResource(R.string.ptt_cancel),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Queue position indicator for the local user.
 */
@Composable
private fun QueuePositionIndicator(
    position: Int,
    onCancel: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = stringResource(R.string.ptt_queue_position, position),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onTertiaryContainer
            )

            Button(
                onClick = onCancel,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text(stringResource(R.string.ptt_cancel))
            }
        }
    }
}

/**
 * Large PTT button with press-and-hold interaction.
 */
@Composable
private fun PTTButton(
    isPressed: Boolean,
    isSpeaking: Boolean,
    audioLevel: Float,
    onPress: () -> Unit,
    onRelease: () -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = tween(100),
        label = "pttScale"
    )

    val backgroundColor = when {
        isSpeaking -> Color(0xFF4CAF50) // Green when speaking
        isPressed -> MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
        else -> MaterialTheme.colorScheme.primary
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(160.dp)
    ) {
        // Outer glow when speaking
        if (isSpeaking) {
            val glowAlpha by animateFloatAsState(
                targetValue = 0.3f + (audioLevel * 0.4f),
                animationSpec = tween(100),
                label = "glowAlpha"
            )

            Canvas(modifier = Modifier.fillMaxSize()) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            Color.Green.copy(alpha = glowAlpha),
                            Color.Transparent
                        )
                    ),
                    radius = size.minDimension / 2
                )
            }
        }

        Surface(
            modifier = Modifier
                .size(140.dp)
                .scale(scale)
                .pointerInput(Unit) {
                    detectTapGestures(
                        onPress = {
                            onPress()
                            tryAwaitRelease()
                            onRelease()
                        }
                    )
                },
            shape = CircleShape,
            color = backgroundColor,
            shadowElevation = if (isPressed) 2.dp else 8.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = if (isSpeaking) Icons.Default.Mic else Icons.Default.Mic,
                        contentDescription = stringResource(R.string.ptt_push_to_talk),
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = if (isSpeaking) {
                            stringResource(R.string.ptt_speaking)
                        } else {
                            stringResource(R.string.ptt_hold_to_talk)
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/**
 * VAD toggle control.
 */
@Composable
private fun VADToggle(
    enabled: Boolean,
    isSilent: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.ptt_vad),
            style = MaterialTheme.typography.bodyMedium
        )

        Spacer(modifier = Modifier.width(8.dp))

        Switch(
            checked = enabled,
            onCheckedChange = { onToggle() }
        )

        if (enabled && !isSilent) {
            Spacer(modifier = Modifier.width(8.dp))
            Surface(
                shape = CircleShape,
                color = Color.Green.copy(alpha = 0.8f),
                modifier = Modifier.size(8.dp)
            ) {}
        }
    }
}

/**
 * Members bottom sheet.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MembersBottomSheet(
    onlineMembers: List<PTTMember>,
    offlineMembers: List<PTTMember>,
    currentSpeakerPubkey: String?,
    localPubkey: String,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.ptt_members),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Online members
            if (onlineMembers.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.ptt_online, onlineMembers.size),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )

                LazyColumn {
                    items(onlineMembers) { member ->
                        MemberItem(
                            member = member,
                            isCurrentSpeaker = member.pubkey == currentSpeakerPubkey,
                            isLocalUser = member.pubkey == localPubkey
                        )
                    }
                }
            }

            // Offline members
            if (offlineMembers.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.ptt_offline, offlineMembers.size),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                LazyColumn {
                    items(offlineMembers) { member ->
                        MemberItem(
                            member = member,
                            isCurrentSpeaker = false,
                            isLocalUser = member.pubkey == localPubkey
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

/**
 * Member list item.
 */
@Composable
private fun MemberItem(
    member: PTTMember,
    isCurrentSpeaker: Boolean,
    isLocalUser: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Status indicator
        Surface(
            modifier = Modifier.size(40.dp),
            shape = CircleShape,
            color = when {
                isCurrentSpeaker -> Color.Green
                member.status == MemberStatus.ONLINE -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = if (isCurrentSpeaker) Icons.Default.VolumeUp else Icons.Default.Person,
                    contentDescription = null,
                    tint = if (member.status == MemberStatus.OFFLINE) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        Color.White
                    },
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = member.displayName ?: member.pubkey.take(8) + "...",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isCurrentSpeaker) FontWeight.Bold else FontWeight.Normal
                )

                if (isLocalUser) {
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "(${stringResource(R.string.ptt_you)})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                if (member.isModerator) {
                    Spacer(modifier = Modifier.width(4.dp))
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.tertiaryContainer
                    ) {
                        Text(
                            text = stringResource(R.string.ptt_moderator),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                    }
                }
            }

            Text(
                text = when (member.status) {
                    MemberStatus.SPEAKING -> stringResource(R.string.ptt_status_speaking)
                    MemberStatus.ONLINE -> stringResource(R.string.ptt_status_online)
                    MemberStatus.LISTENING -> stringResource(R.string.ptt_status_listening)
                    MemberStatus.OFFLINE -> stringResource(R.string.ptt_status_offline)
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Settings bottom sheet.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsBottomSheet(
    vadEnabled: Boolean,
    onToggleVAD: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.ptt_settings),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // VAD Setting
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = stringResource(R.string.ptt_vad_full),
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = stringResource(R.string.ptt_vad_description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Switch(
                    checked = vadEnabled,
                    onCheckedChange = { onToggleVAD() }
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Info section
            Text(
                text = stringResource(R.string.ptt_timeout_info),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
