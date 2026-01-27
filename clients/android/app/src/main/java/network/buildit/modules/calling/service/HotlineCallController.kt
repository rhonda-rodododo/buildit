package network.buildit.modules.calling.service

import android.content.Context
import android.media.MediaPlayer
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
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.HotlineCallState
import network.buildit.generated.schemas.HotlineCallStatePriority
import network.buildit.generated.schemas.HotlineCallStateState
import network.buildit.generated.schemas.HotlineOperatorStatusStatus
import network.buildit.generated.schemas.Operator
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Transfer request state.
 */
data class TransferRequest(
    val callId: String,
    val fromOperator: String,
    val toOperator: String,
    val reason: String? = null,
    val requestedAt: Long,
    val expiresAt: Long,
    var status: TransferStatus
)

/**
 * Transfer request status.
 */
enum class TransferStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    EXPIRED
}

/**
 * 3-way call state.
 */
data class ThreeWayCall(
    val callId: String,
    val participants: List<String>,
    val initiatedBy: String,
    val startedAt: Long
)

/**
 * Active call state tracked by controller.
 */
data class ActiveHotlineCall(
    val callId: String,
    val hotlineId: String,
    val operatorPubkey: String,
    var state: HotlineCallStateState,
    val startedAt: Long,
    var isOnHold: Boolean = false,
    var notes: String = ""
)

/**
 * Events emitted by the call controller.
 */
sealed class HotlineCallControllerEvent {
    data class CallHeld(val callId: String) : HotlineCallControllerEvent()
    data class CallResumed(val callId: String) : HotlineCallControllerEvent()
    data class TransferRequested(val request: TransferRequest) : HotlineCallControllerEvent()
    data class TransferAccepted(val request: TransferRequest) : HotlineCallControllerEvent()
    data class TransferDeclined(val request: TransferRequest) : HotlineCallControllerEvent()
    data class TransferCompleted(val callId: String, val toOperator: String) : HotlineCallControllerEvent()
    data class CallEscalated(val callId: String, val supervisorPubkey: String) : HotlineCallControllerEvent()
    data class ThreeWayStarted(val threeWay: ThreeWayCall) : HotlineCallControllerEvent()
    data class ThreeWayEnded(val callId: String) : HotlineCallControllerEvent()
    data class CallEnded(val callId: String, val summary: String) : HotlineCallControllerEvent()
    data class NotesUpdated(val callId: String, val notes: String) : HotlineCallControllerEvent()
    data class Error(val callId: String, val message: String, val exception: Exception? = null) : HotlineCallControllerEvent()
}

/**
 * Hotline Call Controller.
 *
 * Handles call control operations for hotline operators:
 * - Hold/resume functionality
 * - Transfer calls between operators
 * - Escalate to supervisor
 * - 3-way calling
 * - Call notes management
 *
 * Integrates with:
 * - [HotlineQueueManager] for queue operations
 * - [MeshCallManager] for WebRTC media control
 * - [CallConnectionService] for Android system call integration
 */
