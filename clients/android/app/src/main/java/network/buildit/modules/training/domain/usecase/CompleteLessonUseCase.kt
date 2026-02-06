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
 * Result of completing a lesson.
 */
data class LessonCompletionResult(
    val lessonProgress: LessonProgress,
    val courseProgress: CourseProgress,
    val courseCompleted: Boolean,
    val certificationEarned: Certification?
)

/**
 * Use case for marking a lesson as complete.
 */
class CompleteLessonUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager,
    private val issueCertificationUseCase: IssueCertificationUseCase
) {
    /**
     * Marks a lesson as complete and updates course progress.
     * If the course is complete and certification is enabled, issues a certificate.
     */
    suspend operator fun invoke(
        lessonId: String,
        score: Int? = null
    ): ModuleResult<LessonCompletionResult> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val now = System.currentTimeMillis() / 1000

            // Get the lesson
            val lesson = repository.getLesson(lessonId).first()
                ?: throw IllegalArgumentException("Lesson not found")

            // Get the module
            val module = repository.getModule(lesson.moduleId).first()
                ?: throw IllegalArgumentException("Module not found")

            // Update or create lesson progress
            val existingProgress = repository.getLessonProgress(lessonId, pubkey).first()
            val lessonProgress = if (existingProgress != null) {
                existingProgress.copy(
                    status = ProgressStatus.Completed,
                    score = score ?: existingProgress.score,
                    completedAt = now,
                    updated = now
                ).also { repository.updateProgress(it) }
            } else {
                LessonProgress(
                    id = UUID.randomUUID().toString(),
                    lessonId = lessonId,
                    pubkey = pubkey,
                    status = ProgressStatus.Completed,
                    score = score,
                    timeSpent = 0,
                    lastPosition = null,
                    completedAt = now,
                    attempts = 1,
                    created = now,
                    updated = now
                ).also { repository.saveProgress(it) }
            }

            // Update course progress
            val courseId = module.courseId
            val allLessons = repository.getLessonsForCourse(courseId).first()
            val allProgress = repository.getLessonProgressForCourse(courseId, pubkey).first()

            val completedLessons = allProgress.count { it.status == ProgressStatus.Completed }
            val totalLessons = allLessons.size
            val percentComplete = if (totalLessons > 0) {
                (completedLessons.toFloat() / totalLessons.toFloat()) * 100f
            } else 0f

            val courseComplete = completedLessons >= totalLessons

            val existingCourseProgress = repository.getCourseProgress(courseId, pubkey).first()
            val courseProgress = if (existingCourseProgress != null) {
                existingCourseProgress.copy(
                    percentComplete = percentComplete,
                    lessonsCompleted = completedLessons,
                    totalLessons = totalLessons,
                    lastActivityAt = now,
                    completedAt = if (courseComplete) now else null
                ).also { repository.saveCourseProgress(it) }
            } else {
                CourseProgress(
                    id = UUID.randomUUID().toString(),
                    courseId = courseId,
                    pubkey = pubkey,
                    percentComplete = percentComplete,
                    lessonsCompleted = completedLessons,
                    totalLessons = totalLessons,
                    currentModuleId = module.id,
                    currentLessonId = lessonId,
                    startedAt = now,
                    lastActivityAt = now,
                    completedAt = if (courseComplete) now else null
                ).also { repository.saveCourseProgress(it) }
            }

            // Check if certification should be issued
            var certification: Certification? = null
            if (courseComplete) {
                val course = repository.getCourse(courseId).first()
                if (course?.certificationEnabled == true) {
                    // Check if all required lessons were passed
                    val requiredLessons = allLessons.filter { it.requiredForCertification }
                    val allRequiredPassed = requiredLessons.all { reqLesson ->
                        val progress = allProgress.find { it.lessonId == reqLesson.id }
                        progress?.status == ProgressStatus.Completed &&
                                (reqLesson.passingScore == null || (progress.score ?: 0) >= reqLesson.passingScore)
                    }

                    if (allRequiredPassed) {
                        // Check if certification already exists
                        val existingCerts = repository.getCertifications(pubkey).first()
                        val existingCert = existingCerts.find { it.courseId == courseId && it.isValid }

                        if (existingCert == null) {
                            val result = issueCertificationUseCase(courseId)
                            if (result is ModuleResult.Success) {
                                certification = result.data
                            }
                        }
                    }
                }
            }

            LessonCompletionResult(
                lessonProgress = lessonProgress,
                courseProgress = courseProgress,
                courseCompleted = courseComplete,
                certificationEarned = certification
            )
        }.toModuleResult()
    }

    /**
     * Marks a lesson as incomplete (for re-taking).
     */
    suspend fun markIncomplete(lessonId: String): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val progress = repository.getLessonProgress(lessonId, pubkey).first()
                ?: throw IllegalArgumentException("No progress found for lesson")

            repository.updateProgress(
                progress.copy(
                    status = ProgressStatus.InProgress,
                    completedAt = null,
                    updated = System.currentTimeMillis() / 1000
                )
            )

            // Recalculate course progress
            val lesson = repository.getLesson(lessonId).first()
                ?: return@runCatching
            val module = repository.getModule(lesson.moduleId).first()
                ?: return@runCatching

            val courseId = module.courseId
            val allProgress = repository.getLessonProgressForCourse(courseId, pubkey).first()
            val allLessons = repository.getLessonsForCourse(courseId).first()

            val completedLessons = allProgress.count { it.status == ProgressStatus.Completed }
            val totalLessons = allLessons.size
            val percentComplete = if (totalLessons > 0) {
                (completedLessons.toFloat() / totalLessons.toFloat()) * 100f
            } else 0f

            val existingCourseProgress = repository.getCourseProgress(courseId, pubkey).first()
            if (existingCourseProgress != null) {
                repository.saveCourseProgress(
                    existingCourseProgress.copy(
                        percentComplete = percentComplete,
                        lessonsCompleted = completedLessons,
                        completedAt = null,
                        lastActivityAt = System.currentTimeMillis() / 1000
                    )
                )
            }
            Unit
        }.toModuleResult()
    }
}
