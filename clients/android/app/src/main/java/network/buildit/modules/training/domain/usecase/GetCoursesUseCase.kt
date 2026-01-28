package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.training.domain.model.Course
import network.buildit.modules.training.domain.model.CourseQueryOptions
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Inject

/**
 * Use case for retrieving training courses.
 */
class GetCoursesUseCase @Inject constructor(
    private val repository: TrainingRepository
) {
    /**
     * Gets all published courses.
     */
    operator fun invoke(): Flow<List<Course>> {
        return repository.getCourses()
    }

    /**
     * Gets courses with query options.
     */
    fun withOptions(options: CourseQueryOptions): Flow<List<Course>> {
        return repository.getCourses(options)
    }

    /**
     * Gets courses for a specific group.
     */
    fun forGroup(groupId: String): Flow<List<Course>> {
        return repository.getCoursesByGroup(groupId)
    }
}
