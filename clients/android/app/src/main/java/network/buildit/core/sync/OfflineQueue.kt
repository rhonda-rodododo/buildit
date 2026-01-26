package network.buildit.core.sync

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import java.util.UUID

/**
 * Type of operation that can be queued for offline sync.
 */
enum class OperationType {
    MESSAGE,
    FORM_SUBMISSION,
    EVENT_RSVP,
    PROFILE_UPDATE,
    REACTION,
    GROUP_ACTION,
    MUTUAL_AID_REQUEST,
    VOTE,
    WIKI_EDIT,
    CONTACT_NOTE
}

/**
 * Status of a queued operation.
 */
enum class OperationStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED,
    CANCELLED
}

/**
 * Room entity for queued operations.
 *
 * Represents an operation that needs to be synchronized when the device is online.
 * Operations are persisted to survive app restarts and are processed with retry logic.
 */
@Entity(
    tableName = "offline_queue",
    indices = [
        Index("status"),
        Index("createdAt"),
        Index("type"),
        Index("priority")
    ]
)
data class QueuedOperationEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** Type of operation */
    val type: OperationType,

    /** JSON-encoded payload data */
    val payload: String,

    /** Optional recipient public key for messages */
    val recipientPublicKey: String? = null,

    /** Optional group ID for group-related operations */
    val groupId: String? = null,

    /** When the operation was created */
    val createdAt: Long = System.currentTimeMillis(),

    /** Current status of the operation */
    val status: OperationStatus = OperationStatus.PENDING,

    /** Number of retry attempts */
    val retryCount: Int = 0,

    /** Last attempt timestamp */
    val lastAttemptAt: Long? = null,

    /** Error message if failed */
    val errorMessage: String? = null,

    /** Priority (higher = more important) */
    val priority: Int = 0
) {
    companion object {
        /** Maximum retry attempts before giving up */
        const val MAX_RETRY_ATTEMPTS = 10

        /** Maximum age for operations (7 days in milliseconds) */
        const val MAX_OPERATION_AGE_MS = 7L * 24 * 60 * 60 * 1000
    }

    /**
     * Calculate the next retry time using exponential backoff.
     * Returns null if the operation shouldn't be retried.
     */
    fun getNextRetryTime(): Long? {
        if (status == OperationStatus.COMPLETED || status == OperationStatus.CANCELLED) {
            return null
        }
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
            return null
        }
        if (retryCount == 0) {
            return System.currentTimeMillis()
        }

        // Exponential backoff: 2^retryCount seconds, capped at 30 minutes
        val delaySeconds = minOf(1 shl retryCount, 1800).toLong()
        val delayMs = delaySeconds * 1000

        return (lastAttemptAt ?: System.currentTimeMillis()) + delayMs
    }

    /**
     * Whether the operation can be retried.
     */
    fun canRetry(): Boolean {
        return retryCount < MAX_RETRY_ATTEMPTS &&
            status != OperationStatus.COMPLETED &&
            status != OperationStatus.CANCELLED
    }

    /**
     * Whether the operation is ready for retry.
     */
    fun isReadyForRetry(): Boolean {
        if (!canRetry()) return false
        val nextRetry = getNextRetryTime() ?: return false
        return nextRetry <= System.currentTimeMillis()
    }
}

/**
 * Data class for queueing operations (without Entity annotations).
 * Used for creating new operations before inserting into the database.
 */
data class QueuedOperation(
    val id: String = UUID.randomUUID().toString(),
    val type: OperationType,
    val payload: String,
    val recipientPublicKey: String? = null,
    val groupId: String? = null,
    val priority: Int = 0
) {
    fun toEntity(): QueuedOperationEntity {
        return QueuedOperationEntity(
            id = id,
            type = type,
            payload = payload,
            recipientPublicKey = recipientPublicKey,
            groupId = groupId,
            priority = priority
        )
    }
}

/**
 * DAO for offline queue operations.
 */
@Dao
interface OfflineQueueDao {

