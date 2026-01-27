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
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.nostr.NostrClient
import network.buildit.generated.schemas.HotlineOperatorStatus
import network.buildit.generated.schemas.HotlineOperatorStatusStatus
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Break configuration.
 */
data class BreakConfig(
    val type: BreakType,
    /** Maximum duration in seconds */
    val maxDuration: Long
)

/**
 * Types of breaks.
 */
enum class BreakType(val value: String) {
    SHORT("short"),
    MEAL("meal"),
    PERSONAL("personal")
}

/** Default break configurations */
private val BREAK_CONFIGS = mapOf(
    BreakType.SHORT to BreakConfig(BreakType.SHORT, 15 * 60),    // 15 minutes
    BreakType.MEAL to BreakConfig(BreakType.MEAL, 60 * 60),      // 60 minutes
    BreakType.PERSONAL to BreakConfig(BreakType.PERSONAL, 30 * 60) // 30 minutes
)

/**
 * Operator shift statistics.
 */
data class ShiftStats(
    val shiftStart: Long,
    var shiftDuration: Long = 0,
    var callCount: Int = 0,
    var avgCallDuration: Long = 0,
    var totalTalkTime: Long = 0,
    var totalHoldTime: Long = 0,
    var totalWrapUpTime: Long = 0,
    var longestCall: Long = 0,
    var shortestCall: Long = Long.MAX_VALUE
) {
    /**
     * Get formatted shift duration string (H:MM:SS).
     */
    fun getFormattedDuration(): String {
        val currentDuration = System.currentTimeMillis() - shiftStart
        val hours = currentDuration / 3600000
        val minutes = (currentDuration % 3600000) / 60000
        val seconds = (currentDuration % 60000) / 1000
        return "$hours:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}"
    }
}

/**
 * Events emitted by the operator status manager.
 */
sealed class OperatorStatusEvent {
    data class StatusChanged(val status: HotlineOperatorStatus) : OperatorStatusEvent()
    data class ShiftStarted(val pubkey: String, val hotlineId: String) : OperatorStatusEvent()
    data class ShiftEnded(val pubkey: String, val stats: ShiftStats) : OperatorStatusEvent()
    data class BreakStarted(val pubkey: String, val breakType: BreakType) : OperatorStatusEvent()
    data class BreakEnded(val pubkey: String) : OperatorStatusEvent()
    data class BreakOvertime(val pubkey: String) : OperatorStatusEvent()
}

/**
 * Operator Status Manager.
 *
 * Manages operator status, shift tracking, and availability for hotline operations.
 * Features:
 * - Shift management (start/end)
 * - Break management (short, meal, personal)
 * - Shift statistics tracking
 * - Status broadcasting via Nostr
 *
 * Integrates with [HotlineQueueManager] for operator availability updates.
 */
