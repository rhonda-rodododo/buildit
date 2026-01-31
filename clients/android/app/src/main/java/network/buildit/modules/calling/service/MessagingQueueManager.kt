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
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.generated.schemas.calling.Contact
import network.buildit.generated.schemas.calling.HotlineCallStatePriority
import network.buildit.generated.schemas.calling.LastMessageBy
import network.buildit.generated.schemas.calling.MessagingHotlineThread
import network.buildit.generated.schemas.calling.MessagingHotlineThreadStatus
import network.buildit.generated.schemas.calling.Type
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Priority weights for thread ordering.
 * Higher weight = higher priority in queue.
 */
private val PRIORITY_WEIGHTS = mapOf(
    HotlineCallStatePriority.Urgent to 1000,
    HotlineCallStatePriority.High to 100,
    HotlineCallStatePriority.Medium to 10,
    HotlineCallStatePriority.Low to 1
)

/**
 * Configuration for messaging queue behavior.
 */
data class MessagingQueueConfig(
    /** Maximum threads per operator */
    val maxThreadsPerOperator: Int = 10,
    /** Auto-resolve threads after this many seconds of inactivity */
    val autoResolveAfterSeconds: Long = 86400L, // 24 hours
    /** Mark thread as waiting after operator response */
    val autoWaitAfterOperatorResponse: Boolean = true
)

/**
 * Represents a message in a thread.
 */
data class ThreadMessage(
    val id: String,
    val threadId: String,
    val content: String,
    val senderPubkey: String,
    val senderType: MessageSenderType,
    val timestamp: Long,
    var read: Boolean = false,
    val metadata: Map<String, String>? = null
)

/**
 * Message sender types.
 */
enum class MessageSenderType(val value: String) {
    CONTACT("contact"),
    OPERATOR("operator"),
    SYSTEM("system")
}

/**
 * Extended thread state with messages.
 */
data class MessagingThreadState(
    val thread: MessagingHotlineThread,
    val messages: MutableList<ThreadMessage> = mutableListOf(),
    var unreadCount: Int = 0,
    var lastMessage: ThreadMessage? = null,
    var lastActivityAt: Long = 0L,
    var waitTime: Long = 0L,
    var responseTime: Long? = null,
    var resolvedAt: Long? = null,
    var archivedAt: Long? = null,
    var notes: String? = null
)

/**
 * Filter criteria for thread queries.
 */
data class ThreadFilter(
    val status: List<MessagingHotlineThreadStatus>? = null,
    val assignedTo: String? = null,
    val priority: List<HotlineCallStatePriority>? = null,
    val contactType: List<Type>? = null,
    val hotlineId: String? = null,
    val unassigned: Boolean = false,
    val unread: Boolean = false
)

/**
 * Thread statistics for dashboard.
 */
data class ThreadStats(
    val total: Int,
    val unassigned: Int,
    val myThreads: Int,
    val waiting: Int,
    val active: Int,
    val avgResponseTime: Long,
    val avgResolutionTime: Long
)

/**
 * Events emitted by the messaging queue manager.
 */
