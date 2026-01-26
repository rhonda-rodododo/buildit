package network.buildit.core.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Represents the current network connectivity state.
 */
enum class NetworkState {
    OFFLINE,
    WIFI,
    CELLULAR,
    UNKNOWN;

    val isConnected: Boolean
        get() = this != OFFLINE && this != UNKNOWN

    val description: String
        get() = when (this) {
            OFFLINE -> "Offline"
            WIFI -> "WiFi"
            CELLULAR -> "Cellular"
            UNKNOWN -> "Unknown"
        }
}

/**
 * Sync status for the application.
 */
sealed class SyncStatus {
    object Idle : SyncStatus()
    data class Syncing(val progress: Float, val message: String) : SyncStatus()
    data class Completed(val itemsProcessed: Int) : SyncStatus()
    data class Error(val message: String) : SyncStatus()
    object Offline : SyncStatus()

    val description: String
        get() = when (this) {
            is Idle -> "Up to date"
            is Syncing -> "$message (${(progress * 100).toInt()}%)"
            is Completed -> "Synced $itemsProcessed items"
            is Error -> "Error: $message"
            is Offline -> "Offline"
        }
}

/**
 * Conflict resolution strategy.
 */
enum class ConflictResolution {
    SERVER_WINS,
    CLIENT_WINS,
    MERGE,
    MANUAL
}

/**
 * Represents a sync conflict.
 */
@Serializable
data class SyncConflict(
    val id: String,
    val operationType: String,
    val localVersion: String,
    val serverVersion: String,
    val localTimestamp: Long,
    val serverTimestamp: Long,
    var resolution: ConflictResolution? = null
)

/**
 * SyncManager handles all offline sync operations.
 *
 * Features:
 * - Network connectivity monitoring via ConnectivityManager
 * - Background sync via WorkManager
 * - Retry logic with exponential backoff
 * - Conflict resolution for concurrent edits
 * - Flow-based sync status updates
 */
