package network.buildit.modules.training.integration

import network.buildit.core.redacted
import android.util.Log
import kotlinx.coroutines.flow.first
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Training event that can be added to the events calendar.
 */
data class TrainingEvent(
    val id: String,
    val title: String,
    val description: String,
    val startAt: Long,
    val endAt: Long,
    val courseId: String,
    val lessonId: String,
    val instructorPubkey: String,
    val maxParticipants: Int?,
    val requiresRSVP: Boolean,
    val conferenceRoomId: String?
)

/**
 * Integration between Training module and Events module.
 * Creates calendar events for live training sessions.
 */
@Singleton
class TrainingEventsIntegration @Inject constructor(
    private val trainingRepository: TrainingRepository
    // In a real implementation, would inject EventsManager
) {
    companion object {
        private const val TAG = "TrainingEventsIntegration"
    }

    /**
     * Creates a calendar event for a live training session.
     *
     * @param lesson The live session lesson
     * @param course The course containing the lesson
     * @param groupId Optional group ID for group-specific events
     * @return The created event ID
     */
    suspend fun createEventForLiveSession(
        lesson: Lesson,
        course: Course,
        groupId: String? = null
    ): String {
        require(lesson.type == LessonType.LiveSession) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession

        val trainingEvent = TrainingEvent(
            id = "training-${lesson.id}",
            title = "${course.title}: ${lesson.title}",
            description = buildEventDescription(lesson, course),
            startAt = content.scheduledAt,
            endAt = content.scheduledAt + (content.duration * 60),
            courseId = course.id,
            lessonId = lesson.id,
            instructorPubkey = content.instructorPubkey,
            maxParticipants = content.maxParticipants,
            requiresRSVP = content.requiresRSVP,
            conferenceRoomId = content.conferenceRoomId
        )

        Log.i(TAG, "Creating event for training session: ${trainingEvent.title}")

        // In a real implementation, this would:
        // 1. Call EventsManager to create the event
        // 2. Set up proper visibility and RSVP settings
        // 3. Link the event to the training module

        return trainingEvent.id
    }

    /**
     * Updates a calendar event when a live session is modified.
     *
     * @param lesson The updated live session lesson
     * @param course The course containing the lesson
     */
    suspend fun updateEventForLiveSession(
        lesson: Lesson,
        course: Course
    ) {
        require(lesson.type == LessonType.LiveSession) {
            "Lesson must be a live session"
        }

        val content = lesson.content as LessonContent.LiveSession
        val eventId = "training-${lesson.id}"

        Log.i(TAG, "Updating event for training session: $eventId")

        // In a real implementation, would call EventsManager to update
    }

    /**
     * Cancels a calendar event when a live session is cancelled.
     *
     * @param lessonId The lesson ID
     */
    suspend fun cancelEventForLiveSession(lessonId: String) {
        val eventId = "training-$lessonId"

        Log.i(TAG, "Cancelling event for training session: $eventId")

        // In a real implementation, would call EventsManager to cancel
    }

    /**
     * Gets upcoming live training sessions as events.
     *
     * @param groupId Optional group filter
     * @param limit Maximum number of events to return
     * @return List of upcoming training events
     */
    suspend fun getUpcomingTrainingSessions(
        groupId: String? = null,
        limit: Int = 10
    ): List<TrainingEvent> {
        val now = System.currentTimeMillis() / 1000
        val courses = trainingRepository.getCourses().first()

        val events = mutableListOf<TrainingEvent>()

        for (course in courses) {
            if (groupId != null && course.groupId != groupId) continue

            val lessons = trainingRepository.getLessonsForCourse(course.id).first()
            val liveSessions = lessons.filter { it.type == LessonType.LiveSession }

            for (lesson in liveSessions) {
                val content = lesson.content as LessonContent.LiveSession
                if (content.scheduledAt > now) {
                    events.add(
                        TrainingEvent(
                            id = "training-${lesson.id}",
                            title = "${course.title}: ${lesson.title}",
                            description = buildEventDescription(lesson, course),
                            startAt = content.scheduledAt,
                            endAt = content.scheduledAt + (content.duration * 60),
                            courseId = course.id,
                            lessonId = lesson.id,
                            instructorPubkey = content.instructorPubkey,
                            maxParticipants = content.maxParticipants,
                            requiresRSVP = content.requiresRSVP,
                            conferenceRoomId = content.conferenceRoomId
                        )
                    )
                }
            }
        }

        return events
            .sortedBy { it.startAt }
            .take(limit)
    }

    /**
     * Syncs an RSVP from the events module to training.
     *
     * @param eventId The event ID (training-{lessonId})
     * @param pubkey The user's public key
     * @param status The RSVP status
     */
    suspend fun syncRSVPFromEvent(
        eventId: String,
        pubkey: String,
        status: RSVPStatus
    ) {
        val lessonId = eventId.removePrefix("training-")

        val lesson = trainingRepository.getLesson(lessonId).first()
            ?: return

        if (lesson.type != LessonType.LiveSession) return

        val rsvp = LiveSessionRSVP(
            id = UUID.randomUUID().toString(),
            lessonId = lessonId,
            pubkey = pubkey,
            status = status,
            createdAt = System.currentTimeMillis() / 1000,
            updatedAt = System.currentTimeMillis() / 1000
        )

        trainingRepository.saveLiveSessionRSVP(rsvp)

        Log.i(TAG, "Synced RSVP from event: ${pubkey.redacted()} -> $status for $lessonId")
    }

    /**
     * Checks if events module is available.
     */
    fun isEventsModuleAvailable(): Boolean {
        // In a real implementation, would check if events module is enabled
        return true // Placeholder
    }

    private fun buildEventDescription(lesson: Lesson, course: Course): String {
        val content = lesson.content as LessonContent.LiveSession

        return buildString {
            appendLine("Live Training Session")
            appendLine()
            appendLine("Course: ${course.title}")
            appendLine("Topic: ${lesson.title}")
            lesson.description?.let {
                appendLine()
                appendLine(it)
            }
            appendLine()
            appendLine("Duration: ${content.duration} minutes")
            if (content.requiresRSVP) {
                appendLine("RSVP Required")
            }
            content.maxParticipants?.let {
                appendLine("Max Participants: $it")
            }
        }
    }
}
