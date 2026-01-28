package network.buildit.modules.crm.integration

import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Integration between CRM and Calling modules for caller ID and call history.
 *
 * Provides functionality for:
 * - Looking up contacts by phone number
 * - Creating contacts from calls
 * - Logging call interactions
 * - Tracking call history per contact
 * - Updating engagement scores based on calls
 * - Linking call recordings to contacts
 */
@Singleton
class CRMCallingIntegration @Inject constructor() {

    companion object {
        private const val TAG = "CRMCallingIntegration"

        // Engagement score adjustments
        private const val INBOUND_CALL_POINTS = 5
        private const val OUTBOUND_CALL_POINTS = 3
        private const val CALL_DURATION_POINTS_PER_MINUTE = 1
        private const val MAX_CALL_DURATION_POINTS = 10
    }

    // In-memory storage for call history (in production, this would use Room database)
    private val callHistoryByContact = ConcurrentHashMap<String, MutableList<CallHistoryRecord>>()

    // Contact phone number index for lookups
    private val phoneToContactIndex = ConcurrentHashMap<String, ContactPhoneEntry>()

    // Engagement scores
    private val engagementScores = ConcurrentHashMap<String, Int>()

    // State flows for observation
    private val _recentCallActivity = MutableStateFlow<List<CallHistoryRecord>>(emptyList())
    val recentCallActivity: StateFlow<List<CallHistoryRecord>> = _recentCallActivity.asStateFlow()

    /**
     * Look up contact by phone number.
     *
     * @param phone Phone number to search for.
     * @param groupId Optional group ID to filter by.
     * @return Caller lookup result with contact info if found.
     */
    suspend fun lookupByPhone(phone: String, groupId: String? = null): CallerLookupResult {
        val normalizedPhone = normalizePhoneNumber(phone)

        Log.d(TAG, "Looking up contact by phone: $normalizedPhone")

        val entry = phoneToContactIndex[normalizedPhone]
        if (entry == null) {
            return CallerLookupResult(
                found = false,
                contact = null,
                matchedField = null,
                previousCalls = null,
                lastCallDate = null
            )
        }

        // Filter by group if specified
        if (groupId != null && entry.contact.groupId != groupId) {
            return CallerLookupResult(
                found = false,
                contact = null,
                matchedField = null,
                previousCalls = null,
                lastCallDate = null
            )
        }

        // Get call history for this contact
        val callHistory = callHistoryByContact[entry.contact.id] ?: emptyList()
        val lastCall = callHistory.maxByOrNull { it.startedAt }

        return CallerLookupResult(
            found = true,
            contact = entry.contact,
            matchedField = entry.fieldType,
            previousCalls = callHistory.size,
            lastCallDate = lastCall?.startedAt
        )
    }

    /**
     * Create contact from call information.
     *
     * @param data Data from the call.
     * @param groupId Group to add the contact to.
     * @return Created CRM contact.
     */
    suspend fun createContactFromCall(
        data: CreateContactFromCallData,
        groupId: String
    ): CRMContact {
        val contactId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val contact = CRMContact(
            id = contactId,
            groupId = groupId,
            name = data.name,
            phone = data.phoneNumber,
            mobile = null,
            workPhone = null,
            email = null,
            notes = data.notes,
            engagementScore = 0,
            createdAt = now,
            updatedAt = now,
            source = ContactSource.CALL,
            sourceDetails = buildString {
                append("Created from call")
                data.hotlineId?.let { append(" via hotline $it") }
                data.operatorPubkey?.let { append(" by operator $it") }
            }
        )

        // Index the phone number
        val normalizedPhone = normalizePhoneNumber(data.phoneNumber)
        phoneToContactIndex[normalizedPhone] = ContactPhoneEntry(
            contact = contact,
            fieldType = PhoneFieldType.PHONE
        )

        Log.i(TAG, "Created contact $contactId from call: ${data.phoneNumber}")
        return contact
    }

    /**
     * Register existing contact's phone numbers for lookup.
     *
     * @param contact The contact to register.
     */
    fun registerContactPhones(contact: CRMContact) {
        contact.phone?.let { phone ->
            phoneToContactIndex[normalizePhoneNumber(phone)] = ContactPhoneEntry(contact, PhoneFieldType.PHONE)
        }
        contact.mobile?.let { mobile ->
            phoneToContactIndex[normalizePhoneNumber(mobile)] = ContactPhoneEntry(contact, PhoneFieldType.MOBILE)
        }
        contact.workPhone?.let { workPhone ->
            phoneToContactIndex[normalizePhoneNumber(workPhone)] = ContactPhoneEntry(contact, PhoneFieldType.WORK_PHONE)
        }
    }