@Singleton
class HotlineCallController @Inject constructor(
    @ApplicationContext private val context: Context,
    private val queueManager: HotlineQueueManager
) {
    companion object {
        private const val TAG = "HotlineCallController"
        private const val TRANSFER_TIMEOUT_MS = 30_000L
        private const val NOTES_AUTO_SAVE_DELAY_MS = 5_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val json = Json { ignoreUnknownKeys = true }

    // Hold music player
    private var holdMusicPlayer: MediaPlayer? = null

    // Active calls by call ID
    private val activeCalls = ConcurrentHashMap<String, ActiveHotlineCall>()

    // Pending transfers by call ID
    private val pendingTransfers = ConcurrentHashMap<String, TransferRequest>()

    // Active 3-way calls by call ID
    private val activeThreeWays = ConcurrentHashMap<String, ThreeWayCall>()

    // Call notes by call ID (cached for auto-save)
    private val callNotes = ConcurrentHashMap<String, String>()

    // Notes auto-save timers by call ID
    private val notesAutoSaveTimers = ConcurrentHashMap<String, Job>()

    // ============================================
    // State Flows
    // ============================================

    private val _activeCallsState = MutableStateFlow<Map<String, ActiveHotlineCall>>(emptyMap())
    /** Observable active calls state */
    val activeCallsState: StateFlow<Map<String, ActiveHotlineCall>> = _activeCallsState.asStateFlow()

    private val _pendingTransfersState = MutableStateFlow<Map<String, TransferRequest>>(emptyMap())
    /** Observable pending transfers state */
    val pendingTransfersState: StateFlow<Map<String, TransferRequest>> = _pendingTransfersState.asStateFlow()

    private val _events = MutableSharedFlow<HotlineCallControllerEvent>()
    /** Event stream for call controller events */
    val events: SharedFlow<HotlineCallControllerEvent> = _events.asSharedFlow()

    // ============================================
    // Call Tracking
    // ============================================

    /**
     * Register an active call for control.
     *
     * @param callId The call ID.
     * @param hotlineId The hotline ID.
     * @param operatorPubkey The operator handling the call.
     */
    fun registerActiveCall(callId: String, hotlineId: String, operatorPubkey: String) {
        val call = ActiveHotlineCall(
            callId = callId,
            hotlineId = hotlineId,
            operatorPubkey = operatorPubkey,
            state = HotlineCallStateState.Active,
            startedAt = System.currentTimeMillis()
        )
        activeCalls[callId] = call
        syncActiveCallsState()
        Log.d(TAG, "Active call registered: $callId with operator $operatorPubkey")
    }

    /**
     * Get an active call by ID.
     *
     * @param callId The call ID.
     * @return The active call, or null if not found.
     */
    fun getActiveCall(callId: String): ActiveHotlineCall? = activeCalls[callId]

    // ============================================
    // Hold/Resume
    // ============================================

    /**
     * Put a call on hold.
     *
     * @param callId The call ID to hold.
     * @throws IllegalStateException if call is not active.
     */
    suspend fun holdCall(callId: String) {
        val call = activeCalls[callId]
            ?: throw IllegalStateException("Call not found: $callId")

        if (call.state != HotlineCallStateState.Active) {
            throw IllegalStateException("Call is not active: ${call.state.value}")
        }

        // Mute audio to caller (they hear hold music)
        // In real implementation, this would interact with MeshCallManager/WebRTCManager
        // webrtcManager.setLocalAudioEnabled(false)

        // Play hold music to caller
        startHoldMusic()

        // Update call state
        call.isOnHold = true
        call.state = HotlineCallStateState.OnHold
        syncActiveCallsState()

        Log.i(TAG, "Call $callId placed on hold")
        _events.emit(HotlineCallControllerEvent.CallHeld(callId))
    }

    /**
     * Resume a call from hold.
     *
     * @param callId The call ID to resume.
     * @throws IllegalStateException if call is not on hold.
     */
    suspend fun resumeCall(callId: String) {
        val call = activeCalls[callId]
            ?: throw IllegalStateException("Call not found: $callId")

        if (call.state != HotlineCallStateState.OnHold) {
            throw IllegalStateException("Call is not on hold: ${call.state.value}")
        }

        // Stop hold music
        stopHoldMusic()

        // Resume audio
        // webrtcManager.setLocalAudioEnabled(true)

        // Update call state
        call.isOnHold = false
        call.state = HotlineCallStateState.Active
        syncActiveCallsState()

        Log.i(TAG, "Call $callId resumed from hold")
        _events.emit(HotlineCallControllerEvent.CallResumed(callId))
    }

    // ============================================
    // Transfer
    // ============================================

    /**
     * Request to transfer a call to another operator.
     *
     * @param callId The call ID to transfer.
     * @param targetOperatorPubkey The target operator's pubkey.
     * @param reason Optional reason for transfer.
     * @return The transfer request.
     * @throws IllegalStateException if call not found or target not available.
     */
    suspend fun transferCall(
        callId: String,
        targetOperatorPubkey: String,
        reason: String? = null
    ): TransferRequest {
        val call = activeCalls[callId]
            ?: throw IllegalStateException("Call not found: $callId")

        val currentOperator = call.operatorPubkey

        // Check target is available
        val targetOperator = queueManager.getOperator(targetOperatorPubkey)
            ?: throw IllegalStateException("Target operator not found: $targetOperatorPubkey")

        if (targetOperator.status != HotlineOperatorStatusStatus.Available) {
            throw IllegalStateException("Target operator is not available: ${targetOperator.status.value}")
        }

        val now = System.currentTimeMillis()
        val request = TransferRequest(
            callId = callId,
            fromOperator = currentOperator,
            toOperator = targetOperatorPubkey,
            reason = reason,
            requestedAt = now,
            expiresAt = now + TRANSFER_TIMEOUT_MS,
            status = TransferStatus.PENDING
        )

        pendingTransfers[callId] = request
        syncPendingTransfersState()

        // Put call on hold during transfer
        holdCall(callId)

        // Update call state
        call.state = HotlineCallStateState.Transferred
        syncActiveCallsState()

        Log.i(TAG, "Transfer requested: $callId from $currentOperator to $targetOperatorPubkey")
        _events.emit(HotlineCallControllerEvent.TransferRequested(request))

        // Set timeout for transfer
        scope.launch {
            delay(TRANSFER_TIMEOUT_MS)
            val pending = pendingTransfers[callId]
            if (pending != null && pending.status == TransferStatus.PENDING) {
                handleTransferExpired(callId)
            }
        }

        return request
    }

    /**
     * Accept a transfer request.
     *
     * @param callId The call ID being transferred.
     * @throws IllegalStateException if no pending transfer.
     */
    suspend fun acceptTransfer(callId: String) {
        val request = pendingTransfers.remove(callId)
            ?: throw IllegalStateException("No pending transfer request for: $callId")

        if (request.status != TransferStatus.PENDING) {
            throw IllegalStateException("Transfer is not pending: ${request.status}")
        }

        request.status = TransferStatus.ACCEPTED
        syncPendingTransfersState()

        val call = activeCalls[callId] ?: return

        // Update call with new operator
        val oldOperator = call.operatorPubkey
        activeCalls[callId] = call.copy(
            operatorPubkey = request.toOperator,
            state = HotlineCallStateState.Active
        )
        syncActiveCallsState()

        // Release original operator
        queueManager.handleCallEnd(callId, oldOperator)

        // Resume call for new operator
        resumeCall(callId)

        Log.i(TAG, "Transfer accepted: $callId to ${request.toOperator}")
        _events.emit(HotlineCallControllerEvent.TransferAccepted(request))
        _events.emit(HotlineCallControllerEvent.TransferCompleted(callId, request.toOperator))
    }

    /**
     * Decline a transfer request.
     *
     * @param callId The call ID being transferred.
     * @throws IllegalStateException if no pending transfer.
     */
    suspend fun declineTransfer(callId: String) {
        val request = pendingTransfers.remove(callId)
            ?: throw IllegalStateException("No pending transfer request for: $callId")

        if (request.status != TransferStatus.PENDING) {
            throw IllegalStateException("Transfer is not pending: ${request.status}")
        }

        request.status = TransferStatus.DECLINED
        syncPendingTransfersState()

        val call = activeCalls[callId] ?: return

        // Resume call with original operator
        resumeCall(callId)

        // Update state back to active
        call.state = HotlineCallStateState.Active
        syncActiveCallsState()

        Log.i(TAG, "Transfer declined: $callId")
        _events.emit(HotlineCallControllerEvent.TransferDeclined(request))
    }

    /**
     * Handle transfer timeout.
     *
     * @param callId The call ID that timed out.
     */
    private suspend fun handleTransferExpired(callId: String) {
        val request = pendingTransfers.remove(callId) ?: return

        request.status = TransferStatus.EXPIRED
        syncPendingTransfersState()

        val call = activeCalls[callId] ?: return

        // Resume call with original operator
        try {
            resumeCall(callId)
            call.state = HotlineCallStateState.Active
            syncActiveCallsState()
        } catch (e: Exception) {
            // Call may have ended
            Log.w(TAG, "Could not resume call after transfer expired: ${e.message}")
        }

        Log.i(TAG, "Transfer expired: $callId")
    }

    /**
     * Get pending transfer for a call.
     *
     * @param callId The call ID.
     * @return The pending transfer, or null if none.
     */
    fun getPendingTransfer(callId: String): TransferRequest? = pendingTransfers[callId]

    // ============================================
    // Escalation
    // ============================================

    /**
     * Escalate call to a supervisor (creates 3-way call).
     *
     * @param callId The call ID to escalate.
     * @param reason Reason for escalation.
     * @throws IllegalStateException if call not found or no supervisor available.
     */
    suspend fun escalateCall(callId: String, reason: String) {
        val call = activeCalls[callId]
            ?: throw IllegalStateException("Call not found: $callId")

        // Find an available supervisor
        val operators = queueManager.getOperators(call.hotlineId)
        val supervisor = operators.find { op ->
            op.status == HotlineOperatorStatusStatus.Available &&
                op.pubkey != call.operatorPubkey
            // In a real implementation, check for supervisor role
        } ?: throw IllegalStateException("No supervisor available")

        // Create 3-way call
        val threeWay = ThreeWayCall(
            callId = callId,
            participants = listOf(call.operatorPubkey, supervisor.pubkey),
            initiatedBy = call.operatorPubkey,
            startedAt = System.currentTimeMillis()
        )

        activeThreeWays[callId] = threeWay

        // Update call state
        call.state = HotlineCallStateState.Escalated
        call.notes = "${call.notes}\n[ESCALATED: $reason]".trim()
        syncActiveCallsState()

        Log.i(TAG, "Call $callId escalated to supervisor ${supervisor.pubkey}: $reason")
        _events.emit(HotlineCallControllerEvent.CallEscalated(callId, supervisor.pubkey))
        _events.emit(HotlineCallControllerEvent.ThreeWayStarted(threeWay))
    }

    // ============================================
    // 3-Way Calling
    // ============================================

    /**
     * Start a 3-way call with another operator.
     *
     * @param callId The call ID.
     * @param thirdPartyPubkey The third party's pubkey.
     * @return The 3-way call state.
     * @throws IllegalStateException if call not found.
     */
    suspend fun startThreeWayCall(callId: String, thirdPartyPubkey: String): ThreeWayCall {
        val call = activeCalls[callId]
            ?: throw IllegalStateException("Call not found: $callId")

        val threeWay = ThreeWayCall(
            callId = callId,
            participants = listOf(call.operatorPubkey, thirdPartyPubkey),
            initiatedBy = call.operatorPubkey,
            startedAt = System.currentTimeMillis()
        )

        activeThreeWays[callId] = threeWay

        Log.i(TAG, "3-way call started: $callId with $thirdPartyPubkey")
        _events.emit(HotlineCallControllerEvent.ThreeWayStarted(threeWay))

        return threeWay
    }

    /**
     * End a 3-way call (drop the third party).
     *
     * @param callId The call ID.
     */
    suspend fun endThreeWayCall(callId: String) {
        val threeWay = activeThreeWays.remove(callId) ?: return

        val call = activeCalls[callId]
        if (call != null) {
            call.state = HotlineCallStateState.Active
            syncActiveCallsState()
        }

        Log.i(TAG, "3-way call ended: $callId")
        _events.emit(HotlineCallControllerEvent.ThreeWayEnded(callId))
    }

    /**
     * Get active 3-way call for a call ID.
     *
     * @param callId The call ID.
     * @return The 3-way call state, or null if none.
     */
    fun getThreeWayCall(callId: String): ThreeWayCall? = activeThreeWays[callId]

    // ============================================
    // Notes Management
    // ============================================

    /**
     * Update call notes with auto-save.
     *
     * Notes are saved automatically after 5 seconds of no changes.
     *
     * @param callId The call ID.
     * @param notes The notes content.
     */
    fun updateNotes(callId: String, notes: String) {
        callNotes[callId] = notes

        // Clear existing timer
        notesAutoSaveTimers.remove(callId)?.cancel()

        // Auto-save after delay
        val timer = scope.launch {
            delay(NOTES_AUTO_SAVE_DELAY_MS)
            saveNotes(callId)
        }
        notesAutoSaveTimers[callId] = timer
    }

    /**
     * Save notes immediately.
     *
     * @param callId The call ID.
     */
    suspend fun saveNotes(callId: String) {
        val notes = callNotes[callId] ?: return

        val call = activeCalls[callId]
        if (call != null) {
            call.notes = notes
            syncActiveCallsState()
        }

        Log.d(TAG, "Notes saved for call: $callId")
        _events.emit(HotlineCallControllerEvent.NotesUpdated(callId, notes))

        // Clear timer
        notesAutoSaveTimers.remove(callId)?.cancel()
    }

    /**
     * Get call notes.
     *
     * @param callId The call ID.
     * @return The notes content.
     */
    fun getNotes(callId: String): String {
        return callNotes[callId] ?: activeCalls[callId]?.notes ?: ""
    }

    // ============================================
    // Call End
    // ============================================

    /**
     * End a call with summary.
     *
     * @param callId The call ID to end.
     * @param summary Call summary for record.
     */
    suspend fun endCall(callId: String, summary: String) {
        // Save any pending notes
        saveNotes(callId)

        val call = activeCalls.remove(callId)
        if (call == null) {
            Log.w(TAG, "Call not found for end: $callId")
            return
        }

        // Stop hold music if playing
        stopHoldMusic()

        // Clean up any 3-way call
        activeThreeWays.remove(callId)

        // Clean up pending transfer
        pendingTransfers.remove(callId)

        syncActiveCallsState()
        syncPendingTransfersState()

        // Release operator
        queueManager.handleCallEnd(callId, call.operatorPubkey)

        // Clean up notes
        callNotes.remove(callId)
        notesAutoSaveTimers.remove(callId)?.cancel()

        Log.i(TAG, "Call ended: $callId - $summary")
        _events.emit(HotlineCallControllerEvent.CallEnded(callId, summary))
    }

    // ============================================
    // Category and Priority
    // ============================================

    /**
     * Set call category.
     *
     * @param callId The call ID.
     * @param category The category to set.
     */
    fun setCategory(callId: String, category: String) {
        // In real implementation, update the call record
        Log.d(TAG, "Category set for call $callId: $category")
    }

    /**
     * Set call priority.
     *
     * @param callId The call ID.
     * @param priority The priority to set.
     */
    fun setPriority(callId: String, priority: HotlineCallStatePriority) {
        // In real implementation, update the call record
        Log.d(TAG, "Priority set for call $callId: ${priority.value}")
    }

    // ============================================
    // Hold Music
    // ============================================

    private fun startHoldMusic() {
        try {
            // In a real implementation, load hold music from assets/resources
            // holdMusicPlayer = MediaPlayer.create(context, R.raw.hold_music)
            // holdMusicPlayer?.isLooping = true
            // holdMusicPlayer?.start()
            Log.d(TAG, "Hold music started (placeholder)")
        } catch (e: Exception) {
            Log.w(TAG, "Could not start hold music: ${e.message}")
        }
    }

    private fun stopHoldMusic() {
        try {
            holdMusicPlayer?.stop()
            holdMusicPlayer?.release()
            holdMusicPlayer = null
            Log.d(TAG, "Hold music stopped")
        } catch (e: Exception) {
            Log.w(TAG, "Could not stop hold music: ${e.message}")
        }
    }

    // ============================================
    // State Sync
    // ============================================

    private fun syncActiveCallsState() {
        _activeCallsState.value = activeCalls.toMap()
    }

    private fun syncPendingTransfersState() {
        _pendingTransfersState.value = pendingTransfers.toMap()
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        stopHoldMusic()

        notesAutoSaveTimers.values.forEach { it.cancel() }
        notesAutoSaveTimers.clear()

        pendingTransfers.clear()
        activeThreeWays.clear()
        callNotes.clear()
        activeCalls.clear()

        scope.cancel()

        Log.i(TAG, "HotlineCallController closed")
    }
}
