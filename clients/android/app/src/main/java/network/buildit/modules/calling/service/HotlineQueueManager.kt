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
import network.buildit.generated.schemas.HotlineCallState
import network.buildit.generated.schemas.HotlineCallStateCallType
import network.buildit.generated.schemas.HotlineCallStatePriority
import network.buildit.generated.schemas.HotlineCallStateState
import network.buildit.generated.schemas.HotlineOperatorStatusStatus
import network.buildit.generated.schemas.Caller
import network.buildit.generated.schemas.Operator
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Priority weights for queue ordering.
 * Higher weight = higher priority in queue.
 */
private val PRIORITY_WEIGHTS = mapOf(
    HotlineCallStatePriority.Urgent to 1000,
    HotlineCallStatePriority.High to 100,
    HotlineCallStatePriority.Medium to 10,
    HotlineCallStatePriority.Low to 1
)

/**
 * Configuration for Automatic Call Distribution (ACD) behavior.
 */
data class ACDConfig(
    /** Seconds before returning call to queue if not answered */
    val ringTimeout: Long = 30L,
    /** Seconds in wrap-up state after call */
    val wrapUpDuration: Long = 60L,
    /** Maximum calls allowed in queue */
    val maxQueueSize: Int = 50,
    /** Average call duration for wait time estimation (seconds) */
    val averageHandleTime: Long = 300L
)

/**
 * Represents a call waiting in the queue.
 */
data class QueuedCall(
    val callId: String,
    val hotlineId: String,
    val groupId: String? = null,
    val callerPubkey: String? = null,
    val callerPhone: String? = null,
    val callerName: String? = null,
    val priority: HotlineCallStatePriority,
    val category: String? = null,
    val queuedAt: Long,
    var position: Int,
    var estimatedWaitTime: Long,
    var assignedOperator: String? = null,
    var ringStartedAt: Long? = null
)

/**
 * Represents an operator's current state.
 */
data class OperatorState(
    val pubkey: String,
    val displayName: String? = null,
    val hotlineId: String,
    var status: HotlineOperatorStatusStatus,
    var currentCallId: String? = null,
    var callCount: Int = 0,
    val shiftStart: Long,
    var lastCallEndedAt: Long? = null
)

/**
 * Queue statistics for dashboard display.
 */
data class QueueStats(
    val totalCalls: Int,
    val avgWaitTime: Long,
    val longestWait: Long,
    val byPriority: Map<HotlineCallStatePriority, Int>,
    val availableOperators: Int,
    val onCallOperators: Int
)

/**
 * Events emitted by the queue manager.
 */
sealed class HotlineQueueEvent {
    data class CallQueued(val call: QueuedCall) : HotlineQueueEvent()
    data class CallAssigned(val call: QueuedCall, val operator: OperatorState) : HotlineQueueEvent()
    data class CallAnswered(val callId: String, val operatorPubkey: String) : HotlineQueueEvent()
    data class CallAbandoned(val callId: String) : HotlineQueueEvent()
    data class CallReturnedToQueue(val callId: String) : HotlineQueueEvent()
    data class QueueUpdated(val hotlineId: String, val queue: List<QueuedCall>) : HotlineQueueEvent()
    data class OperatorStatusChanged(val operator: OperatorState) : HotlineQueueEvent()
    data class WaitTimeUpdated(val hotlineId: String, val estimatedWait: Long) : HotlineQueueEvent()
}

/**
 * Hotline Queue Manager.
 *
 * Manages call queues with priority ordering and Automatic Call Distribution (ACD).
 * Features:
 * - Priority-based queue ordering (urgent > high > medium > low)
 * - Automatic call distribution to available operators
 * - Ring timeout with automatic queue return
 * - Operator registration and status tracking
 * - Integration with ConnectionService for system call UI
 */
