package network.buildit.modules.events.integration

import android.content.Context
import android.util.Log
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import network.buildit.generated.schemas.Event
import network.buildit.modules.calling.service.SFUConferenceManager
import network.buildit.modules.events.data.EventsRepository
import network.buildit.modules.events.domain.model.BreakoutRoomConfig
import network.buildit.modules.events.domain.model.EventVirtualConfig
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Integration between Events and Calling modules for hybrid/virtual events.
 *
 * Provides functionality for:
 * - Starting and ending conference rooms for events
 * - Sending join reminders to RSVPs
 * - Tracking virtual attendee participation
 * - Managing breakout rooms
 * - Scheduling automatic conference starts
 */
@Singleton
class EventCallingIntegration @Inject constructor(
    @ApplicationContext private val context: Context,
    private val conferenceManager: SFUConferenceManager,
    private val eventsRepository: EventsRepository
) {
    companion object {
        private const val TAG = "EventCallingIntegration"
        private const val WORK_NAME_PREFIX = "event_conference_"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val workManager = WorkManager.getInstance(context)

    // Active event conferences
    private val activeConferences = ConcurrentHashMap<String, EventConferenceRoom>()

    // Virtual attendance tracking
    private val attendanceRecords = ConcurrentHashMap<String, MutableList<VirtualAttendance>>()

    // State flows for UI observation
    private val _activeEventConferences = MutableStateFlow<Map<String, EventConferenceRoom>>(emptyMap())
    val activeEventConferences: StateFlow<Map<String, EventConferenceRoom>> = _activeEventConferences.asStateFlow()

    /**
     * Start conference room for an event.
     *
     * @param event The event to create a conference for.
     * @param virtualConfig Configuration for the virtual event.
     * @return The created conference room details.
     */
    suspend fun startEventConference(
        event: Event,
        virtualConfig: EventVirtualConfig
    ): EventConferenceRoom {
        Log.i(TAG, "Starting conference for event: ${event.id}")

        // Check if conference already exists
        activeConferences[event.id]?.let { existing ->
            Log.w(TAG, "Conference already exists for event: ${event.id}")
            return existing
        }

        // Create conference room via SFU manager
        val roomId = conferenceManager.createConference(
            localPubkey = event.createdBy,
            displayName = event.title,
            settings = SFUConferenceManager.ConferenceSettings(
                waitingRoom = virtualConfig.waitingRoomEnabled,
                muteOnJoin = true,
                hostOnlyScreenShare = false,
                e2ee = virtualConfig.e2eeRequired,
                maxParticipants = virtualConfig.maxVirtualAttendees ?: 100
            )
        )

        val conferenceRoom = EventConferenceRoom(
            roomId = roomId,
            eventId = event.id,
            joinUrl = generateJoinUrl(roomId),
            created = System.currentTimeMillis(),
            virtualConfig = virtualConfig
        )

        activeConferences[event.id] = conferenceRoom
        _activeEventConferences.value = activeConferences.toMap()

        // Initialize attendance tracking
        attendanceRecords[event.id] = mutableListOf()

        Log.i(TAG, "Conference created for event ${event.id}: room $roomId")
        return conferenceRoom
    }

    /**
     * End conference and save recording if enabled.
     *
     * @param eventId The event ID whose conference to end.
     * @return Recording URL if recording was enabled and saved.
     */
    suspend fun endEventConference(eventId: String): String? {
        val conference = activeConferences[eventId]
        if (conference == null) {
            Log.w(TAG, "No active conference found for event: $eventId")
            return null
        }

        Log.i(TAG, "Ending conference for event: $eventId")

        // Leave/end the conference
        conferenceManager.leaveConference()

        // Get recording URL if recording was enabled
        val recordingUrl = if (conference.virtualConfig.recordingEnabled) {
            // In production, this would retrieve the actual recording URL from the SFU
            "https://recordings.buildit.network/events/$eventId/${conference.roomId}.mp4"
        } else {
            null
        }

        // Clean up
        activeConferences.remove(eventId)
        _activeEventConferences.value = activeConferences.toMap()

        Log.i(TAG, "Conference ended for event $eventId, recording: $recordingUrl")
        return recordingUrl
    }

    /**
     * Send join reminders to RSVPs.
     *
     * @param event The event to send reminders for.
     * @param rsvpPubkeys List of pubkeys who RSVPed.
     * @param config Reminder configuration.
     */
    suspend fun sendJoinReminders(
        event: Event,
        rsvpPubkeys: List<String>,
        config: JoinReminderConfig
    ) {
        val conference = activeConferences[event.id]
        if (conference == null) {
            Log.w(TAG, "No active conference for event ${event.id}, cannot send reminders")
            return
        }

        Log.i(TAG, "Sending join reminders to ${rsvpPubkeys.size} attendees for event ${event.id}")

        val message = config.message ?: "\"${event.title}\" is starting in ${config.minutesBefore} minutes. " +
                "Join here: ${conference.joinUrl}"

        // In production, this would send via the notification service
        rsvpPubkeys.forEach { pubkey ->
            Log.d(TAG, "Sending reminder to $pubkey: $message")
            // notificationService.sendReminder(pubkey, message, conference.joinUrl)
        }
    }

    /**
     * Track virtual attendee join or leave action.
     *
     * @param eventId The event ID.
     * @param pubkey The attendee's pubkey.
     * @param action Join or leave action.
     * @return Updated attendance record.
     */
    suspend fun trackVirtualAttendee(
        eventId: String,
        pubkey: String,
        action: AttendeeAction
    ): VirtualAttendance? {
        val records = attendanceRecords[eventId]
        if (records == null) {
            Log.w(TAG, "No attendance tracking for event: $eventId")
            return null
        }

        val now = System.currentTimeMillis()

        return when (action) {
            AttendeeAction.JOIN -> {
                // Check if already joined (no leave recorded)
                val existingJoin = records.lastOrNull {
                    it.pubkey == pubkey && it.leftAt == null
                }
                if (existingJoin != null) {
                    Log.d(TAG, "Attendee $pubkey already joined event $eventId")
                    return existingJoin
                }

                val attendance = VirtualAttendance(
                    id = UUID.randomUUID().toString(),
                    eventId = eventId,
                    pubkey = pubkey,
                    joinedAt = now,
                    leftAt = null,
                    durationSeconds = 0
                )
                records.add(attendance)
                Log.i(TAG, "Attendee $pubkey joined event $eventId")
                attendance
            }

            AttendeeAction.LEAVE -> {
                // Find the most recent join without a leave
                val lastJoin = records.lastOrNull {
                    it.pubkey == pubkey && it.leftAt == null
                }
                if (lastJoin == null) {
                    Log.w(TAG, "No join record found for attendee $pubkey in event $eventId")
                    return null
                }

                val duration = ((now - lastJoin.joinedAt) / 1000).toInt()
                val updated = lastJoin.copy(
                    leftAt = now,
                    durationSeconds = duration
                )
                records.remove(lastJoin)
                records.add(updated)
                Log.i(TAG, "Attendee $pubkey left event $eventId (duration: ${duration}s)")
                updated
            }
        }
    }

    /**
     * Get virtual attendance statistics for an event.
     *
     * @param eventId The event ID.
     * @return Attendance statistics.
     */
    suspend fun getVirtualAttendanceStats(eventId: String): VirtualAttendanceStats {
        val records = attendanceRecords[eventId] ?: emptyList()

        if (records.isEmpty()) {
            return VirtualAttendanceStats(
                eventId = eventId,
                totalVirtualAttendees = 0,
                peakConcurrentAttendees = 0,
                averageDurationMinutes = 0.0,
                attendees = emptyList()
            )
        }

        // Calculate unique attendees
        val uniqueAttendees = records.map { it.pubkey }.toSet()

        // Calculate peak concurrent attendees
        val allTimes = mutableListOf<Pair<Long, Int>>() // time, delta (+1 for join, -1 for leave)
        records.forEach { record ->
            allTimes.add(record.joinedAt to 1)
            record.leftAt?.let { allTimes.add(it to -1) }
        }
        allTimes.sortBy { it.first }

        var concurrent = 0
        var peakConcurrent = 0
        allTimes.forEach { (_, delta) ->
            concurrent += delta
            if (concurrent > peakConcurrent) {
                peakConcurrent = concurrent
            }
        }

        // Calculate average duration for completed sessions
        val completedSessions = records.filter { it.leftAt != null }
        val avgDuration = if (completedSessions.isNotEmpty()) {
            completedSessions.map { it.durationSeconds }.average() / 60.0
        } else {
            0.0
        }

        // Build attendee info list
        val attendeeInfo = uniqueAttendees.map { pubkey ->
            val pubkeyRecords = records.filter { it.pubkey == pubkey }
            val totalDuration = pubkeyRecords
                .filter { it.leftAt != null }
                .sumOf { it.durationSeconds }
            val firstJoin = pubkeyRecords.minOfOrNull { it.joinedAt } ?: 0L

            AttendeeInfo(
                pubkey = pubkey,
                totalDurationMinutes = totalDuration / 60.0,
                joinedAt = firstJoin,
                sessionCount = pubkeyRecords.size
            )
        }

        return VirtualAttendanceStats(
            eventId = eventId,
            totalVirtualAttendees = uniqueAttendees.size,
            peakConcurrentAttendees = peakConcurrent,
            averageDurationMinutes = avgDuration,
            attendees = attendeeInfo
        )
    }

    /**
     * Schedule automatic conference start before event.
     *
     * @param event The event to schedule for.
     * @param virtualConfig Virtual event configuration.
     * @param rsvpPubkeys Pubkeys to notify.
     */
    fun scheduleConferenceStart(
        event: Event,
        virtualConfig: EventVirtualConfig,
        rsvpPubkeys: List<String>
    ) {
        val startTime = event.startAt * 1000 // Convert to milliseconds
        val autoStartMs = virtualConfig.autoStartMinutes * 60 * 1000L
        val scheduledTime = startTime - autoStartMs
        val delay = scheduledTime - System.currentTimeMillis()

        if (delay <= 0) {
            Log.w(TAG, "Event ${event.id} is in the past or too soon to schedule")
            return
        }

        Log.i(TAG, "Scheduling conference start for event ${event.id} in ${delay / 1000}s")

        val workData = Data.Builder()
            .putString("eventId", event.id)
            .putString("eventTitle", event.title)
            .putString("createdBy", event.createdBy)
            .putStringArray("rsvpPubkeys", rsvpPubkeys.toTypedArray())
            .putBoolean("waitingRoomEnabled", virtualConfig.waitingRoomEnabled)
            .putBoolean("recordingEnabled", virtualConfig.recordingEnabled)
            .putBoolean("e2eeRequired", virtualConfig.e2eeRequired)
            .putInt("maxVirtualAttendees", virtualConfig.maxVirtualAttendees ?: 100)
            .build()

        val workRequest = OneTimeWorkRequestBuilder<ConferenceStartWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .setInputData(workData)
            .build()

        workManager.enqueueUniqueWork(
            "$WORK_NAME_PREFIX${event.id}",
            ExistingWorkPolicy.REPLACE,
            workRequest
        )
    }

    /**
     * Cancel scheduled conference start.
     *
     * @param eventId The event ID to cancel.
     */
    fun cancelScheduledConference(eventId: String) {
        workManager.cancelUniqueWork("$WORK_NAME_PREFIX$eventId")
        Log.i(TAG, "Cancelled scheduled conference for event: $eventId")
    }

    /**
     * Create breakout rooms for an event.
     *
     * @param eventId The event ID.
     * @param config Breakout room configuration.
     * @return List of created breakout room IDs.
     */
    suspend fun createBreakoutRooms(
        eventId: String,
        config: BreakoutRoomConfig
    ): List<String> {
        val conference = activeConferences[eventId]
        if (conference == null) {
            Log.w(TAG, "No active conference for event: $eventId")
            return emptyList()
        }

        val roomCount = config.roomCount ?: config.roomNames?.size ?: 2
        val roomNames = config.roomNames ?: (1..roomCount).map { "Breakout Room $it" }

        Log.i(TAG, "Creating $roomCount breakout rooms for event $eventId")

        // Create breakout rooms via conference manager
        val breakoutRoomIds = roomNames.mapIndexed { index, name ->
            // In production, this would create actual breakout rooms via the SFU
            val roomId = "${conference.roomId}-breakout-$index"
            Log.d(TAG, "Created breakout room: $roomId ($name)")
            roomId
        }

        return breakoutRoomIds
    }

    /**
     * Get active conference for an event.
     *
     * @param eventId The event ID.
     * @return The active conference room, or null if none.
     */
    fun getActiveConference(eventId: String): EventConferenceRoom? {
        return activeConferences[eventId]
    }

    /**
     * Observe active conference for an event.
     *
     * @param eventId The event ID.
     * @return Flow of the conference room state.
     */
    fun observeActiveConference(eventId: String): Flow<EventConferenceRoom?> {
        return _activeEventConferences.map { it[eventId] }
    }

    /**
     * Check if an event has an active conference.
     *
     * @param eventId The event ID.
     * @return True if conference is active.
     */
    fun hasActiveConference(eventId: String): Boolean {
        return activeConferences.containsKey(eventId)
    }

    private fun generateJoinUrl(roomId: String): String {
        return "https://meet.buildit.network/join/$roomId"
    }
}

/**
 * Action for attendee tracking.
 */
enum class AttendeeAction {
    JOIN,
    LEAVE
}

/**
 * Conference room details for an event.
 */
data class EventConferenceRoom(
    val roomId: String,
    val eventId: String,
    val joinUrl: String,
    val created: Long,
    val virtualConfig: EventVirtualConfig
)

/**
 * Virtual attendance record for a single session.
 */
data class VirtualAttendance(
    val id: String,
    val eventId: String,
    val pubkey: String,
    val joinedAt: Long,
    val leftAt: Long?,
    val durationSeconds: Int
)

/**
 * Aggregated virtual attendance statistics.
 */
data class VirtualAttendanceStats(
    val eventId: String,
    val totalVirtualAttendees: Int,
    val peakConcurrentAttendees: Int,
    val averageDurationMinutes: Double,
    val attendees: List<AttendeeInfo>
)

/**
 * Individual attendee information.
 */
data class AttendeeInfo(
    val pubkey: String,
    val totalDurationMinutes: Double,
    val joinedAt: Long,
    val sessionCount: Int = 1
)

/**
 * Configuration for join reminders.
 */
data class JoinReminderConfig(
    val minutesBefore: Int,
    val message: String? = null
)