    // ============== Insert Operations ==============

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(operation: QueuedOperationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(operations: List<QueuedOperationEntity>)

    // ============== Query Operations ==============

    @Query("SELECT * FROM offline_queue ORDER BY priority DESC, createdAt ASC")
    fun getAllOperations(): Flow<List<QueuedOperationEntity>>

    @Query("SELECT * FROM offline_queue WHERE id = :id")
    suspend fun getById(id: String): QueuedOperationEntity?

    @Query("SELECT * FROM offline_queue WHERE status = :status ORDER BY priority DESC, createdAt ASC")
    suspend fun getByStatus(status: OperationStatus): List<QueuedOperationEntity>

    @Query("SELECT * FROM offline_queue WHERE status = :status ORDER BY priority DESC, createdAt ASC")
    fun getByStatusFlow(status: OperationStatus): Flow<List<QueuedOperationEntity>>

    @Query("""
        SELECT * FROM offline_queue
        WHERE (status = 'PENDING' OR (status = 'FAILED' AND retryCount < :maxRetries))
        ORDER BY priority DESC, createdAt ASC
    """)
    suspend fun getPendingOperations(maxRetries: Int = QueuedOperationEntity.MAX_RETRY_ATTEMPTS): List<QueuedOperationEntity>

    @Query("""
        SELECT * FROM offline_queue
        WHERE (status = 'PENDING' OR (status = 'FAILED' AND retryCount < :maxRetries))
        ORDER BY priority DESC, createdAt ASC
    """)
    fun getPendingOperationsFlow(maxRetries: Int = QueuedOperationEntity.MAX_RETRY_ATTEMPTS): Flow<List<QueuedOperationEntity>>

    @Query("SELECT * FROM offline_queue WHERE type = :type ORDER BY priority DESC, createdAt ASC")
    suspend fun getByType(type: OperationType): List<QueuedOperationEntity>

    @Query("SELECT * FROM offline_queue WHERE type = :type ORDER BY priority DESC, createdAt ASC")
    fun getByTypeFlow(type: OperationType): Flow<List<QueuedOperationEntity>>

    @Query("SELECT * FROM offline_queue WHERE recipientPublicKey = :pubkey ORDER BY createdAt ASC")
    suspend fun getForRecipient(pubkey: String): List<QueuedOperationEntity>

    @Query("SELECT * FROM offline_queue WHERE groupId = :groupId ORDER BY createdAt ASC")
    suspend fun getForGroup(groupId: String): List<QueuedOperationEntity>

    // ============== Count Operations ==============

    @Query("""
        SELECT COUNT(*) FROM offline_queue
        WHERE status = 'PENDING' OR (status = 'FAILED' AND retryCount < :maxRetries)
    """)
    fun getPendingCount(maxRetries: Int = QueuedOperationEntity.MAX_RETRY_ATTEMPTS): Flow<Int>

    @Query("SELECT COUNT(*) FROM offline_queue")
    fun getTotalCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM offline_queue WHERE status = :status")
    fun getCountByStatus(status: OperationStatus): Flow<Int>

    // ============== Update Operations ==============

    @Update
    suspend fun update(operation: QueuedOperationEntity)

    @Query("UPDATE offline_queue SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: OperationStatus)

    @Query("""
        UPDATE offline_queue
        SET status = :status, lastAttemptAt = :timestamp
        WHERE id = :id
    """)
    suspend fun markProcessing(id: String, status: OperationStatus = OperationStatus.PROCESSING, timestamp: Long = System.currentTimeMillis())

    @Query("""
        UPDATE offline_queue
        SET status = 'COMPLETED'
        WHERE id = :id
    """)
    suspend fun markCompleted(id: String)

    @Query("""
        UPDATE offline_queue
        SET status = 'FAILED',
            retryCount = retryCount + 1,
            lastAttemptAt = :timestamp,
            errorMessage = :errorMessage
        WHERE id = :id
    """)
    suspend fun markFailed(id: String, errorMessage: String, timestamp: Long = System.currentTimeMillis())

    @Query("""
        UPDATE offline_queue
        SET status = 'PENDING'
        WHERE id = :id AND retryCount < :maxRetries
    """)
    suspend fun markForRetry(id: String, maxRetries: Int = QueuedOperationEntity.MAX_RETRY_ATTEMPTS)

    @Query("UPDATE offline_queue SET status = 'CANCELLED' WHERE id = :id")
    suspend fun cancel(id: String)

    // ============== Delete Operations ==============

    @Delete
    suspend fun delete(operation: QueuedOperationEntity)

    @Query("DELETE FROM offline_queue WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM offline_queue WHERE status = 'COMPLETED'")
    suspend fun deleteCompleted()

    @Query("DELETE FROM offline_queue WHERE status = 'CANCELLED'")
    suspend fun deleteCancelled()

    @Query("DELETE FROM offline_queue WHERE createdAt < :cutoffTime AND status != 'PROCESSING'")
    suspend fun deleteOlderThan(cutoffTime: Long)

    @Query("DELETE FROM offline_queue")
    suspend fun deleteAll()

    // ============== Cleanup Operations ==============

    /**
     * Prune expired operations (older than 7 days) and completed operations (older than 1 day).
     */
    @Query("""
        DELETE FROM offline_queue
        WHERE (createdAt < :expiredCutoff AND status != 'PROCESSING')
           OR (status = 'COMPLETED' AND createdAt < :completedCutoff)
    """)
    suspend fun pruneExpired(
        expiredCutoff: Long = System.currentTimeMillis() - QueuedOperationEntity.MAX_OPERATION_AGE_MS,
        completedCutoff: Long = System.currentTimeMillis() - (24 * 60 * 60 * 1000)
    )

    /**
     * Reset any stuck processing operations back to pending.
     * This handles cases where the app crashed during processing.
     */
    @Query("""
        UPDATE offline_queue
        SET status = 'PENDING'
        WHERE status = 'PROCESSING' AND lastAttemptAt < :stuckThreshold
    """)
    suspend fun resetStuckOperations(stuckThreshold: Long = System.currentTimeMillis() - (5 * 60 * 1000))
}
