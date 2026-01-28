package network.buildit.modules.training.integration

import android.util.Log
import kotlinx.coroutines.flow.first
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Conference room configuration for training sessions.
 */
data class TrainingConferenceConfig(
    val name: String,
    val maxParticipants: Int? = null,
    val waitingRoom: Boolean = true,
    val allowRecording: Boolean = true,
    val e2eeRequired: Boolean = true,
    val instructorPubkey: String
)

/**
 * Conference room result.
 */
data class ConferenceRoom(
    val id: String,
    val joinUrl: String,
    val hostUrl: String?
)

/**
 * Integration between Training module and Calling module.
 * Provides live training sessions via video conferencing.
 */
@Singleton
class TrainingCallingIntegration @Inject constructor(
    private val trainingRepository: TrainingRepository
    // In a real implementation, would inject CallingManager
) {
    companion object {
        private const val TAG = "TrainingCallingIntegration"
    }

    /**
     * Creates a conference room for a live training session.
     *
     * @param lesson The live session lesson
     * @param config Conference configuration
     * @return Conference room details
     */
    suspend fun createLiveSession(
        lesson: Lesson,
        config: TrainingConferenceConfig
    ): ConferenceRoom {
        require(lesson.type == LessonType.LIVE_SESSION) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession

        // Generate conference room ID
        val conferenceRoomId = "training-${lesson.id}-${UUID.randomUUID().toString().take(8)}"

        Log.i(TAG, "Creating conference room for training session: $conferenceRoomId")

        // In a real implementation, this would:
        // 1. Call CallingManager to create a conference room
        // 2. Configure room settings (E2EE, recording, etc.)
        // 3. Set up instructor as host

        // Simulated conference room creation
        val joinUrl = "/conference/$conferenceRoomId"
        val hostUrl = "/conference/$conferenceRoomId/host"

        // Update the lesson with the conference room ID
        val updatedContent = content.copy(conferenceRoomId = conferenceRoomId)
        val updatedLesson = lesson.copy(
            content = updatedContent,
            updated = System.currentTimeMillis() / 1000
        )
        trainingRepository.updateLesson(updatedLesson)

        return ConferenceRoom(
            id = conferenceRoomId,
            joinUrl = joinUrl,
            hostUrl = hostUrl
        )
    }

    /**
     * Starts a live training session.
     * Sends join notifications to RSVPed participants.
     *
     * @param lessonId The lesson ID
     */
    suspend fun startLiveSession(lessonId: String) {
        val lesson = trainingRepository.getLesson(lessonId).first()
            ?: throw IllegalArgumentException("Lesson not found")

        require(lesson.type == LessonType.LIVE_SESSION) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession

        requireNotNull(content.conferenceRoomId) {
            "Conference room not created"
        }

        Log.i(TAG, "Starting live training session: $lessonId")

        // In a real implementation, this would:
        // 1. Get all RSVPed users
        // 2. Send push notifications with join link
        // 3. Start the conference room
        // 4. Enable recording if configured

        val rsvps = trainingRepository.getLiveSessionRSVPs(lessonId).first()
        val confirmedRsvps = rsvps.filter { it.status == RSVPStatus.CONFIRMED }

        Log.i(TAG, "Notifying ${confirmedRsvps.size} confirmed participants")

        // Would send notifications via MessagingManager or NotificationService
    }

    /**
     * Ends a live training session and saves the recording.
     *
     * @param lessonId The lesson ID
     * @return Recording URL if available
     */
    suspend fun endLiveSession(lessonId: String): String? {
        val lesson = trainingRepository.getLesson(lessonId).first()
            ?: throw IllegalArgumentException("Lesson not found")

        require(lesson.type == LessonType.LIVE_SESSION) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession

        Log.i(TAG, "Ending live training session: $lessonId")

        // In a real implementation, this would:
        // 1. End the conference room
        // 2. Get the recording URL
        // 3. Process and store the recording

        val recordingUrl = content.recordingUrl // Would come from calling module

        // Update lesson with recording URL if available
        if (recordingUrl != null) {
            val updatedContent = content.copy(recordingUrl = recordingUrl)
            val updatedLesson = lesson.copy(
                content = updatedContent,
                updated = System.currentTimeMillis() / 1000
            )
            trainingRepository.updateLesson(updatedLesson)
        }

        return recordingUrl
    }

    /**
     * Tracks attendance for a live training session.
     *
     * @param lessonId The lesson ID
     * @param pubkey The participant's public key
     * @param duration Duration attended in seconds
     */
    suspend fun trackLiveAttendance(
        lessonId: String,
        pubkey: String,
        duration: Long
    ) {
        val lesson = trainingRepository.getLesson(lessonId).first()
            ?: throw IllegalArgumentException("Lesson not found")

        require(lesson.type == LessonType.LIVE_SESSION) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession
        val now = System.currentTimeMillis() / 1000

        // Calculate if this was a complete session attendance
        val sessionDurationSeconds = content.duration * 60L
        val wasCompleteSession = duration >= (sessionDurationSeconds * 0.8) // 80% threshold

        val attendance = LiveSessionAttendance(
            id = UUID.randomUUID().toString(),
            lessonId = lessonId,
            pubkey = pubkey,
            joinedAt = now - duration,
            leftAt = now,
            duration = duration,
            wasCompleteSession = wasCompleteSession
        )

        trainingRepository.recordLiveSessionAttendance(attendance)

        Log.i(TAG, "Recorded attendance: $pubkey attended ${duration / 60} minutes (complete: $wasCompleteSession)")

        // If attended for significant duration, mark lesson progress
        if (duration > 30 * 60) { // 30 minutes minimum
            val existingProgress = trainingRepository.getLessonProgress(lessonId, pubkey).first()
            if (existingProgress == null || existingProgress.status != ProgressStatus.COMPLETED) {
                val progress = LessonProgress(
                    id = existingProgress?.id ?: UUID.randomUUID().toString(),
                    lessonId = lessonId,
                    pubkey = pubkey,
                    status = if (wasCompleteSession) ProgressStatus.COMPLETED else ProgressStatus.IN_PROGRESS,
                    score = null,
                    timeSpent = duration,
                    lastPosition = null,
                    completedAt = if (wasCompleteSession) now else null,
                    attempts = null,
                    created = existingProgress?.created ?: now,
                    updated = now
                )
                trainingRepository.saveProgress(progress)
            }
        }
    }

    /**
     * Gets conference room details for a training session.
     *
     * @param lessonId The lesson ID
     * @return Conference room status
     */
    suspend fun getConferenceDetails(lessonId: String): ConferenceStatus {
        val lesson = trainingRepository.getLesson(lessonId).first()
            ?: return ConferenceStatus(null, false, 0)

        if (lesson.type != LessonType.LIVE_SESSION) {
            return ConferenceStatus(null, false, 0)
        }

        val content = lesson.content as LessonContent.LiveSession

        // In a real implementation, would query the calling module for room status
        return ConferenceStatus(
            conferenceRoomId = content.conferenceRoomId,
            isActive = false, // Would check with calling module
            participantCount = 0 // Would get from calling module
        )
    }

    /**
     * Checks if the calling module is available and properly configured.
     */
    fun isCallingModuleAvailable(): Boolean {
        // In a real implementation, would check:
        // 1. If calling module is enabled
        // 2. If WebRTC is properly initialized
        // 3. If user has necessary permissions
        return true // Placeholder
    }
}

/**
 * Conference status information.
 */
data class ConferenceStatus(
    val conferenceRoomId: String?,
    val isActive: Boolean,
    val participantCount: Int
)
