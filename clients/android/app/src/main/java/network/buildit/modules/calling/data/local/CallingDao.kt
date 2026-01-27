package network.buildit.modules.calling.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * DAO for call history records.
 */
@Dao
interface CallHistoryDao {
    /**
     * Get a specific call by ID.
     */
    @Query("SELECT * FROM call_history WHERE callId = :callId")
    suspend fun getCallById(callId: String): CallHistoryEntity?

    /**
     * Observe a specific call by ID.
     */
    @Query("SELECT * FROM call_history WHERE callId = :callId")
    fun observeCallById(callId: String): Flow<CallHistoryEntity?>

    /**
     * Get all calls ordered by start time (newest first).
     */
    @Query("SELECT * FROM call_history ORDER BY startedAt DESC")
    fun getAllCalls(): Flow<List<CallHistoryEntity>>

    /**
     * Get recent calls with pagination.
     */
    @Query("SELECT * FROM call_history ORDER BY startedAt DESC LIMIT :limit OFFSET :offset")
    fun getRecentCalls(limit: Int = 50, offset: Int = 0): Flow<List<CallHistoryEntity>>

    /**
     * Get calls with a specific contact.
     */
    @Query("SELECT * FROM call_history WHERE remotePubkey = :pubkey ORDER BY startedAt DESC")
    fun getCallsWithContact(pubkey: String): Flow<List<CallHistoryEntity>>

    /**
     * Get missed calls (incoming + not answered + not rejected).
     */
    @Query("""
        SELECT * FROM call_history
        WHERE direction = 'incoming'
        AND connectedAt IS NULL
        AND (endReason IS NULL OR endReason != 'rejected')
        ORDER BY startedAt DESC
    """)
    fun getMissedCalls(): Flow<List<CallHistoryEntity>>

    /**
     * Get missed calls count (for badge).
     */
    @Query("""
        SELECT COUNT(*) FROM call_history
        WHERE direction = 'incoming'
        AND connectedAt IS NULL
        AND (endReason IS NULL OR endReason != 'rejected')
    """)
    fun getMissedCallCount(): Flow<Int>

    /**
     * Get calls within a date range.
     */
    @Query("""
        SELECT * FROM call_history
        WHERE startedAt >= :startTime AND startedAt <= :endTime
        ORDER BY startedAt DESC
    """)
    fun getCallsInRange(startTime: Long, endTime: Long): Flow<List<CallHistoryEntity>>

    /**
     * Get group calls for a specific group.
     */
    @Query("SELECT * FROM call_history WHERE groupId = :groupId ORDER BY startedAt DESC")
    fun getGroupCalls(groupId: String): Flow<List<CallHistoryEntity>>

    /**
     * Get calls for a specific room.
     */
    @Query("SELECT * FROM call_history WHERE roomId = :roomId ORDER BY startedAt DESC")
    fun getRoomCalls(roomId: String): Flow<List<CallHistoryEntity>>

    /**
     * Search calls by remote name.
     */
    @Query("SELECT * FROM call_history WHERE remoteName LIKE '%' || :query || '%' ORDER BY startedAt DESC")
    fun searchCalls(query: String): Flow<List<CallHistoryEntity>>

    /**
     * Insert a new call history record.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(call: CallHistoryEntity)

    /**
     * Insert multiple call history records.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(calls: List<CallHistoryEntity>)

    /**
     * Update an existing call history record.
     */
    @Update
    suspend fun update(call: CallHistoryEntity)

    /**
     * Update call as connected.
     */
    @Query("UPDATE call_history SET connectedAt = :connectedAt WHERE callId = :callId")
    suspend fun markConnected(callId: String, connectedAt: Long)

    /**
     * Update call as ended.
     */
    @Query("""
        UPDATE call_history
        SET endedAt = :endedAt,
            duration = :duration,
            endReason = :endReason
        WHERE callId = :callId
    """)
    suspend fun markEnded(callId: String, endedAt: Long, duration: Long?, endReason: String)

    /**
     * Update participant count for group calls.
     */
    @Query("UPDATE call_history SET participantCount = :count WHERE callId = :callId")
    suspend fun updateParticipantCount(callId: String, count: Long)

    /**
     * Delete a specific call.
     */
    @Query("DELETE FROM call_history WHERE callId = :callId")
    suspend fun deleteById(callId: String)

    /**
     * Delete all calls with a contact.
     */
    @Query("DELETE FROM call_history WHERE remotePubkey = :pubkey")
    suspend fun deleteAllWithContact(pubkey: String)

    /**
     * Delete calls older than a timestamp.
     */
    @Query("DELETE FROM call_history WHERE startedAt < :timestamp")
    suspend fun deleteOlderThan(timestamp: Long)

    /**
     * Delete all call history.
     */
    @Query("DELETE FROM call_history")
    suspend fun deleteAll()
}

/**
 * DAO for call settings.
 */
@Dao
interface CallSettingsDao {
    /**
     * Get settings for a user.
     */
    @Query("SELECT * FROM call_settings WHERE userPubkey = :pubkey")
    suspend fun getSettings(pubkey: String): CallSettingsEntity?

    /**
     * Observe settings for a user.
     */
    @Query("SELECT * FROM call_settings WHERE userPubkey = :pubkey")
    fun observeSettings(pubkey: String): Flow<CallSettingsEntity?>

    /**
     * Insert or update settings.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(settings: CallSettingsEntity)

    /**
     * Update do not disturb mode.
     */
    @Query("UPDATE call_settings SET doNotDisturb = :enabled, updatedAt = :updatedAt WHERE userPubkey = :pubkey")
    suspend fun setDoNotDisturb(pubkey: String, enabled: Boolean, updatedAt: Long = System.currentTimeMillis())

    /**
     * Update relay only mode.
     */
    @Query("UPDATE call_settings SET relayOnlyMode = :enabled, updatedAt = :updatedAt WHERE userPubkey = :pubkey")
    suspend fun setRelayOnlyMode(pubkey: String, enabled: Boolean, updatedAt: Long = System.currentTimeMillis())

    /**
     * Update default call type.
     */
    @Query("UPDATE call_settings SET defaultCallType = :callType, updatedAt = :updatedAt WHERE userPubkey = :pubkey")
    suspend fun setDefaultCallType(pubkey: String, callType: String, updatedAt: Long = System.currentTimeMillis())

    /**
     * Update audio settings.
     */
    @Query("""
        UPDATE call_settings
        SET autoGainControl = :autoGain,
            echoCancellation = :echoCancellation,
            noiseSuppression = :noiseSuppression,
            updatedAt = :updatedAt
        WHERE userPubkey = :pubkey
    """)
    suspend fun updateAudioSettings(
        pubkey: String,
        autoGain: Boolean,
        echoCancellation: Boolean,
        noiseSuppression: Boolean,
        updatedAt: Long = System.currentTimeMillis()
    )

    /**
     * Update preferred devices.
     */
    @Query("""
        UPDATE call_settings
        SET preferredAudioInput = :audioInput,
            preferredAudioOutput = :audioOutput,
            preferredVideoInput = :videoInput,
            updatedAt = :updatedAt
        WHERE userPubkey = :pubkey
    """)
    suspend fun updatePreferredDevices(
        pubkey: String,
        audioInput: String?,
        audioOutput: String?,
        videoInput: String?,
        updatedAt: Long = System.currentTimeMillis()
    )

    /**
     * Delete settings for a user.
     */
    @Query("DELETE FROM call_settings WHERE userPubkey = :pubkey")
    suspend fun delete(pubkey: String)
}