@Singleton
class HotlineQueueManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "HotlineQueueManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** ACD configuration */
    private var config = ACDConfig()

    /** Queues by hotline ID */
    private val queues = ConcurrentHashMap<String, MutableList<QueuedCall>>()

    /** Operators by pubkey */
    private val operators = ConcurrentHashMap<String, OperatorState>()

    /** Ring timers by call ID */
    private val ringTimers = ConcurrentHashMap<String, Job>()

    /** Wrap-up timers by operator pubkey */
    private val wrapUpTimers = ConcurrentHashMap<String, Job>()

    // ============================================
    // State Flows
    // ============================================

    private val _queueState = MutableStateFlow<Map<String, List<QueuedCall>>>(emptyMap())
    /** Observable queue state by hotline ID */
    val queueState: StateFlow<Map<String, List<QueuedCall>>> = _queueState.asStateFlow()

    private val _operatorState = MutableStateFlow<Map<String, OperatorState>>(emptyMap())
    /** Observable operator state by pubkey */
    val operatorState: StateFlow<Map<String, OperatorState>> = _operatorState.asStateFlow()

    private val _events = MutableSharedFlow<HotlineQueueEvent>()
    /** Event stream for queue manager events */
    val events: SharedFlow<HotlineQueueEvent> = _events.asSharedFlow()

    // ============================================
    // Configuration
    // ============================================

    /**
     * Update ACD configuration.
     *
     * @param config New ACD configuration settings.
     */
    fun updateConfig(config: ACDConfig) {
        this.config = config
        Log.d(TAG, "ACD config updated: ringTimeout=${config.ringTimeout}s, wrapUp=${config.wrapUpDuration}s")
    }

    // ============================================
    // Queue Operations
    // ============================================

    /**
     * Enqueue a new incoming call.
     *
     * @param hotlineId The hotline this call is for.
     * @param callId Optional call ID (generated if not provided).
     * @param groupId Optional group context.
     * @param callerPubkey Caller's Nostr pubkey (for internal calls).
     * @param callerPhone Caller's phone number (for PSTN calls).
     * @param callerName Caller's display name.
     * @param priority Call priority level.
     * @param category Call category for routing/reporting.
     * @return The queued call entry.
     * @throws IllegalStateException if queue is full.
     */
    suspend fun enqueueCall(
        hotlineId: String,
        callId: String = UUID.randomUUID().toString(),
        groupId: String? = null,
        callerPubkey: String? = null,
        callerPhone: String? = null,
        callerName: String? = null,
        priority: HotlineCallStatePriority = HotlineCallStatePriority.Medium,
        category: String? = null
    ): QueuedCall {
        val queue = getOrCreateQueue(hotlineId)

        // Check queue size limit
        if (queue.size >= config.maxQueueSize) {
            Log.w(TAG, "Queue is full for hotline: $hotlineId")
            throw IllegalStateException("Queue is full")
        }

        val now = System.currentTimeMillis()
        val call = QueuedCall(
            callId = callId,
            hotlineId = hotlineId,
            groupId = groupId,
            callerPubkey = callerPubkey,
            callerPhone = callerPhone,
            callerName = callerName,
            priority = priority,
            category = category,
            queuedAt = now,
            position = queue.size + 1,
            estimatedWaitTime = estimateWaitTime(hotlineId, priority)
        )

        // Insert in priority order
        synchronized(queue) {
            insertByPriority(queue, call)
            updatePositions(hotlineId)
        }

        // Update state flows
        syncQueueState()

        Log.i(TAG, "Call queued: $callId at position ${call.position} with priority ${priority.value}")

        scope.launch {
            _events.emit(HotlineQueueEvent.CallQueued(call))
            _events.emit(HotlineQueueEvent.QueueUpdated(hotlineId, queue.toList()))
        }

        // Try to distribute immediately
        attemptDistribution(hotlineId)

        return call
    }

    /**
     * Remove a call from the queue.
     *
     * @param callId The call ID to remove.
     * @return The removed call, or null if not found.
     */
    fun dequeueCall(callId: String): QueuedCall? {
        for ((hotlineId, queue) in queues) {
            synchronized(queue) {
                val index = queue.indexOfFirst { it.callId == callId }
                if (index >= 0) {
                    val call = queue.removeAt(index)
                    updatePositions(hotlineId)
                    syncQueueState()

                    scope.launch {
                        _events.emit(HotlineQueueEvent.QueueUpdated(hotlineId, queue.toList()))
                    }

                    Log.d(TAG, "Call dequeued: $callId")
                    return call
                }
            }
        }
        return null
    }

    /**
     * Mark a call as abandoned (caller hung up while waiting).
     *
     * @param callId The call ID that was abandoned.
     */
    fun abandonCall(callId: String) {
        val call = dequeueCall(callId)
        if (call != null) {
            scope.launch {
                _events.emit(HotlineQueueEvent.CallAbandoned(callId))
            }
            Log.i(TAG, "Call abandoned: $callId")
        }
        clearRingTimer(callId)
    }

    // ============================================
    // Operator Management
    // ============================================

    /**
     * Register an operator for a hotline.
     *
     * @param pubkey Operator's Nostr pubkey.
     * @param hotlineId The hotline the operator is joining.
     * @param displayName Operator's display name.
     * @return The operator state.
     */
    fun registerOperator(
        pubkey: String,
        hotlineId: String,
        displayName: String? = null
    ): OperatorState {
        val operator = OperatorState(
            pubkey = pubkey,
            displayName = displayName,
            hotlineId = hotlineId,
            status = HotlineOperatorStatusStatus.Available,
            callCount = 0,
            shiftStart = System.currentTimeMillis()
        )

        operators[pubkey] = operator
        syncOperatorState()

        Log.i(TAG, "Operator registered: $pubkey for hotline $hotlineId")

        scope.launch {
            _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))
            // Try to distribute calls to new operator
            attemptDistribution(hotlineId)
        }

        return operator
    }

    /**
     * Unregister an operator (end shift).
     *
     * @param pubkey Operator's Nostr pubkey.
     */
    fun unregisterOperator(pubkey: String) {
        val operator = operators.remove(pubkey)
        if (operator != null) {
            clearWrapUpTimer(pubkey)
            syncOperatorState()

            val offlineOperator = operator.copy(status = HotlineOperatorStatusStatus.Offline)
            scope.launch {
                _events.emit(HotlineQueueEvent.OperatorStatusChanged(offlineOperator))
            }

            Log.i(TAG, "Operator unregistered: $pubkey")
        }
    }

    /**
     * Update an operator's status.
     *
     * @param pubkey Operator's Nostr pubkey.
     * @param status New status.
     */
    fun setOperatorStatus(pubkey: String, status: HotlineOperatorStatusStatus) {
        val operator = operators[pubkey] ?: return

        val previousStatus = operator.status
        operator.status = status

        // Clear wrap-up timer if changing from wrap-up
        if (previousStatus == HotlineOperatorStatusStatus.WrapUp) {
            clearWrapUpTimer(pubkey)
        }

        syncOperatorState()

        scope.launch {
            _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))
        }

        Log.d(TAG, "Operator $pubkey status changed: ${previousStatus.value} -> ${status.value}")

        // Try to distribute if becoming available
        if (status == HotlineOperatorStatusStatus.Available) {
            scope.launch {
                attemptDistribution(operator.hotlineId)
            }
        }
    }

    /**
     * Get available operators for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return List of available operators.
     */
    fun getAvailableOperators(hotlineId: String): List<OperatorState> {
        return operators.values.filter { op ->
            op.hotlineId == hotlineId && op.status == HotlineOperatorStatusStatus.Available
        }
    }

    /**
     * Get all operators for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return List of all operators.
     */
    fun getOperators(hotlineId: String): List<OperatorState> {
        return operators.values.filter { it.hotlineId == hotlineId }
    }

    /**
     * Get operator by pubkey.
     *
     * @param pubkey Operator's Nostr pubkey.
     * @return The operator state, or null if not found.
     */
    fun getOperator(pubkey: String): OperatorState? = operators[pubkey]

    // ============================================
    // Queue Access
    // ============================================

    /**
     * Get the current queue for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return Copy of the current queue.
     */
    fun getQueue(hotlineId: String): List<QueuedCall> {
        return queues[hotlineId]?.toList() ?: emptyList()
    }

    /**
     * Get queue position for a specific call.
     *
     * @param callId The call ID.
     * @return Queue position (1-based), or null if not in queue.
     */
    fun getQueuePosition(callId: String): Int? {
        for (queue in queues.values) {
            val call = queue.find { it.callId == callId }
            if (call != null) return call.position
        }
        return null
    }

    /**
     * Get queue statistics for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return Queue statistics.
     */
    fun getQueueStats(hotlineId: String): QueueStats {
        val queue = queues[hotlineId] ?: emptyList()
        val hotlineOperators = getOperators(hotlineId)
        val now = System.currentTimeMillis()

        val byPriority = mutableMapOf(
            HotlineCallStatePriority.Urgent to 0,
            HotlineCallStatePriority.High to 0,
            HotlineCallStatePriority.Medium to 0,
            HotlineCallStatePriority.Low to 0
        )

        var totalWait = 0L
        var longestWait = 0L

        synchronized(queue) {
            for (call in queue) {
                byPriority[call.priority] = (byPriority[call.priority] ?: 0) + 1
                val waitTime = now - call.queuedAt
                totalWait += waitTime
                if (waitTime > longestWait) longestWait = waitTime
            }
        }

        return QueueStats(
            totalCalls = queue.size,
            avgWaitTime = if (queue.isNotEmpty()) totalWait / queue.size / 1000 else 0,
            longestWait = longestWait / 1000,
            byPriority = byPriority,
            availableOperators = hotlineOperators.count { it.status == HotlineOperatorStatusStatus.Available },
            onCallOperators = hotlineOperators.count { it.status == HotlineOperatorStatusStatus.OnCall }
        )
    }

    // ============================================
    // Call Distribution (ACD)
    // ============================================

    /**
     * Attempt to distribute calls to available operators.
     *
     * @param hotlineId The hotline ID to distribute calls for.
     */
    suspend fun attemptDistribution(hotlineId: String) {
        val queue = queues[hotlineId] ?: return
        if (queue.isEmpty()) return

        val availableOperators = getAvailableOperators(hotlineId)
        if (availableOperators.isEmpty()) return

        // Get the highest priority call that isn't already being rung
        val callToAssign = synchronized(queue) {
            queue.find { it.assignedOperator == null }
        } ?: return

        // Find the best operator (round-robin based on call count)
        val operator = availableOperators.minByOrNull { it.callCount } ?: return

        assignCallToOperator(callToAssign, operator)
    }

    /**
     * Assign a call to a specific operator.
     *
     * @param call The call to assign.
     * @param operator The operator to assign to.
     */
    private suspend fun assignCallToOperator(call: QueuedCall, operator: OperatorState) {
        call.assignedOperator = operator.pubkey
        call.ringStartedAt = System.currentTimeMillis()

        // Update operator status to on-call (ringing)
        operator.status = HotlineOperatorStatusStatus.OnCall
        operator.currentCallId = call.callId

        syncOperatorState()

        Log.i(TAG, "Call ${call.callId} assigned to operator ${operator.pubkey}")

        _events.emit(HotlineQueueEvent.CallAssigned(call, operator))
        _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))

        // Set ring timeout
        val timer = scope.launch {
            delay(config.ringTimeout * 1000)
            handleRingTimeout(call.callId)
        }
        ringTimers[call.callId] = timer
    }

    /**
     * Handle operator answering a call.
     *
     * @param callId The call ID being answered.
     * @param operatorPubkey The answering operator's pubkey.
     */
    fun handleOperatorAnswer(callId: String, operatorPubkey: String) {
        clearRingTimer(callId)

        val call = dequeueCall(callId) ?: return

        val operator = operators[operatorPubkey]
        if (operator != null) {
            operator.status = HotlineOperatorStatusStatus.OnCall
            operator.currentCallId = callId
            operator.callCount++
            syncOperatorState()

            scope.launch {
                _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))
            }
        }

        Log.i(TAG, "Call $callId answered by operator $operatorPubkey")

        scope.launch {
            _events.emit(HotlineQueueEvent.CallAnswered(callId, operatorPubkey))
        }
    }

    /**
     * Handle call ending.
     *
     * @param callId The call ID that ended.
     * @param operatorPubkey The operator who handled the call.
     */
    fun handleCallEnd(callId: String, operatorPubkey: String) {
        val operator = operators[operatorPubkey] ?: return

        operator.currentCallId = null
        operator.lastCallEndedAt = System.currentTimeMillis()

        // Enter wrap-up state
        operator.status = HotlineOperatorStatusStatus.WrapUp
        syncOperatorState()

        Log.d(TAG, "Call $callId ended, operator $operatorPubkey entering wrap-up")

        scope.launch {
            _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))
        }

        // Auto-return to available after wrap-up duration
        val timer = scope.launch {
            delay(config.wrapUpDuration * 1000)
            setOperatorStatus(operatorPubkey, HotlineOperatorStatusStatus.Available)
        }
        wrapUpTimers[operatorPubkey] = timer
    }

    /**
     * Handle ring timeout - return call to queue.
     *
     * @param callId The call ID that timed out.
     */
    private fun handleRingTimeout(callId: String) {
        clearRingTimer(callId)

        for ((hotlineId, queue) in queues) {
            val call = synchronized(queue) {
                queue.find { it.callId == callId && it.assignedOperator != null }
            } ?: continue

            val assignedOperator = call.assignedOperator ?: continue

            // Reset the operator back to available
            val operator = operators[assignedOperator]
            if (operator != null) {
                operator.status = HotlineOperatorStatusStatus.Available
                operator.currentCallId = null
                syncOperatorState()

                scope.launch {
                    _events.emit(HotlineQueueEvent.OperatorStatusChanged(operator))
                }
            }

            // Remove assignment and bump priority
            call.assignedOperator = null
            call.ringStartedAt = null

            // Bump priority slightly for long-waiting callers
            if (call.priority != HotlineCallStatePriority.Urgent) {
                val priorities = listOf(
                    HotlineCallStatePriority.Low,
                    HotlineCallStatePriority.Medium,
                    HotlineCallStatePriority.High,
                    HotlineCallStatePriority.Urgent
                )
                val currentIndex = priorities.indexOf(call.priority)
                if (currentIndex < priorities.size - 1) {
                    call.priority = priorities[currentIndex + 1]
                    // Re-sort queue
                    synchronized(queue) {
                        queue.sortWith(compareByDescending<QueuedCall> {
                            PRIORITY_WEIGHTS[it.priority] ?: 0
                        }.thenBy { it.queuedAt })
                        updatePositions(hotlineId)
                    }
                    Log.d(TAG, "Call $callId priority bumped to ${call.priority.value}")
                }
            }

            syncQueueState()

            Log.i(TAG, "Call $callId returned to queue after ring timeout")

            scope.launch {
                _events.emit(HotlineQueueEvent.CallReturnedToQueue(callId))
                // Try to assign to another operator
                attemptDistribution(hotlineId)
            }

            break
        }
    }

    // ============================================
    // Wait Time Estimation
    // ============================================

    /**
     * Get estimated wait time for a new call at given priority.
     *
     * @param hotlineId The hotline ID.
     * @param priority Call priority level.
     * @return Estimated wait time in seconds.
     */
    private fun estimateWaitTime(hotlineId: String, priority: HotlineCallStatePriority): Long {
        val queue = queues[hotlineId] ?: return 0
        val availableOperators = getAvailableOperators(hotlineId)
        val priorityWeight = PRIORITY_WEIGHTS[priority] ?: 0

        val callsAhead = synchronized(queue) {
            queue.count { (PRIORITY_WEIGHTS[it.priority] ?: 0) >= priorityWeight }
        }

        if (availableOperators.isEmpty()) {
            // No operators: estimate based on average handle time
            return callsAhead * config.averageHandleTime
        }

        // With available operators, estimate is lower
        return (callsAhead * config.averageHandleTime) / availableOperators.size
    }

    /**
     * Update wait time estimates for all calls in queue.
     *
     * @param hotlineId The hotline ID.
     */
    fun updateWaitEstimates(hotlineId: String) {
        val queue = queues[hotlineId] ?: return
        val availableOperators = getAvailableOperators(hotlineId)
        val operatorCount = maxOf(1, availableOperators.size)

        synchronized(queue) {
            queue.forEachIndexed { index, call ->
                call.estimatedWaitTime = ((index + 1) * config.averageHandleTime) / operatorCount
            }
        }

        val averageWait = if (queue.isNotEmpty()) {
            queue.sumOf { it.estimatedWaitTime } / queue.size
        } else 0L

        syncQueueState()

        scope.launch {
            _events.emit(HotlineQueueEvent.WaitTimeUpdated(hotlineId, averageWait))
        }
    }

    // ============================================
    // Conversion to Schema Types
    // ============================================

    /**
     * Convert a queued call to HotlineCallState schema type.
     *
     * @param call The queued call.
     * @return HotlineCallState for protocol/storage use.
     */
    fun toHotlineCallState(call: QueuedCall): HotlineCallState {
        return HotlineCallState(
            v = "1",
            callID = call.callId,
            hotlineID = call.hotlineId,
            groupID = call.groupId,
            callType = if (call.callerPubkey != null) {
                HotlineCallStateCallType.Internal
            } else {
                HotlineCallStateCallType.Pstn
            },
            state = if (call.assignedOperator != null) {
                HotlineCallStateState.Ringing
            } else {
                HotlineCallStateState.Queued
            },
            caller = Caller(
                pubkey = call.callerPubkey,
                phone = call.callerPhone,
                name = call.callerName
            ),
            queuedAt = call.queuedAt / 1000,
            queuePosition = call.position.toLong(),
            waitDuration = call.estimatedWaitTime,
            priority = call.priority,
            category = call.category
        )
    }

    // ============================================
    // Private Helpers
    // ============================================

    private fun getOrCreateQueue(hotlineId: String): MutableList<QueuedCall> {
        return queues.getOrPut(hotlineId) { mutableListOf() }
    }

    private fun insertByPriority(queue: MutableList<QueuedCall>, call: QueuedCall) {
        val callWeight = PRIORITY_WEIGHTS[call.priority] ?: 0

        val insertIndex = queue.indexOfFirst { existing ->
            val existingWeight = PRIORITY_WEIGHTS[existing.priority] ?: 0
            existingWeight < callWeight ||
                (existingWeight == callWeight && existing.queuedAt > call.queuedAt)
        }

        if (insertIndex == -1) {
            queue.add(call)
        } else {
            queue.add(insertIndex, call)
        }
    }

    private fun updatePositions(hotlineId: String) {
        val queue = queues[hotlineId] ?: return
        synchronized(queue) {
            queue.forEachIndexed { index, call ->
                call.position = index + 1
            }
        }
    }

    private fun syncQueueState() {
        _queueState.value = queues.mapValues { it.value.toList() }
    }

    private fun syncOperatorState() {
        _operatorState.value = operators.toMap()
    }

    private fun clearRingTimer(callId: String) {
        ringTimers.remove(callId)?.cancel()
    }

    private fun clearWrapUpTimer(pubkey: String) {
        wrapUpTimers.remove(pubkey)?.cancel()
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        ringTimers.values.forEach { it.cancel() }
        ringTimers.clear()

        wrapUpTimers.values.forEach { it.cancel() }
        wrapUpTimers.clear()

        queues.clear()
        operators.clear()

        scope.cancel()

        Log.i(TAG, "HotlineQueueManager closed")
    }
}