    /**
     * Log call interaction to contact's history.
     *
     * @param contactId The contact ID.
     * @param call Call history record.
     * @return The saved call history record.
     */
    suspend fun logCallInteraction(
        contactId: String,
        call: CallHistoryRecord
    ): CallHistoryRecord {
        val recordWithId = if (call.id.isEmpty()) {
            call.copy(id = UUID.randomUUID().toString())
        } else {
            call
        }

        val history = callHistoryByContact.getOrPut(contactId) { mutableListOf() }
        history.add(recordWithId)

        // Update recent activity
        updateRecentActivity()

        Log.i(TAG, "Logged call interaction for contact $contactId: ${recordWithId.id}")
        return recordWithId
    }

    /**
     * Get call history for a contact.
     *
     * @param contactId The contact ID.
     * @param options Optional filtering options.
     * @return Flow of call history records.
     */
    fun getContactCallHistory(
        contactId: String,
        options: CallHistoryOptions? = null
    ): Flow<List<CallHistoryRecord>> {
        return flow {
            var records = callHistoryByContact[contactId]?.toList() ?: emptyList()

            // Apply filters
            options?.let { opts ->
                opts.direction?.let { dir ->
                    records = records.filter { it.direction == dir }
                }
                opts.dateFrom?.let { from ->
                    records = records.filter { it.startedAt >= from }
                }
                opts.dateTo?.let { to ->
                    records = records.filter { it.startedAt <= to }
                }
            }

            // Sort by date descending
            records = records.sortedByDescending { it.startedAt }

            // Apply pagination
            options?.let { opts ->
                opts.offset?.let { offset ->
                    records = records.drop(offset)
                }
                opts.limit?.let { limit ->
                    records = records.take(limit)
                }
            }

            emit(records)
        }
    }

    /**
     * Update engagement score after a call.
     *
     * @param contactId The contact ID.
     * @param callDuration Call duration in seconds.
     * @param direction Call direction.
     * @return Engagement update details.
     */
    suspend fun updateEngagementFromCall(
        contactId: String,
        callDuration: Int,
        direction: CallDirection
    ): CallEngagementUpdate {
        val previousScore = engagementScores.getOrDefault(contactId, 0)

        // Calculate points
        var points = when (direction) {
            CallDirection.INBOUND -> INBOUND_CALL_POINTS
            CallDirection.OUTBOUND -> OUTBOUND_CALL_POINTS
        }

        // Add duration bonus (capped)
        val durationMinutes = callDuration / 60
        val durationPoints = minOf(durationMinutes * CALL_DURATION_POINTS_PER_MINUTE, MAX_CALL_DURATION_POINTS)
        points += durationPoints

        val newScore = previousScore + points
        engagementScores[contactId] = newScore

        Log.d(TAG, "Updated engagement for contact $contactId: $previousScore -> $newScore (+$points)")

        return CallEngagementUpdate(
            contactId = contactId,
            previousScore = previousScore,
            newScore = newScore,
            callDuration = callDuration,
            callDirection = direction
        )
    }

    /**
     * Get call statistics for a contact.
     *
     * @param contactId The contact ID.
     * @return Aggregated call statistics.
     */
    suspend fun getContactCallStats(contactId: String): ContactCallStats {
        val records = callHistoryByContact[contactId] ?: emptyList()

        if (records.isEmpty()) {
            return ContactCallStats(
                contactId = contactId,
                totalCalls = 0,
                inboundCalls = 0,
                outboundCalls = 0,
                totalDuration = 0,
                averageDuration = 0,
                lastCallDate = null,
                missedCalls = 0
            )
        }

        val inbound = records.filter { it.direction == CallDirection.INBOUND }
        val outbound = records.filter { it.direction == CallDirection.OUTBOUND }
        val missed = records.filter { it.status == CallStatus.MISSED }
        val completed = records.filter { it.status == CallStatus.COMPLETED }

        val totalDuration = completed.sumOf { it.duration }
        val avgDuration = if (completed.isNotEmpty()) totalDuration / completed.size else 0

        return ContactCallStats(
            contactId = contactId,
            totalCalls = records.size,
            inboundCalls = inbound.size,
            outboundCalls = outbound.size,
            totalDuration = totalDuration,
            averageDuration = avgDuration,
            lastCallDate = records.maxOfOrNull { it.startedAt },
            missedCalls = missed.size
        )
    }

    /**
     * Link call recording to a contact's call history.
     *
     * @param contactId The contact ID.
     * @param callId The call ID.
     * @param recordingUrl URL to the recording.
     * @param transcriptUrl Optional URL to the transcript.
     */
    suspend fun linkCallRecording(
        contactId: String,
        callId: String,
        recordingUrl: String,
        transcriptUrl: String? = null
    ) {
        val history = callHistoryByContact[contactId] ?: return
        val index = history.indexOfFirst { it.id == callId }

        if (index >= 0) {
            val updated = history[index].copy(
                recordingUrl = recordingUrl,
                transcriptUrl = transcriptUrl
            )
            history[index] = updated
            Log.i(TAG, "Linked recording to call $callId for contact $contactId")
        } else {
            Log.w(TAG, "Call $callId not found for contact $contactId")
        }
    }

