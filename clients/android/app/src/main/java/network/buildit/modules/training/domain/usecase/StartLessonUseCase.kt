package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import java.util.UUID
import javax.inject.Inject

/**
 * Result of starting a lesson.
 */
data class LessonStartResult(
    val lesson: Lesson,
    val progress: LessonProgress,
    val courseProgress: CourseProgress
)

/**
 * Use case for starting a lesson.
 */
class StartLessonUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager
) {
    /**
     * Starts or resumes a lesson for the current user.
     * Creates or updates progress records as needed.
     */
    suspend operator fun invoke(lessonId: String): ModuleResult<LessonStartResult> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            // Get the lesson
            val lesson = repository.getLesson(lessonId).first()
                ?: throw IllegalArgumentException("Lesson not found")

            // Get the module to find the course
            val module = repository.getModule(lesson.moduleId).first()
                ?: throw IllegalArgumentException("Module not found")

            // Get or create lesson progress
            val existingProgress = repository.getLessonProgress(lessonId, pubkey).first()
            val lessonProgress = if (existingProgress != null) {
                // Update last activity
                existingProgress.copy(
                    updated = System.currentTimeMillis() / 1000
                ).also { repository.updateProgress(it) }
            } else {
                // Create new progress
                LessonProgress(
                    id = UUID.randomUUID().toString(),
                    lessonId = lessonId,
                    pubkey = pubkey,
                    status = ProgressStatus.IN_PROGRESS,
                    score = null,
                    timeSpent = 0,
                    lastPosition = null,
                    completedAt = null,
                    attempts = null,
                    created = System.currentTimeMillis() / 1000,
                    updated = System.currentTimeMillis() / 1000
                ).also { repository.saveProgress(it) }
            }

            // Get or create course progress
            val existingCourseProgress = repository.getCourseProgress(module.courseId, pubkey).first()
            val courseProgress = if (existingCourseProgress != null) {
                existingCourseProgress.copy(
                    currentModuleId = lesson.moduleId,
                    currentLessonId = lessonId,
                    lastActivityAt = System.currentTimeMillis() / 1000
                ).also { repository.saveCourseProgress(it) }
            } else {
                // Count total lessons in course
                val allLessons = repository.getLessonsForCourse(module.courseId).first()
                CourseProgress(
                    id = UUID.randomUUID().toString(),
                    courseId = module.courseId,
                    pubkey = pubkey,
                    percentComplete = 0f,
                    lessonsCompleted = 0,
                    totalLessons = allLessons.size,
                    currentModuleId = lesson.moduleId,
                    currentLessonId = lessonId,
                    startedAt = System.currentTimeMillis() / 1000,
                    lastActivityAt = System.currentTimeMillis() / 1000,
                    completedAt = null
                ).also { repository.saveCourseProgress(it) }
            }

            LessonStartResult(
                lesson = lesson,
                progress = lessonProgress,
                courseProgress = courseProgress
            )
        }.toModuleResult()
    }

    /**
     * Updates the video position for a lesson.
     */
    suspend fun updateVideoPosition(lessonId: String, positionSeconds: Int): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val progress = repository.getLessonProgress(lessonId, pubkey).first()
                ?: throw IllegalArgumentException("No progress found for lesson")

            repository.updateProgress(
                progress.copy(
                    lastPosition = positionSeconds,
                    updated = System.currentTimeMillis() / 1000
                )
            )
        }.toModuleResult()
    }

    /**
     * Updates time spent on a lesson.
     */
    suspend fun updateTimeSpent(lessonId: String, additionalSeconds: Long): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val progress = repository.getLessonProgress(lessonId, pubkey).first()
                ?: throw IllegalArgumentException("No progress found for lesson")

            repository.updateProgress(
                progress.copy(
                    timeSpent = progress.timeSpent + additionalSeconds,
                    updated = System.currentTimeMillis() / 1000
                )
            )
        }.toModuleResult()
    }
}
