package network.buildit.modules.events.integration

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import network.buildit.modules.calling.service.SFUConferenceManager
import network.buildit.modules.events.domain.model.EventVirtualConfig

/**
 * WorkManager worker for starting event conferences on schedule.
 */
@HiltWorker
class ConferenceStartWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted private val params: WorkerParameters,
    private val conferenceManager: SFUConferenceManager,
    private val eventCallingIntegration: EventCallingIntegration
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "ConferenceStartWorker"
    }

    override suspend fun doWork(): Result {
        val eventId = inputData.getString("eventId")
        val eventTitle = inputData.getString("eventTitle")
        val createdBy = inputData.getString("createdBy")
        val rsvpPubkeys = inputData.getStringArray("rsvpPubkeys")?.toList()
        val waitingRoomEnabled = inputData.getBoolean("waitingRoomEnabled", true)
        val recordingEnabled = inputData.getBoolean("recordingEnabled", false)
        val e2eeRequired = inputData.getBoolean("e2eeRequired", false)
        val maxVirtualAttendees = inputData.getInt("maxVirtualAttendees", 100)

        if (eventId == null || eventTitle == null || createdBy == null) {
            Log.e(TAG, "Missing required data for conference start")
            return Result.failure()
        }

        Log.i(TAG, "Starting scheduled conference for event: $eventId")

        return try {
            // Create virtual config from work data
            val virtualConfig = EventVirtualConfig(
                enabled = true,
                waitingRoomEnabled = waitingRoomEnabled,
                recordingEnabled = recordingEnabled,
                e2eeRequired = e2eeRequired,
                maxVirtualAttendees = maxVirtualAttendees
            )

            // Create the conference room
            val roomId = conferenceManager.createConference(
                localPubkey = createdBy,
                displayName = eventTitle,
                settings = SFUConferenceManager.ConferenceSettings(
                    waitingRoom = waitingRoomEnabled,
                    muteOnJoin = true,
                    hostOnlyScreenShare = false,
                    e2ee = e2eeRequired,
                    maxParticipants = maxVirtualAttendees
                )
            )

            Log.i(TAG, "Conference created for event $eventId: room $roomId")

            // Send reminders to RSVPs
            if (!rsvpPubkeys.isNullOrEmpty()) {
                val joinUrl = "https://meet.buildit.network/join/$roomId"
                val message = "\"$eventTitle\" is starting now. Join here: $joinUrl"

                // In production, send notifications to all RSVPs
                rsvpPubkeys.forEach { pubkey ->
                    Log.d(TAG, "Sending notification to $pubkey: $message")
                    // notificationService.sendNotification(pubkey, message)
                }
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start conference for event: $eventId", e)
            Result.retry()
        }
    }
}