    /**
     * Add notes to a call.
     *
     * @param contactId The contact ID.
     * @param callId The call ID.
     * @param notes Notes to add.
     */
    suspend fun addCallNotes(
        contactId: String,
        callId: String,
        notes: String
    ) {
        val history = callHistoryByContact[contactId] ?: return
        val index = history.indexOfFirst { it.id == callId }

        if (index >= 0) {
            val existing = history[index].notes
            val updated = history[index].copy(
                notes = if (existing.isNullOrEmpty()) notes else "$existing\n$notes"
            )
            history[index] = updated
            Log.i(TAG, "Added notes to call $callId for contact $contactId")
        }
    }

    /**
     * Get engagement score for a contact.
     *
     * @param contactId The contact ID.
     * @return Current engagement score.
     */
    fun getEngagementScore(contactId: String): Int {
        return engagementScores.getOrDefault(contactId, 0)
    }

    /**
     * Observe call history for a contact.
     *
     * @param contactId The contact ID.
     * @return Flow of call history records.
     */
    fun observeContactCallHistory(contactId: String): Flow<List<CallHistoryRecord>> {
        return flow {
            val records = callHistoryByContact[contactId]?.sortedByDescending { it.startedAt }
                ?: emptyList()
            emit(records)
        }
    }

    private fun normalizePhoneNumber(phone: String): String {
        // Remove all non-digit characters except leading +
        val hasPlus = phone.startsWith("+")
        val digitsOnly = phone.filter { it.isDigit() }
        return if (hasPlus) "+$digitsOnly" else digitsOnly
    }

    private fun updateRecentActivity() {
        val allRecords = callHistoryByContact.values.flatten()
            .sortedByDescending { it.startedAt }
            .take(50)
        _recentCallActivity.value = allRecords
    }
}

/**
 * Result of looking up a contact by phone.
 */
data class CallerLookupResult(
    val found: Boolean,
    val contact: CRMContact?,
    val matchedField: PhoneFieldType?,
    val previousCalls: Int?,
    val lastCallDate: Long?
)

/**
 * Phone field types for matching.
 */
enum class PhoneFieldType {
    PHONE,
    MOBILE,
    WORK_PHONE
}

/**
 * CRM Contact representation for calling integration.
 */
@Serializable
data class CRMContact(
    val id: String,
    val groupId: String,
    val name: String?,
    val phone: String?,
    val mobile: String?,
    val workPhone: String?,
    val email: String?,
    val notes: String?,
    val engagementScore: Int,
    val createdAt: Long,
    val updatedAt: Long,
    val source: ContactSource? = null,
    val sourceDetails: String? = null
)

/**
 * Contact source.
 */
enum class ContactSource {
    CALL,
    IMPORT,
    FORM,
    MANUAL
}

/**
 * Internal index entry for phone lookup.
 */
internal data class ContactPhoneEntry(
    val contact: CRMContact,
    val fieldType: PhoneFieldType
)

/**
 * Call history record.
 */
@Serializable
data class CallHistoryRecord(
    val id: String,
    val contactId: String,
    val direction: CallDirection,
    val phoneNumber: String,
    val startedAt: Long,
    val endedAt: Long?,
    val duration: Int,
    val status: CallStatus,
    val recordingUrl: String?,
    val transcriptUrl: String?,
    val notes: String?,
    val operatorPubkey: String?,
    val hotlineId: String?,
    val created: Long
)

/**
 * Call direction.
 */
enum class CallDirection {
    INBOUND,
    OUTBOUND
}

/**
 * Call status.
 */
enum class CallStatus {
    COMPLETED,
    MISSED,
    VOICEMAIL,
    FAILED
}

/**
 * Options for filtering call history.
 */
data class CallHistoryOptions(
    val limit: Int? = null,
    val offset: Int? = null,
    val direction: CallDirection? = null,
    val dateFrom: Long? = null,
    val dateTo: Long? = null
)

/**
 * Result of engagement score update.
 */
data class CallEngagementUpdate(
    val contactId: String,
    val previousScore: Int,
    val newScore: Int,
    val callDuration: Int,
    val callDirection: CallDirection
)

/**
 * Aggregated call statistics for a contact.
 */
data class ContactCallStats(
    val contactId: String,
    val totalCalls: Int,
    val inboundCalls: Int,
    val outboundCalls: Int,
    val totalDuration: Int,
    val averageDuration: Int,
    val lastCallDate: Long?,
    val missedCalls: Int
)

/**
 * Data for creating a contact from a call.
 */
data class CreateContactFromCallData(
    val phoneNumber: String,
    val name: String? = null,
    val notes: String? = null,
    val hotlineId: String? = null,
    val operatorPubkey: String? = null
)
