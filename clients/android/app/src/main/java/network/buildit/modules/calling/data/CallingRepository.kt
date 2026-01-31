package network.buildit.modules.calling.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.generated.schemas.calling.CallHistory
import network.buildit.generated.schemas.calling.CallSettings
import network.buildit.modules.calling.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for calling data.
 *
 * Provides access to call history and settings using the generated schema types.
 * Handles local storage operations.
 */
@Singleton
class CallingRepository @Inject constructor(
    private val callHistoryDao: CallHistoryDao,
    private val callSettingsDao: CallSettingsDao
) {
    // ============== Call History Methods ==============

    /**
     * Get a specific call by ID.
     */
    suspend fun getCallById(callId: String): CallHistory? {
        return callHistoryDao.getCallById(callId)?.toCallHistory()
    }

    /**
     * Observe a specific call by ID.
     */
    fun observeCallById(callId: String): Flow<CallHistory?> {
        return callHistoryDao.observeCallById(callId).map { it?.toCallHistory() }
    }

    /**
     * Get all call history.
     */
    fun getAllCalls(): Flow<List<CallHistory>> {
        return callHistoryDao.getAllCalls().map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Get recent calls with pagination.
     */
    fun getRecentCalls(limit: Int = 50, offset: Int = 0): Flow<List<CallHistory>> {
        return callHistoryDao.getRecentCalls(limit, offset).map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Get calls with a specific contact.
     */
    fun getCallsWithContact(pubkey: String): Flow<List<CallHistory>> {
        return callHistoryDao.getCallsWithContact(pubkey).map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Get missed calls.
     */
    fun getMissedCalls(): Flow<List<CallHistory>> {
        return callHistoryDao.getMissedCalls().map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Get missed call count for badge.
     */
    fun getMissedCallCount(): Flow<Int> {
        return callHistoryDao.getMissedCallCount()
    }

    /**
     * Get calls within a date range.
     */
    fun getCallsInRange(startTime: Long, endTime: Long): Flow<List<CallHistory>> {
        return callHistoryDao.getCallsInRange(startTime, endTime).map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Get group calls for a group.
     */
    fun getGroupCalls(groupId: String): Flow<List<CallHistory>> {
        return callHistoryDao.getGroupCalls(groupId).map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Search calls by name.
     */
    fun searchCalls(query: String): Flow<List<CallHistory>> {
        return callHistoryDao.searchCalls(query).map { entities ->
            entities.map { it.toCallHistory() }
        }
    }

    /**
     * Save a call history entry.
     */
    suspend fun saveCall(callHistory: CallHistory) {
        callHistoryDao.insert(CallHistoryEntity.from(callHistory))
    }

    /**
     * Create and save an outgoing call entry.
     */
    suspend fun createOutgoingCall(
        callId: String,
        remotePubkey: String,
        remoteName: String?,
        callType: String,
        groupId: String? = null,
        roomId: String? = null
    ): CallHistoryEntity {
        val entity = CallHistoryEntity.createOutgoing(
            callId = callId,
            remotePubkey = remotePubkey,
            remoteName = remoteName,
            callType = callType,
            groupId = groupId,
            roomId = roomId
        )
        callHistoryDao.insert(entity)
        return entity
    }

    /**
     * Create and save an incoming call entry.
     */
    suspend fun createIncomingCall(
        callId: String,
        remotePubkey: String,
        remoteName: String?,
        callType: String,
        groupId: String? = null,
        roomId: String? = null
    ): CallHistoryEntity {
        val entity = CallHistoryEntity.createIncoming(
            callId = callId,
            remotePubkey = remotePubkey,
            remoteName = remoteName,
            callType = callType,
            groupId = groupId,
            roomId = roomId
        )
        callHistoryDao.insert(entity)
        return entity
    }

    /**
     * Mark a call as connected.
     */
    suspend fun markCallConnected(callId: String) {
        callHistoryDao.markConnected(callId, System.currentTimeMillis() / 1000)
    }

    /**
     * Mark a call as ended.
     */
    suspend fun markCallEnded(callId: String, reason: String) {
        val call = callHistoryDao.getCallById(callId) ?: return
        val endedAt = System.currentTimeMillis() / 1000
        val duration = call.connectedAt?.let { endedAt - it }

        callHistoryDao.markEnded(
            callId = callId,
            endedAt = endedAt,
            duration = duration,
            endReason = reason
        )
    }

    /**
     * Update participant count for group call.
     */
    suspend fun updateParticipantCount(callId: String, count: Long) {
        callHistoryDao.updateParticipantCount(callId, count)
    }

    /**
     * Delete a call from history.
     */
    suspend fun deleteCall(callId: String) {
        callHistoryDao.deleteById(callId)
    }

    /**
     * Delete all calls with a contact.
     */
    suspend fun deleteCallsWithContact(pubkey: String) {
        callHistoryDao.deleteAllWithContact(pubkey)
    }

    /**
     * Delete calls older than a certain age.
     */
    suspend fun deleteOldCalls(olderThanSeconds: Long) {
        val cutoff = (System.currentTimeMillis() / 1000) - olderThanSeconds
        callHistoryDao.deleteOlderThan(cutoff)
    }

    /**
     * Clear all call history.
     */
    suspend fun clearAllHistory() {
        callHistoryDao.deleteAll()
    }

    // ============== Call Settings Methods ==============

    /**
     * Get settings for a user.
     */
    suspend fun getSettings(pubkey: String): CallSettings? {
        return callSettingsDao.getSettings(pubkey)?.toCallSettings()
    }

    /**
     * Get settings entity (for local features not in schema).
     */
    suspend fun getSettingsEntity(pubkey: String): CallSettingsEntity? {
        return callSettingsDao.getSettings(pubkey)
    }

    /**
     * Observe settings for a user.
     */
    fun observeSettings(pubkey: String): Flow<CallSettings?> {
        return callSettingsDao.observeSettings(pubkey).map { it?.toCallSettings() }
    }

    /**
     * Observe settings entity.
     */
    fun observeSettingsEntity(pubkey: String): Flow<CallSettingsEntity?> {
        return callSettingsDao.observeSettings(pubkey)
    }

    /**
     * Save settings for a user.
     */
    suspend fun saveSettings(settings: CallSettings, pubkey: String) {
        callSettingsDao.upsert(CallSettingsEntity.from(settings, pubkey))
    }

    /**
     * Get or create default settings.
     */
    suspend fun getOrCreateSettings(pubkey: String): CallSettingsEntity {
        return callSettingsDao.getSettings(pubkey)
            ?: CallSettingsEntity.createDefault(pubkey).also {
                callSettingsDao.upsert(it)
            }
    }

    /**
     * Update full settings entity.
     */
    suspend fun updateSettings(settings: CallSettingsEntity) {
        callSettingsDao.upsert(settings.copy(updatedAt = System.currentTimeMillis()))
    }

    /**
     * Set do not disturb mode.
     */
    suspend fun setDoNotDisturb(pubkey: String, enabled: Boolean) {
        callSettingsDao.setDoNotDisturb(pubkey, enabled)
    }

    /**
     * Set relay only mode (for privacy).
     */
    suspend fun setRelayOnlyMode(pubkey: String, enabled: Boolean) {
        callSettingsDao.setRelayOnlyMode(pubkey, enabled)
    }

    /**
     * Set default call type.
     */
    suspend fun setDefaultCallType(pubkey: String, callType: String) {
        callSettingsDao.setDefaultCallType(pubkey, callType)
    }

    /**
     * Update audio processing settings.
     */
    suspend fun updateAudioSettings(
        pubkey: String,
        autoGain: Boolean,
        echoCancellation: Boolean,
        noiseSuppression: Boolean
    ) {
        callSettingsDao.updateAudioSettings(pubkey, autoGain, echoCancellation, noiseSuppression)
    }

    /**
     * Update preferred devices.
     */
    suspend fun updatePreferredDevices(
        pubkey: String,
        audioInput: String?,
        audioOutput: String?,
        videoInput: String?
    ) {
        callSettingsDao.updatePreferredDevices(pubkey, audioInput, audioOutput, videoInput)
    }

    /**
     * Check if do not disturb is enabled.
     */
    suspend fun isDoNotDisturb(pubkey: String): Boolean {
        return callSettingsDao.getSettings(pubkey)?.doNotDisturb ?: false
    }

    /**
     * Check if relay only mode is enabled.
     */
    suspend fun isRelayOnlyMode(pubkey: String): Boolean {
        return callSettingsDao.getSettings(pubkey)?.relayOnlyMode ?: false
    }

    /**
     * Check if unknown callers are allowed.
     */
    suspend fun allowsUnknownCallers(pubkey: String): Boolean {
        return callSettingsDao.getSettings(pubkey)?.allowUnknownCallers ?: false
    }
}