@Singleton
class OperatorStatusManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val nostrClient: NostrClient,
    private val queueManager: HotlineQueueManager
) {
    companion object {
        private const val TAG = "OperatorStatusManager"
        private const val KIND_HOTLINE_OPERATOR_STATUS = 24350
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // Local operator identity
    private var localPubkey: String? = null

    // Current status
    private var currentStatus: HotlineOperatorStatus? = null

    // Shift tracking
    private var shiftStats: ShiftStats? = null
    private val callDurations = mutableListOf<Long>()

    // Break tracking
    private var breakTimer: Job? = null
    private var breakStartTime: Long? = null
    private var breakType: BreakType? = null

    // Wrap-up tracking for stats
    private var wrapUpStartTime: Long? = null

    // ============================================
    // State Flows
    // ============================================

    private val _currentStatusState = MutableStateFlow<HotlineOperatorStatus?>(null)
    /** Observable current operator status */
    val currentStatusState: StateFlow<HotlineOperatorStatus?> = _currentStatusState.asStateFlow()

    private val _shiftStatsState = MutableStateFlow<ShiftStats?>(null)
    /** Observable current shift statistics */
    val shiftStatsState: StateFlow<ShiftStats?> = _shiftStatsState.asStateFlow()

    private val _breakTimeRemaining = MutableStateFlow<Long?>(null)
    /** Observable break time remaining in seconds */
    val breakTimeRemaining: StateFlow<Long?> = _breakTimeRemaining.asStateFlow()

    private val _events = MutableSharedFlow<OperatorStatusEvent>()
    /** Event stream for status manager events */
    val events: SharedFlow<OperatorStatusEvent> = _events.asSharedFlow()

    // ============================================
    // Initialization
    // ============================================

    /**
     * Set the local operator identity.
     *
     * @param pubkey The operator's Nostr pubkey.
     */
    fun setLocalIdentity(pubkey: String) {
        this.localPubkey = pubkey
        Log.d(TAG, "Local identity set: $pubkey")
    }

    // ============================================
    // Shift Management
    // ============================================

    /**
     * Start a new shift.
     *
     * @param hotlineId The hotline to work on.
     * @throws IllegalStateException if no local identity set.
     */
    suspend fun startShift(hotlineId: String) {
        val pubkey = localPubkey
            ?: throw IllegalStateException("Local identity not set")

        val now = System.currentTimeMillis()

        shiftStats = ShiftStats(shiftStart = now)
        callDurations.clear()

        val status = HotlineOperatorStatus(
            v = "1",
            hotlineID = hotlineId,
            pubkey = pubkey,
            status = HotlineOperatorStatusStatus.Available,
            callCount = 0,
            shiftStart = now / 1000,
            timestamp = now / 1000
        )

        setStatus(status)

        // Register with queue manager
        queueManager.registerOperator(pubkey, hotlineId)

        Log.i(TAG, "Shift started for hotline: $hotlineId")
        _events.emit(OperatorStatusEvent.ShiftStarted(pubkey, hotlineId))
    }

    /**
     * End the current shift.
     *
     * @return Final shift statistics, or null if no active shift.
     */
    suspend fun endShift(): ShiftStats? {
        val pubkey = localPubkey ?: return null
        val status = currentStatus ?: return null
        val stats = shiftStats ?: return null

        val now = System.currentTimeMillis()
        stats.shiftDuration = now - stats.shiftStart

        // Calculate average call duration
        if (callDurations.isNotEmpty()) {
            stats.avgCallDuration = callDurations.sum() / callDurations.size
        }

        // Fix shortestCall if no calls were taken
        if (stats.shortestCall == Long.MAX_VALUE) {
            stats.shortestCall = 0
        }

        val finalStats = stats.copy()

        // Set status to offline
        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.Offline,
            shiftEnd = now / 1000,
            timestamp = now / 1000
        ))

        // Unregister from queue manager
        queueManager.unregisterOperator(pubkey)

        shiftStats = null
        currentStatus = null
        _currentStatusState.value = null
        _shiftStatsState.value = null

        Log.i(TAG, "Shift ended. Calls: ${finalStats.callCount}, Total talk time: ${finalStats.totalTalkTime}s")
        _events.emit(OperatorStatusEvent.ShiftEnded(pubkey, finalStats))

        return finalStats
    }

    // ============================================
    // Status Management
    // ============================================

    /**
     * Set operator status.
     *
     * @param status The new status to set.
     */
    suspend fun setStatus(status: HotlineOperatorStatus) {
        val previousStatus = currentStatus?.status

        currentStatus = status
        _currentStatusState.value = status

        // Broadcast status via signaling
        broadcastStatus(status)

        _events.emit(OperatorStatusEvent.StatusChanged(status))

        // Track wrap-up time
        if (previousStatus == HotlineOperatorStatusStatus.WrapUp) {
            wrapUpStartTime?.let { startTime ->
                shiftStats?.let { stats ->
                    stats.totalWrapUpTime += (System.currentTimeMillis() - startTime) / 1000
                    _shiftStatsState.value = stats.copy()
                }
            }
            wrapUpStartTime = null
        }

        // Track wrap-up start
        if (status.status == HotlineOperatorStatusStatus.WrapUp) {
            wrapUpStartTime = System.currentTimeMillis()
        }

        // Handle break end
        if (previousStatus == HotlineOperatorStatusStatus.Break &&
            status.status != HotlineOperatorStatusStatus.Break) {
            handleBreakEnd()
        }

        // Update queue manager
        queueManager.setOperatorStatus(status.pubkey, status.status)

        Log.d(TAG, "Status changed: ${previousStatus?.value} -> ${status.status.value}")
    }

    /**
     * Set status to available.
     */
    suspend fun setAvailable() {
        val status = currentStatus ?: return
        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.Available,
            timestamp = System.currentTimeMillis() / 1000
        ))
    }

    /**
     * Set status to on-call.
     *
     * @param callId The current call ID.
     */
    suspend fun setOnCall(callId: String) {
        val status = currentStatus ?: return
        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.OnCall,
            currentCallID = callId,
            timestamp = System.currentTimeMillis() / 1000
        ))
    }

    /**
     * Set status to wrap-up (post-call processing).
     */
    suspend fun setWrapUp() {
        val status = currentStatus ?: return
        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.WrapUp,
            currentCallID = null,
            timestamp = System.currentTimeMillis() / 1000
        ))
    }

    // ============================================
    // Break Management
    // ============================================

    /**
     * Start a break.
     *
     * @param breakType The type of break.
     * @throws IllegalStateException if no active shift or currently on call.
     */
    suspend fun startBreak(breakType: BreakType) {
        val status = currentStatus
            ?: throw IllegalStateException("No active shift")

        if (status.status == HotlineOperatorStatusStatus.OnCall) {
            throw IllegalStateException("Cannot start break while on call")
        }

        val config = BREAK_CONFIGS[breakType]
            ?: throw IllegalStateException("Invalid break type")

        this.breakType = breakType
        this.breakStartTime = System.currentTimeMillis()

        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.Break,
            timestamp = System.currentTimeMillis() / 1000
        ))

        // Set timer for break overtime warning
        breakTimer = scope.launch {
            val maxDurationMs = config.maxDuration * 1000
            var elapsed = 0L

            while (elapsed < maxDurationMs) {
                delay(1000)
                elapsed += 1000
                _breakTimeRemaining.value = (maxDurationMs - elapsed) / 1000
            }

            _breakTimeRemaining.value = 0
            localPubkey?.let { pubkey ->
                _events.emit(OperatorStatusEvent.BreakOvertime(pubkey))
            }
        }

        Log.i(TAG, "Break started: ${breakType.value}")
        localPubkey?.let { pubkey ->
            _events.emit(OperatorStatusEvent.BreakStarted(pubkey, breakType))
        }
    }

    /**
     * End break and return to available.
     */
    suspend fun endBreak() {
        val status = currentStatus ?: return

        if (status.status != HotlineOperatorStatusStatus.Break) {
            return
        }

        handleBreakEnd()

        setStatus(status.copy(
            status = HotlineOperatorStatusStatus.Available,
            timestamp = System.currentTimeMillis() / 1000
        ))

        Log.i(TAG, "Break ended")
        localPubkey?.let { pubkey ->
            _events.emit(OperatorStatusEvent.BreakEnded(pubkey))
        }
    }

    /**
     * Get break time remaining in seconds.
     *
     * @return Time remaining, or null if not on break.
     */
    fun getBreakTimeRemaining(): Long? {
        val startTime = breakStartTime ?: return null
        val type = breakType ?: return null
        val config = BREAK_CONFIGS[type] ?: return null

        val elapsed = (System.currentTimeMillis() - startTime) / 1000
        return maxOf(0, config.maxDuration - elapsed)
    }

    private fun handleBreakEnd() {
        breakTimer?.cancel()
        breakTimer = null
        breakStartTime = null
        breakType = null
        _breakTimeRemaining.value = null
    }

    // ============================================
    // Call Completion Recording
    // ============================================

    /**
     * Record a call completion for statistics.
     *
     * @param duration Total call duration in seconds.
     * @param holdTime Time spent on hold in seconds.
     */
    fun recordCallCompletion(duration: Long, holdTime: Long = 0) {
        val stats = shiftStats ?: return
        val status = currentStatus ?: return

        callDurations.add(duration)
        stats.callCount++
        stats.totalTalkTime += duration - holdTime
        stats.totalHoldTime += holdTime

        if (duration > stats.longestCall) {
            stats.longestCall = duration
        }
        if (duration < stats.shortestCall) {
            stats.shortestCall = duration
        }

        // Update current status call count
        currentStatus = status.copy(callCount = stats.callCount.toLong())
        _currentStatusState.value = currentStatus

        // Update shift stats state
        _shiftStatsState.value = stats.copy()

        Log.d(TAG, "Call recorded: duration=${duration}s, holdTime=${holdTime}s, totalCalls=${stats.callCount}")

        scope.launch {
            _events.emit(OperatorStatusEvent.StatusChanged(currentStatus!!))
        }
    }

    // ============================================
    // Status Queries
    // ============================================

    /**
     * Get current status.
     *
     * @return Current operator status, or null if not active.
     */
    fun getStatus(): HotlineOperatorStatus? = currentStatus

    /**
     * Get current shift statistics.
     *
     * @return Current shift stats with updated duration.
     */
    fun getShiftStats(): ShiftStats? {
        val stats = shiftStats ?: return null
        return stats.copy(
            shiftDuration = System.currentTimeMillis() - stats.shiftStart
        )
    }

    /**
     * Check if operator is available to take calls.
     */
    fun isAvailable(): Boolean {
        return currentStatus?.status == HotlineOperatorStatusStatus.Available
    }

    /**
     * Check if operator is currently on a call.
     */
    fun isOnCall(): Boolean {
        return currentStatus?.status == HotlineOperatorStatusStatus.OnCall
    }

    /**
     * Check if operator is on break.
     */
    fun isOnBreak(): Boolean {
        return currentStatus?.status == HotlineOperatorStatusStatus.Break
    }

    /**
     * Check if operator has an active shift.
     */
    fun hasActiveShift(): Boolean {
        return shiftStats != null
    }

    /**
     * Get formatted shift duration string.
     *
     * @return Duration in H:MM:SS format.
     */
    fun getFormattedShiftDuration(): String {
        return shiftStats?.getFormattedDuration() ?: "0:00:00"
    }

    // ============================================
    // Status Broadcasting
    // ============================================

    private suspend fun broadcastStatus(status: HotlineOperatorStatus) {
        try {
            val content = json.encodeToString(status)
            val tags = listOf(
                listOf("h", status.hotlineID),
                listOf("d", "operator:${status.pubkey}")
            )

            // In real implementation, create and publish Nostr event
            // nostrClient.publish(KIND_HOTLINE_OPERATOR_STATUS, content, tags)
            Log.d(TAG, "Status broadcast: ${status.status.value}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to broadcast operator status", e)
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        breakTimer?.cancel()
        breakTimer = null

        scope.cancel()

        Log.i(TAG, "OperatorStatusManager closed")
    }
}