sealed class MessagingQueueEvent {
    data class ThreadCreated(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class ThreadClaimed(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class ThreadAssigned(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class ThreadTransferred(
        val thread: MessagingThreadState,
        val fromOperator: String?,
        val toOperator: String,
        val reason: String?
    ) : MessagingQueueEvent()
    data class ThreadUpdated(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class ThreadResolved(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class ThreadArchived(val thread: MessagingThreadState) : MessagingQueueEvent()
    data class MessageAdded(val thread: MessagingThreadState, val message: ThreadMessage) : MessagingQueueEvent()
    data class QueueUpdated(val stats: ThreadStats) : MessagingQueueEvent()
}

/**
 * Messaging Queue Manager.
 *
 * Manages text-based hotline intake with thread assignment and routing.
 * Features:
 * - Thread status management (unassigned -> assigned -> active -> waiting -> resolved -> archived)
 * - Priority ordering (urgent > high > medium > low)
 * - Thread claiming, transfer, and resolution
 * - Message tracking with read receipts
 * - Statistics tracking
 *
 * Uses Kotlin coroutines and Flow for reactive state management.
 */
@Singleton
class MessagingQueueManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val nostrClient: NostrClient
) {
    companion object {
        private const val TAG = "MessagingQueueManager"
        private const val KIND_MESSAGING_THREAD = 24360
        private const val KIND_THREAD_MESSAGE = 24361
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Queue configuration */
    private var config = MessagingQueueConfig()

    /** Current operator pubkey */
    private var operatorPubkey: String = ""

    /** Current hotline ID */
    private var hotlineId: String = ""

    /** Threads by ID */
    private val threads = ConcurrentHashMap<String, MessagingThreadState>()

    // ============================================
    // State Flows
    // ============================================

    private val _threadsState = MutableStateFlow<Map<String, MessagingThreadState>>(emptyMap())
    /** Observable threads state */
    val threadsState: StateFlow<Map<String, MessagingThreadState>> = _threadsState.asStateFlow()

    private val _statsState = MutableStateFlow(ThreadStats(0, 0, 0, 0, 0, 0, 0))
    /** Observable thread statistics */
    val statsState: StateFlow<ThreadStats> = _statsState.asStateFlow()

    private val _events = MutableSharedFlow<MessagingQueueEvent>()
    /** Event stream for queue manager events */
    val events: SharedFlow<MessagingQueueEvent> = _events.asSharedFlow()

    // ============================================
    // Initialization
    // ============================================

    /**
     * Initialize the manager with operator context.
     *
     * @param operatorPubkey The current operator's pubkey.
     * @param hotlineId The hotline to manage.
     */
    fun initialize(operatorPubkey: String, hotlineId: String) {
        this.operatorPubkey = operatorPubkey
        this.hotlineId = hotlineId
        Log.d(TAG, "Initialized for operator: $operatorPubkey, hotline: $hotlineId")
    }

    /**
     * Update queue configuration.
     *
     * @param config New configuration settings.
     */
    fun updateConfig(config: MessagingQueueConfig) {
        this.config = config
        Log.d(TAG, "Config updated: maxThreadsPerOperator=${config.maxThreadsPerOperator}")
    }

    // ============================================
    // Thread Creation
    // ============================================

    /**
     * Create a new incoming thread.
     *
     * @param contactPubkey Contact's Nostr pubkey.
     * @param contactName Contact's display name.
     * @param contactPhone Contact's phone number.
     * @param contactType Type of contact (BuildIt, SMS, RCS).
     * @param initialMessage The first message content.
     * @param priority Thread priority level.
     * @param category Thread category for routing.
     * @param metadata Additional metadata.
     * @return The created thread state.
     */
    suspend fun createThread(
        contactPubkey: String,
        contactName: String? = null,
        contactPhone: String? = null,
        contactType: Type = Type.Buildit,
        initialMessage: String,
        priority: HotlineCallStatePriority = HotlineCallStatePriority.Medium,
        category: String? = null,
        metadata: Map<String, String>? = null
    ): MessagingThreadState {
        val threadId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val initialThreadMessage = ThreadMessage(
            id = UUID.randomUUID().toString(),
            threadId = threadId,
            content = initialMessage,
            senderPubkey = contactPubkey,
            senderType = MessageSenderType.CONTACT,
            timestamp = now,
            read = false,
            metadata = metadata
        )

        val contact = Contact(
            pubkey = contactPubkey,
            name = contactName,
            phone = contactPhone,
            type = contactType
        )

        val thread = MessagingHotlineThread(
            v = "1",
            threadID = threadId,
            hotlineID = hotlineId,
            contact = contact,
            status = MessagingHotlineThreadStatus.Unassigned,
            priority = priority,
            category = category,
            createdAt = now / 1000,
            messageCount = 1,
            lastMessageAt = now / 1000,
            lastMessageBy = LastMessageBy.Contact,
            unreadByOperator = 1
        )

        val threadState = MessagingThreadState(
            thread = thread,
            messages = mutableListOf(initialThreadMessage),
            unreadCount = 1,
            lastMessage = initialThreadMessage,
            lastActivityAt = now
        )

        threads[threadId] = threadState
        syncState()

        Log.i(TAG, "Thread created: $threadId from ${contact.name ?: contactPubkey}")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadCreated(threadState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        // Broadcast thread creation via signaling
        broadcastThread(threadState)

        return threadState
    }

    // ============================================
    // Thread Assignment
    // ============================================

    /**
     * Claim a thread as the current operator.
     *
     * @param threadId The thread ID to claim.
     * @return The updated thread state.
     * @throws IllegalStateException if thread not found or already assigned.
     */
    suspend fun claimThread(threadId: String): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        if (threadState.thread.status != MessagingHotlineThreadStatus.Unassigned) {
            throw IllegalStateException("Thread is already assigned")
        }

        val now = System.currentTimeMillis()
        val updatedThread = threadState.thread.copy(
            assignedOperator = operatorPubkey,
            status = MessagingHotlineThreadStatus.Active
        )

        threadState.responseTime = now - (threadState.thread.createdAt * 1000)

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState

        // Add system message
        addSystemMessage(threadId, "Thread claimed by operator")

        syncState()

        Log.i(TAG, "Thread claimed: $threadId by $operatorPubkey")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadClaimed(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        broadcastThread(newState)

        return newState
    }

    /**
     * Assign a thread to a specific operator.
     *
     * @param threadId The thread ID to assign.
     * @param operatorPubkey The operator to assign to (uses current operator if null).
     * @return The updated thread state.
     */
    suspend fun assignThread(
        threadId: String,
        operatorPubkey: String? = null
    ): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val targetOperator = operatorPubkey ?: this.operatorPubkey
        val now = System.currentTimeMillis()

        val updatedThread = threadState.thread.copy(
            assignedOperator = targetOperator,
            status = MessagingHotlineThreadStatus.Assigned
        )

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState

        addSystemMessage(threadId, "Thread assigned to operator")

        syncState()

        Log.i(TAG, "Thread assigned: $threadId to $targetOperator")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadAssigned(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        broadcastThread(newState)

        return newState
    }

    /**
     * Transfer a thread to another operator.
     *
     * @param threadId The thread ID to transfer.
     * @param targetOperatorPubkey The operator to transfer to.
     * @param reason Optional transfer reason.
     * @return The updated thread state.
     */
    suspend fun transferThread(
        threadId: String,
        targetOperatorPubkey: String,
        reason: String? = null
    ): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val previousOperator = threadState.thread.assignedOperator

        val updatedThread = threadState.thread.copy(
            assignedOperator = targetOperatorPubkey,
            status = MessagingHotlineThreadStatus.Assigned
        )

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState

        val message = reason?.let { "Thread transferred: $it" }
            ?: "Thread transferred to another operator"
        addSystemMessage(threadId, message)

        syncState()

        Log.i(TAG, "Thread transferred: $threadId from $previousOperator to $targetOperatorPubkey")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadTransferred(
                newState,
                previousOperator,
                targetOperatorPubkey,
                reason
            ))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        broadcastThread(newState)

        return newState
    }

    // ============================================
    // Thread Status Management
    // ============================================

    /**
     * Mark thread as waiting for contact response.
     *
     * @param threadId The thread ID.
     * @return The updated thread state.
     */
    suspend fun setWaiting(threadId: String): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val updatedThread = threadState.thread.copy(
            status = MessagingHotlineThreadStatus.Waiting
        )

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Thread set to waiting: $threadId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        return newState
    }

    /**
     * Set thread to active status.
     *
     * @param threadId The thread ID.
     * @return The updated thread state.
     */
    suspend fun setActive(threadId: String): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val updatedThread = threadState.thread.copy(
            status = MessagingHotlineThreadStatus.Active
        )

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Thread set to active: $threadId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        return newState
    }

    /**
     * Resolve a thread.
     *
     * @param threadId The thread ID.
     * @param summary Optional resolution summary.
     * @return The updated thread state.
     */
    suspend fun resolveThread(
        threadId: String,
        summary: String? = null
    ): MessagingThreadState {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val now = System.currentTimeMillis()

        val updatedThread = threadState.thread.copy(
            status = MessagingHotlineThreadStatus.Resolved,
            resolvedAt = now / 1000
        )

        val newState = threadState.copy(
            thread = updatedThread,
            resolvedAt = now,
            notes = summary ?: threadState.notes
        )
        threads[threadId] = newState

        addSystemMessage(threadId, "Thread resolved")

        syncState()

        Log.i(TAG, "Thread resolved: $threadId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadResolved(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }

        broadcastThread(newState)

        return newState
    }

    /**
     * Archive a resolved thread.
     *
     * @param threadId The thread ID.
     * @throws IllegalStateException if thread not resolved.
     */
    suspend fun archiveThread(threadId: String) {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        if (threadState.thread.status != MessagingHotlineThreadStatus.Resolved) {
            throw IllegalStateException("Can only archive resolved threads")
        }

        val now = System.currentTimeMillis()

        val updatedThread = threadState.thread.copy(
            status = MessagingHotlineThreadStatus.Archived
        )

        val newState = threadState.copy(
            thread = updatedThread,
            archivedAt = now
        )
        threads[threadId] = newState
        syncState()

        Log.i(TAG, "Thread archived: $threadId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadArchived(newState))
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }
    }

    // ============================================
    // Message Management
    // ============================================

    /**
     * Add a message to a thread.
     *
     * @param threadId The thread ID.
     * @param content The message content.
     * @param senderType Who is sending (contact or operator).
     * @return The added message.
     */
    suspend fun addMessage(
        threadId: String,
        content: String,
        senderType: MessageSenderType = MessageSenderType.OPERATOR
    ): ThreadMessage {
        val threadState = threads[threadId]
            ?: throw IllegalStateException("Thread not found: $threadId")

        val now = System.currentTimeMillis()
        val senderPubkey = when (senderType) {
            MessageSenderType.OPERATOR -> operatorPubkey
            MessageSenderType.CONTACT -> threadState.thread.contact?.pubkey ?: ""
            MessageSenderType.SYSTEM -> "system"
        }

        val message = ThreadMessage(
            id = UUID.randomUUID().toString(),
            threadId = threadId,
            content = content,
            senderPubkey = senderPubkey,
            senderType = senderType,
            timestamp = now,
            read = senderType == MessageSenderType.OPERATOR
        )

        threadState.messages.add(message)
        threadState.lastMessage = message
        threadState.lastActivityAt = now

        val lastMessageBy = when (senderType) {
            MessageSenderType.CONTACT -> LastMessageBy.Contact
            else -> LastMessageBy.Operator
        }

        var updatedThread = threadState.thread.copy(
            messageCount = (threadState.thread.messageCount ?: 0) + 1,
            lastMessageAt = now / 1000,
            lastMessageBy = lastMessageBy
        )

        if (senderType == MessageSenderType.CONTACT) {
            threadState.unreadCount++
            updatedThread = updatedThread.copy(
                unreadByOperator = (updatedThread.unreadByOperator ?: 0) + 1
            )

            // Auto-reactivate if waiting
            if (threadState.thread.status == MessagingHotlineThreadStatus.Waiting) {
                updatedThread = updatedThread.copy(status = MessagingHotlineThreadStatus.Active)
            }
        } else if (senderType == MessageSenderType.OPERATOR && config.autoWaitAfterOperatorResponse) {
            // Set to waiting after operator responds
            if (threadState.thread.status == MessagingHotlineThreadStatus.Active) {
                updatedThread = updatedThread.copy(status = MessagingHotlineThreadStatus.Waiting)
            }
        }

        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Message added to thread $threadId by ${senderType.value}")

        scope.launch {
            _events.emit(MessagingQueueEvent.MessageAdded(newState, message))
        }

        // Broadcast message via signaling
        broadcastMessage(message, newState)

        return message
    }

    /**
     * Add a system message to a thread.
     */
    private suspend fun addSystemMessage(threadId: String, content: String) {
        val threadState = threads[threadId] ?: return

        val message = ThreadMessage(
            id = UUID.randomUUID().toString(),
            threadId = threadId,
            content = content,
            senderPubkey = "system",
            senderType = MessageSenderType.SYSTEM,
            timestamp = System.currentTimeMillis(),
            read = true
        )

        threadState.messages.add(message)
        threadState.lastActivityAt = message.timestamp
    }

    /**
     * Mark messages as read.
     *
     * @param threadId The thread ID.
     */
    fun markAsRead(threadId: String) {
        val threadState = threads[threadId] ?: return

        threadState.messages.forEach { msg ->
            if (!msg.read && msg.senderType == MessageSenderType.CONTACT) {
                msg.read = true
            }
        }
        threadState.unreadCount = 0

        val updatedThread = threadState.thread.copy(unreadByOperator = 0)
        threads[threadId] = threadState.copy(thread = updatedThread)
        syncState()

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(threadState))
        }

        Log.d(TAG, "Messages marked as read in thread: $threadId")
    }

    // ============================================
    // Thread Properties
    // ============================================

    /**
     * Update thread priority.
     *
     * @param threadId The thread ID.
     * @param priority The new priority.
     */
    suspend fun setPriority(threadId: String, priority: HotlineCallStatePriority) {
        val threadState = threads[threadId] ?: return

        val updatedThread = threadState.thread.copy(priority = priority)
        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Thread priority updated: $threadId to ${priority.value}")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
        }
    }

