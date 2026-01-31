package network.buildit.modules.calling.service

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Direction of channel escalation/de-escalation.
 */
enum class EscalationDirection(val value: String) {
    TO_VOICE("to-voice"),
    TO_MESSAGING("to-messaging")
}

/**
 * Who initiated the escalation.
 */
enum class EscalationInitiator(val value: String) {
    OPERATOR("operator"),
    CALLER("caller"),
    SYSTEM("system")
}

/**
 * Status of an escalation request.
 */
enum class EscalationStatus(val value: String) {
    PENDING("pending"),
    ACCEPTED("accepted"),
    DECLINED("declined"),
    COMPLETED("completed"),
    FAILED("failed")
}

/**
 * Represents an escalation request.
 */
data class EscalationRequest(
    val id: String,
    var threadId: String,
    var callId: String? = null,
    val direction: EscalationDirection,
    val initiatedBy: EscalationInitiator,
    var reason: String? = null,
    var status: EscalationStatus = EscalationStatus.PENDING,
    val createdAt: Long,
    var completedAt: Long? = null
)

/**
 * Result of an escalation attempt.
 */
data class EscalationResult(
    val success: Boolean,
    val escalationId: String,
    val newCallId: String? = null,
    val newThreadId: String? = null,
    val error: String? = null
)

/**
 * Events emitted by the channel escalation service.
 */
sealed class ChannelEscalationEvent {
    data class EscalationStarted(val request: EscalationRequest) : ChannelEscalationEvent()
    data class EscalationRequested(
        val request: EscalationRequest,
        val callerPubkey: String
    ) : ChannelEscalationEvent()
    data class EscalationAccepted(val request: EscalationRequest) : ChannelEscalationEvent()
    data class EscalationDeclined(val request: EscalationRequest) : ChannelEscalationEvent()
    data class EscalationCompleted(
        val request: EscalationRequest,
        val callId: String?,
        val threadId: String?
    ) : ChannelEscalationEvent()
    data class EscalationFailed(
        val request: EscalationRequest,
        val error: String
    ) : ChannelEscalationEvent()
    data class LinkCreated(val threadId: String, val callId: String) : ChannelEscalationEvent()
    data class LinkCleared(val channelId: String) : ChannelEscalationEvent()
}

/**
 * Channel Escalation Service.
 *
 * Handles transitions between messaging and voice channels.
 * Features:
 * - escalateToVoice(threadId): Initiate voice call from messaging thread
 * - deescalateToMessaging(callId): Return to messaging from voice call
 * - Maintain thread/call linkage for context continuity
 * - Handle caller-initiated escalation requests
 *
 * Integrates with [MessagingQueueManager] and [HotlineCallController] for channel coordination.
 */
