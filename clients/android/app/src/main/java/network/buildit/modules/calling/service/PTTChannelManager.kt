package network.buildit.modules.calling.service

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.crypto.CryptoManager
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Nostr event kinds for PTT signaling (24370-24376 range)
 */
object PTTNostrKinds {
    const val PTT_CHANNEL_CREATE = 24370
    const val PTT_CHANNEL_JOIN = 24371
    const val PTT_CHANNEL_LEAVE = 24372
    const val PTT_SPEAK_REQUEST = 24373
    const val PTT_SPEAK_GRANT = 24374
    const val PTT_SPEAK_RELEASE = 24375
    const val PTT_AUDIO_PACKET = 24376
}

/**
 * Priority levels for speak requests.
 * Moderator > High > Normal in queue ordering.
 */
enum class SpeakPriority(val weight: Int) {
    NORMAL(1),
    HIGH(10),
    MODERATOR(100)
}

/**
 * Member status in a PTT channel.
 */
enum class MemberStatus {
    ONLINE,
    OFFLINE,
    SPEAKING,
    LISTENING
}

/**
 * Represents a member in a PTT channel.
 */
data class PTTMember(
    val pubkey: String,
    val displayName: String? = null,
    val status: MemberStatus = MemberStatus.ONLINE,
    val isModerator: Boolean = false,
    val joinedAt: Long = System.currentTimeMillis()
)

/**
 * Represents a speak request in the queue.
 */
data class SpeakRequest(
    val pubkey: String,
    val priority: SpeakPriority,
    val requestedAt: Long = System.currentTimeMillis()
)

/**
 * Represents a PTT channel.
 */
data class PTTChannel(
    val channelId: String,
    val groupId: String,
    val name: String,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis(),
    val maxParticipants: Int = 50,
    val isE2EE: Boolean = true,
    val speakTimeoutMs: Long = 30_000L
)

/**
 * Channel state including members and speaker info.
 */
data class PTTChannelState(
    val channel: PTTChannel,
    val members: Map<String, PTTMember> = emptyMap(),
    val currentSpeaker: String? = null,
    val speakerStartedAt: Long? = null,
    val speakerQueue: List<SpeakRequest> = emptyList(),
    val isActive: Boolean = true
)

/**
 * Events emitted by the PTT channel manager.
 */
sealed class PTTChannelEvent {
    data class ChannelCreated(val channel: PTTChannel) : PTTChannelEvent()
    data class ChannelJoined(val channelId: String, val member: PTTMember) : PTTChannelEvent()
    data class ChannelLeft(val channelId: String, val pubkey: String) : PTTChannelEvent()
    data class SpeakerChanged(val channelId: String, val speakerPubkey: String?) : PTTChannelEvent()
    data class QueueUpdated(val channelId: String, val queue: List<SpeakRequest>) : PTTChannelEvent()
    data class SpeakGranted(val channelId: String, val pubkey: String) : PTTChannelEvent()
    data class SpeakDenied(val channelId: String, val pubkey: String, val queuePosition: Int) : PTTChannelEvent()
    data class SpeakReleased(val channelId: String, val pubkey: String, val reason: String) : PTTChannelEvent()
    data class SpeakTimeout(val channelId: String, val pubkey: String) : PTTChannelEvent()
    data class ChannelActivity(val channelId: String, val activityType: String, val data: Map<String, Any?>) : PTTChannelEvent()
    data class MemberStatusChanged(val channelId: String, val pubkey: String, val status: MemberStatus) : PTTChannelEvent()
    data class Error(val message: String, val exception: Exception?) : PTTChannelEvent()
}

/**
 * Nostr signaling message types for serialization.
 */
@Serializable
data class PTTChannelCreateMessage(
    val channelId: String,
    val groupId: String,
    val name: String,
    val createdBy: String,
    val maxParticipants: Int,
    val timestamp: Long
)

@Serializable
data class PTTChannelJoinMessage(
    val channelId: String,
    val pubkey: String,
    val displayName: String?,
    val timestamp: Long
)