    /**
     * Update thread category.
     *
     * @param threadId The thread ID.
     * @param category The new category.
     */
    suspend fun setCategory(threadId: String, category: String) {
        val threadState = threads[threadId] ?: return

        val updatedThread = threadState.thread.copy(category = category)
        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Thread category updated: $threadId to $category")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
        }
    }

    /**
     * Update thread notes.
     *
     * @param threadId The thread ID.
     * @param notes The notes content.
     */
    suspend fun setNotes(threadId: String, notes: String) {
        val threadState = threads[threadId] ?: return

        val newState = threadState.copy(notes = notes)
        threads[threadId] = newState
        syncState()

        Log.d(TAG, "Thread notes updated: $threadId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
        }
    }

    /**
     * Link thread to a voice call (escalation).
     *
     * @param threadId The thread ID.
     * @param callId The linked call ID.
     */
    suspend fun linkToCall(threadId: String, callId: String) {
        val threadState = threads[threadId] ?: return

        val updatedThread = threadState.thread.copy(linkedCallID = callId)
        val newState = threadState.copy(thread = updatedThread)
        threads[threadId] = newState
        syncState()

        addSystemMessage(threadId, "Escalated to voice call")

        Log.i(TAG, "Thread linked to call: $threadId -> $callId")

        scope.launch {
            _events.emit(MessagingQueueEvent.ThreadUpdated(newState))
        }
    }

    // ============================================
    // Thread Queries
    // ============================================

    /**
     * Get a thread by ID.
     *
     * @param threadId The thread ID.
     * @return The thread state, or null if not found.
     */
    fun getThread(threadId: String): MessagingThreadState? = threads[threadId]

    /**
     * Get threads with optional filtering.
     *
     * @param filter Filter criteria.
     * @return List of matching threads sorted by priority and activity.
     */
    fun getThreads(filter: ThreadFilter? = null): List<MessagingThreadState> {
        var result = threads.values.toList()

        filter?.let { f ->
            f.status?.let { statusList ->
                result = result.filter { statusList.contains(it.thread.status) }
            }
            f.assignedTo?.let { assignee ->
                result = result.filter { it.thread.assignedOperator == assignee }
            }
            if (f.unassigned) {
                result = result.filter { it.thread.assignedOperator == null }
            }
            f.priority?.let { priorityList ->
                result = result.filter { priorityList.contains(it.thread.priority) }
            }
            f.contactType?.let { typeList ->
                result = result.filter { typeList.contains(it.thread.contact?.type) }
            }
            f.hotlineId?.let { hid ->
                result = result.filter { it.thread.hotlineID == hid }
            }
            if (f.unread) {
                result = result.filter { it.unreadCount > 0 }
            }
        }

        // Sort by priority weight then by last activity
        return result.sortedWith(
            compareByDescending<MessagingThreadState> {
                PRIORITY_WEIGHTS[it.thread.priority] ?: 0
            }.thenByDescending { it.lastActivityAt }
        )
    }

    /**
     * Get queue statistics.
     *
     * @return Current thread statistics.
     */
    fun getStats(): ThreadStats {
        val activeThreads = threads.values.filter {
            it.thread.status != MessagingHotlineThreadStatus.Resolved &&
                it.thread.status != MessagingHotlineThreadStatus.Archived
        }

        val responseTimes = threads.values
            .mapNotNull { it.responseTime }
        val avgResponseTime = if (responseTimes.isNotEmpty()) {
            responseTimes.sum() / responseTimes.size
        } else 0L

        val resolutionTimes = threads.values
            .filter { it.resolvedAt != null }
            .map { it.resolvedAt!! - (it.thread.createdAt * 1000) }
        val avgResolutionTime = if (resolutionTimes.isNotEmpty()) {
            resolutionTimes.sum() / resolutionTimes.size
        } else 0L

        return ThreadStats(
            total = activeThreads.size,
            unassigned = activeThreads.count { it.thread.status == MessagingHotlineThreadStatus.Unassigned },
            myThreads = activeThreads.count { it.thread.assignedOperator == operatorPubkey },
            waiting = activeThreads.count { it.thread.status == MessagingHotlineThreadStatus.Waiting },
            active = activeThreads.count { it.thread.status == MessagingHotlineThreadStatus.Active },
            avgResponseTime = avgResponseTime,
            avgResolutionTime = avgResolutionTime
        )
    }

    // ============================================
    // Signaling
    // ============================================

    private suspend fun broadcastThread(threadState: MessagingThreadState) {
        try {
            val content = json.encodeToString(threadState.thread)
            val tags = listOf(
                listOf("h", threadState.thread.hotlineID),
                listOf("d", "thread:${threadState.thread.threadID}")
            )

            // In real implementation, create and publish Nostr event
            // nostrClient.publishEvent(NostrEvent(...))
            Log.d(TAG, "Thread broadcast: ${threadState.thread.threadID}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to broadcast thread", e)
        }
    }

    private suspend fun broadcastMessage(message: ThreadMessage, threadState: MessagingThreadState) {
        try {
            // In real implementation: encrypt and send via NIP-17
            Log.d(TAG, "Message broadcast: ${message.id} in thread ${message.threadId}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to broadcast message", e)
        }
    }

    // ============================================
    // State Management
    // ============================================

    private fun syncState() {
        _threadsState.value = threads.toMap()
        _statsState.value = getStats()
    }

    /**
     * Clear all threads (for testing).
     */
    fun clear() {
        threads.clear()
        syncState()
        scope.launch {
            _events.emit(MessagingQueueEvent.QueueUpdated(getStats()))
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        threads.clear()
        scope.cancel()
        Log.i(TAG, "MessagingQueueManager closed")
    }
}
