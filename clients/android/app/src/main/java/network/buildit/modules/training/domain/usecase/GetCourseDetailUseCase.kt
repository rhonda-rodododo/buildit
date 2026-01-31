package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import network.buildit.core.crypto.CryptoManager
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Inject

/**
 * Data class containing full course detail with modules and progress.
 */
data class CourseDetail(
    val course: Course,
    val modules: List<ModuleWithLessons>,
    val progress: CourseProgress?,
    val certification: Certification?
)

/**
 * Module with its lessons and progress.
 */
data class ModuleWithLessons(
    val module: TrainingModule,
    val lessons: List<LessonWithProgress>
)

/**
 * Lesson with its progress.
 */
data class LessonWithProgress(
    val lesson: Lesson,
    val progress: LessonProgress?
)

/**
 * Use case for retrieving detailed course information.
 */
class GetCourseDetailUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager
) {
    /**
     * Gets detailed course information including modules, lessons, and progress.
     */
    operator fun invoke(courseId: String): Flow<CourseDetail?> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return repository.getCourse(courseId).map { course ->
            course?.let {
                CourseDetail(
                    course = it,
                    modules = emptyList(),
                    progress = null,
                    certification = null
                )
            }
        }

        return combine(
            repository.getCourse(courseId),
            repository.getModules(courseId),
            repository.getLessonsForCourse(courseId),
            repository.getLessonProgressForCourse(courseId, pubkey),
            repository.getCourseProgress(courseId, pubkey),
            repository.getCertifications(pubkey)
        ) { results ->
            @Suppress("UNCHECKED_CAST")
            val course = results[0] as? Course
            @Suppress("UNCHECKED_CAST")
            val modules = results[1] as List<TrainingModule>
            @Suppress("UNCHECKED_CAST")
            val lessons = results[2] as List<Lesson>
            @Suppress("UNCHECKED_CAST")
            val lessonProgress = results[3] as List<LessonProgress>
            @Suppress("UNCHECKED_CAST")
            val courseProgress = results[4] as? CourseProgress
            @Suppress("UNCHECKED_CAST")
            val certifications = results[5] as List<Certification>

            course?.let {
                val progressMap = lessonProgress.associateBy { lp -> lp.lessonId }
                val certification = certifications.find { cert ->
                    cert.courseId == courseId && cert.isValid
                }

                val modulesWithLessons = modules.sortedBy { m -> m.order }.map { module ->
                    val moduleLessons = lessons
                        .filter { l -> l.moduleId == module.id }
                        .sortedBy { l -> l.order }
                        .map { lesson ->
                            LessonWithProgress(
                                lesson = lesson,
                                progress = progressMap[lesson.id]
                            )
                        }
                    ModuleWithLessons(
                        module = module,
                        lessons = moduleLessons
                    )
                }

                CourseDetail(
                    course = it,
                    modules = modulesWithLessons,
                    progress = courseProgress,
                    certification = certification
                )
            }
        }
    }

    /**
     * Gets just the course without detailed progress.
     */
    fun courseOnly(courseId: String): Flow<Course?> {
        return repository.getCourse(courseId)
    }

    /**
     * Gets modules for a course.
     */
    fun modules(courseId: String): Flow<List<TrainingModule>> {
        return repository.getModules(courseId)
    }

    /**
     * Gets lessons for a module.
     */
    fun lessons(moduleId: String): Flow<List<Lesson>> {
        return repository.getLessons(moduleId)
    }
}