@Serializable
data class PTTChannelLeaveMessage(
    val channelId: String,
    val pubkey: String,
    val timestamp: Long
)

@Serializable
data class PTTSpeakRequestMessage(
    val channelId: String,
    val pubkey: String,
    val priority: String,
    val timestamp: Long
)

@Serializable
data class PTTSpeakGrantMessage(
    val channelId: String,
    val pubkey: String,
    val grantedBy: String,
    val timestamp: Long
)

@Serializable
data class PTTSpeakReleaseMessage(
    val channelId: String,
    val pubkey: String,
    val reason: String,
    val timestamp: Long
)

/**
 * PTT Channel Manager.
 *
 * Manages Push-to-Talk channels with:
 * - Channel creation, joining, and leaving
 * - Speaker queue with priority ordering (moderator > high > normal)
 * - 30-second speak timeout with auto-release
 * - Nostr signaling for distributed state
 * - Flow-based reactive events
 */
@Singleton
class PTTChannelManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager
) {
    companion object {
        private const val TAG = "PTTChannelManager"
        private const val DEFAULT_SPEAK_TIMEOUT_MS = 30_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Local user's pubkey */
    private var localPubkey: String = ""
    private var localDisplayName: String? = null

    /** Active channels by ID */
    private val channels = ConcurrentHashMap<String, PTTChannelState>()

    /** Speak timeout timers by channel ID */
    private val speakTimeoutJobs = ConcurrentHashMap<String, Job>()

    /** VAD auto-release timers by channel ID */
    private val vadSilenceJobs = ConcurrentHashMap<String, Job>()

    // ============================================
    // State Flows
    // ============================================

    private val _channelStates = MutableStateFlow<Map<String, PTTChannelState>>(emptyMap())
    /** Observable channel states */
    val channelStates: StateFlow<Map<String, PTTChannelState>> = _channelStates.asStateFlow()

    private val _currentChannel = MutableStateFlow<PTTChannelState?>(null)
    /** Current active channel (user can be in multiple, but one is "focused") */
    val currentChannel: StateFlow<PTTChannelState?> = _currentChannel.asStateFlow()

    private val _events = MutableSharedFlow<PTTChannelEvent>()
    /** Event stream for UI updates */
    val events: SharedFlow<PTTChannelEvent> = _events.asSharedFlow()

    private val _isSpeaking = MutableStateFlow(false)
    /** Whether the local user is currently speaking */
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    // ============================================
    // Initialization
    // ============================================

    /**
     * Set the local user's identity.
     *
     * @param pubkey Local user's Nostr pubkey.
     * @param displayName Optional display name.
     */
    fun setLocalIdentity(pubkey: String, displayName: String? = null) {
        this.localPubkey = pubkey
        this.localDisplayName = displayName
    }

    // ============================================
    // Channel Management
    // ============================================

    /**
     * Create a new PTT channel.
     *
     * @param groupId Group context for the channel.
     * @param name Display name for the channel.
     * @param maxParticipants Maximum number of participants (default 50).
     * @return The created channel.
     */
    suspend fun createChannel(
        groupId: String,
        name: String,
        maxParticipants: Int = 50
    ): PTTChannel {
        val channelId = UUID.randomUUID().toString().lowercase()
        val channel = PTTChannel(
            channelId = channelId,
            groupId = groupId,
            name = name,
            createdBy = localPubkey,
            maxParticipants = maxParticipants
        )

        val localMember = PTTMember(
            pubkey = localPubkey,
            displayName = localDisplayName,
            status = MemberStatus.ONLINE,
            isModerator = true
        )

        val state = PTTChannelState(
            channel = channel,
            members = mapOf(localPubkey to localMember)
        )

        channels[channelId] = state
        syncChannelStates()
        _currentChannel.value = state

        // Broadcast channel creation via Nostr
        broadcastChannelCreate(channel)

        Log.i(TAG, "Created PTT channel: $channelId ($name)")

        scope.launch {
            _events.emit(PTTChannelEvent.ChannelCreated(channel))
        }

        return channel
    }

    /**
     * Join an existing PTT channel.
     *
     * @param channelId The channel to join.
     * @param displayName Optional display name for this session.
     */
    suspend fun joinChannel(channelId: String, displayName: String? = null) {
        val existingState = channels[channelId]
        if (existingState != null && existingState.members.containsKey(localPubkey)) {
            Log.w(TAG, "Already in channel: $channelId")
            return
        }

        val member = PTTMember(
            pubkey = localPubkey,
            displayName = displayName ?: localDisplayName,
            status = MemberStatus.ONLINE
        )

        val newState = if (existingState != null) {
            existingState.copy(
                members = existingState.members + (localPubkey to member)
            )
        } else {
            // Channel doesn't exist locally - create placeholder
            // Real state will come from Nostr sync
            PTTChannelState(
                channel = PTTChannel(
                    channelId = channelId,
                    groupId = "",
                    name = "Unknown Channel",
                    createdBy = ""
                ),
                members = mapOf(localPubkey to member)
            )
        }

        channels[channelId] = newState
        syncChannelStates()
        _currentChannel.value = newState

        // Broadcast join via Nostr
        broadcastJoin(channelId, member)

        Log.i(TAG, "Joined PTT channel: $channelId")

        scope.launch {
            _events.emit(PTTChannelEvent.ChannelJoined(channelId, member))
        }
    }

    /**
     * Leave a PTT channel.
     *
     * @param channelId The channel to leave.
     */
    suspend fun leaveChannel(channelId: String) {
        val state = channels[channelId] ?: return

        // If currently speaking, release first
        if (state.currentSpeaker == localPubkey) {
            releaseSpeak(channelId, "leave")
        }

        // Remove from queue if pending
        val newQueue = state.speakerQueue.filter { it.pubkey != localPubkey }

        val newState = state.copy(
            members = state.members - localPubkey,
            speakerQueue = newQueue
        )

        if (newState.members.isEmpty()) {
            channels.remove(channelId)
        } else {
            channels[channelId] = newState
        }

        syncChannelStates()

        if (_currentChannel.value?.channel?.channelId == channelId) {
            _currentChannel.value = null
        }

        // Broadcast leave via Nostr
        broadcastLeave(channelId)

        Log.i(TAG, "Left PTT channel: $channelId")

        scope.launch {
            _events.emit(PTTChannelEvent.ChannelLeft(channelId, localPubkey))
            if (newQueue.size != state.speakerQueue.size) {
                _events.emit(PTTChannelEvent.QueueUpdated(channelId, newQueue))
            }
        }
    }

    // ============================================
    // Speaking Controls
    // ============================================

    /**
     * Request to speak in a channel.
     *
     * @param channelId The channel to speak in.
     * @param priority Speaking priority (default: NORMAL).
     * @return True if granted immediately, false if queued.
     */
    suspend fun requestSpeak(
        channelId: String,
        priority: SpeakPriority = SpeakPriority.NORMAL
    ): Boolean {
        val state = channels[channelId] ?: run {
            Log.w(TAG, "Cannot request speak: not in channel $channelId")
            return false
        }

        // Already speaking?
        if (state.currentSpeaker == localPubkey) {
            Log.d(TAG, "Already speaking in channel: $channelId")
            return true
        }

        // Already in queue?
        if (state.speakerQueue.any { it.pubkey == localPubkey }) {
            Log.d(TAG, "Already in queue for channel: $channelId")
            return false
        }

        // Check if local user is a moderator
        val effectivePriority = if (state.members[localPubkey]?.isModerator == true) {
            SpeakPriority.MODERATOR
        } else {
            priority
        }

        val request = SpeakRequest(
            pubkey = localPubkey,
            priority = effectivePriority
        )

        // Grant immediately if no one speaking
        if (state.currentSpeaker == null) {
            grantSpeak(channelId, localPubkey)

            // Broadcast via Nostr
            broadcastSpeakRequest(channelId, request)
            broadcastSpeakGrant(channelId, localPubkey)

            Log.i(TAG, "Speak granted immediately in channel: $channelId")

            scope.launch {
                _events.emit(PTTChannelEvent.SpeakGranted(channelId, localPubkey))
            }

            return true
        }

        // Add to queue with priority ordering
        val newQueue = insertByPriority(state.speakerQueue, request)
        val queuePosition = newQueue.indexOfFirst { it.pubkey == localPubkey } + 1

        channels[channelId] = state.copy(speakerQueue = newQueue)
        syncChannelStates()

        // Broadcast request via Nostr
        broadcastSpeakRequest(channelId, request)

        Log.i(TAG, "Speak request queued at position $queuePosition in channel: $channelId")

        scope.launch {
            _events.emit(PTTChannelEvent.SpeakDenied(channelId, localPubkey, queuePosition))
            _events.emit(PTTChannelEvent.QueueUpdated(channelId, newQueue))
        }

        return false
    }

    /**
     * Release speaking in a channel.
     *
     * @param channelId The channel to release speaking in.
     * @param reason Reason for release (e.g., "manual", "timeout", "vad-silence", "leave").
     */
    suspend fun releaseSpeak(channelId: String, reason: String = "manual") {
        val state = channels[channelId] ?: return

        if (state.currentSpeaker != localPubkey) {
            // Remove from queue if present
            val newQueue = state.speakerQueue.filter { it.pubkey != localPubkey }
            if (newQueue.size != state.speakerQueue.size) {
                channels[channelId] = state.copy(speakerQueue = newQueue)
                syncChannelStates()

                scope.launch {
                    _events.emit(PTTChannelEvent.QueueUpdated(channelId, newQueue))
                }
            }
            return
        }

        // Clear speak timeout
        clearSpeakTimeout(channelId)
        clearVadSilenceTimer(channelId)

        _isSpeaking.value = false

        // Broadcast release via Nostr
        broadcastSpeakRelease(channelId, reason)

        Log.i(TAG, "Speak released in channel: $channelId, reason: $reason")

        scope.launch {
            _events.emit(PTTChannelEvent.SpeakReleased(channelId, localPubkey, reason))
        }

        // Grant to next in queue
        grantNextInQueue(channelId)
    }

    /**
     * Cancel a pending speak request.
     *
     * @param channelId The channel to cancel the request in.
     */
    suspend fun cancelSpeakRequest(channelId: String) {
        val state = channels[channelId] ?: return

        val newQueue = state.speakerQueue.filter { it.pubkey != localPubkey }
        if (newQueue.size != state.speakerQueue.size) {
            channels[channelId] = state.copy(speakerQueue = newQueue)
            syncChannelStates()

            Log.d(TAG, "Speak request cancelled in channel: $channelId")

            scope.launch {
                _events.emit(PTTChannelEvent.QueueUpdated(channelId, newQueue))
            }
        }
    }

    // ============================================
    // Queue Management
    // ============================================

    /**
     * Get the current speaker queue for a channel.
     *
     * @param channelId The channel ID.
     * @return List of speak requests in priority order.
     */
    fun getQueue(channelId: String): List<SpeakRequest> {
        return channels[channelId]?.speakerQueue ?: emptyList()
    }

    /**
     * Get queue position for a specific user.
     *
     * @param channelId The channel ID.
     * @param pubkey The user's pubkey.
     * @return Queue position (1-based) or null if not in queue.
     */
    fun getQueuePosition(channelId: String, pubkey: String): Int? {
        val queue = channels[channelId]?.speakerQueue ?: return null
        val index = queue.indexOfFirst { it.pubkey == pubkey }
        return if (index >= 0) index + 1 else null
    }

    /**
     * Insert a speak request in priority order.
     * Priority: MODERATOR > HIGH > NORMAL, then by request time (FIFO within same priority).
     */
    private fun insertByPriority(queue: List<SpeakRequest>, request: SpeakRequest): List<SpeakRequest> {
        val mutableQueue = queue.toMutableList()
        val insertIndex = mutableQueue.indexOfFirst { existing ->
            existing.priority.weight < request.priority.weight ||
                (existing.priority == request.priority && existing.requestedAt > request.requestedAt)
        }

        if (insertIndex == -1) {
            mutableQueue.add(request)
        } else {
            mutableQueue.add(insertIndex, request)
        }

        return mutableQueue
    }

    /**
     * Grant speaking to a specific user.
     */
    private fun grantSpeak(channelId: String, pubkey: String) {
        val state = channels[channelId] ?: return
        val now = System.currentTimeMillis()

        // Remove from queue if present
        val newQueue = state.speakerQueue.filter { it.pubkey != pubkey }

        // Update member status
        val updatedMembers = state.members.mapValues { (key, member) ->
            when (key) {
                pubkey -> member.copy(status = MemberStatus.SPEAKING)
                state.currentSpeaker -> member.copy(status = MemberStatus.ONLINE)
                else -> member
            }
        }

        channels[channelId] = state.copy(
            currentSpeaker = pubkey,
            speakerStartedAt = now,
            speakerQueue = newQueue,
            members = updatedMembers
        )
        syncChannelStates()

        // Update local speaking state
        _isSpeaking.value = (pubkey == localPubkey)

        // Start speak timeout
        startSpeakTimeout(channelId, pubkey)

        scope.launch {
            _events.emit(PTTChannelEvent.SpeakerChanged(channelId, pubkey))
            if (newQueue.size != state.speakerQueue.size) {
                _events.emit(PTTChannelEvent.QueueUpdated(channelId, newQueue))
            }
        }
    }

    /**
     * Grant speaking to the next person in queue.
     */
    private suspend fun grantNextInQueue(channelId: String) {
        val state = channels[channelId] ?: return

        // Clear current speaker
        val updatedMembers = state.members.mapValues { (key, member) ->
            if (key == state.currentSpeaker) {
                member.copy(status = MemberStatus.ONLINE)
            } else {
                member
            }
        }

        // Get next from queue
        val nextRequest = state.speakerQueue.firstOrNull()

        if (nextRequest != null) {
            // Grant to next in queue
            grantSpeak(channelId, nextRequest.pubkey)

            scope.launch {
                _events.emit(PTTChannelEvent.SpeakGranted(channelId, nextRequest.pubkey))
            }
        } else {
            // No one in queue, clear speaker
            channels[channelId] = state.copy(
                currentSpeaker = null,
                speakerStartedAt = null,
                members = updatedMembers
            )
            syncChannelStates()

            scope.launch {
                _events.emit(PTTChannelEvent.SpeakerChanged(channelId, null))
            }
        }
    }

    // ============================================
    // Speak Timeout
    // ============================================

    /**
     * Start the 30-second speak timeout.
     */
    private fun startSpeakTimeout(channelId: String, pubkey: String) {
        clearSpeakTimeout(channelId)

        val timeoutMs = channels[channelId]?.channel?.speakTimeoutMs ?: DEFAULT_SPEAK_TIMEOUT_MS

        val job = scope.launch {
            delay(timeoutMs)
            handleSpeakTimeout(channelId, pubkey)
        }
        speakTimeoutJobs[channelId] = job
    }

    /**
     * Clear the speak timeout timer.
     */
    private fun clearSpeakTimeout(channelId: String) {
        speakTimeoutJobs.remove(channelId)?.cancel()
    }

    /**
     * Handle speak timeout - auto-release.
     */
    private suspend fun handleSpeakTimeout(channelId: String, pubkey: String) {
        val state = channels[channelId] ?: return

        if (state.currentSpeaker != pubkey) return

        Log.i(TAG, "Speak timeout for $pubkey in channel: $channelId")

        scope.launch {
            _events.emit(PTTChannelEvent.SpeakTimeout(channelId, pubkey))
        }

        // Release speak
        if (pubkey == localPubkey) {
            releaseSpeak(channelId, "timeout")
        } else {
            // Remote user timeout - just update local state
            grantNextInQueue(channelId)
        }
    }

    // ============================================
    // VAD Integration
    // ============================================

    /**
     * Notify that voice activity was detected.
     * Clears any silence timer.
     */
    fun onVoiceActivityDetected(channelId: String) {
        clearVadSilenceTimer(channelId)
    }

    /**
     * Notify that silence was detected.
     * Starts a timer to auto-release if silence continues.
     *
     * @param channelId The channel ID.
     * @param silenceTimeoutMs Time in ms before auto-release on silence (default 2000ms).
     */
    fun onSilenceDetected(channelId: String, silenceTimeoutMs: Long = 2000L) {
        val state = channels[channelId] ?: return

        if (state.currentSpeaker != localPubkey) return

        // Already have a timer?
        if (vadSilenceJobs.containsKey(channelId)) return

        val job = scope.launch {
            delay(silenceTimeoutMs)
            handleVadSilenceTimeout(channelId)
        }
        vadSilenceJobs[channelId] = job
    }

    /**
     * Clear VAD silence timer.
     */
    private fun clearVadSilenceTimer(channelId: String) {
        vadSilenceJobs.remove(channelId)?.cancel()
    }

    /**
     * Handle VAD silence timeout - auto-release.
     */
    private suspend fun handleVadSilenceTimeout(channelId: String) {
        val state = channels[channelId] ?: return

        if (state.currentSpeaker != localPubkey) return

        Log.i(TAG, "VAD silence timeout in channel: $channelId")

        releaseSpeak(channelId, "vad-silence")
    }

    // ============================================
    // Remote Event Handling
    // ============================================

    /**
     * Handle incoming Nostr event for PTT signaling.
     *
     * @param event The Nostr event.
     * @return True if the event was handled.
     */
    suspend fun handleNostrEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            PTTNostrKinds.PTT_CHANNEL_CREATE -> {
                handleRemoteChannelCreate(event)
                true
            }
            PTTNostrKinds.PTT_CHANNEL_JOIN -> {
                handleRemoteChannelJoin(event)
                true
            }
            PTTNostrKinds.PTT_CHANNEL_LEAVE -> {
                handleRemoteChannelLeave(event)
                true
            }
            PTTNostrKinds.PTT_SPEAK_REQUEST -> {
                handleRemoteSpeakRequest(event)
                true
            }
            PTTNostrKinds.PTT_SPEAK_GRANT -> {
                handleRemoteSpeakGrant(event)
                true
            }
            PTTNostrKinds.PTT_SPEAK_RELEASE -> {
                handleRemoteSpeakRelease(event)
                true
            }
            else -> false
        }
    }

    private suspend fun handleRemoteChannelCreate(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTChannelCreateMessage>(event.content)

            if (channels.containsKey(message.channelId)) return

            val channel = PTTChannel(
                channelId = message.channelId,
                groupId = message.groupId,
                name = message.name,
                createdBy = message.createdBy,
                maxParticipants = message.maxParticipants,
                createdAt = message.timestamp
            )

            val creatorMember = PTTMember(
                pubkey = message.createdBy,
                status = MemberStatus.ONLINE,
                isModerator = true
            )

            val state = PTTChannelState(
                channel = channel,
                members = mapOf(message.createdBy to creatorMember)
            )

            channels[message.channelId] = state
            syncChannelStates()

            Log.d(TAG, "Remote channel created: ${message.channelId}")

            _events.emit(PTTChannelEvent.ChannelCreated(channel))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote channel create", e)
        }
    }

    private suspend fun handleRemoteChannelJoin(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTChannelJoinMessage>(event.content)

            if (message.pubkey == localPubkey) return

            val state = channels[message.channelId] ?: return

            val member = PTTMember(
                pubkey = message.pubkey,
                displayName = message.displayName,
                status = MemberStatus.ONLINE,
                joinedAt = message.timestamp
            )

            channels[message.channelId] = state.copy(
                members = state.members + (message.pubkey to member)
            )
            syncChannelStates()

            Log.d(TAG, "Remote member joined: ${message.pubkey} in channel ${message.channelId}")

            _events.emit(PTTChannelEvent.ChannelJoined(message.channelId, member))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote channel join", e)
        }
    }

    private suspend fun handleRemoteChannelLeave(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTChannelLeaveMessage>(event.content)

            if (message.pubkey == localPubkey) return

            val state = channels[message.channelId] ?: return

            // Remove from speaker if they were speaking
            var newState = if (state.currentSpeaker == message.pubkey) {
                state.copy(
                    currentSpeaker = null,
                    speakerStartedAt = null
                )
            } else {
                state
            }

            // Remove from queue
            val newQueue = newState.speakerQueue.filter { it.pubkey != message.pubkey }

            // Remove from members
            newState = newState.copy(
                members = newState.members - message.pubkey,
                speakerQueue = newQueue
            )

            channels[message.channelId] = newState
            syncChannelStates()

            Log.d(TAG, "Remote member left: ${message.pubkey} from channel ${message.channelId}")

            _events.emit(PTTChannelEvent.ChannelLeft(message.channelId, message.pubkey))

            // Process queue if speaker left
            if (state.currentSpeaker == message.pubkey) {
                grantNextInQueue(message.channelId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote channel leave", e)
        }
    }

    private suspend fun handleRemoteSpeakRequest(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTSpeakRequestMessage>(event.content)

            if (message.pubkey == localPubkey) return

            val state = channels[message.channelId] ?: return

            val priority = try {
                SpeakPriority.valueOf(message.priority.uppercase())
            } catch (_: Exception) {
                SpeakPriority.NORMAL
            }

            val request = SpeakRequest(
                pubkey = message.pubkey,
                priority = priority,
                requestedAt = message.timestamp
            )

            // If no one speaking, this will be handled by the grant message
            // Just add to queue for now
            if (state.currentSpeaker != null && !state.speakerQueue.any { it.pubkey == message.pubkey }) {
                val newQueue = insertByPriority(state.speakerQueue, request)
                channels[message.channelId] = state.copy(speakerQueue = newQueue)
                syncChannelStates()

                _events.emit(PTTChannelEvent.QueueUpdated(message.channelId, newQueue))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote speak request", e)
        }
    }

    private suspend fun handleRemoteSpeakGrant(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTSpeakGrantMessage>(event.content)

            if (message.pubkey == localPubkey) return

            grantSpeak(message.channelId, message.pubkey)

            Log.d(TAG, "Remote speak granted: ${message.pubkey} in channel ${message.channelId}")

            _events.emit(PTTChannelEvent.SpeakGranted(message.channelId, message.pubkey))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote speak grant", e)
        }
    }

    private suspend fun handleRemoteSpeakRelease(event: NostrEvent) {
        try {
            val message = json.decodeFromString<PTTSpeakReleaseMessage>(event.content)

            if (message.pubkey == localPubkey) return

            val state = channels[message.channelId] ?: return

            if (state.currentSpeaker == message.pubkey) {
                Log.d(TAG, "Remote speak released: ${message.pubkey} in channel ${message.channelId}, reason: ${message.reason}")

                _events.emit(PTTChannelEvent.SpeakReleased(message.channelId, message.pubkey, message.reason))

                grantNextInQueue(message.channelId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle remote speak release", e)
        }
    }

    // ============================================
    // Nostr Broadcasting
    // ============================================

    /**
     * Create an unsigned NostrEvent for publishing.
     */
    private fun createUnsignedEvent(
        kind: Int,
        content: String,
        tags: List<List<String>>
    ): NostrEvent {
        // Create unsigned event - NostrClient.publishEvent will sign it
        return NostrEvent(
            id = "", // Will be computed by NostrClient
            pubkey = localPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = kind,
            tags = tags,
            content = content,
            sig = "" // Will be computed by NostrClient
        )
    }

    private fun broadcastChannelCreate(channel: PTTChannel) {
        val message = PTTChannelCreateMessage(
            channelId = channel.channelId,
            groupId = channel.groupId,
            name = channel.name,
            createdBy = channel.createdBy,
            maxParticipants = channel.maxParticipants,
            timestamp = System.currentTimeMillis()
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_CHANNEL_CREATE,
                    content = json.encodeToString(message),
                    tags = listOf(
                        listOf("g", channel.groupId),
                        listOf("d", channel.channelId)
                    )
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast channel create", e)
            }
        }
    }

    private fun broadcastJoin(channelId: String, member: PTTMember) {
        val message = PTTChannelJoinMessage(
            channelId = channelId,
            pubkey = member.pubkey,
            displayName = member.displayName,
            timestamp = System.currentTimeMillis()
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_CHANNEL_JOIN,
                    content = json.encodeToString(message),
                    tags = listOf(listOf("d", channelId))
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast join", e)
            }
        }
    }

    private fun broadcastLeave(channelId: String) {
        val message = PTTChannelLeaveMessage(
            channelId = channelId,
            pubkey = localPubkey,
            timestamp = System.currentTimeMillis()
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_CHANNEL_LEAVE,
                    content = json.encodeToString(message),
                    tags = listOf(listOf("d", channelId))
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast leave", e)
            }
        }
    }

    private fun broadcastSpeakRequest(channelId: String, request: SpeakRequest) {
        val message = PTTSpeakRequestMessage(
            channelId = channelId,
            pubkey = request.pubkey,
            priority = request.priority.name.lowercase(),
            timestamp = request.requestedAt
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_SPEAK_REQUEST,
                    content = json.encodeToString(message),
                    tags = listOf(listOf("d", channelId))
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast speak request", e)
            }
        }
    }

    private fun broadcastSpeakGrant(channelId: String, pubkey: String) {
        val message = PTTSpeakGrantMessage(
            channelId = channelId,
            pubkey = pubkey,
            grantedBy = localPubkey,
            timestamp = System.currentTimeMillis()
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_SPEAK_GRANT,
                    content = json.encodeToString(message),
                    tags = listOf(listOf("d", channelId))
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast speak grant", e)
            }
        }
    }

    private fun broadcastSpeakRelease(channelId: String, reason: String) {
        val message = PTTSpeakReleaseMessage(
            channelId = channelId,
            pubkey = localPubkey,
            reason = reason,
            timestamp = System.currentTimeMillis()
        )

        scope.launch {
            try {
                val event = createUnsignedEvent(
                    kind = PTTNostrKinds.PTT_SPEAK_RELEASE,
                    content = json.encodeToString(message),
                    tags = listOf(listOf("d", channelId))
                )
                nostrClient.publishEvent(event)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast speak release", e)
            }
        }
    }

    // ============================================
    // Helpers
    // ============================================

    private fun syncChannelStates() {
        _channelStates.value = channels.toMap()
        _currentChannel.value = _currentChannel.value?.let { current ->
            channels[current.channel.channelId]
        }
    }

    /**
     * Get a channel by ID.
     *
     * @param channelId The channel ID.
     * @return The channel state or null.
     */
    fun getChannel(channelId: String): PTTChannelState? = channels[channelId]

    /**
     * Get all channels the user is in.
     *
     * @return Map of channel ID to state.
     */
    fun getChannels(): Map<String, PTTChannelState> = channels.toMap()

    /**
     * Set the current focused channel.
     *
     * @param channelId The channel to focus.
     */
    fun setCurrentChannel(channelId: String?) {
        _currentChannel.value = channelId?.let { channels[it] }
    }

    /**
     * Check if user is speaking in any channel.
     *
     * @return True if speaking.
     */
    fun isCurrentlySpeaking(): Boolean = _isSpeaking.value

    /**
     * Check if user is the current speaker in a specific channel.
     *
     * @param channelId The channel ID.
     * @return True if speaking.
     */
    fun isSpeakingInChannel(channelId: String): Boolean {
        return channels[channelId]?.currentSpeaker == localPubkey
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close the manager and release resources.
     */
    fun close() {
        speakTimeoutJobs.values.forEach { it.cancel() }
        speakTimeoutJobs.clear()

        vadSilenceJobs.values.forEach { it.cancel() }
        vadSilenceJobs.clear()

        channels.clear()
        _channelStates.value = emptyMap()
        _currentChannel.value = null
        _isSpeaking.value = false

        scope.cancel()

        Log.i(TAG, "PTTChannelManager closed")
    }
}