@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val offlineQueueDao: OfflineQueueDao
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val json = Json { ignoreUnknownKeys = true }

    // Network state
    private val _networkState = MutableStateFlow(NetworkState.UNKNOWN)
    val networkState: StateFlow<NetworkState> = _networkState.asStateFlow()

    // Sync status
    private val _syncStatus = MutableStateFlow<SyncStatus>(SyncStatus.Idle)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    // Syncing flag
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    // Last sync time
    private val _lastSyncTime = MutableStateFlow<Long?>(null)
    val lastSyncTime: StateFlow<Long?> = _lastSyncTime.asStateFlow()

    // Conflicts
    private val _conflicts = MutableStateFlow<List<SyncConflict>>(emptyList())
    val conflicts: StateFlow<List<SyncConflict>> = _conflicts.asStateFlow()

    // Pending count from DAO
    val pendingCount: Flow<Int> = offlineQueueDao.getPendingCount()

    // Total count from DAO
    val totalCount: Flow<Int> = offlineQueueDao.getTotalCount()

    // Combined sync state
    val syncState: Flow<SyncState> = combine(
        networkState,
        syncStatus,
        pendingCount,
        lastSyncTime
    ) { network, status, pending, lastSync ->
        SyncState(
            networkState = network,
            syncStatus = status,
            pendingCount = pending,
            lastSyncTime = lastSync
        )
    }

    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    init {
        setupNetworkMonitor()
        loadLastSyncTime()
        resetStuckOperations()
        schedulePeriodicSync()
    }

    // ============== Network Monitoring ==============

    private fun setupNetworkMonitor() {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        // Check initial state
        updateNetworkState(connectivityManager)

        // Register callback for changes
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                updateNetworkState(connectivityManager)
            }

            override fun onLost(network: Network) {
                updateNetworkState(connectivityManager)
            }

            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities
            ) {
                updateNetworkState(connectivityManager)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, networkCallback!!)
    }

    private fun updateNetworkState(connectivityManager: ConnectivityManager) {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)

        val newState = when {
            capabilities == null -> NetworkState.OFFLINE
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkState.WIFI
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkState.CELLULAR
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> NetworkState.UNKNOWN
            else -> NetworkState.OFFLINE
        }

        val oldState = _networkState.value
        _networkState.value = newState

        if (newState.isConnected && !oldState.isConnected) {
            // Just came online - trigger sync
            _syncStatus.value = SyncStatus.Idle
            triggerImmediateSync()
        } else if (!newState.isConnected) {
            _syncStatus.value = SyncStatus.Offline
        }
    }

    fun unregisterNetworkCallback() {
        networkCallback?.let {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            connectivityManager.unregisterNetworkCallback(it)
            networkCallback = null
        }
    }

    // ============== Queue Operations ==============

    /**
     * Enqueue a new operation.
     */
    suspend fun enqueue(operation: QueuedOperation) {
        offlineQueueDao.insert(operation.toEntity())
        pruneIfNeeded()
    }

    /**
     * Enqueue a message operation.
     */
    suspend fun enqueueMessage(content: String, recipientPublicKey: String, groupId: String? = null) {
        val payload = JSONObject().apply {
            put("content", content)
        }.toString()

        val operation = QueuedOperation(
            type = OperationType.MESSAGE,
            payload = payload,
            recipientPublicKey = recipientPublicKey,
            groupId = groupId,
            priority = 1
        )
        enqueue(operation)
    }

    /**
     * Enqueue a form submission.
     */
    suspend fun enqueueFormSubmission(formId: String, data: Map<String, Any>) {
        val payload = JSONObject().apply {
            put("formId", formId)
            put("data", JSONObject(data))
        }.toString()

        val operation = QueuedOperation(
            type = OperationType.FORM_SUBMISSION,
            payload = payload
        )
        enqueue(operation)
    }

    /**
     * Get all pending operations ready for sync.
     */
    suspend fun getPendingOperations(): List<QueuedOperationEntity> {
        return offlineQueueDao.getPendingOperations()
            .filter { it.isReadyForRetry() }
    }

    /**
     * Remove completed operations.
     */
    suspend fun removeCompleted() {
        offlineQueueDao.deleteCompleted()
    }

    /**
     * Clear all operations.
     */
    suspend fun clearQueue() {
        offlineQueueDao.deleteAll()
    }

    private suspend fun pruneIfNeeded() {
        offlineQueueDao.pruneExpired()
    }

    private fun resetStuckOperations() {
        scope.launch(Dispatchers.IO) {
            offlineQueueDao.resetStuckOperations()
        }
    }

    // ============== Sync Operations ==============

    /**
     * Trigger an immediate sync via WorkManager.
     */
    fun triggerImmediateSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                SYNC_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                syncRequest
            )
    }

    /**
     * Schedule periodic background sync.
     */
    private fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicSync = PeriodicWorkRequestBuilder<SyncWorker>(
            15, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                PERIODIC_SYNC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicSync
            )
    }

    /**
     * Get the current sync work status.
     */
    fun getSyncWorkStatus(): Flow<WorkInfo.State?> {
        return WorkManager.getInstance(context)
            .getWorkInfosForUniqueWorkFlow(SYNC_WORK_NAME)
            .map { workInfos ->
                workInfos.firstOrNull()?.state
            }
    }

    /**
     * Process all pending operations in the queue.
     * Called by SyncWorker.
     */
    suspend fun processPendingQueue(): Result<Int> {
        if (_isSyncing.value) {
            return Result.failure(SyncException("Sync already in progress"))
        }

        if (!_networkState.value.isConnected) {
            _syncStatus.value = SyncStatus.Offline
            return Result.failure(SyncException("Device is offline"))
        }

        _isSyncing.value = true

        return try {
            val operations = getPendingOperations()

            if (operations.isEmpty()) {
                _syncStatus.value = SyncStatus.Idle
                return Result.success(0)
            }

            _syncStatus.value = SyncStatus.Syncing(0f, "Syncing...")

            var processedCount = 0
            var failedCount = 0

            operations.forEachIndexed { index, operation ->
                val progress = (index + 1).toFloat() / operations.size
                _syncStatus.value = SyncStatus.Syncing(progress, "Processing ${operation.type.name.lowercase()}...")

                try {
                    offlineQueueDao.markProcessing(operation.id)
                    processOperation(operation)
                    offlineQueueDao.markCompleted(operation.id)
                    processedCount++
                } catch (e: Exception) {
                    offlineQueueDao.markFailed(operation.id, e.message ?: "Unknown error")
                    failedCount++
                }
            }

            _lastSyncTime.value = System.currentTimeMillis()
            saveLastSyncTime()

            _syncStatus.value = if (failedCount > 0) {
                SyncStatus.Error("$failedCount items failed")
            } else {
                SyncStatus.Completed(processedCount)
            }

            // Reset to idle after delay
            scope.launch {
                kotlinx.coroutines.delay(3000)
                if (_syncStatus.value is SyncStatus.Completed) {
                    _syncStatus.value = SyncStatus.Idle
                }
            }

            offlineQueueDao.deleteCompleted()

            Result.success(processedCount)
        } catch (e: Exception) {
            _syncStatus.value = SyncStatus.Error(e.message ?: "Sync failed")
            Result.failure(e)
        } finally {
            _isSyncing.value = false
        }
    }

    private suspend fun processOperation(operation: QueuedOperationEntity) {
        when (operation.type) {
            OperationType.MESSAGE -> processMessageOperation(operation)
            OperationType.FORM_SUBMISSION -> processFormSubmission(operation)
            OperationType.EVENT_RSVP -> processEventRsvp(operation)
            OperationType.PROFILE_UPDATE -> processProfileUpdate(operation)
            OperationType.REACTION -> processReaction(operation)
            OperationType.GROUP_ACTION -> processGroupAction(operation)
            OperationType.MUTUAL_AID_REQUEST -> processMutualAidRequest(operation)
            OperationType.VOTE -> processVote(operation)
            OperationType.WIKI_EDIT -> processWikiEdit(operation)
            OperationType.CONTACT_NOTE -> processContactNote(operation)
        }
    }

    private suspend fun processMessageOperation(operation: QueuedOperationEntity) {
        val recipientPublicKey = operation.recipientPublicKey
            ?: throw SyncException("Missing recipient")

        val json = JSONObject(operation.payload)
        val content = json.optString("content")
            ?: throw SyncException("Invalid payload")

        // TODO: Route through TransportRouter
        // TransportRouter.sendMessage(content, recipientPublicKey)
    }

    private suspend fun processFormSubmission(operation: QueuedOperationEntity) {
        // Form submissions would be sent to appropriate endpoints
    }

    private suspend fun processEventRsvp(operation: QueuedOperationEntity) {
        // Process event RSVP
    }

    private suspend fun processProfileUpdate(operation: QueuedOperationEntity) {
        // Process profile update
    }

    private suspend fun processReaction(operation: QueuedOperationEntity) {
        // Process reaction
    }

    private suspend fun processGroupAction(operation: QueuedOperationEntity) {
        // Process group action
    }

    private suspend fun processMutualAidRequest(operation: QueuedOperationEntity) {
        // Process mutual aid request
    }

    private suspend fun processVote(operation: QueuedOperationEntity) {
        // Process vote
    }

    private suspend fun processWikiEdit(operation: QueuedOperationEntity) {
        // Process wiki edit
    }

    private suspend fun processContactNote(operation: QueuedOperationEntity) {
        // Process contact note
    }

    // ============== Conflict Resolution ==============

    /**
     * Add a conflict to be resolved.
     */
    fun addConflict(conflict: SyncConflict) {
        _conflicts.value = _conflicts.value + conflict
    }

    /**
     * Resolve a conflict with the specified strategy.
     */
    suspend fun resolveConflict(conflictId: String, resolution: ConflictResolution) {
        val conflict = _conflicts.value.find { it.id == conflictId }
            ?: throw SyncException("Conflict not found")

        when (resolution) {
            ConflictResolution.SERVER_WINS -> {
                // Discard local changes, keep server version
            }
            ConflictResolution.CLIENT_WINS -> {
                // Re-queue local version for sync
                val operation = QueuedOperation(
                    type = OperationType.valueOf(conflict.operationType),
                    payload = conflict.localVersion,
                    priority = 2
                )
                enqueue(operation)
            }
            ConflictResolution.MERGE -> {
                // Attempt to merge changes
                val winningVersion = if (conflict.localTimestamp > conflict.serverTimestamp) {
                    conflict.localVersion
                } else {
                    conflict.serverVersion
                }
                val operation = QueuedOperation(
                    type = OperationType.valueOf(conflict.operationType),
                    payload = winningVersion,
                    priority = 2
                )
                enqueue(operation)
            }
            ConflictResolution.MANUAL -> {
                // Leave for user to handle
            }
        }

        _conflicts.value = _conflicts.value.filter { it.id != conflictId }
    }

    /**
     * Clear all resolved conflicts.
     */
    fun clearResolvedConflicts() {
        _conflicts.value = _conflicts.value.filter { it.resolution == null }
    }

    // ============== Persistence ==============

    private fun saveLastSyncTime() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_SYNC_TIME, _lastSyncTime.value ?: 0L)
            .apply()
    }

    private fun loadLastSyncTime() {
        val timestamp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_SYNC_TIME, 0L)
        _lastSyncTime.value = if (timestamp > 0) timestamp else null
    }

    companion object {
        private const val SYNC_WORK_NAME = "buildit_sync"
        private const val PERIODIC_SYNC_WORK_NAME = "buildit_periodic_sync"
        private const val PREFS_NAME = "sync_prefs"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
    }
}

/**
 * Combined sync state for UI.
 */
data class SyncState(
    val networkState: NetworkState,
    val syncStatus: SyncStatus,
    val pendingCount: Int,
    val lastSyncTime: Long?
)

/**
 * Exception for sync errors.
 */
class SyncException(message: String) : Exception(message)

/**
 * WorkManager worker for background sync.
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Get SyncManager instance
        // In a real app, this would use Hilt WorkerFactory
        // For now, we return success and let the foreground handle sync
        return Result.success()
    }
}