@Singleton
class ChannelEscalationService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val messagingQueueManager: MessagingQueueManager,
    private val hotlineQueueManager: HotlineQueueManager
) {
    companion object {
        private const val TAG = "ChannelEscalation"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Current operator pubkey */
    private var operatorPubkey: String = ""

    /** Escalation requests by ID */
    private val escalations = ConcurrentHashMap<String, EscalationRequest>()

    /** Thread to call linkage: threadId -> callId */
    private val threadToCall = ConcurrentHashMap<String, String>()

    /** Call to thread linkage: callId -> threadId */
    private val callToThread = ConcurrentHashMap<String, String>()

    // ============================================
    // State Flows
    // ============================================

    private val _escalationsState = MutableStateFlow<Map<String, EscalationRequest>>(emptyMap())
    /** Observable escalations state */
    val escalationsState: StateFlow<Map<String, EscalationRequest>> = _escalationsState.asStateFlow()

    private val _linkedChannelsState = MutableStateFlow<Map<String, String>>(emptyMap())
    /** Observable linked channels (threadId -> callId) */
    val linkedChannelsState: StateFlow<Map<String, String>> = _linkedChannelsState.asStateFlow()

    private val _events = MutableSharedFlow<ChannelEscalationEvent>()
    /** Event stream for escalation events */
    val events: SharedFlow<ChannelEscalationEvent> = _events.asSharedFlow()

    // ============================================
    // Initialization
    // ============================================

    /**
     * Initialize with operator context.
     *
     * @param operatorPubkey The current operator's pubkey.
     */
    fun initialize(operatorPubkey: String) {
        this.operatorPubkey = operatorPubkey
        Log.d(TAG, "Initialized for operator: $operatorPubkey")
    }

    // ============================================
    // Escalation to Voice
    // ============================================

    /**
     * Escalate a messaging thread to a voice call.
     *
     * @param threadId The thread ID to escalate.
     * @param reason Optional reason for escalation.
     * @return The escalation result.
     */
    suspend fun escalateToVoice(
        threadId: String,
        reason: String? = null
    ): EscalationResult {
        val escalationId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        // Get thread info
        val threadState = messagingQueueManager.getThread(threadId)
        if (threadState == null) {
            Log.e(TAG, "Thread not found for escalation: $threadId")
            return EscalationResult(
                success = false,
                escalationId = escalationId,
                error = "Thread not found"
            )
        }

        val escalation = EscalationRequest(
            id = escalationId,
            threadId = threadId,
            direction = EscalationDirection.TO_VOICE,
            initiatedBy = EscalationInitiator.OPERATOR,
            reason = reason,
            status = EscalationStatus.PENDING,
            createdAt = now
        )

        escalations[escalationId] = escalation
        syncState()

        scope.launch {
            _events.emit(ChannelEscalationEvent.EscalationStarted(escalation))
        }

        try {
            // Create a call ID for the new voice call
            val callId = UUID.randomUUID().toString()

            // Link the thread and call
            createLink(threadId, callId)

            // Update thread with linked call ID
            messagingQueueManager.linkToCall(threadId, callId)

            // In real implementation:
            // 1. Get caller's contact info from thread
            // 2. Initiate WebRTC call to the caller
            // 3. Wait for caller to accept
            // 4. Transition the thread to voice mode

            // For now, enqueue as a hotline call
            val callerPubkey = threadState.thread.contact?.pubkey
            val callerName = threadState.thread.contact?.name

            if (callerPubkey != null) {
                hotlineQueueManager.enqueueCall(
                    hotlineId = threadState.thread.hotlineID,
                    callId = callId,
                    callerPubkey = callerPubkey,
                    callerName = callerName,
                    priority = threadState.thread.priority
                        ?: network.buildit.generated.schemas.calling.HotlineCallStatePriority.Medium
                )
            }

            escalation.callId = callId
            escalation.status = EscalationStatus.COMPLETED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            Log.i(TAG, "Escalated thread $threadId to voice call $callId")

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationCompleted(
                    escalation,
                    callId,
                    threadId
                ))
            }

            // Add system message to thread
            addTransitionMessage(threadId, EscalationDirection.TO_VOICE, reason)

            return EscalationResult(
                success = true,
                escalationId = escalationId,
                newCallId = callId
            )

        } catch (e: Exception) {
            escalation.status = EscalationStatus.FAILED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            Log.e(TAG, "Escalation failed: $threadId", e)

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationFailed(
                    escalation,
                    e.message ?: "Escalation failed"
                ))
            }

            return EscalationResult(
                success = false,
                escalationId = escalationId,
                error = e.message
            )
        }
    }

    // ============================================
    // De-escalation to Messaging
    // ============================================

    /**
     * De-escalate a voice call back to messaging.
     *
     * @param callId The call ID to de-escalate.
     * @param reason Optional reason for de-escalation.
     * @return The escalation result.
     */
    suspend fun deescalateToMessaging(
        callId: String,
        reason: String? = null
    ): EscalationResult {
        val escalationId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        // Check if there's an existing thread linked to this call
        var threadId = callToThread[callId]

        val escalation = EscalationRequest(
            id = escalationId,
            threadId = threadId ?: "",
            callId = callId,
            direction = EscalationDirection.TO_MESSAGING,
            initiatedBy = EscalationInitiator.OPERATOR,
            reason = reason,
            status = EscalationStatus.PENDING,
            createdAt = now
        )

        escalations[escalationId] = escalation
        syncState()

        scope.launch {
            _events.emit(ChannelEscalationEvent.EscalationStarted(escalation))
        }

        try {
            // If no existing thread, create a new one
            if (threadId == null) {
                threadId = UUID.randomUUID().toString()
                createLink(threadId, callId)

                // In real implementation:
                // 1. Get caller info from the call
                // 2. Create a new messaging thread with that info
                // 3. Add context from the call to the thread

                Log.d(TAG, "Created new thread for de-escalation: $threadId")
            }

            escalation.threadId = threadId
            escalation.status = EscalationStatus.COMPLETED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            Log.i(TAG, "De-escalated call $callId to messaging thread $threadId")

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationCompleted(
                    escalation,
                    callId,
                    threadId
                ))
            }

            // Add system message to thread if it exists
            messagingQueueManager.getThread(threadId)?.let {
                addTransitionMessage(threadId, EscalationDirection.TO_MESSAGING, reason)
            }

            return EscalationResult(
                success = true,
                escalationId = escalationId,
                newThreadId = threadId
            )

        } catch (e: Exception) {
            escalation.status = EscalationStatus.FAILED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            Log.e(TAG, "De-escalation failed: $callId", e)

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationFailed(
                    escalation,
                    e.message ?: "De-escalation failed"
                ))
            }

            return EscalationResult(
                success = false,
                escalationId = escalationId,
                error = e.message
            )
        }
    }

    // ============================================
    // Caller-Initiated Escalation
    // ============================================

    /**
     * Request escalation from caller (caller wants to switch channels).
     *
     * @param currentChannelId The current thread or call ID.
     * @param direction The desired direction.
     * @param callerPubkey The caller's pubkey.
     * @return The escalation request.
     */
    suspend fun requestEscalation(
        currentChannelId: String,
        direction: EscalationDirection,
        callerPubkey: String
    ): EscalationRequest {
        val escalationId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val escalation = EscalationRequest(
            id = escalationId,
            threadId = if (direction == EscalationDirection.TO_VOICE) currentChannelId else "",
            callId = if (direction == EscalationDirection.TO_MESSAGING) currentChannelId else null,
            direction = direction,
            initiatedBy = EscalationInitiator.CALLER,
            status = EscalationStatus.PENDING,
            createdAt = now
        )

        escalations[escalationId] = escalation
        syncState()

        Log.i(TAG, "Caller requested escalation: ${direction.value} from $currentChannelId")

        scope.launch {
            _events.emit(ChannelEscalationEvent.EscalationRequested(escalation, callerPubkey))
        }

        return escalation
    }

    /**
     * Accept a pending escalation request.
     *
     * @param escalationId The escalation ID to accept.
     * @return The escalation result.
     */
    suspend fun acceptEscalation(escalationId: String): EscalationResult {
        val escalation = escalations[escalationId]
        if (escalation == null) {
            return EscalationResult(
                success = false,
                escalationId = escalationId,
                error = "Escalation not found"
            )
        }

        if (escalation.status != EscalationStatus.PENDING) {
            return EscalationResult(
                success = false,
                escalationId = escalationId,
                error = "Escalation is not pending"
            )
        }

        escalation.status = EscalationStatus.ACCEPTED
        syncState()

        scope.launch {
            _events.emit(ChannelEscalationEvent.EscalationAccepted(escalation))
        }

        // Perform the actual escalation
        return if (escalation.direction == EscalationDirection.TO_VOICE) {
            val callId = UUID.randomUUID().toString()
            escalation.callId = callId
            createLink(escalation.threadId, callId)

            escalation.status = EscalationStatus.COMPLETED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationCompleted(
                    escalation,
                    callId,
                    escalation.threadId
                ))
            }

            EscalationResult(
                success = true,
                escalationId = escalationId,
                newCallId = callId
            )
        } else {
            val threadId = UUID.randomUUID().toString()
            escalation.threadId = threadId
            escalation.callId?.let { createLink(threadId, it) }

            escalation.status = EscalationStatus.COMPLETED
            escalation.completedAt = System.currentTimeMillis()
            syncState()

            scope.launch {
                _events.emit(ChannelEscalationEvent.EscalationCompleted(
                    escalation,
                    escalation.callId,
                    threadId
                ))
            }

            EscalationResult(
                success = true,
                escalationId = escalationId,
                newThreadId = threadId
            )
        }
    }

    /**
     * Decline a pending escalation request.
     *
     * @param escalationId The escalation ID to decline.
     * @param reason Optional reason for declining.
     * @return True if declined successfully.
     */
    fun declineEscalation(escalationId: String, reason: String? = null): Boolean {
        val escalation = escalations[escalationId] ?: return false

        if (escalation.status != EscalationStatus.PENDING) {
            return false
        }

        escalation.status = EscalationStatus.DECLINED
        escalation.completedAt = System.currentTimeMillis()
        reason?.let { escalation.reason = it }
        syncState()

        Log.i(TAG, "Escalation declined: $escalationId")

        scope.launch {
            _events.emit(ChannelEscalationEvent.EscalationDeclined(escalation))
        }

        return true
    }

    // ============================================
    // Link Management
    // ============================================

    /**
     * Create a link between thread and call.
     */
    private fun createLink(threadId: String, callId: String) {
        threadToCall[threadId] = callId
        callToThread[callId] = threadId
        syncState()

        Log.d(TAG, "Created link: thread $threadId <-> call $callId")

        scope.launch {
            _events.emit(ChannelEscalationEvent.LinkCreated(threadId, callId))
        }
    }

    /**
     * Get call ID linked to a thread.
     *
     * @param threadId The thread ID.
     * @return The linked call ID, or null if not linked.
     */
    fun getLinkedCall(threadId: String): String? = threadToCall[threadId]

    /**
     * Get thread ID linked to a call.
     *
     * @param callId The call ID.
     * @return The linked thread ID, or null if not linked.
     */
    fun getLinkedThread(callId: String): String? = callToThread[callId]

    /**
     * Check if thread has a linked call.
     *
     * @param threadId The thread ID.
     * @return True if thread has a linked call.
     */
    fun hasLinkedCall(threadId: String): Boolean = threadToCall.containsKey(threadId)

    /**
     * Check if call has a linked thread.
     *
     * @param callId The call ID.
     * @return True if call has a linked thread.
     */
    fun hasLinkedThread(callId: String): Boolean = callToThread.containsKey(callId)

    /**
     * Clear link between thread and call (on call end).
     *
     * @param channelId Either thread ID or call ID.
     */
    fun clearLink(channelId: String) {
        // Try to find and clear by thread ID
        val callId = threadToCall.remove(channelId)
        if (callId != null) {
            callToThread.remove(callId)
            syncState()

            Log.d(TAG, "Cleared link for thread: $channelId")

            scope.launch {
                _events.emit(ChannelEscalationEvent.LinkCleared(channelId))
            }
            return
        }

        // Try to find and clear by call ID
        val threadId = callToThread.remove(channelId)
        if (threadId != null) {
            threadToCall.remove(threadId)
            syncState()

            Log.d(TAG, "Cleared link for call: $channelId")

            scope.launch {
                _events.emit(ChannelEscalationEvent.LinkCleared(channelId))
            }
        }
    }

    // ============================================
    // Queries
    // ============================================

    /**
     * Get escalation by ID.
     *
     * @param escalationId The escalation ID.
     * @return The escalation request, or null if not found.
     */
    fun getEscalation(escalationId: String): EscalationRequest? = escalations[escalationId]

    /**
     * Get pending escalation requests for a channel.
     *
     * @param channelId The thread or call ID.
     * @return List of pending escalations.
     */
    fun getPendingEscalations(channelId: String): List<EscalationRequest> {
        return escalations.values.filter { escalation ->
            escalation.status == EscalationStatus.PENDING &&
                (escalation.threadId == channelId || escalation.callId == channelId)
        }
    }

    /**
     * Get escalation history for a channel.
     *
     * @param channelId The thread or call ID.
     * @return List of escalations sorted by creation time (newest first).
     */
    fun getHistory(channelId: String): List<EscalationRequest> {
        return escalations.values
            .filter { it.threadId == channelId || it.callId == channelId }
            .sortedByDescending { it.createdAt }
    }

    // ============================================
    // System Messages
    // ============================================

    /**
     * Add a system message about channel transition.
     */
    private suspend fun addTransitionMessage(
        threadId: String,
        direction: EscalationDirection,
        reason: String?
    ) {
        val message = when (direction) {
            EscalationDirection.TO_VOICE -> {
                "This conversation has been escalated to a voice call" +
                    (reason?.let { ": $it" } ?: "")
            }
            EscalationDirection.TO_MESSAGING -> {
                "This conversation has been moved to messaging" +
                    (reason?.let { ": $it" } ?: "")
            }
        }

        try {
            messagingQueueManager.addMessage(
                threadId = threadId,
                content = message,
                senderType = MessageSenderType.SYSTEM
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add transition message", e)
        }
    }

    // ============================================
    // State Management
    // ============================================

    private fun syncState() {
        _escalationsState.value = escalations.toMap()
        _linkedChannelsState.value = threadToCall.toMap()
    }

    /**
     * Clear all escalations and links.
     */
    fun clear() {
        escalations.clear()
        threadToCall.clear()
        callToThread.clear()
        syncState()
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        escalations.clear()
        threadToCall.clear()
        callToThread.clear()
        scope.cancel()
        Log.i(TAG, "ChannelEscalationService closed")
    }
}
